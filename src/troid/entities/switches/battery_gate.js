
import {
    Direction,
    Rect
} from "@axertc/axertc_common"

import {
    SpriteSheet
} from "@axertc/axertc_client"

import {gAssets, CharacterInventoryEnum, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, TextTyper, makeEditorIcon} from "@troid/entities/sys"
import {
    PlatformerEntity, AnimationComponent
} from "@axertc/axertc_physics"
import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"
import {Player} from "@troid/entities/player"
import {MobBase} from "@troid/entities/mobs"
import {ProjectileBase} from "@troid/entities/projectiles"


export class BatteryGate extends PlatformerEntity {

    static sheet_gate = null
    static sheet_battery = null

    constructor(entid, props, tid) {
        super(entid, props)

        // rectangle covers the entire collision area
        this.rect = new Rect(props?.x??0, props?.y??0, 48, 64)

        // smaller rectangles for parts that can be collided with
        // light bulb isnt solid
        this.facing = (props?.facing??Direction.LEFT)===Direction.LEFT?0:1
        this.gate_type = props?.gate_type??0

        this.rect_bulb = new Rect((props?.x??0) + 32*this.facing, props?.y??0, 16, 16)
        this.rect_battery = new Rect((props?.x??0) + 16*(1-this.facing), props?.y??0, 32, 16)
        // center the gate on the battery, not on battery+bulb
        this.rect_gate = new Rect(this.rect.x+16+8-(16*this.facing), this.rect.y+16, 16, 48)

        this.solid = 1
        this.visible = 1

        this.is_open = false
        this.direction = 0

        // animation state for each segment
        this._gate_parts = [0,0,0]
        // animation frame for battery level
        this.power = 0
        this.powerdown_timer = 0
        // how quickly to drain power
        this.powerdown_timeout = .6


    }

    collidePoint(x, y) {
        
        if (!this.is_open) {
            if (this.rect_gate.collidePoint(x, y)) {
                console.log("collide gate")
                return true
            }
        }

        return this.rect_battery.collidePoint(x, y)
    }

    paint(ctx) {

        let tid;

        tid = this.facing * BatteryGate.sheet_battery.cols + this.power
        BatteryGate.sheet_battery.drawTile(ctx, tid, this.rect_battery.x, this.rect_battery.y)

        tid = (this.facing*12) + 2*(this.gate_type) + (this.power===4?1:0)
        BatteryGate.sheet_bulb.drawTile(ctx, tid, this.rect_bulb.x, this.rect_bulb.y)

        for (let i = 0; i < 3; i++) {
            let tid = this._gate_parts[i]
            if (tid >= 7) {
                break
            }
            BatteryGate.sheet_gate.drawTile(ctx, tid, this.rect_gate.x, this.rect_gate.y + i*16)
        }

        /*

        ctx.beginPath()
        ctx.strokeStyle = 'blue'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = 'orange'
        ctx.rect(this.rect_battery.x, this.rect_battery.y, this.rect_battery.w, this.rect_battery.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = 'red'
        ctx.rect(this.rect_gate.x, this.rect_gate.y, this.rect_gate.w, this.rect_gate.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = 'red'
        ctx.rect(this.rect_bulb.x, this.rect_bulb.y, this.rect_bulb.w, this.rect_bulb.h)
        ctx.stroke() 
        
        */


    }

    _open_step() {

        if (this._gate_parts[0] == 7) {
            this.direction = 0 // stop
            this.is_open = true
            return
        }

        for (let i = 2; i >= 0; i--) {
            if (this._gate_parts[i] == 7) {
                continue
            }
            this._gate_parts[i]++
            return
        }
        
    }

    _close_step() {

        if (this._gate_parts[2] == 0) {
            this.direction = 0 // stop
            this.is_open = false
            return
        }

        for (let i = 0; i < 3; i++) {
            if (this._gate_parts[i] == 0) {
                continue
            }
            this._gate_parts[i]--
            return
        }
    }

    open() {
        this.direction = -1
        this.is_open = false // ensure closed when starting
    }

    close() {
        this.direction = 1
        // TODO: when closing when should it become solid?
        this.is_open = false // ensure closed when starting
    }

    update(dt) {

        if (this.direction == 0) {
            // TODO: use projectilebase or Bullet?
            this._x_debug_map.queryObjects({"instanceof": ProjectileBase}).forEach((p) => {
                if (p.alive && this.rect_bulb.collideRect(p.rect)) {
                    p._kill()

                    if (!this.is_open) {
                        // console.log(p.entid, p.power, "hit battery")

                        if (this.power < 4) {

                            // require charge shots to fill the battery
                            if (p.power < 0.5 && this.power <= 1 || p.power >= 0.5) {
                                this.power += 1
                            }

                            this.powerdown_timer = this.powerdown_timeout
                            
                        }

                        if (this.power == 4) {
                            this.powerdown_timer = 0
                            this.open()
                        }
                    } else {
                        //this.close()
                        //this.power = 0
                    }

                }
            })
        }

        if (this.powerdown_timer > 0) {
            this.powerdown_timer -= dt
            if (this.powerdown_timer <= 0) {
                this.power -= 1
                console.log("new power", this.power)
                if (this.power > 0) {
                    this.powerdown_timer = this.powerdown_timeout
                }
            }
        }

        if (this.direction < 0) {
            this._open_step()
        } else if (this.direction > 0) {
            this._close_step()
        }

    }
}


registerEditorEntity("BatteryGate", BatteryGate, [48,64], EntityCategory.switches, null, (entry)=> {

    BatteryGate.sheet_gate = (() => {
        let sheet = new SpriteSheet()
        sheet.tw = 16
        sheet.th = 16
        sheet.rows = 1
        sheet.cols = 7
        sheet.xspacing = 1
        sheet.yspacing = 1
        sheet.xoffset = 1
        sheet.yoffset = 16*1+2
        sheet.image = gAssets.sheets.battery_gate.image
        return sheet
    })();
    BatteryGate.sheet_bulb = (() => {
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
    BatteryGate.sheet_battery = gAssets.sheets.battery_gate

    entry.icon = makeEditorIcon(gAssets.sheets.battery_gate, 0)
    entry.editorIcon = null
    entry.editorRender = (ctx,x,y,props) => {
        let sheet1 = BatteryGate.sheet_battery
        let icon1 = (props?.facing===Direction.LEFT)?sheet1.tile(0):sheet1.tile(5);
        let xoffset1 = (props?.facing===Direction.LEFT)?16:0;
        icon1.draw(ctx, x + xoffset1, y)
        let sheet2 = BatteryGate.sheet_gate
        let icon2 = sheet2.tile(0)
        icon2.draw(ctx, x+16, y+16)
        icon2.draw(ctx, x+16, y+32)
        icon2.draw(ctx, x+16, y+48)
        let sheet3 = BatteryGate.sheet_bulb
        let xoffset3 = (props?.facing===Direction.LEFT)?0:32;
        let tid = ((props?.facing===Direction.LEFT)?0:12) + 2*(props?.gate_type??0);
        sheet3.tile(tid).draw(ctx, x+xoffset3, y)
    }
    entry.editorSchema = [
        {control: EditorControl.CHOICE, 
            "name": "facing",
            "default": Direction.LEFT,
            choices: {"LEFT":Direction.LEFT, "RIGHT":Direction.RIGHT}
        },
        {control: EditorControl.CHOICE, 
            "name": "gate_type",
            "default": 1,
            choices: {
                "ANY": 0,     // not yet sure what to do with green
                "POWER": 1,   // yellow
                "FIRE": 2,    // red
                "WATER": 3,   // blue
                "ICE": 4,     // cyan
                "BUBBLE": 5,  // purple
            }
        },
    ]
})
