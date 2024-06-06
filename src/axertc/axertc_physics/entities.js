


import {Entity, Direction, Rect} from "@axertc/axertc_common"

import {Physics2dPlatform} from "./physics_v1.js"

export class PlatformerEntity extends Entity {

    constructor(entid, props) {
        super(entid, props)
        this.layer = 0
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
    static _x_debug_masks = {}

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(0,0,0,0)
        this.visible = props?.visible??true
        this.oneway = props?.oneway??false
        this.halfheight = props?.halfheight??false
        this.kind = props?.kind??"slope"

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

        // this._x_debug_mask()
    }

    _x_debug_mask() {

        let w = this.rect.w
        let h = this.rect.h
        let d = this.direction
        let s = `${this.kind}_${Direction.name[d]}_${w}_${h}`

        if (Slope._x_debug_masks[s] === undefined) {
            this._x_mask = null

            let canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            let ctx = canvas.getContext("2d");

            ctx.clearRect(0, 0, w, h)

            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if (this.collidePoint(this.rect.x + x, this.rect.y + y)) {
                        ctx.fillStyle = ((x+y)%2==0)?"#FF00FF":"#FFFFFF";
                        ctx.beginPath();
                        ctx.rect(x, y, 1, 1);
                        ctx.fill();
                    }
                }
            }

            let chunk_image = ctx.getImageData(0, 0, canvas.width, canvas.height)

            createImageBitmap(chunk_image)
                .then(image => {
                    console.log("created mask", s, `${this.eq.ms*this.eq.mm}*x+${this.eq.b}`)
                    // , this.points[1], this.points[2]
                    Slope._x_debug_masks[s] = image
                    this._x_mask = image
                })
                .catch(err => {
                    console.error(err)
                })

        } else {
            this._x_mask = Slope._x_debug_masks[s]
        }

    }


    init_points() {
        this.points = []
        // points are organized such that:
        // origin is always first
        // left most non-origin point is second
        // right most non-origin point is third

        let l = this.rect.left()
        let t = this.rect.top()
        let r = this.rect.right() 
        let b = this.rect.bottom() 

        // half height is for 2/3 slopes
        // allowing the block to fill a full tile
        // while only having an angle in the top half
        // it will be solid from below correctly
        if (this.halfheight) {
            if (this.direction & Direction.DOWN) {
                t += Math.floor(this.rect.h/2) 
            } else {
                b -= Math.floor(this.rect.h/2) 
            }
        }

        // determine points on the triangle
        // the first point is always the origin
        switch (this.direction) {

            case Direction.UPRIGHT: //  |_\
                this.points.push({x: l, y: b})
                this.points.push({x: r, y: b})
                this.points.push({x: l, y: t})
                break
            case Direction.UPLEFT: //   /_|
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

        let p1 = this.points[1] 
        let p2 = this.points[2] 

        // move the points into the domain 0..w x 0..h
        p1.x -= this.rect.x
        p1.y -= this.rect.y
        p2.x -= this.rect.x
        p2.y -= this.rect.y

        const m = (p2.y - p1.y) / (p2.x-p1.x)
        let ms = Math.sign(m)
        let mm = Math.abs(m)

        let b;
        if (this.direction&Direction.DOWN) {
            // ceiling
            if (this.direction&Direction.LEFT) {
                b = (this.halfheight)?(Math.floor(this.rect.h/2)):0
            } else {
                b = (this.rect.h-1)
            }
        } else {
            // floor
            if (this.direction&Direction.LEFT) {
                b = (this.halfheight)?(Math.floor(this.rect.h/2)-1):(this.rect.h - 1)
            } else {
                b = 0
            }
        }

        this.eq = {ms, mm, b}

        // an equation which solve for the y intercept given an x
        this._fx = (x,y) => {
            x -= this.rect.x
            y -= this.rect.y
            if (x >= 0 && x < this.rect.w) {
                return this.rect.y + ms*Math.floor(mm*x) + b
            }
            return null;
        }

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

        /*
        ctx.fillStyle = "#c3a3a3";
        ctx.beginPath();
        let pts = this.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        */

        let image = this._x_mask
        if (!!image) {
            ctx.drawImage(image, this.rect.x, this.rect.y)
        }

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