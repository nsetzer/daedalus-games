
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformBase
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

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
                        player.character.hit(this)
                    }
                }

            }

            if (this.physics._x_step_collisions.fn) {
                this.physics.moving_direction = Direction.flip[this.physics.moving_direction]
                this.animation.setAnimationById(this.animations.run[this.physics.moving_direction])
                this.physics.speed.x = 0
                this.physics.accum.x = 0
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


export class CreeperV2 extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 12, 12)

        this.visible = true

        this.solid = 0

        this.physics = new Physics2dPlatformV2(this, {
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
            wallwalk: true
        })
        // todo init as 'clockwise' or 'counter-clockwise' then set the direction
        // once the standing direction is determined
        this.physics.moving_direction = props.direction??Direction.RIGHT
        this.physics.moving_speed = 35

        this.current_facing = props.direction??Direction.RIGHT

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.animation = new AnimationComponent(this)
        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let spf2 = 1/10
        let xoffset = -2
        let yoffset = -2

        this.animations = {
            "idle":{},
            "run":{},
            "dead":{},
            "switch":{}
        }

        let ncols = 1
        let nrows = 1
        let aid;
        let sheet = CreeperV2.sheet

        aid = this.animation.register(sheet, [0,1,2,3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [0,1,2,3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [7,8,9,10], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [0,1,2,3], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset:-8, yoffset:-8, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animations["switch"][Direction.LEFT] = this.animation.register(
            sheet,
            [20,19,18,17,16,15,14],
            spf2, {xoffset:-2, yoffset:-2, loop: false, onend: this.onMoveAnimationEnd.bind(this)})

        this.animations["switch"][Direction.RIGHT] = this.animation.register(
            sheet,
            [14,15,16,17,18,19,20],
            spf2, {xoffset:-2, yoffset:-2, loop: false, onend: this.onMoveAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations.run[this.current_facing])

    }

    paint(ctx) {
        //CreeperV2.sheet.drawTile(ctx, 0, this.rect.x, this.rect.y)

        this.animation.paint(ctx)
        //this.physics.paint(ctx)
        //ctx.beginPath()
        //ctx.font = "6px";
        //ctx.fillStyle = "white"
        //ctx.strokeStyle = "white"
        //ctx.textAlign = "center"
        //ctx.textBaseline = "middle"
        //ctx.fillText(`(${this.rect.x%16},${this.rect.y%16})`, this.rect.cx(), this.rect.cy());
        //ctx.closePath()

        //this.trails.forEach(trail => {
        //    trail.forEach(pt => {
        //        ctx.beginPath();
        //        ctx.fillStyle = pt.c?"#FF00FF":"#FFFFFF";
        //        ctx.rect(pt.x, pt.y, 1, 1)
        //        ctx.fill();
        //    })
        //})
    }

    update(dt) {

        if (!this.character.frozen && this.character.alive) {
            this.physics.update(dt)

            //if (!this._x_is_standing) {
            //    this.physics.standing_direction = Direction.DOWN
            //}

            let d2 = this.physics.moving_direction&Direction.LEFTRIGHT
            if (d2 && d2 != this.current_facing) {
                this.animation.setAnimationById(this.animations["switch"][this.current_facing])
                this.current_facing = d2
            }

            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]
                if (this.rect.collideRect(player.rect)) {
                    player.character.hit(this)
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

    onMoveAnimationEnd() {
        this.animation.setAnimationById(this.animations["run"][this.current_facing])
    }
    onDeathAnimationEnd() {
        this.destroy()
    }
}

registerEditorEntity("CreeperV2", CreeperV2, [16,16], EntityCategory.small_mob, null, (entry)=> {
    CreeperV2.sheet = gAssets.sheets.firesprite
    entry.icon = CreeperV2.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = [
        {
            control: EditorControl.CHOICE,
            name: "direction",
            "default": Direction.RIGHT,
            choices: {
                "RIGHT": Direction.RIGHT,
                "LEFT": Direction.LEFT
            }
        },
    ]
})

export class Flyer extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0 + 5, props?.y??0 + 12, 22, 8)
        this.visible = true
        this.solid = 0

        this.animation = new AnimationComponent(this)

        this.physics = new Physics2dPlatformV2(this,{
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
            gravity: 0
        })

        this.physics.speed.x = -35
        this.physics.speed.y = 20


        this.physics.moving_direction = Direction.LEFT

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }


        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = - 5
        let yoffset = - 11

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

        let ncols = 3
        let nrows = 3
        let aid;
        let sheet = Flyer.sheet

        aid = this.animation.register(sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [5,6,7,8,9,8,7,6], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [0,1,2,3,4,3,2,1], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset:-8, yoffset:-8, loop: false, onend: this.onDeathAnimationEnd.bind(this)})


        this.animation.setAnimationById(this.animations.run[Direction.LEFT])

    }

  

    paint(ctx) {
        //Brick.icon.draw(ctx, this.rect.x, this.rect.y)

        this.animation.paint(ctx)

        
        /*
        ctx.fillStyle = "red"
        ctx.beginPath()
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.closePath()
        ctx.fill()
        */

        /*
        ctx.font = "bold 16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        let s3 = this.physics._x_prev_summary.standing
        ctx.fillText(`${this.physics.speed.x.toFixed(2)}, ${this.physics.speed.y.toFixed(2)}`, this.rect.x, this.rect.y-12);
        ctx.fillText(`${this.physics.accum.x.toFixed(2)}, ${this.physics.accum.y.toFixed(2)}`, this.rect.x, this.rect.y);
        */
    }

    update(dt) {
        if (!this.character.frozen && this.character.alive) {
            this.physics.update(dt)
            //console.log(this.physics.speed.x.toFixed(2), this.physics.speed.y.toFixed(2))

            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]
                if (this.rect.collideRect(player.rect)) {
                    player.character.hit(this)
                }
            }

            if (this.physics._x_step_collisions.fn) {
                this.physics.xaccum = 0
                if (this.physics.moving_direction == Direction.LEFT) {
                    this.physics.moving_direction = Direction.RIGHT
                    this.physics.speed.x = 35
                } else {
                    this.physics.moving_direction = Direction.LEFT
                    this.physics.speed.x = -35
                }
                this.physics.accum.x = 0
                this.animation.setAnimationById(this.animations.run[this.physics.moving_direction])
                //console.log(this.physics.speed.x, this.physics.moving_direction)
                this.physics._x_step_collisions.fn = 0
            }

            if (this.physics._x_step_collisions.b) {
                // note: top and bottom trigger twice
                // first time sets the direction, but depending on the speed
                // a  single frame may not accumulate enough delta
                // eventually the accumulator passes 1, and a step is made, but
                // this will still trigger once more
                // => toggling direction on collision won't work in general because of this
                this.physics.speed.y = -20
                //this.physics.accum.y = 0
                //console.log(this.physics.speed.x, this.physics.moving_direction)
                this.physics._x_step_collisions.b = 0
            }
    
            if (this.physics._x_step_collisions.t) {
                this.physics.speed.y = 20
                //this.physics.accum.y = 0
                this.physics._x_step_collisions.t = 0
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

registerEditorEntity("Flyer", Flyer, [32,32], EntityCategory.small_mob, null, (entry)=> {
    Flyer.sheet = gAssets.sheets.flyer
    entry.icon = makeEditorIcon(Flyer.sheet)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 5;
                break;
            case Direction.RIGHT:
            default:
                tid = 0;
                break;
        }
        return gAssets.sheets.flyer.tile(tid)
    }
    entry.editorSchema = [
        {
            control: EditorControl.CHOICE,
            name: "direction",
            "default": Direction.RIGHT,
            choices: {
                "RIGHT": Direction.RIGHT,
                "LEFT": Direction.LEFT
            }
        },
    ]
})

export class Shredder extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.visible = true

        this.breakable = 0
        this.alive = 1
        this.solid = 0

        this.physics = new Physics2dPlatformV2(this,{
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
            gravity: 0,
        })
        this.physics.speed.x = -35
        this.physics.moving_direction = Direction.LEFT
        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.animation = new AnimationComponent(this)

        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = - 4
        let yoffset = 0

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

        let ncols = 3
        let nrows = 3
        let aid;
        let sheet = Shredder.sheet

        aid = this.animation.register(sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [0*ncols+0, 0*ncols+1], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+0, 1*ncols+1], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset:-8, yoffset:-8, loop: false, onend: this.onDeathAnimationEnd.bind(this)})


        this.animation.setAnimationById(this.animations.run[Direction.LEFT])

    }

    _x_collide(other, dx, dy) {



        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.top()) {

            if (!this.character.frozen) {
                if (other instanceof Player) {
                    other._bounce()
                    return null
                }
            }
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            //this.destroy()
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    paint(ctx) {
        //Brick.icon.draw(ctx, this.rect.x, this.rect.y)
        /*
        ctx.fillStyle = "red"
        ctx.beginPath()
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.closePath()
        ctx.fill()
        */

        this.animation.paint(ctx)
    }

    update(dt) {
        if (!this.character.frozen && this.character.alive) {
            this.physics.update(dt)

            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]
                if (this.rect.collideRect(player.rect)) {
                    player.character.hit(this)
                }
            }
            
            if (this.physics._x_step_collisions.fn) {
                this.physics.xaccum = 0
                if (this.physics.moving_direction == Direction.LEFT) {
                    this.physics.moving_direction = Direction.RIGHT
                    this.physics.speed.x = 35
                } else {
                    this.physics.moving_direction = Direction.LEFT
                    this.physics.speed.x = -35
                }
                this.physics.accum.x = 0
                this.animation.setAnimationById(this.animations.run[this.physics.moving_direction])
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

    onDeathAnimationEnd() {
        this.destroy()
    }
}

registerEditorEntity("Shredder", Shredder, [16,16], EntityCategory.small_mob, null, (entry)=> {
    Shredder.sheet = gAssets.sheets.shredder
    entry.icon = makeEditorIcon(Shredder.sheet)
    entry.editorIcon = null
    entry.editorSchema = []
})

// TODO: create separate spawner for flies which can spawn 1-5 flies
// TODO: be able to spawn crates.
// TODO: tag entities, count the number of entities with the spawn id
//       set a maximum that a spawn can create at one time. 1-5
//       if the count of tagged entities is below this, spawn a new one
// TODO: when spawning enemies, grow a collision zone that causes damage at the same time
//       this will fake touching the mob before its update can run
export class Spawn extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 32, 32)
        this.solid = 1

        this.maximum = 3 // number of entities to keep spawned at one time

        let tid = 0
        this.direction = props?.direction??Direction.UP
        switch(this.direction) {
            case Direction.LEFT:
                tid = 0;
                this.spawn_dx = -20
                this.spawn_dy = 0
                this.spawn_check = () => this.spawn_target.rect.right() < this.rect.left()
                break;
            case Direction.DOWN:
                tid = 2;
                this.spawn_dx = 0
                this.spawn_dy = 20
                this.spawn_check = () => this.spawn_target.rect.top() > this.rect.bottom()
                break;
            case Direction.RIGHT:
                tid = 3;
                this.spawn_dx = 20
                this.spawn_dy = 0
                this.spawn_check = () => this.spawn_target.rect.left() > this.rect.right()
                break;
            case Direction.UP:
            default:
                tid = 1;
                this.spawn_dx = 0
                this.spawn_dy = -20
                this.spawn_check = () => this.spawn_target.rect.bottom() < this.rect.top()
                break;
        }
        this.tid = tid

        this.spawn_timer = 0
        this.spawn_timeout = 2
        this.spawn_target = null
        this.spawning = false
    }

    paint(ctx) {

        if (this.spawn_target) {
            this.spawn_target.paint(ctx)
        }

        Spawn.sheet.drawTile(ctx, this.tid, this.rect.x, this.rect.y)
    }

    collide(other, dx, dy) {

        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    update(dt) {

        if (!this.spawn_target) {
            this.spawn_timer += dt
            if (this.spawn_timer > this.spawn_timeout) {
                this.spawn_timer = 0

                // each spawn is responsible for spawning a maximum of n
                // objects can be deleted for any reason and this will spawn a replacement
                let objs = this._x_debug_map.queryObjects({"className": "Creeper", parent_id: this.entid})

                if (objs.length < this.maximum) {

                    // create a dummy object
                    // TODO: create, then move to be centered up/down
                    // or aligned bottom for left/right
                    // TODO: allow selecting what gets spawned
                    const props = {x: this.rect.x + 8, y:this.rect.y + 8}
                    this.spawn_target = new Creeper(-1, props)
                }

            }
        } else {

            this.spawn_target.rect.x += this.spawn_dx * dt
            this.spawn_target.rect.y += this.spawn_dy * dt
            if (this.spawn_check()) {
                let rect = this.spawn_target.rect
                const props = {x: Math.floor(rect.x), y: Math.floor(rect.y)}
                // replace the dummy with a real object
                // this is closer to the correct behavior in multiplayer
                let ent = this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Creeper", props)
                ent.parent_id = this.entid
                this.spawn_target = null
            }

        }


    }
}

registerEditorEntity("Spawn", Spawn, [32,32], EntityCategory.small_mob, null, (entry)=> {
    Spawn.sheet = gAssets.sheets.pipes32
    entry.icon = makeEditorIcon(Spawn.sheet)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 0;
                break;
    
            case Direction.DOWN:
                tid = 2;
                break;
            case Direction.RIGHT:
                tid = 3;
                break;
            case Direction.UP:
            default:
                tid = 1;
                break;
        }
    
        return gAssets.sheets.pipes32.tile(tid)
    }

    entry.editorSchema = [
        {control: EditorControl.DIRECTION_4WAY, "default": Direction.UP},
    ]
})