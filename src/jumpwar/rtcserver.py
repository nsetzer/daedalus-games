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

class Context(WebContext):

    def __init__(self):
        super().__init__()

        self.mapinfo = {'next_entid': 1}

    def onConnect(self, peer_id):
        logging.info("peer connected: %s", peer_id)

    def onDisconnect(self, peer_id):
        logging.info("peer disconnected: %s", peer_id)

    def onMessage(self, peer_id, message):

        #if message['type'] != "keepalive":
        #    print("onMessage", peer_id, message)

        if message['type'] == "login":

            reply1 = {
                "type": "login",
                "entid": self.mapinfo['next_entid'],
                "uid": self.frameIndex&0xFF
            }

            reply2 = {
                "type": "player_join",
                "entid": self.mapinfo['next_entid'],
                "uid": self.frameIndex&0xFF
            }

            self.mapinfo['next_entid'] += 1

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
        else:
            print("error on message", message)

        # if peers[peer_id].connected():
        #for peer in peers.values():
        #    if peer.connected():
        #        peer.send(json.dumps(message))



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