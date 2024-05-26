
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"

import {Player} from "@troid/entities/player"
import {MobBase} from "@troid/entities/mobs"
import {ProjectileBase} from "@troid/entities/projectiles"

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