 
$import("daedalus", {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
})

$import("axertc_common", {Rect, Direction, Alignment})
$include("./input.js")
$include("./widget.js")

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
    TAB: 9,
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

function tickTimer(initial=1/60) {
    // returns a function which estimates the seconds-per-tick
    // the estimate is updated each time the function is called
    // returning the new estimate
    // uses a moving average filter tuned for 60fps
    let t0 = null
    let spt = initial
    return () => {
        const t1 = performance.now()
        if (t0 !== null) {
            spt += (0.02551203525869137) * ((t1 - t0)/1000.0 - spt)
        }
        t0 = t1
        return spt
    }

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

        this.fps = 60
        this.spt_a = 1/60
        this.spt_b = 1/60
        this.spt_c = 1/60

        this.frameTimer = tickTimer()
        this.updateTimer = tickTimer()
        this.renderTimer = tickTimer()
        this.fps_timer = 6

        this.lastRender = null

        this.settings = settings??{}

        // portrait: (true) preferred orientation is 0 degrees
        //           (false) preferred orientation is 90 degrees
        //           when set false on mobile the view will be
        //           optimized for rotated phones
        this.settings.portrait = this.settings.portrait??1
        // fullscreen: when set to true the app will switch to
        //             full screen when the user taps the screen
        this.settings.fullscreen = this.settings.fullscreen??0
        this.settings.screen_width = this.settings.screen_width??0
        this.settings.screen_height = this.settings.screen_height??0

        this.delta_accum = 0

        this.onReady = null

        this.keyboard_focus_widget = null

        // x,y: top left coordinate for the game
        // width, height: size of the viewport
        // rotate: 0: no rotation, 1: 90 degree rotation for mobile
        // scale: scale factor for drawing

        this.view = {
            x:0,
            y:0,
            width: 0,
            height: 0,
            rotate: 0,
            scale: 1,
            availWidth: 0,
            availHeight: 0
        }

        this.touch_event = null

        this.paused = false

        this.spt = 1/60

        this.frameIndex = 0
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

    _getMouseTouches(event, pressed, first) {
        event.preventDefault();
        const rect = this.getDomNode().getBoundingClientRect();
        const x = (event.clientX - rect.left) / this.view.scale  - this.view.x
        const y = (event.clientY - rect.top) / this.view.scale  - this.view.y
        const id = 1
        return [{x, y, id, pressed, buttons:event.buttons, first}]
    }

    onContextMenu(event) {
        event.preventDefault()
    }

    onMouseDown(event) {
        if (event.buttons&3) {
            this._x_mouse_buttons = event.buttons
            const touches = this._getMouseTouches(event, true, true)
            //this.touch_event = touches
            if (!this.paused) {
                this.scene.handleTouches(touches)
            }
        }
    }

    onMouseMove(event) {
        //event.preventDefault();
        if (event.buttons&3) {
            this._x_mouse_buttons = event.buttons
            const touches = this._getMouseTouches(event, true, false)
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
                const touches = this._getMouseTouches(event, false, false)
                // mouse up does no have the button flag set for
                // the one that was actually released. save the state
                // for the ones that were pressed so that a mouse up
                // for the button can be generated
                touches[0].buttons = this._x_mouse_buttons??0
                this.scene.handleTouches(touches)
            }
        //}

    }

    _getTouches(event, first) {
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
                    "x": (touch.clientY - rect.top)/this.view.scale  - this.view.x,
                    "y": this.view.height - (touch.clientX - rect.left)/this.view.scale - this.view.y,
                    "id": touch.identifier,
                    "pressed": !!pressed[touch.identifier],
                    "buttons": 1,
                    first,
                }
            } else {
                return {
                    "x": (touch.clientX - rect.left)/this.view.scale - this.view.x,
                    "y": (touch.clientY - rect.top)/this.view.scale - this.view.y,
                    "id": touch.identifier,
                    "pressed": !!pressed[touch.identifier],
                    "buttons": 1,
                    first,
                }
            }
        })
    }

    onTouchStart(event) {
        const touches = this._getTouches(event, true)
        if (!this.paused) {
            if (daedalus.platform.isMobile) {
                if (window.hiddenInput.hasKeyboardFocus()) {
                    window.hiddenInput.clearKeyboardFocus()
                }
            }
            this.scene.handleTouches(touches)
        }
    }

    onTouchMove(event) {
        const touches = this._getTouches(event, false)
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }
    }

    onTouchEnd(event) {
        const touches = this._getTouches(event, false)
        if (!this.paused) {
            this.scene.handleTouches(touches)
        }

        if (!!this.settings.fullscreen && !this.view.fullscreen) {
            this.setFullScreen(true)
        }
    }

    handleResize(availWidth, availHeight) {

        // TODO: if a specific resolution is given, use a float scale factor to make it fit
        // TODO: touch inputs that are not scaled?


        // width x height [height/32] (width/height) description
        //  640 x  480 [15] (1.333) full screen
        //  384 x  224 [ 7] (1.714) wide screen nes
        //  768 x  448 [14] (1.714) 2x wide screen nes
        // 1920 x 1080 [33] (1.778) HD
        //  480 x  270 [ 8] (1.778) HD / 4
        //  640 x  360 [11] (1.778) HD / 3
        //  703 x  396 [12] (1.775) mobile
        //  808 x  396 [12] (2.040) fullscreen mobile

        const islandscape = screen.orientation.type.includes("landscape")

        // on mobile swap width and height for landscape mode
        if (!islandscape && availWidth/availHeight < 0.75 && !this.settings.portrait) {
            [availWidth, availHeight] = [availHeight, availWidth]
            this.view.rotate = 1
        } else {
            this.view.rotate = 0
        }
        this.view.availWidth = availWidth
        this.view.availHeight = availHeight

        // detect if the new resolution is full scren
        if (daedalus.platform.isMobile) {
            this.view.fullscreen = !!document.fullscreenElement
        } else {
            this.view.fullscreen = window.innerHeight == screen.height
        }

        if (this.settings.screen_height != 0) {
            this.view.width = this.settings.screen_width
            this.view.height = this.settings.screen_height

            let s = Math.min(
                availWidth/this.view.width,
                availHeight/this.view.height,
            )
            s = (Math.floor((s*100)/25)*25)/100

            this.view.scale = Math.max(1, s)
        } else {
            if (daedalus.platform.isMobile) {

                if (this.view.fullscreen) {
                    this.view.width = availWidth
                    this.view.height = availHeight

                } else {
                    this.view.width = Math.floor((availWidth - 32)/32)*32
                    this.view.height = Math.floor((availHeight)/16)*16
                }

                //this.view.width = Math.min(Math.floor(1920/3), this.view.width)
                //this.view.height = Math.min(Math.floor(1080/3), this.view.height)

            } else {
                const minw = Math.floor((availWidth)/32)*32
                const minh = Math.floor((availHeight)/16)*16


                let _scrw = Math.floor(1920/3)
                let _scrh = Math.floor(1080/3)

                if (this.settings.portrait) {
                    this.view.width = Math.min(_scrh, minw)
                    this.view.height = Math.min(_scrw, minh)

                } else {
                    this.view.width = Math.min(_scrw, minw)
                    this.view.height = Math.min(_scrh, minh)
                }
            }

            //this.view.width = Math.floor(this.view.width/2)
            //this.view.height = Math.floor(this.view.height/2)
            //this.view.width = Math.floor(availWidth/2/16)*16
            //this.view.height = Math.floor(availHeight/2/16)*16
            //this.view.scale = 2; // Math.floor(Math.max(1, Math.min(availWidth/this.view.width, availHeight/this.view.height)))
            this.view.scale = 1
            if (availWidth > 2*this.view.width && availHeight > 2*this.view.height) {
                this.view.scale = 2
            }

        }



        if (!daedalus.platform.isMobile && !this.view.rotate) {
            // center x
            this.view.x = Math.floor((availWidth - (this.view.width*this.view.scale))/(2*this.view.scale))
            this.view.y = Math.min(32, Math.floor((availHeight - (this.view.height*this.view.scale))/(2*this.view.scale)))
        } else if (daedalus.platform.isMobile) {
            this.view.x = Math.floor((availWidth - (this.view.width*this.view.scale))/(2*this.view.scale))
            this.view.y = Math.floor((availHeight - (this.view.height*this.view.scale))/(2*this.view.scale))
        } else {
            this.view.x = 0
            this.view.y = 0
        }

        console.log('view changed:',
            `screen: orientation=${screen.orientation.type} size=(${availWidth}, ${availHeight})`,
            `view: (${this.view.x}, ${this.view.x}) (${this.view.width}, ${this.view.height})`,
            `rotate=${this.view.rotate}`,
            `fullscreen=${this.view.fullscreen}`,
            )

        if (this.scene) {
            this.scene.resize()
        }
    }

    handleKeyPress(event) {
        // https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#modifier_keys
        const kc = event.keyCode;
        //console.log(kc, event.key)

        if (kc == Keys.PAUSE) {
            this.paused = ! this.paused
            this.scene.pause(this.paused)
            this.ctx.resetTransform()
            this.ctx.fillStyle="yellow"
            this.ctx.font = '12px sans-serif';
            this.ctx.fillText("paused", 32, 32)
            let canvas = this.getDomNode()
            this.ctx.fillStyle = "#00000044"
            this.ctx.fillRect(0,0, canvas.width, canvas.height)
            this.lastTime = null


            if (!this.paused) {
                // resume the game
                window.requestAnimationFrame(this.render.bind(this));
            }

            event.preventDefault();
        } else if (kc == Keys.SCROLL_LOCK) {
            // todo single step frame
            event.preventDefault();
        } else if (!this.paused && kc < 112) {
            if (kc == Keys.TAB) {
                event.preventDefault();
            }
            let keyevent = {
                keyCode: kc,
                text: event.key.length==1?event.key:""
            }
            if (!!this.keyboard_focus_widget) {
                this.keyboard_focus_widget.handleKeyPress(keyevent)
            } else {
                this.scene.handleKeyPress(keyevent);
            }

        } else {
            console.log("unexpected key", event)
        }
    }

    handleKeyRelease(event) {
        const kc = event.keyCode;
        //console.log(kc, event.key)
        if (kc < 112 && kc != Keys.PAUSE) {

            if (!this.paused) {

                let keyevent = {
                    keyCode: kc,
                    text: event.key.length==1?event.key:""
                }
                if (!!this.keyboard_focus_widget) {
                    this.keyboard_focus_widget.handleKeyRelease(keyevent)
                } else {
                    this.scene.handleKeyRelease(keyevent);
                }
                //event.preventDefault();

            }

        }
    }

    setFullScreen(enable) {
        // screen lock does not work, request user to rotate phone
        // screen.orientation.lock('landscape');
        const body = document.getElementsByTagName("BODY")[0];
        if (enable) {
            try {
                body.requestFullscreen()
            } catch (e) {
                console.warn("error requesting full scren", e)
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

    requestKeyboardFocus(settings, widget) {

        if (daedalus.platform.isMobile) {
            window.hiddenInput.requestKeyboardFocus(settings, widget)
        } else {
            this.keyboard_focus_widget = widget
        }

    }

    /*

    */

    render() {
        let now = performance.now()

        let dt = 1/60;

        if (this.lastTime != null) {

            const elapsed = (now - this.lastTime) / 1000.0
            this.spt_a = this.renderTimer()

            //if (this.touch_event) {
            //    this.scene.handleTouches(this.touch_event)
            //}
            if (!this.paused) {
                this.delta_accum += elapsed;

                const p1 = performance.now()
                let n = 0;
                while (this.delta_accum > dt && n < 2) {
                    this.delta_accum -= dt
                    this.spt_b = this.updateTimer()
                    this.frameIndex += 1
                    this.scene.update(dt)
                    n += 1;
                }

                if (this.delta_accum > dt) {
                    console.warn(`${n}. dropped  ${this.delta_accum/dt} frames`)
                    this.delta_accum = 0
                }

                const p2 = performance.now()
                if (n > 0) {
                    this.spt_c = this.frameTimer()
                    this.renderFrame();

                }
                const p3 = performance.now()
                //this.timings = [p2-p1,p3-p2]
            }

            this.timings = [Math.floor(1.0/this.spt_a), Math.floor(1.0/this.spt_b), Math.floor(1.0/this.spt_c)]
            //this.fps = Math.floor(1.0/this.spt_b)
            // reduce the frequency that the fps updates when displayed
            this.fps_timer -= 1
            if (this.fps_timer <= 0) {
                this.fps = Math.floor(1.0/this.spt_b)
                this.fps_timer = 30
            }


        }
        this.lastTime = now;

        now = performance.now()



        window.requestAnimationFrame(this.render.bind(this));
    }

}
