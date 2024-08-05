
import {
    Direction,
    Rect
} from "@axertc/axertc_common"

import {
    SpriteSheet
} from "@axertc/axertc_client"

import {gAssets, CharacterInventoryEnum, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, TextTyper, makeEditorIcon, ProjectileBase} from "@troid/entities/sys"
import {
    PlatformerEntity, AnimationComponent
} from "@axertc/axertc_physics"
import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"


/**
 * TODO: the bridge needs two layers
 * where the chain is drawn above other objects
 * and the rest of the bridge is drawn below the player
 * similar to the loop
 * perhaps spawn a secondary non-solid object with the correct layer?
 */
export class Bridge extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y - props.width, props.width, 16 + props.width)
        this.rect_opened = new Rect(props.x, props.y, props.width, 12)
        this.rect_closed = new Rect(props.x + props.width - 16, props.y - props.width + 16 + 8, 16, props.width - 8)
        //this.rect_sensor = new Rect(props.x + props.width - 16, props.y - props.width, 16, 16)
        this.visible = 1
        this.solid = 1

        this.angle = 90
        this.direction = -1
        this.bridgeState = 0

        this.block_icon = gAssets.themes[gAssets.mapinfo.theme].sheets[1].tile(33)

        this.switch_target_id = props.switch_target_id
    }

    collidePoint(x, y) {
        /*
        if (this.bridgeState == 0) {
            if (this.angle == 90) {
                return this.rect_closed.collidePoint(x, y)
            } else {
                return this.rect_opened.collidePoint(x, y)
            }
        }
        return false;
        */
        // essentially not solid when moving, 
        // always block progress unless fully opened
        if (this.bridgeState == 0 && this.angle == 0) {
            return this.rect_opened.collidePoint(x, y)
        }
        return this.rect_closed.collidePoint(x, y)

    }

    paint(ctx) {

        /*
        ctx.beginPath()
        ctx.strokeStyle = '#00cc007f'
        ctx.rect(this.rect_sensor.x, this.rect_sensor.y, this.rect_sensor.w, this.rect_sensor.h)
        ctx.fill()

        ctx.beginPath()
        ctx.strokeStyle = '#0000cc'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = '#cccccc'
        ctx.rect(this.rect_opened.x, this.rect_opened.y, this.rect_opened.w, this.rect_opened.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = '#cccccc'
        ctx.rect(this.rect_closed.x, this.rect_closed.y, this.rect_closed.w, this.rect_closed.h)
        ctx.stroke()
        */



        // draw the bridge

        // draw a line from the right side of the rect to a point 30 pixels away using this.angle
        let p1 = {x: this.rect.right() - 8, y: this.rect.bottom() - 8}
        let p2 = {}
        p2.x = p1.x - (this.rect.w - 16) * Math.cos(-this.angle * Math.PI / 180)
        p2.y = p1.y + (this.rect.w - 16) * Math.sin(-this.angle * Math.PI / 180)
        // calculate the slope between the two points
        let dy = p2.y - p1.y
        let dx = p2.x - p1.x
        let bslope = (p2.y - p1.y) / (p2.x - p1.x)
        let steps = Math.round(this.rect.w / 16)
        // draw a blue circle every 10 pixels along the path between p1 and p2
        
        for (let i=0; i < steps + 1; i += 1) {
            let rx = Math.round(p1.x - 8 + dx*i/steps)
            let ry = Math.round(p1.y - 8 + dy*i/steps)
            gAssets.sheets.bridge_gate.tile(i<steps?1:2).draw(ctx, rx, ry)
        }


        // draw the chain as a sequence of rotated tiles

        let rx = this.rect.right() + 8
        let ry = this.rect.bottom() - this.rect.w - 8
        let lx = p2.x + 4// this.rect.x + 4
        let ly = p2.y - 4// this.rect.y - 4
        // get the angle between point l and point r
        let angle = Math.atan2(ry - ly, rx - lx) * 180 / Math.PI
        // let distance = Math.sqrt((rx-lx)*(rx-lx) + (ry-ly)*(ry-ly))
        // and the slope
        let slope = (ry - ly) / (rx - lx)
        let n = (rx - lx) / 8

        for(let i=1; i < n; i+=2) {
            gAssets.sheets.bridge_gate.tile(4).drawRotated(ctx, lx + 8*i - 8, ly + slope * 8*i - 8, angle)
        }

        for(let i=0; i < n; i+=2) {
            gAssets.sheets.bridge_gate.tile(3).drawRotated(ctx, lx + 8*i - 8, ly + slope * 8*i - 8, angle)
        }

        this.block_icon.draw(ctx, this.rect.right(), this.rect.bottom() - this.rect.w - 16)

        //let tid = this.bridgeState==0?0:1
        //Bridge.sheet_bulb.tile(tid).draw(ctx, this.rect_sensor.x, this.rect_sensor.y)

        /*
        ctx.beginPath()
        ctx.lineWidth = 2
        ctx.strokeStyle = 'red'
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()

        ctx.beginPath()
        ctx.lineWidth = 2
        ctx.strokeStyle = 'red'
        ctx.moveTo(lx, ly)
        ctx.lineTo(rx, ry)
        ctx.stroke()
        */


    }

    onSwitchTrigger(mode) {
        if (this.bridgeState) {
            this.direction *= -1
        }
        this.bridgeState = 1
    }

    update(dt) {

        /*
        this._x_debug_map.queryObjects({"instanceof": ProjectileBase}).forEach((p) => {
            if (p.alive && this.rect_sensor.collideRect(p.rect)) {
                p._kill()

                if (this.bridgeState == 0) {
                    this.bridgeState = 1
                    
                }

            }
        })
        */

        if (this.bridgeState == 1) {
            // open the bridge at 30 degrees per second
            this.angle += 30 * dt * this.direction

            if (this.angle > 90) {
                this.angle = 90
                this.direction = -1
                this.bridgeState = 0
            } else if (this.angle < 0){
                this.angle = 0
                this.direction = 1
                this.bridgeState = 0
            }
        }
    }

}

registerEditorEntity("Bridge", Bridge, [16,16], EntityCategory.switches, null, (entry)=> {
    //Bridge.sheet = gAssets.sheets.bridge_gate

    /*
    Bridge.sheet_bulb = (() => {
        let sheet = new SpriteSheet()
        sheet.tw = 16
        sheet.th = 16
        sheet.rows = 1
        sheet.cols = 12
        sheet.xspacing = 1
        sheet.yspacing = 1
        sheet.xoffset = 1
        sheet.yoffset = 16*2+4
        sheet.image = gAssets.sheets.battery_gate.image
        return sheet
    })();
    */

    entry.icon = gAssets.sheets.bridge_gate.tile(2)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RESIZE, "min_width": 48, "min_height": 16},
        {control: EditorControl.CHOICE, name: "opened", "default": 1, choices: {opened:1,closed:0}},
        {control: EditorControl.SWITCH_TARGET},
    ]
    entry.editorRender = (ctx, x, y, props) => {
        let tile = gAssets.themes[gAssets.mapinfo.theme].sheets[1].tile(33)
        tile.draw(ctx, x + props.width, y - props.width)

        let tile2 = gAssets.sheets.bridge_gate.tile(1)
        for (let i = 0; i < props.width; i+= 16) {
            tile2.draw(ctx, x + i, y)
        }

        ctx.beginPath()
        ctx.lineWidth = 2
        ctx.strokeStyle = 'silver'
        ctx.moveTo(x+8, y+8)
        ctx.lineTo(x + props.width + 8, y - props.width + 8)
        ctx.stroke()


    }
})