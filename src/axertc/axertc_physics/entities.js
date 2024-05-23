


import {Entity, Direction, Rect} from "@axertc/axertc_common"

import {Physics2dPlatform} from "./physics_v1.js"

export class PlatformerEntity extends Entity {

    constructor(entid, props) {
        super(entid, props)
    }

    collidePoint(x, y) {
        return this.rect.collidePoint(x, y)
    }
}

export class PlatformBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
    }
}

export class Wall extends PlatformBase {
    constructor(entid, props) {
        super(entid, props)
        this.solid = 1
        this.rect = new Rect(props?.x??0, props?.y??0, props?.w??0, props?.h??0)
        this.direction = 1
        this.visible = props?.visible??true

        this.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.playerId})
        }
    }

    update(dt) {

        if (false) {
            this.rect.x += this.direction

            const rect = new Rect(this.rect.x,this.rect.y-2,this.rect.w,2)
            for (const ent of this.group()) {

                let c1 = ent.rect.collideRect(rect)
                let c2 = (!!ent._shadow)?ent._shadow.rect.collideRect(rect):false
                let c3 = (!!ent._server_shadow)?ent._server_shadow.rect.collideRect(rect):false

                if (c1) {
                    ent.rect.x += this.direction
                }

                if (c2) {
                    ent._shadow.rect.x += this.direction
                }

                if (c3) {
                    ent._server_shadow.rect.x += this.direction
                }

            }

            if (this.rect.right() >= Physics2dPlatform.maprect.right()) {
                this.rect.x = Physics2dPlatform.maprect.right() - this.rect.w
                this.direction = -1
            }

            if (this.rect.left() <= Physics2dPlatform.maprect.left()) {
                this.rect.x = Physics2dPlatform.maprect.left()
                this.direction = 1
            }
        }
    }

    getState() {
        return {
            x: this.rect.x,
            y: this.rect.y,
            direction: this.direction,
        }
    }

    setState(state) {

        this.rect.x = state.x
        this.rect.y = state.y
        this.direction = state.direction

    }

    onBend(progress, shadow) {
        this.rect.x += (shadow.rect.x - this.rect.x) * progress
        this.rect.y += (shadow.rect.y - this.rect.y) * progress
        this.direction = (progress >= 0.5)?shadow.direction:this.direction

        if (progress >= 1) {
            this.setState(shadow.getState())
        }

    }

    paint(ctx) {
        ctx.beginPath();
        ctx.fillStyle = "#c3c3c3";
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();
    }
}

function applyfnull(f, a,b) {
    // constraint logic for checking intersection

    // apply f(a,b) if a and b are not null
    // other wise return the first non-null value a or b
    // return null if a and b is null
    let r = null
    if (a != null && b != null) {
        r = f(a, b)
    } else if (a != null) {
        r = a
    } else if (b != null) {
        r = b
    }
    return r
}

export class Slope extends PlatformBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(0,0,0,0)
        this.visible = props?.visible??true
        this.oneway = props?.oneway??false
        this.halfheight = props?.halfheight??false

        if (!!props.direction) {
            this.rect = new Rect(props.x, props.y, props.w, props.h)
            this.direction = props.direction
            this.init_points()
            this.init()
        } else {
            this.rect = new Rect(0,0,0,0)
            this.direction = Direction.NONE
        }

        this.breakable = 0
        this.alive = 1
        this.solid = 1

        this.tested_points = []
    }

    init_points() {
        this.points = []
        // points are organized such that:
        // origin is always first
        // left most non-origin point is second
        // right most non-origin point is third

        let l = this.rect.left()
        let t = this.rect.top()
        // this causes a painting anomaly but is correct.
        let r = this.rect.right() - 1
        let b = this.rect.bottom() - 1

        // half height is for 2/3 slopes
        // allowing the block to fill a full tile
        // while only having an angle in the top half
        // it will be solid from below correctly
        if (this.halfheight) {
            if (this.direction & Direction.DOWN) {
                t += Math.floor(this.rect.h/2)
                //b += Math.floor(this.rect.h/2)
            } else {
                b -= Math.floor(this.rect.h/2)
            }
        }

        switch (this.direction) {

            case Direction.UPRIGHT:
                this.points.push({x: l, y: b})
                this.points.push({x: r, y: b})
                this.points.push({x: l, y: t})
                break
            case Direction.UPLEFT:
                this.points.push({x: r, y: b})
                this.points.push({x: l, y: b})
                this.points.push({x: r, y: t})
                break
            case Direction.DOWNRIGHT:
                this.points.push({x: l, y: t})
                this.points.push({x: r, y: t})
                this.points.push({x: l, y: b})
                break
            case Direction.DOWNLEFT:
                this.points.push({x: r, y: t})
                this.points.push({x: l, y: t})
                this.points.push({x: r, y: b})
                break
            default:
                throw {message: "invalid direction", direction: this.direction}
        }
    }

    init() {

        /*
         +======================+
        ||   upleft | upright   ||
        ||         /o\          ||
        ||        / | \         ||
        ||       o--o--o        ||
        ||        \ | /         ||
        ||         \o/          ||
        || downleft | downright ||
         +======================+
        */


        const p1 = this.points[1]
        const p2 = this.points[2]

        const m = (p2.y - p1.y) / (p2.x-p1.x)
        const b = p1.y - m *p1.x

        this._eq = [m,b]

        // compute y position, given an x position
        this.f = (x) => {
            if (x >= this.rect.left() && x <= this.rect.right()) {
                return m*x + b
            }
            return null;
        }

        // compute x position, given a y position
        this.g = (y) => {
            if (y >= this.rect.top() && y <= this.rect.bottom()) {
                return (y - b) / m
            }
            return null;
        }

        if (this.direction&Direction.DOWN) {
            // ceiling
            this._fx = (x,y) => {
                if (x >= this.rect.left() && x <= this.rect.right()) {
                    const yp = m*x + b
                    return Math.ceil(yp)
                }
                return null;
            }
        } else {
            // floor
            this._fx = (x,y) => {
                if (x >= this.rect.left() && x <= this.rect.right()) {
                    const yp = m*x + b
                    return Math.floor(yp)
                }
                return null;
            }
        }

        //console.log(`y=${m}*x+${b}`)

    }

    isSolid(other) {
        if (!this.oneway) {
            return true
        }
        let x = Math.floor(other.rect.cx())
        let y = Math.floor(other.rect.bottom())
        let yp = this._fx(x,y)
        if (yp == null) {
            return true
        }
        // checking y speed is helpful because of the slope
        // objects tend to get stuck on invisible cliffs
        // and then start walking down the slope
        let rv = other.physics.speed.y >= 0 || y <= yp;
        //let rv =other.physics.speed.y >= 0 || y < yp || (y == yp && other.physics.speed.x > 0)
        //if (rv) {
        //    console.log(other._classname, other.physics.speed, y, yp, Direction.name[this.direction&Direction.LEFTRIGHT]);
        //}
        return rv  
    }

    collide(other, dx, dy) {

        // TODO: this needs to be re-written
        //       check the direction
        //          only one of dx or dy should be non-zero
        //       determine which edge handles that direction
        //          moving left is handled by the right edge
        //       support walking on walls by changing gravity direction
        //          object collision should behave the same in all orientations

        // TODO: something to handle the floating issue
        //       either only every consider the cx position
        //       or make the true top 1 pixel lower than the line

        if (this.oneway) {
            const top = applyfnull(Math.min, this.f(other.rect.left()), this.f(other.rect.right()))
            let rect = other.rect

            if (!!top && dy >= 0 && rect.bottom() <= top + 4) {
                // return a rectangle that does not collide
                //let update = rect.copy()
                //update.set_bottom(top)
                //return update
                return this._collide_impl(other, dx, dy)
            }

            //console.log(this.entid, gEngine.frameIndex, "speed:", (dy>0)?1:0, rect.bottom(), ":",
            //    this.rect.left() >= other.rect.cx() , other.rect.cx() <= this.rect.right(), ":",
            //    this.rect.top(), top)
            return null
        } else {
            return this._collide_impl(other, dx, dy)
        }

    }

    _ceil_away(x) {
        return (x<0)?-Math.ceil(-x):Math.ceil(x)
    }

    _collide_impl(other, dx, dy) {
        // TODO: the api could return up to two two options
        // {dx, 0} or {0, dy}
        // {dx, dy}

        let rect = other.rect

        const original_rect = rect
        rect = rect.copy()
        //rect.translate(this._ceil_away(dx*.7071), this._ceil_away(dy*.7071))
        rect.translate(dx, dy)

        if (this.direction&Direction.LEFT && original_rect.left() >= this.rect.right()) {
            let update = original_rect.copy()
            update.set_left(this.rect.right())
            update.z = 1
            return update
        }

        if (this.direction&Direction.RIGHT && original_rect.right() <= this.rect.left()) {

            let update = original_rect.copy()
            update.set_right(this.rect.left())
            update.z = 2
            return update
        }

        let tmp = rect.intersect(this.rect)
        if (tmp.w == 0) {
            // likely unreachable unless a prior this.rect  other.rect test was not done
            return null
        }

        const x1 = tmp.x
        const x2 = tmp.x + tmp.w
        //console.log(">",{x1,x2}, this.rect, this.f(x1), this.f(x2))
        const y1 = rect.top()
        const y2 = rect.bottom()

        if (this.direction&Direction.DOWN) {

            if (original_rect.bottom() <= this.rect.top()) {
                if (dy > 0) {
                    let update = original_rect.copy()
                    update.set_bottom(this.rect.top())
                    update.z = 3
                    return update
                }
            } else {

                const yp = applyfnull(Math.max, this._fx(x1, y1), this._fx(x2, y1))
                //console.log("!!", yp, y1, y2, (yp != null && (y2 >= yp || y1 >= yp)))

                // TODO: consider returning two candidates then picking the best one


                const xp = this.g(y1)
                if (!!xp && this.direction&Direction.RIGHT && dx < 0 && rect.left() <= xp) {
                    // candidate position without adjusting the y direction
                    // when walking left
                    let update = rect.copy()
                    update.set_left(Math.ceil(xp)+1)
                    update.z = 4
                    update.xp = xp
                    return update
                } else if (!!xp && this.direction&Direction.LEFT && dx > 0  && rect.right() >= xp) {
                    // candidate position without adjusting the y direction
                    // when walking right
                    let update = rect.copy()
                    update.set_right(Math.floor(xp)-1)
                    update.z = 5
                    update.xp = xp
                    return update
                }


                if (yp != null && y1 <= yp) {
                    // candidate position with adjusting the y direction

                    // return a rectangle that does not collide
                    let update = rect.copy()
                    update.set_top(yp)
                    update.z = 6
                    return update
                }
            }
        } else {

            if (original_rect.top() >= this.rect.bottom()) {
                if (dy < 0) {
                    let update = original_rect.copy()
                    update.set_top(this.rect.bottom())
                    update.z = 7
                    return update
                }
            } else {
                const yp = applyfnull(Math.min, this._fx(x1, y2), this._fx(x2, y2))

                //if (yp != null && (y2 >= yp || y1 >= yp)) {
                if (yp != null && y2 >= yp) {
                    // return a rectangle that does not collide
                    let update = rect.copy()
                    update.set_bottom(yp)
                    update.z = 8
                    return update
                }
            }


        }
        return null

    }

    collidePoint(x, y) {

        if (!super.collidePoint(x, y)) {
            return false
        }

        let yp = this._fx(x, y)
        if (yp == null) {
            return false
        }

        //this.tested_points.push({x,y})
        //this.visible = true

        if (this.direction&Direction.DOWN) {
            //console.log("slope cp dn1 (", x,y, ")", yp, yp >= y, this.rect)
            return yp >= y
        } else {
            //console.log("slope cp up2 (", x,y, ")", yp, yp <= y, this.rect)
            return yp <= y
        }
    }

    paint(ctx) {

        let l = this.rect.x
        let t = this.rect.y
        let r = this.rect.x+this.rect.w
        let b = this.rect.y+this.rect.h

        /*
        ctx.fillStyle = "#c3a3a388";
        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();
        */

        ctx.fillStyle = "#c3a3a3";
        ctx.beginPath();
        let pts = this.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();



        //ctx.font = "bold 8";
        //ctx.fillStyle = "black"
        //ctx.strokeStyle = "black"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.entid}`, this.rect.x, this.rect.y);

        //this.tested_points.forEach(pt => {
        //    ctx.beginPath();
        //    ctx.fillStyle = "#FF00FF";
        //    ctx.rect(pt.x, pt.y, 1, 1)
        //    ctx.fill();
        //})

    }

    getState() {
        return {rect: this.rect, direction: this.direction}
    }

    setState(state) {
        this.rect = state.rect
        this.direction = state.direction
        this.init()
    }
}

export class OneWayWall extends PlatformBase {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, props?.w??0, props?.h??0)
        this.visible = props?.visible??true

        //this.group = () => {
        //    return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.playerId})
        //}

        //this.breakable = 0
        //this.alive = 1
        this.solid = 1
    }

    isSolid(other) {
        return Math.floor(other.rect.bottom()) <= Math.floor(this.rect.top())
    }

    _x_collide(other, dx, dy) {

        let rect = other.rect

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            // return a rectangle that does not collide
            let update = rect.copy()
            update.set_bottom(this.rect.top())
            return update
        }

        return null
    }

    paint(ctx) {

        ctx.fillStyle = "#c05f10";
        ctx.strokeStyle = "#green";
        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

    }
}