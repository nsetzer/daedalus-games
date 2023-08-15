 

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


class DemoScene {


    constructor() {

        this.client = null

        this.keepalive_timer = 1
        this.frameIndex = 0
    }

    pause(paused) {

    }

    update(dt) {

        this.frameIndex += 1

        if (!this.client) {

            this.client = new DemoRealTimeClient()
            this.client.setCallback(message => console.log(message))
            this.client.connect("/rtc/offer", {})

        } else {

            this.client.update(dt)
            //console.log("xmit")
            this.keepalive_timer -= dt
            if (this.keepalive_timer < 5) {
                this.keepalive_timer += 5
                const msg = {"type": "keepalive", frame: this.frameIndex, 't': performance.now()}
                this.client.send(msg)
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
