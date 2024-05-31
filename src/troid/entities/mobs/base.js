import {
    PlatformerEntity,
} from "@axertc/axertc_physics"
import {WeaponType} from "@troid/store"
import {AbstractMobBase} from "@troid/entities/sys"

export class MobCharacterComponent {

    constructor(target) {
        this.target = target
        this.health = 300
        this.alive = true

        this.frozen = false

        this.hurt_timer = 0
        this.hurt_cooldown = 0

        this.freeze_timer = 0
        this.freeze_duration = 10

        this.animation_timer = 0
        this.animation_duration = 0.2
        this.hurt_period = this.animation_duration * 1

    }

    update(dt) {

        if (this.freeze_timer > 0) {
            this.freeze_timer -= dt
            if (this.freeze_timer <= 0) {
                this.freeze_timer = 0
                this.frozen = false
                this.target.animation.paused = false
            }
        }

        if (this.hurt_timer > 0) {
            this.hurt_timer -= dt
            this.animation_timer += dt

            if (this.animation_timer > this.animation_duration) {
                this.animation_timer -= this.animation_duration
            }

            //if (this.hurt_timer < 0 && this.health <= 0) {
            //    this.alive = false
            //    console.log("set animation", this.target.animations["dead"][Direction.NONE])
            //    this.target.setAnimationById(this.target.animations["dead"][Direction.NONE])
            //    //this.target.destroy()
            //}
        }

        if (this.hurt_cooldown > 0) {
            this.hurt_cooldown -= dt
        }

    }

    hit(attrs) {

        // dot for attacks that deal damage over time
        // allow every individual beam to deal damage
        // prevent water stream from dealing damage every frame
        if (attrs.dot) {
            if (this.hurt_cooldown > 0 || this.health <= 0) {
                return
            }
        }

        if (attrs?.element == WeaponType.ELEMENT.ICE) {
            this.frozen = true
            this.target.animation.paused = true
            this.freeze_timer = this.freeze_duration

            this.hurt_cooldown = .25
            this.hurt_timer = this.hurt_period

        } else if (attrs.dot) {
            // dot should have a per source cooldown
            this.hurt_cooldown = 0.2
            this.hurt_timer = 0.2
            this.animation_timer = 0
        } else {
            this.hurt_cooldown = this.hurt_period + .25
            this.hurt_timer = this.hurt_period
            this.animation_timer = 0
        }

        // every enemy needs a element profile
        // how much damage it takes from each attack element
        // every element needs a base damage
        const damage = 100
        this.health -= damage
        console.error(`hit ${gEngine.frameIndex} - ${this.target._classname} for ${damage}` )

        if (this.health <= 0) {
            this.target._kill()
        }

        this.target.animation.effect = (ctx) => {

            if (this.frozen) {
                let x;
                let d = this.animation_duration / 2
                x = ((this.animation_timer>d)?this.animation_duration-this.animation_timer:this.animation_timer)/d
                ctx.filter = `brightness(75%) hue-rotate(-90deg)`
            } else {
                if (this.hurt_timer <= 0) {
                    this.target.animation.effect = null
                }

                let x;
                let d = this.animation_duration / 2
                x = ((this.animation_timer>d)?this.animation_duration-this.animation_timer:this.animation_timer)/d
                ctx.filter = `brightness(${Math.floor(100 + 100*x)}%) hue-rotate(${90*(1-x)}deg)`

            }



        }

        //if (this.health <= 0 && !!this.target.sound_death) {
        //    this.target.sound_death.play()
        //} else {
        //    this.target.sound_hit.play()
        //}
    }
}

export class MobBase extends AbstractMobBase {
    constructor(entid, props) {
        super(entid, props)

        this.character = new MobCharacterComponent(this)
    }

    hit(projectile, props) {
        // return true if the projectile collides
        this.character.hit(props)
        return true
    }

    _kill() {
        this.character.alive = false
    }
}
