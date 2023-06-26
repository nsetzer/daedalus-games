
# Daedalus Games

Mobile first games built using Daedalus-JS

[Live Demo](https://nsetzer.github.io/daedalus-games/index.html)


# Install

```bash
	# create and activate a virtual environment
	python -m venv venv
	source venv/bin/activate

	# install dependencies
	pip install -r requirements.txt
```

# Development

The Makefile contains phony targets for starting a web server
and running a particular game on http://localhost:4100.

for example, to run the maze game

```bash
	make maze
```

Then open the game in the browser.
Every time the page is refreshed, the javascript source code will be recompiled

If a change is made to the python server, use CTRL+C to kill the server and restart it.


# build

run the build step to build the various games in release mode.
Github Actions performs this step to make the games available on Githb Pages

```
	make build
```
