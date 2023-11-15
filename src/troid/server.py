 

from daedalus.server import Router, Resource, Server, Response, \
    JsonResponse, SampleResource, path_join_safe, \
    get, put, post, delete

import glob
import os
import sys
import json

class TroidService(object):
    def __init__(self, project_root):
        super(TroidService, self).__init__()
        self.project_root = project_root

    def world_manifest(self):
        root = os.path.join(self.project_root, "resource", "maps")
        if not os.path.exists(root):
            raise FileNotFoundError("project root not found")

        worlds = glob.glob(os.path.join(root, "*", ""))
        worlds = [os.path.split(path.rstrip(os.sep))[1] for path in worlds]
        return worlds

    def level_manifest(self, world):
        resource_root = os.path.join(self.project_root, "resource")
        world_root = os.path.join(resource_root, "maps", world)
        if not os.path.exists(world_root):
            raise FileNotFoundError("world root not found")

        paths = glob.glob(os.path.join(world_root, "*.json"))

        levels = []
        for path in paths:
            name = os.path.splitext(os.path.split(path)[1])[0]
            url = os.path.relpath(path, resource_root)
            try:
                levelid = int(name.replace("level_", "")[:2])
            except ValueError:
                continue

            if levelid > 0 and levelid < 100:
                level = {"id": levelid, "name": name, "url": url}
                levels.append(level)

        return levels

class TroidResource(Resource):

    def __init__(self, project_root):
        super(TroidResource, self).__init__()

        self.project_root = project_root

        self.service = TroidService(project_root)

    @get("/api/map/world/manifest")
    def get_map_world_manifest(self, request, location, matches):
        # return JsonResponse({"error": "world root not found"}, 404)
        worlds = self.service.world_manifest()
        return JsonResponse({"worlds": worlds})

    @get("/api/map/world/:world/level/manifest")
    def get_map_world_level_manifest(self, request, location, matches):
        # return JsonResponse({"error": "world root not found"}, 404)
        levels = self.service.level_manifest(matches['world'])
        return JsonResponse({"world": matches['world'], "levels": levels})

    @post("/api/map/level/:path")
    def get_map_world_level_manifest(self, request, location, matches):
        # save the level json to :path which is {world}/level_{id}.json
        resource_root = os.path.join(self.project_root, "resource", "maps")
        return JsonResponse({"error": "world root not found"}, 500)

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

    if sys.argv[1] == "build":
        print("build")
        project_root = "./src/troid"
        service = TroidService(project_root)
        worlds = service.world_manifest()

        path = "./src/troid/resource/maps/manifest.json"
        obj = {"worlds": worlds}
        with open(path, "w") as wf:
            json.dump(obj, wf)
            wf.write("\n")

        for world in worlds:
            levels = service.level_manifest(world)
            path = f"./src/troid/resource/maps/{world}/manifest.json"
            obj = {"world": world, "levels": levels}
            with open(path, "w") as wf:
                json.dump(obj, wf)
                wf.write("\n")

        exit(0)

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
