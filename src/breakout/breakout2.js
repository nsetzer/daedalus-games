
// NOTE: arcs can be drawn clockwise and counter clockwise...
//       may help with curved bricks
// create eyeball bricks
// a brick as a small circle in black
// surrounded by 4 white bricks making up a circle around it
// surrounded by 4 more black bricks
// bricks are basically defined by a quadrant and a radius

from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
}

from module engine import {
    CanvasEngine,
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SpriteSheetBuilder, SpriteSheet,
    ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene
}

import module physics.js

const style = {
    "body": StyleSheet({
        "background": "#333333",
        "overflow": "scroll",
        "margin": 0,
        "padding":0
    }),

            //document.body.setAttribute( "style", "-moz-transform: rotate(90deg);");
            //document.body.setAttribute( "style", "-o-transform: rotate(90deg);");
            //document.body.setAttribute( "style", "-webkit-transform: rotate(90deg);");
            //document.body.setAttribute( "style", "transform: rotate(90deg);");

    "bodyRotate": StyleSheet({
        "background": "#333333",
        "overflow": "scroll",
        "margin": 0,
        "padding":0,
        "transform-origin": "top left",
        "transform": "translate(100vw, 30vh) rotate(90deg);"
    }),

    "main": StyleSheet({
        "display": "flex",
        "flex-direction": "row",
        "justify-content": "center"
    }),

    "item_hover": StyleSheet({"background": "#0000CC22"}),
    "item": StyleSheet({}),
    "item_file": StyleSheet({"color": "blue", "cursor": "pointer"}),
};


class Agent {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.visible = true;
        this.destroy = false;
        this.solid = false;
        this.layer = 0

    }

    update(dt) {

    }

    paint(ctx) {

    }

    collisionRect() {

        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        }
    }

    collisionShape() {

        const rect = this.collisionRect()

        const tl = {x:rect.x, y:rect.y},
              tr = {x:rect.x+rect.width, y:rect.y},
              bl = {x:rect.x, y:rect.y+rect.height},
              br = {x:rect.x+rect.width, y:rect.y+rect.height};

        const shape = [
            {type: "line", p1: tl, p2: bl}, // left
            {type: "line", p1: tl, p2: tr}, // top
            {type: "line", p1: tr, p2: br}, // right
            {type: "line", p1: bl, p2: br}, // bottom
        ]

        return shape
    }
}

const collision = {
    point2rect: function(px, py, tx, ty, tw, th) {
        return px < tx + tw &&
               px > tx &&
               py < ty + th &&
               py > ty;
    },
    point2rectTB: function(px, py, tx, ty, tw, th) {
        return py < ty + th &&
               py > ty;
    },
    point2rectLR: function(px, py, tx, ty, tw, th) {
        return px < tx + tw &&
               px > tx
    },
    rect2rect: function(px, py, pw, ph, tx, ty, tw, th) {
        return px < tx + tw &&
               px + pw > tx &&
               py < ty + th &&
               py + ph > ty;
    }
}

class Ball extends Agent {
    constructor() {
        super();
        this.basespeed = 80
        this.dx = this.basespeed*.7071;
        this.dy = -this.basespeed*.7071;
        this.radius = 5;
        this.color = 'blue'
        this.layer = 10

        this.x = 100
        this.y = 400
        this.trail = []
        this.particles = []

        this.hit = null
    }


    doCollide(rect) {

        if (this.y < rect.y || this.y > rect.y + rect.height) {
            this.dy = - this.dy
        } else if (this.x > rect.x && this.x < rect.x + rect.width) {
            if (this.y < rect.y + rect.height/2) {
                this.y = rect.y - this.radius
                this.dy = -Math.abs(this.dy)
            } else if (this.y > rect.y + rect.height/2) {
                this.y = rect.y + rect.height + this.radius
                this.dy = Math.abs(this.dy)
            }
        }

        if (this.x < rect.x || this.x > rect.x + rect.width) {
            this.dx = - this.dx
        } else if (this.y > rect.y && this.y < rect.y + rect.height) {
            if (this.x < rect.x + rect.width/2) {
                this.x = rect.x - this.radius
                this.dx = -Math.abs(this.dx)
            } else if (this.x > rect.x + rect.width/2) {
                this.x = rect.x + rect.width + this.radius
                this.dx = Math.abs(this.dx)
            }
        }
        this.collide = true
    }

    update(dt) {

        this.move_x(dt)
        this.move_y(dt)

        this.trail.push({x:this.x, y:this.y})
        if (this.trail.length > 5) {
            this.trail.shift()
        }

    }

    move_x(dt) {

        let x = this.x;
        let dx = this.dx*dt;

        const agents = gEngine.scene.agents
        const view = gEngine.view

        for (let agent of agents) {
            if (agent.solid) {
                const rect = agent.collisionRect();

                if (collision.point2rect(
                        x + dx, this.y,
                        rect.x, rect.y,
                        rect.width, rect.height)) {

                    const p1 = {x: x, y: this.y}
                    const p2 = {x: x + dx, y: this.y}
                    const ps = {x: x - dx, y: this.y}

                    const shape = agent.collisionShape()

                    const result = physics.intercept_shape(p1, p2, shape)
                    if (result !== null) {
                        if (agent instanceof Brick) {
                            agent.decrementHealth()
                        }
                        const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                        this.hit = {normal: n, tangent: result.tangent, point: result.point}

                    }

                    if (agent instanceof Paddle) {
                        let pr = (agent.x - this.x) / agent.width
                        console.log("x hit paddle", pr)
                    }


                    dx = -dx
                    break

                }
            }
        }

        if (x + dx > view.width) {
            this.x = view.width
            this.dx = -Math.abs(dx/dt)

        } else if (x + dx < 0) {
            this.x = 0
            this.dx = Math.abs(dx/dt)

        } else {
            this.x = x + dx
            this.dx = dx/dt
        }


    }

    move_y(dt) {
        let y = this.y;
        let dy = this.dy*dt;

        const agents = gEngine.scene.agents
        const view = gEngine.view

        for (let agent of agents) {
            if (agent.solid) {
                const rect = agent.collisionRect();

                if (collision.point2rect(
                        this.x, y + dy,
                        rect.x, rect.y,
                        rect.width, rect.height)) {


                    const p1 = {x: this.x, y: y}
                    const p2 = {x: this.x, y: y + dy}
                    const ps = {x: this.x, y: y - dy}

                    const shape = agent.collisionShape()

                    const result = physics.intercept_shape(p1, p2, shape)
                    if (result !== null) {
                        if (agent instanceof Brick) {
                            agent.decrementHealth()
                        }
                        const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                        this.hit = {normal: n, tangent: result.tangent, point: result.point}

                    }

                    // if a collision from the top of the paddle
                    if (agent instanceof Paddle) {
                        if (agent.y > this.y) {
                            let pr = (this.x - agent.x) / agent.width
                            pr += 0.5
                            pr = Math.max(0.0, Math.min(1.0, pr))

                            let v1,v2,dx3,dy3;
                            v1 = {x: this.dx, y:this.dy}
                            if (pr < 0.3) {
                                pr = 1.0 - (pr / 0.3)
                                v2 = {x: -this.basespeed, y:this.basespeed}
                                console.log("y hit paddle <", pr)

                                dx3 = pr*v2.x + (1-pr)*v1.x
                                dy3 = pr*v2.y + (1-pr)*v1.y
                                dy = dy3*dt
                                this.dx = dx3
                            } else if (pr > 0.7) {
                                pr = (pr - 0.7) / 0.3
                                v2 = {x: this.basespeed, y:this.basespeed}
                                console.log("y hit paddle >", pr)

                                dx3 = pr*v2.x + (1-pr)*v1.x
                                dy3 = pr*v2.y + (1-pr)*v1.y
                                dy = dy3*dt
                                this.dx = dx3
                            }


                        }
                    }

                    dy = -dy
                    break
                }
            }
        }

        if (y + dy > view.height) {
            this.y = view.height
            this.dy = -Math.abs(dy/dt)

        } else if (y + dy < 0) {
            this.y = 0
            this.dy = Math.abs(dy/dt)
        } else {
            this.y = y + dy
            this.dy = dy/dt
        }
    }

    paint(ctx) {

        for (let i=this.trail.length-1; i >= 0; i--) {
            ctx.beginPath();
            // this.radius - (this.trail.length-i)/3
            ctx.arc(this.trail[i].x, this.trail[i].y, this.radius - (this.trail.length-i)/4, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = `rgba(0,0,255, ${(1+i)/this.trail.length/4})`;
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        if (this.hit !== null) {

            const p = this.hit.point;
            const tangent = this.hit.tangent;
            const normal = this.hit.normal;

            if (tangent.length == 2) {

                // find the width of a line segment centered at a point
                // sqrt((x2 - x1)^2 + (y2 - y1)^2) = len
                // sqrt((x2 - x1)^2 + ((mx2+b) - (mx1+b))^2) = len
                // sqrt(((x0+w) - (x0-w))^2 + ((m(x0+w)+b) - (m(x0-w)+b))^2) = len
                // ((x0+w) - (x0-w))^2 + ((m(x0+w)+b) - (m(x0-w)+b))^2 = len^2
                // (2w)^2 + (2mw)^2 = len^2
                // 4w^2 + 4m^2w^2 = len^2
                // w^2(4 + 4m^2) = len^2
                // w^2 = len^2 / (4 + 4m^2)
                const len = 100
                const w = Math.sqrt((len * len) / (4 + 4 * tangent[0] * tangent[0]))

                const xt1 = p.x - w
                const xt2 = p.x + w
                const yt1 = tangent[0] * xt1 + tangent[1]
                const yt2 = tangent[0] * xt2 + tangent[1]
                ctx.beginPath();
                ctx.moveTo(xt1, yt1);
                ctx.lineTo(xt2, yt2);
                ctx.closePath();
                ctx.lineWidth  = 2;
                ctx.strokeStyle = 'orange';
                ctx.stroke()
            } else {
                const xt1 = tangent[0]
                const xt2 = tangent[0]
                const yt1 = p.y - 50
                const yt2 = p.y + 50
                ctx.beginPath();
                ctx.moveTo(xt1, yt1);
                ctx.lineTo(xt2, yt2);
                ctx.closePath();
                ctx.lineWidth  = 2;
                ctx.strokeStyle = 'orange';
                ctx.stroke()

            }

            const xn1 = p.x
            const xn2 = p.x + 50 * normal[0]
            const yn1 = p.y
            const yn2 = p.y + 50 * normal[1]

            ctx.beginPath();
            ctx.moveTo(xn1, yn1);
            ctx.lineTo(xn2, yn2);
            ctx.closePath();
            ctx.lineWidth  = 2;
            ctx.strokeStyle = 'red';
            ctx.stroke()

        }

    }

}

class Paddle extends Agent {

    constructor() {
        super();
        this.solid = true;
        this.radius = 5;
        this.color = 'blue'

        this.x = 100
        this.y = 100
        this.xp = 100
        this.dx = 0

        this.width = 100
        this.height = this.radius * 2

        this.touch = null
    }

    handleTouches(touches) {

        if (touches.length > 0) {
            this.touch = touches[0]
        } else {
            this.touch = null
        }
    }

    update(dt) {

        const view = gEngine.view
        // factor controls how quickly the paddle tracks mouse movement
        // a factor of 1 means the paddle tracks the mouse
        // a larger factor will more quickly move to cover the board
        const factor = 1.5
        if (this.touch !== null) {
            let x =  (view.width/2) + factor*(this.touch.x - view.width/2)
            x = Math.min(view.width - this.width/2, x)
            x = Math.max(this.width/2, x)

            this.dx = (x - this.xp) * .75 + (this.dx * .25)
            this.xp = this.x
            this.x = x
        }

    }

    paint(ctx) {
        ctx.beginPath();
        ctx.arc(this.x - this.width/2, this.y, this.radius, 0, Math.PI * 2, true);
        ctx.arc(this.x + this.width/2, this.y, this.radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillRect(this.x - this.width / 2, this.y - this.radius,
                          this.width, 2 * this.radius)

        //const rect = this.collisionRect()
        //ctx.fillStyle = 'rgba(255, 0, 0, .5)'
        //ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    }

    collisionRect() {

        return {
            x: this.x - this.radius - this.width*.5,
            y: this.y - this.radius,
            width: this.width + this.radius * 2,
            height: this.radius * 2,
        }
    }

}

const brick_color = [
 "#EE0000", // red
 "#FF9500", // orange
 "#EEEE00", // yellow
 "#008000", // green
 "#00BBBB", // cyan
 "#0000BB", // blue
 "#800080", // violet
 "#DDDDDD", // white
 "#C0C0C0", // silver
 "#17202a", // charcoal
]

class Brick extends Agent {
    constructor(x, y, width, height) {
        super();
        this.solid = true;
        this.color = null
        this.x = x
        this.y = y
        this.width = width
        this.height = height
        this.health = 3
    }

    update(dt) {

    }

    paint(ctx) {

        const thickness = 2
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        ctx.fillStyle = this.color ?? brick_color[this.health-1];
        ctx.fillRect(this.x - this.width/2 + thickness,
                          this.y - this.height/2 + thickness,
                          this.width - 2 * thickness,
                          this.height - 2 * thickness);
    }

    decrementHealth() {
        this.health -= 1;

        if (this.health <= 0) {
            this.destroy = true
        }

        return this.health;
    }

    collisionRect() {

        return {
            x: this.x - this.width/2,
            y: this.y - this.height/2,
            width: this.width,
            height: this.height,
        }
    }
}

class BrickShape extends Agent {
    constructor(x, y, radius) {
        super();
        this.solid = true;
        this.x = x
        this.y = y
        this.health = 99
        this.layer = 99

        //this.shape = [
        //    {type: "line", p1: {x: 0, y: 0}, p2: {x: 10, y: -10}}, // top left
        //    {type: "line", p1: {x: 10, y: -10}, p2: {x: 20, y: 0}}, // top right
        //    {type: "line", p1: {x: 20, y: 0}, p2: {x: 10, y: 10}}, // bottom right
        //    {type: "line", p1: {x: 10, y: 10}, p2: {x: 0, y: 0}}, // bottom left
        //]

        this.shape = [
            {type: "circle", center: {x: 0, y: 0}, radius: radius}, // top left
        ]

        this.rect = this.getCollisionRectTemplate()
        this.width = this.rect.width
        this.width = this.rect.height

    }

    draw(view) {


        const rect = this.collisionRect()
        view.ctx.fillStyle = 'red'
        //view.ctx.fillRect(rect.x, rect.y, rect.width, rect.height)


        view.ctx.strokeStyle = '#000033'
        view.ctx.fillStyle = '#0000AA'

        this.shape.forEach(segment => {
            switch (segment.type) {
                case 'line':
                    view.ctx.beginPath()
                    view.ctx.moveTo(this.x + segment.p1.x, this.y + segment.p1.y)
                    view.ctx.lineTo(this.x + segment.p2.x, this.y + segment.p2.y)
                    view.ctx.stroke();
                    break;
                case 'curve':
                    break;
                case 'circle':
                    view.ctx.beginPath()
                    view.ctx.arc(this.x + segment.center.x,
                                 this.y + segment.center.y,
                                 segment.radius, 0, 2 * Math.PI);
                    view.ctx.stroke();
                    view.ctx.beginPath()
                    view.ctx.arc(this.x + segment.center.x,
                                 this.y + segment.center.y,
                                 segment.radius, 0, 2 * Math.PI);
                    view.ctx.fill();
                    break;
            }
        })


    }

    getCollisionRectTemplate() {

        const shape = this.collisionShape()
        let left=Number.MAX_VALUE,
            right=Number.MIN_VALUE,
            top=Number.MAX_VALUE,
            bottom=Number.MIN_VALUE;

        this.shape.forEach(segment => {

            switch (segment.type) {
                case 'line':
                    if (segment.p1.x < left) { left = segment.p1.x }
                    if (segment.p2.x < left) { left = segment.p2.x }

                    if (segment.p1.x > right) { right = segment.p1.x }
                    if (segment.p2.x > right) { right = segment.p2.x }

                    if (segment.p1.y < top) { top = segment.p1.y }
                    if (segment.p2.y < top) { top = segment.p2.y }

                    if (segment.p1.y > bottom) { bottom = segment.p1.y }
                    if (segment.p2.y > bottom) { bottom = segment.p2.y }

                    break;
                case 'curve':
                    break;
                case 'circle':
                    segment.center.x - segment.radius
                    if (segment.center.x - segment.radius < left) { left = segment.center.x - segment.radius }
                    if (segment.center.x + segment.radius > right) { right = segment.center.x + segment.radius }

                    if (segment.center.y - segment.radius < top) { top = segment.center.y - segment.radius }
                    if (segment.center.y + segment.radius > bottom) { bottom = segment.center.y + segment.radius }

                    break;
            }
        })

        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        }
    }

    collisionRect() {

        return {
            x: this.x + this.rect.x,
            y: this.y + this.rect.y,
            width: this.rect.width,
            height: this.rect.height,
        }
    }

    collisionShape() {

        const shape = this.shape.map(segment => {
            switch (segment.type) {
                case 'line':
                    return {
                        type: "line",
                        p1: {x: this.x + segment.p1.x, y: this.y + segment.p1.y},
                        p2: {x: this.x + segment.p2.x, y: this.y + segment.p2.y}
                    }
                case 'curve':
                    break;
                case 'circle':
                    return {
                        type: "circle",
                        center: {x: this.x + segment.center.x, y: this.y + segment.center.y},
                        radius: segment.radius,
                    }
                    break;
            }
        })


        return shape;
    }
}


class BreakoutScene extends GameScene {

    constructor() {
        super()

        this.agents = []

        console.log("init scene")
        this.initGame()
    }
    handleTouches(touches) {
        if (!!this.paddle) {
            this.paddle.handleTouches(touches)
        }
    }

    resize() {
        console.log("Resize?")
    }

    update(dt) {

        for (let i = this.agents.length - 1; i >= 0; i--) {
            const agent = this.agents[i]
            agent.update(dt)
            if (!!agent.destroy) {
                this.agents.splice(i, 1)
            }
        }
        this.agents.forEach(agent => {
            agent.update(dt)
        })

    }

    paint(ctx) {

        ctx.strokeStyle="#FF0000"
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        const cmp = (a, b) => (a.layer - b.layer) || (a.y - b.y) || (a.x - b.x)
        this.agents.sort(cmp).forEach(agent => {
            if (agent.visible) {
                agent.paint(ctx)
            }
        })

    }

    initGame() {

        const nbricks = 15
        const width = gEngine.view.width
        const height = gEngine.view.height

        let template = [
            "     ###       ###     ",
            "    #...#     #...#    ",
            "   #..#..#ggg#..#..#   ",
            "  gg#...#ggggg#...#gg  ",
            " gggg###ggggggg###gggg ",
            "ggggggggggggggggggggggg",
            "ggggggggggggggggggggggg",
            "gggggggg##ggg##gggggggg",
            "gggggggg##ggg##gggggggg",
            "ggggggggggggggggggggggg",
            "ggg##ggggggggggggg##ggg",
            "ggggg#############ggggg",
            "  ggggggggggggggggggg  ",
            "  ggggggggggggggggggg  ",
            "     ggggggggggggg     ",
            "     ggggggggggggg     ",
        ]

        let brwidth = Math.floor((width - 16) / template[0].length)
        let brheight = brwidth

        console.log("x", width, template[0].length, brwidth)
        console.log("x", Math.floor((width - template[0].length*brwidth)/2))
        for (let j=0; j < template.length; j++) {

            let row = template[j]
            let x1 = Math.floor((width - (row.length-1)*brwidth)/2)
            let y1 = Math.floor(height/6 + j*brheight)
            for (let i = 0; i < row.length; i++) {
                if (row[i] === " ") {
                    continue
                }

                const brick = new Brick(x1 + i*brwidth, y1, brwidth, brheight)

                if (row[i] == "#") {
                    brick.health = 1
                    brick.color = '#222222'
                }

                if (row[i] == ".") {
                    brick.health = 1
                    brick.color = '#CCCCCC'
                }

                if (row[i] == "g") {
                    brick.health = 1
                    brick.color = '#33AA33'
                }

                this.agents.push(brick);
            }
        }



        this.paddle = new Paddle()
        this.paddle.y = Math.floor(height*4/5)
        this.paddle.x = width/2 - this.paddle.width/2
        this.agents.push(this.paddle)

        this.ball = new Ball()
        this.ball.x = this.paddle.x + this.paddle.width/2
        this.ball.y = this.paddle.y - 32
        this.agents.push(this.ball)
    }
}

export default class Application extends DomElement {
    constructor() {

        super("div", {className: style.main}, [])

        const body = document.getElementsByTagName("BODY")[0];
        body.className = style.body

        console.log("build app")

    }

    elementMounted() {

        this.canvas = this.appendChild(new CanvasEngine(
            window.innerWidth, window.innerHeight, {portrait: 1}))

        window.gEngine = this.canvas

        this.canvas.onReady = () => {
            this.canvas.scene = new BreakoutScene();
            console.log("scene created")
        }

        window.addEventListener("keydown", this.canvas.handleKeyPress.bind(this.canvas))
        window.addEventListener("keyup", this.canvas.handleKeyRelease.bind(this.canvas))
        window.addEventListener("resize", this.handleResize.bind(this))

    }

    handleResize() {
        const canvas = this.canvas.getDomNode()
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        this.canvas.handleResize(window.innerWidth, window.innerHeight)
    }
}
