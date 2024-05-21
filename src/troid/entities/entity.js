 
 /*
import {} from "@daedalus/daedalus"

import {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
} from "@axertc/axertc_common"
*/

// 


import {} from "@daedalus/daedalus"

import {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
} from "@axertc/axertc_common"


import {
    Physics2dPlatform, Physics2dPlatformV2, PlatformerEntity, PlatformBase, Wall, Slope, OneWayWall,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType, EditorControl} from "@troid/store"

import {defaultEntities, editorEntities, registerDefaultEntity, registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"
import {MobCharacterComponent, MobBase} from "@troid/entities/mobs"

import {ProjectileBase, Bullet, BubbleBullet, BounceBullet, WaterBeam, FireBeam} from "@troid/entities/projectiles"
import {Player} from "@troid/entities/player"
/*
class EditorEntity {
    constructor() {
        this.name = ""         // the class name
        this.ctor = null       // the constructor function
        this.size = [0,0]      // the size of the entity in pixels
        this.category = 0      // the EntityCategory
        this.onLoad = null     // (entry) => {}
        this.sheet = null      // deprecated?
        this.icon = null       // a 16x16 icon
        this.editorSchema = [] // list of schemas
        this.editorIcon = null // (props) => {return image}
    }
}
*/

export class Crate extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 32, 32)

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

        this.physics.standing_direction = Direction.DOWN

        this.breakable = 0
        this.alive = 1
        this.solid = 1

        this.particles = []
        this.timer = 0
        this.timeout = 2 // enough time for particles to fall off the screen
    }

    onPress(other, vector) {

        if (vector.x != 0) {
            this.physics.step(vector.x, 0)

            this.physics.moving_direction = Direction.fromVector(vector.x, 0)
            this.moving_timer = .1

            //this.physics.speed.x = 60 * vector.x
            //this.physics.moving_direction = Direction.fromVector(vector.x, 0)
        }

    }

    paint(ctx) {

        ctx.beginPath()
        ctx.fillStyle = 'red'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()

        ctx.font = "bold 10px";
        ctx.fillStyle = "black"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`${Math.floor(this.physics.speed.x)}, ${Math.floor(this.physics.speed.y)}`, this.rect.x, this.rect.y);
        ctx.fillText(`${Math.floor(this.physics.accum.x)}, ${Math.floor(this.physics.accum.y)}`, this.rect.x, this.rect.y+12);
        ctx.fillText(`${Direction.name[this.physics.moving_direction]}`, this.rect.x, this.rect.y+24);

    }

    update(dt) {

        this.physics.update(dt)

        if (this.moving_timer > 0) {
            this.moving_timer -= dt
            if (this.moving_timer <= 0) {
                this.physics.moving_direction = Direction.NONE
            }
        }

    }
}

registerEditorEntity("Crate", Crate, [32,32], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.brick.tile(4)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class Spikes extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.rect2 = new Rect(this.rect.x+4, this.rect.y+4, 8, 8)
        this.solid = 1
        this.direction = props?.direction??Direction.UP

        let tid = 0
        switch(this.direction) {
            case Direction.LEFT:
                tid = 3
                this.rect.x += 8
                this.rect.w = 8
                this.offset_x = -8
                this.offset_y = 0
                break;
            case Direction.DOWN:
                tid = 2
                this.rect.h = 8
                this.offset_x = 0
                this.offset_y = 0
                break;
            case Direction.RIGHT:
                tid = 1
                this.rect.w = 8
                this.offset_x = 0
                this.offset_y = 0
                break;
            case Direction.UP:
            default:
                tid = 0
                this.rect.y += 8
                this.rect.h = 8
                this.offset_x = 0
                this.offset_y = -8
                break;
        }
        this.tid = tid
    }

    paint(ctx) {
        Spikes.sheet.drawTile(ctx, this.tid, this.rect.x + this.offset_x, this.rect.y + this.offset_y)
    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            if (this.rect2.collideRect(player.rect)) {
                player.character.hit()
            }
        }
    }

}

registerEditorEntity("Spikes", Spikes, [16,16], EntityCategory.hazard, null, (entry)=> {
    Spikes.sheet = gAssets.sheets.spikes
    entry.icon = gAssets.sheets.spikes.tile(0)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 3;
                break;
            case Direction.DOWN:
                tid = 2;
                break;
            case Direction.RIGHT:
                tid = 1;
                break;
            case Direction.UP:
            default:
                tid = 0;
                break;
        }

        return gAssets.sheets.spikes.tile(tid)
    }
    entry.editorSchema = [
        {control: EditorControl.DIRECTION_4WAY, "default": Direction.UP},
    ]
})

// TODO: create separate spawner for flies which can spawn 1-5 flies
// TODO: be able to spawn crates.
// TODO: tag entities, count the number of entities with the spawn id
//       set a maximum that a spawn can create at one time. 1-5
//       if the count of tagged entities is below this, spawn a new one
export class Spawn extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 32, 32)
        this.solid = 1

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

                let objs = this._x_debug_map.queryObjects({"className": "Creeper"})

                if (objs.length < 3) {

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
                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Creeper", props)
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

export class BubbleCannon extends PlatformerEntity {
    // todo: add a synchonization property
    //       'A' cannnons fire on a set interval
    //       'B' cannons fire on the same interval, offset by 1/2

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.solid = 1

        let tid = 0
        this.direction = props?.direction??Direction.RIGHT
        switch(this.direction) {
            case Direction.LEFT:
                tid = 3
                this.spawn_dx = -8
                this.spawn_dy = 8
                break;
            case Direction.DOWN:
                tid = 2
                this.spawn_dx = 8
                this.spawn_dy = this.rect.h + 8
                break;
            case Direction.RIGHT:
                tid = 1
                this.spawn_dx = this.rect.w+8
                this.spawn_dy = 8
                break;
            case Direction.UP:
            default:
                tid = 0
                this.spawn_dx = 8
                this.spawn_dy = -8
                break;
        }
        this.tid = tid

        this.spawn_timer = 0
        this.spawn_timeout = 2.5;

    }

    paint(ctx) {
        BubbleCannon.sheet.drawTile(ctx, this.tid, this.rect.x, this.rect.y)
    }

    collide(other, dx, dy) {

        // TODO: can default collision functions be removed?
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

        this.spawn_timer += dt;
        if (this.spawn_timer > this.spawn_timeout) {
            this.spawn_timer -= this.spawn_timeout


            const projectile = {
                name: "BubbleBullet", 
                props: {
                    x: this.rect.x + this.spawn_dx, 
                    y: this.rect.y + this.spawn_dy,
                    direction: this.direction,
                    color: 4,
                    element: WeaponType.ELEMENT.BUBBLE,
                    wave: 0,
                    bounce: 1,
                    level: WeaponType.LEVEL.LEVEL1,
                    power:1.0,
                    split:3,
                    variance: 1
                }
            }
            this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), projectile.name, projectile.props)

        }


        /*
            if (this.spawn_check()) {
                const props = {
                    x: this.rect.x + this.spawn_dx, 
                    y: this.rect.y + this.spawn_dy
                }
                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Creeper", props)
            }
        */        
    }
}

registerEditorEntity("BubbleCannon", BubbleCannon, [16,16], EntityCategory.hazard, null, (entry)=> {
    BubbleCannon.sheet = gAssets.sheets.cannon
    entry.icon = makeEditorIcon(BubbleCannon.sheet)

    // dynamic icon in editor
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 3;
                break;
            case Direction.DOWN:
                tid = 2;
                break;
            case Direction.RIGHT:
                tid = 1;
                break;
            case Direction.UP:
            default:
                tid = 0;
                break;
        }
    
        return BubbleCannon.sheet.tile(tid)
    }

    entry.editorSchema = [
        {control: EditorControl.DIRECTION_4WAY, "default": Direction.RIGHT},
    ]

})

export class Door extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 32, 32)
        this.solid = 1
        //this.collide = 1

        this.target_world_id = props?.target_world_id??"<none>"
        this.target_level_id = props?.target_level_id??0
        this.target_door_id = props?.target_door_id??0

        // todo: where best to unpack this?
        if (this.target_world_id === "<current>") {
            this.target_world_id = gCharacterInfo.current_map.world_id
        }

        let tid = 0
        this.direction = props?.direction??Direction.UP
        // speed things up in development
        let speed = daedalus.env.debug?60:20
        switch(this.direction) {
            case Direction.LEFT:
                tid = 0;
                this.spawn_dx = -speed
                this.spawn_dy = 0
                this.spawn_check = () => this.spawn_target.rect.right() < this.rect.left()
                this.despawn_check = () => this.spawn_target.rect.left() >= (this.rect.left()+8)
                break;
            case Direction.DOWN:
                tid = 2;
                this.spawn_dx = 0
                this.spawn_dy = speed
                this.spawn_check = () => this.spawn_target.rect.top() > this.rect.bottom()
                this.despawn_check = () => this.spawn_target.rect.bottom() <= (this.rect.bottom()-1)
                break;
            case Direction.RIGHT:
                tid = 3;
                this.spawn_dx = speed
                this.spawn_dy = 0
                this.spawn_check = () => this.spawn_target.rect.left() > this.rect.right()
                this.despawn_check = () => this.spawn_target.rect.right() <= (this.rect.right()-8)
                break;
            case Direction.UP:
            default:
                tid = 1;
                this.spawn_dx = 0
                this.spawn_dy = -speed
                this.spawn_check = () => this.spawn_target.rect.bottom() < this.rect.top()
                this.despawn_check = () => this.spawn_target.rect.top() >= (this.rect.top()+8)
                break;
        }
        this.tid = tid

        this.spawn_timer = 0
        this.spawn_timeout = 2
        this.spawn_target = null

        this.despawn = false
    }

    paint(ctx) {

        Spawn.sheet.drawTile(ctx, this.tid, this.rect.x, this.rect.y)

        //let recta = new Rect(this.rect.x, this.rect.y, 8, 32)
        //let rectb = new Rect(this.rect.x+24, this.rect.y, 8, 32)
        //ctx.beginPath()
        //ctx.fillStyle = "red"
        //ctx.rect(recta.x, recta.y, recta.w, recta.h)
        //ctx.rect(rectb.x, rectb.y, rectb.w, rectb.h)
        //ctx.closePath()
        //ctx.fill()


    }

    collide(other, dx, dy) {

        let rectc = this.rect
        // TODO: maybe do a negative collide?
        // how to stand on object and not go thru until down is pressed?

        //if (this.direction & Direction.UPDOWN) {
        //    let recta = new Rect(this.rect.x, this.rect.y, 8, 32)
        //    let rectb = new Rect(this.rect.x+24, this.rect.y, 8, 32)
//
        //    if (other.rect.cx() < this.rect.cx()) {
        //        rectc = recta
        //        console.log("recta")
        //    } else {
        //        console.log("rectb")
        //        rectc = rectb
        //    }
        //}
        //else {
        //    rectc = this.rect
        //}-

        // =====================

        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= rectc.left()) {
            update.set_right(rectc.left())
            return update
        }

        else if (dx < 0 && rect.left() >= rectc.right()) {
            update.set_left(rectc.right())
            return update
        }

        else if (dy > 0 && rect.bottom() <= rectc.top()) {
            update.set_bottom(rectc.top())
            return update
        }

        else if (dy < 0 && rect.top() >= rectc.top()) {
            update.set_top(rectc.bottom())
            return update
        }

        return null
    }

    update(dt) {

        if (!!this.spawn_target) {
            if (this.despawn) {
                this.spawn_target.rect.x -= this.spawn_dx * dt
                this.spawn_target.rect.y -= this.spawn_dy * dt
                if (this.despawn_check()) {
                    console.log("despawn finished")


                    gCharacterInfo.transitionToLevel(this.target_world_id, this.target_level_id, this.target_door_id)
                    this.spawn_target = null // prevent transitioning again
                }
            } else {
                this.spawn_target.rect.x += this.spawn_dx * dt
                this.spawn_target.rect.y += this.spawn_dy * dt
                if (this.spawn_check()) {
                    console.log("spawn finished")
                    this.spawn_target.setSpawning(Direction.NONE)
                    this.spawn_target = null
                }
            }
        }
    }

    spawnEntity(ent) {


        ent.rect.x = this.rect.cx() - Math.floor(ent.rect.w/2)
        ent.rect.y = this.rect.cy() - Math.floor(ent.rect.h/2)
        this.spawn_target = ent
        this.spawn_target.setSpawning(this.direction)
        this.spawn_target.physics.moving_direction = Direction.NONE
        if ((this.direction&Direction.LEFTRIGHT)==0) {
            this.spawn_target.physics.facing = Direction.RIGHT
        } else {
            this.spawn_target.physics.facing = this.direction
        }

        this.spawn_target.physics.speed.x = 0
        this.spawn_target.physics.xaccum = 0
        this.spawn_target.physics.speed.y = 0
        this.spawn_target.physics.yaccum = 0
        this.despawn = false
    }

    interact(ent, direction) {

        if (this.target_world_id === "<none>") {
            return
        }

        if (Direction.flip[direction]==this.direction) {

            // first attempt at trying to center the player on the door
            // before letting them pass through
            if (this.direction&Direction.LEFTRIGHT) {
                if (Math.abs(ent.rect.cy() - this.rect.cy()) > 4) {
                    return
                }
            } else if (this.direction&Direction.UPDOWN) {
                if (Math.abs(ent.rect.cx() - this.rect.cx()) > 8) {
                    return
                }
            }

            this.spawn_target = ent
            ent.setSpawning(direction) // despawn is the reverse direction of spawn
            this.despawn = true
            switch (this.direction) {

                case Direction.LEFT:
                    //ent.rect.x = this.rect.cx() - ent.rect.w/2
                    //ent.rect.y = this.rect.top() - ent.rect.h
                    break;
                case Direction.RIGHT:
                    //ent.rect.x = this.rect.cx() - ent.rect.w/2
                    //ent.rect.y = this.rect.top() - ent.rect.h
                    break;
                case Direction.UP:
                    ent.rect.x = this.rect.cx() - ent.rect.w/2
                    ent.rect.y = this.rect.top() - ent.rect.h
                    break;
                case Direction.DOWN:
                    ent.rect.x = this.rect.cx() - ent.rect.w/2
                    ent.rect.y = this.rect.bottom()
                    break;
            }

        }
    }
}

registerEditorEntity("Door", Door, [32,32], EntityCategory.door, null, (entry)=> {
    Door.sheet = gAssets.sheets.pipes32
    entry.icon = makeEditorIcon(Door.sheet, 1)
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
        {control: EditorControl.DOOR_ID},
        {control: EditorControl.DOOR_TARGET},
    ]
})

export class CreeperV2 extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.visible = true

        this.solid = 0

        this.physics = new Physics2dPlatformV2(this, {
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
            wallwalk: true
        })
        // todo init as 'clockwise' or 'counter-clockwise' then set the direction
        // once the standing direction is determined
        this.physics.moving_direction = Direction.RIGHT
        this.physics.moving_speed = 35

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid && ent instanceof PlatformBase})
        }

        this.animation = new AnimationComponent(this)
        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = 0
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

        let ncols = 1
        let nrows = 1
        let aid;
        let sheet = CreeperV2.sheet

        aid = this.animation.register(sheet, [0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [0], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [0], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset:-8, yoffset:-8, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations.run[Direction.LEFT])

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

            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                let player = objs[0]
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

registerEditorEntity("CreeperV2", CreeperV2, [16,16], EntityCategory.small_mob, null, (entry)=> {
    CreeperV2.sheet = gAssets.sheets.ruler
    entry.icon = CreeperV2.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class Flyer extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 8)
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
        let xoffset = - 4
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

        let ncols = 3
        let nrows = 3
        let aid;
        let sheet = Flyer.sheet

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
                    player.character.hit()
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

registerEditorEntity("Flyer", Flyer, [16,16], EntityCategory.small_mob, null, (entry)=> {
    Flyer.sheet = gAssets.sheets.shredder
    entry.icon = makeEditorIcon(Flyer.sheet)
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
                    player.character.hit()
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

class TextTyper {
    //TODO: support multiple pages
    //TODO: support typing one letter at a time
    //TODO: auto advance and text type time controllable in settings (slow, medium, fast)
    //TODO: page duration a function of the content
    constructor(text) {

        console.log("show text", text)
        this.text = text

        this.state = 0

        this.timer_show = 0
        this.timer_show_duration = 0.5

        this.timer_page = 0
        this.timer_page_duration = 3
    }

    paint(ctx) {

        let x = 0 //gEngine.scene.camera.x
        let y = 48 //gEngine.scene.camera.y + 48
        let w = gEngine.view.width - 16
        let h = 48

        if (this.state == 0 || this.state == 2) {
            w *= this.timer_show/this.timer_show_duration
            ctx.beginPath()
            ctx.fillStyle = "#000000c0"
            ctx.rect(x + gEngine.view.width/2 - w/2, y, w, h)
            ctx.closePath()
            ctx.fill()
        } else if (this.state == 1) {
            ctx.beginPath()
            ctx.fillStyle = "#000000c0"
            let l = x + gEngine.view.width/2 - w/2

            ctx.rect(l, y, w, h)
            ctx.closePath()
            ctx.fill()

            ctx.font = "bold 16px";
            ctx.fillStyle = "white"
            ctx.strokeStyle = "white"
            ctx.textAlign = "left"
            ctx.textBaseline = "top"
            ctx.fillText(this.text, l + 8, y + 8);
        }
    }

    dismiss() {
        if (this.state < 2) {
            this.timer_show = this.timer_show_duration
            this.timer_page = this.timer_page_duration
            this.state = 2 // dismiss
        }
    }

    update(dt) {
        if (this.state == 0) {
            this.timer_show += dt
            if (this.timer_show > this.timer_show_duration) {
                this.timer_show = this.timer_show_duration
                this.state = 1 // show text
            }
        } else if (this.state == 1) {
            this.timer_page += dt
            if (this.timer_page > this.timer_page_duration) {
                this.timer_show = this.timer_show_duration
                this.timer_page = this.timer_page_duration
                this.state = 2 // dismiss
            }

        } else if (this.state == 2) {

            this.timer_show -= dt
            if (this.timer_show < 0) {
                this.state = 3 // hide
            }
        }
    }
}

export class HelpFlower extends MobBase {
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
        let xoffset = 0
        let yoffset = 0

        this.animations = {
            "idle":{},
            "talk":{},
        }

        let sheet = HelpFlower.sheet
        let ncols = sheet.cols
        let nrows = sheet.rows
        let aid;

        aid = this.animation.register(sheet, [0,1,2,3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [8,9,10,11], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [4,5,6,7], spf, {xoffset, yoffset})
        this.animations["talk"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [12,13,14,15], spf, {xoffset, yoffset})
        this.animations["talk"][Direction.RIGHT] = aid

        this.animation.setAnimationById(this.animations.idle[Direction.LEFT])

    }

    paint(ctx) {
        this.animation.paint(ctx)
    }

    update(dt) {
        this.character.update(dt)
        this.animation.update(dt)

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

                if (this.player_near) {
                    gEngine.scene.dialog = new TextTyper(this.helpText)
                } else {
                    gEngine.scene.dialog.dismiss()
                }
            }

            if (!this.player_near) {
                if (player.rect.cx() < this.rect.cx()) {
                    this.facing = Direction.LEFT
                } else {
                    this.facing = Direction.RIGHT
                }
                this.animation.setAnimationById(this.animations.idle[this.facing])
            }
        }
    }

    _kill() {
    }

    _kill2() {
    }
}

registerEditorEntity("HelpFlower", HelpFlower, [32,32], EntityCategory.small_mob, null, (entry)=> {
    HelpFlower.sheet = gAssets.sheets.help_flower
    entry.icon = makeEditorIcon(HelpFlower.sheet)
    entry.editorIcon = (props) => {
        let tid = 0
        return gAssets.sheets.help_flower.tile(tid)
    }
    entry.editorSchema = [
        {control: EditorControl.TEXT, "property": "helpText"},
    ]
})


export class EquipmentItem extends MobBase {

}

registerEditorEntity("EquipmentItem", EquipmentItem, [16,16], EntityCategory.item, null, (entry)=> {
    EquipmentItem.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class Flipper extends Slope {
    constructor(entid, props) {
        if (props.direction == Direction.LEFT) {
            props.x += 10
        } else {
            props.x += 12
        }
        props.w = 26
        props.h = 27
        super(entid, props)

        
        this.visible =1

        let tid = 0
        switch(this.direction) {
            case Direction.LEFT:
                tid = 6
                break;
            case Direction.RIGHT:
                tid = 2
                break;
        }
        this.tid = tid

        this.timer = 0
    }

    isSolid(other) {
        //console.log(other.rect.bottom(), this.rect.top(), other.rect.bottom() < this.rect.top())
        //return other.rect.bottom() <= this.rect.top()
        return true
    }

    init_points() {
        this.points = []
        // points are organized such that:
        // origin is always first
        // left most non-origin point is second
        // right most non-origin point is third
        switch (this.direction) {

            case Direction.RIGHT:
                this.points.push({x: this.rect.left() + 12 - 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.left() + 38 - 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.left() + 12 - 12, y: this.rect.top()})
                this.rect3 = new Rect(this.rect.left()-10, this.rect.top(), 10, 12)
                this.rect2 = new Rect(this.rect.right()-12,  this.rect.bottom() - 12, 12, 12)
                //this.direction = Direction.UPRIGHT
                break
            case Direction.LEFT:
                this.points.push({x: this.rect.right() - 12 + 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.right() - 38 + 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.right() - 12 + 12, y: this.rect.top()})
                this.rect3 = new Rect(this.rect.right(), this.rect.top(), 10, 12)
                this.rect2 = new Rect(this.rect.x,  this.rect.bottom() - 12, 12, 12)
                //this.direction = Direction.UPLEFT
                break
            default:
                throw {message: "invalid direction", direction: this.direction}
        }
    }

    collidePoint(x, y) {
        return super.collidePoint(x, y) || this.rect3.collidePoint(x,y)
    }
    
    paint(ctx) {

        let tid = this.tid
        if (this.timer > 0) {
            tid += 1
        }

        if (this.direction == Direction.LEFT) {
            Flipper.sheet.drawTile(ctx, tid, this.rect.x-10, this.rect.y)
        } else {
            Flipper.sheet.drawTile(ctx, tid, this.rect.x-12, this.rect.y)
        }

        super.paint(ctx)



        ctx.strokeStyle = 'red'
        ctx.fillStyle = "#c3a3a3";
        ctx.beginPath();
        let pts = this.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath()
        ctx.strokeStyle = 'blue'
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = 'green'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.stroke()

    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            if (this.rect2.collideRect(player.rect)) {
                player._bounce2()
                this.timer = 0.3
            }
        }

        if (this.timer > 0) {
            this.timer -= dt
        }

    }

}

registerEditorEntity("Flipper", Flipper, [48,32], EntityCategory.hazard, null, (entry)=> {
    Flipper.sheet = gAssets.sheets.flipper
    entry.icon = makeEditorIcon(Flipper.sheet)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 6;
                break;
            case Direction.RIGHT:
            default:
                tid = 2;
                break;
        }
    
        return gAssets.sheets.flipper.tile(tid)
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

export class Bumper extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y+4, 32, 12)
        this.rect2 = new Rect(props.x+2, props.y+2, 32-4, 2)

        this.timer = 0
    }

    paint(ctx) {

        let tid = 2
        if (this.timer > 0) {
            tid = 0
        }

        Bumper.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

        //ctx.strokeStyle = 'blue'
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)
        //ctx.stroke()
    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            if (this.rect2.collideRect(player.rect)) {
                player._bounce2()
                this.timer = 0.3
            }
        }

        if (this.timer > 0) {
            this.timer -= dt
        }

    }

}

registerEditorEntity("Bumper", Bumper, [32,16], EntityCategory.hazard, null, (entry)=> {
    Bumper.sheet = gAssets.sheets.bumper
    entry.icon = makeEditorIcon(Bumper.sheet)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 6;
                break;
            case Direction.RIGHT:
            default:
                tid = 2;
                break;
        }
    
        return gAssets.sheets.bumper.tile(tid)
    }
    entry.editorSchema = []
})

export class WindFan extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.solid = 1
        this.rect = new Rect(props.x, props.y, 32, 16)
        let size = 4*16
        this.rect2 = new Rect(props.x, props.y - size, 32, size)
        this.factor = 0
    }

    paint(ctx) {

        // Bumper.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

        ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()
        ctx.beginPath()
        ctx.strokeStyle = 'yellow'
        ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)
        ctx.stroke()

        let player = this._x_debug_map.queryObjects({"className": "Player"})[0]

        ctx.beginPath()
        ctx.font = "16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`${Math.round(player.physics.speed.y)}, ${this.factor.toFixed(3)}`, this.rect.x, this.rect.y);
        ctx.fillText(`boost=${Math.round(player.physics.gravityboost)} `, this.rect.x, this.rect.y+8);

    }

    update(dt) {

        // TODO: find objects that implement physics 2
        // TODO: tune the margin and scale factor to pick a specific maximum height
        this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {

            if (this.rect2.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {

                let factor;
                let margin = 32

                let y3 = this.rect2.bottom()
                let y2 = y3 - margin
                let y1 = this.rect2.top()
                let p1 = obj.rect.bottom() 

                //if (p1 > y2) {
                //    factor = 2
                //} else {
                //    factor = 1.0 - (y2 - p1) / (y2 - y1)
                //}
                factor = 2*(1.0 - (y3 - p1) / (y3 - y1))

                this.factor = factor

                let gforce1 = Math.abs(obj.physics.gravity * dt)
                let gforce2 = -Math.abs(1 * factor * gforce1)
                obj.physics.speed.y += gforce2
            }
        })

    }

}

registerEditorEntity("WindFan", WindFan, [32,16], EntityCategory.hazard, null, (entry)=> {
    WindFan.sheet = gAssets.sheets.bumper
    entry.icon = makeEditorIcon(WindFan.sheet)
    entry.editorIcon = null
    entry.editorSchema = []
    // todo: highlight the region the fan affects
    entry.editorRender = undefined
})

export class MovingPlatformUD extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        // TODO: implement `order` and process update for moving platforms 
        // before other objects which implement physics

        this.solid = 1
        
        let width = props.width??32
        let height = props.height??32 // range of travel
        let platform_height = 16 // height of the platform
        let offset = Math.min(props.offset??0, (height - platform_height))

        this.rect = new Rect(props.x, props.y+ offset, width, platform_height)
        this.range = new Rect(props.x, props.y, width, height)

        this.speed = props.speed??16
        this.accum = 0
        this.direction = 1;
    }

    paint(ctx) {

        // Bumper.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

        ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()

        let rect1 = new Rect(this.rect.x, this.rect.y-1, this.rect.w, 2)
        ctx.beginPath()
        ctx.fillStyle = 'yellow'
        ctx.rect(rect1.x, rect1.y, rect1.w, rect1.h)
        ctx.fill()

        let rect2 = new Rect(this.rect.x, this.rect.bottom()-1, this.rect.w, 2)

        ctx.beginPath()
        ctx.fillStyle = 'yellow'
        ctx.rect(rect2.x+2, rect2.y, rect2.w-4, rect2.h)
        ctx.fill()

    }

    update(dt) {

        this.accum += dt*this.speed
        let delta = Math.trunc(this.accum);
        this.accum -= delta;

        if (this.rect.bottom() + delta >= this.range.bottom()) {
            delta = this.range.bottom() - this.rect.bottom()
            this.direction = -1
        } 

        if (this.rect.top() + delta <= this.range.top()) {
            delta = this.range.top() - this.rect.top()
            this.direction = 1
        }

        for (let i = 0; i < delta; i++) {
            this.visited = {}
            this._move(this)
            this.rect.y += this.direction
        }
        /*
        
        
            this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {
                // when traveling up or down, move objects on the platform
                let rect1 = new Rect(this.rect.x, this.rect.y-1, this.rect.w, 2)
                if (rect1.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                    obj.rect.y += this.direction
                }

                if (obj.solid) {

                }
                // TODO: not clear if this is needed?
                // when traveling down, push objects below the platform down as well
                ///let rect2 = new Rect(this.rect.x, this.rect.bottom()-1, this.rect.w, 2)
                ///if (this.direction>0 && rect2.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                ///    console.log(obj._classname, "push")
                ///    obj.rect.y += step
                ///}
            })

            this.rect.y += this.direction
        */
    }

    _move(parent) {
        this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {
            if (obj.entid === parent.entid) { return }
            // when traveling up or down, move objects on the platform
            let rect1 = new Rect(parent.rect.x, parent.rect.y-1, parent.rect.w, 2)
            if (rect1.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {

                // recursivley apply the movement update to any objects standing
                // on the platform
                if (obj.solid) {
                    this._move(obj)
                }

                if (!this.visited[obj.entid]) {
                    // TODO: obj.step(0, this.direction) ??
                    // TODO: check for object being crushed and reverse direction
                    // TODO: if obj is not solid, kill it
                    obj.rect.y += this.direction
                }

                this.visited[obj.entid] = true

            }

            // recursivley apply the movement update to any objects standing
            // on a solid object on this platform
            

            // TODO: not clear if this is needed?
            // when traveling down, push objects below the platform down as well
            /*
            let rect2 = new Rect(this.rect.x, this.rect.bottom()-1, this.rect.w, 2)
            if (this.direction>0 && rect2.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                console.log(obj._classname, "push")
                obj.rect.y += step
            }
            */
        })
    }
}

registerEditorEntity("MovingPlatformUD", MovingPlatformUD, [32,16], EntityCategory.hazard, null, (entry)=> {
    MovingPlatformUD.sheet = gAssets.sheets.bumper
    entry.icon = makeEditorIcon(MovingPlatformUD.sheet)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RANGE, 
            "name": "speed",
            "min": 16, "max": 256, 
            "step": 8
        },
        {control: EditorControl.RANGE, 
            "name": "offset",
            "min": 0, "max": 256, 
            "step": 16
        },
        {control: EditorControl.RESIZE, 
            "name": "height",
            "min_width": 32, "max_width": 256, 
            "min_height": 32,
        },
    ]
    
    entry.editorRender = (ctx,x,y,props) => {

        ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.rect(x, y+props.offset, props.width, 16)
        ctx.fill()

    }
})

export class WaterHazard extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, props.width, props.height)
        this.visible = 1
        this.solid = 0
        this.fluid = 1.5

        this.physics = {
            resolution: 6,         // distance between points
            spring_constant: 0.005, //
            spring_baseline: 0.005,
            damping: 0.99,
            impulse: 5,
        }

        let n = Math.floor(this.rect.w / this.physics.resolution);
        let step = this.rect.w / n;
        
        this.points = [];
        for (let i=0; i < n+1; i++) {
            this.points.push({
                x: i*step,
                y: 0,
                spd: {y:0},
                mass: 1,
            })
        }

        // pre computed sine waves can be stacked
        // the waves are summed using an offset which advances
        // at a given rate.
        // this can give the illusion of standing waves
        this.sines = [ 
            {
                sequence: [2,1,0,1,2,3],
                magnitude: 1,
                rate: 1
            },
            {
                sequence: [1,0,1,0,],
                magnitude: 1,
                rate: 2
            }
        ]
        this.sines=[]

        this.offset = 0

        this.timer = 0;
        this.timeout = 0.1

    }

    _x_collide(other, dx, dy) {

        let rect = other.rect

        if (dy > 0 && rect.bottom() <= this.rect.top()) {

            let p = Math.floor(((rect.cx() - this.rect.x)/this.rect.w)*this.points.length)
            if (p > 0 && p < this.points.length) {
                this.points[p].y += 7
                console.log("impulse", p, 7)
            }
        }


        return null
    }

    sumSines(x) {
        let k = 0 ;
        this.sines.forEach(ptn => {
            let o = Math.floor(ptn.rate*this.offset)
            k += ptn.magnitude*ptn.sequence[(o+x)%ptn.sequence.length]
        })
        return k;
    }

    paint(ctx) {
        ctx.strokeStyle = '#0000cc7f'
        ctx.fillStyle = '#0000cc7f'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)

        let r = Math.floor(this.physics.resolution/2)
        let pt;

        for (let i=0; i <this.points.length; i++) {
            let pt = this.points[i]
            pt.draw_y = this.rect.y + this.points[i].y + this.sumSines(i)
            pt.draw_x = this.rect.x + this.points[i].x
        }

        ctx.beginPath();
        pt = this.points[0]
        ctx.moveTo(pt.draw_x, pt.draw_y)
        for (let i=0; i <this.points.length; i++) {
            pt = this.points[i]
            ctx.lineTo(pt.draw_x, pt.draw_y)
        }
        ctx.stroke();

        ctx.beginPath();
        pt = this.points[0]
        ctx.moveTo(pt.draw_x, pt.draw_y)
        for (let i=0; i <this.points.length; i++) {
            pt = this.points[i]
            ctx.lineTo(pt.draw_x, pt.draw_y)
        }
        ctx.lineTo(this.rect.right(), this.rect.bottom())
        ctx.lineTo(this.rect.left(), this.rect.bottom())
        ctx.closePath();
        ctx.fill();

        /*
        this.points.forEach((pt,i) => {
            let k = 0 ;
            this.sines.forEach(ptn => {
                let o = Math.floor(ptn.rate*this.offset)
                k += ptn.magnitude*ptn.sequence[(o+i)%ptn.sequence.length]
            })
            ctx.arc(this.rect.x+pt.x,this.rect.y + pt.y - k,r,0,360)
        })
        */
        ctx.stroke()
    }

    update(dt) {
        this.timer += dt
        if (this.timer > this.timeout) {
            this.offset += 1;
            this.timer -= this.timeout
            
            /*
            let p = this.points[0]
            if (p.spd.y < 0) {
                p.y -= this.physics.impulse
            } else {
                p.y += this.physics.impulse
            }
            */
        }


        let margin = 4
        this._x_debug_map.queryObjects({"instancein": [Player, MobBase, ProjectileBase]}).forEach(obj => {
            if (obj.rect.left() >= this.rect.left() && obj.rect.right() <= this.rect.right()) {
                if (obj.rect.bottom() > this.rect.top() && obj.rect.top() < this.rect.top()) {
                    let p = Math.floor(((obj.rect.cx() - this.rect.x)/this.rect.w)*this.points.length)
                    if (p >=0 && p < this.points.length && this.points[p].y < 5) {
                        this.points[p].y += 2 // dt*spd
                    }
                }
                /*
                if (obj.rect.bottom() > this.rect.top() - margin && obj.rect.bottom() < this.rect.top() + margin) {
                    //console.log(obj._classname, obj.physics)
                    let spd = obj.physics?.speed?.y??0
                    if (Math.abs(spd) > 1e-5) {
                        
                        let p = Math.floor(((obj.rect.cx() - this.rect.x)/this.rect.w)*this.points.length)
                        if (p >=0 && p < this.points.length) {
                            console.log("obj", obj._classname, "collide", p, dt*spd)
                            this.points[p].y += 3 // dt*spd
                        }
                    }
                }
                */
            }
        })

        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            let forceFromLeft, forceFromRight, forceToBaseline;
            let dy;

            // wrap around edges
            if (i==0) {
                dy = this.points[this.points.length - 1].y - p.y
            } else {
                dy = this.points[i - 1].y - p.y
            }
            forceFromLeft = this.physics.spring_constant * dy

            if (i == this.points.length - 1) {
                dy = this.points[0].y - p.y
            } else {
                dy = this.points[i + 1].y - p.y
            }
            forceFromRight = this.physics.spring_constant * dy

            forceToBaseline = this.physics.spring_baseline * (- p.y)

            let force = forceFromLeft+forceFromRight+forceToBaseline;
            let acceleration = force / p.mass
            p.spd.y = this.physics.damping * p.spd.y + acceleration
            p.y += p.spd.y

        }
    }

}

registerEditorEntity("WaterHazard", WaterHazard, [16,16], EntityCategory.hazard, null, (entry)=> {
    WaterHazard.sheet = gAssets.sheets.ruler
    entry.icon = WaterHazard.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RESIZE, "min_width": 32, "min_height": 32},
    ]
    /*WaterHazard.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 6;
                break;
            case Direction.RIGHT:
            default:
                tid = 2;
                break;
        }
        return gAssets.sheets.bumper.tile(tid)
    }*/
})

export class Bridge extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, props.width, props.height)
        this.visible = 1
        this.solid = 1
    }

    paint(ctx) {
        ctx.strokeStyle = '#0000cc7f'
        ctx.fillStyle = '#0000cc7f'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        for(let x=this.rect.x; x < this.rect.right(); x+=16) {
            gAssets.sheets.ruler.tile(0).draw(ctx, x, this.rect.y)
        }
        ctx.stroke()
    }

    update(dt) {
    }

}

registerEditorEntity("Bridge", Bridge, [16,16], EntityCategory.hazard, null, (entry)=> {
    Bridge.sheet = gAssets.sheets.ruler
    entry.icon = Bridge.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RESIZE, "min_width": 48, "min_height": 16},
        {control: EditorControl.CHOICE, name: "opened", "default": 1, choices: {opened:1,closed:0}}
    ]

})

export class Stamp extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, props.width, props.height)
        this.visible = 1
        this.solid = 0
    }

    paint(ctx) {
        ctx.strokeStyle = '#0000cc7f'
        ctx.fillStyle = '#0000cc7f'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        gAssets.sheets.ruler.tile(0).draw(ctx, this.rect.x, this.rect.y)
        ctx.stroke()
    }

    update(dt) {
    }

}

registerEditorEntity("Stamp", Stamp, [16,16], EntityCategory.stamp, null, (entry)=> {
    Stamp.sheet = gAssets.sheets.ruler
    entry.icon = Stamp.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})




