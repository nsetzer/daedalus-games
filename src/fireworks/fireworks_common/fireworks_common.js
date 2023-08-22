 
$import("axertc_common", {CspMap, ClientCspMap})



export class FireworksMap extends CspMap {

    constructor(xsend=null) {
        super(xsend)
    }

    handleMessage(msg) {
        console.log(`csp-handle ${this.local_step} ${JSON.stringify(msg)}`)
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

    }

}
