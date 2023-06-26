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

from daedalus.builder import Builder

ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")

peers = {}
messages = []

def path_join_safe(root_directory: str, filename: str):
    """
    join the two path components ensuring that the returned value
    exists with root_directory as prefix.

    Using this function can prevent files not intended to be exposed by
    a webserver from being served, by making sure the returned path exists
    in a directory under the root directory.

    :param root_directory: the root directory. This must allways be provided by a trusted source.
    :param filename: a relative path to a file. This may be provided from untrusted input
    """

    root_directory = root_directory.replace("\\", "/")
    filename = filename.replace("\\", "/")

    # check for illegal path components
    parts = set(filename.split("/"))
    if ".." in parts or "." in parts:
        raise ValueError("invalid path")

    path = os.path.join(root_directory, filename)
    path = os.path.abspath(path)

    return path

class DevSite(object):

    def __init__(self, index_js, search_path, static_data, static_path, platform=None, **opts):
        super(DevSite, self).__init__()
        self.index_js = index_js
        self.search_path = search_path
        self.static_data = static_data
        self.static_path = static_path
        self.opts = opts

        self.builder = Builder(search_path, static_data, platform=platform)

        self.build()

    def build(self):
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)

site = None

async def route_index(request):
    global site
    site.build()
    return web.Response(content_type="text/html", text=site.html)

async def route_source(request):
    global site
    return web.Response(content_type="application/javascript", text=site.source)

async def route_style(request):
    global site
    return web.Response(content_type="text/css", text=site.style)

async def route_static(request):
    global site
    request.match_info.get('path', 0)
    try:
        path = request.match_info.get('path', 0)
        path = path_join_safe(site.static_path, path)
        return web.FileResponse(path=path)
    except ValueError:
        return web.json_response({'error': 'invalid id'})

class Peer(object):
    def __init__(self, uid, pc):
        super(Peer, self).__init__()
        self.uid = uid
        self.pc = pc
        self.dc = None

    def connected(self):
        return self.pc is not None and self.dc is not None

    def send(self, msg):
        if self.dc is not None:
            try:
                self.dc.send(msg)
            except InvalidStateError as e:
                logging.error(self.uid + ": send error : " + str(e))

async def route_rtc_offer(request):
    print("offer headers", request.headers)
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pc_id = str(uuid.uuid4())
    pc_sid = "PeerConnection(%s)" % pc_id

    peers[pc_id] = Peer(pc_id, pc)

    def log_info(msg, *args):
        logger.info(pc_sid + " " + msg, *args)
    def log_error(msg, *args):
        logger.error(pc_sid + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("datachannel")
    def on_datachannel(channel):
        log_info("Data connection opened")
        peers[pc_id].dc = channel

        # TODO: open not called
        # @channel.on("open")
        # def on_open(*args, **kwargs):
        #     print("dc open", args, kwargs)

        @channel.on("close")
        def on_close():
            log_info("Data connection closed")

            peers[pc_id].dc = None

        @channel.on("message")
        def on_message(message):
            if isinstance(message, str):
                obj = json.loads(message)
                #obj['type'] = "pong"
                #channel.send(json.dumps(obj))
                messages.append((pc_id, obj))

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s (%d)", pc.connectionState, len(peers))
        if pc.connectionState == "failed":
            await pc.close()
            del peers[pc_id]

    # handle offer
    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    content = json.dumps({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    })

    return web.Response(
        content_type="application/json",
        text=content
    )

async def on_shutdown(app):
    # close peer connections
    coros = [peer.pc.close() for peer in peers.values()]
    await asyncio.gather(*coros)
    peers.clear()

# https://stackoverflow.com/questions/37512182/how-can-i-periodically-execute-a-function-with-asyncio

class Context():

    def onMessage(self, peer_id, message):
        #message['type'] = "pong"
        #message['origin'] = peer_id

        if peers[peer_id].connected():
            peers[peer_id].send(json.dumps(message))
        #for peer in peers.values():
        #    if peer.connected():
        #        peer.send(json.dumps(message))

async def main_loop(ctxt):

    #queue = [[] for i in range(12)]
    #idx = 0
    #while True:
    #    for peer_id, message in queue[idx%len(queue)]:
    #        ctxt.onMessage(peer_id, message)
    #    queue[idx%len(queue)] = messages[:]
    #    messages.clear()
    #    idx += 1
    #    await asyncio.sleep(1/60)

    while True:
        for peer_id, message in messages:
            ctxt.onMessage(peer_id, message)
        messages.clear()
        await asyncio.sleep(1/60)

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

    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", route_index)
    app.router.add_get("/static/index.js", route_source)
    app.router.add_get("/static/index.css", route_style)
    app.router.add_get("/static/{path:.*}", route_static)
    app.router.add_post("/rtc/offer", route_rtc_offer)

    index_js = "./src/jumpwar/app.js"
    # TODO: auto add the project directory to the  search path
    search_path = ["./src", "./src/jumpwar"]
    static_data = {"daedalus": {"env": {"debug": True}}}
    static_path = "./src/jumpwar/static"

    global site
    site = DevSite(index_js, search_path, static_data, static_path)

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