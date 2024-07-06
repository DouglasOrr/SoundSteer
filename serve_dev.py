import livereload

server = livereload.Server()
server.watch("*.html")
server.watch("*.js")
server.serve()
