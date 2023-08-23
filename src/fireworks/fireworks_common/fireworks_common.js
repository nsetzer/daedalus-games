 
// https://codepen.io/whqet/pen/abooRX

// TODO: rename map to World
$import("axertc_common", {CspMap, ClientCspMap})

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

    }

    paint(ctx) {

        const radius = 16
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#008800';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#003300';
        ctx.stroke();
    }

    update(dt) {

        this.timer += dt

        const d1 = .8
        const d2 = 1.6

        if (this.timer < d1) {
            const p = this.timer / d1
            this.x = this.x_start + (this.x_end - this.x_start) * p
            this.y = this.y_start + (this.y_end - this.y_start) * p
        } else {
            this.x = this.x_end
            this.y = this.y_end
        }

        if (this.timer > d2) {
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

        for (const obj of Object.values(this.objects)) {

            obj.paint(ctx)
        }

    }

}
