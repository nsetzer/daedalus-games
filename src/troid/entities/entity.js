 
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

import {ProjectileBase,} from "@troid/entities/projectiles"
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

        /*
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
        */

        gAssets.sheets.crate.drawTile(ctx, 0, this.rect.x, this.rect.y)

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
    entry.icon = makeEditorIcon(gAssets.sheets.crate, 1)
    entry.editorIcon = null
    entry.editorSchema = []
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

        Door.sheet.drawTile(ctx, this.tid, this.rect.x, this.rect.y)

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










