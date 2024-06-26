
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent,
    PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {registerDefaultEntity, PlayerBase} from "@troid/entities/sys"
import {FireBeam, WaterBeam, Bullet, BounceBullet, BubbleBullet} from "@troid/entities/projectiles"

// TODO: projectiles reduce framerate if they move off screen on large maps
function generateProjectiles(x,y,direction, power) {
    // x,y: center to generate project at
    // direction: direction projectile will travel
    // power: charge percent

    let projectiles = []

    let color = 0

    switch (gCharacterInfo.current.element) {
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

    let element = gCharacterInfo.current.element

    // booleans
    
    let wave : bool = (gCharacterInfo.current.beam === WeaponType.BEAM.WAVE)?1:0
    let bounce : bool = gCharacterInfo.current.beam === WeaponType.BEAM.BOUNCE

    let normal = gCharacterInfo.current.modifier == WeaponType.MODIFIER.NORMAL

    // one of LEVEL1, LEVEL2, LEVEL3
    let level = gCharacterInfo.current.level

    // ice should generate 1 projectile, which may animate with a split profile
    // fire + wave + any level + no modifier : spread gun 1,3,5 bullets
    // fire + bounce + any level + no modifier : bouncy fire ball
    // water + any beam + any level + rapid : squirt gun
    // bubble + charge : large bubbles that can be jumped on


    if (gCharacterInfo.current.element == WeaponType.ELEMENT.FIRE && wave && normal) {

        wave = 2
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
        if (gCharacterInfo.current.level >= WeaponType.LEVEL.LEVEL2) {
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
        }
        if (gCharacterInfo.current.level >= WeaponType.LEVEL.LEVEL3) {
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:4}})
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:5}})
        }

    }
    else if (gCharacterInfo.current.element == WeaponType.ELEMENT.BUBBLE) {
        projectiles.push({name: "BubbleBullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (bounce) {
        projectiles.push({name: "BounceBullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (wave && gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL1) {
        // a single bullet the waves
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (bounce || gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL1) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
    }
    else if (gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL2) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL3) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    } else {
        throw {error: "invalid level", level: gCharacterInfo.current.level}
    }

    return projectiles
}

export class CharacterComponent {

    constructor(target) {
        this.target = target
        this.alive = true
        //this.health = 3

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

            if (this.hurt_timer < 0 && gCharacterInfo.current_health <= 0) {
                this.alive = false
            }

            if (!this.alive && this.hurt_timer < 0) {
                //if (this.map.map._x_player.rect.y - 32 > this.camera.y + gEngine.view.height) {

                gCharacterInfo.current_health = gCharacterInfo.max_health

                console.log("map", gCharacterInfo.current_map)
                console.log("map-spawn", gCharacterInfo.current_map_spawn)
                // for the demo just reload the current map
                //const info = gCharacterInfo.current_map_spawn
                const info = gCharacterInfo.current_map
                gCharacterInfo.transitionToLevel(
                    info.world_id, info.level_id, info.door_id)

            }

        }

        if (this.hurt_cooldown > 0) {
            this.hurt_cooldown -= dt
        }

    }

    hit(other) {
        // TODO: should other, just be the rect of what hit me?

        // TODO: apply a force to move the player awar from what hurt it
        // is this the best way? on every hit, ignoring the cooldown?
        

        if (this.hurt_cooldown > 0 || gCharacterInfo.current_health <= 0) {
            return
        }

        let d = -Math.sign(other.rect.cx() - this.target.rect.cx())
        this.target.physics.speed.x =  d * 100
        if (this.target.physics.speed.y >= 0) {
            this.target.physics.speed.y = -200
        }

        if (this.target.physics.can_wallwalk) {
            this.target.physics.can_wallwalk = false
            this.target.physics.standing_direction = Direction.DOWN
        }

        gCharacterInfo.current_health -= 1

        if (gCharacterInfo.current_health <= 0) {
            gAssets.sfx.PLAYER_DEATH.play()

            this.hurt_cooldown = 2*this.hurt_period + .25
            this.hurt_timer = 2*this.hurt_period
            this.animation_timer = 0

            this.target._kill()

        } else {
            gAssets.sfx.PLAYER_HIT.play()

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
        }

    }
}

export class Player extends PlayerBase {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 12, 24)
        this.playerId = props?.playerId??null
        this.layer = 100

        this.physics = new Physics2dPlatformV2(this,{
            xmaxspeed1: 150,
            xmaxspeed2: 300,
            oneblock_walk: true,
            wallslide: true,
        })

        this.visible = true
        this.animation = new AnimationComponent(this)

        this.spawning = false // spawning or despawning, lose direct control

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.character = new CharacterComponent(this)

        this.looking_up = false

        //this.buildAnimations()
        this.buildAnimations2()

        this.current_action = "idle"
        this._x_facing = Direction.RIGHT // TODO: this is a bug from physics_v1
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

        this.fluid_factor = 0

    }

    buildAnimations2() {

        let spf = .1
        let spf2 = 1/12
        let xoffset = - 12
        let xoffsetR = - 12
        let xoffsetL = - 8
        let yoffset = - 7
        let yoffset2 = - 19

        this.animations = {
            "idle":{},
            "run":{},
            "run_press":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "spawn":{},
            "morphed":{"idle": {}, "run": {}},
            "spikeball":{"idle": {}, "run": {}},
            "morph":{},
            "unmorph":{},
        }

        let aid;
        const sheet = Player.sheet

        const idle = (row) => [(row*sheet.cols + 0)]
        const walk = (row) => [...Array(8).keys()].map(i => (row*sheet.cols + i))
        const walk_press = (row) => [...Array(8).keys()].map(i => (row*sheet.cols + i))
        const jump = (row) => [(row*sheet.cols + 2)]
        const fall = (row) => [(row*sheet.cols + 2)]
        const hurt = (row) => [(6*sheet.cols + 2)]
        const spawn = (row) => [(6*sheet.cols + 1)]
        const slide = (row) => [(row*sheet.cols + 0), (row*sheet.cols + 1)]
        const ball1 = () => [0,1,2,3].map(i => (13*sheet.cols + i))
        const ball2 = () => [0,3,2,1].map(i => (13*sheet.cols + i))
        const ball_idle = () => [(13*sheet.cols + 0)]
        const spike1 = () => [0,1,2,3].map(i => (14*sheet.cols + i))
        const spike2 = () => [0,3,2,1].map(i => (14*sheet.cols + i))
        const spike_idle = () => [(14*sheet.cols + 0)]
        const morph = (row) => [...Array(10).keys()].map(i => ((7+row)*sheet.cols + i))
        const unmorph = (row) => [...Array(10).keys()].map(i => ((7+row)*sheet.cols + i)).reverse()

        aid = this.animation.register(sheet, idle(0), spf, {xoffset: xoffsetR, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, idle(1), spf, {xoffset: xoffsetR, yoffset})
        this.animations["idle"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, idle(3), spf, {xoffset: xoffsetL, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, idle(4), spf, {xoffset: xoffsetL, yoffset})
        this.animations["idle"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, walk(0), spf, {xoffset: xoffsetR, yoffset})
        this.animations["run"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, walk(1), spf, {xoffset: xoffsetR, yoffset})
        this.animations["run"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, walk(3), spf, {xoffset: xoffsetL, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, walk(4), spf, {xoffset: xoffsetL, yoffset})
        this.animations["run"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, walk_press(2), spf, {xoffset: xoffsetR, yoffset})
        this.animations["run_press"][Direction.RIGHT] = aid
        this.animations["run_press"][Direction.UPRIGHT] = this.animations["run"][Direction.UPRIGHT]

        aid = this.animation.register(sheet, walk_press(5), spf, {xoffset: xoffsetL, yoffset})
        this.animations["run_press"][Direction.LEFT] = aid
        this.animations["run_press"][Direction.UPLEFT] = this.animations["run"][Direction.UPLEFT]

        aid = this.animation.register(sheet, jump(0), spf, {xoffset: xoffsetR, yoffset})
        this.animations["jump"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, jump(1), spf, {xoffset: xoffsetR, yoffset})
        this.animations["jump"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, jump(3), spf, {xoffset: xoffsetL, yoffset})
        this.animations["jump"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, jump(4), spf, {xoffset: xoffsetL, yoffset})
        this.animations["jump"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, fall(0), spf, {xoffset: xoffsetR, yoffset})
        this.animations["fall"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, fall(1), spf, {xoffset: xoffsetR, yoffset})
        this.animations["fall"][Direction.UPRIGHT] = aid

        aid = this.animation.register(sheet, fall(3), spf, {xoffset: xoffsetL, yoffset})
        this.animations["fall"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, fall(4), spf, {xoffset: xoffsetL, yoffset})
        this.animations["fall"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, hurt(0), spf, {xoffset, yoffset})
        this.animations["hit"][Direction.RIGHT] = aid
        this.animations["hit"][Direction.LEFT] = aid
        this.animations["hit"][Direction.UPRIGHT] = aid
        this.animations["hit"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, slide(11), spf, {xoffset:xoffsetR, yoffset})
        this.animations["wall_slide"][Direction.RIGHT] = aid
        aid = this.animation.register(sheet, slide(12), spf, {xoffset:xoffsetR, yoffset})
        this.animations["wall_slide"][Direction.UPRIGHT] = aid
        aid = this.animation.register(sheet, slide(9), spf, {xoffset:xoffsetL, yoffset})
        this.animations["wall_slide"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, slide(10), spf, {xoffset:xoffsetL, yoffset})
        this.animations["wall_slide"][Direction.UPLEFT] = aid

        this.animations["spawn"][Direction.RIGHT] = this.animations["run"][Direction.RIGHT]
        this.animations["spawn"][Direction.LEFT] = this.animations["run"][Direction.LEFT]
        aid = this.animation.register(sheet, spawn(0), spf, {xoffset: xoffset+2, yoffset})
        this.animations["spawn"][Direction.UP] = aid
        this.animations["spawn"][Direction.DOWN] = aid

        aid = this.animation.register(sheet, morph(0), spf/2, {xoffset: xoffsetR, yoffset, loop: false, onend: this.onMorphEnd.bind(this)})
        this.animations["morph"][Direction.RIGHT] = aid
        this.animations["morph"][Direction.UPRIGHT] = aid
        aid = this.animation.register(sheet, morph(1), spf/2, {xoffset: xoffsetL, yoffset, loop: false, onend: this.onMorphEnd.bind(this)})
        this.animations["morph"][Direction.LEFT] = aid
        this.animations["morph"][Direction.UPLEFT] = aid

        aid = this.animation.register(sheet, unmorph(0), spf/2, {xoffset: xoffsetR, yoffset, loop: false, onend: this.onUnmorphEnd.bind(this)})
        this.animations["unmorph"][Direction.RIGHT] = aid
        this.animations["unmorph"][Direction.UPRIGHT] = aid
        aid = this.animation.register(sheet, unmorph(1), spf/2, {xoffset: xoffsetL, yoffset, loop: false, onend: this.onUnmorphEnd.bind(this)})
        this.animations["unmorph"][Direction.LEFT] = aid
        this.animations["unmorph"][Direction.UPLEFT] = aid

        let o = 2

        aid = this.animation.register(sheet, ball_idle(), spf, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, ball_idle(), spf, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, ball1(), spf2, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, ball2(), spf2, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.RIGHT] = aid


        aid = this.animation.register(sheet, spike_idle(), spf, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["spikeball"]['idle'][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, spike_idle(), spf, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["spikeball"]['idle'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, spike1(), spf2, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["spikeball"]['run'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, spike2(), spf2, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["spikeball"]['run'][Direction.RIGHT] = aid

        this.animation.setAnimationById(this.animations.run[Direction.RIGHT])

        this.weapon_offset = {}
        this.weapon_offset[Direction.RIGHT]   = {x: 17, y: 11}
        this.weapon_offset[Direction.UPRIGHT] = {x: 16, y:  3}
        this.weapon_offset[Direction.LEFT]    = {x: -5, y: 11}
        this.weapon_offset[Direction.UPLEFT]  = {x: -4, y:  3}

    }

    buildAnimations() {

        let spf = 1/8
        let spf2 = 1/12
        let xoffset = - 14
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
            "spikeball":{"idle": {}, "run": {}},
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

        let o = 0
        aid = this.animation.register(sheet, [1*ncols+10], spf, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [1*ncols+10], spf, {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+10, 1*ncols+11, 1*ncols+12, 1*ncols+13], spf2, 
            {xoffset: xoffset+o, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+10, 1*ncols+13, 1*ncols+12, 1*ncols+11], spf2, 
            {xoffset: xoffset+o, yoffset:yoffset2})
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
            let f = this.current_action!="wall_slide"?this._x_facing:Direction.flip[this._x_facing]
            if (this.looking_up) {
                f |= Direction.UP
            }
            const o = this.weapon_offset[f]

            const k = Math.floor(gEngine.frameIndex/6)%3
            ctx.filter = `brightness(${75+50*k}%)`

            let color = 0
            switch (gCharacterInfo.current.element) {
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

        if (!!this._beam) {
            this._beam.paint(ctx)
        }

        //this.physics.paint(ctx)
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
            let baction;
            if (this.morphed && this.physics.can_wallwalk) {
                baction = "spikeball"
            } else {
                baction = "morphed"
            }
            aid = this.animations[baction][maction][mfacing]
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
        if (gCharacterInfo.current.modifier === WeaponType.MODIFIER.RAPID) {

            let factor = 0.6

            if (gCharacterInfo.current.element == WeaponType.ELEMENT.BUBBLE) {
                factor = 0.2
            }

            if (gCharacterInfo.current.element == WeaponType.ELEMENT.POWER) {
                factor = 0.33
            }

            if (gCharacterInfo.current.element == WeaponType.ELEMENT.ICE) {
                factor = 0.75
            }

            // slowly increase the speed
            factor = factor *(5 - this.charge_count)/5
            
            timeout = timeout*factor
        }

        return timeout

    }
    
    _chargePower() {
        let power = Math.min(1.0, this.charge_duration / this._chargeTimeout())
        return power
    }
    
    _updatePhysics(fluid_factor) {

        // fluid is no longer a sliding scale but an enum
        // the enum order is precedence. 
        // higher numbers override lower numbers

        // 0: no fluid / default
        // 1: speed gel
        // 2: water
        // 3: tar

        // this implementation allows for zip pads
        // where a short region can cause a player to accelerate
        // more than they normally would
        //
        // TODO: may need a boost variable
        // otherwise wall jumps don't decelerate properly

        // TODO: revist xjumpspeed: change based on fluid properties
        // or change based on xmazspeed1

        // water should slow acceleration and max speed
        // without limiting jumping height

        let config = {
            "xmaxspeed1": 150,
            "xmaxspeed2": 300,
            "xacceleration_t": 0.2,
            "jumpheight": 72,
            "jumpduration": 0.22,
        }

        if (fluid_factor == 1) {
            config.xmaxspeed1 = 225

        }
        else if (fluid_factor == 2) {

            config.xmaxspeed1 = 100
            config.xacceleration_t = .6
            config.jumpduration = .34
        }
        else if (fluid_factor == 3) {
            config.xmaxspeed1 = 100
        }

        this.physics._init_gravity(config)

        if (fluid_factor > 0) {

            if (Math.abs(this.physics.speed.x) > config.xmaxspeed1) {
                this.physics.speed.x = Math.sign(this.physics.speed.x) * config.xmaxspeed1
            }
        }

        // TODO: when entering a fluid apply the new xmovement and ymovement 
        // maximum speeds right away

        if (fluid_factor == 3) {
            // use the calculated gravity for normal physics
            // but reduce the jump height when trapped in tar
            let jump_height = 40
            this.physics.jumpspeed = - Math.sqrt(2*jump_height*this.physics.gravity)
        }

    }
    update(dt) {

        if (this.spawning) {
            this.animation.update(dt)
            return
        }

        //
        /*
        if (this.physics.can_wallwalk && this.physics.standing_direction != Direction.DOWN && !this.physics._x_step_collisions.b) {
            this.physics.standing_direction = Direction.DOWN

            console.log("!!fixme set moving", this.physics.moving_direction)
        }*/

        let objs = this._x_debug_map.queryObjects({active: true, "fluid": undefined})
        let fluid_factor = 0
        objs.forEach(obj => { 
            if (obj.fluid > fluid_factor && obj.rect.collideRect(this.rect)) {
                fluid_factor = obj.fluid
            }
        })
        if (this.fluid_factor != fluid_factor) {
            console.log("changing fluid factor", fluid_factor)
            this.fluid_factor = fluid_factor
            this._updatePhysics(fluid_factor)
        }

        this.physics.update(dt)
        this.character.update(dt)
        //console.log("speed", Math.sqrt(this.physics.speed.x*this.physics.speed.x + this.physics.speed.y*this.physics.speed.y))

        if (!this.alive) {

            if (this.dead_timer > 0) {
                this.dead_timer -= dt
                if (this.dead_timer < 0) {

                    gCharacterInfo.current_health = gCharacterInfo.max_health

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

            if (!this._beam && gCharacterInfo.current.modifier === WeaponType.MODIFIER.RAPID) {
                
                let timeout = this._chargeTimeout()
                // TODO: timeout should depend on element (power faster, ice slower)
                //       or special weapon. lazer types don't need this feature
                if (this.charge_duration > timeout) {
                    if (this.charge_count < 3) {
                        this.charge_count += 1
                    }
                    this._shoot(this._chargePower())
                    this.charge_duration -= timeout
                }
            }

        }

        if (!!this._beam) {
            this._beam.update(dt)
        }

        let pfacing = this._x_facing
        if (this.looking_up) {
            pfacing |= Direction.UP
        }

        let paction = "idle"
        let pressing = this.physics.pressing_frame >= (this.physics.frame_index - 6)
        switch (this.physics.action) {
            case "run":
                paction = pressing ? "run_press" : "run"
                break;
            case "double_jump":
            case "jump":
                paction = "jump"
                break;
            case "fall":
                paction = "fall"
                break;
            case "wall_slide":
                paction = "wall_slide"
                break;
            default:
                break;
        }
        //
        //console.log("action", paction, pressing, this.physics.action);

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
            console.log("set spawning end", Direction.name[direction])
            this.spawning = false
            console.log(this._x_facing, this.animations["idle"][this._x_facing])
            this.animation.setAnimationById(this.animations["idle"][this._x_facing])
            // TODO apply cached player inputs
        } else {
            console.log("set spawning", Direction.name[direction])
            let d = direction&Direction.LEFTRIGHT||Direction.RIGHT
            this._x_facing = d
            this.current_facing = d
            this.animation.setAnimationById(this.animations["spawn"][direction])
            this.spawning = true

            this.physics.moving_direction = Direction.NONE
            //if ((this.direction&Direction.LEFTRIGHT)==0) {
            //    this.spawn_target.physics.facing = Direction.RIGHT
            // } else {
            //    this.spawn_target.physics.facing = this.direction
            //}

            this.physics.speed.x = 0
            this.physics.xaccum = 0
            this.physics.speed.y = 0
            this.physics.yaccum = 0

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
                    this._updateAnimation()

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
            // moonwalk when charging
            if (!this.charging) {
                if (payload.vector.x > 0.3535) {
                    this._x_facing = Direction.RIGHT
                }

                if (payload.vector.x < -0.3535) {
                    this._x_facing = Direction.LEFT
                }
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
            //    this._x_facing = Direction.RIGHT
            //    if (this.physics.speed.x < maxspeed) {
            //        this.physics.speed.x += maxspeed/10.0
            //        if (this.physics.speed.x > maxspeed) {
            //            this.physics.speed.x = maxspeed
            //        }
            //    }
            //}

            //else if (payload.vector.x < -0.3535) {
            //    this._x_facing = Direction.LEFT
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

            
                if (payload.pressed) {

                    if (!this.morphed) {

                        let charge_sound = null
                        if (gCharacterInfo.current.modifier != WeaponType.MODIFIER.NORMAL) {
                            this.charging = true
                            this.charge_count = 0

                            charge_sound = gAssets.sounds.fireBeamCharge
                        }

                        this.charge_duration = 0.0

                        if (gCharacterInfo.current.modifier == WeaponType.MODIFIER.RAPID) {

                            if (gCharacterInfo.current.element == WeaponType.ELEMENT.WATER && gCharacterInfo.current.beam != WeaponType.BEAM.BOUNCE) {
                                this._beam = new WaterBeam(this, gCharacterInfo.current.beam == WeaponType.BEAM.WAVE)
                            } else if (gCharacterInfo.current.element == WeaponType.ELEMENT.FIRE && gCharacterInfo.current.beam != WeaponType.BEAM.BOUNCE) {
                                this._beam = new FireBeam(this, gCharacterInfo.current.beam == WeaponType.BEAM.WAVE)
                                charge_sound = gAssets.sounds.fireBeamFlameStart
                            } else {
                                this._shoot(0)
                            }

                        }

                        if (!!charge_sound) {
                            charge_sound.play()
                        }
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

                    if (gCharacterInfo.current.modifier != WeaponType.MODIFIER.RAPID) {
                        this._shoot(power)
                    } else {
                        if (!!this._beam) {
                            this._beam = null
                        }
                    }

                    // when moon walking, switch the facing direction when the shot is released
                    //if (gCharacterInfo.current.modifier == WeaponType.MODIFIER.RAPID) {
                    //console.log(this.physics.moving_direction, this.physics.speed.x)
                    if (!this.charging) {
                            if (this.physics.moving_direction==Direction.RIGHT) {
                                this._x_facing = Direction.RIGHT
                                this.current_facing = Direction.RIGHT
                                this._updateAnimation()
                            }

                            if (this.physics.moving_direction==Direction.LEFT) {
                                this._x_facing = Direction.LEFT
                                this.current_facing = Direction.LEFT
                                this._updateAnimation()
                            }
                    }
                    //}

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
        this.physics.can_wallslide = true
        this.physics.standing_direction = Direction.DOWN
        this.morphing = false
        this.morphed = false
        this._updateAnimation()
    }

    _morph() {
        if (!this.morphing && !this.morphed) {
            this.morphing = true
            this.physics.can_wallslide = false
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
            this.physics.standing_direction = Direction.DOWN
            //this.morphed = false
            this._updateAnimation()
            gAssets.sfx.PLAYER_UNMORPH.play()
        }
    }

    _shoot(power) {


        let d, o, f;
        if (this.current_action == "wall_slide") {
            f = Direction.flip[this._x_facing]
            d = f
        } else {
            f = this._x_facing
            d = f
        }

        if (this.looking_up) {
            d |= Direction.UP
        }

        o = this.weapon_offset[d]

        const px = this.rect.x + o.x
        const py = this.rect.y + o.y

        // limit the maximum number of bubbles based on weapon level
        if (gCharacterInfo.current.element == WeaponType.ELEMENT.BUBBLE) {
            let objs = this._x_debug_map.queryObjects({"className": "BubbleBullet"})
            objs = objs.sort((a,b)=> (+a) - +(b)).filter(obj => obj.alive)

            while (objs.length > gCharacterInfo.current.level*gCharacterInfo.current.level) {
                objs[0]._kill()
                objs.shift()
            }
        }

        generateProjectiles(px, py, d, power).forEach(obj => {

            this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), obj.name, obj.props)
        })

        gAssets.sfx.BEAM_SHOOT[gCharacterInfo.current.element].play()

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
            
            // TODO: new
            this.physics.speed.y = this.physics.jumpspeed
            this.physics.accum.y = 0

            this.physics.gravityboost = false
            this.physics.doublejump = !this.morphed
        } else if (pressing && !standing) {
            console.log(`wall jump standing=${this.physics.standing_frame} pressing=${pressing} m=${this.physics.pressing_direction}`)
            gAssets.sfx.PLAYER_JUMP.play()

            // xjumpspeed
            let xjs = this.physics.xmaxspeed1

            this.physics.speed.x = this.physics.pressing_direction * xjs
            this.physics.accum.x = 0
            this.physics.speed.y = this.physics.jumpspeed / Math.sqrt(2)
            this.physics.accum.y = 0

            this.physics.gravityboost = false

        } else if (!standing && this.physics.doublejump && !rising) {
            console.log(`double jump standing=${this.physics.standing_frame} pressing=${pressing}`)
            gAssets.sfx.PLAYER_JUMP.play()

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
        this.physics.accum.x = 0
        this.physics.speed.y = this.physics.jumpspeed
        this.physics.accum.y = 0
        this.physics.gravityboost = false
        this.physics.doublejump = false
        this.physics.checkbounds = false

        this.dead_timer = 3
    }


}
Player.sheet = null

registerDefaultEntity("Player", Player, (entry)=> {
    //Player.sheet = gAssets.sheets.player
    Player.sheet = gAssets.sheets.player2
})