 
// https://codepen.io/whqet/pen/abooRX

$import("axertc_common", {CspMap, ClientCspMap})

export class FireworksMap extends CspMap {

    constructor() {
    }

    handleMessage(msg) {
        // TODO: this must receive the playerId that sent the message

        if (this.isServer) {
            console.log(`csp-server ${this.local_step} ${JSON.stringify(msg)}`)

            this.sendBroadcast(null, {type:"csp-player-input", payload: "not ready"})
        } else {
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

    }

}
