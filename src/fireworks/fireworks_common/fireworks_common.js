 
$import("axertc_common", {ClientCspMap})



export class FireworksMap extends ClientCspMap {

    constructor(xsend = null) {
        super(xsend)
    }

    handleMessage(msg) {
        console.log(`csp-handle ${this.local_step} ${JSON.stringify(msg)}`)
    }

    update_main(dt, reconcile) {

    }

    getState() {
        return null
    }

    setState(state) {
        return
    }

    paint(ctx) {

    }

}
