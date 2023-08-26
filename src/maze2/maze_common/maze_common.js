 
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {Entity, CspMap, ClientCspMap})

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}



class Player extends Entity {

    constructor(entid, props) {
        super(entid, props)
        this.x = props.x
        this.y = props.y
        this.dx = 0
        this.dy = 0
        this.playerId = props.playerId

        this.hue = random(0, 360)
        this.brightness = random(50, 80)
        this.input_count = 0

    }

    paint(ctx) {

        ctx.beginPath();
        ctx.rect( this.x, this.y, 32, 32);
        ctx.strokeStyle = 'hsl(' + this.hue + ', 100%, ' + this.brightness + '%)';
        ctx.stroke();


        ctx.font = "16px mono";
        ctx.fillStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        ctx.fillText(`${this.input_count}`, this.x+4, this.y+4);

    }

    getState() {
        if (isNaN(this.dx) || isNaN(this.dy)) {
                console.log("---")
                console.log(this.dx, this.dy )
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
        if (isNaN(state.dx) || isNaN(state.dy)) {
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

        this.x += dt * this.dx
        this.y += dt * this.dy

    }

    onBend(progress, shadow) {
        this.x  += (shadow.x  - this.x)  * progress
        this.y  += (shadow.y  - this.y)  * progress
        this.dx += (shadow.dx - this.dx) * progress
        this.dy += (shadow.dy - this.dy) * progress
    }

    onInput(payload) {
        if (payload.whlid===0) {
            this.dx = 90 * payload.vector.x
            this.dy = 90 * payload.vector.y

            if (isNaN(this.dx) || isNaN(this.dy)) {
                console.log("---")
                console.log(payload)
                throw new Error("nan")
            }
        }
        this.input_count += 1
    }


}

export class MazeMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Player", Player)
    }

    validateMessage(playerId, msg) {
        //console.log("validate", msg)
        this.sendNeighbors(playerId, msg)
    }

    update_main(dt, reconcile) {

        // todo: move this into the CspMap, require super?
        // add a check in update_after to see if super was called?
        for (const obj of Object.values(this.objects)) {
            obj.update(dt)
            if (!!obj._shadow) {
                if (!obj._shadow.x) {
                    console.log(obj)
                    throw new Error(JSON.stringify(obj))
                }
                if (!obj._shadow.y) {
                    console.log(obj)
                    throw new Error(JSON.stringify(obj))
                }
                obj._shadow.update(dt);

                if (!reconcile) {

                    obj._shadow_step += 1
                    const p = (obj._shadow_step) / 5
                    obj.onBend(p, obj._shadow)




                    if (obj._shadow_step >= 5){
                        console.log(this.local_step, "do bend finish", obj.entid, obj.x - obj._shadow.x, obj.y - obj._shadow.y)
                        obj.setState(obj._shadow.getState())
                        delete obj._shadow
                    }

                }
            }

            if (!obj.x) {
                throw new Error(JSON.stringify(obj))
            }
            if (!obj.y) {
                console.log(obj)
                throw new Error(obj)
            }
        }

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
