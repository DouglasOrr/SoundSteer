import livereload

server = livereload.Server()
server.watch("*.html")
server.watch("*.js")
server.watch("*.css")
server.watch("maps/*.png")
server.serve()
