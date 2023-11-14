 

from daedalus.server import Router, Resource, Server, Response, \
    JsonResponse, SampleResource, path_join_safe, \
    get, put, post, delete

import glob
import os

class TroidResource(Resource):

    def __init__(self, project_root):
        super(TroidResource, self).__init__()

        self.project_root = project_root

    @get("/api/map/world/manifest")
    def get_map_world_manifest(self, request, location, matches):

        root = os.path.join(self.project_root, "resource", "maps")
        if not os.path.exists(root):
            return JsonResponse({"error": "project root not found"}, 404)

        worlds = glob.glob(os.path.join(root, "*", ""))

        worlds = [os.path.split(path.rstrip(os.sep))[1] for path in worlds]

        return JsonResponse({"worlds": worlds})


    @get("/api/map/world/:world/level/manifest")
    def get_map_world_level_manifest(self, request, location, matches):

        root = os.path.join(self.project_root, "resource", "maps", matches['world'])
        if not os.path.exists(root):
            return JsonResponse({"error": "world root not found"}, 404)

        levels = glob.glob(os.path.join(root, "*.json"))
        levels = [os.path.splitext(os.path.split(path)[1])[0] for path in levels]
        return JsonResponse({"world": matches['world'], "levels": levels})

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

        res = TroidResource(os.path.split(self.static_path)[0])
        router.registerEndpoints(res.endpoints())
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
