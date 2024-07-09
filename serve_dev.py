import livereload

server = livereload.Server()
server.root = "src"
server.watch("src/*.html")
server.watch("src/*.js")
server.watch("src/*.css")
server.watch("src/maps/*.png")
server.serve()
