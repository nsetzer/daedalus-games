import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, ProjectileBase, PlayerBase, makeEditorIcon, AbstractMobBase} from "@troid/entities/sys"

import {MobBase} from "@troid/entities/mobs"

// this might turn into the generic physics for point objects
class TarPhysics {
    constructor(target) {
        this.target = target

        this.speed = {x: 0, y: 0}
        this.accum = {x: 0, y: 0}

        this.standing = false

        this.group = () => {
            return Object.values(this.target._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this._init_gravity()
    }

    _update_neighborhood() {
        let rect = this.target.rect
        // todo: neighborhood size must be bigger for oneblock_walk
        // was an 8px border
        // needs to be at least 16px for oneblock walk
        this._neighborhood = new Rect(rect.x - 24, rect.y - 24, rect.w + 48, rect.h + 48);
        // TODO: its easy to softlock with red/blue switches and other dynamic entities
        // just ignoring solid objects already being collided with is problematic
        // maybe use a sensor?
        // maybe use stuck detection?
        this._neighbors = this.group().filter(ent => ent.rect.collideRect(this._neighborhood))

    }

    _init_gravity() {
        this.jumpheight = 64
        this.jumpduration = 0.22
        this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)
        // e.q. `vy = J + g * t` gives velocity at point in time
        // equals zero at maximum height of the jump
        // and equals negative jump height when reaching the starting y value
        this.terminal_velocity = - this.jumpspeed
    }

    update(dt) {
        if (!this.standing) {

            this._update_neighborhood()

            this.speed.y += (this.gravity*dt)

            this.accum.x = dt * this.speed.x
            this.accum.y = dt * this.speed.y

            // step x
            let dx = Math.trunc(this.accum.x)
            let sx = Math.sign(dx)
            let nx = Math.abs(dx)
            while (nx > 0) {
                let cx = this.target.rect.cx()
                let cy = this.target.rect.cy()

                let solid = this._neighbors.some(ent => {
                    return ent.collidePoint(cx+sx, cy)
                })

                nx -= 1

                if (!solid) {
                    this.target.rect.x += sx
                    this.accum.x -= sx
                } else {
                    this.accum.x = 0
                }
            }

            // step y
            let dy = Math.trunc(this.accum.y)
            let sy = Math.sign(dy)
            let ny = Math.abs(dy)
            while (ny > 0) {
                let cx = this.target.rect.cx()
                let cy = this.target.rect.cy()

                let entity = null
                let solid = this._neighbors.some(ent => {
                    if (ent.collidePoint(cx, cy+sy)) {
                        entity = ent
                        return true
                    } else {
                        return false
                    }
                })

                ny -= 1

                if (!solid) {
                    this.target.rect.y += sy
                    this.accum.y -= sy
                } else {
                    // TODO: look for neighboring active tar balls merge/blend
                    //       check slopes
                    this.standing = true
                    //console.log("collide with", entity._classname, entity.entid)
                    this.accum.y = 0
                    this.accum.x = 0
                }
            }
            
        }

    }

    jump() {
        this.speed.y = this.jumpspeed
        this.standing = false
    }
}

// when a tarball that is moving collides with one on the ground
// delete the new tarball
// check +/- 2 cells to the left and right 
// if a cell is empty place in that cell instead of deleting
// by growing the existing one
export class TarBall extends AbstractMobBase {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect((props?.x??0), (props?.y??0) - 2, 8, 4)

        this.fluid = 2

        // todo: size=2 when spawning from the editor
        // when it lands grow to the right by one
        // run the grow algorithm before first paint if possible

        this.visible = true
        this.animation = new AnimationComponent(this)

        this.physics = new TarPhysics(this)

        this.breakable = 0
        this.solid = 0

        this.settled = false

        this.points = null
    }

    update(dt) {

        this.physics.update(dt)

        if (this.physics.standing && !this.settled) {

            /*
            let cy = this.rect.cy()
            let hw = Math.floor(this.rect.w/2)
            //let cx = Math.round(this.rect.x/8)*8 + hw
            let cx = this.rect.cx()
            //let cx = Math.round(this.rect.x/8)*8 + hw
            let rtop = 0;
            for (let j = hw; j > -hw; j -= 2) {
                if (!this.physics._neighbors.some(ent => ent.collidePoint(cx+hw, cy + j))) {
                    rtop = j;
                    break;
                }
            }

            let ltop = 0;
            for (let j = hw; j > -hw; j -= 2) {
                if (!this.physics._neighbors.some(ent => ent.collidePoint(cx-hw, cy + j))) {
                    ltop = j;
                    break;
                }
            }

            //this.points = [
            //    {x: cx - hw, y: cy + ltop - 2}, 
            //    {x: cx + hw, y: cy + rtop - 2}, 
            //    {x: cx + hw, y: cy + rtop + 6},
            //    {x: cx - hw, y: cy + ltop + 6}, 
            //]

            //console.log("slope", ltop, rtop, (ltop - rtop) / this.rect.w)
            */

            let objs = this._x_debug_map.queryObjects({"className": "TarBall"})

            let hw = Math.floor(this.rect.w/2)
            let dd = 4 + 2*hw
            let lfriend = null
            let lfriend_delta = -dd
            let lfriend_count = 0
            let rfriend = null
            let rfriend_delta = dd
            let rfriend_count = 0
            // extend upwards in the y direction to find friends on a slope
            let rect = new Rect(this.rect.cx() - dd, this.rect.cy() - 8, 2*dd, 16)
            this.rect2 = rect
            objs.forEach(obj => {
                if (obj.rect.collideRect(rect)) {
                    if (obj.entid === this.entid) {
                        return
                    }
                    let delta = obj.rect.cx() - rect.cx()
                    if (delta < 0) {
                        if (delta > -dd) {
                            lfriend_count += 1
                        }
                        if (delta > lfriend_delta) {
                            lfriend = obj
                            lfriend_delta = delta
                        }
                    } else {
                        if (delta < dd) {
                            rfriend_count += 1
                        }
                        if (delta < rfriend_delta) {
                            rfriend = obj
                            rfriend_delta = delta
                        }
                    }
                }
            })

            console.log("friends", objs.length, hw, dd,
                "l", !!lfriend, lfriend_delta, lfriend_count,
                "r", !!rfriend, rfriend_delta, rfriend_count,
                "d", rfriend_delta - lfriend_delta)

            if (!!lfriend && !lfriend.rfriend) {
                console.log("make friends 1")
                this.rect.x = lfriend.rect.x + 8
            } 
            else if (!!rfriend && !rfriend.lfriend) {
                console.log("make friends 2")
                this.rect.x = rfriend.rect.x - 8
            } 

            if (rfriend_delta <= hw || lfriend_delta >= -hw) {
                console.log("destroying self 1")
                this.destroy()
            }
            else if (rfriend_count > 1 || lfriend_count > 1) {
                console.log("destroying self 2")
                this.destroy()
            } else {

                if (!!rfriend) {
                    rfriend.updateFriend(this, -1)
                }

                if (!!lfriend) {
                    lfriend.updateFriend(this, 1)
                }

                this.rfriend = rfriend
                this.lfriend = lfriend
                this._updateShape()
            }

            //this.rect.x = Math.round(this.rect.x/8)*8
            this.settled = true
        }

    }

    paint(ctx) {


        if (!this.settled) {
            ctx.fillStyle = "black";
            ctx.strokeStyle = "black";
            ctx.beginPath();
            ctx.arc(
                this.rect.x + (this.rect.w / 2), 
                this.rect.y + (this.rect.h / 2), 
                4, 
                0, 
                2 * Math.PI);
            ctx.stroke();
            ctx.closePath();
        }

        /*
        if (!!this.rect2) {
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)
            ctx.stroke();
            ctx.closePath();
        }*/
        // draw a polygon using points
        
        ctx.fillStyle = ["#22ee22", "#33cc33", "#44aa44", "#558855"][Math.floor(this.rect.x/8)%4]
        if (this.points) {
            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            ctx.closePath();
            ctx.fill()
        }



    }

    _updateShape() {
        
        this.points = []

        let left, right, ltop, rtop, lbot, rbot;

        let midpoint = (a,b) => {
            // where 'a' is expected to be lower than 'b'
            return a + Math.floor((b - a)/2)
            /*
            if (b <= a) {
                return a
            } else {
                return a + Math.floor((b - a)/2)
            }*/
        }

        if (!!this.lfriend) {
            left = midpoint(this.rect.left(), this.lfriend.rect.right())
            ltop = midpoint(this.rect.top(), this.lfriend.rect.top())
            lbot = midpoint(this.rect.bottom(), this.lfriend.rect.bottom())
        } else {
            left = this.rect.left()
            ltop = this.rect.top()
            lbot = this.rect.bottom()
        }

        if (!!this.rfriend) {
            right = midpoint(this.rect.right(), this.rfriend.rect.left())
            rtop = midpoint(this.rect.top(), this.rfriend.rect.top())
            rbot = midpoint(this.rect.bottom(), this.rfriend.rect.bottom())
        } else {
            right = this.rect.right()
            rtop = this.rect.top()
            rbot = this.rect.bottom()
        }

        if (right - left < 1) {
            console.error("invalid shape", left, right, right-left, this.rect.top(), this.rect.bottom())
        } else {
            console.log("shape", left, right, right-left, ltop, rtop, lbot, rbot)
        }

        this.points = [
            {x: left, y: ltop}, 
            {x: right, y: rtop}, 
            {x: right, y: rbot},
            {x: left, y: lbot},
        ]
    }
    updateFriend(other, dir) {
        if (dir < 0) {
            this.lfriend = other
        } else {
            this.rfriend = other
        }

        this._updateShape()

    }
}

registerEditorEntity("TarBall", TarBall, [16,16], EntityCategory.hazard, null, (entry)=> {
    entry.icon = gAssets.sheets.ruler.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})