

.PHONY: maze build_maze


maze:
	python3 -m daedalus serve --paths=./src --static src/maze/resource src/maze/app.js

build_maze:
	python3 -m daedalus build --onefile --paths=./src --static src/maze/resource src/maze/app.js ./docs

