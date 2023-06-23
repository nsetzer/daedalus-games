
$import("engine", {
    ApplicationBase,
    GameScene,
    TextWidget, TextInputWidget,
    Alignment
})


class DemoScene extends GameScene {

    constructor() {
        super()

        this.widgets = []

        let w;

        w = new TextInputWidget()

        w.rect.w = gEngine.view.width
        w.rect.h = 48

        w.rect.x = gEngine.view.width/2 - w.rect.w/2
        w.rect.y = gEngine.view.height - w.rect.h

        w.submit_callback = this.handleTextSubmit.bind(this)
        this.textinput = w

        this.widgets.push(w)
    }

    handleTextSubmit(text) {

        console.log("onsubmit", text)
        this.textinput.clear()

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
        let w = this.textinput
        w.rect.x = gEngine.view.width/2 - w.rect.w/2
        w.rect.y = gEngine.view.height - w.rect.h
    }

    update(dt) {
        for (const wgt of this.widgets) {
            wgt.update(dt)
        }
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