 

include "./primitives.js"

const Keys = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
}

export class KeyboardInput {
    constructor(target) {

        this.target = target
        this.keysDown = [];

        this.buttons = [Keys.CTRL, Keys.SPACE]

    }

    handleKeyPress(keyevent) {
        let kc = keyevent.keyCode
        if (kc >= 37 && kc <= 40) {
            if (!this.keysDown.includes(kc)) {
                this.keysDown.push(kc)
            }
            // keyboard is always wheel zero?
            let v = this.getDirectionVector(this.keysDown)
            this.target.setInputDirection(0, v)
        } else {

            let match = 0;
            for (let i=0; i<this.buttons.length; i++) {
                if (this.buttons[i] == kc) {
                    this.target.handleButtonPress(i)
                    match = 1
                }
            }
            if (match===0) {
                console.log(`unexpected keycode ${event.keyCode}`)
            }
        }
    }

    handleKeyRelease(keyevent) {
        let kc = keyevent.keyCode
        if (kc >= 37 && kc <= 40) {
            let index = this.keysDown.indexOf(kc);
            if (index !== -1) {
                this.keysDown.splice(index, 1);
            }
            // keyboard is always wheel zero?
            let v = this.getDirectionVector(this.keysDown)
            this.target.setInputDirection(0, v)
        } else {

            let match = 0;
            for (let i=0; i<this.buttons.length; i++) {
                if (this.buttons[i] == kc) {
                    this.target.handleButtonRelease(i)
                    match = 1
                }
            }
            if (match===0) {
                console.log(`unexpected keycode ${event.keyCode}`)
            }
        }

    }

    getDirectionVector(keysDown) {
        // get first detected input
        // if user presses multiple keys, remember
        // the order they were pressed

        let x = 0;
        let y = 0;
        for (let i=0; i<keysDown.length; i++) {
            const kc = keysDown[i];
            if (x == 0 && kc == Keys.LEFT) {
                x = -1;
            }
            if (x == 0 && kc == Keys.RIGHT) {
                x = 1;
            }
            if (y == 0 && kc == Keys.UP) {
                y = -1;
            }
            if (y == 0 && kc == Keys.DOWN) {
                y = 1;
            }
        }

        return {x, y};
    }
}

export class TouchInput {
    // todo: make direction circles generic.
    //       allow an arbitrary number to be placed on the screen
    //       with a radius for accepting input

    constructor(target) {

        this.target = target

        this.touches = []

        this.touch_move = null;

        this.wheels = []
        this.buttons = []

        this.button_icons = []

        this.resize()
    }

    handleMove(whlid, tx, ty) {
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
        this.target.setInputDirection(whlid, cv)

    }

    handleMoveCancel(whlid) {
        if (this.target===null) {
            return
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

        if (touches.length) {
            this.touches = [...touches]
        }

        // test for touches on buttons and remove from the list
        for (let j=0; j < this.buttons.length; j++) {
            let btn = this.buttons[j]

            let pressed = 0;
            for (let i=touches.length-1; i >= 0; i--) {
                let touch = touches[i];
                const dx = btn.cx - touch.x
                const dy = btn.cy - touch.y
                if ((dx*dx + dy*dy) < btn.radius*btn.radius) {
                    pressed = 1
                    touches.splice(i, 1);
                }
            }

            if (pressed && !btn.pressed) {
                btn.pressed = 1
                this.handleButtonPress(j)
            } else if (!pressed && btn.pressed) {
                btn.pressed = 0
                this.handleButtonRelease(j)
            }

        }

        // find first touch on for movement...
        let wheel_events = {}
        let touch_move = null;

        for (let j=0; j<this.wheels.length;j++) {
            let wheel = this.wheels[j]
            let touch = null
            for (let i=touches.length-1; i >= 0; i--) {
                const dx = wheel.cx - touches[i].x
                const dy = wheel.cy - touches[i].y
                const dr = wheel.radius * 2
                if ((dx*dx + dy*dy) < dr*dr) {
                    touch = touches[i]
                    touches.splice(i, 1);
                    break
                }
            }
            if (touch!==null && touch.pressed) {
                this.handleMove(j, touch.x, touch.y)
            } else {
                this.handleMoveCancel(j)
            }
        }

    }

    resize() {

        // 96
        // 144.0
        let radius = (gEngine.view.height*.2) // 3 * 32
        this.wheels = [
            {
                cx: radius,
                cy: gEngine.view.height - radius,
                radius: radius,
                vector: {x:0, y:0}
            },
        ]

        radius = 32
        this.buttons = [
            {cx: gEngine.view.width - radius,
             cy: gEngine.view.height - 3*radius,
             radius: radius, pressed: 0},
            {cx: gEngine.view.width - 3*radius,
            cy: gEngine.view.height - radius,
            radius: radius, pressed: 0},
        ]
    }

    paint(ctx) {

        // input is a central point with radial lines coming from that point
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';

        for (let w = 0; w < this.wheels.length; w++) {

            let whl = this.wheels[w]
            const e2 = Math.floor(whl.radius)
            const e3 = Math.floor(whl.radius *.7071)
            const cx = Math.floor(whl.cx)
            const cy = Math.floor(whl.cy)
            const cr = Math.floor(whl.radius)
            const dw = 16
            const dr = 48

            /*
            ctx.beginPath();
            //ctx.moveTo(0,0);
            //ctx.lineTo(32,32);

            ctx.moveTo(cx - e3, cy - e3);
            ctx.lineTo(cx + e3, cy + e3);

            ctx.moveTo(cx + e3, cy - e3);
            ctx.lineTo(cx - e3, cy + e3);

            ctx.moveTo(cx - e2, cy);
            ctx.lineTo(cx + e2, cy);

            ctx.moveTo(cx, cy - e2);
            ctx.lineTo(cx, cy + e2);


            ctx.moveTo(cx, cy);
            ctx.arc(cx,cy,e2,0,2*Math.PI);

            //ctx.moveTo(0,0);
            //ctx.lineTo(320,320);
            //ctx.lineTo(640,0);
            ctx.stroke();
            */



            ctx.strokeStyle = '#00000055';
            ctx.fillStyle = '#888888aa';

            ctx.beginPath();
            ctx.roundRect(cx - dr, cy - dw, dr*2, 2*dw, 8)
            ctx.roundRect(cx - dw, cy - dr, dw*2, 2*dr, 8)
            ctx.fill();

            ctx.save()
            ctx.beginPath();
            let region = new Path2D();
            region.rect(cx - dr-2, cy - dw - 2, dr*2+3, 2*dw+3)
            region.rect(cx - dw-2, cy - dr - 2, dw*2+3, 2*dr+3)
            ctx.clip(region, "evenodd");

            ctx.beginPath();
            ctx.roundRect(cx - dr, cy - dw, dr*2, 2*dw, 8)
            ctx.roundRect(cx - dw, cy - dr, dw*2, 2*dr, 8)
            ctx.stroke();
            ctx.restore()

            ctx.strokeStyle = '#00000055';

            ctx.fillStyle = (whl.vector.x<-.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cx - dr + 16, cy, 8, 0, 2*Math.PI);
            ctx.fill();

            ctx.fillStyle = (whl.vector.x>.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cx + dr - 16, cy, 8, 0, 2*Math.PI);
            ctx.fill();

            ctx.fillStyle = (whl.vector.y<-.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cx, cy - dr + 16, 8, 0, 2*Math.PI);
            ctx.fill();

            ctx.fillStyle = (whl.vector.y>.5)?'#FF770055':'#00000055';
            ctx.beginPath();
            ctx.arc(cx, cy + dr - 16, 8, 0, 2*Math.PI);
            ctx.fill();




        }

        for (let i=0; i< this.buttons.length; i++) {
            const dw = 16
            let btn = this.buttons[i];
            ctx.strokeStyle = '#00000055';
            ctx.fillStyle = '#888888aa';
            ctx.beginPath();
            ctx.arc(btn.cx,btn.cy,btn.radius*.8,0,2*Math.PI);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(btn.cx,btn.cy,btn.radius*.8,0,2*Math.PI);
            ctx.stroke();

            ctx.save()
            ctx.globalAlpha = .5
            if (this.button_icons[i]) {
                this.button_icons[i].sheet.drawTileScaled(ctx, this.button_icons[i].tid, btn.cx-16,btn.cy-16, 32, 32)
            }
            ctx.restore()
        }

        this.touches.forEach(t => {
            ctx.fillStyle = '#888888aa';
            ctx.beginPath();
            ctx.arc(t.x,t.y,5,0,2*Math.PI);
            ctx.fill();
        })

    }
}

