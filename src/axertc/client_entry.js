 

$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient
})

class DemoRealTimeClient extends RealTimeClient {

    constructor() {
        super();
        this.dcInterval = null
    }

    setCallback(callback) {
        this.callback = callback

    }

    onClose() {
        console.log("rtc closed")
    }

    onOpen() {
        console.log("rtc opened")
    }

    onMessage(obj) {

        this.callback(obj)
    }
}


class GameEngine {

    constructor() {
        this.world_step = -1
        this.local_step = -1
        this.incomming_messages = []

    }

    receiveMessage(message) {
        console.log("receive", message)
        this.incomming_messages.push(message)
    }

    update(dt) {

        while (this.incomming_messages.length > 0) {
            const msg = this.incomming_messages.shift()
            if (msg.type == "map-sync") {

                if (this.world_step < 0) {

                    // TODO: check reset
                    this.world_step = msg.step
                    this.local_step = msg.step
                } else {
                    if (msg.step > this.world_step) {
                        this.world_step = msg.step
                    }
                }

            } else {
                console.log(msg)
            }
        }

        if (this.world_step >= 0) {

            const STEP_NORMAL = 0
            const STEP_SKIP = 1
            const STEP_CATCHUP = 2
            const delta = this.world_step - this.local_step
            let step_kind = STEP_NORMAL

            if (delta > 0) {
                step_kind = STEP_CATCHUP
            }
            if (delta < 0) {
                step_kind = STEP_SKIP
            }

            this.world_step += 1

            if (step_kind == STEP_SKIP) {

            } else if (step_kind == STEP_CATCHUP) {
                this.step(dt)
                this.step(dt)
            } else {
                this.step(dt)
            }
        }

    }


    step(dt) {
        this.local_step += 1
    }
}


class DemoScene {


    constructor() {

        this.client = null

        this.keepalive_timer = 1
        this.incomming_messages = []
        this.latency = 0

        this.engine = new GameEngine()

    }

    pause(paused) {

    }

    update(dt) {

        if (!this.client) {

            this.client = new DemoRealTimeClient()
            this.client.setCallback(message => {
                if (message.type === "map-sync") {
                    this.engine.receiveMessage(message)
                } else {
                    this.incomming_messages.push(message)
                }
            })
            this.client.connect("/rtc/offer", {})

        } else {

            if (this.client.state() == "disconnected") {


            } else {
                this.client.update(dt)
                //console.log("xmit")
                this.keepalive_timer -= dt
                if (this.keepalive_timer < 5) {
                    this.keepalive_timer += 5
                    const msg = {"type": "keepalive", 't': performance.now()}
                    this.client.send(msg)
                }
            }

        }

        this.engine.update(dt)



        while (this.incomming_messages.length > 0) {
            const msg = this.incomming_messages.shift()
            if (msg.type == "keepalive") {

                let t1 = performance.now();
                let t0 = msg.t
                this.latency = (t1 - t0)/2

            } else {
                console.log(msg)
            }

        }


    }

    paint(ctx) {

        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        if (this.client) {

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "top"
            ctx.fillText(`world step: ${this.engine.world_step} ${(this.engine.world_step/60).toFixed(1)}`, 2, 2);
            const d = this.engine.world_step - this.engine.local_step
            const s = (d>=0)?'+':""
            ctx.fillText(`local step: ${this.engine.local_step} ${s}${d}`, 2, 2 + 16);
            ctx.fillText(`latency ${this.latency}`, 2, 2 + 32);

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "bottom"
            ctx.fillText(this.client.state(), 2, gEngine.view.height - 2);
        }

    }

    resize() {
    }

    handleTouches(touches) {
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }
}

export default class Application extends ApplicationBase {
    constructor() {
        super({
            portrait: 0,
            fullscreen: 0
        }, () => {
            return new DemoScene()
        })


    }
}
