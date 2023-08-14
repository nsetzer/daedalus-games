import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid
import time
from enum import Enum
import cv2
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.exceptions import InvalidStateError
from threading import Thread, Lock, Condition

from daedalus.builder import Builder, Lexer

site = None
peers = {}
messages = []

logging.getLogger("aioice.ice").setLevel(logging.WARNING)
logger = logging.getLogger("pc")

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

class ConnectionState(Enum):
    CONNECTING = 1
    CONNECTED = 2
    DISCONNECTING = 3
    DISCONNECTED = 4

class Peer(object):
    def __init__(self, uid, pc):
        super(Peer, self).__init__()
        self.uid = uid
        self.pc = pc
        self.dc = None
        self.error = False
        self.state = ConnectionState.CONNECTING

    def connected(self):
        return self.pc is not None and self.dc is not None

    def send(self, msg):
        if not self.error and self.dc is not None and self.state == ConnectionState.CONNECTED:
            try:
                self.dc.send(msg)
            except InvalidStateError as e:
                logging.error(self.uid + ": send error : %s : %s : %s", self.dc.readyState, type(e), str(e))

                # according to: aiortc/src/aiortc/rtcdatachannel.py
                # the readyState must be 'open' in order to send

                # connecting -> open -> closing -> closed
                if self.dc.readyState == "closing":
                    # it will take another ~30 seconds to completely close the peer connection
                    # the peer connection will be set to failed
                    self.state = ConnectionState.DISCONNECTING
                self.error = True

        #else:
        #    logging.error("unable to send, data channel not open")

async def route_rtc_offer(request):
    print("offer headers", request.headers)
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pc_id = str(uuid.uuid4())
    pc_sid = "PeerConnection(%s)" % pc_id

    current_peer = Peer(pc_id, pc)

    peers[pc_id] = current_peer

    def log_info(msg, *args):
        logger.info(pc_sid + " " + msg, *args)
    def log_error(msg, *args):
        logger.error(pc_sid + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("datachannel")
    def on_datachannel(channel):
        log_info("Data connection opened")
        current_peer.dc = channel

        # TODO: open not called
        # @channel.on("open")
        # def on_open(*args, **kwargs):
        #     print("dc open", args, kwargs)

        @channel.on("close")
        def on_close():
            log_info("Data connection closed")

            current_peer.state = ConnectionState.DISCONNECTING
            current_peer.dc = None

        @channel.on("message")
        def on_message(message):
            if isinstance(message, str):
                obj = json.loads(message)
                #obj['type'] = "pong"
                #channel.send(json.dumps(obj))
                messages.append((pc_id, obj))

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed" and pc.connectionState == "closed":
            await pc.close()
            current_peer.state = ConnectionState.DISCONNECTING
            current_peer.dc = None

    # handle offer
    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    content = json.dumps({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    })

    print("reply", content)

    return web.Response(
        content_type="application/json",
        text=content
    )

async def on_shutdown(app):
    # close peer connections
    coros = [peer.pc.close() for peer in peers.values()]
    await asyncio.gather(*coros)
    peers.clear()

class DevSite(object):

    def __init__(self, index_js, search_path, static_data, static_path, platform=None, **opts):
        super(DevSite, self).__init__()
        self.index_js = index_js
        self.search_path = search_path
        self.static_data = static_data
        self.static_path = static_path
        self.opts = opts

        Lexer.debug = True
        self.builder = Builder(search_path, static_data, platform=platform)
        self.builder.lexer_opts = {"preserve_documentation": True}

        self.build()

    def build(self):
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)
        self.srcmap_routes, self.srcmap = self.builder.sourcemap
        print(self.srcmap_routes)

        self.source = "//# sourceMappingURL=/static/index.js.map\n" + self.source
        print("source lines:", len(self.source.split("\n")), "bytes:", len(self.source),)

async def route_index(request):
    global site
    site.build()
    return web.Response(content_type="text/html", text=site.html)

async def route_source(request):
    global site
    # optional header SourceMap: static/index.js.map
    return web.Response(content_type="application/javascript", text=site.source)

async def route_source_map(request):
    global site
    # optional header SourceMap: static/index.js.map
    return web.Response(content_type="application/json", text=site.srcmap)

async def route_style(request):
    global site
    return web.Response(content_type="text/css", text=site.style)

async def route_static(request):
    global site
    request.match_info.get('path', 0)
    try:
        tmp = request.match_info.get('path', 0)
        path = path_join_safe(site.static_path, tmp)
        print('route_static', tmp, '=>', path)

        if not os.path.exists(path):
            return web.json_response({'error': tmp}, status=404)
        else:
            return web.FileResponse(path=path)
    except ValueError:
        return web.json_response({'error': 'invalid id'})

async def route_source_map_file(request):
    global site
    request.match_info.get('path', 0)
    try:
        tmp = 'srcmap/' + request.match_info.get('path', 0)
        #print('route_source_map_file', tmp, '=>', path)

        if tmp not in site.srcmap_routes:
            print("!!!!")
            print(tmp)
            print(list(site.srcmap_routes.keys()))
            return web.json_response({'error': tmp}, status=404)
        else:
            path = site.srcmap_routes[tmp]
            return web.FileResponse(path=path)
    except ValueError:
        return web.json_response({'error': 'invalid id'})

async def async_sleep(duration):

    if duration < 0.001:
        return

    start = time.perf_counter()
    slept_for = 0

    while duration - slept_for > 0.0005:
        await asyncio.sleep(min((duration - slept_for)*.5, 0.0005))
        slept_for =  time.perf_counter() - start

async def main_loop(ctxt):

    t0 = time.monotonic()
    spt = 1/60
    while True:

        disconnected = []
        for peer_id, peer in peers.items():

            if peer.state == ConnectionState.CONNECTING and peer.dc is not None:
                peer.state = ConnectionState.CONNECTED
                ctxt.onConnect(peer)

            if peer.state == ConnectionState.DISCONNECTING:
                disconnected.append(peer_id)

        for peer_id in disconnected:
            peer = peers[peer_id]
            peer.state = ConnectionState.DISCONNECTED
            del peers[peer_id]
            ctxt.onDisconnect(peer_id)

        for peer_id, message in messages:
            ctxt.onMessage(peer_id, message)

        ctxt.onUpdate(1/60) # TODO: delta t?

        messages.clear()

        t1 = time.monotonic()
        dt = t1 - t0
        t0 = t1

        spt += (0.02551203525869137) * (dt - spt)
        await async_sleep(max(0, ctxt.interval - dt -.000075))
        t0 = time.monotonic()

class WebContext():

    def __init__(self):
        super().__init__()

        self.interval = 1/60

    def onConnect(self, peer):
        pass

    def onDisconnect(self, peer_id):
        pass

    def onMessage(self, peer_id, message):
        pass

    def onUpdate(self, dt):
        pass

def add_dev_routes(app, index_js, search_path, static_data, static_path):

    global site
    site = DevSite(index_js, search_path, static_data, static_path)


    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", route_index)
    app.router.add_get("/static/index.js", route_source)
    app.router.add_get("/static/index.js.map", route_source_map)
    app.router.add_get("/static/srcmap/{path:.*}", route_source_map_file)
    app.router.add_get("/static/index.css", route_style)
    app.router.add_get("/static/{path:.*}", route_static)
    app.router.add_post("/rtc/offer", route_rtc_offer)
