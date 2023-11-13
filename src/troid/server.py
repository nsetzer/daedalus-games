 

from daedalus.server import Router, Resource, Server, Response, \
    JsonResponse, SampleResource, path_join_safe, \
    get, put, post, delete


class TroidResource(Resource):

    @get("/api")
    def get_style(self, request, location, matches):
        pass

    @post("/api")
    def post_style(self, request, location, matches):
        pass

class TroidServer(Server):

    def __init__(self, host, port, index_js, search_path, static_data=None, static_path="./static", platform=None, **opts):
        super(TroidServer, self).__init__(host, port)
        self.index_js = index_js
        self.search_path = search_path
        self.static_data = static_data
        self.static_path = static_path
        self.platform = platform
        self.opts = opts

    def buildRouter(self):
        router = Router()
        res = SampleResource(self.index_js, self.search_path, self.static_data, self.static_path, platform=self.platform, **self.opts)
        router.registerEndpoints(res.endpoints())
        return router


def main():
    # --env debug=true src/troid/troid.js

    index_js = "./src/troid/troid.js"
    search_path = ["./src/troid", "./src/axertc"]
    static_data = {"daedalus": {"env": {"debug": True}}}
    static_path = "./src/troid/resource"

    server = TroidServer("0.0.0.0", 4100, index_js, search_path, static_data=static_data, static_path=static_path)
    server.run()

if __name__ == '__main__':
    main()

if __name__ == '__main__':  # pragma: no cover
    main()
