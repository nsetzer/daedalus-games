
from module engine import {
    ApplicationBase,
    GameScene,
    TextWidget,
    Alignment
}

class DemoScene extends GameScene {

    constructor() {
        super()

        this.widgets = []

        let w;
        w = new TextWidget()
        w._text = "top left"
        w._alignment = Alignment.TOP|Alignment.LEFT
        w._alignment = Alignment.BOTTOM|Alignment.RIGHT
        w._alignment = Alignment.CENTER
        w.rect.x = 0
        w.rect.y = 0
        w.rect.w = gEngine.view.width
        w.rect.h = gEngine.view.height
        this.widgets.push(w)
    }

    handleTouches(touches) {
    }

    handleKeyRelease(kc) {
    }

    resize() {
    }

    update(dt) {

    }

    paint(ctx) {

        ctx.strokeStyle = "Red";
        ctx.fillStyle = "Red";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        for (const wgt of this.widgets) {
            wgt.paint(ctx)
        }
    }

}


export default class Application extends ApplicationBase {
    constructor() {
        super({portrait: 0}, () => {return new DemoScene()})
    }
}