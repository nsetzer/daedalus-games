 
/*

fireworks game

tap the screen to make fireworks. synchronized to all connected players



architecture

ClientApplication
ClientEngine (canvas)
Scene
CspReceiver
CspMap

ServerContext
ServerLobby
CspReceiver
CspMap

map and entities implement get/set state

tap the screen
    scene sends a message to the server
    server receives message
    lobby receives message
        message is validated
        message is rebroadcast to all neighbors
        csp receiver receives message



*/
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient, WidgetGroup, ButtonWidget
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
        this.incoming_messages = []

    }

    receiveMessage(message) {
        this.incoming_messages.push(message)
    }

    update(dt) {

        while (this.incoming_messages.length > 0) {
            const msg = this.incoming_messages.shift()
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
        this.incoming_messages = []
        this.latency = 0

        this.engine = new GameEngine()

        this.grp = new WidgetGroup()
        this.btn = this.grp.addWidget(new ButtonWidget())
        const btnw = 128
        const btnh = 32
        this.btn.setText("Disconnect")
        this.btn.rect.x = gEngine.view.width - btnw - 4
        this.btn.rect.y = 4
        this.btn.rect.w = btnw
        this.btn.rect.h = btnh
        this.btn.clicked = () => {
            this.client.disconnect()
        }



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
                    this.incoming_messages.push(message)
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

        this.grp.update(dt)


        while (this.incoming_messages.length > 0) {
            const msg = this.incoming_messages.shift()
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

        this.grp.paint(ctx)

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

        this.grp.handleTouches(touches)

        if (touches.length > 0) {
            let touch = touches[0]
            if (touch.pressed) {
                console.log(touch)
            }
        }
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
