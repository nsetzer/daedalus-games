

.PHONY: breakout maze build widgets chat jumpwar

breakout:
	daedalus serve --paths=./src --env debug=true  src/breakout/breakout2.js

maze:
	daedalus serve --paths=./src --static src/maze/resource --env debug=true src/maze/app.js

widgets:
	daedalus serve --paths=./src  --env debug=true src/widgets/widgets.js

chat:
	python -m src.chat.server --paths=./src --env debug=true ./src/chat/chat.js

jumpwar:
	python -m src.jumpwar.server --paths=./src --static src/maze/static --env debug=true ./src/jumpwar/app.js

build:
	mkdir -p build
	daedalus build --minify --htmlname maze.html --onefile --paths=./src --static src/maze/resource src/maze/app.js ./build
	daedalus build --minify --htmlname breakout.html --onefile --paths=./src src/breakout/breakout2.js ./build
	daedalus build --minify --htmlname jumpwar.html --onefile --paths=./src --static src/jumpwar/static src/jumpwar/app.js ./build
	cp src/site/index.html build/index.html
