/*
daedalus fixes:
    switch(segment.type){
        case"line":x=intercept_line(p1,p2,segment.p1,segment.p2);
        console.log("shape-line",index,x);
        return x;
        case"curve":x=intercept_curve(p1,p2,segment.curve,segment.interval);
        console.log("shape-curve",index,x);
        return x;
        case"circle":x=intercept_circle(p1,p2,segment.center,segment.radius);

        console.log("shape-circle",index,x);
        return x;
        default:return null;
      }
*/


// the biggest physics bugs are :
// sometimes the tangent vector of a circle points towards the center
// perfectly cliping the edge of a rect
// shapes must be composed of entities with a volume, no lines or curves
// rect, quad, circle, ellipse instead. this is so that an isSolid(x,y)
// api can be written
//
// Notes on fixing physics
//   - allow partial updats for fast moving entities
//     e.g. update step is 1 frame, but call update twice with 1/2 frame
//   - move in the x direction first, test collision
//     then move in the y direction, test collision
from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, NumberInputElement, LinkElement
}

import module physics.js

const style = {
    canvas: StyleSheet({
        //'border': {style: 'solid', color: 'black'}
        'margin-left': auto,
        'margin-right': auto
    }),
}


// increase paddle width
// decrease paddle width
// ball capture
// multi ball
// paddle missle
// ball size +
// ball size -
// paddle bump +/-

// stages:
// normal
// duel paddle (top and bottom)
// rifle - click to shoot ten balls
// spread gun - shoot ten balls in an arc
// machine gun (no paddle)

// on mouse press/release set flags to be processed  by next frame
// clear the flags when the subsequent frame is done

// https://www.gamasutra.com/view/feature/1630/breaking_down_breakout_system_and_.php?print=1


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

    update() {

    }

    draw(ctx) {

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
        this.dx = 3;
        this.dy = 5;
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

    update(view) {

        this.move_x(view)
        this.move_y(view)

        this.trail.push({x:this.x, y:this.y})
        if (this.trail.length > 5) {
            this.trail.shift()
        }

    }

    move_x(view) {

        let x = this.x;
        let dx = this.dx;

        for (let agent of view.agents) {
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

                    /*
                    if (result !== null) {
                        const v = physics.compute_vector(p1, p2);
                        const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                        const vp = physics.reflect(v, n)
                        //this.hit = {normal: n, tangent: result.tangent, point: result.point}

                        x = result.point.x
                        dx = vp[0]

                        break;
                    }
                    */


                    //if (result != null && result.type == "circle") {
                    if (false) {

                        const v = physics.compute_vector(p1, p2);
                        const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                        const vp = physics.reflect(v, n)
                        this.hit = {normal: n, tangent: result.tangent, point: result.point}

                        this.x = result.point.x
                        this.y = result.point.y
                        this.dx = vp[0]
                        this.dy = vp[1]

                        break
                    } else {

                        const result = physics.intercept_shape(p1, p2, shape)
                        if (result !== null) {
                            const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                            this.hit = {normal: n, tangent: result.tangent, point: result.point}
                        }

                        dx = -dx
                        break
                    }

                }
            }
        }

        if (x + dx > view.width) {
            this.x = view.width
            this.dx = -Math.abs(dx)

        } else if (x + dx < 0) {
            this.x = 0
            this.dx = Math.abs(dx)

        } else {
            this.x = x + dx
            this.dx = dx
        }


    }

    move_y(view) {
        let y = this.y;
        let dy = this.dy;

        for (let agent of view.agents) {
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

                    /*
                    if (result !== null) {
                        const v = physics.compute_vector(p1, p2);
                        const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                        const vp = physics.reflect(v, n)
                        //this.hit = {normal: n, tangent: result.tangent, point: result.point}

                        y = result.point.y
                        dy = vp[1]

                        break;
                    }
                    */

                    //if (result != null && result.type == "circle") {
                    if (false) {

                        const v = physics.compute_vector(p1, p2);
                        const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                        const vp = physics.reflect(v, n)
                        this.hit = {normal: n, tangent: result.tangent, point: result.point}

                        this.x = result.point.x
                        this.y = result.point.y
                        this.dx = vp[0]
                        this.dy = vp[1]

                        break

                    } else {

                        const result = physics.intercept_shape(p1, p2, shape)
                        if (result !== null) {
                            const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                            this.hit = {normal: n, tangent: result.tangent, point: result.point}
                        }

                        dy = -dy
                        break
                    }

                }
            }
        }

        if (y + dy > view.height) {
            this.y = view.height
            this.dy = -Math.abs(dy)

        } else if (y + dy < 0) {
            this.y = 0
            this.dy = Math.abs(dy)
        } else {
            this.y = y + dy
            this.dy = dy
        }
    }

    old_update(view) {

        view.agents.forEach(agent => {
            if (agent.solid) {
                const rect = agent.collisionRect();
                if (collision.point2rect(this.x + this.dx, this.y + this.dy,
                    rect.x, rect.y, rect.width, rect.height)) {

                    const shape = agent.collisionShape()

                    //const vectors = [{dx: this.dx, dy: 0}, {dx: 0, dy: this.dy}]
                    const vectors = [{dx: this.dx, dy: this.dy},]

                    // use reflect to compute new dx,dy from old {dx,dy}
                    // but move the ball in x first then y

                    for (let vec of vectors) {
                        //console.log(vec)
                        const p1 = {x: this.x, y: this.y}
                        const p2 = {x: this.x + vec.dx, y: this.y + vec.dy}
                        const ps = {x: this.x - vec.dx, y: this.y - vec.dy}

                        const result = physics.intercept_shape(p1, p2, shape)

                        if (result !== null) {

                            const v = physics.compute_vector(p1, p2);
                            const n = physics.compute_normal(ps, result.point.x, result.point.y, result.tangent);
                            const vp = physics.reflect(v, n)
                            this.hit = {normal: n, tangent: result.tangent, point: result.point}

                            this.x = result.point.x
                            this.y = result.point.y
                            this.dx = vp[0]
                            this.dy = vp[1]

                            if (agent instanceof Paddle) {
                                //console.log("c", ps, result.point.x, result.point.y,  result.tangent)
                                //console.log("v", v)
                                //console.log("n", n)
                                //console.log("vp", vp)
                                this.dx += agent.dx * .1
                            }

                            if (agent instanceof Brick) {
                                agent.decrementHealth()
                            }

                        }

                    }

                }
            }
        })


        // TODO: this physics is now worse than the other one
        // redo collisions and positioning after a hit
        if (this.x > view.width) {
            this.x = view.width
            this.dx = -Math.abs(this.dx)

        } else if (this.x < 0) {
            this.x = 0
            this.dx = Math.abs(this.dx)

        } else if (this.x + this.dx  > view.width || this.x + this.dx < 0) {
            this.dx = - this.dx
        }

        const top = 0 // this.height*.5
        if (this.y > view.height) {
            this.y = view.height
            this.dy = -Math.abs(this.dy)

        } else if (this.y < top) {
            this.y = top
            this.dy = Math.abs(this.dy)

        } else if (this.y + this.dy > view.height || this.y + this.dy < top) {
            this.dy = - this.dy
        }


        this.trail.push({x:this.x, y:this.y})
        if (this.trail.length > 5) {
            this.trail.shift()
        }
        this.x += this.dx;
        this.y += this.dy;
    }

    draw(view) {

        for (let i=this.trail.length-1; i >= 0; i--) {
            view.ctx.beginPath();
            // this.radius - (this.trail.length-i)/3
            view.ctx.arc(this.trail[i].x, this.trail[i].y, this.radius - (this.trail.length-i)/4, 0, Math.PI * 2, true);
            view.ctx.closePath();
            view.ctx.fillStyle = `rgba(0,0,255, ${(1+i)/this.trail.length/4})`;
            view.ctx.fill();
        }
        view.ctx.beginPath();
        view.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
        view.ctx.closePath();
        view.ctx.fillStyle = this.color;
        view.ctx.fill();

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
                view.ctx.beginPath();
                view.ctx.moveTo(xt1, yt1);
                view.ctx.lineTo(xt2, yt2);
                view.ctx.closePath();
                view.ctx.lineWidth  = 2;
                view.ctx.strokeStyle = 'orange';
                view.ctx.stroke()
            } else {
                const xt1 = tangent[0]
                const xt2 = tangent[0]
                const yt1 = p.y - 50
                const yt2 = p.y + 50
                view.ctx.beginPath();
                view.ctx.moveTo(xt1, yt1);
                view.ctx.lineTo(xt2, yt2);
                view.ctx.closePath();
                view.ctx.lineWidth  = 2;
                view.ctx.strokeStyle = 'orange';
                view.ctx.stroke()

            }

            const xn1 = p.x
            const xn2 = p.x + 50 * normal[0]
            const yn1 = p.y
            const yn2 = p.y + 50 * normal[1]

            view.ctx.beginPath();
            view.ctx.moveTo(xn1, yn1);
            view.ctx.lineTo(xn2, yn2);
            view.ctx.closePath();
            view.ctx.lineWidth  = 2;
            view.ctx.strokeStyle = 'red';
            view.ctx.stroke()

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
    }

    update(view) {


        // factor controls how quickly the paddle tracks mouse movement
        // a factor of 1 means the paddle tracks the mouse
        // a larger factor will more quickly move to cover the board
        const factor = 1.5
        let x =  (view.width/2) + factor*(view.mouseX - view.width/2)
        x = Math.min(view.width - this.width/2, x)
        x = Math.max(this.width/2, x)

        this.dx = (x - this.xp) * .75 + (this.dx * .25)
        this.xp = this.x
        this.x = x

    }

    draw(view) {
        view.ctx.beginPath();
        view.ctx.arc(this.x - this.width/2, this.y, this.radius, 0, Math.PI * 2, true);
        view.ctx.arc(this.x + this.width/2, this.y, this.radius, 0, Math.PI * 2, true);
        view.ctx.closePath();
        view.ctx.fillStyle = this.color;
        view.ctx.fill();
        view.ctx.fillRect(this.x - this.width / 2, this.y - this.radius,
                          this.width, 2 * this.radius)

        const rect = this.collisionRect()
        view.ctx.fillStyle = 'rgba(255, 0, 0, .5)'
        view.ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
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

class Cursor extends Agent {
    constructor() {
        super();
        this.color = 'red'
        this.radius = 5
        this.x = 100
        this.y = 100
    }

    draw(view) {
        view.ctx.beginPath();
        view.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
        view.ctx.closePath();
        view.ctx.fillStyle = this.color;
        view.ctx.fill();
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
        this.x = x
        this.y = y
        this.width = width
        this.height = height
        this.health = 3
    }

    draw(view) {

        const thickness = 2
        view.ctx.fillStyle = 'black';
        view.ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        view.ctx.fillStyle = brick_color[this.health-1];
        view.ctx.fillRect(this.x - this.width/2 + thickness,
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

class Canvas extends DomElement {
    constructor(width, height) {
        super("canvas", {
            width: width,
            height: height,
            className: style.canvas,
            tabIndex: 1  // enable keyboard focus
        }, [])

        this.lastTime = null
        this.paused = false
        this.delta_accum = 0

        this.attrs = {
            dom: null,
            ctx: null,
            frame: 0,
            pause: false,
        }
    }

    elementMounted() {


        this.initGame()

    }

    elementUnmounted() {
        this.attrs.dom = null
    }

    //onClick(event) {
    //    this.attrs.dom.focus()
    //}

    onMouseMove(event) {

        if (!this.attrs.ctx || this.attrs.pause) {
            return;
        }

        const rect = this.attrs.dom.getBoundingClientRect();

        this.attrs.view.cursor.x = event.clientX - rect.left - this.attrs.view.x
        this.attrs.view.cursor.y = event.clientY - rect.top - this.attrs.view.y

    }

    onTouchMove(event) {

        if (!this.attrs.ctx || this.attrs.pause) {
            return;
        }

        const rect = this.attrs.dom.getBoundingClientRect();

        const touch = event.touches[0]
        this.attrs.view.cursor.x = touch.clientX - rect.left - this.attrs.view.x
        this.attrs.view.cursor.y = touch.clientY - rect.top - this.attrs.view.y

    }

    onKeyDown(event) {

    }

    onKeyUp(event) {

        switch (event.keyCode) {
            case 0x20: // space
                this.togglePauseGame();
                break;
            case 0x25:
                console.log("left");
                break;
            case 0x26:
                console.log("up");
                break;
            case 0x27:
                console.log("right");
                break;
            case 0x28:
                console.log("down");
                break;
            case 0x51: // q
                this.attrs.view.paddle.width += 10
                break;
            case 0x57: // w
                this.attrs.view.paddle.width -= 10
                break;
            case 0x53: // s
                // !!this.attrs.ctx &&
                if (this.attrs.pause) {
                    window.requestAnimationFrame(this.renderFrame.bind(this));
                }
            default:
                console.log(event.keyCode);
                break;
        }
    }

    togglePauseGame() {
        this.attrs.pause = !this.attrs.pause

        if (this.attrs.ctx && !this.attrs.pause) {
            window.requestAnimationFrame(this.render.bind(this));
        }
    }

    initGame() {

        this.attrs.dom = this.getDomNode()
        this.attrs.ctx = this.attrs.dom.getContext('2d');

        const wbase = Math.floor(9 *(this.props.height / 16));

        const nbricks = 15
        let brwidth = Math.floor(wbase / nbricks);
        let brheight = Math.floor(brwidth / 2)

        const view_width = brwidth * nbricks - (nbricks)

        let x = this.props.width - view_width
        if (x < 0) {
            throw x
        }
        x = Math.floor(x / 2);

        this.attrs.view = {

            ctx: this.attrs.ctx,
            x: x,
            y: 0,
            width: view_width,
            height: this.props.height,
            frame: 0,
            agents: [],
            ball: new Ball(),
            cursor: new Cursor(),
            paddle: new Paddle(),
        }

        if (0) {
            const offset = Math.floor( 5 * brwidth + brwidth / 2)
            for (let j=0; j < 30; j++) {

                for (let i=0; i < 5; i++) {
                    // overlap each brick by one pixel to prevent teleporting balls
                    const brick = new Brick(offset + i * brwidth - i, 100 + brheight*j - j, brwidth, brheight)
                    brick.health = 1 + ((j * 15) + i) % 10
                    this.attrs.view.agents.push(brick);
                }
            }

            //const diamond = new BrickShape(this.attrs.view.paddle.x, this.attrs.view.paddle.y - 50)
            //this.attrs.view.agents.push(diamond)

            for (let i=0; i < 15; i ++) {
                let xs = this.attrs.view.width/2 + (.5 - Math.random()) * this.attrs.view.width
                let ys = this.attrs.view.paddle.y + Math.random() * 200
                let b = new BrickShape(xs, ys, 10 + 10 * Math.random())
                this.attrs.view.agents.push(b)
            }
        } else {
            // draw a frog

            let template = [
                "     ###       ###      ",
                "    #...#     #...#     ",
                "   #..#..#ggg#..#..#    ",
                "  gg#...#ggggg#...#gg   ",
                " gggg###ggggggg###gggg  ",
                "ggggggggggggggggggggggg ",
                "ggggggggggggggggggggggg ",
                "gggggggg##ggg##gggggggg ",
                "gggggggg##ggg##gggggggg ",
                "ggggggggggggggggggggggg ",
                "ggg##ggggggggggggg##ggg ",
                "ggggg#############ggggg ",
                "  ggggggggggggggggggg   ",
                "  ggggggggggggggggggg   ",
                "     ggggggggggggg      ",
                "     ggggggggggggg      ",
            ]

            brwidth = Math.floor((this.attrs.view.width - 16) / template[0].length)

            for (let j=0; j < template.length; j++) {

                let row = template[j]
                let x1 = Math.floor(this.attrs.view.width/2 - (row.length*brwidth)/2)
                let y1 = Math.floor(this.attrs.view.height/4 + j*brheight)
                for (let i = 0; i < row.length; i++) {
                    if (row[i] === " ") {
                        continue
                    }

                    const brick = new Brick(x1 + i*brwidth, y1, brwidth, brheight)

                    if (row[i] == "#") {
                        brick.health = 1
                    }

                    if (row[i] == ".") {
                        brick.health = 2
                    }

                    if (row[i] == "g") {
                        brick.health = 3
                    }

                    this.attrs.view.agents.push(brick);
                }

            }

            /*
            let cx1 = 1*this.attrs.view.width/3
            let cy1 = this.attrs.view.height/4
            let cx2 = 2*this.attrs.view.width/3
            let cy2 = this.attrs.view.height/4

            for (let i=0; i < 3; i++) {
                let a = new BrickShape(cx1, cy1, 10 * (3 - i))
                this.attrs.view.agents.push(a)
                let b = new BrickShape(cx2, cy2, 10 * (3 - i))
                this.attrs.view.agents.push(b)
            }

            let sx1 = cx1 + 30
            let sx2 = cx2 - 30
            let sw = cx2 - cx1

            for (let i=0; i < 3; i++) {
                const brick = new Brick(sx1+brwidth*i, cy1, brwidth, brheight)
                brick.health = 2
                this.attrs.view.agents.push(brick);
            }
            */



        }


       //this.attrs.view.ball.x = 100
       //this.attrs.view.ball.y = this.attrs.view.height / 4
       //this.attrs.view.ball.dx = 3
       //this.attrs.view.ball.dy = 3


        this.attrs.view.paddle.y = Math.floor(this.attrs.view.height * .75)
        //this.attrs.view.ball.y = this.attrs.view.paddle.y
        //this.attrs.view.ball.dy = 0
        //this.attrs.view.ball.dx = 0

        const ctx = this.attrs.ctx;
        const view = this.attrs.view

        this.attrs.view.agents.push(this.attrs.view.cursor);
        this.attrs.view.agents.push(this.attrs.view.paddle);
        this.attrs.view.agents.push(this.attrs.view.ball);

        //const ball2 = new Ball()
        //this.attrs.view.agents.push(ball2);
        //ball2.dx=2
        //ball2.dy=0
        //ball2.x = 0
        //ball2.y = this.attrs.view.paddle.y



        // top left
        //this.attrs.view.ball.x = diamond.x - 30
        //this.attrs.view.ball.y = diamond.y - 30
        //this.attrs.view.ball.dx = 2
        //this.attrs.view.ball.dy = 2

        // bottom left
        //this.attrs.view.ball.x = diamond.x - 30
        //this.attrs.view.ball.y = diamond.y + 30
        //this.attrs.view.ball.dx = 2
        //this.attrs.view.ball.dy = -2

        //this.attrs.view.ball.x = diamond.x + 30
        //this.attrs.view.ball.y = diamond.y + 30
        //this.attrs.view.ball.dx = -2
        //this.attrs.view.ball.dy = -2

        // top right
        //this.attrs.view.ball.x = diamond.x + 30
        //this.attrs.view.ball.y = diamond.y - 30
        //this.attrs.view.ball.dx = -2
        //this.attrs.view.ball.dy = 2

        ctx.resetTransform()
        ctx.translate(view.x, view.y)

        window.requestAnimationFrame(this.render.bind(this));
    }


    render() {
        let now = performance.now()

        let dt = 1/60;

        if (this.lastTime != null) {

            if (!this.paused) {
                this.delta_accum += (now - this.lastTime) / 1000.0;

                let n = 0;

                while (this.delta_accum > dt) {
                    this.delta_accum -= dt
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

    renderFrame() {

        this.attrs.frame += 1;
        const ctx = this.attrs.ctx;

        const view = this.attrs.view

        ctx.resetTransform()
        ctx.translate(view.x, view.y)

        ctx.clearRect(0, 0, view.width, view.height)

        ctx.font = '24px sans-serif';
        ctx.fillText(`frame ${(this.attrs.frame/60.0).toFixed(1)}`, 0, 24)
        const paddle = this.attrs.view.paddle
        ctx.fillText(`paddle ${paddle.x} ${paddle.y} ${Math.floor(paddle.dx)}`, 0, 48)
        const ball = this.attrs.view.ball
        ctx.fillText(`ball ${Math.floor(ball.x)} ${Math.floor(ball.y)} (${ball.dx.toFixed(1)},${ball.dy.toFixed(1)}) `, 0, 72)

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, view.width, view.height)

        view.mouseX = view.cursor.x
        view.mouseY = view.cursor.y

        view.agents = view.agents.filter(item => !item.destroy)

        // sort by layer, then y position then x position
        const cmp = (a, b) => (a.layer - b.layer) || (a.y - b.y) || (a.x - b.x)
        view.agents.sort(cmp).forEach(agent => {
            agent.update(view)
            if (agent.visible) {
                agent.draw(view)
            }
        })

        ctx.resetTransform()
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, view.x, view.height)
        ctx.fillRect(view.x + view.width, 0, view.x + view.width, view.height)

    }
}



export class Game extends DomElement {
    constructor() {
        super("div", {className: style.block}, [])

    }

    elementMounted() {

        document.body.style.background = 'white';
        document.body.scrollTop = 0; // <-- pull the page back up to the top
        document.body.style.overflow = 'hidden'; // <-- relevant addition
        document.body.style.padding = '0'; // <-- relevant addition
        document.body.style.margin = '0'; // <-- relevant addition

        this.attrs.canvas = new Canvas(window.innerWidth, window.innerHeight)

        this.appendChild(this.attrs.canvas)
    }
}