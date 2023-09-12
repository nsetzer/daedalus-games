
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {Entity, CspMap, ClientCspMap, Physics2dPlatform, Direction, Rect})

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

// wall entity that is solid
// moving platform entity that checks for objects above it on every tick and moves them out of the way
// updating objects requires an order: move all platforms before all players

class PlatformerEntity extends Entity {

    constructor(entid, props) {
        super(entid, props)
    }

    collidePoint(x, y) {
        return this.rect.collidePoint(x, y)
    }

}

class Wall extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.solid = 1
        this.rect = new Rect(props?.x??0, props?.y??0, props?.w??0, props?.h??0)
        this.direction = 1

        this.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.playerId})
        }
    }

    update(dt) {

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

class Slope extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(0,0,0,0)

        if (!!props.direction) {
            this.rect = new Rect(props.x, props.y, props.w, props.h)
            this.direction = props.direction
            this.init()
        } else {
            this.rect = new Rect(0,0,0,0)
            this.direction = Direction.NONE
        }

        this.breakable = 0
        this.alive = 1
        this.solid = 1
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
        this.points = []

        // points are organized such that:
        // origin is always first
        // left most non-origin point is second
        // right most non-origin point is third
        switch (this.direction) {

            case Direction.UPRIGHT:
                this.points.push({x: this.rect.left(), y: this.rect.bottom()})
                this.points.push({x: this.rect.right(), y: this.rect.bottom()})
                this.points.push({x: this.rect.left(), y: this.rect.top()})
                break
            case Direction.UPLEFT:
                this.points.push({x: this.rect.right(), y: this.rect.bottom()})
                this.points.push({x: this.rect.left(), y: this.rect.bottom()})
                this.points.push({x: this.rect.right(), y: this.rect.top()})
                break
            case Direction.DOWNRIGHT:
                this.points.push({x: this.rect.left(), y: this.rect.top()})
                this.points.push({x: this.rect.right(), y: this.rect.top()})
                this.points.push({x: this.rect.left(), y: this.rect.bottom()})
                break
            case Direction.DOWNLEFT:
                this.points.push({x: this.rect.right(), y: this.rect.top()})
                this.points.push({x: this.rect.left(), y: this.rect.top()})
                this.points.push({x: this.rect.right(), y: this.rect.bottom()})
                break
            default:
                throw {message: "invalid direction", direction: this.direction}
        }

        const p1 = this.points[1]
        const p2 = this.points[2]

        const m = (p2.y - p1.y) / (p2.x-p1.x)
        const b = p1.y - m *p1.x

        this.f = (x) => {
            if (x >= this.rect.left() && x <= this.rect.right()) {
                return m*x + b
            }
            return null;
        }

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
                    return Math.max(yp)
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

        console.log(`y=${m}*x+${b}`)

    }

    collide(other, dx, dy) {
        // TODO: the api could return up to two two options
        // {dx, 0} or {0, dy}
        // {dx, dy}

        let rect = other.rect

        const original_rect = rect
        rect = rect.copy()
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
        let yp = this._fx(x, y)

        if (!super.collidePoint(x, y)) {
            return false
        }

        if (yp == null) {
            return false
        }
        if (this.direction&Direction.DOWN) {
            return yp >= y
        } else {
            return yp <= y
        }
    }

    paint(ctx) {

        let l = this.rect.x
        let t = this.rect.y
        let r = this.rect.x+this.rect.w
        let b = this.rect.y+this.rect.h

        ctx.fillStyle = "#c3a3a3";
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.fill();

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

class Player extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.playerId = props?.playerId??null

        this.physics = new Physics2dPlatform(this)

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.hue = random(0, 360)
        this.brightness = random(50, 80)

        this.deltas = []
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'hsl(' + this.hue + ', 100%, ' + this.brightness + '%)';
        ctx.stroke();

        ctx.font = "16px mono";
        ctx.fillStyle = "yellow"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        //ctx.fillText(`${this.input_count}`, this.x+4, this.y+4);
        ctx.fillText(`${this.playerId=="player1"?1:2}`, this.rect.cx(), this.rect.cy());

        if (false && !!this._server_shadow) {
            ctx.beginPath();
            ctx.rect(
                this._server_shadow.rect.x,
                this._server_shadow.rect.y,
                this._server_shadow.rect.w,
                this._server_shadow.rect.h);
            ctx.strokeStyle = 'red';
            ctx.stroke();

            let x = this._server_shadow.rect.x
            let y = this._server_shadow.rect.y
            for (const delta of this.deltas) {
                x += delta.x
                y += delta.y
            }
            ctx.beginPath();
            ctx.rect( x, y, 16, 16);
            ctx.rect( x+2, y+2, 16-4, 16-4);
            ctx.strokeStyle = 'yellow';
            ctx.stroke();

        }

    }

    getState() {
        //console.log(this._x_debug_map.instanceId, "get state", this.physics.xspeed)
        return {
            playerId: this.playerId,
            //rect: this.rect,
            hue: this.hue,
            brightness: this.brightness,
            physics: this.physics.getState()
        }
    }

    setState(state) {
        this.playerId = state.playerId
        //this.rect = state.rect
        this.hue = state.hue
        this.brightness = state.brightness
        this.physics.setState(state.physics)
        //console.log(this._x_debug_map.instanceId, "set state", this.physics.direction, this.physics.xspeed)
    }

    update(dt) {
        const x1 = this.rect.x
        const y1 = this.rect.y

        const was_not_standing = !this.physics.standing
        this.physics.update(dt)
        const is_standing = this.physics.standing

        // TODO: how to best set ownedByClient
        if (this.ownedByClient && was_not_standing && is_standing) {
            // if the player landed on something solid,
            // transmite the location to the server.
            // transmit the coordinates relative to that entity, in case it was a moving object
            let target = null
            if (this.physics.ycollisions.length > 0) {
                const other = this.physics.ycollisions[0].ent
                let dx = this.rect.x - other.rect.x
                let dy = this.rect.y - other.rect.y

                target = {entid: other.entid, dx, dy}
            }

            const location = {x:this.rect.x, y:this.rect.y}

            this._x_debug_map.sendObjectInputEvent(this.entid, {"type": "standing", target, location, state: this.getState()})

            // sendObjectInputEvent

            //console.error("now standing", this.playerId, message)
        }

        const x2 = this.rect.x
        const y2 = this.rect.y

        if (!!this._server_shadow) {

            this.deltas.push({x: x2 - x1, y: y2 - y1})
            while (this.deltas.length > this._server_latency) {
                this.deltas.shift()
            }

            const ent = this._server_shadow
            const error = {x:this.rect.x - ent.rect.x, y:this.rect.y - ent.rect.y}
            const m = Math.sqrt(error.x*error.x + error.y+error.y)
            //if (m > 0) {
            //    console.log("error", m, error)
            //}
            //console.log("error", m, error)
        }
    }

    onBend(progress, shadow) {

        // interpolate position and disable physics on the real object
        // when bending finishes copy the entire state from the physics objects
        // TODO: some boolean paramters could use a step function to change during bending
        // for example: facing could change based on the bent xspeed or it could
        // change when progress is above 50%.
        this.rect.x += (shadow.rect.x - this.rect.x) * progress
        this.rect.y += (shadow.rect.y - this.rect.y) * progress

        this.physics.xspeed = 0
        this.physics.yspeed = 0
        this.physics.xaccum = 0
        this.physics.yaccum = 0

        if (progress >= 1) {
            this.setState(shadow.getState())
        }

        //console.log(this._x_debug_map.instanceId, "bend", progress, this.physics.direction, this.physics.xspeed)
    }

    onInput(payload) {

        //if (this._x_debug_map.instanceId == this.playerId) {
        //    if (payload.vector.x == 0 && payload.vector.y == 0) {
        //        return
        //    }
        //}

        if ("whlid" in payload) {
            this.physics.direction = Direction.fromVector(payload.vector.x, payload.vector.y)
            //console.log(payload.vector.x, payload.vector.y)
            //if (this.physics.direction&Direction.UP) {
            if ( payload.vector.y < -0.7071) {

                let standing = this.physics.standing_frame >= (this.physics.frame_index - 6)

                if (standing) {
                    this.physics.yspeed = this.physics.jumpspeed
                    this.physics.yaccum = 0
                    this.physics.gravityboost = false
                    this.physics.doublejump = true
                }

            } else {
                this.physics.xspeed = 90 * payload.vector.x
            }

        } else if (payload.type == "standing" && !this.ownedByClient) {
            let x, y;

            if (!!payload.target) {
                let other = this._x_debug_map.objects[payload.target.entid]
                x = other.rect.x + payload.target.dx
                y = other.rect.y + payload.target.dy
            } else {
                x = payload.location.x
                y = payload.location.y
            }

            const shadow = this.bendTo(payload.state)
            shadow.rect.x = x
            shadow.rect.y = y



            //this.rect.x = x
            //this.rect.y = y

        } else {
            console.warn("unexpected input event", payload)
        }

        //console.log(this._x_debug_map.instanceId, "on input", this.physics.direction, this.physics.xspeed)
    }
}

export class PlatformMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Wall", Wall)
        this.registerClass("Slope", Slope)
        this.registerClass("Player", Player)
    }

    validateMessage(playerId, msg) {
        this.sendNeighbors(playerId, msg)
    }

    update_main(dt, reconcile) {
        super.update_main(dt, reconcile)
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.strokeStyle = "blue"
        // move to the last tracked coordinate in the set, then draw a line to the current x and y
        ctx.moveTo( Physics2dPlatform.maprect.left(), Physics2dPlatform.maprect.bottom());
        ctx.lineTo( Physics2dPlatform.maprect.right(), Physics2dPlatform.maprect.bottom());
        ctx.stroke()


        for (const obj of Object.values(this.objects)) {

            obj.paint(ctx)
        }



    }

}
