
import timeit

import quickjs
import json

from quickjs import Function
import time


def bench1():

    f = Function("f", """
        function f(a, b) {
            return a * b
        }
        """)

    for N in [1e2,1e3,1e4,1e5]:
        print(N, timeit.timeit(lambda: f(6,7), number=int(N))/N)

def bench2():

    context = quickjs.Context()

    context.eval("""
        function f(a, b) {
            return a * b
        }
    """)

_scalar_types = (type(None), str, bool, float, int, quickjs.Object)

class JsModule(object):
    def __init__(self, source, exports):
        super(JsModule, self).__init__()

        self.ctxt = quickjs.Context()

        self.ctxt.add_callable("_console_log", print)
        self.ctxt.eval("console={};console.log=_console_log")

        self.ctxt.add_callable("_performance_now", time.perf_counter)
        self.ctxt.eval("performance={};performance.now=_performance_now")

        self.ctxt.eval(source)

        self.exports = {}
        for name in exports:
            self.exports[name] = self.ctxt.get(name)

    def convert_arg(self, arg):
        if isinstance(arg, _scalar_types):
            return arg
        else:
            return self.ctxt.parse_json(json.dumps(arg))

    def parse_json(self, string):
        return self.ctxt.parse_json(string)

    def invoke(self, name, *args):

        fn = self.exports[name]
        args = [self.convert_arg(arg) for arg in args]

        try:
            result = fn(*args)

            if isinstance(result, quickjs.Object):
                result = json.loads(result.json())
        finally:

            self.ctxt.gc()


        return result

