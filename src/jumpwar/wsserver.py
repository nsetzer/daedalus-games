 
import os
import sys

sys.path.insert(0, "/home/nsetzer/git/mpgame/mpgameserver/")

from mpgameserver import Serializable, HTTPServer, Router, Resource, \
    get, post, \
    HTTPClient, path_join_safe, Response, JsonResponse, \
    websocket, WebSocketOpCodes

from daedalus.builder import Builder

import sys
import logging
import time
import json
from time import gmtime, strftime
from collections import defaultdict
import mimetypes
import re
import http.server
import socketserver
import json
import os
import sys
import io
import gzip
import ssl
from urllib.parse import urlparse, unquote

class WebSocketResource(Resource):
    def __init__(self):
        super().__init__()
        self.connections = {}

    @websocket("/ws")
    def socket(self, request, opcode, payload):

        if opcode == WebSocketOpCodes.Open:
            self.connections[request.uid] = request
        elif opcode == WebSocketOpCodes.Close:
            del self.connections[request.uid]
        else:
            obj = json.loads(payload)
            if obj['type'] != "keepalive":
                request.send(json.dumps(obj))
            else:
                request.send(json.dumps({"type": "keepalive"})) # ack


class DevSiteResource(Resource):

    def __init__(self, index_js, search_path, static_data, static_path, platform=None, **opts):
        super().__init__()

        self.builder = Builder(search_path, static_data, platform=platform)
        self.index_js = index_js
        self.opts = opts
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)
        self.static_path = static_path

    @get("/static/index.css")
    def get_style(self, request):
        #path = path_join_safe(self.static, "index.css")
        response = Response(self.style)
        response.headers['Content-Type'] = 'text/css'
        return response

    @get("/static/index.js")
    def get_source(self, request):
        #path = path_join_safe(self.static, "index.js")
        respons{} = Response(self.source)
        response.headers['Content-Type'] = 'application/javascript'
        return response

    @get("/static/:path*")
    def get_static(self, request):
        """
        serve files found inside the provided static directory

        # https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#browser_compatibility
        # https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified#browser_compatibility
        # https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag#browser_compatibility
        """
        path = path_join_safe(self.static_path, unquote(request.matches['path']))

        if not os.path.exists(path):
            print(path)
            return JsonResponse({"error": "not found"}, 404)

        response = Response(open(path, "rb"))
        type, _ = mimetypes.guess_type(path)
        response.headers['Content-Type'] = type

        gmt = gmtime(os.stat(path).st_mtime)
        response.headers['Last-Modified'] = strftime("%a, %d %b %Y %H:%M:%S %Z", gmt)
        response.headers['Cache-Control'] = " max-age=60, must-revalidate"

        return response

    @get("/favicon.ico")
    def get_favicon(self, request):
        """
        serve the favicon
        """
        path = self.builder.find("favicon.ico")

        if not os.path.exists(path):
            return JsonResponse({"error": "not found"}, 404)

        response = Response(open(path, "rb"))
        type, _ = mimetypes.guess_type(path)
        response.headers['Content-Type'] = type
        return response

    @get("/:path*")
    def get_path(self, request):
        """
        rebuild the javascript and html, return the html
        """
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)
        response = Response(self.html, 200)
        print("content", len(self.html))
        response.headers['Content-Type'] = "text/html"
        return response

def main_server():
    logging.basicConfig()
    logging.getLogger().setLevel(logging.DEBUG)

    index_js = "./src/jumpwar/app.js"
    # TODO: auto add the project directory to the  search path
    search_path = ["./src", "./src/jumpwar"]
    static_data = {"daedalus": {"env": {"debug": True}}}
    static_path = "./src/jumpwar/static"

    server = HTTPServer(("0.0.0.0", 4100))
    server.registerRoutes(WebSocketResource())
    server.registerRoutes(DevSiteResource(index_js, search_path, static_data, static_path))
    server.run()

if __name__ == '__main__':

    main_server()
