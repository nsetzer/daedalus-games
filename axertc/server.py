
from .module import JsModule

from daedalus.builder import Builder

from .webrtc import main_loop, WebContext, add_dev_routes
from aiohttp import web
import asyncio

class DevServer(object):

    def __init__(self, index_js, search_path, static_data, static_path, platform=None, **opts):
        super(DevServer, self).__init__()
        self.index_js = index_js
        self.search_path = search_path
        self.static_data = static_data
        self.static_path = static_path
        self.opts = opts

        self.builder = Builder(search_path, static_data, platform=platform)

        self.build()

    def build(self):
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)
        #self.srcmap_routes, self.srcmap = self.builder.sourcemap
        #self.source = "//# sourceMappingURL=/static/index.js.map\n" + self.source
        print("source lines:", len(self.source.split("\n")), "bytes:", len(self.source),)
        print(self.source)
        #print(self.builder.globals)
        #print(self.builder.root_exports)
        self.source += "\nupdate=server_entry.update"
        self.source += "\nconnect=server_entry.connect"
        self.source += "\ndisconnect=server_entry.disconnect"
        self.source += "\nonMessage=server_entry.onMessage"
        exports = self.builder.root_exports
        self.mod = JsModule(self.source, exports)

    def __call__(self):
        return self._main()

class DevContext(WebContext):
    def __init__(self, server):
        super(DevContext, self).__init__()

        self.server = server

        self.outgoing_messages = []

        self.server.mod.ctxt.add_callable("xtransmit", self._transmit)

    def _transmit(self, playerId, message):
        self.outgoing_messages.append((playerId, message))

    def onConnect(self, peer):
        self.server.mod.invoke('connect', 1)

    def onDisconnect(self, peer_id):
        self.server.mod.invoke('disconnect', 1)

    def onMessage(self, peer_id, message):
        self.server.mod.invoke('onMessage', 1, server.mod.parse_json("{\"a\":1}"))

    def onUpdate(self, dt):
        self.server.mod.invoke('update', (1/60))



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

    server_js = "./src/axertc/server_entry.js"
    client_js = "./src/axertc/client_entry.js"
    search_path = ["./src", "./src/axertc"]
    static_data = {"daedalus": {"env": {"backend": "webrtc"}}}
    static_path = "./src/axertc/static"

    server = DevServer(server_js, search_path, static_data, static_path)
    context = DevContext(server)

    #site = DevSite(client_js, search_path, static_data, static_path)

    app = web.Application()
    loop = asyncio.new_event_loop()
    loop.create_task(main_loop(context))

    add_dev_routes(app, client_js, search_path, static_data, static_path)

    args = lambda: None
    args.host = "0.0.0.0"
    args.port = 4100
    ssl_context = None

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
