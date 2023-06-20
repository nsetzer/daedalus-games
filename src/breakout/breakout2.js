
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
    // test a point is in a rec
    point2rect: function(px, py, tx, ty, tw, th) {
        return px < tx + tw && // right
               px > tx &&      // left
               py < ty + th && // bottom
               py > ty;        // top
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
        this.trail_size = 20
        this.trail_timer = 0
        this.trail_timeout = 1/this.trail_size
        this.trail = []

        this.bounces = 0
        this.particles = []

        this.health = 1
        this.destroy = 0

        this.last_hit_object = null

        this.hit = null
    }

    update(dt) {

        this.move_xy(dt)

        this.trail_timer += dt
        if (this.trail_timer > this.trail_timeout) {
            this.trail_timer -= this.trail_timeout
            this.trail.push({x:this.x, y:this.y})
            if (this.trail.length > this.trail_size) {
                this.trail.shift()
            }
        }


    }

    move_xy(dt) {

        let currx = this.x
        let curry = this.y
        let stepx = this.x + this.dx * dt
        let stepy = this.y + this.dy * dt
        // ideal previous position
        let prevx = this.x - this.dx * dt
        let prevy = this.y - this.dy * dt

        const agents = gEngine.scene.agents
        const view = gEngine.view

        let hits = []

        for (let agent of agents) {
            if (agent.solid) {
                const rect = agent.collisionRect();

                if (collision.point2rect(
                        stepx, stepy,
                        rect.x, rect.y,
                        rect.width, rect.height)) {

                    const p1 = {x: currx, y: curry}
                    const p2 = {x: stepx, y: stepy}
                    const ps = {x: prevx, y: prevy}

                    const shape = agent.collisionShape()

                    const result = physics.intercept_shape(p1, p2, shape)
                    if (result !== null) {
                        if (agent instanceof Brick) {
                            agent.decrementHealth()
                        }
                        if (agent instanceof BrickShape) {
                            agent.decrementHealth()
                        }
                        const normal = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);

                        let m = Math.sqrt(this.dx*this.dx + this.dy*this.dy)
                        let ov = [this.dx/m, this.dy/m]
                        let nv = physics.reflect2(normal, ov)

                        hits.push({
                            agent: agent,
                            normal: normal,
                            tangent: result.tangent,
                            original_direction: ov,
                            new_direction: nv,
                            point: result.point,
                        })

                    } else {
                        continue
                    }



                    this.dy = -this.dy
                    break
                }
            }
        }

        // check hits
        /*
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
        */
        let bounced = false

        if (hits.length > 0) {
            // dont yet know what to do
            if (hits.length > 1) {
                throw hits
            }
            this.hit = hits[0]
            if (this.last_hit_object === this.hit.agent &&
                this.last_hit_object === gEngine.scene.paddle) {
                console.log("double hit")
            } else if (this.hit.agent === gEngine.scene.paddle) {

                let pr = (this.hit.point.x - this.hit.agent.x) / this.hit.agent.width
                pr += 0.5
                pr = Math.max(0.0, Math.min(1.0, pr))


                let angle = 90
                if (pr < 0.3) {
                    pr = 1.0 - (pr / 0.3)
                    angle = 90 + 90*pr
                    //let vec = physics.vec2component(-angle, 1)
                    //this.hit.normal = [vec.x, vec.y]
                    //this.hit.new_direction = physics.reflect2(this.hit.normal, this.hit.original_direction)
                    //if (this.hit.new_direction[1] > 0) {
                    //    this.hit.new_direction[1] *= -1
                    //}
                } else if (pr > 0.7) {
                    pr = (pr - 0.7) / 0.3
                    angle = 90 - 90*pr
                    //let vec = physics.vec2component(-angle, 1)
                    //this.hit.normal = [vec.x, vec.y]
                    //this.hit.new_direction = physics.reflect2(this.hit.normal, this.hit.original_direction)
                    //if (this.hit.new_direction[1] > 0) {
                    //    this.hit.new_direction[1] *= -1
                    //}
                }

                // if the ball would be reflected up
                // blend the angle based on where it hit the paddle
                if (this.hit.new_direction[1] < 0) {

                    let new_vec = physics.component2vec(this.hit.new_direction[0], this.hit.new_direction[1])
                    angle = (angle + new_vec.degrees) / 2
                    let vec = physics.vec2component(angle, 1)
                    this.hit.new_direction = [vec.x, vec.y]
                    //console.log(angle, new_vec.degrees, this.hit)
                } else {

                    //console.log(pr, angle, physics.vec2component(angle, 1), this.hit)
                }

                stepx = this.hit.point[0]
                stepy = this.hit.point[1]
                this.dx = this.hit.new_direction[0] * this.basespeed
                this.dy = this.hit.new_direction[1] * this.basespeed


                this.bounces = 0

            } else {
                //console.log(this.hit)
                stepx = this.hit.point.x
                stepy = this.hit.point.y
                this.dx = this.hit.new_direction[0] * this.basespeed
                this.dy = this.hit.new_direction[1] * this.basespeed
                this.bounces += 1
                bounced = true
            }

            this.last_hit_object = this.hit.agent
            //this.health -= 1
            if (this.health <= 0) {
                gEngine.scene.resetBall()
                return
            }

        }

        // bounds check

        if (stepx > view.width) {
            this.currx = view.width
            this.dx = -Math.abs(this.dx)
            this.bounces += 1
            bounced = true

        } else if (stepx < 0) {
            this.x = 0
            this.dx = Math.abs(this.dx)
            this.bounces += 1
            bounced = true

        }

        if (stepy > view.height) {
            this.y = view.height
            this.dy = -Math.abs(this.dy)
            this.bounces += 1
            bounced = true

        } else if (stepy < 0) {
            this.y = 0
            this.dy = Math.abs(this.dy)
            this.bounces += 1
            bounced = true
        }

        this.x = this.x + this.dx * dt
        this.y = this.y + this.dy * dt

        // if it bounced nudge the ball back to a 45 degree angle
        if(bounced) {
            let vec1 = physics.component2vec(Math.sign(this.dx), Math.sign(this.dy))
            let vec2 = physics.component2vec(this.dx, this.dy)
            let degrees = vec1.degrees*0.02 + vec2.degrees*.98
            let d = physics.vec2component(degrees, this.basespeed)
            //console.log(vec2.degrees, vec1.degrees, degrees)
            this.dx = d.x
            this.dy = d.y
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

            let xn1 = p.x
            let xn2 = p.x + 50 * normal[0]
            let yn1 = p.y
            let yn2 = p.y + 50 * normal[1]

            ctx.beginPath();
            ctx.moveTo(xn1, yn1);
            ctx.lineTo(xn2, yn2);
            ctx.closePath();
            ctx.lineWidth  = 2;
            ctx.strokeStyle = 'red';
            ctx.stroke()

            let ov = this.hit.original_direction

            // paint the inverse original direction vector
            xn1 = p.x
            xn2 = p.x - 30 * ov[0]
            yn1 = p.y
            yn2 = p.y - 30 * ov[1]

            ctx.beginPath();
            ctx.moveTo(xn1, yn1);
            ctx.lineTo(xn2, yn2);
            ctx.closePath();
            ctx.lineWidth  = 2;
            ctx.strokeStyle = 'blue';
            ctx.stroke()

            let nv = this.hit.new_direction

            xn1 = p.x
            xn2 = p.x + 30 * nv[0]
            yn1 = p.y
            yn2 = p.y + 30 * nv[1]

            ctx.beginPath();
            ctx.moveTo(xn1, yn1);
            ctx.lineTo(xn2, yn2);
            ctx.closePath();
            ctx.lineWidth  = 2;
            ctx.strokeStyle = 'purple';
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

        ctx.beginPath();
        ctx.strokeStyle = "#000000"
        ctx.moveTo(this.x - this.width*.2, this.y - this.radius)
        ctx.lineTo(this.x - this.width*.2, this.y + this.radius)
        ctx.stroke()

        ctx.beginPath();
        ctx.strokeStyle = "#000000"
        ctx.moveTo(this.x + this.width*.2, this.y - this.radius)
        ctx.lineTo(this.x + this.width*.2, this.y + this.radius)
        ctx.stroke()

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
    constructor(x, y) {
        super();
        this.solid = true;
        this.x = x
        this.y = y
        this.health = 1
        this.layer = 99

    }

    decrementHealth() {
        this.health -= 1;

        if (this.health <= 0) {
            this.destroy = true
        }
        console.log(this.health, this.destroy)
        return this.health;
    }

    update(dt) {

    }

    trace(ctx) {
        this.shape.forEach(segment => {
            switch (segment.type) {
                case 'line':
                    ctx.lineTo(this.x + segment.p2.x, this.y + segment.p2.y)
                    break;
                case 'arc':
                    ctx.arc(this.x + segment.center.x,
                            this.y + segment.center.y,
                                 segment.radius,
                                 segment.angle1,
                                 segment.angle2,
                                 segment.angle1 > segment.angle2);


                    //ctx.lineWidth = 2
                    //ctx.beginPath()
                    //ctx.arc(this.x + segment.center.x,
                    //        this.y + segment.center.y,
                    //        segment.radius,
                    //        0, 2 * Math.PI);
                    //ctx.stroke();
                    break;
                case 'curve':
                    break;
                case 'circle':
                    ctx.arc(this.x + segment.center.x,
                                 this.y + segment.center.y,
                                 segment.radius, 0, 2 * Math.PI);
                    ctx.stroke();
                    break;
            }
        })
    }
    paint(ctx) {


        const rect = this.collisionRect()
        ctx.fillStyle = '#FF00007F'

        //ctx.fillRect(rect.x, rect.y, rect.width, rect.height)


        ctx.strokeStyle = '#000033'
        ctx.fillStyle = this.color ?? brick_color[this.health-1];

        ctx.beginPath()
        ctx.lineWidth = 3
        this.trace(ctx)
        ctx.stroke()
        ctx.fill()

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
                case 'arc':
                    return {
                        type: "arc",
                        center: {x: this.x + segment.center.x, y: this.y + segment.center.y},
                        radius: segment.radius,
                        angle1: segment.angle1,
                        angle2: segment.angle2,
                    };
                case 'curve':
                    break;
                case 'circle':
                    return {
                        type: "circle",
                        center: {x: this.x + segment.center.x, y: this.y + segment.center.y},
                        radius: segment.radius,
                    }
            }
        })


        return shape;
    }
}

function BrickShapeDiamond(x, y) {

    let brick = new BrickShape(x, y)
    brick.shape = [
        {type: "line", p1: {x: 0, y: 0}, p2: {x: 10, y: -10}}, // top left
        {type: "line", p1: {x: 10, y: -10}, p2: {x: 20, y: 0}}, // top right
        {type: "line", p1: {x: 20, y: 0}, p2: {x: 10, y: 10}}, // bottom right
        {type: "line", p1: {x: 10, y: 10}, p2: {x: 0, y: 0}}, // bottom left
    ]

    brick.rect = brick.getCollisionRectTemplate()
    brick.width = brick.rect.width
    brick.width = brick.rect.height

    return brick
}

function BrickShapeCircle(x, y, radius) {

    let brick = new BrickShape(x, y)
    brick.shape = [
        {type: "circle", center: {x: 0, y: 0}, radius: radius},
    ]

    brick.rect = brick.getCollisionRectTemplate()
    brick.width = brick.rect.width
    brick.width = brick.rect.height

    return brick
}

function BrickShapeArc(x, y, r1, r2, a1, a2) {

    let brick = new BrickShape(x, y)

    a1 = a1 / 180 * Math.PI
    a2 = a2 / 180 * Math.PI

    let x1 = r1 * Math.cos(a1)
    let y1 = r1 * Math.sin(a1)

    let x2 = r2 * Math.cos(a1)
    let y2 = r2 * Math.sin(a1)

    let x3 = r2 * Math.cos(a2)
    let y3 = r2 * Math.sin(a2)

    let x4 = r1 * Math.cos(a2)
    let y4 = r1 * Math.sin(a2)

    brick.shape = [
        {type: "line", p1: {x: x1, y: y1}, p2: {x: x2, y: y2}},
        //{type: "line", p1: {x: x2, y: y2}, p2: {x: x3, y: y3}},
        {type: "arc", center: {x: 0, y: 0}, radius: r2, angle1:a1, angle2:a2},
        {type: "line", p1: {x: x3, y: y3}, p2: {x: x4, y: y4}},
        //{type: "line", p1: {x: x4, y: y4}, p2: {x: x1, y: y1}},
        {type: "arc", center: {x: 0, y: 0}, radius: r1, angle1:a2, angle2:a1},
        //{type: "line", p1: {x: x4, y: y4}, p2: {x: x1, y: y1}},
    ]


    brick.rect = brick.getCollisionRectTemplate()
    brick.width = brick.rect.width
    brick.width = brick.rect.height
    brick.health = 1

    return brick

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

    handleKeyRelease(kc) {
        if (this.ball.health <= 0) {
            this.ball.health = 2
            //this.ball.dx = 0
            //this.ball.dy = -this.ball.basespeed
            this.ball.dx = this.ball.basespeed * .7071
            this.ball.dy = -this.ball.basespeed * .7071
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

        if (this.ball.health <= 0) {
            this.resetBall()
        }

    }

    paint(ctx) {

        const ball = this.ball
        ctx.fillStyle="yellow"
        ctx.font = '24px sans-serif';
        let vec = physics.component2vec(ball.dx, ball.dy)
        //ctx.fillText(`ball (${ball.dx.toFixed(1)},${ball.dy.toFixed(1)}) `, 0, 36)
        ctx.fillText(`ball (${vec.degrees.toFixed(1)},${vec.magnitude.toFixed(1)}) ${ball.bounces}`, 36, 36)


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

    resetBall() {
        this.ball.x = this.paddle.x
        this.ball.y = this.paddle.y - 32
        this.ball.dx = 0
        this.ball.dy = 0
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

        let brwidth = Math.floor((width - 48) / template[0].length)
        let brheight = brwidth

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
        this.ball.health = 0
        //this.ball.dx = 120
        //this.ball.dy = 0
        this.ball.dx = this.ball.basespeed * .7071
        this.ball.dy = -this.ball.basespeed * .7071
        this.agents.push(this.ball)

        this.agents.push(new BrickShapeDiamond(this.paddle.x-50, this.paddle.y - 100))
        this.agents.push(new BrickShapeCircle(this.paddle.x, this.paddle.y - 100, 16))

        let cx = this.paddle.x + 50
        let cy = this.paddle.y - 100
        let r1 = 12
        let r2 = 24
        let r3 = 36

        this.agents.push(new BrickShapeCircle(cx, cy, r1))
        this.agents[this.agents.length-1].color = '#555555'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r1, r2,
            1, 89,
            ))
        this.agents[this.agents.length-1].color = 'white'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r1, r2,
            91, 179,
            ))
        this.agents[this.agents.length-1].color = 'white'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r1, r2,
            181, 269,
            ))
        this.agents[this.agents.length-1].color = 'white'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r1, r2,
            271, 359,
            ))
        this.agents[this.agents.length-1].color = 'white'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r2, r3,
            46, 134,
            ))
        this.agents[this.agents.length-1].color = '#555555'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r2, r3,
            136, 224,
            ))
        this.agents[this.agents.length-1].color = '#555555'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r2, r3,
            226, 314,
            ))
        this.agents[this.agents.length-1].color = '#555555'

        this.agents.push(new BrickShapeArc(
            cx, cy
            r2, r3,
            316, 404,
            ))
        this.agents[this.agents.length-1].color = '#555555'

        //for (let i=0; i < 15; i ++) {
        //    let xs = this.attrs.view.width/2 + (.5 - Math.random()) * this.attrs.view.width
        //    let ys = this.attrs.view.paddle.y + Math.random() * 200
        //    let b = new BrickShape(xs, ys, 10 + 10 * Math.random())
        //    this.attrs.view.agents.push(b)
        //}


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
