import web
from os import path
import simplejson
import sys

rootdir = path.abspath('./build')
def getFile(filename):
    filename = path.join(rootdir, filename)
    print filename
    if (not filename.startswith(rootdir)):
        return None
    if (not path.exists(filename)):
        return None
    f = open(filename, 'r')
    contents = f.read()
    f.close()
    return contents

class index:
    def handle(self, filename, i):
        if (filename == ""):
            filename = "recon.html"
            web.header('Content-type','text/html')
        contents = getFile(filename)
        if ("data" in i):
            data = i.data.replace("'", "\\'")
            return contents.replace("<!--    POSTed data goes here      -->",
                                    "<script language='javascript'>handlePOSTdata(%s)</script>" % simplejson.dumps(data))
        return contents
        
    def POST(self, filename):
        return self.handle(filename, web.input())
    def GET(self, filename):
        return self.handle(filename, web.input())
        

web.config.debug = False
urls = ('/(.*)', 'index')
app = web.application(urls, globals())
if __name__ == "__main__":
    port = 9777
    
    if (len(sys.argv) == 2):
        port = int(sys.argv[1])
    web.httpserver.runsimple(app.wsgifunc(), ("localhost",port))
