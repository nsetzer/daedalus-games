 
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {CspMap, ClientCspMap})

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

class Entity {
    constructor(map, entid, props) {

        // TODO: if the only reason to pass in the map is to implement Destroy
        //       then an alternative is in the creation phase, destroy can be patched in
        this.map = map
        this.entid = entid

        this.x = 320
        this.y = 360

        this.x_start = 320
        this.y_start = 360

        this.x_end = props.x
        this.y_end = props.y

        this.timer = 0

        this.d1 = 0.8
        this.d2 = 1.6

        this.particles = []

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

        const d1 = .6
        const d2 = 1.6


        if (this.timer < this.d1) {

            const pt1 = this._position(this.timer-.03)
            const pt2 = this._position(this.timer+.03)

            ctx.beginPath();
            // move to the last tracked coordinate in the set, then draw a line to the current x and y
            ctx.moveTo( pt1.x, pt1.y);
            ctx.lineTo( pt2.x, pt2.y);
            const hue = random(this.hue - 60, this.hue + 60);
            const brightness = random( 50, 80 );
            ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + brightness + '%)';
            ctx.stroke();


        } else {
            const dt = this.timer - d1
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

    destroy() {
        this.map.destroyObject(this.entid)
    }


}

export class FireworksMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Entity", Entity)
    }

    validateMessage(playerId, msg) {
        console.log("validate")
        this.sendNeighbors(playerId, msg)
    }

    update_main(dt, reconcile) {

        for (const obj of Object.values(this.objects)) {

            obj.update(dt)
        }

    }

    getState() {
        return {}
    }

    setState(state) {
        return
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.strokeStyle = "blue"
        // move to the last tracked coordinate in the set, then draw a line to the current x and y
        ctx.moveTo( 0, 0);
        ctx.lineTo( 320, 360);
        ctx.lineTo( gEngine.view.width, 0);
        ctx.stroke()

        for (const obj of Object.values(this.objects)) {

            obj.paint(ctx)
        }



    }

}
