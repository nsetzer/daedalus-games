
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    PlatformerEntity,
    PlatformBase,
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {registerDefaultEntity} from "@troid/entities/sys"
import { ProjectileBase } from "./base.js";
import {MobBase} from "@troid/entities/mobs"

export class BounceBullet extends ProjectileBase {
    // a bounce bullet is only animate to appear as if it is bouncing
    // the bullet actually walks on the ground like a normal entity
    // if standing bounce the animation, otherwise do not animate the y direction


    // TODO: water should splash almost uselessly instead of bounce
    //       bubble should still be bubble bullets, but bounce off of walls and be pink
    //       level is number of bounces
    //       charge is size?
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect((props?.x??0) - 2, (props?.y??0) - 2, 4, 4)
        this.color = props?.color??0
        this.element = props?.element??WeaponType.ELEMENT.POWER
        this.power = props?.power??0

        this.physics = new Physics2dPlatformV2(this,{
            xmaxspeed1: 200,
            xmaxspeed2: 200,
            jumpheight: 20,
            jumpduration: .08,
            bounds_check: Physics2dPlatformV2.BOUNDARY_DESTROY,
        })
        this.physics.xfriction = 0
        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{
                // 
                return (ent instanceof PlatformBase || ent.solid)
                //return (ent instanceof PlatformBase || (ent.solid && !(ent instanceof MobBase)))
                //return ent.solid
            })
        }
        this.solid = 0
        this.collide = 1
        this.visible = 1

        this.animation = new AnimationComponent(this)

        let xspeed = 180 // a bit faster than players maximum speed
        switch (props?.direction??0) {
        case Direction.LEFT:
            this.physics.speed.x = -xspeed
            this.physics.speed.y = this.physics.jumpspeed
            break;
        case Direction.RIGHT:
            this.physics.speed.x = xspeed
            this.physics.speed.y = this.physics.jumpspeed
            break;
        case Direction.UPLEFT:
            this.physics.speed.x = -xspeed
            this.physics.speed.y = this.physics.jumpspeed*1.4 // enough to hit a battery gate bulb
            break;
        case Direction.UPRIGHT:
            this.physics.speed.x = xspeed
            this.physics.speed.y = this.physics.jumpspeed*1.4
            break;
        default:
            break;
        }

        this.buildAnimations()

        this.targets = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }


    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = -6
        let yoffset = -6

        this.animations = {
            "idle": null,
            "dead": null,
        }

        this.alive = true

        let ncols = 7
        let nrows = 17
        let aid;

        this.animations["idle"] = this.animation.register(gAssets.sheets.beams16,
            [this.color*7+4,this.color*7+5,this.color*7+6], spf, {xoffset, yoffset})

        this.animations["dead"] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations["idle"])
    }

    paint(ctx) {

        //ctx.fillStyle = "red"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.closePath()
        //ctx.fill()

        this.animation.paint(ctx)

        //gAssets.sheets.beams16.drawTile(ctx, 99, this.rect.x, this.rect.y)


    }

    _kill() {
        this.animation.setAnimationById(this.animations["dead"])
        this.physics.speed.x = 0
        this.physics.speed.y = 0
        this.alive = false
    }

    onDeathAnimationEnd() {
        this.destroy()
    }

    update(dt) {

        if (this.alive) {
            this.physics.update(dt)

            for (const ent of this.targets()) {
                if (this.rect.collideRect(ent.rect)) {
                    let props = {element: this.element, level:this.level, power: this.power, dot: false};
                    if (ent.hit(this, props)) {
                        this._kill()
                    }
                }
            }

            if (this.physics._x_step_collisions.b) {
            this._bounce()
            }

            if (this.physics._x_step_collisions.fn) {
                this._kill()
            }

        }
        this.animation.update(dt)



    }

    _bounce() {

        // bounces better when frozen
        // TODO: maybe it can do splash damage
        if (this.element == WeaponType.ELEMENT.WATER) {
            this._kill()
        } else {
            this.physics.speed.y = this.physics.jumpspeed
            this.physics.yaccum = 0
            this.physics.gravityboost = false
            this.physics.doublejump = true
        }
    }
}

registerDefaultEntity("BounceBullet", BounceBullet, (entry)=> {

})