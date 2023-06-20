 
 from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
}

include "./primitives.js"
include "./resource.js"
include "./entity.js"
include "./input.js"
include "./widget.js"

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

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
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

const Keys = {
    PAUSE: 19,
    SCROLL_LOCK: 145,
}
/*
const ModifierKeys {
    Alt:1,
    AltGraph:1,
    CapsLock:1,
    Control:1,
    F1:1,
    F2:1,
    F3:1,
    F4:1,
    F5:1,
    F6:1,
    F7:1,
    F8:1,
    F9:1,
    F10:1,
    F11:1,
    F12:1,
    F13:1,
    F14:1,
    F15:1,
    F1Lock:1,
    F2Lock:1,
    F3Lock:1,
    F4Lock:1,
    F5Lock:1,
    F6Lock:1,
    F7Lock:1,
    F8Lock:1,
    F9Lock:1,
    F10Lock:1,
    F11Lock:1,
    F12Lock:1,
    F13Lock:1,
    F14Lock:1,
    F15Lock:1,
    Hyper:1,
    OS:1,
    Meta:1,
    NumLock:1,
    ScrollLock:1,
    Shift:1,
    Super:1,
    "Symbol":1,
    SymbolLock:1,
}
*/
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

        WidgetStyle.init(this.ctx)

        this.handleResize(this.props.width, this.props.height)

        if (this.onReady) {
            this.onReady()
        }
        window.requestAnimationFrame(this.render.bind(this));
    }

    _getMouseTouches(event, pressed) {
        event.preventDefault();
        const rect = this.getDomNode().getBoundingClientRect();
        const x = (event.clientX - rect.left) / this.view.scale  - this.view.x
        const y = (event.clientY - rect.top) / this.view.scale  - this.view.y
        const id = 1
        return [{x, y, id, pressed}]
    }

    onMouseDown(event) {
        if (event.buttons&1) {
            const touches = this._getMouseTouches(event, true)
            //this.touch_event = touches
            if (!this.paused) {
                this.scene.handleTouches(touches)
            }
        }
    }

    onMouseMove(event) {
        //event.preventDefault();
        if (event.buttons&1) {
            const touches = this._getMouseTouches(event, true)
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
                const touches = this._getMouseTouches(event, false)
                this.scene.handleTouches(touches)
            }
        //}

    }

    _getTouches(event) {
        event.preventDefault(); // prevent emulated mouse events

        const rect = this.getDomNode().getBoundingClientRect();

        const pressed = {}
        let touches = []
        for (const touch of event.targetTouches) {
            pressed[touch.identifier] = true
            touches.push(touch)
        }
        // determine touches that have been released
        for (const touch of event.changedTouches) {
            if (!pressed[touch.identifier]) {
                touches.push(touch)
                pressed[touch.identifier] = false
            }
        }

        // map touches to the view coordinate space
        return touches.map(touch => {

            if (this.view.rotate) {
                return {
                    "x": (touch.clientY - rect.top - this.view.x),
                    "y": this.view.height - (touch.clientX - rect.left - this.view.y),
                    "id": touch.identifier,
                    "pressed": !!pressed[touch.identifier],
                }
            } else {
                return {
                    "x": (touch.clientX - rect.left - this.view.x),
                    "y": (touch.clientY - rect.top - this.view.y),
                    "id": touch.identifier,
                    "pressed": !!pressed[touch.identifier],
                }
            }
        })
    }

    onTouchStart(event) {
        const touches = this._getTouches(event)
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }
    }

    onTouchMove(event) {
        const touches = this._getTouches(event)
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }
    }

    onTouchEnd(event) {
        const touches = this._getTouches(event)
        if (!this.paused) {
            console.log(touches)
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
        // https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#modifier_keys
        const kc = event.keyCode;

        if (kc == Keys.PAUSE) {
            this.paused = ! this.paused
            this.scene.pause(this.paused)
            this.ctx.fillStyle="yellow"
            this.ctx.font = '12px sans-serif';
            this.ctx.resetTransform()
            this.ctx.fillText("paused", 32, 32)
            let canvas = this.getDomNode()
            this.ctx.fillStyle = "#00000044"
            this.ctx.fillRect(0,0, canvas.width, canvas.height)

            event.preventDefault();
        } else if (kc == Keys.SCROLL_LOCK) {
            event.preventDefault();
        } else if (!this.paused && kc < 112) {

            let keyevent = {
                keyCode: kc,
                text: event.key.length==1?event.key:""
            }
            this.scene.handleKeyPress(keyevent);
        } else {
            console.log(kc)
        }
    }

    handleKeyRelease(event) {
        const kc = event.keyCode;
        if (kc < 112 && kc != Keys.PAUSE) {

            if (!this.paused) {

                let keyevent = {
                    keyCode: kc,
                    text: event.key.length==1?event.key:""
                }
                this.scene.handleKeyRelease(keyevent);
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
        let canvas = this.getDomNode()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
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
