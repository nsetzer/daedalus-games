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

class Map(object):
    def __init__(self):
        super(Map, self).__init__()

        self.peers = {} # entid => entity
        self.entities = {} # entid => entity

        self.frameIndex = 0

        self.nextEntId = 1

        self.peer2ent = {}
        self.entid2ent = {}

        self.spawntimer = {} # entid -> timer

        self.objects = []

        self.outbox = []

    def update(self, dt):

        self.frameIndex += 1

        for ent in self.entities:
            ent.update()

        for obj in self.objects:
            obj.update(dt)

        for entid in list(self.spawntimer.keys()):
            self.spawntimer[entid] -= dt
            if self.spawntimer[entid] < 0:

                if entid in self.entid2ent:
                    ent = self.entid2ent[entid]
                    peer_id = ent.peer_id
                    # TODO: send frame id with this message that is +6 frames in the future
                    reply = {
                            "type": "respawn",
                            "entid": entid,
                            "uid": 1024 + self.frameIndex&0xFFF,
                        }

                    if peer_id in self.peers:
                        self.peers[peer_id].send(json.dumps(reply))

                del self.spawntimer[entid]

        for message in self.outbox:
            print("sending", message)
            for other_id, peer in self.peers.items():
                peer.send(json.dumps(message))

        self.outbox = []

    def join(self, peer, message):

        if peer.uid in self.peers:
            pass

        else:

            entid = self.getEntityId()
            uid = 1024 + self.frameIndex&0xFFF

            # TODO: send frame id with this message that is +6 frames in the future
            reply1 = {
                "type": "login",
                "entid": entid,
                "chara": message['chara'],
                "uid": uid
            }

            # TODO: send frame id with this message that is +6 frames in the future
            reply2 = {
                "type": "player_join",
                "entid": entid,
                "chara": message['chara'],
                "uid": uid
            }

            reply3 = self.getState()

            self.peers[peer.uid] = peer

            ent = Entity(peer.uid, entid)
            self.peer2ent[peer.uid] = ent
            self.entid2ent[entid] = ent

            peer.send(json.dumps(reply1))
            peer.send(json.dumps(reply3))

            for other_id, peer in self.peers.items():
                if other_id != peer.uid:
                    peer.send(json.dumps(reply2))

    def logout(self, peer_id):
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

    def onMessage(self, peer_id, message):

        # TODO: create a per user offset map
        #       update the offset calculation for every received message
        #       when broadcasting to players use a single stable frame index
        #
        #       don't join the message ringbuffers
        #       this way the offsets can be changed without moving message buckets around

        if message['type'] == "keepalive":
            reply = {
                "type": "keepalive",
                "t0": message["t0"],
            }
            self.peers[peer_id].send(json.dumps(reply))

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

    def getState(self):
        return {
            "type": "map_info",
            "uid": max(1, 1024 + (self.frameIndex&0xFFF)),
            "objects": [obj.getMapState() for obj in self.objects]
        }

    def setState(self):
        pass

    def getEntityId(self):

        entid = self.nextEntId

        # TODO: verify entid not in the set of active entities

        self.nextEntId = (1 + self.nextEntId) & 0xFFFF

        if self.nextEntId <= 0:
            self.nextEntId = 1

        return entid

class MapEntity(object):
    def __init__(self, map, entid):
        super(MapEntity, self).__init__()
        self.entid = entid
        self.map = map
        self.next_uid = 1

    def update(self, dt):
        pass

    def post(self):
        self.map.outbox.append({
            "type": "update",
            "entid": self.entid,
            "uid": self.next_uid,
            "frame": self.map.frameIndex,
            "state": self.getState(),
        })
        self.next_uid += 1



class Entity(MapEntity):
    def __init__(self, peer_id, entid):
        super(Entity, self).__init__(None, entid)
        self.peer_id = peer_id

        self.updates = []
        self._offset = None

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

    def getFrameOffset(self, currentFrameIndex, message):
        alpha = 0.8
        inputDelay = 6

        if self._offset is None:
            self._offset = currentFrameIndex - message.frame

        frameIndex = message.frame + inputDelay + round(self._offset)
        delta = currentFrameIndex - message.frame
        self._offset = alpha * self._offset + ((1 - alpha) * delta)

        return frameIndex

class MovingPlatform(MapEntity):
    def __init__(self, map, entid):
        super().__init__(map, entid)

        self.x = 128
        self.y = 128

        self.xspeed = 20
        self.yspeed = 0

    def update(self, dt):


        self.x += self.xspeed*dt

        if self.x > 256:
            self.x = 256
            self.post()
            self.xspeed = -20

        if self.x < 128:
            self.x = 128
            self.post()
            self.xspeed = 20

    def getState(self):
        # for serializing updates to this entity
        return {
            "position": (self.x, self.y),
            "speed": (self.xspeed, self.yspeed)
        }

    def getMapState(self):
        # for serializing the current state of the map
        return {
            "className": "MovingPlatform",
            "entid": self.entid,
            "state": self.getState()
        }


class Context(WebContext):

    def __init__(self):
        super().__init__()

        self.peers = {}

        self.current_map = None

    def onConnect(self, peer):
        logging.info("peer connected: %s", peer.uid)

        if self.current_map == None:
            self.current_map = Map()
            self.current_map.objects.append(MovingPlatform(self.current_map, self.current_map.getEntityId()))

        self.peers[peer.uid] = peer

    def onDisconnect(self, peer_id):
        logging.info("peer disconnected: %s", peer_id)

        if self.current_map:
            self.current_map.logout(peer_id)

            if peer_id in self.peers:
                del self.peers[peer_id]

        if len(self.peers) == 0:
            self.current_map = None

    def onMessage(self, peer_id, message):



        if self.current_map:

            if message['type'] == "login":
                self.current_map.join(self.peers[peer_id], message)
            else:
                self.current_map.onMessage(peer_id, message)

    def onUpdate(self, dt):

        if self.current_map:
            self.current_map.update(dt)



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