

import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"

import {MobBase} from "./base.js"


// TODO: water element should heal this entity
// TODO: animation for slamming the ground
//       half second pulling back, then swing forward
//       two variations, one for when on flat ground, one for when on top of a warp pipe
//       i.e. flat, or raised two blocks
// TODO: animation of vine growing when player first nears. inclue tomato head growing
// TODO: separate animation of head and vine
export class Tomato extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 32, 32)

        this.visible = true
        this.animation = new AnimationComponent(this)

        this.breakable = 0
        this.solid = 0

        this.buildAnimations()

        this.player_near = false

        this.dialog = null
        this.helpText = props?.helpText??"default help text"
    }

    buildAnimations() {

        let spf = .2
        let xoffset = -8
        let yoffset = -16

        this.animations = {
            "idle":{},
            "talk":{},
            "dead":{},
        }

        let sheet = gAssets.sheets.tomato
        let ncols = sheet.cols
        let nrows = sheet.rows
        let aid;

        aid = this.animation.register(sheet, [0,1,2,3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [4,5,6,7], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [0,1,2,3], spf, {xoffset, yoffset})
        this.animations["talk"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [4,5,6,7], spf, {xoffset, yoffset})
        this.animations["talk"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset:8, yoffset:8, loop: false, 
                onend: this.onDeathAnimationEnd.bind(this)})



        this.animation.setAnimationById(this.animations.idle[Direction.LEFT])

    }

    paint(ctx) {
        this.animation.paint(ctx)
    }

    update(dt) {

        if (!this.character.frozen && this.character.alive) {

            let player_near = false
            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]

                let x1 = player.rect.cx()
                let x2 = this.rect.cx()

                let y1 = player.rect.cy()
                let y2 = this.rect.cy()

                let d = Math.sqrt(Math.pow(x1 - x2,2) + Math.pow(y1 - y2, 2))

                if (d < 16 * 3) {
                    player_near = true
                }

                if (this.player_near != player_near) {
                    if (player_near) {
                        this.animation.setAnimationById(this.animations.talk[this.facing])
                    } else {
                        this.animation.setAnimationById(this.animations.idle[this.facing])
                    }
                    this.player_near = player_near
                }

                if (player.rect.cx() < this.rect.cx()) {
                    this.facing = Direction.LEFT
                } else {
                    this.facing = Direction.RIGHT
                }

                this.animation.setAnimationById(this.animations.idle[this.facing])

                if (this.rect.collideRect(player.rect)) {
                    player.character.hit()
                }
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

    onDeathAnimationEnd() {
        this.destroy()
    }

}

registerEditorEntity("Tomato", Tomato, [32,32], EntityCategory.small_mob, null, (entry)=> {
    entry.icon = makeEditorIcon(gAssets.sheets.tomato)
    entry.editorIcon = null
    entry.editorRender = (ctx,x,y,props) => {
        let tid = 0
        return gAssets.sheets.tomato.tile(tid).draw(ctx, x-8, y-16)
    }
    entry.editorSchema = [
    ]
})