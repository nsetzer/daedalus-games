
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent,
    PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {registerDefaultEntity} from "@troid/entities/sys"

// TODO: projectiles reduce framerate if they move off screen on large maps
function generateProjectiles(x,y,direction, power) {
    // x,y: center to generate project at
    // direction: direction projectile will travel
    // power: charge percent

    let projectiles = []

    let color = 0

    switch (gCharacterInfo.element) {
    case WeaponType.ELEMENT.POWER:
        color = 1 // yellow
        break;
    case WeaponType.ELEMENT.FIRE:
        color = 0  // red
        break;
    case WeaponType.ELEMENT.WATER:
        color = 3  // red
        break;
    case WeaponType.ELEMENT.ICE:
        color = 2
        break;
    case WeaponType.ELEMENT.BUBBLE:
        color = 4
        break;
    }

    let element = gCharacterInfo.element

    // booleans
    let wave : bool = (gCharacterInfo.beam === WeaponType.BEAM.WAVE)?1:0
    let bounce : bool = gCharacterInfo.beam === WeaponType.BEAM.BOUNCE

    let normal = gCharacterInfo.modifier == WeaponType.MODIFIER.NORMAL

    // one of LEVEL1, LEVEL2, LEVEL3
    let level = gCharacterInfo.level

    // ice should generate 1 projectile, which may animate with a split profile
    // fire + wave + any level + no modifier : spread gun 1,3,5 bullets
    // fire + bounce + any level + no modifier : bouncy fire ball
    // water + any beam + any level + rapid : squirt gun
    // bubble + charge : large bubbles that can be jumped on


    if (gCharacterInfo.element == WeaponType.ELEMENT.FIRE && wave && normal) {

        wave = 2
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
        if (gCharacterInfo.level >= WeaponType.LEVEL.LEVEL2) {
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
        }
        if (gCharacterInfo.level >= WeaponType.LEVEL.LEVEL3) {
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:4}})
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:5}})
        }

    }
    else if (gCharacterInfo.element == WeaponType.ELEMENT.BUBBLE) {
        projectiles.push({name: "BubbleBullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (bounce) {
        projectiles.push({name: "BounceBullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (wave && gCharacterInfo.level == WeaponType.LEVEL.LEVEL1) {
        // a single bullet the waves
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (bounce || gCharacterInfo.level == WeaponType.LEVEL.LEVEL1) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
    }
    else if (gCharacterInfo.level == WeaponType.LEVEL.LEVEL2) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (gCharacterInfo.level == WeaponType.LEVEL.LEVEL3) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    } else {
        throw {error: "invalid level", level: gCharacterInfo.level}
    }

    return projectiles
}

export class CharacterComponent {

    constructor(target) {
        this.target = target
        this.alive = true
        this.health = 3

        this.hurt_timer = 0
        this.hurt_cooldown = 0

        this.animation_timer = 0
        this.animation_duration = 0.4
        this.hurt_period = this.animation_duration * 3

    }

    update(dt) {

        if (this.hurt_timer > 0) {
            this.hurt_timer -= dt
            this.animation_timer += dt

            if (this.animation_timer > this.animation_duration) {
                this.animation_timer -= this.animation_duration
            }

            if (this.hurt_timer < 0 && this.health <= 0) {
                this.alive = false
            }
        }

        if (this.hurt_cooldown > 0) {
            this.hurt_cooldown -= dt
        }

    }

    hit() {
        if (this.hurt_cooldown > 0 || this.health <= 0) {
            return
        }

        this.hurt_cooldown = this.hurt_period + .25
        this.hurt_timer = this.hurt_period
        this.animation_timer = 0

        this.target.animation.effect = (ctx) => {

            if (this.hurt_timer <= 0) {
                this.target.animation.effect = null
            }
            let x;
            let d = this.animation_duration / 2
            x = ((this.animation_timer>d)?this.animation_duration-this.animation_timer:this.animation_timer)/d
            ctx.filter = `brightness(${Math.floor(100 + 100*x)}%) hue-rotate(-${90*(1-x)}deg)`

        }

        //if (this.health <= 0 && !!this.target.sound_death) {
        //    this.target.sound_death.play()
        //} else {
        //    this.target.sound_hit.play()
        //}
    }
}

export class Player extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 8, 24)
        this.playerId = props?.playerId??null

        this.physics = new Physics2dPlatformV2(this,{
            xmaxspeed1: 150,
            xmaxspeed2: 175,
            oneblock_walk: true
        })

        this.visible = true
        this.animation = new AnimationComponent(this)

        this.spawning = false // spawning or despawning, lose direct control

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.physics.fluid_group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.fluid})
        }

        this.character = new CharacterComponent(this)

        this.looking_up = false

        //this.buildAnimations()
        this.buildAnimations2()

        this.current_action = "idle"
        this.current_facing = Direction.RIGHT

        this.charge_duration = 0.0
        this.charge_timeout = 1.1
        this.charge_count = 1.1
        this.charging = false

        this.jump_pressed = false

        this._x_input = {x:0,y:0}

        this.morphed = false

        this._beam = null

        this.alive = true

        this.direction = Direction.NONE

        this.dead_timer = 0

    }

    buildAnimations2() {

        let spf = .1
        let spf2 = 1/12
        let xoffset = - 12
        let yoffset = - 7
        let yoffset2 = - 19

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "spawn":{},
            "morphed":{"idle": {}, "run": {}},
            "morph":{},
            "unmorph":{},
        }

        let aid;
        const sheet = Player.sheet

        const idle = (row) => [(row*sheet.cols + 0)]
        const walk = (row) => [...Array(8).keys()].map(i => (row*sheet.cols + i))
        const jump = (row) => [(row*sheet.cols + 2)]
        const fall = (row) => [(row*sheet.cols + 2)]
        const hurt = (row) => [(4*sheet.cols + 2)]
        const spawn = (row) => [(4*sheet.cols + 1)]
        const ball1 = () => [0,1,2,3].map(i => (7*sheet.cols + i))
        const ball2 = () => [0,3,2,1].map(i => (7*sheet.cols + i))
        const ball_idle = () => [(7*sheet.cols + 0)]
        const morph = (row) => [...Array(10).keys()].map(i => ((5+row)*sheet.cols + i))
        const unmorph = (row) => [...Array(10).keys()].map(i => ((5+row)*sheet.cols + i)).reverse()

        aid = this.animation.register(sheet, idle(0), spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, idle(1), spf, {xoffset, yoffset})
        this.animations["idle"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, idle(2), spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, idle(3), spf, {xoffset, yoffset})
        this.animations["idle"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, walk(0), spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, walk(1), spf, {xoffset, yoffset})
        this.animations["run"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, walk(2), spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, walk(3), spf, {xoffset, yoffset})
        this.animations["run"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, jump(0), spf, {xoffset, yoffset})
        this.animations["jump"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, jump(1), spf, {xoffset, yoffset})
        this.animations["jump"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, jump(2), spf, {xoffset, yoffset})
        this.animations["jump"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, jump(3), spf, {xoffset, yoffset})
        this.animations["jump"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, fall(0), spf, {xoffset, yoffset})
        this.animations["fall"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, fall(1), spf, {xoffset, yoffset})
        this.animations["fall"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, fall(2), spf, {xoffset, yoffset})
        this.animations["fall"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, fall(3), spf, {xoffset, yoffset})
        this.animations["fall"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, hurt(0), spf, {xoffset, yoffset})
        this.animations["hit"][Direction.RIGHT] = aid
        this.animations["hit"][Direction.LEFT] = aid
        this.animations["hit"][Direction.UPRIGHT] = aid
        this.animations["hit"][Direction.UPLEFT] = aid

        this.animations["spawn"][Direction.RIGHT] = this.animations["run"][Direction.RIGHT]
        this.animations["spawn"][Direction.LEFT] = this.animations["run"][Direction.LEFT]
        aid = this.animation.register(sheet, spawn(0), spf, {xoffset, yoffset})
        this.animations["spawn"][Direction.UP] = aid
        this.animations["spawn"][Direction.DOWN] = aid

        aid = this.animation.register(sheet, morph(0), spf/2, {xoffset, yoffset, loop: false, onend: this.onMorphEnd.bind(this)})
        this.animations["morph"][Direction.RIGHT] = aid
        this.animations["morph"][Direction.UPRIGHT] = aid
        aid = this.animation.register(sheet, morph(1), spf/2, {xoffset, yoffset, loop: false, onend: this.onMorphEnd.bind(this)})
        this.animations["morph"][Direction.LEFT] = aid
        this.animations["morph"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, unmorph(0), spf/2, {xoffset, yoffset, loop: false, onend: this.onUnmorphEnd.bind(this)})
        this.animations["unmorph"][Direction.RIGHT] = aid
        this.animations["unmorph"][Direction.UPRIGHT] = aid
        aid = this.animation.register(sheet, unmorph(1), spf/2, {xoffset, yoffset, loop: false, onend: this.onUnmorphEnd.bind(this)})
        this.animations["unmorph"][Direction.LEFT] = aid
        this.animations["unmorph"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, ball_idle(), spf, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, ball_idle(), spf, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, ball1(), spf2, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, ball2(), spf2, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.RIGHT] = aid

        this.animation.setAnimationById(this.animations.run[Direction.RIGHT])

        this.weapon_offset = {}
        this.weapon_offset[Direction.RIGHT]   = {x: 12, y: 12}
        this.weapon_offset[Direction.UPRIGHT] = {x: 12, y:  3}
        this.weapon_offset[Direction.LEFT]    = {x: -8 + 3, y: 12}
        this.weapon_offset[Direction.UPLEFT]  = {x: -6, y:  3}

    }

    buildAnimations() {

        let spf = 1/8
        let spf2 = 1/12
        let xoffset = - 12
        let yoffset = - 7
        let yoffset2 = - 19

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "spawn":{},
            "morphed":{"idle": {}, "run": {}},
        }

        let ncols = 17
        let nrows = 6
        let aid;
        const sheet = Player.sheet

        aid = this.animation.register(sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, [0*ncols+3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, [0*ncols+0, 0*ncols+1, 0*ncols+2], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, [0*ncols+3, 0*ncols+4, 0*ncols+5], spf, {xoffset, yoffset})
        this.animations["run"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, [1*ncols+0, 1*ncols+1, 1*ncols+2], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+3, 1*ncols+4, 1*ncols+5], spf, {xoffset, yoffset})
        this.animations["run"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, [0*ncols+6], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, [0*ncols+7], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, [1*ncols+6], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+7], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, [0*ncols+2], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, [0*ncols+5], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, [1*ncols+2], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+5], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+9], spf, {xoffset, yoffset})
        this.animations["hit"][Direction.RIGHT] = aid
        this.animations["hit"][Direction.LEFT] = aid
        this.animations["hit"][Direction.UPRIGHT] = aid
        this.animations["hit"][Direction.UPLEFT] = aid

        this.animations["spawn"][Direction.RIGHT] = this.animations["run"][Direction.RIGHT]
        this.animations["spawn"][Direction.LEFT] = this.animations["run"][Direction.LEFT]
        aid = this.animation.register(sheet, [1*ncols+8], spf, {xoffset, yoffset})
        this.animations["spawn"][Direction.UP] = aid
        this.animations["spawn"][Direction.DOWN] = aid

        aid = this.animation.register(sheet, [1*ncols+10], spf, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [1*ncols+10], spf, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+10, 1*ncols+11, 1*ncols+12, 1*ncols+13], spf2, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+10, 1*ncols+13, 1*ncols+12, 1*ncols+11], spf2, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.RIGHT] = aid

        this.animation.setAnimationById(this.animations.run[Direction.RIGHT])

        this.weapon_offset = {}
        this.weapon_offset[Direction.RIGHT]   = {x: 12, y: 12}
        this.weapon_offset[Direction.UPRIGHT] = {x: 12, y:  3}
        this.weapon_offset[Direction.LEFT]    = {x: -8 + 3, y: 12}
        this.weapon_offset[Direction.UPLEFT]  = {x: -6, y:  3}

    }

    paint(ctx) {



        ctx.save()
        this.animation.paint(ctx)
        ctx.restore()

        //ctx.beginPath();
        //ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.fillStyle = '#FF00007f';
        //ctx.fill();

        if (!this._beam && this.charging) {
            ctx.save()
            ctx.beginPath();
            //ctx.fillStyle = '#FF0000FF';
            const p = this.charge_duration / this.charge_timeout
            const o = this.weapon_offset[this.current_facing]
            const k = Math.floor(gEngine.frameIndex/6)%3
            ctx.filter = `brightness(${75+50*k}%)`

            let color = 0
            switch (gCharacterInfo.element) {
            case WeaponType.ELEMENT.POWER:
                color = 1 // yellow
                break;
            case WeaponType.ELEMENT.FIRE:
                color = 0  // red
                break;
            case WeaponType.ELEMENT.WATER:
                color = 3  // red
                break;
            case WeaponType.ELEMENT.ICE:
                color = 2
                break;
            case WeaponType.ELEMENT.BUBBLE:
                color = 4
                break;
            }

            if (p < .3) {
                gAssets.sheets.beams16.drawTile(ctx, color*7+3, this.rect.x + o.x - 8, this.rect.y + o.y - 8 + 2)
            } else if (p < .6) {
                gAssets.sheets.beams16.drawTile(ctx, color*7+2, this.rect.x + o.x - 8, this.rect.y + o.y - 8 + 2)
            } else {
                gAssets.sheets.beams16.drawTile(ctx, color*7+0, this.rect.x + o.x - 8, this.rect.y + o.y - 8 + 2)
            }

            //ctx.rect( this.rect.x + o.x - 1, this.rect.y + o.y - 1, 5*p, 5*p);
            //ctx.arc(
            //    this.rect.x + o.x + 2, this.rect.y + o.y + 2,
            //    4*p,
            //    0,2*Math.PI);
            //ctx.fill();
            ctx.filter = ''
            ctx.closePath()
            //ctx.fill()
            ctx.restore()

        }

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.direction}`, this.rect.x, this.rect.y);

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        ////ctx.fillText(`${this._x_input.x.toFixed(2)},${this._x_input.y.toFixed(2)} ${this.physics.speed.x.toFixed(1)}`, this.rect.x, this.rect.y);
        //ctx.fillText(`${Math.abs(this.physics.speed.x).toFixed(1)}/${this.physics.xmaxspeed1}/${this.physics.xmaxspeed1a}`, this.rect.x, this.rect.y);
        if (!!this._beam) {
            this._beam.paint(ctx)
        }

        //this.physics.paint(ctx)

        if (this.physics.can_wallwalk) {
            // draw a glowing circle
            ctx.beginPath()
            ctx.arc(this.rect.cx(), this.rect.cy()-1, 8, 0, 2*Math.PI)
            ctx.fillStyle = "#FF000033"
            ctx.strokeStyle = "#FF0000"
            ctx.fill()
            ctx.stroke()
        }
    }

    _updateAnimation() {

        let aid;
        let frame_id = -1
        if (this.morphing) {
            let mfacing = this.current_facing&Direction.LEFTRIGHT
            let maction = this.morphed?"unmorph":"morph"
            aid = this.animations[maction][mfacing]
            frame_id = 1
        } else if (this.morphed) {
            let mfacing = this.current_facing&Direction.LEFTRIGHT
            let maction =(this.current_action != "idle")?"run":"idle"
            aid = this.animations["morphed"][maction][mfacing]
        } else {
            aid = this.animations[this.current_action][this.current_facing]
        }

        if (!aid) {
            console.error(this.physics)
            throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
        }

        this.animation.setAnimationById(aid, frame_id)
    }

    _chargeTimeout() {
        let timeout = this.charge_timeout
        if (gCharacterInfo.modifier === WeaponType.MODIFIER.RAPID) {

            let factor = 0.6

            if (gCharacterInfo.element == WeaponType.ELEMENT.BUBBLE) {
                factor = 0.2
            }

            if (gCharacterInfo.element == WeaponType.ELEMENT.POWER) {
                factor = 0.33
            }

            if (gCharacterInfo.element == WeaponType.ELEMENT.ICE) {
                factor = 0.75
            }

            // slowly increase the speed
            factor = factor *(5 - this.charge_count)/5
            
            timeout = timeout*factor
        }

        return timeout

    }
    
    _chargePower() {
        let power = this.charge_duration / this.charge_timeout
        return power
    }
    
    update(dt) {

        if (this.spawning) {
            this.animation.update(dt)
            return
        }

        //
        if (this.physics.can_wallwalk && this.physics.standing_direction != Direction.DOWN && !this.physics._x_step_collisions.b) {
            this.physics.standing_direction = Direction.DOWN

            console.log("!!fixme set moving", this.physics.moving_direction)
        }

        this.physics.update(dt)
        this.character.update(dt)

        if (!this.alive) {

            if (this.dead_timer > 0) {
                this.dead_timer -= dt
                if (this.dead_timer < 0) {

                    const info = gCharacterInfo.current_map_spawn
                        gCharacterInfo.transitionToLevel(
                            info.world_id, info.level_id, info.door_id)
                }
            }

            return
        }

        if (this.charging && this.charge_duration < this.charge_timeout) {
            if (this.charge_duration < this.charge_timeout) {
                this.charge_duration += dt
                if (this.charge_duration >= this.charge_timeout) {
                    // keep a reference to current beam sfx
                    // then stop those sounds on the current beam sfx changes
                    if (!!this._beam) {
                        gAssets.sfx.BEAM_FLAMETHROWER_CHARGE.stop()
                        gAssets.sfx.BEAM_FLAMETHROWER_STEADY.loop()
                    } else {
                        //gAssets.sfx.BEAM_CHARGE[WeaponType.ELEMENT.POWER].stop()
                        gAssets.sounds.fireBeamCharge.stop()
                        //gAssets.sfx.BEAM_CHARGE_LOOP[WeaponType.ELEMENT.POWER].loop()
                        gAssets.sounds.fireBeamChargeLoop.loop()

                    }
                    this.charge_duration = this.charge_timeout
                }
            }

            if (!this._beam && gCharacterInfo.modifier === WeaponType.MODIFIER.RAPID) {
                
                let timeout = this._chargeTimeout()
                // TODO: timeout should depend on element (power faster, ice slower)
                //       or special weapon. lazer types don't need this feature
                if (this.charge_duration > timeout) {
                    if (this.charge_count < 3) {
                        this.charge_count += 1
                    }
                    this._shoot(0)
                    this.charge_duration -= timeout
                }
            }

        }

        if (!!this._beam) {
            this._beam.update(dt)
        }

        let pfacing = this.physics.facing
        if (this.looking_up) {
            pfacing |= Direction.UP
        }

        let paction = "idle"
        switch (this.physics.action) {
            case "run":
                paction = "run"
                break;
            case "jump":
                paction = "jump"
                break;
            case "fall":
                paction = "fall"
                break;
            default:
                break;
        }

        if (pfacing != this.current_facing ||
            paction != this.current_action) {
            this.current_facing = pfacing
            this.current_action = paction
            this._updateAnimation()

        }

        this.animation.update(dt)

        if (this.direction != 0) {

            let x = null
            let y = null
            switch(this.direction) {
            case Direction.RIGHT:
                x = this.rect.right() + 1
                y = this.rect.cy()
                break;
            case Direction.LEFT:
                x = this.rect.left() - 1
                y = this.rect.cy()
                break;
            case Direction.UP:
                x = this.rect.cx()
                y = this.rect.top() - 1
                break;
            case Direction.DOWN:
                x = this.rect.cx()
                y = this.rect.bottom() + 1
                break;
            default:
                break;
            }

            if (x != null) {
                for (const ent of this.physics.group()) {
                    if ((!!ent.interact) && ent.rect.collidePoint(x, y)) {
                        ent.interact(this, this.direction)
                    }
                }
            }
        }

        if (this.rect.y > Physics2dPlatformV2.maprect.bottom()) {
            this._kill()
        }
    }

    setSpawning(direction) {
        if (direction == Direction.NONE) {
            this.spawning = false
            // TODO apply cached player inputs
        } else {
            this.animation.setAnimationById(this.animations["spawn"][direction])
            this.spawning = true
        }
    }

    onInput(payload) {

        if (!this.alive) {
            return
        }

        if ("tap_count" in payload) {

            if (payload.tap_count == 2) {
                if (this.morphed && payload.direction == Direction.UP) {
                    this._unmorph()
                    this._updateAnimation()
                    console.log("toggle unmorph")
                } else if (this.morphed && payload.direction == Direction.DOWN) {
                    //
                    this.physics.can_wallwalk = !this.physics.can_wallwalk 
                    if (!this.physics.can_wallwalk) {
                        this.physics.standing_direction = Direction.DOWN
                    }
                    console.log("toggle spider ball", {enabled: this.physics.can_wallwalk})
                } else if (!this.morphed && payload.direction == Direction.DOWN) {
                    this.physics.can_wallwalk = false
                    this.physics.standing_direction = Direction.DOWN
                    this._morph()
                    this._updateAnimation()
                    console.log("toggle morph")
                }
            }
        } else if ("whlid" in payload) {

            this._x_input = payload.vector
            this.direction = Direction.fromVector(payload.vector.x, payload.vector.y)

            // TODO: dead zone on mobile in the wheel
            if (Math.abs(payload.vector.x) < 0.3535) {
                payload.vector.x = 0
            }

            // TODO: remove
            //this.physics.direction = Direction.fromVector(payload.vector.x, 0)
            // TODO V2
            if (this.physics.standing_direction == Direction.DOWN) {
                this.physics.moving_direction = Direction.fromVector(payload.vector.x, 0)
            }
            if (this.physics.standing_direction == Direction.RIGHT) {
                this.physics.moving_direction = Direction.fromVector(0, -payload.vector.x)
            }
            if (this.physics.standing_direction == Direction.LEFT) {
                this.physics.moving_direction = Direction.fromVector(0, payload.vector.x)
            }
            if (this.physics.standing_direction == Direction.UP) {
                this.physics.moving_direction = Direction.fromVector(-payload.vector.x, 0)
            }
             
            //console.log("set movement", payload.vector.x, this.physics.moving_direction)

            // TODO: facing for v2, is not part of physics?
            if (payload.vector.x > 0.3535) {
                this.physics.facing = Direction.RIGHT
            }

            if (payload.vector.x < -0.3535) {
                this.physics.facing = Direction.LEFT
            }

            //console.log(payload.vector.x, payload.vector.y)
            //if (this.physics.direction&Direction.UP) {
            if ( payload.vector.y < -0.3535) {
                this.looking_up = true
            } else {
                this.looking_up = false
            }

            /*
            console.log("move",{
                vector: payload.vector,
                standing_direction: Direction.name[this.physics.standing_direction],
                moving_direction: Direction.name[this.physics.moving_direction],  
            })
            */

            // const maxspeed = 90

            //if (payload.vector.x > 0.3535) {
            //    this.physics.facing = Direction.RIGHT
            //    if (this.physics.speed.x < maxspeed) {
            //        this.physics.speed.x += maxspeed/10.0
            //        if (this.physics.speed.x > maxspeed) {
            //            this.physics.speed.x = maxspeed
            //        }
            //    }
            //}

            //else if (payload.vector.x < -0.3535) {
            //    this.physics.facing = Direction.LEFT
            //    if (this.physics.speed.x > -maxspeed) {
            //        this.physics.speed.x -= maxspeed/10.0
            //        if (this.physics.speed.x < -maxspeed) {
            //            this.physics.speed.x = -maxspeed
            //        }
            //    }
            //}

            //else {
            //    this.physics.speed.x = 0
            //}

        } else if (payload.btnid === 0) {

            this.jump_pressed = payload.pressed

            if (payload.pressed) {
                this._jump()
            } else {
                this.physics.gravityboost = true
            }

        } else if (payload.btnid === 1) {

            if (!this.morphed) {
                if (payload.pressed) {

                    let charge_sound = null
                    if (gCharacterInfo.modifier != WeaponType.MODIFIER.NORMAL) {
                        this.charging = true
                        this.charge_count = 0

                        charge_sound = gAssets.sounds.fireBeamCharge
                    }

                    this.charge_duration = 0.0

                    if (gCharacterInfo.modifier == WeaponType.MODIFIER.RAPID) {

                        if (gCharacterInfo.element == WeaponType.ELEMENT.WATER && gCharacterInfo.beam != WeaponType.BEAM.BOUNCE) {
                            this._beam = new WaterBeam(this, gCharacterInfo.beam == WeaponType.BEAM.WAVE)
                        } else if (gCharacterInfo.element == WeaponType.ELEMENT.FIRE && gCharacterInfo.beam != WeaponType.BEAM.BOUNCE) {
                            this._beam = new FireBeam(this, gCharacterInfo.beam == WeaponType.BEAM.WAVE)
                            charge_sound = gAssets.sounds.fireBeamFlameStart
                        } else {
                            this._shoot(0)
                        }

                    }

                    if (!!charge_sound) {
                        charge_sound.play()
                    }
                } else {
                    
                    let power = this._chargePower()
                    this.charge_duration = 0.0
                    this.charging = false
                    if (!!this._beam) {
                        gAssets.sounds.fireBeamFlameStart.stop()
                        gAssets.sounds.fireBeamFlameLoop.stop()
                    } else {
                        gAssets.sounds.fireBeamCharge.stop()
                        gAssets.sounds.fireBeamChargeLoop.stop()
                    }

                    if (gCharacterInfo.modifier != WeaponType.MODIFIER.RAPID) {
                        this._shoot(power)
                    } else {
                        if (!!this._beam) {
                            this._beam = null
                        }
                    }

                }
            }

        } else {
            console.log({
                standing_direction: Direction.name[this.physics.standing_direction],
                moving_direction: Direction.name[this.physics.moving_direction],  
                physics: this.physics,
            })
            console.log(payload)
        }
    }

    onMorphEnd() {
        this.rect.h = 12
        this.rect.y += 12
        // TODO: better way to reinit lut?
        this.physics._init_lut()
        this.morphing = false
        this.morphed = true
        //this.physics.can_wallwalk = true
        this._updateAnimation()
    }

    onUnmorphEnd() {
        this.physics.can_wallwalk = false
        this.morphing = false
        this.morphed = false
        this._updateAnimation()
    }

    _morph() {
        if (!this.morphing && !this.morphed) {
            this.morphing = true
            this._updateAnimation()
            gAssets.sfx.PLAYER_MORPH.play()
        }
    }

    _unmorph() {
        if (!this.morphing && this.morphed) {
            this.rect.h = 24
            this.rect.y -= 12
            // TODO: better way to reinit lut?
            this.physics._init_lut()
            this.morphing = true
            this.physics.can_wallwalk = false // paranoid, sprinkled everywhere
            //this.morphed = false
            this._updateAnimation()
            gAssets.sfx.PLAYER_UNMORPH.play()
        }
    }

    _shoot(power) {


        let d = this.physics.facing
        if (this.looking_up) {
            d |= Direction.UP
        }

        const o = this.weapon_offset[this.current_facing]
        const px = this.rect.x + o.x
        const py = this.rect.y + o.y

        // limit the maximum number of bubbles based on weapon level
        if (gCharacterInfo.element == WeaponType.ELEMENT.BUBBLE) {
            let objs = this._x_debug_map.queryObjects({"className": "BubbleBullet"})
            objs = objs.sort((a,b)=> (+a) - +(b)).filter(obj => obj.alive)

            while (objs.length > gCharacterInfo.level*gCharacterInfo.level) {
                objs[0]._kill()
                objs.shift()
            }
        }

        generateProjectiles(px, py, d, power).forEach(obj => {

            this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), obj.name, obj.props)
        })

        gAssets.sfx.BEAM_SHOOT[gCharacterInfo.element].play()

    }

    _bounce() {

        gAssets.sfx.PLAYER_BOUNCE.play()

        if (this.jump_pressed) {
            this.physics.speed.y = this.physics.jumpspeed
        } else {
            this.physics.speed.y = this.physics.jumpspeed*.75
        }
        this.physics.accum.y = 0
        this.physics.gravityboost = false
        this.physics.doublejump = true
    }

    _bounce2() {

        gAssets.sfx.PLAYER_BOUNCE.play()

        if (this.jump_pressed) {
            this.physics.speed.y = this.physics.jumpspeed*1.25
        } else {
            this.physics.speed.y = this.physics.jumpspeed
        }
        this.physics.accum.y = 0
        this.physics.gravityboost = false
        this.physics.doublejump = true
    }

    _jump() {

        // coyote time

        let standing = this.physics.standing_frame >= (this.physics.frame_index - 6)
        let pressing = this.physics.pressing_frame >= (this.physics.frame_index - 6)

        let rising = this.physics.is_rising()

        if (standing) {

            if (this.physics.can_wallwalk) {
                this.physics.can_wallwalk = false
            }

            if (this.physics.standing_direction != Direction.DOWN) {
                this.physics.standing_direction = Direction.DOWN
                return
            }
            gAssets.sfx.PLAYER_JUMP.play()

            
            // TODO: old
            //this.physics.speed.y = this.physics.jumpspeed
            //this.physics.yaccum = 0
            // TODO: new
            this.physics.speed.y = this.physics.jumpspeed
            this.physics.accum.y = 0

            this.physics.gravityboost = false
            this.physics.doublejump = !this.morphed
        } else if (pressing && !standing) {
            console.log(`wall jump standing=${this.physics.standing_frame} pressing=${pressing} m=${this.physics.pressing_direction}`)
            gAssets.sfx.PLAYER_JUMP.play()
            //this.physics.speed.x = this.physics.pressing_direction * this.physics.xjumpspeed
            //this.physics.xaccum = 0
            //this.physics.speed.y = this.physics.jumpspeed / Math.sqrt(2)
            //this.physics.yaccum = 0

            console.log(this.physics.pressing_direction, this.physics.xjumpspeed)
            this.physics.speed.x = this.physics.pressing_direction * this.physics.xjumpspeed
            this.physics.accum.x = 0
            this.physics.speed.y = this.physics.jumpspeed / Math.sqrt(2)
            this.physics.accum.y = 0

            this.physics.gravityboost = false

        } else if (!standing && this.physics.doublejump && !rising) {
            console.log(`double jump standing=${this.physics.standing_frame} pressing=${pressing}`)
            gAssets.sfx.PLAYER_JUMP.play()

            //this.physics.speed.y = this.physics.jumpspeed / Math.sqrt(2)
            //this.physics.yaccum = 0

            this.physics.speed.y = this.physics.jumpspeed / Math.sqrt(2)
            this.physics.accum.y = 0

            this.physics.gravityboost = false
            this.physics.doublejump = false
            this.physics.doublejump_position = {x:this.physics.target.rect.cx(), y: this.physics.target.rect.bottom()}
            this.physics.doublejump_timer = .4
        } else {
            console.log(`jump standing=${this.physics.standing_frame} pressing=${pressing}`)
        }
    }

    _hurt() {
        //this.character.hit()
        this._kill()
    }

    _kill() {
        this.alive =  false
        this.physics.group = () => []

        let aid = this.animations["hit"][Direction.RIGHT]
        this.animation.setAnimationById(aid)

        this.physics.moving_direction = Direction.NONE
        this.physics.xaccum = 0
        this.physics.speed.y = this.physics.jumpspeed
        this.physics.yaccum = 0
        this.physics.gravityboost = false
        this.physics.doublejump = false
        this.physics.checkbounds = false

        this.dead_timer = 3
    }

    _revive() {

        // deprecated in favor of transition to spawn point
        this.alive =  true

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.rect.x = 32
        this.rect.y = 128

        let aid = this.animations["idle"][Direction.RIGHT]
        this.animation.setAnimationById(aid)

        this.physics.checkbounds = true
    }
}
Player.sheet = null

registerDefaultEntity("Player", Player, (entry)=> {
    //Player.sheet = gAssets.sheets.player
    Player.sheet = gAssets.sheets.player2
})