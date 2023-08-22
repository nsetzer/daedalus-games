
from axertc.module import JsModule

from daedalus.builder import Builder

class TestModule(object):
    def __init__(self, index_js, search_path, static_data, static_path, platform=None, **opts):
        super(TestModule, self).__init__()

        self.index_js = index_js
        self.search_path = search_path
        self.static_data = static_data
        self.static_path = static_path
        self.opts = opts

        self.builder = Builder(search_path, static_data, platform=platform)

    def build(self):
        self.style, self.source, self.html = self.builder.build(self.index_js, **self.opts)

        #if self.builder.error:
        #    raise self.builder.error
        #self.srcmap_routes, self.srcmap = self.builder.sourcemap
        #self.source = "//# sourceMappingURL=/static/index.js.map\n" + self.source
        print("source lines:", len(self.source.split("\n")), "bytes:", len(self.source),)

        self.mod = JsModule(self.source, [], sourcemap=self.builder.servermap)


def run():


    source_js = "./unittest.js"
    search_path = ["./src", "./src/axertc"]
    static_data = {"daedalus": {"env": {"backend": "webrtc"}}}
    static_path = "./src/axertc/static"

    mod = TestModule(source_js, search_path, static_data, static_path)

    mod.build()



def main():
    run()
if __name__ == '__main__':
    main()
