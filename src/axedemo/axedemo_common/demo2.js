
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {CspMap, ClientCspMap, Direction, Rect})
$import("axertc_physics", {Physics2dPlatform, Physics2dPlatformV2, PlatformerEntity, Wall, Slope})


function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

// wall entity that is solid
// moving platform entity that checks for objects above it on every tick and moves them out of the way
// updating objects requires an order: move all platforms before all players

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

        this.step_stomp = 0

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
            physics: this.physics.getState(),
            stomp: this.step_stomp,
        }
    }

    setState(state) {
        this.playerId = state.playerId
        //this.rect = state.rect
        this.hue = state.hue
        this.brightness = state.brightness
        this.step_stomp = state.stomp
        this.physics.setState(state.physics)
        //console.log(this._x_debug_map.instanceId, "set state", this.physics.direction, this.physics.xspeed)
    }

    update(dt) {
        const x1 = this.rect.x
        const y1 = this.rect.y

        const is_standing_before = this.physics.standing
        const is_moving_before = (Math.abs(this.physics.xspeed) + Math.abs(this.physics.yspeed)) > 1e-5
        this.physics.update(dt)
        const is_standing_after= this.physics.standing
        const is_moving_after = (Math.abs(this.physics.xspeed) + Math.abs(this.physics.yspeed)) > 1e-5

        const condition = (is_standing_before != is_standing_after)
        //const condition = (!is_standing_before && is_standing_after) || (is_moving_before && !is_moving_after)

        // TODO: how to best set ownedByClient
        // TODO: server sends periodic state updates
        // TODO: verify client receives state updates on the correct clock step
        //         - it should be applied right away not after 6 frame delay
        if (false) {
            if (this._x_debug_map.isServer && was_not_standing && is_standing) {
                 this._x_debug_map.sendObjectBendEvent(this.entid, this.getState())
            }
        } else if (false) {
            //if (this.ownedByClient && was_not_standing && is_standing) {
            // consider adding started moving, stopped moving
            if (this.ownedByClient && condition) {
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
                console.log("send standing",
                    (!is_standing_before && is_standing_after),
                    (is_moving_before && !is_moving_after),
                    performance.now())
                this._x_debug_map.sendObjectInputEvent(this.entid, {"type": "standing", target, location, state: this.getState()})
            }
        }

        // check for collisions with other players
        for (const obj of this._x_debug_map.queryObjects({className: 'Player'})) {
            if (obj.entid == this.entid) {
                continue
            }

            if (this.step_stomp == 0 &&
                this.physics.yspeed > 0 &&
                this.rect.cy() < obj.rect.cy() &&
                this.rect.collideRect(obj.rect)) {
                console.log(this.step_stomp, this._x_debug_map.local_step, 'map', this._x_debug_map.instanceId, "bang", this.entid, obj.entid)
                this.step_stomp = 30;
            }

        }

        if (this.step_stomp > 0) {
            this.step_stomp -= 1
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

        } else if (payload.type == "standing") {

            if (this.ownedByClient) {
                return
            }
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

class PlayerV2 extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.playerId = props?.playerId??null

        this.physics = new Physics2dPlatformV2(this)

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.hue = random(0, 360)
        this.brightness = random(50, 80)
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'hsl(' + this.hue + ', 100%, ' + this.brightness + '%)';
        ctx.stroke();

        this.physics.paint(ctx)
    }

    update(dt) {

        this.physics.update(dt)
    }
}

export class PlatformMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Wall", Wall)
        this.registerClass("Slope", Slope)
        this.registerClass("Player", Player)
        this.registerClass("PlayerV2", PlayerV2)
    }

    validateMessage(playerId, msg) {
        // server side?
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
