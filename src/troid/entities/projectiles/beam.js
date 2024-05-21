

import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {registerDefaultEntity} from "@troid/entities/sys"
import { ProjectileBase } from "./base.js";
import {MobBase} from "@troid/entities/mobs"

export class BeamBase extends ProjectileBase {
    constructor(parent, element, wave) {
        super("", {})

        this.parent = parent
        this.element = element
        //this.group = this.parent.physics.group
        let rule = wave ? (ent=>ent instanceof MobBase) : (ent=>ent?.solid)
        this.group = () => Object.values(this.parent._x_debug_map.objects).filter(rule)

        this.points = []

        this.targets = []
        this.influence = null

        this.charge_amount = 0
        this.charge_duration = .8

        this.strength = 6
        this.final_maximum = (20 + this.strength * 2)
        this.dx = 4

        this.oddonly = false // only paint odd indexes

        this.targets2 = () => {
            return Object.values(this.parent._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }

    }

    paint(ctx) {

        //if (!!this.influence) {
        //    ctx.beginPath()
        //    ctx.fillStyle = "#00FF0022"
        //    ctx.rect(this.influence.x,this.influence.y,this.influence.w,this.influence.h)
        //    ctx.closePath()
        //    ctx.fill()
        //}


        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            let color = (i%2==0)?"orange":"blue"
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.rect(p.x-4, p.y-1,8,6)
            ctx.closePath()
            ctx.fill()
        }
    }

    update(dt) {

        if (this.charge_amount < this.charge_duration) {
            this.charge_amount += dt
            if (this.charge_amount > this.charge_duration) {
                this.charge_amount = this.charge_duration
            }
        }

        let dx = this.parent.current_facing&Direction.LEFT?-this.dx:this.dx
        let dy = 0

        if (this.parent.current_facing&Direction.UP) {
            dy = - this.dx * .7071
            dx *= .7071
        }

        let maximum = Math.ceil(this.final_maximum * (this.charge_amount/this.charge_duration))

        this._calc_influence(this.strength, this.final_maximum, dx, dy)
        this._calc_beam(this.strength, maximum, dx, dy)


        let p = this.points[this.points.length-1]
        let rect = new Rect(p.x - 4, p.y - 4, 8, 8)
        for (const ent of this.targets2()) {
            if (rect.collideRect(ent.rect)) {

                let props = {element: this.element, level: 1, power: this.power, dot: true}
                if (ent.hit(this, props)) {
                    //this._kill()
                }

            }
        }

    }

    _calc_influence(strength, maximum, dx, dy) {
        // infrequently determine the area of influence for the beam
        // objects that the beam could collide with
        if (gEngine.frameIndex%3==0) {
            this.targets = []

            let dx1 = dx * strength
            let dx2 = dx * Math.min(strength, maximum - strength)
            let dx3 = dx/2 * Math.max(0, maximum - strength - strength)
            let dy1 = dy * strength
            let dy2 = 0
            let dy3 = (4 * .7071) * Math.max(0, maximum - strength - strength)

            // add 32 for the size of the parent sprite

            let x1,x2,y1,y2
            if (this.parent.current_facing&Direction.LEFT) {
                x1 = this.parent.rect.cx() + dx1 + dx2 + dx3 - 32
                x2 = this.parent.rect.cx()
            } else {
                x1 = this.parent.rect.cx()
                x2 = this.parent.rect.cx() + dx1 + dx2 + dx3 + 32
            }
            y1 = this.parent.rect.cy() + Math.min(dy1, 0) - 32
            y2 = this.parent.rect.cy() + dy1 + dy2 + dy3 + 32
            this.influence = new Rect(x1,y1,x2-x1,y2-y1)

            this.targets = this.group().filter(ent => ent.rect.collideRect(this.influence))
        }
    }

    _calc_beam(strength, maximum, dx, dy) {

        this.points = []
        let p = this.parent.weapon_offset[this.parent.current_facing]
        let x = this.parent.rect.x + p.x
        let y = this.parent.rect.y + p.y
        let d = ((dy<0)?Direction.UP:Direction.NONE) | ((dx<0)?Direction.LEFT:Direction.RIGHT)

        this.points.push({x,y,d})

        for (let i=0; i< maximum; i++) {
            if (i < strength) {
                x += dx
                y += dy
                d = ((dy<0)?Direction.UP:Direction.NONE) | ((dx<0)?Direction.LEFT:Direction.RIGHT)
            } else if (dy < 0 && i < 2*strength) {
                x += dx
                //y += dy
                d = ((dx<0)?Direction.LEFT:Direction.RIGHT)
            } else {
                x += dx/2
                y += (4 * .7071)

                d = Direction.DOWN | ((dx<0)?Direction.LEFT:Direction.RIGHT)

            }

            if (!this.oddonly || (this.oddonly && i%2==1)) {
                this.points.push({x,y,d})
            }

            if (this.points.length > 1) {
                if (this.targets.map(ent => ent.rect.collidePoint(x,y)).reduce((a,b)=>a+b, 0)>0) {
                    break
                }
            }
        }

    }
}

export class WaterBeam extends BeamBase {
    constructor(parent, wave) {
        super(parent, WeaponType.ELEMENT.WATER, wave)
        // TODO: wave beam should not have gravity
        this.strength = 9
        this.final_maximum = 4 * this.strength //(20 + this.strength * 2)
        this.power = 0

        this.tiles = {}

        this.tiles[Direction.RIGHT]     = [[ 7*7+0,  7*7+1,  7*7+2], [ 8*7+0,  8*7+1,  8*7+2]]
        this.tiles[Direction.LEFT]      = [[ 7*7+4,  7*7+5,  7*7+6], [ 8*7+4,  8*7+5,  8*7+6]]
        this.tiles[Direction.UPRIGHT]   = [[ 9*7+0,  9*7+1,  9*7+2], [10*7+0, 10*7+1, 10*7+2]]
        this.tiles[Direction.DOWNRIGHT] = [[ 9*7+4,  9*7+5,  9*7+6], [10*7+4, 10*7+5, 10*7+6]]
        this.tiles[Direction.UPLEFT]    = [[11*7+0, 11*7+1, 11*7+2], [12*7+0, 12*7+1, 12*7+2]]
        this.tiles[Direction.DOWNLEFT]  = [[11*7+4, 11*7+5, 11*7+6], [12*7+4, 12*7+5, 12*7+6]]

    }

    paint(ctx) {

        //if (!!this.influence) {
        //    ctx.beginPath()
        //    ctx.fillStyle = "#00FF0022"
        //    ctx.rect(this.influence.x,this.influence.y,this.influence.w,this.influence.h)
        //    ctx.closePath()
        //    ctx.fill()
        //}


        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            //let color = (i%2==0)?"orange":"blue"
            //ctx.fillStyle = color
            //ctx.beginPath()
            //ctx.rect(p.x-4, p.y-1,8,6)
            //ctx.closePath()
            //ctx.fill()
            // alternate j between 0 and 1 on every 1/4 second
            // and for every other component of the stream
            let j = (Math.floor(gEngine.frameIndex/6)+i)%2
            if (i==0) {
                gAssets.sheets.beams16.drawTile(ctx, this.tiles[p.d][j][0], p.x-8, p.y-8)
            }
            else if (i==this.points.length-1) {
                gAssets.sheets.beams16.drawTile(ctx, this.tiles[p.d][j][2], p.x-8, p.y-8)
            }
            else {
                gAssets.sheets.beams16.drawTile(ctx, this.tiles[p.d][j][1], p.x-8, p.y-8)
            }

        }
    }
}

registerDefaultEntity("WaterBeam", WaterBeam, (entry)=> {

})

export class FireBeam extends BeamBase {
    constructor(parent, wave) {
        super(parent, WeaponType.ELEMENT.FIRE, wave)
        this.power = 0

        // only draws every other point
        // this improves the collision detection
        this.strength = 10
        this.final_maximum = 10
        this.oddonly = true
        this.dx = 5
        this.charge_duration = .2

        this.tiles_a = []
        this.tiles_b = []

        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+1))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+1))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+2))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+3))

        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+1))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+1))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+2))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+3))

    }

    paint(ctx) {

        //if (!!this.influence) {
        //    ctx.beginPath()
        //    ctx.fillStyle = "#00FF0022"
        //    ctx.rect(this.influence.x,this.influence.y,this.influence.w,this.influence.h)
        //    ctx.closePath()
        //    ctx.fill()
        //}

        let tiles = (Math.floor(gEngine.frameIndex/15)%2==0)?this.tiles_a:this.tiles_b
        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            let r = Math.floor(2 + 3 * ((i+1)/this.final_maximum))
            let color = (i%2==0)?"orange":"blue"

            if (i==this.points.length-1) {
                tiles[5].draw(ctx, p.x-8+2,p.y-12+2)
            } else {
                tiles[i].draw(ctx, p.x-8+2,p.y-12+2)
            }

            //ctx.fillStyle = color
            //ctx.beginPath()
            //ctx.arc(
            //    p.x-4,
            //    p.y-1 + r,
            //    r,
            //    0,2*Math.PI)
            //ctx.closePath()
            //ctx.fill()
        }
    }
}

registerDefaultEntity("FireBeam", FireBeam, (entry)=> {

})