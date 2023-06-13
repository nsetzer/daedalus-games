
from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
}

const style = {
    body: StyleSheet({
        margin: 0,
        padding:0,
        overflow: 'scroll',
        background: '#333333',
    }),

    main: StyleSheet({
        display: "flex"
        "justify-content": "center",
         flex-direction: row,
    }),

    item_hover: StyleSheet({background: '#0000CC22'}),
    item: StyleSheet({}),
    item_file: StyleSheet({color: "blue", cursor: 'pointer'}),
    canvas: StyleSheet({
        border: "0px",
        "justify-content": "center",
        cursor: 'pointer'
    })

}

StyleSheet("", "@media screen and (min-width: 320)", {
    'body': {
        background: '#AAAAAA',
    },
    `.${style.canvas}`: {
        "border": "3px solid green",
    },
})

StyleSheet("", "@media screen and (min-width: 720)", {
    'body': {
        background: '#AAAAAA',
    },
    `.${style.canvas}`: {
        "border": "3px solid red",
    },
})

class Sprite {
    constructor(path) {
        this.image = new Image();
        this.ready = false;
        this.image.onload = () => {console.log('image ready'); this.ready = true;}
        this.image.src = path
    }
}

class Entity {

    constructor(sprite) {

        this.sprite = sprite
        this.x = 32
        this.y = 32
    }

    paint(ctx) {
        if (this.sprite.ready) {
            ctx.drawImage(this.sprite.image, this.x, this.y);
        }
    }
}

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

const Direction = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    UP: 4,
    DOWN: 8,
    UPLEFT: 4|1,
    UPRIGHT: 4|2,
    DOWNLEFT: 8|1,
    DOWNRIGHT: 8|2,
}

Direction.name = Object.fromEntries(
            Object.entries(Direction).map(([key, value]) => [value, key]));

Direction.vector = function(d) {
    let xspeed = 0;
    let yspeed = 0;
    if (d&Direction.LEFT) {
        xspeed = -1;
    }
    if (d&Direction.RIGHT) {
        xspeed = 1;
    }
    if (d&Direction.UP) {
        yspeed = -1;
    }
    if (d&Direction.DOWN) {
        yspeed = 1;
    }
    return {x:xspeed, y:yspeed}
}

function randomNumber(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}


class Keyboard {
    constructor(target) {

        this.target = target
        this.keysDown = [];

    }

    handlePress(kc) {
        if (kc >= 37 && kc <= 40) {
            if (!this.keysDown.includes(kc)) {
                this.keysDown.push(kc)
            }
            this.target.setInputDirection(this.getDirection(this.keysDown))
        } else if (kc == Keys.SPACE) {

        } else {
            console.log(`unexpected keycode ${event.keyCode}`)
        }
    }

    handleRelease(kc) {


        if (kc >= 37 && kc <= 40) {
            var index = this.keysDown.indexOf(kc);
            if (index !== -1) {
                this.keysDown.splice(index, 1);
            }
            this.target.setInputDirection(this.getDirection(this.keysDown))
        } else if (kc == Keys.SPACE) {

        } else {
            console.log(`unexpected keycode ${event.keyCode}`)
        }

    }

    getDirection(keysDown) {

        let h = 0;
        let v = 0;

        for (var i=0; i<keysDown.length; i++) {
            const kc = keysDown[i];
            if (h == 0 && kc == Keys.LEFT) {
                h = Direction.LEFT;
            }
            if (h == 0 && kc == Keys.RIGHT) {
                h = Direction.RIGHT;
            }
            if (v == 0 && kc == Keys.UP) {
                v = Direction.UP;
            }
            if (v == 0 && kc == Keys.DOWN) {
                v = Direction.DOWN;
            }
        }

        return h|v;
    }
}

class TouchInput {

    constructor(target) {

        this.target = target

        this.rotate = 0

        this.keyseq = [
            Direction.RIGHT,
            Direction.UPRIGHT,
            Direction.UP,
            Direction.UPLEFT,
            Direction.LEFT,
            Direction.DOWNLEFT,
            Direction.DOWN,
            Direction.DOWNRIGHT,
        ]

        this.keyseq_r = [
            Direction.RIGHT,
            Direction.UPRIGHT,
            Direction.UP,
            Direction.UPLEFT,
            Direction.LEFT,
            Direction.DOWNLEFT,
            Direction.DOWN,
            Direction.DOWNRIGHT,
        ]

        this.ce = 5*32
        this.cx = 2 * 32
        this.cy = 10 * 32 - 2 * 32
    }

    handleMove(tx, ty) {
        const e = this.ce
        const cx = this.cx
        const cy = this.cy

        const theta = Math.atan2(-(cy - ty), (cx - tx)) * 180/Math.PI
        let index = 4 + Math.round(theta/45)
        if (index == 8) {
            index = 0
        }
        const d = (this.rotate?this.keyseq_r:this.keyseq)[index]

        this.target.setInputDirection(d)
        this.target.touch_at = [tx, ty]

    }

    handleMoveCancel() {

        this.target.setInputDirection(0)
    }

    paint(ctx) {

        // input is a central point with radial lines coming from that point
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.beginPath();

        const e = this.ce
        const cx = this.cx
        const cy = this.cy

        ctx.moveTo(cx - e/2 *.7071, cy - e/2 *.7071);
        ctx.lineTo(cx + e/2 *.7071, cy + e/2 *.7071);

        ctx.moveTo(cx + e/2 *.7071, cy - e/2 *.7071);
        ctx.lineTo(cx - e/2 *.7071, cy + e/2 *.7071);

        ctx.moveTo(cx - e/2, cy);
        ctx.lineTo(cx + e/2, cy);

        ctx.moveTo(cx, cy - e/2);
        ctx.lineTo(cx, cy + e/2);

        ctx.moveTo(cx, cy);
        ctx.arc(cx,cy,e/2,0,2*Math.PI);

        ctx.stroke();

    }
}

class Canvas extends DomElement {
    constructor() {
        super("canvas", {
                "width": 20*32,
                "height": 10*32,
                className:style.canvas
            })

        this.sprite_bg = new Sprite("/static/background.png")
        this.sprite_hero = new Sprite("/static/hero.png")
        this.sprite_monster = new Sprite("/static/monster.png")

        this.ent_hero = new Entity(this.sprite_hero)
        this.ent_monster = new Entity(this.sprite_monster)

        this.ent_monster.x = Math.floor(randomNumber(1, 18)*32)
        this.ent_monster.y = Math.floor(randomNumber(1, 8)*32)


        this.touch = new TouchInput(this)

        this.ctx = null
        this.lastTime = null

        this.touch_at = [0,0]
        this.touches = []
        this.direction = 0

        this.delta_accum = 0

        this.view = {x:0, y:0, width:640, height:320}

    }

    elementMounted() {


        if (daedalus.platform.isMobile) {
            this.getDomNode().width = screen.availHeight
            this.getDomNode().height = screen.availWidth
            this.view.x = 16; //Math.floor((this.getDomNode().width - this.view.width)/2)
            this.view.y = Math.floor((this.getDomNode().height - this.view.height)/2)
            //this.updateProps({width: screen.availWidth, height: screen.availHeight})
        } else {
            this.view.scale = 2
            //this.updateProps({width: 640*2, height: 320*2})
            this.getDomNode().width = window.innerWidth
            this.getDomNode().height = window.innerHeight
            this.view.x = 64
            this.view.y = 64
            console.log(this.props)
        }

        console.log('width', window.innerWidth, this.view.width, )
        console.log(this.view)

        this.ctx = this.getDomNode().getContext("2d");
        console.log(`set context ${this.ctx}`)

        this.render()
    }

    onMouseDown(event) {
        event.preventDefault();
        const rect = this.getDomNode().getBoundingClientRect();
        const tx = (event.clientX - rect.left) / this.view.scale  - this.view.x
        const ty = (event.clientY - rect.top) / this.view.scale  - this.view.y
        this.touch.handleMove(tx,ty)
    }

    onMouseMove(event) {
        event.preventDefault();
        if (event.buttons&1) {
            const rect = this.getDomNode().getBoundingClientRect();
            const tx = (event.clientX - rect.left) / this.view.scale  - this.view.x
            const ty = (event.clientY - rect.top) / this.view.scale  - this.view.y
            this.touch.handleMove(tx,ty)
        }
    }

    onMouseUp(event) {
        event.preventDefault();
        this.touch.handleMoveCancel()
        console.log("cancel move")
    }

    onTouchStart(event) {
        event.preventDefault();
        const rect = this.getDomNode().getBoundingClientRect();
        // TODO: multi touch support
        // map all touches to new coordinates and pass to touch handler
        // touch handler takes first one that looks like a movement input
        // and first one that looks like a button input, etc
        const touch = event.touches[0]
        this.touches = event.touches
        const tx = touch.clientX - rect.left - this.view.x
        const ty = touch.clientY - rect.top - this.view.y
        if (this.touch.rotate) {
            this.touch.handleMove(ty,this.view.height - tx)
        } else {
            this.touch.handleMove(tx,ty)
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        this.touch.handleMoveCancel()

    }

    onTouchMove(event) {
        event.preventDefault();
        const rect = this.getDomNode().getBoundingClientRect();
        // TODO: multi touch support
        const touch = event.touches[0]
        this.touches = event.touches
        let tx = touch.clientX - rect.left - this.view.x
        let ty = touch.clientY - rect.top - this.view.y
        if (this.touch.rotate) {
            this.touch.handleMove(ty,this.view.height - tx)
        } else {
            this.touch.handleMove(tx,ty)
        }


    }

    onKeyDown(event) {
        event.preventDefault();
    }

    onKeyUp(event) {
        event.preventDefault();
    }

    setInputDirection(d) {
        this.direction = d
    }


    update(dt) {

        if (this.direction) {

            let speed = 128;
            let v = Direction.vector(this.direction)

            this.ent_hero.x += dt*speed*v.x;
            if (this.ent_hero.x < 0) {
                this.ent_hero.x = 0
            }
            if (this.ent_hero.x > 20*32 - 32) {
                this.ent_hero.x = 20*32 - 32
            }
            this.ent_hero.y += dt*speed*v.y;
            if (this.ent_hero.y < 0) {
                this.ent_hero.y = 0
            }
            if (this.ent_hero.y > 10*32 - 32) {
                this.ent_hero.y = 10*32 - 32
            }


            let cx = this.ent_hero.x + 16
            let cy = this.ent_hero.y + 16
            if (
                (this.ent_monster.x < cx && this.ent_monster.y < cy) &&
                (this.ent_monster.x+32 > cx && this.ent_monster.y+32 > cy)
               ) {
                    this.ent_monster.x = Math.floor(randomNumber(1, 18)*32)
                    this.ent_monster.y = Math.floor(randomNumber(1, 8)*32)
            }
            console.log(this.ent_hero.x, this.ent_hero.y, this.ent_monster.x, this.ent_monster.y)


        }
    }

    renderFrame() {

        const ctx = this.ctx;

        if (ctx === null) {
            console.log(ctx)
            return;
        }
        ctx.resetTransform()
        let node = this.getDomNode()
        ctx.clearRect(0, 0, node.width, node.height)

        //const rect = canvas.getBoundingClientRect();

        // Set the "actual" size of the canvas
        //canvas.width = rect.width * dpr;
        //canvas.height = rect.height * dpr;

        // Scale the context to ensure correct drawing operations
        //console.log(dpr)
        ctx.scale(this.view.scale, this.view.scale);

        ctx.translate(this.view.x, this.view.y)

        if (this.sprite_bg.ready) {
            this.ctx.drawImage(this.sprite_bg.image, 0, 0);
        } else {
            ctx.fillText(`loading`, 8, 8)
        }

        ctx.fillStyle = "yellow";

        ctx.fillText(`${this.touches.length} fps = ${this.fps} direction = ${Direction.name[this.direction]}`, 0, -8)

        let cx = this.touch_at[0], cy = this.touch_at[1]
        ctx.beginPath();
        ctx.arc(cx,cy,5,0,2*Math.PI);
        ctx.stroke();

        this.ent_monster.paint(ctx)
        this.ent_hero.paint(ctx)

        this.touch.paint(ctx)



    }

    render() {
        var now = performance.now()

        if (this.lastTime != null) {
            this.delta_accum += (now - this.lastTime) / 1000.0;
            let dt = 1/60;
            let n = 0;
            while (this.delta_accum > dt) {
                this.delta_accum -= dt
                this.update(dt);
                n += 1;
            }
            if (n > 0) {
                this.renderFrame();
            }
            this.fps = Math.floor(1.0/dt)
        }
        this.lastTime = now;

        window.requestAnimationFrame(this.render.bind(this));
    }


}


export default class Application extends DomElement {
    constructor() {
        super("div", {className: style.main}, [])

        //let div = this.appendChild(new DomElement("div"))
        //self.text = div.appendChild(new TextElement("hello world"))

        const body = document.getElementsByTagName("BODY")[0];
        body.className = style.body

        //let w = window;
        //document.requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;

        this.canvas = this.appendChild(new Canvas())

        this.keyboard = new Keyboard(this.canvas);

        window.addEventListener("keydown", (event) => {
            const kc = event.keyCode;
            this.keyboard.handlePress(kc);
        })

        window.addEventListener("keyup", (event) => {
            const kc = event.keyCode;
            this.keyboard.handleRelease(kc);
        })

    }



    elementMounted() {

        // screen.lockOrientation("landscape");


        //self.text.setText(JSON.stringify({h:screen.availHeight, w:screen.availWidth}))


        if(screen.availHeight > screen.availWidth){
            console.log("Please use Landscape!");

            document.body.setAttribute( "style", "-moz-transform: rotate(90deg);");
            document.body.setAttribute( "style", "-o-transform: rotate(90deg);");
            document.body.setAttribute( "style", "-webkit-transform: rotate(90deg);");
            document.body.setAttribute( "style", "transform: rotate(90deg);");
            this.canvas.touch.rotate = 1

        } else {
            console.log("ok!");
        }


    }
}