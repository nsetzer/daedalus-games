

.PHONY: breakout maze build widgets chat netdebug nettest echotest jumpwar fireworks axedemo maze2 clean

breakout:
	daedalus serve --paths=./src --env debug=true  src/breakout/breakout2.js

maze:
	daedalus serve --paths=./src --static src/maze/resource --env debug=true src/maze/app.js

widgets:
	daedalus serve --paths=./src  --env debug=true src/widgets/widgets.js

chat:
	python -m src.chat.server --paths=./src --env debug=true ./src/chat/chat.js

netdebug:
	python -m src.jumpwar.echoserver --backend=mock

echotest:
	python -m src.jumpwar.echoserver --backend=echo

nettest:
	python -m src.jumpwar.rtcserver --backend=webrtc

jumpwar:
	python -m src.jumpwar.rtcserver

fireworks:
	PYTHONPATH=. python src/fireworks/server.py

axedemo:
	daedalus serve --paths="./src:./src/axertc"  --env debug=true src/axedemo/client_entry.js

maze2:
	PYTHONPATH=. python src/maze2/server.py

.PHONY: troid
troid:
	# daedalus serve --paths="./src:./src/axertc"  --static src/troid/resource --env debug=true src/troid/troid.js
	PYTHONPATH=./daedalus python src/troid/server.py

build:
	mkdir -p build
	daedalus build --minify --onefile --sourcemap --htmlname maze.html     --paths=./src --static src/maze/resource src/maze/app.js ./build/games
	PYTHONPATH=. python src/troid/server.py build
	daedalus build  --onefile --sourcemap --htmlname troid.html     --paths="./src:./src/axertc" --static src/troid/resource src/troid/troid.js ./build/games
	#daedalus build --minify --htmlname breakout.html --onefile --paths=./src src/breakout/breakout2.js ./build
	#daedalus build --minify --htmlname jumpwar.html --onefile --paths=./src --env backend=mock --static src/jumpwar/static src/jumpwar/app.js ./build
	daedalus build --minify --onefile --sourcemap --htmlname axedemo.html  --paths="./src:./src/axertc"  src/axedemo/client_entry.js ./build/games
	cp src/site/index.html build/index.html

clean:
	# there should be a daedalus build flag to ignore the cache
	find src -path '*/__pycache__/*.ast' | xargs rm -v
	find daedalus/res/ -path '*/__pycache__/*.ast' | xargs rm -v

