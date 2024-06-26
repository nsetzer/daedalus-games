 


export class AnimationComponent {


    constructor(target) {
        this.target = target
        this.next_id = 1 // aid of zero is invalid
        this.animations = {}
        this.animation = null
        this.timer = 0
        this.frame_id = -1 // when changing animations,
                           // if frame id is the same,
                           // the frame index does not reset
        this.frame_index = 0
        this.aid = -1
        this.paused = 0

        this.effect = null // deprecated?

        if (this.target.visible === undefined) {
            console.error({"error": "target.visible not set", 
            className:this.target._classname, 
            target:this.target, 
            visible: ""+this.target.visible})
            this.target.visible = 1
        }
    }

    register(sheet, tids, frame_duration, params) {

        let aid = this.next_id
        let obj = {
            sheet,
            tids,
            frame_duration,
            xoffset: params.xoffset??0,
            yoffset: params.yoffset??0,
            loop: params.loop??true,
            onend: params.onend??null,
        }
        this.animations[aid] = obj
        this.next_id += 1
        return aid
    }

    setAnimationById(aid, frame_id=-1) {
        if (aid != this.aid) {

            if (aid === undefined || this.animations[aid] === undefined) {
                console.error("invalid aid")
            } else {
                this.timer = 0
                if (frame_id < 0 || (frame_id != this.frame_id)) {
                    this.frame_index = 0
                }
                this.frame_id = frame_id
                this.animation = this.animations[aid]
                this.aid = aid
            }
        }
        this.paused = 0
    }

    pause() {
        this.paused = 1
        this.frame_index = 0
    }

    update(dt) {

        if (this.animation && !this.paused) {
            //console.log(this.animation, this.pause)
            this.timer += dt
            if (this.timer > this.animation.frame_duration) {
                this.timer -= this.animation.frame_duration
                this.frame_index += 1

                if (this.frame_index >= this.animation.tids.length) {

                    if (!!this.animation.onend) {
                        this.animation.onend()
                    }


                    if (this.animation.loop) {
                        this.frame_index = 0
                    } else {
                        this.paused = 1
                    }
                }
            }
        }
    }

    paint(ctx) {
        if (this.animation && this.target.visible) {
            let tid = this.animation.tids[this.frame_index]
            let x = this.target.rect.x + this.animation.xoffset
            let y = this.target.rect.y + this.animation.yoffset

            ctx.save()
            this.effect?.(ctx)
            this.animation.sheet.drawTile(ctx, tid, x, y)
            ctx.restore()
        }

    }

    getState() {
        return [this.aid, this.timer, this.frame_index, this.paused]
    }

    setState(state) {
        [this.aid, this.timer, this.frame_index, this.paused] = state
        this.animation = this.animations[this.aid]
    }
}