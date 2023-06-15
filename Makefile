

.PHONY: breakout maze build

breakout:
	daedalus serve --paths=./src src/breakout/breakout2.js

maze:
	daedalus serve --paths=./src --static src/maze/resource src/maze/app.js

build:
	daedalus build --minify --htmlname maze.html --onefile --paths=./src --static src/maze/resource src/maze/app.js ./docs
	daedalus build --minify --htmlname breakout.html --onefile --paths=./src src/breakout/breakout2.js ./docs

