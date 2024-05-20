
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"

import {MobBase} from "./base.js"


export class Creeper extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 14)
        this.visible = true
        this.solid = 0

        this.animation = new AnimationComponent(this)

        this.physics = new Physics2dPlatformV2(this,{
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
        })

        this.physics.moving_direction = Direction.LEFT

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }


        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/16
        let xoffset = - 2
        let yoffset = - 6

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "ball":{},
            "dead":{},
            "dead2":{}
        }

        let sheet = Creeper.sheet
        let ncols = sheet.cols
        let nrows = sheet.rows
        let aid;

        aid = this.animation.register(sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [0*ncols+0, 0*ncols+1, 0*ncols+2, 0*ncols+1, 0*ncols+0, 0*ncols+3, 0*ncols+4, 0*ncols+3], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+0, 1*ncols+1, 1*ncols+2, 1*ncols+1, 1*ncols+0, 1*ncols+3, 1*ncols+4, 1*ncols+3], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            sheet,
            [3*ncols+1, 3*ncols+2, 3*ncols+3, 3*ncols+4],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        // flat then poof
        this.animations["dead2"][Direction.NONE] = this.animation.register(
            sheet,
            [3*ncols+0, 3*ncols+0, 3*ncols+0, 3*ncols+1, 3*ncols+2, 3*ncols+3, 3*ncols+4],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations.run[Direction.LEFT])

    }

    paint(ctx) {
        //Brick.icon.draw(ctx, this.rect.x, this.rect.y)

        this.animation.paint(ctx)

        //ctx.fillStyle = "red"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.closePath()
        //ctx.fill()


        /*
        ctx.font = "bold 16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        let s3 = this.physics._x_prev_summary.standing
        ctx.fillText(`${Math.floor(this.physics.speed.y)} ${this.physics.moving_direction} ${s3}`, this.rect.x, this.rect.y-12);
        */
    }

    update(dt) {
        if (!this.character.frozen && this.character.alive) {
            this.physics.update(dt)

            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]

                if (this.rect.collideRect(player.rect)) {
                    if (player.physics.speed.y > 0 && player.rect.bottom() < this.rect.cy()) {
                        player._bounce()
                        this._kill2()
                    } else {
                        player.character.hit()
                    }
                }

            }

            if (this.physics._x_step_collisions.fn) {
                this.physics.moving_direction = (this.physics.moving_direction == Direction.LEFT)?Direction.RIGHT:Direction.LEFT
                this.animation.setAnimationById(this.animations.run[this.physics.moving_direction])
                this.physics.speed.x = 0
                this.physics.xaccum = 0
                //console.log(this.physics.speed.x, this.physics.moving_direction)
                this.physics._x_step_collisions.fn = 0
            }

        }

        this.character.update(dt)
        this.solid = this.character.frozen
        
        this.animation.update(dt)

    }

    _kill() {
        this.character.alive = false
        this.animation.setAnimationById(this.animations["dead"][Direction.NONE])
    }

    _kill2() {
        this.character.alive = false
        this.animation.setAnimationById(this.animations["dead2"][Direction.NONE])
    }

    onDeathAnimationEnd() {
        this.destroy()
    }
}

registerEditorEntity("Creeper", Creeper, [16,16], EntityCategory.small_mob, null, (entry)=> {
    Creeper.sheet = gAssets.sheets.creeper
    entry.icon = makeEditorIcon(Creeper.sheet)
    entry.editorIcon = null
    entry.editorSchema = []
})
