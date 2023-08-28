 
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {Entity, CspMap, ClientCspMap})

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
        if (Math.abs(this.dx) < 0.001) {
            console.log("on set state", !this._shadow, this.dx, this.dy, state.dx, state.dy)
        } else {
            console.error("on set state", !this._shadow, this.dx, this.dy, state.dx, state.dy)
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

    }

    onBend(progress, shadow) {
        //console.log("bend", progress, this.x, shadow.x)
        if (isNaN(progress)) {
            throw new Error("onBend progress")
        }
        if (isNaN(this.x)||isNaN(shadow.x)) {
            throw new Error("onBend nan")
        }
        this.x  += (shadow.x  - this.x)  * progress
        this.y  += (shadow.y  - this.y)  * progress
        this.dx += (shadow.dx - this.dx) * progress
        this.dy += (shadow.dy - this.dy) * progress
        console.log("do bend", progress, shadow.dx, shadow.dy, this.dx, this.dy)
    }

    onInput(payload) {
        this.dx = 90 * payload.vector.x
        this.dy = 90 * payload.vector.y
        console.warn("player received", payload.vector, this.dx, this.dy)

        if (isNaN(this.dx) || isNaN(this.dy)) {
            console.log("---")
            console.log(payload)
            throw new Error("nan")
        }
        this.input_count += 1
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
