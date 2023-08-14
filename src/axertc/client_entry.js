 

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
    }

    pause(paused) {

    }

    update(dt) {

        if (!this.client) {

            this.client = new DemoRealTimeClient()
            this.client.connect("/rtc/offer", {})

        }
    }

    paint(ctx) {

        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

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
