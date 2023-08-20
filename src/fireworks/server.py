
from axertc.server import DevServer
from axertc.webrtc import main_loop, add_dev_routes
from aiohttp import web
import asyncio

def main():

    args = lambda: None
    args.host = "0.0.0.0"
    args.port = 4100
    ssl_context = None

    server_js = "./src/fireworks/server_entry.js"
    client_js = "./src/fireworks/client_entry.js"
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


if __name__ == '__main__':
    main()