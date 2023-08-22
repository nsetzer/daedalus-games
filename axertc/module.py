
"""

the original quickjs repo has an example of using bjson
"""
import timeit

import quickjs
import json

from quickjs import Function
import time

_scalar_types = (type(None), str, bool, float, int, quickjs.Object)

def _js_console_log(*args):

    args = [arg.json() if isinstance(arg, quickjs.Object) else arg for arg in args]
    print(*args)

_reference_time = time.perf_counter()
def _js_performance_now(*args):
    delta = time.perf_counter() - _reference_time
    return int(delta*1000)

def wrapcall(cbk):
    # javascript swallows exceptions raised by python code in quickjs
    # wrap the call and log the exception. then re-raise
    def chkcall(*args, **kwargs):
        try:
            return cbk(*args, **kwargs)
        except BaseException as e:
            print(e)
            raise e

class JsModule(object):
    def __init__(self, source, exports=None, sourcemap=None):
        super(JsModule, self).__init__()

        # exports can be a list of names defined in the global namespace

        # the source map is made up of two lists
        # index2path: a list containing the original file paths
        # lineNumber2index: a list contaning a 2-tuple (fileIndex, originalLineNumber)
        #                   for every line in the provided source
        # these two lists can be used to map a line number in the provided source
        # back to the line in the originating source file.
        # TODO: fork quickjs, and change the c module to pass in a file name
        # for the eval function, other than <input>. this will avoid the need for a preamble
        self.sourcemap = sourcemap # 2 tuple (index2path, lineNumber2index)

        self._init_context()
        self._init_source(source, exports)

    def _init_context(self):
        self.ctxt = quickjs.Context()

        self.ctxt.add_callable("_console_log", _js_console_log)
        self.ctxt.eval("console={};console.log=_console_log;console.warn=_console_log;console.error=_console_log")

        self.ctxt.add_callable("_performance_now", _js_performance_now)
        self.ctxt.eval("performance={};performance.now=_performance_now")

    def _init_source(self, source, exports):
        # preamble is a workwround for the hardcoded "<input>" for the source name
        # if the line number for an error is > 256 then the line corresponds to this
        # source code
        preamble = "\n" * 256
        source = preamble + source

        self.source = source.splitlines()

        error = None
        try:
            self.ctxt.eval(source)
        except quickjs.JSException as e:
            error = self._js_exception(e)
        finally:
            self.ctxt.gc()

        if error:
            raise error


        self.exports = {}
        if exports:
            for name in exports:
                self.exports[name] = self.ctxt.get(name)

    def add_callable(self, name, cbk):
        return self.ctxt.add_callable(name, wrapcall(cbk))

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

        error = None
        try:
            result = fn(*args)

            if isinstance(result, quickjs.Object):
                result = json.loads(result.json())

        except quickjs.JSException as e:
            error = self._js_exception(e)

        finally:

            self.ctxt.gc()

        if error:
            raise error


        return result

    def _js_exception(self, e):
        lines = str(e).splitlines()

        message = lines.pop(0)

        errorinfo = ["Error executing javascript:"]

        for line in lines[::-1]:
            line = line.strip()
            line = line[2:].strip()
            if ' ' in line:
                reference, location = line.rsplit(' ', 1)
                location = int(location[1:-1].split(":")[1])
            else:
                reference = "???"
                location = int(line.split(":")[1])


            current_line = self.source[location-1].lstrip()
            if location >= 256 and self.sourcemap:
                lineNumber = location - 256 - 1
                index2path, line2index = self.sourcemap

                index = None
                originalLineNumber = 0
                if lineNumber < len(line2index):
                    if line2index[lineNumber]:
                        index, originalLineNumber = line2index[lineNumber]
                    else:
                        print("\nwarning: info not set for line %s" % (lineNumber, ))
                        print("  ", line2index[lineNumber-2:lineNumber+3])
                else:
                    print("\nwarning: %s not in line2index %d" % (lineNumber, len(line2index)))

                path = None
                if index is not None and index < len(index2path):
                    path = index2path[index]
                else:
                    print("\nwarning: %s not in index2path %d" % (index, len(index2path)))

                if path:
                    errorinfo.append("JS File \"%s\", line %d, in %s" % (path, originalLineNumber - 1, reference))
                    errorinfo.append("  " + current_line)
                else:
                    errorinfo.append("  " + line + " " + current_line)
            else:
                errorinfo.append("  " + line + " " + current_line)

        errorinfo.append(message)

        error = Exception("\n".join(errorinfo))

        return error

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

def error1():
    source = """
        function h() {
            return g()
        }
        function x() {
            return h()
        }
    """
    exports = ["x"]
    index2path = ["/dev/null"]
    line2index = [(0, idx) for idx in range(len(source.splitlines()))]

    module = JsModule(source, exports, sourcemap=(index2path, line2index))

    module.invoke("x")

def error2():


    def _error(arg0):
        raise ValueError("oops")

    context = quickjs.Context()
    context.add_callable("error", _error)
    context.eval(""" error(0) """)

def main():
    error2()

if __name__ == '__main__':
    main()