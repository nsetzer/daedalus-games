
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {ProjectileBase, AbstractMobBase, registerDefaultEntity} from "@troid/entities/sys"

export class BubbleBullet extends ProjectileBase {
    constructor(entid, props) {
        super(entid, props)

        this.wave = (!!props?.wave)??0
        this.bounce = (!!props?.wave)??0
        this.element = props?.element??WeaponType.ELEMENT.POWER
        this.power = props?.power??0

        let base_speed = 100
        if (props?.power < .8) {
            this.rect = new Rect((props?.x??0) - 8, (props?.y??0) - 8, 16, 16)
            this.bubble_size = 1
        } else {
            this.rect = new Rect((props?.x??0) - 16, (props?.y??0) - 16 - 5, 32, 32)
            this.bubble_size = 2
            base_speed = 60
        }

        this.physics = new Physics2dPlatformV2(this, {
            bounds_check: Physics2dPlatformV2.BOUNDARY_DESTROY,
        })
        this.physics.gravity = 0
        this.physics.xfriction = 0

        if (this.wave) {
            this.physics.group = () => {return []}
        } else {
            this.physics.group = () => {
                return Object.values(this._x_debug_map.objects).filter(ent=>{
                    return ent instanceof PlatformBase})
            }
        }

        this.solid = 0
        this.visible = 1
        this.alive = true

        this.alive_timer = 0
        this.alive_duration = 3.0

        this.animation = new AnimationComponent(this)
        this.buildAnimations()

        let variance = (props?.variance)??Math.random()*this.rect.w*1.5

        switch (props?.direction??0) {
        case Direction.LEFT:
            this.physics.speed.x = -(base_speed + variance)
            break;
        case Direction.RIGHT:
            this.physics.speed.x = base_speed + variance
            break;
        case Direction.UPLEFT:
            this.physics.speed.x = -(base_speed + variance)
            this.physics.speed.x = .7071 * this.physics.speed.x
            this.physics.speed.y = this.physics.speed.x
            break;
        case Direction.UPRIGHT:
            this.physics.speed.x = base_speed + variance
            this.physics.speed.x = .7071 * this.physics.speed.x
            this.physics.speed.y = -this.physics.speed.x
            break;
        default:
            break;
        }


        this.targets = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=> ent instanceof AbstractMobBase)
        }

        // prevent colliding with the player when fired
        this.touch_timer = 0
        this.touch_duration = 0.25
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = 0
        let yoffset = 0

        this.animations = {
            "idle": null,
            "dead": null,
        }

        let ncols = 7
        let nrows = 17
        let aid;

        if (this.bubble_size == 1) {
            this.animations["idle"] = this.animation.register(
                gAssets.sheets.beams16,
                [17*ncols+0,17*ncols+1,17*ncols+2,17*ncols+1], spf, {xoffset, yoffset})
            this.animations["dead"] = this.animation.register(
                gAssets.sheets.beams16,
                [17*ncols+4,17*ncols+5,17*ncols+6],
                spf, {xoffset, yoffset, loop: false,
                onend: this.onDeathAnimationEnd.bind(this)})
        } else {
            this.animations["idle"] = this.animation.register(
                gAssets.sheets.beams32,
                [0,1,2,1], spf, {xoffset, yoffset})
            this.animations["dead"] = this.animation.register(
                gAssets.sheets.beams32,
                [3,4,5],
                spf, {xoffset, yoffset, loop: false,
                onend: this.onDeathAnimationEnd.bind(this)})
        }

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
        gAssets.sfx.BEAM_BUBBLE_POP.play()

        this.animation.setAnimationById(this.animations["dead"])
        this.alive = false
    }

    onDeathAnimationEnd() {
        this.destroy()
    }

    update(dt) {

        if (this.alive) {

            this.alive_timer += dt

            this.physics.update(dt)

            if (this.alive_timer > this.alive_duration) {
                this._kill()
            }

            if (this.physics.speed.x >= 0) {
                this.physics.speed.x -= 50 * dt
                this.physics.speed.y -= 10 * dt

                // todo use timer to destroy
                //if (this.physics.speed.x < 5) {
                //    this._kill()
                //}
            }

            if (this.physics.speed.x <= 0) {
                this.physics.speed.x += 50 * dt
                this.physics.speed.y -= 10 * dt
                // todo use timer to destroy
                //if (this.physics.speed.x > -5) {
                //    this._kill()
                //}
            }

            if (!this.bounce && (this.physics._x_step_collisions.b||this.physics._x_step_collisions.t||this.physics._x_step_collisions.fn)) {
                this._kill()
            }


            for (const ent of this.targets()) {
                if (ent.rect == undefined) {
                    console.log(ent)
                }
                if (this.rect.collideRect(ent.rect)) {
                    ent.hit(this, {element: this.element, level:this.level, power:this.power, dot: false})
                    this._kill()
                }
            }


            if (this.touch_timer < this.touch_duration) {
                this.touch_timer += dt
            } else {
                let objs = this._x_debug_map.queryObjects({"className": "Player"})
                if (objs.length > 0) {
                    let player = objs[0]

                    if (this.rect.collideRect(player.rect)) {
                        if (this.bubble_size == 2 && player.rect.cy() < this.rect.cy()) {
                            player._bounce()
                        }
                        this._kill()
                    }
                }
            }



        }

        let [camx,camy,camw,camh] = [gEngine.scene.camera.x, gEngine.scene.camera.y, gEngine.scene.camera.width, gEngine.scene.camera.height];

        if (this.rect.cx() < camx || 
            this.rect.cx() > camx + camw ||
            this.rect.cy() < camy ||
            this.rect.cy() > camy + camh) {
                this.destroy() // no animation
        }

        this.animation.update(dt)

    }


    collide(other, dx, dy) {

        if (this.bubble_size == 2) {
            let rect = other.rect
            let update = rect.copy()

            if (dy > 0 && rect.bottom() <= this.rect.top()) {
                if (other instanceof Player) {
                    other._bounce()
                    this._kill()
                    return null
                }
            }
        }


        return null
    }
}

registerDefaultEntity("BubbleBullet", BubbleBullet, (entry)=> {

})
