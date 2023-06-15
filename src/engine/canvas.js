 
 from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
}

include "./primitives.js"
include "./resource.js"
include "./entity.js"
include "./input.js"

export class GameScene {

    pause(paused) {

    }

    update(dt) {
    }

    paint(ctx) {
    }

    resize() {
    }

    handleTouches(touches) {

    }

    handleKeyPress(keyCode) {
    }

    handleKeyRelease(keyCode) {
    }
}

const style = {
    "canvas": StyleSheet({
        "border": "0px",
        "margin": 0,
        "padding":0,
        "cursor": "pointer"
    })
}

export class CanvasEngine extends DomElement {
    constructor(width, height, settings=null) {
        super("canvas", {
                "width": width,
                "height": height,
                className:style.canvas
            })

        this.scene = null

        this.ctx = null
        this.lastTime = null
        this.settings = settings??{}

        this.settings.portrait = this.settings.portrait??1

        this.delta_accum = 0

        this.onReady = null

        // x,y: top left coordinate for the game
        // width, height: size of the viewport
        // rotate: 0: no rotation, 1: 90 degree rotation for mobile
        // scale: scale factor for drawing

        this.view = {
            x:0,
            y:0,
            width:640,
            height:320,
            rotate: 0,
            scale: 1,
            availWidth: 0,
            availHeight: 0
        }

        this.touch_event = null

        this.paused = false

    }

    elementMounted() {

        this.ctx = this.getDomNode().getContext("2d");
        console.log(`2d context created}`)

        this.handleResize(this.props.width, this.props.height)

        if (this.onReady) {
            this.onReady()
        }
        window.requestAnimationFrame(this.render.bind(this));
    }

    _getMouseTouches(event) {
        event.preventDefault();
        const rect = this.getDomNode().getBoundingClientRect();
        const x = (event.clientX - rect.left) / this.view.scale  - this.view.x
        const y = (event.clientY - rect.top) / this.view.scale  - this.view.y
        return [{x, y}]
    }

    onMouseDown(event) {
        if (event.buttons&1) {
            const touches = this._getMouseTouches(event)
            //this.touch_event = touches
            if (!this.paused) {
                this.scene.handleTouches(touches)
            }
        }
    }

    onMouseMove(event) {
        //event.preventDefault();
        if (event.buttons&1) {
            const touches = this._getMouseTouches(event)
            //this.touch_event = touches

            if (!this.paused) {
                this.scene.handleTouches(touches)
            }
        }
    }

    onMouseUp(event) {
        //if (event.buttons&1) {
            //event.preventDefault();
            //this.touch_event = []
            if (!this.paused) {
                this.scene.handleTouches([])
            }
        //}

    }

    _getTouches(event) {
        event.preventDefault(); // prevent emulated mouse events

        const rect = this.getDomNode().getBoundingClientRect();
        // TODO: multi touch support
        // map all touches to new coordinates and pass to touch handler
        // touch handler takes first one that looks like a movement input
        // and first one that looks like a button input, etc

        return Array.from(event.targetTouches).map(touch => {

            if (this.view.rotate) {
                return {
                    "x": (touch.clientY - rect.top - this.view.x),
                    "y": this.view.height - (touch.clientX - rect.left - this.view.y),
                }
            } else {
                return {
                    "x": (touch.clientX - rect.left - this.view.x),
                    "y": (touch.clientY - rect.top - this.view.y),
                }
            }
        })
    }

    onTouchStart(event) {
        const touches = this._getTouches(event)
        console.log("start", touches.length, [...touches])
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }
    }

    onTouchMove(event) {
        const touches = this._getTouches(event)
        console.log("move", touches.length, [...touches])
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }
    }

    onTouchEnd(event) {
        const touches = this._getTouches(event)
        console.log("end", touches.length, [...touches])
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }
    }

    handleResize(width, height) {

        // instead of setting /getting window screen width and height
        // use the width/height of the node and adjust parameters accordingly
        //if (daedalus.platform.isMobile) {

        this.view.x = 32
        this.view.y = 8


        // TODO: try to fit 640x360 in the available space
        //       then try to fit something smaller down to a minimum size
        //       then try to scale up

        if (daedalus.platform.isMobile) {
            this.view.width = Math.floor((height - 32)/32)*32
            this.view.height = Math.floor((width)/32)*32
        } else {
            this.view.width = Math.floor(1920/3)
            this.view.height = Math.floor(1080/3)
        }

        if (!!this.settings.portrait) {
            let t = this.view.width
            this.view.width = this.view.height
            this.view.height = t
        }

        this.view.availWidth = width
        this.view.availHeight = height

        if (width/height < 0.75 && !this.settings.portrait) {
            this.view.rotate = 1
        } else {
            this.view.rotate = 0
        }

        this.view.scale = 1
        if (this.view.rotate) {
            if (height > 2*this.view.width && width > 2*this.view.height) {
                this.view.scale = 2
            }
        } else {
            if (width > 2*this.view.width && height > 2*this.view.height) {
                this.view.scale = 2
            }
        }

        if (!daedalus.platform.isMobile && !this.view.rotate) {
            // center x
            this.view.x = Math.floor((width - (this.view.width*this.view.scale))/(2*this.view.scale))
            this.view.y = Math.min(32, Math.floor((height - (this.view.height*this.view.scale))/(2*this.view.scale)))
        } else if (daedalus.platform.isMobile) {
            if (this.view.rotate) {
                this.view.x = Math.floor((height - (this.view.width*this.view.scale))/(2*this.view.scale))
                this.view.y = Math.floor((width - (this.view.height*this.view.scale))/(2*this.view.scale))
            } else {
                this.view.x = Math.floor((width - (this.view.width*this.view.scale))/(2*this.view.scale))
                this.view.y = Math.floor((height - (this.view.height*this.view.scale))/(2*this.view.scale))
            }
        } else {
            this.view.x = 0
            this.view.y = 0
        }

        // console.log('view', width / height, width, height, this.view)

        if (this.scene) {
            this.scene.resize()
        }
    }

    handleKeyPress(event) {
        const kc = event.keyCode;
        if (kc < 112) {

            if (kc == 19) {
                this.paused = ! this.paused
                this.scene.pause(this.paused)
            } else if (!this.paused) {

                this.scene.handleKeyPress(kc);
                //event.preventDefault();
            }
        }
    }

    handleKeyRelease(event) {
        const kc = event.keyCode;
        if (kc < 112 && kc != 19) {

            if (!this.paused) {

                this.scene.handleKeyRelease(kc);
                //event.preventDefault();

            }

        }
    }

    renderFrame() {

        const ctx = this.ctx;

        if (ctx === null) {
            console.log(ctx)
            return;
        }

        ctx.resetTransform()
        ctx.clearRect(0, 0, this.props.width, this.props.height)
        ctx.scale(this.view.scale, this.view.scale);
        if (this.view.rotate) {
            ctx.rotate((90 * Math.PI) / 180)
            ctx.translate(0,-this.props.width/this.view.scale)
        }
        ctx.translate(this.view.x, this.view.y)
        //ctx.rect(0, 0, this.view.width, this.view.height());
        //ctx.clip();
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;

        this.scene.paint(ctx)

    }

    render() {
        let now = performance.now()

        let dt = 1/60;

        if (this.lastTime != null) {

            //if (this.touch_event) {
            //    this.scene.handleTouches(this.touch_event)
            //}
            if (!this.paused) {
                this.delta_accum += (now - this.lastTime) / 1000.0;

                let n = 0;

                while (this.delta_accum > dt) {
                    this.delta_accum -= dt
                    this.scene.update(dt)
                    n += 1;
                }
                if (n > 0) {
                    this.renderFrame();
                }
            }


            this.fps = Math.floor(1.0/dt)
        }
        this.lastTime = now;

        window.requestAnimationFrame(this.render.bind(this));
    }
}
