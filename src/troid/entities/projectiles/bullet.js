
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {registerDefaultEntity} from "@troid/entities/sys"

import { ProjectileBase, random_choice } from "./base.js";

import {MobBase} from "@troid/entities/mobs"

export class Bullet extends ProjectileBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0 - 1, props?.y??0 - 1, 2, 2)
        this.split = props?.split??1
        this.color = props?.color??0
        this.physics = new Physics2dPlatformV2(this,{
            bounds_check: Physics2dPlatformV2.BOUNDARY_DESTROY,
            /*slope_walk: false,*/
        })
        this.physics.gravity = 0
        this.physics.xfriction = 0
        this.solid = 0
        this.collide = 1
        this.visible = 1

        this.power = props?.power??0
        this.level = props?.level??1

        this.element = props?.element??WeaponType.ELEMENT.POWER

        this.trail = []

        if (!!props?.wave) {
            // don't collide with platforms
            this.physics.group = () => {return []}
        } else {
            this.physics.group = () => {
                return Object.values(this._x_debug_map.objects).filter(ent=>{
                    return ent?.solid
                })
            }
        }

        this.targets = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }

        this.alive = true

        this.animation = new AnimationComponent(this)
        this.buildAnimations()

        const d = props?.direction??Direction.RIGHT
        const v = Direction.vector(props?.direction??Direction.RIGHT)

        this.physics.speed.x = 0
        this.physics.speed.y = 0

        this.wave_counter = 0
        this.wave_loop = !!(props?.wave)

        let profile
        if (props?.wave == 2) {
            profile = Bullet.velocity_profile_spread2
        } else if (props?.wave == 1) {
            profile = Bullet.velocity_profile_wave
        } else {
            profile = Bullet.velocity_profile_spread
        }
        this.wave_profile = profile[d][this.split-1]

        this.bounce = !!(props?.bounce)
        this.bounce_max = props?.level??1
        this.bounce_counter = 0

        this.particles = [] // {x,y,dx,dy,size,color}
    }

    paint(ctx) {

        //ctx.save()
        //this.particles.forEach(p => {
        //    p.x += p.dx;
        //    p.y += p.dy;
        //    ctx.fillStyle = p.color
        //    ctx.beginPath();
        //    ctx.rect(p.x, p.y, p.size, p.size)
        //    ctx.fill()
        //    ctx.closePath();
        //})

        this.animation.paint(ctx)
        //gAssets.sheets.beams16.drawTile(ctx, this.color*7, this.rect.x - 8, this.rect.y - 8)
        //ctx.strokeStyle = this.color;
        //ctx.fillStyle = this.color;
        //ctx.beginPath();
        //ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.arc(this.rect.x+this.rect.w/2,
        //        this.rect.y+this.rect.h/2,2,0,2*Math.PI);
        //ctx.stroke();
        //ctx.fill();
        //ctx.restore()

        if (this.alive) {
            this.trail.forEach((p,i) => {
                gAssets.sheets.beams16.drawTile(ctx, this.color*7 + 1 + i, p.x - 8, p.y - 8)
            })
        }

        //this.trail.forEach((p,i) => {
        //    ctx.beginPath();
        //    ctx.fillStyle = this.color;
        //    ctx.moveTo(p.x, p.y)
        //    ctx.arc(
        //        p.x+this.rect.w/2,
        //        p.y+this.rect.h/2,
        //        2,
        //        0,2*Math.PI);
        //    ctx.closePath()
        //    ctx.fill();
        //})

    }

    update(dt) {

        this.animation.update(dt)

        if (!this.alive) {
            return
        }

        if (gEngine.frameIndex&1) {
            if (this.wave_counter < this.wave_profile.length) {
                this.physics.speed.x = this.wave_profile[this.wave_counter].x/dt
                this.physics.speed.y = this.wave_profile[this.wave_counter].y/dt
                this.wave_counter += 1
            }

            if (this.level > 1) {
                this.trail.unshift({x:this.rect.x, y:this.rect.y})
                while (this.trail.length > 2) {
                    this.trail.pop()
                }
            }

            this.physics.update(dt)
        }

        this.particles.push({
            x:this.rect.x, y:this.rect.y + 2 * (Math.random() - 0.5),
            dx:0, dy:Math.random()-0.5,
            size: 1,
            color: random_choice(["#e81202", "#e85702", "#e8be02"])
        })
        this.particles.push({
            x:this.rect.x, y:this.rect.y + 2 * (Math.random() - 0.5),
            dx:0, dy:2 * (Math.random() - 0.5),
            size:1,
            color: random_choice(["#e81202", "#e85702", "#e8be02"])
        })

        while (this.particles.length > 10) {
            this.particles.shift()
        }

        if (this.wave_loop && this.wave_counter >= this.wave_profile.length) {
            this.wave_counter = 0
        }

        for (const ent of this.targets()) {
            if (ent.character.alive && this.rect.collideRect(ent.rect)) {
                let props = {element: this.element, level:this.level, power: this.power, dot: false}
                if (ent.hit(this, props)) {
                    this._kill()
                }
            }
        }

        if (this.physics._x_step_collisions.b||
            this.physics._x_step_collisions.bn||
            this.physics._x_step_collisions.t||
            this.physics._x_step_collisions.tn||
            this.physics._x_step_collisions.f||
            this.physics._x_step_collisions.fn) {
            this._kill()
        }

    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = -8
        let yoffset = -8

        this.animations = {
            "idle": null,
            "dead": null,
        }

        let ncols = 7
        let nrows = 17
        let aid;

        this.animations["idle"] = this.animation.register(gAssets.sheets.beams16,
            [this.color*7 + 0,], spf, {xoffset, yoffset})

        this.animations["dead"] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations["idle"])

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

}

registerDefaultEntity("Bullet", Bullet, (entry)=> {

})