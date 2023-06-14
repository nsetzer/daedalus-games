

.PHONY: breakout maze build

breakout:
	python3 -m daedalus serve --paths=./src src/breakout/breakout2.js

maze:
	python3 -m daedalus serve --paths=./src --static src/maze/resource src/maze/app.js

build:
	python3 -m daedalus build --htmlname maze.html --onefile --paths=./src --static src/maze/resource src/maze/app.js ./docs
	python3 -m daedalus build --htmlname breakout.html --onefile --paths=./src src/breakout/breakout2.js ./docs

