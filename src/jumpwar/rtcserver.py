import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid
import time

import cv2
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.exceptions import InvalidStateError
from threading import Thread, Lock, Condition

from daedalus.builder import Builder, Lexer

from webrtc_server import add_dev_routes, main_loop, WebContext

# https://stackoverflow.com/questions/37512182/how-can-i-periodically-execute-a-function-with-asyncio

class Entity(object):
    def __init__(self, peer_id, entid):
        super(Entity, self).__init__()
        self.peer_id = peer_id
        self.entid = entid

        self.updates = []

    def push(self, update):

        if len(self.updates) == 0:
            self.updates.append(update)

        else:
            # TODO: fix ordering of events
            if update['frame'] > self.updates[-1]['frame']:
                self.updates.append(update)

        # TODO: how many events to keep
        if len(self.updates) > 20:
            self.updates.pop(0)


class Context(WebContext):

    def __init__(self):
        super().__init__()

        self.mapinfo = {'next_entid': 1}

        self.peer2ent = {}
        self.entid2ent = {}

        self.spawntimer = {} # entid -> timer

    def onConnect(self, peer_id):
        logging.info("peer connected: %s", peer_id)

    def onDisconnect(self, peer_id):
        logging.info("peer disconnected: %s", peer_id)

        if peer_id in self.peer2ent:

            reply = {
                "type": "logout",
                "entid": self.peer2ent[peer_id].entid,
                "uid": 1024 + self.frameIndex&0xFFF
            }

            ent = self.peer2ent[peer_id]

            del self.peer2ent[peer_id]
            del self.entid2ent[ent.entid]

            for other_id, peer in self.peers.items():
                if other_id != peer_id:
                    peer.send(json.dumps(reply))

    def _getEntityId(self):

            entid = self.mapinfo['next_entid']

            # TODO: verify entid not in the set of active entities

            self.mapinfo['next_entid'] = (1 + self.mapinfo['next_entid']) & 0xFFFF

            if self.mapinfo['next_entid'] <= 0:
                self.mapinfo['next_entid'] = 1

            return entid

    def onMessage(self, peer_id, message):

        #if message['type'] != "keepalive":
        #    print("onMessage", peer_id, message)

        if message['type'] == "login":

            if peer_id in self.peer2ent:
                pass

            else:

                entid = self._getEntityId()
                uid = 1024 + self.frameIndex&0xFFF
                reply1 = {
                    "type": "login",
                    "entid": entid,
                    "chara": message['chara'],
                    "uid": uid
                }

                reply2 = {
                    "type": "player_join",
                    "entid": entid,
                    "chara": message['chara'],
                    "uid": uid
                }

                ent = Entity(peer_id, entid)
                self.peer2ent[peer_id] = ent
                self.entid2ent[entid] = ent

                self.peers[peer_id].send(json.dumps(reply1))

                for other_id, peer in self.peers.items():
                    if other_id != peer_id:
                        peer.send(json.dumps(reply2))

        elif message['type'] == "keepalive":
            reply = {
                "type": "keepalive",
                "t0": message["t0"],
            }
            self.peers[peer_id].send(json.dumps(reply))
            # print("send reply", peer_id, message)

        elif message['type'] == "update":

            if peer_id in self.peer2ent:
                self.peer2ent[peer_id].push(message)

            for other_id, peer in self.peers.items():
                if other_id != peer_id:
                    peer.send(json.dumps(message))

        elif message['type'] == "inputs":
            for other_id, peer in self.peers.items():
                if other_id != peer_id:
                    peer.send(json.dumps(message))

        elif message['type'] == "input":
            for other_id, peer in self.peers.items():
                if other_id != peer_id:
                    peer.send(json.dumps(message))
        elif message['type'] == "hit":

            if peer_id in self.peer2ent:
                ent0 = self.peer2ent[peer_id]

            if message['target'] in self.entid2ent:
                ent2 = self.entid2ent[message['target']]

            if message['entid'] in self.entid2ent:
                ent1 = self.entid2ent[message['entid']]

            if ent0 and ent1 and ent2 and ent2.entid not in self.spawntimer:
                if ent1.updates and ent2.updates:
                    frame1 = ent1.updates[-1]['frame']
                    frame2 = ent2.updates[-1]['frame']
                    print(frame1, frame2, ent0.entid, message)

                    # if the source peer generated the event
                    if ent0.entid == ent1.entid:
                        delta = message['frame'] - frame1

                        frame = frame2 + delta
                        uid = max(1, 1024 + (self.frameIndex&0xFFF))

                        reply = {
                            "type": "hit",
                            "entid": ent2.entid,
                            "frame": frame,
                            "uid": uid,
                        }

                        self.spawntimer[ent2.entid] = 5

                        for _, peer in self.peers.items():
                             peer.send(json.dumps(reply))




        else:
            print("error on message", message)

        # if peers[peer_id].connected():
        #for peer in peers.values():
        #    if peer.connected():
        #        peer.send(json.dumps(message))

    def onUpdate(self, dt):

        for entid in list(self.spawntimer.keys()):
            self.spawntimer[entid] -= dt
            if self.spawntimer[entid] < 0:

                if entid in self.entid2ent:
                    ent = self.entid2ent[entid]
                    peer_id = ent.peer_id
                    reply = {
                            "type": "respawn",
                            "entid": entid,
                            "uid": 1024 + self.frameIndex&0xFFF,
                        }

                    if peer_id in self.peers:
                        self.peers[peer_id].send(json.dumps(reply))

                del self.spawntimer[entid]



def main():
    parser = argparse.ArgumentParser(
        description="WebRTC data-channels demo"
    )
    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=4100, help="Port for HTTP server (default: 8080)"
    )
    parser.add_argument("--record-to", help="Write received media to a file."),
    parser.add_argument("--verbose", "-v", action="count")
    parser.add_argument("--backend", type=str, default="webrtc")
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    if args.cert_file:
        ssl_context = ssl.SSLContext()
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
    else:
        ssl_context = None

    if args.backend not in ['webrtc']:
        raise Exception(args.backend)

    app = web.Application()

    index_js = "./src/jumpwar/app.js"
    # TODO: auto add the project directory to the  search path
    search_path = ["./src", "./src/jumpwar"]
    static_data = {"daedalus": {"env": {"backend": args.backend}}}
    static_path = "./src/jumpwar/static"

    add_dev_routes(app, index_js, search_path, static_data, static_path)

    loop = asyncio.new_event_loop()

    loop.create_task(main_loop(Context()))

    web.run_app(
        app,
        access_log=None,
        host=args.host,
        port=args.port,
        ssl_context=ssl_context,
        loop=loop
    )

if __name__ == '__main__':
    main()