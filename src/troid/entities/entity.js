 
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


export class EquipmentItem extends MobBase {

}

registerEditorEntity("EquipmentItem", EquipmentItem, [16,16], EntityCategory.item, null, (entry)=> {
    EquipmentItem.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
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





