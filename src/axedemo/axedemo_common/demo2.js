
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
    }d
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

        if (!!this._server_shadow) {
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
            console.log(x, y)
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
        this.physics.update(dt)

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
                } else {
                    console.log(this._x_debug_map.instanceId, "not standing")
                }

            } else {
                this.physics.xspeed = 90 * payload.vector.x
            }

        } else {
            console.log(payload)
        }

        //console.log(this._x_debug_map.instanceId, "on input", this.physics.direction, this.physics.xspeed)
    }
}

export class PlatformMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Wall", Wall)
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
