import livereload

server = livereload.Server()
server.root = "src"
server.watch("*.html")
server.watch("*.js")
server.watch("*.css")
server.watch("maps/*.png")
server.serve()
