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

class JumpingJackPhysics {

    constructor(target) {
        this.target = target

        this.ystart = target.rect.y

        this.speed = {x: 0, y: 0}
        this.accum = {x: 0, y: 0}

        this.standing = true

        this._init_gravity()
    }

    _init_gravity() {
        this.jumpheight = 64
        this.jumpduration = 0.22
        this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)
    }

    update(dt) {
        if (!this.standing) {
            this.speed.y += (this.gravity*dt)

            this.accum.y = dt * this.speed.y
            let dy = Math.trunc(this.accum.y)
            this.target.rect.y += dy
            this.accum.y -= dy

            if (this.target.rect.y > this.ystart) {
                this.target.rect.y = this.ystart
                this.speed.y = 0
                this.standing = true
            }
        }

    }

    jump() {
        this.speed.y = this.jumpspeed
        this.standing = false
    }

}

export class JumpingJack extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.rect2 = new Rect(this.rect.x - 2*16, this.rect.y - 16, 5*16, 8)

        this.visible = true
        this.animation = new AnimationComponent(this)

        this.physics = new JumpingJackPhysics(this)

        this.breakable = 0
        this.solid = 0

        this.buildAnimations()

        this.player_near = false

        this.dialog = null
        this.helpText = props?.helpText??"default help text"
    }

    buildAnimations() {

        let spf = .2
        let xoffset = -2
        let yoffset = 0

        this.animations = {
            "idle":{},
            "jump":{},
            "dead":{},
        }

        let sheet = gAssets.sheets.jumpingjack
        let ncols = sheet.cols
        let nrows = sheet.rows
        let aid;

        aid = this.animation.register(sheet, [0,], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.NONE] = aid

        aid = this.animation.register(sheet, [0,1,2,1], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.NONE] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset:8, yoffset:8, loop: false, 
                onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations.idle[Direction.NONE])
    }

    paint(ctx) {
        this.animation.paint(ctx)
    }


    update(dt) {

        if (!this.character.frozen && this.character.alive) {

            this.physics.update(dt)

            let player_near = false
            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]

                if (this.rect.collideRect(player.rect)) {
                    player.character.hit(this)
                }


                if (this.rect2.collideRect(player.rect)) {
                    
                    this.jumping = true
                    this.animation.setAnimationById(this.animations.jump[Direction.NONE])

                    if (this.physics.standing) {
                        this.physics.jump()
                    }
                } else {
                    this.jumping = false
                    this.animation.setAnimationById(this.animations.idle[Direction.NONE])
                }
            }

        }

        this.character.update(dt)
        this.solid = this.character.frozen
        
        this.animation.update(dt)
    }

    _kill() {
    }

    _kill2() {
    }

    onDeathAnimationEnd() {
        this.destroy()
    }

}

registerEditorEntity("JumpingJack", JumpingJack, [16,16], EntityCategory.small_mob, null, (entry)=> {
    entry.icon = makeEditorIcon(gAssets.sheets.jumpingjack)
    entry.editorIcon = null
    entry.editorRender = null
    entry.editorSchema = []
})