 
include "./primitives.js"

export class Physics2d {

    constructor(target) {
        this.target = target

        this.xspeed = 0
        this.yspeed = 0

        this.ximpulse = 0
        this.yimpulse = 0

        this.group = []

        this.map_width = 20*32
        this.map_height = 10*32

        // properties that are updated on every update()
        this.xcollide = false
        this.ycollide = false
        this.collide = false
        this.collisions = new Set()
    }

    collidePoint(x, y) {
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && this.group[i].rect.collidePoint(x, y)) {
                return this.group[i]
            }
        }
        return null
    }

    impulse(dx, dy) {
        this.ximpulse = dx
        this.yimpulse = dy
    }

    update(dt) {

        this.xcollide = false
        this.ycollide = false
        this.collide = false
        this.collisions = new Set()

        let rect, solid;
        let dx, dy
        if (this.ximpulse != 0 || this.yimpulse != 0) {
            dx = dt*this.ximpulse
            dy = dt*this.yimpulse

            // this.ximpulse -= Math.sign(this.ximpulse)*2
            // this.yimpulse -= Math.sign(this.yimpulse)*2

            this.ximpulse *= .95
            this.yimpulse *= .95

            // less than half fps
            if (Math.abs(this.ximpulse) < 30) {
                this.ximpulse = 0
            }

            if (Math.abs(this.yimpulse) < 30) {
                this.yimpulse = 0
            }

        } else {
            dx = dt*this.xspeed
            dy = dt*this.yspeed
        }


        // move x
        rect = new Rect(
            this.target.rect.x + dx,
            this.target.rect.y,
            this.target.rect.w,
            this.target.rect.h,
        )

        solid = false;
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && rect.collideRect(this.group[i].rect)) {
                this.collisions.add(this.group[i])
                solid = true
                break;
            }
        }

        if (!solid) {
            this.target.rect = rect
        } else {
            this.xcollide = true
        }

        // move y
        rect = new Rect(
            this.target.rect.x,
            this.target.rect.y + dy,
            this.target.rect.w,
            this.target.rect.h,
        )

        solid = false;
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && rect.collideRect(this.group[i].rect)) {
                this.collisions.add(this.group[i])
                solid = true
                break;
            }
        }

        if (!solid) {
            this.target.rect = rect
        }  else {
            this.ycollide = true
        }

        this.collide = this.xcollide || this.ycollide

        // bounds check
        /*
        if (this.target.rect.x < 0) {
            this.target.rect.x = 0
        }

        if (this.target.rect.x > this.map_width - this.target.rect.w) {
            this.target.rect.x = this.map_width - this.target.rect.w
        }

        if (this.target.rect.y < 0) {
            this.target.rect.y = 0
        }

        if (this.target.rect.y > this.map_height - this.target.rect.h) {
            this.target.rect.y = this.map_height - this.target.rect.h
        }
        */

    }
}

export class AnimationComponent {


    constructor(target) {
        this.target = target
        this.next_id = 0
        this.animations = {}
        this.animation = null
        this.timer = 0
        this.frame_index = 0
        this.aid = -1
        this.paused = 0

        this.effect = null
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

    setAnimationById(aid) {
        if (aid != this.aid) {

            if (aid === undefined || this.animations[aid] === undefined) {
                console.error("invalid aid")
            } else {
                this.timer = 0
                this.frame_index = 0
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

        if (this.animation && this.paused===0) {
            //console.log(this.animation, this.pause)
            this.timer += dt
            if (this.timer > this.animation.frame_duration) {
                this.timer -= this.animation.frame_duration
                this.frame_index += 1

                if (this.frame_index >= this.animation.tids.length) {

                    this.animation.onend?.()

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
        if (this.animation) {
            let tid = this.animation.tids[this.frame_index]
            let x = this.target.rect.x + this.animation.xoffset
            let y = this.target.rect.y + this.animation.yoffset

            ctx.save()
            this.effect?.(ctx)
            this.animation.sheet.drawTile(ctx, tid, x, y)
            ctx.restore()
        }

    }
}

export class CharacterComponent {

    constructor(target) {
        this.target = target
        this.alive = true
        this.health = 3

        this.hurt_timer = 0
        this.hurt_period = .5
        this.hurt_cooldown = 0

    }

    update(dt) {

        if (this.hurt_timer > 0) {
            this.hurt_timer -= dt

            if (this.hurt_timer < 0 && this.health <= 0) {
                this.alive = false
            }
        }

        if (this.hurt_cooldown > 0) {
            this.hurt_cooldown -= dt
        }

    }

    hit(power, direction) {
        if (this.hurt_cooldown > 0 || this.health <= 0) {
            return
        }

        this.hurt_cooldown = this.hurt_period + .25
        this.hurt_timer = this.hurt_period
        this.health -= power

        if (direction > 0) {
            let vector = Direction.vector(direction)
            this.target.physics.impulse(vector.x*100, vector.y*100)
        }

        this.target.animation.effect = (ctx) => {

            if (this.hurt_timer <= 0) {
                this.target.animation.effect = null
            }
            let x;
            x = (this.hurt_timer>this.hurt_period/2)?this.hurt_period-this.hurt_timer:this.hurt_timer
            x = Math.floor(100 + 200*x)
            ctx.filter = `brightness(${x}%) hue-rotate(-90deg)`


        }

        if (this.health <= 0 && !!this.target.sound_death) {
            this.target.sound_death.play()
        } else {
            this.target.sound_hit.play()
        }
    }
}

export class Entity {

    constructor() {
        this.entid = -1
        this.active = true // in view, can update and paint
        this.solid = true
        this.visible = true
        this.layer = 0

        this.rect = new Rect(0, 0, 0, 0)

        this.physics = new Physics2d(this)
        this.animation = new AnimationComponent(this)
    }

    update(dt) {

        this.physics.update(dt)
        this.animation.update(dt)
    }

    paint(ctx) {
        this.animation.paint(ctx)
    }
}

export class CameraBase {

    constructor() {
        this.dirty = true

    }

    resize() {

    }

    update(dt) {

    }

    activeRegion() {
        return new Rect(0,0,0,0)
    }
}

export class EntityComponentSystem {

    constructor(camera) {
        this.next_entid = 1;

        this.camera = camera

        this.entities = []
        this.active = []

        this.cache = {}

    }

    update(dt) {

        this.cache.visible = undefined
        this.cache.solid = undefined

        if (this.camera.dirty) {

            this.active = []

            let region = this.camera.activeRegion()

            for (let i=0; i < this.entities.length; i++) {
                let ent = this.entities[i]
                ent.active = region.collideRect(ent.rect);
                if (ent.active) {
                    this.active.push(ent)
                }
            }

            this.camera.dirty = false
        }

    }

    addEntity(ent) {
        ent.entid = this.next_entid
        this.next_entid += 1
        this.entities.push(ent)
    }

    visible() {

        if (this.cache.visible === undefined) {
            this.cache.visible = []
            for (let i=0; i< this.cache.active; i++) {
                if (this.cache.active[i].visible) {
                    this.cache.visible.push(this.cache.active[i])
                }
            }
        }

        return this.cache.visible

    }

    solid() {

        if (this.cache.solid === undefined) {
            this.cache.solid = []
            for (let i=0; i< this.cache.active; i++) {
                if (this.cache.active[i].solid) {
                    this.cache.solid.push(this.cache.active[i])
                }
            }
        }

        return this.cache.solid

    }

}