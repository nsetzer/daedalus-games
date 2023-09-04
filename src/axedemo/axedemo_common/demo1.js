 
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {Entity, CspMap, ClientCspMap, Rect})

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

class Firework extends Entity {
    constructor(entid, props) {
        super(entid, props)

        // TODO: if the only reason to pass in the map is to implement Destroy
        //       then an alternative is in the creation phase, destroy can be patched in
        this.entid = entid

        this.x = 211/2
        this.y = 360

        this.x_start = 211/2
        this.y_start = 360

        this.x_end = props.x
        this.y_end = props.y

        this.timer = 0

        this.d0 = Math.sqrt((Math.pow(this.x_end - this.x_start, 2) + Math.pow(this.y_end - this.y_start, 2)))

        this.d1 = this.d0/200
        this.d2 = this.d1 + 0.8

        this.particles = []

        // the fireworks colors and particles are not synced by the network

        this.hue = random(0, 360 );
        this.gravity = 25
        this.friction = 0.95
        for (let i=0; i < 40; i++) {
            const angle = random( 0, Math.PI * 2 );
            const speed = random( 20, 80 );
            const dx =  Math.cos( angle )
            const dy =  Math.sin( angle )
            const alpha_decay = random( 0.015, 0.03 );
            this.particles.push({x:this.x_end, y:this.y_end, dx, dy, speed, alpha_decay})
        }

    }

    _position(t) {
        if (t < this.d1) {
            const p = t / this.d1
            return {
                x: this.x_start + (this.x_end - this.x_start) * p,
                y: this.y_start + (this.y_end - this.y_start) * p
            }
        } else {
            return {x: this.x_end, y: this.y_end}
        }
    }

    paint(ctx) {


        if (this.timer < this.d1) {

            const pt1 = this._position(this.timer-.02)
            const pt2 = this._position(this.timer+.02)

            ctx.beginPath();
            // move to the last tracked coordinate in the set, then draw a line to the current x and y
            ctx.moveTo( pt1.x, pt1.y);
            ctx.lineTo( pt2.x, pt2.y);
            const hue = random(this.hue - 60, this.hue + 60);
            const brightness = random( 50, 80 );
            ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + brightness + '%)';
            ctx.stroke();


        } else {
            const dt = this.timer - this.d1
            const radius = 6
            for (const particle of this.particles) {

                const x = this.x + dt * particle.dx * particle.speed
                const y = this.y + dt * particle.dy * particle.speed + dt*this.gravity
                let alpha = 1 - dt * particle.alpha_decay
                if (alpha < 0) {
                    alpha += 1
                }
                ctx.beginPath();
                ctx.lineWidth = 1;
                const hue = random(this.hue - 60, this.hue + 60);
                const brightness = random( 50, 80 );
                ctx.strokeStyle = 'hsla(' + hue + ', 100%, ' + brightness + '%, ' + alpha + ')';
                ctx.moveTo( particle.x, particle.y);
                ctx.lineTo( x, y);
                particle.x = x
                particle.y = y
                ctx.stroke();
            }

        }
    }

    getState() {
        return {
            x: this.x,
            y: this.y,
            x_end: this.x_end,
            y_end: this.y_end,
            timer: this.timer,
            d0: this.d0,
            d1: this.d1
        }
    }

    setState(state) {
        this.x = state.x
        this.y = state.y
        this.x_end = state.x_end
        this.y_end = state.y_end
        this.timer = state.timer
        this.d0 = state.d0
        this.d1 = state.d1
    }

    onBend(progress, shadow) {

        //console.log("bend", progress, shadow.d0, this.d0)
        //this.x += (shadow.x - this.x) * progress
        //this.y += (shadow.y - this.y) * progress
        //this.timer += (shadow.timer - this.timer) * progress
        //this.d0 += (shadow.d0 - this.d0) * progress
        //this.d1 += (shadow.d1 - this.d1) * progress

        //if (progress >= 1) {
        //    this.setState(shadow.getState())
        //}
//
        super.onBend(progress, shadow)
    }

    update(dt) {

        this.timer += dt

        // todo: dont use timer based position in phase 1
        // constant speed, not constant time
        const pt = this._position(this.timer)
        this.x = pt.x
        this.y = pt.y

        if (this.timer > this.d2) {
            this.destroy()
        }

    }
}


class Player extends Entity {

    constructor(entid, props) {
        super(entid, props)
        this.x = props?.x??0
        this.y = props?.y??0
        this.dx = 0
        this.dy = 0
        this.playerId = props?.playerId??null

        this.hue = random(0, 360)
        this.brightness = random(50, 80)
        this.input_count = 0


        if (isNaN(this.x)) {
            throw new Error("init nan")
        }

    }

    paint(ctx) {

        ctx.beginPath();
        ctx.rect( this.x, this.y, 32, 32);
        ctx.strokeStyle = 'hsl(' + this.hue + ', 100%, ' + this.brightness + '%)';
        ctx.stroke();


        ctx.font = "16px mono";
        ctx.fillStyle = "yellow"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        //ctx.fillText(`${this.input_count}`, this.x+4, this.y+4);
        ctx.fillText(`${this.playerId=="player1"?1:2}`, this.x+16, this.y+16);

    }

    getState() {
        if (isNaN(this.x)) {
            console.log("---")
            console.log(this)
            throw new Error("nan get state")
        }
        return {
            playerId: this.playerId,
            x: this.x,
            y: this.y,
            dx: this.dx,
            dy: this.dy,
            input_count: this.input_count,
            hue: this.hue,
            brightness: this.brightness
        }
    }

    setState(state) {
        if (isNaN(this.x) || isNaN(state.x)) {
            console.log("---")
            console.log(this)
            throw new Error("nan set state")
        }

        this.playerId = state.playerId
        this.x = state.x
        this.y = state.y
        this.dx = state.dx
        this.dy = state.dy
        this.input_count = state.input_count
        this.hue = state.hue
        this.brightness = state.brightness
    }

    update(dt) {
        // TODO: limit position to map boundaries

        this.x += dt * this.dx
        this.y += dt * this.dy

        if (this.x < 0) {
            this.x = 0
        }

        if (this.y < 0) {
            this.y = 0
        }

        if (this.x + 32 > FireworksMap.maprect.w) {
            this.x = FireworksMap.maprect.w - 32
        }

        if (this.y + 32 > FireworksMap.maprect.h) {
            this.y = FireworksMap.maprect.h - 32
        }

        if (!!this.lerp) {
            this.lerp.step += 1
            const p = (this.lerp.step/this.lerp.steps)

            console.log("do lerp", this.lerp, p,
                this.dx, this.dy,
                 (this.lerp.x - this.x) * p,
                 (this.lerp.y - this.y) * p,
            )

            this.x += (this.lerp.x - this.x) * p
            this.y += (this.lerp.y - this.y) * p

            if (this.lerp.step >= this.lerp.steps) {
                delete this.lerp
            }
        }

        if (!!this._server_shadow) {
            const ent = this._server_shadow
            const error = {x:this.x - ent.x, y:this.y - ent.y}
            const m = Math.sqrt(error.x*error.x + error.y+error.y)
            if (m > 0) {
                console.log("error", m, error)
            }
        }
    }

    update_before() {
        this._pos1 = {x:this.x, y:this.y}
    }

    update_after() {
        this._pos2 = {x:this.x, y:this.y}

        ///console.log(this._pos1, this._pos2)
    }


    enableLerp(state, steps) {
        this.lerp = {x: state.x, y: state.y, step:0, steps}
    }

    onBend(progress, shadow) {
        //TODO: only bend x/y if velocity is not matched
        //      adjust the number of steps dynamically
        //console.log("bend", progress, this.x, shadow.x)
        if (isNaN(progress)) {
            throw new Error("onBend progress")
        }
        if (isNaN(this.x)||isNaN(shadow.x)) {
            throw new Error("onBend nan")
        }

        // TODO: if player controlled character, use 'smart bending'
        //if (!!this._shadow && this._shadow._partial) {
        if (false) {

            // TODO: bending bug with message validation
            // when doing reconciliation, minimize the steps from which
            // reconciliation needs to be done. server can send the state
            // after applying the input

            // TODO: instead of bending by steps, bend until the error is less than some percent.
            const eps = 1e-5

            //progress = 1/30
            //this._shadow_step = 0

            const error = Math.sqrt(Math.pow(this.x - shadow.x, 2) + Math.pow(this.y - shadow.y, 2))
            //console.log("bend player (1)", progress, {
            //    x:(this.x - shadow.x).toFixed(1),
            //    y:(this.y - shadow.y).toFixed(1)},
            //    this.dx, shadow.dx, this.dy, shadow.dy)

            console.log("bend player 1",
                Math.sign(this.x - shadow.x) , Math.sign(this.dx))
            if (error < 4) {
                this.setState(shadow.getState())
                this._shadow_step = 100
                console.log("end bending")
            } else {

                //this.x  += (shadow.x  - this.x)  * progress
                //this.y  += (shadow.y  - this.y)  * progress
                //this.dx += (shadow.dx - this.dx) * progress
                //this.dy += (shadow.dy - this.dy) * progress

                //if ((shadow.dx < eps && this.dx < eps) || (shadow.dx > eps && this.dx > eps)) {
                ///console.log(Math.sign(this.x - shadow.x), Math.sign(this.dx), shadow.dx - this.dx)
                if (Math.sign(this.x - shadow.x) == Math.sign(this.dx)) {
                    this.dx += (shadow.dx - this.dx) * progress
                } else {
                    this.dx += (shadow.dx - this.dx) * progress
                    this.x  += (shadow.x  - this.x)  * progress
                }
                //if ((shadow.dy < eps && this.dy < eps) || (shadow.dy > eps && this.dy > eps)) {
                if (Math.sign(this.y - shadow.y) == Math.sign(this.dy)) {
                    this.dy += (shadow.dy - this.dy) * progress
                } else {
                    this.dy += (shadow.dy - this.dy) * progress
                    this.y  += (shadow.y  - this.y)  * progress
                }
///
                //this.x  += (shadow.x  - this.x)  * progress
                //this.y  += (shadow.y  - this.y)  * progress
                //this.dx += (shadow.dx - this.dx) * progress
                //this.dy += (shadow.dy - this.dy) * progress
            }


        } else {

            //console.log("bend player (2)", progress, this.dx, shadow.dx, this.dy, shadow.dy)

            this.x  += (shadow.x  - this.x)  * progress
            this.y  += (shadow.y  - this.y)  * progress
            this.dx += (shadow.dx - this.dx) * progress
            this.dy += (shadow.dy - this.dy) * progress


            //console.log("do bend", progress,
            //    this.dx, this.dy,
            //    (shadow.x  - this.x)  * progress,
            //    (shadow.y  - this.y)  * progress,
            //)

        }
    }

    onInput(payload) {

        // TODO: clients should interpolate to the predicted speed to prevent over shooting


        //if (this._x_debug_map.instanceId == this.playerId && this.playerId=="player1" && !this._isShadow ) {
        //    console.error("player1 receive input", this._x_debug_map.local_step, payload)
        //}
        //if (this._x_debug_map.instanceId == this.playerId) {
        //    if (payload.vector.x == 0 && payload.vector.y == 0) {
        //        return
        //    }
        //}
        this.dx = 90 * payload.vector.x
        this.dy = 90 * payload.vector.y

        return

        if (!!this._shadow/* && this._shadow._partial*/) {
            const error = Math.sqrt(Math.pow(this.x - this._shadow.x, 2) + Math.pow(this.y - this._shadow.y, 2))
            this.dx = this._shadow.dx; // (this.x - this._shadow.x) / 6
            this.dy = this._shadow.dy; // (this.y - this._shadow.y) / 6
            console.warn(this._x_debug_map.instanceId,
                "setting input when partial", error, this.dx, this.dy)
        } else {
            console.log("set normal input")

        }

    }
}


export class FireworksMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Firework", Firework)
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
        ctx.moveTo( 0, 0);
        ctx.lineTo( 211/2, 360);
        ctx.lineTo( 211, 0);
        ctx.stroke()


        for (const obj of Object.values(this.objects)) {

            obj.paint(ctx)
        }



    }

}

FireworksMap.maprect = new Rect(0,0,0,0)
