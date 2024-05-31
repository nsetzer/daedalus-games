


export class TextTyper {
    //TODO: support multiple pages
    //TODO: support typing one letter at a time
    //TODO: auto advance and text type time controllable in settings (slow, medium, fast)
    //TODO: page duration a function of the content
    constructor(text) {

        this.lines = text.split('\n');

        this.state = 0

        this.timer_show = 0
        this.timer_show_duration = 0.5

        this.timer_page = 0
        this.timer_page_duration = 3

        this.modal = 0 // set to true to block gameplay
        this.cbk_exit = null

        
    }

    setModal(modal) {
        this.modal = modal
    }

    setExitCallback(callback) {
        this.cbk_exit = callback
    }

    paint(ctx) {

        let x = 0 //gEngine.scene.camera.x
        let y = 48 //gEngine.scene.camera.y + 48
        let w = gEngine.view.width - 16
        let h = 48

        if (this.state == 0 || this.state == 2) {
            w *= this.timer_show/this.timer_show_duration
            ctx.beginPath()
            ctx.fillStyle = "#000000c0"
            ctx.rect(x + gEngine.view.width/2 - w/2, y, w, h)
            ctx.closePath()
            ctx.fill()
        } else if (this.state == 1) {
            ctx.beginPath()
            ctx.fillStyle = "#000000c0"
            let l = x + gEngine.view.width/2 - w/2
            ctx.rect(l, y, w, h)
            ctx.fill()

            // TODO: word break the lines using ctx.measureText
            //let metrics = ctx.measureText(this.lines[i]);
            //console.log(`Length of line ${i}: ${metrics.width} pixels`);

            // TODO: use a custom font

            ctx.beginPath()
            ctx.font = "8px Verdana";
            ctx.fillStyle = "white"
            ctx.strokeStyle = "white"
            ctx.textAlign = "left"
            ctx.textBaseline = "top"

            let x1 = l + 8
            let y1 = y + 8
            let lineHeight = 10;
            for (let i = 0; i < this.lines.length; i++) {
                ctx.fillText(this.lines[i], x1, y1 + i * lineHeight);
            }
        }
    }

    dismiss() {
        if (this.state < 2) {
            this.timer_show = this.timer_show_duration
            this.timer_page = this.timer_page_duration
            this.state = 2 // dismiss
        }
    }

    update(dt) {
        if (this.state == 0) {
            this.timer_show += dt
            if (this.timer_show > this.timer_show_duration) {
                this.timer_show = this.timer_show_duration
                this.state = 1 // show text
            }
        } else if (this.state == 1) {
            this.timer_page += dt
            if (this.timer_page > this.timer_page_duration) {
                this.timer_show = this.timer_show_duration
                this.timer_page = this.timer_page_duration
                this.state = 2 // dismiss
            }

        } else if (this.state == 2) {

            this.timer_show -= dt
            if (this.timer_show < 0) {
                this.state = 3 // hide
                this.cbk_exit?.()
            }
        }
    }
}
