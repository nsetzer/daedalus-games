
from .module import JsModule

from daedalus.builder import Builder

from .webrtc import main_loop, WebContext, add_dev_routes
from aiohttp import web
import asyncio

class DevServer(WebContext):

    def __init__(self, index_js, search_path, static_data, static_path, platform=None, **opts):
        super(DevServer, self).__init__()
        self.index_js = index_js
        self.search_path = search_path
        self.static_data = static_data
        self.static_path = static_path
        self.opts = opts


        self.builder = Builder(search_path, static_data, platform=platform)

        self.build()

        self.peers = {}
        self.outgoing_messages = []

    def build(self):
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)
        #self.srcmap_routes, self.srcmap = self.builder.sourcemap
        #self.source = "//# sourceMappingURL=/static/index.js.map\n" + self.source
        print("server lines:", len(self.source.split("\n")), "bytes:", len(self.source),)

        #print(self.builder.globals)
        #print(self.builder.root_exports)
        self.source += "\nupdate=server_entry.server.update"
        self.source += "\nconnect=server_entry.server.connect"
        self.source += "\ndisconnect=server_entry.server.disconnect"
        self.source += "\nonMessage=server_entry.server.onMessage"

        #exports = self.builder.root_exports
        exports = ['connect', 'disconnect', 'onMessage', 'update']

        self.mod = JsModule(self.source, exports, sourcemap=self.builder.servermap)
        self.mod.ctxt.add_callable("_webrtc_xsend", self._transmit)
        self.mod.ctxt.eval("webrtc={};webrtc.xsend=_webrtc_xsend")


    def _transmit(self, playerId, message):
        self.outgoing_messages.append((playerId, message))

    def onConnect(self, peer):
        self.mod.invoke('connect', peer.uid)

        self.peers[peer.uid] = peer

    def onDisconnect(self, peer_uid):
        self.mod.invoke('disconnect', peer_uid)

        if peer_uid in self.peers:
            del self.peers[peer_uid]

    def onMessage(self, peer_id, message):
        self.mod.invoke('onMessage', peer_id, self.mod.parse_json(message))

    def onUpdate(self, dt):

        # webrtc main loop processes incoming messages first
        # then the update runs
        # then outgoing messages are sent

        self.mod.invoke('update', (1/60))

        while len(self.outgoing_messages) > 0:
            playerId, message = self.outgoing_messages.pop()

            if playerId in self.peers:
                self.peers[playerId].send(message.json())
            else:
                print("attempting to send message to peer that does not exist", playerId)

def test():

    index_js = "./src/axertc/server_entry.js"
    search_path = ["./src", "./src/axertc"]
    static_data = {"daedalus": {"env": {"backend": "webrtc"}}}
    static_path = "./src/axertc/static"

    server = DevServer(index_js, search_path, static_data, static_path, platform='server')

    #update = server.mod.ctxt.eval("const s = new server.ServerEngine()")
    #update = server.mod.ctxt.eval("return s.update")
    #print(update)
    #print(update(1/60))

    messages = []

    def transmit(playerId, message):
        nonlocal messages
        messages.append(message)

    server.mod.ctxt.add_callable("xtransmit", transmit)

    server.mod.invoke('connect', 1)
    server.mod.invoke('onMessage', 1, server.mod.parse_json("{\"a\":1}"))
    server.mod.invoke('update', (1/60))
    server.mod.invoke('disconnect', 1)

    print([m.json() for m in messages])

def run():

    args = lambda: None
    args.host = "0.0.0.0"
    args.port = 4100
    ssl_context = None

    server_js = "./src/axertc/server_entry.js"
    client_js = "./src/axertc/client_entry.js"
    search_path = ["./src", "./src/axertc"]
    static_data = {"daedalus": {"env": {"backend": "webrtc"}}}
    static_path = "./src/axertc/static"

    server = DevServer(server_js, search_path, static_data, static_path)

    #site = DevSite(client_js, search_path, static_data, static_path)

    app = web.Application()
    loop = asyncio.new_event_loop()
    loop.create_task(main_loop(server))

    add_dev_routes(app, client_js, search_path, static_data, static_path)

    web.run_app(
        app,
        access_log=None,
        host=args.host,
        port=args.port,
        ssl_context=ssl_context,
        loop=loop
    )


def main():

    # test()
    run()

if __name__ == '__main__':
    main()

