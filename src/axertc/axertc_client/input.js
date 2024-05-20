 

import {Rect, Direction, Alignment} from "@axertc/axertc_common"

const Keys = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
}

const T_SINGLETAP = 100
const T_DOUBLETAP = 200

//[ord(c) for c in "WDSA"]
//[87, 68, 83, 65]

// gamepad / joystick support in the browser
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
//

export class KeyboardInput {
    constructor(target) {

        this.target = target

        this.buttons = []
        this.pressed = {}

        this.wheels = []

    }

    addWheel(up, right, down, left) {
        this.wheels.push({
            up,
            right,
            down,
            left,
            keysDown: [],
            keyTime: 0,
            last_vector: {x:null, y:null}, all:[up, right, down, left]})
    }

    addWheel_WASD() {
        this.addWheel(87, 68, 83, 65)
    }

    addWheel_ArrowKeys() {
        this.addWheel(Keys.UP, Keys.RIGHT, Keys.DOWN, Keys.LEFT)
    }

    addButton(keyCode) {
        this.buttons.push(keyCode)
    }

    handleKeyPress(keyevent) {
        let kc = keyevent.keyCode

        let whlid = null
        this.wheels.forEach((whl, index) => {
            if (whl.all.includes(kc)) {
                whlid = index
            }
        })

        if (whlid !== null) {
            const whl = this.wheels[whlid]

            if (!whl.keysDown.includes(kc)) {
                whl.keysDown.push(kc)
            }

            // doubletap
            let doubletap = false
            let now = performance.now()
            if (now - whl.keyTime < T_DOUBLETAP) {
                this.target.tapDirection(whlid, this.keyToDirection(whl, kc), 2)
            }
            whl.keyTime = performance.now()

            let v = this.getDirectionVector(whl)
            if (whl.last_vector.x !=v.x || whl.last_vector.y != v.y) {
                whl.last_vector = v
                this.target.setInputDirection(whlid, v)
            }
        } else if (kc > 0 ) {

            let match = 0;
            for (let i=0; i<this.buttons.length; i++) {
                if (this.buttons[i] == kc) {
                    if (!this.pressed[i]) {
                        this.target.handleButtonPress(i)
                        this.pressed[i] = true
                    }
                    match = 1
                }
            }
            if (match===0) {
                console.log(`unexpected keycode ${event.keyCode} ${this.buttons}`)

            }
        }
    }

    handleKeyRelease(keyevent) {
        let kc = keyevent.keyCode

        let whlid = null
        this.wheels.forEach((whl, index) => {
            if (whl.all.includes(kc)) {
                whlid = index
            }
        })

        if (whlid !== null) {
            const whl = this.wheels[whlid]
            let index = whl.keysDown.indexOf(kc);
            if (index !== -1) {
                whl.keysDown.splice(index, 1);
            }

            let v = this.getDirectionVector(whl)

            //singletap
            let singletap = false
            let now = performance.now()
            if (now - whl.keyTime < T_SINGLETAP) {
                this.target.tapDirection(whlid, Direction.fromVector(v.x, v.y), 1)
            }

            this.target.setInputDirection(whlid, v)
            whl.last_vector = {x:null, y:null}
        } else if (kc > 0 ) {

            let match = 0;
            for (let i=0; i<this.buttons.length; i++) {
                if (this.buttons[i] == kc) {
                    if (this.pressed[i]) {
                        this.target.handleButtonRelease(i)
                        this.pressed[i] = false
                    }
                    match = 1
                }
            }
            if (match===0) {
                console.log(`unexpected keycode ${event.keyCode}`)
            }
        }

    }

    keyToDirection(whl, kc) {
        let x = 0;
        let y = 0;

        if (x == 0 && kc == whl.left) {
            x = -1;
        }
        if (x == 0 && kc == whl.right) {
            x = 1;
        }
        if (y == 0 && kc == whl.up) {
            y = -1;
        }
        if (y == 0 && kc == whl.down) {
            y = 1;
        }

        return Direction.fromVector(x, y)
    }

    getDirectionVector(whl) {
        // get first detected input
        // if user presses multiple keys, remember
        // the order they were pressed

        let x = 0;
        let y = 0;
        for (let i=0; i<whl.keysDown.length; i++) {
            const kc = whl.keysDown[i];
            if (x == 0 && kc == whl.left) {
                x = -1;
            }
            if (x == 0 && kc == whl.right) {
                x = 1;
            }
            if (y == 0 && kc == whl.up) {
                y = -1;
            }
            if (y == 0 && kc == whl.down) {
                y = 1;
            }
        }

        return {x, y};
    }
}
KeyboardInput.Keys = Keys

let _arrow = (dx, dy, radius=4) => {
    let angle = Math.atan2(dx, dy)
    let x1 = radius*Math.cos(angle)
    let y1 = radius*Math.sin(angle)
    angle += (1/3)*(2*Math.PI)
    let x2 = radius*Math.cos(angle)
    let y2 = radius*Math.sin(angle)
    angle += (1/3)*(2*Math.PI)
    let x3 = radius*Math.cos(angle)
    let y3 = radius*Math.sin(angle)
    return [{x:x1,y:y1},{x:x2,y:y2},{x:x3,y:y3}]
}

let _arrow_draw = (ctx, pts, cx, cy) => {
    ctx.beginPath()
    ctx.moveTo(cx + pts[0].x, cy + pts[0].y)
    ctx.lineTo(cx + pts[1].x, cy + pts[1].y)
    ctx.lineTo(cx + pts[2].x, cy + pts[2].y)
    ctx.closePath()
    ctx.fill()
}

export class TouchInput {
    // todo: make direction circles generic.
    //       allow an arbitrary number to be placed on the screen
    //       with a radius for accepting input

    constructor(target) {

        this.target = target

        this.touches = []

        this.wheels = []
        this.buttons = []

        this.arrows = {
            up: _arrow(-1, 0, 4/gEngine.view.scale),
            down: _arrow(1, 0, 4/gEngine.view.scale),
            left: _arrow(0, -1, 4/gEngine.view.scale),
            right: _arrow(0, 1, 4/gEngine.view.scale),
        }

        this.error = 0
    }

    _align_wheel(x,y,alignment) {
        // TODO: only on mobile: align to the screen, not the view
        let cx, cy;

        x /= gEngine.view.scale
        y /= gEngine.view.scale

        if (alignment&Alignment.RIGHT) {
            cx = gEngine.view.width - x
        } else {
            cx = x
        }

        if (alignment&Alignment.TOP) {
            cy = y
        } else {
            cy = gEngine.view.height + y
        }

        return {cx, cy}
    }

    addWheel(x, y, radius, options) {

        let alignment = options?.align ?? (Alignment.LEFT|Alignment.BOTTOM)

        let symbols = options?.symbols ?? null

        let p = this._align_wheel(x, y, alignment)
        this.wheels.push({
            // user defined configuration
            x, y, radius,
            // cx,cy are derived from x,y and depend on the canvas scale
            cx: p.cx,
            cy: p.cy,
            multiplier: options?.multiplier ?? 2,
            alignment: alignment,
            vector: {x:0, y:0},
            pressed: false,
            symbols: symbols,
            vectorTime: [0, 0]
        })
    }

    _align_button(x,y,alignment) {
        let cx, cy

        x /= gEngine.view.scale
        y /= gEngine.view.scale

        if (alignment&Alignment.RIGHT) {
            cx = gEngine.view.width - x
        } else {
            cx = x
        }

        if (alignment&Alignment.TOP) {
            cy = y
        } else {
            cy = gEngine.view.height + y
        }
        return {cx, cy}
    }

    addButton(x, y, radius, options) {

        let alignment = options?.align ?? (Alignment.RIGHT|Alignment.BOTTOM)
        let style = options?.style ?? "circle"
        let text = options?.text ?? null
        let icon = options?.icon ?? null

        let p = this._align_button(x, y, alignment)

        this.buttons.push({
            x, y, radius,
            cx: p.cx,
            cy: p.cy,
            alignment: alignment,
            style: style,
            pressed: false,
            icon: icon,
            text: text,
        })
    }

    handleMove(whlid, tx, ty, first, pressed) {
        if (this.target===null) {
            return
        }

        const cx = this.wheels[whlid].cx
        const cy = this.wheels[whlid].cy

        let dx = tx - cx
        let dy = ty - cy
        let d = Math.sqrt(dx*dx + dy*dy)
        let cv = {x: dx/d, y:dy/d}

        this.wheels[whlid].vector = cv


        if (first && pressed) {
            //doubletap
            let now = performance.now()
            let curr_d = Direction.fromVector(cv.x, cv.y)
            let [prev_d, prev_t] = this.wheels[whlid].vectorTime
            if (curr_d == prev_d  && (now - prev_t < T_DOUBLETAP)) {
                this.target.tapDirection(whlid, curr_d, 2)
            }
            this.wheels[whlid].vectorTime = [curr_d, now]
        }


        this.target.setInputDirection(whlid, cv)
    }

    handleMoveCancel(whlid) {
        if (this.target===null) {
            return
        }

        if (true) {
            // singletap
            let now = performance.now()
            let v = this.wheels[whlid].vector
            let curr_d = Direction.fromVector(v.x, v.y)
            let [prev_d, prev_t] = this.wheels[whlid].vectorTime
            if (curr_d == prev_d  && (now - prev_t < T_SINGLETAP)) {
                this.target.tapDirection(whlid, curr_d, 1)
            }
        }

        let cv = {x:0, y:0}
        this.wheels[whlid].vector = cv
        this.target.setInputDirection(whlid, cv)
    }

    handleButtonPress(btnid) {
        if (this.target===null) {
            return
        }
        this.target.handleButtonPress(btnid)
    }

    handleButtonRelease(btnid) {
        if (this.target===null) {
            return
        }
        this.target.handleButtonRelease(btnid)
    }

    handleTouches(touches) {

        //touches = [...touches] // copy?
        // update the cache for painting
        this.touches = [...touches]
        console.log(this.touches)

        /*
        TODO: something strange on android when touches are on the same vertical line
        let s = ""
        for(let i=0; i<touches.length; i++) {
            s += `{${touches[i].x},${touches[i].y}} `
        }
        console.log(touches.length, s)
        */

        // test for touches on buttons and remove from the list
        for (let j=0; j < this.buttons.length; j++) {
            let btn = this.buttons[j]

            let pressed = null;
            for (let i=touches.length-1; i >= 0; i--) {
                let touch = touches[i];
                const dx = btn.cx - touch.x
                const dy = btn.cy - touch.y
                const dr = btn.radius / gEngine.view.scale
                if ((dx*dx + dy*dy) < dr*dr) {
                    pressed = !!touch.pressed
                    touches.splice(i, 1);
                    break;
                }
            }

            if (!btn.pressed && pressed === true) {
                btn.pressed = 1
                this.handleButtonPress(j)
                //console.log("press", j)
            } else if (btn.pressed && !pressed) {
                btn.pressed = 0
                this.handleButtonRelease(j)
                //console.log("release", j)
            } else {
                this.error += 1
            }

        }

        // find first touch on for movement...
        let wheel_events = {}

        for (let j=0; j<this.wheels.length;j++) {
            let wheel = this.wheels[j]
            let touch = null
            for (let i=touches.length-1; i >= 0; i--) {
                const dx = wheel.cx - touches[i].x
                const dy = wheel.cy - touches[i].y
                const dr = (wheel.radius/gEngine.view.scale) * wheel.multiplier
                if ((dx*dx + dy*dy) < dr*dr) {
                    touch = touches[i]
                    touches.splice(i, 1);
                    break
                }
            }

            if (touch!==null && touch.pressed) {
                wheel.pressed = true
                this.handleMove(j, touch.x, touch.y, touch.first, touch.pressed)
            } else if (wheel.pressed) {
                wheel.pressed = false
                this.handleMoveCancel(j)
            }
        }

        // return the unused touch events
        return touches

    }

    resize() {

        // TODO: implement addWheel / add button
        //  alignment, which edge of the screen to anchor to
        //  offset, relative to aligned edge
        //  cx,cy: screen dimensions + alignment + offset
        //let radius = (gEngine.view.height*.2) // 3 * 32
        //this.wheels = [
        //    {
        //        cx: radius,
        //        cy: gEngine.view.height - radius,
        //        radius: radius,
        //        vector: {x:0, y:0},
        //        pressed: false
        //    },
        //]
        for (let wheel of this.wheels) {

            let p = this._align_wheel(wheel.x, wheel.y, wheel.alignment)
            wheel.cx = p.cx
            wheel.cy = p.cy
        }

        for (let button of this.buttons) {
            let p = this._align_button(button.x, button.y, button.alignment)

            button.cx = p.cx
            button.cy = p.cy
        }

        this.arrows = {
            up: _arrow(-1, 0, 4/gEngine.view.scale),
            down: _arrow(1, 0, 4/gEngine.view.scale),
            left: _arrow(0, -1, 4/gEngine.view.scale),
            right: _arrow(0, 1, 4/gEngine.view.scale),
        }

    }

    paint(ctx) {

        // TODO: add debug mode to paint touch radius around objects

        // input is a central point with radial lines coming from that point
        ctx.lineWidth = Math.max(0.5, 2/gEngine.view.scale);
        ctx.strokeStyle = 'red';

        for (let w = 0; w < this.wheels.length; w++) {

            let whl = this.wheels[w]
            const rd = whl.radius // gEngine.view.scale
            const e2 = Math.floor(rd)
            const e3 = Math.floor(rd *.7071)
            const cx = Math.floor(whl.cx)
            const cy = Math.floor(whl.cy)
            const cr = Math.floor(rd)
            const dw = 16 / gEngine.view.scale
            const dr = 48 / gEngine.view.scale

            ctx.strokeStyle = '#00000055';
            ctx.fillStyle = '#888888aa';
            let rr = 8 / gEngine.view.scale

            ctx.beginPath();
            ctx.roundRect(cx - dr, cy - dw, dr*2, 2*dw, rr)
            ctx.roundRect(cx - dw, cy - dr, dw*2, 2*dr, rr)
            ctx.fill();

            ctx.save()
            ctx.beginPath();
            let region = new Path2D();
            let _t = Math.ceil(3 / gEngine.view.scale)
            region.rect(cx - dr-2, cy - dw - 2, dr*2+_t, 2*dw+_t)
            region.rect(cx - dw-2, cy - dr - 2, dw*2+_t, 2*dr+_t)
            ctx.clip(region, "evenodd");

            ctx.beginPath();
            ctx.roundRect(cx - dr, cy - dw, dr*2, 2*dw, rr)
            ctx.roundRect(cx - dw, cy - dr, dw*2, 2*dr, rr)
            ctx.stroke();
            ctx.restore()

            ctx.strokeStyle = '#00000055';

            let cxr = cx - dr + dw
            let cxl = cx + dr - dw
            let cyt = cy + dr - dw
            let cyb = cy - dr + dw
            let radius = 8 / gEngine.view.scale
            ctx.fillStyle = (whl.vector.x<-.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cxr, cy, radius, 0, 2*Math.PI);
            ctx.fill();

            ctx.fillStyle = (whl.vector.x>.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cxl, cy, radius, 0, 2*Math.PI);
            ctx.fill();

            ctx.fillStyle = (whl.vector.y<-.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cx, cyb, radius, 0, 2*Math.PI);
            ctx.fill();

            ctx.fillStyle = (whl.vector.y>.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cx, cyt, radius, 0, 2*Math.PI);
            ctx.fill();

            //ctx.strokeStyle = '#FF0000';
            //ctx.beginPath();
            //ctx.arc(cx, cy, whl.radius/gEngine.view.scale * whl.scale, 0, 2*Math.PI);
            //ctx.stroke();
            //ctx.beginPath();
            //ctx.lineWidth = 3
            //ctx.moveTo(cx, cy);
            //ctx.lineTo(0, gEngine.view.height);
            //ctx.lineWidth = 1
            //ctx.stroke();

            if (whl.symbols != null) {
                ctx.font = "10px";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                ctx.fillText(whl.symbols[0], cx, cyb+1);
                ctx.fillText(whl.symbols[1], cxl, cy+1);
                ctx.fillText(whl.symbols[2], cx, cyt+1);
                ctx.fillText(whl.symbols[3], cxr, cy+1);
            } else {

                ctx.fillStyle = '#000000';

                _arrow_draw(ctx, this.arrows.up,    cx, cyb)
                _arrow_draw(ctx, this.arrows.right, cxl, cy)
                _arrow_draw(ctx, this.arrows.down,  cx, cyt)
                _arrow_draw(ctx, this.arrows.left,  cxr, cy)
            }

            //ctx.font = "10px";
            //ctx.fillStyle = "black"
            //ctx.strokeStyle = "black"
            //ctx.textAlign = "center"
            //ctx.textBaseline = "middle"
            //ctx.fillText("" + dr.toFixed(1) + "," + gEngine.view.scale, cx, cy);


        }

        for (let i=0; i< this.buttons.length; i++) {
            const dw = 16
            let btn = this.buttons[i];
            ctx.strokeStyle = '#00000055';
            if (btn.pressed) {
                ctx.fillStyle = '#FFD700aa';
            } else {
                ctx.fillStyle = '#888888aa';
            }

            if (btn.style === 'rect') {
                const r = btn.radius*.8 / gEngine.view.scale
                ctx.beginPath();
                ctx.rect(btn.cx-r,btn.cy-r,r*2,r*2);
                ctx.fill();
                ctx.stroke();
            } else {
                const r = btn.radius*.8 / gEngine.view.scale
                ctx.beginPath();

                // full size
                //ctx.arc(btn.cx,btn.cy,btn.radius/ gEngine.view.scale,0,2*Math.PI);
                // draw the button a little smaller than the touch radius
                // slightly improves the feel of the button
                ctx.arc(btn.cx,btn.cy,r,0,2*Math.PI);
                ctx.fill();
                ctx.stroke();
            }

            ctx.save()
            ctx.globalAlpha = .5
            if (btn.icon !== null) {
                btn.icon.sheet.drawTileScaled(ctx, btn.icon.tid, btn.cx-16,btn.cy-16, 32, 32)
            } else {
                ctx.font = Math.floor(20/gEngine.view.scale) + "px bold";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                let text = "" + (btn.text ?? i)

                ctx.fillText(text, btn.cx,btn.cy);
            }
            ctx.restore()
        }

        this.touches.forEach(t => {
            ctx.fillStyle = '#888888aa';
            ctx.beginPath();
            ctx.arc(t.x,t.y,5,0,2*Math.PI);
            ctx.fill();
        })

        /*
        TODO: something strange on android when touches are on the same vertical line
        let s = ""
        for(let i=0; i<this.touches.length; i++) {
            let t = this.touches[i]
            s += `${i}:{${Math.floor(t.x)},${Math.floor(t.y)}} `
        }

        ctx.beginPath();
        ctx.font  = "20px Arial";
        ctx.fillStyle = "white"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`${s}`, 32, gEngine.view.height/2);
        ctx.closePath();
        */

       

    }
}

