 
// https://codepen.io/whqet/pen/abooRX

$import("axertc_common", {CspMap, ClientCspMap})

class Entity {
    constructor(entid, props) {

        this.x = props.x
        this.y = props.y

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

    handleMessage(msg) {
        // TODO: this must receive the playerId that sent the message

        if (this.isServer) {
            console.log(`csp-server ${this.local_step} ${JSON.stringify(msg)}`)

            //this.sendBroadcast(null, {type:"csp-player-input", payload: "not ready"})
        } else {


            this.createObject(msg.entid, msg.payload.className, msg.payload.props)
            console.log(`csp-client ${this.local_step} ${JSON.stringify(msg)}`)
        }

    }

    update_main(dt, reconcile) {

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
