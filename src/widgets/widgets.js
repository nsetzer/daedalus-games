from module daedalus import {DomElement}
from module engine import {
    ApplicationBase,
    GameScene,
    TextWidget, TextInputWidget,
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

        w = new TextInputWidget()

        w.rect.x = gEngine.view.width/4
        w.rect.y = 32
        w.rect.w = gEngine.view.width/2
        w.rect.h = 48

        this.widgets.push(w)
    }

    handleTouches(touches) {
        for (const wgt of this.widgets) {
            wgt.handleTouches(touches)
        }
        //console.log(window.hiddenInput)
        //
    }

    handleKeyPress(keyevent) {
        //for (const wgt of this.widgets) {
        //    wgt.handleKeyPress(keyevent)
        //}
    }

    handleKeyRelease(keyevent) {

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
        super({
            portrait: 1,
            fullscreen: 0
        }, () => {
            return new DemoScene()
        })


    }
}