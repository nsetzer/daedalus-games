 

$import("axertc_client", {
    ApplicationBase, GameScene
})


class DemoScene {

    pause(paused) {

    }

    update(dt) {
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
