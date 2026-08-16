
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

        this._x_last_input_frame = 0

        // Ownership is resolved lazily the first time the entity ticks, once
        // the owning map is attached (see _resolveOwnership).  An entity is
        // "owned" on the client whose instanceId matches its playerId; the
        // owned entity is corrected by reconciliation and skips server bend
        // events, while remote copies are smoothed via onBend.
        this.ownedByClient = false
        this._ownership_resolved = false
    }

    _resolveOwnership() {
        if (this._ownership_resolved) {
            return
        }
        const map = this._x_debug_map
        if (!map) {
            return
        }
        this.ownedByClient = (!map.isServer && this.playerId === map.instanceId)
        this._ownership_resolved = true
    }

    paint(ctx) {

        // render at the smoothed position (rect + decaying prediction-error
        // offset) so reconciliation corrections ease in instead of snapping
        const rx = this.getRenderX()
        const ry = this.getRenderY()

        ctx.beginPath();
        ctx.rect( rx, ry, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'hsl(' + this.hue + ', 100%, ' + this.brightness + '%)';
        ctx.stroke();

        ctx.font = "16px mono";
        ctx.fillStyle = "yellow"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        //ctx.fillText(`${this.input_count}`, this.x+4, this.y+4);
        ctx.fillText(`${this.playerId=="player1"?1:2}`, rx + this.rect.w/2, ry + this.rect.h/2);

        // visualise the authoritative bend target for remote players
        if (true && !!this._shadow) {
            ctx.beginPath();
            ctx.rect(
                this._shadow.rect.x,
                this._shadow.rect.y,
                this._shadow.rect.w,
                this._shadow.rect.h);
            ctx.strokeStyle = 'red';
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
        this._resolveOwnership()

        this.physics.update(dt)

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
    }

    onBend(progress, shadow) {
        // The owned player is corrected by reconciliation and skips server
        // bend events (csp_fable filters them out for ownedByClient entities),
        // so onBend only ever runs for remote players on this client.
        // Ease the visible rect toward the authoritative shadow position; the
        // shadow keeps simulating the authoritative physics, and csp_fable
        // copies the full state once progress reaches 1.
        if (this.ownedByClient) {
            return
        }

        this.rect.x += (shadow.rect.x - this.rect.x) * progress
        this.rect.y += (shadow.rect.y - this.rect.y) * progress
    }

    onInput(payload) {
        this._resolveOwnership()

        if (this.ownedByClient) {
            this._x_last_input_frame = this.physics.frame_index
        }

        if ("whlid" in payload) {
            this.physics.direction = Direction.fromVector(payload.vector.x, payload.vector.y)

            if ( payload.vector.y < -0.7071) {

                let standing = this.physics.standing_frame >= (this.physics.frame_index - 6)

                if (standing) {
                    this.physics.speed.y = this.physics.jumpspeed
                    this.physics.yaccum = 0
                    this.physics.gravityboost = false
                    this.physics.doublejump = true
                }

            } else {
                this.physics.speed.x = 90 * payload.vector.x
            }

        } else {
            console.warn("unexpected input event", payload)
        }
    }
}

class PlayerV2 extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.playerId = props?.playerId??null

        this.physics = new Physics2dPlatformV2(this, {wallwalk: true})

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        //this.physics.can_wallwalk = false

        this.hue = random(0, 360)
        this.brightness = random(50, 80)

        this.ownedByClient = false
        this._ownership_resolved = false
    }

    _resolveOwnership() {
        if (this._ownership_resolved) {
            return
        }
        const map = this._x_debug_map
        if (!map) {
            return
        }
        this.ownedByClient = (!map.isServer && this.playerId === map.instanceId)
        this._ownership_resolved = true
    }

    getState() {
        return {
            playerId: this.playerId,
            hue: this.hue,
            brightness: this.brightness,
            physics: this.physics.getState(),
        }
    }

    setState(state) {
        this.playerId = state.playerId
        this.hue = state.hue
        this.brightness = state.brightness
        this.physics.setState(state.physics)
    }

    onBend(progress, shadow) {
        if (this.ownedByClient) {
            return
        }
        this.rect.x += (shadow.rect.x - this.rect.x) * progress
        this.rect.y += (shadow.rect.y - this.rect.y) * progress
    }

    paint(ctx) {

        // render at the smoothed position (see Player.paint)
        const rx = this.getRenderX()
        const ry = this.getRenderY()

        ctx.beginPath();
        ctx.rect( rx, ry, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'hsl(' + this.hue + ', 100%, ' + this.brightness + '%)';
        ctx.stroke();

        this.physics.paint(ctx)
    }

    update(dt) {
        this._resolveOwnership()

        this.physics.update(dt)
    }


    onInput(payload) {
        this._resolveOwnership()

        //TODO: test impulse (towards a mouse click)

        if ("whlid" in payload) {
            let dir = Direction.fromVector(payload.vector.x, payload.vector.y)

            if ( payload.vector.y < -0.7071) {

                //let standing = this.physics.standing_frame >= (this.physics.frame_index - 6)

                // if standing and
                if (this.physics.next_rect === null) {

                    let v = Direction.vector(Direction.flip[this.physics.standing_direction])

                    if (v.x) {
                        this.physics.speed.x = v.x*Math.abs(this.physics.jumpspeed)
                        this.physics.accum.x = 0
                    } else {
                        this.physics.speed.y = v.y*Math.abs(this.physics.jumpspeed)
                        this.physics.accum.y = 0
                    }

                    this.physics.gravityboost = false
                    this.physics.doublejump = true
                    console.log("jump", v, this.physics.speed)
                }

            } else {
                //this.physics.xspeed = 90 * payload.vector.x
            }

            if (dir&Direction.LEFTRIGHT) {

                this.physics.moving_direction = {
                    [Direction.DOWN ]: {[Direction.LEFT]: Direction.LEFT, [Direction.RIGHT]: Direction.RIGHT},
                    [Direction.UP   ]: {[Direction.LEFT]: Direction.RIGHT, [Direction.RIGHT]: Direction.LEFT},
                    [Direction.LEFT ]: {[Direction.LEFT]: Direction.UP  , [Direction.RIGHT]: Direction.DOWN},
                    [Direction.RIGHT]: {[Direction.LEFT]: Direction.DOWN  , [Direction.RIGHT]: Direction.UP},
                }[this.physics.standing_direction][dir&Direction.LEFTRIGHT]
            } else {
                this.physics.moving_direction = Direction.NONE
            }


            //# down : left right
            //# right: up down
            //# left : up down
            //# up   : left right

        }
    }
}

export class PlatformMap extends CspMap {

    static maprect = new Rect(0,0,0,0)

    constructor() {
        super()

        this.registerClass("Wall", Wall)
        this.registerClass("Slope", Slope)
        this.registerClass("Player", Player)
        this.registerClass("PlayerV2", PlayerV2)

        // number of steps over which a remote player's visible position eases
        // toward the authoritative bend target (see Player.onBend)
        this.settings.bending_steps = 10
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
