import { Physics2dPlatformV2, PlatformerEntity, Wall, Slope, OneWayWall, AnimationComponent } from "@axertc/axertc_physics"
import { MapInfo, gAssets, gCharacterInfo, WeaponType, CharacterInventoryEnum } from "@troid/store"
 
import {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
} from "@axertc/axertc_common"

import {TileShape, TileProperty, updateTile, paintTile} from "@troid/tiles"
import {Player} from "@troid/entities"
import {PlatformMap} from "@troid/maps"
import { MobBase } from "@troid/entities/mobs"

class CspController {
    constructor(map) {

        this.map = map
        this.player = null

    }

    getPlayer() {
        if (this.player === null) {
            for (const obj of Object.values(this.map.map.objects)) {
                if (!!obj.playerId && obj.playerId=="player") {
                    this.player = obj
                    break
                }
            }
        }
        return this.player
    }

    doubleTapDirection(whlid, direction) {
        console.log(whlid, direction)
    }

    tapDirection(whlid, direction, tap_count) {

        if (whlid == 0) {
            const player = this.getPlayer()
            if (!player) {
                console.log("player not found")
                return
            }
            player.ownedByClient = true

            this.map.map.sendObjectInputEvent(player.entid, {whlid, direction, tap_count})
        }
    }

    setInputDirection(whlid, vector) {
        if (whlid == 0) {
            const player = this.getPlayer()
            if (!player) {
                console.log("player not found")
                return
            }
            player.ownedByClient = true
            //debug(`world_step: ${this.map_player1.world_step} local_step: ${this.map_player1.map.local_step}` + \
            //    " client input event");
            this.map.map.sendObjectInputEvent(player.entid, {whlid, vector})
        }
    }

    handleButtonPress(btnid){

        const player = this.getPlayer()
        if (!player) {
            console.log("player not found")
            return
        }
        player.ownedByClient = true
        this.map.map.sendObjectInputEvent(player.entid, {btnid, pressed: true})

    }

    handleButtonRelease(btnid){

        const player = this.getPlayer()
        if (!player) {
            console.log("player not found")
            return
        }
        player.ownedByClient = true
        this.map.map.sendObjectInputEvent(player.entid, {btnid, pressed: false})

    }
}

class CameraBase {

    constructor() {
        this.dirty = true

    }

    resize() {

    }

    update(dt) {

    }

    activeRegion() {
        return new Rect(0,0,0,0)
    }
}

class Camera extends CameraBase {
    constructor(map, target) {
        super()
        this.map = map
        this.target = target

        this.header_height = 24

        this.x = 0;
        this.y = 0;
        this.width = gEngine.view.width
        this.height = gEngine.view.height

        this.active_border = new Rect(0,0,0,0)
        this.active_region = new Rect(0,0,0,0)

        this.active_region_x = -1024;
        this.active_region_y = -1024;

        //this.tile_position = {x:-1024, y:-1024}
        this.dirty = true

        //margin of 4 tiles in the direction the target is facing
        //and 2 tiles in all other directions
    }

    paint(ctx) {

        if (false) {

            let xborder1 = Math.floor(gEngine.view.width/4)
            let xborder2 = Math.floor(gEngine.view.width/4)
            let yborder1 = Math.floor(gEngine.view.height/4) + 16
            let yborder2 = Math.floor(gEngine.view.height/4)
            let wnd = new Rect(
                this.x + xborder1,
                this.y + yborder1,
                this.width - xborder1 - xborder2,
                this.height - yborder1 - yborder2)

            ctx.beginPath()
            ctx.strokeStyle = "red"
            ctx.rect(wnd.x, wnd.y, wnd.w, wnd.h)
            ctx.closePath()
            ctx.stroke()
        }
    }

    setTarget(target) {
        this.target = target
    }

    resize() {
        this.width = gEngine.view.width
        this.height = gEngine.view.height
    }

    update(dt) {

        if (!this.target || !this.target.alive) {
            return
        }

        //let wnd = new Rect(
        //    Math.floor(this.target.rect.x-32-8),
        //    Math.floor(this.target.rect.y-32-16),
        //    3*32,
        //    3*32)
        //let v = Direction.vector(this.target.facing)
        //if (v.x < 0) { wnd.x -= 32; wnd.w += 32 }
        //if (v.x > 0) { wnd.w += 32 }
        //if (v.y < 0) { wnd.y -= 32; wnd.h += 32 }
        //if (v.y > 0) { wnd.h += 32 }
        let xborder1 = Math.floor(gEngine.view.width/3)
        let xborder2 = Math.floor(gEngine.view.width/3)
        let yborder1 = Math.floor(gEngine.view.height/4) + 16
        let yborder2 = Math.floor(gEngine.view.height/4)
        let wnd = new Rect(
            this.x + xborder1,
            this.y + yborder1,
            this.width - xborder1 - xborder2,
            this.height - yborder1 - yborder2)
        //console.log(wnd, this.width, this.height)
        this.active_border = wnd

        let x,y;

        let tcx = this.target.rect.cx()
        let tcy = this.target.rect.cy()

        if (tcx < wnd.left()) {
            x = tcx - xborder1
        }
        else if (tcx > wnd.right()) {
            x = tcx + xborder2 - this.width
        } else {
            x = this.x
        }

        if (tcy < wnd.top()) {
            y = tcy - yborder1
        }
        else if (tcy > wnd.bottom()) {
            y = tcy + yborder2 - this.height
        } else {
            y = this.y
        }
        // force camera to center player
        //x = Math.floor(this.target.rect.cx() - gEngine.view.width/2)
        //y = Math.floor(this.target.rect.cy() - gEngine.view.height/2)
        // allow the camera to display outside of the map
        // so that the character is never under the inputs
        let input_border = 192
        if (x < -input_border) { x = -input_border}
        //if (y < -32) { y = -32 }

        let mx = Physics2dPlatformV2.maprect.w - gEngine.view.width + input_border
        // there is a 64 pixel gutter at the top of the map that should never be displayed
        let my = (Physics2dPlatformV2.maprect.h - 64) - gEngine.view.height
        if (x > mx) { x = mx }
        if (y > my) { y = my }
        if (y < -this.header_height) {y = -this.header_height}

        this.x = Math.floor(x)
        this.y = Math.floor(y)

        // game tiles are 16x16
        // active region is the neareset 32x32 tile
        // with 1 tile border outside the visible region
        // as the player moves, new objects will be activated
        
        let resolution = 32
        let tx = Math.floor((this.x-resolution)/resolution)
        let ty = Math.floor((this.y-resolution)/resolution)
        
        this.active_region = new Rect(
            tx*resolution,
            ty*resolution,
            this.width + 2*resolution,
            this.height + 2*resolution)

        // periodically activate objects
        if (tx != this.active_region_x || ty != this.active_region_y) {

            // find all deactivated objects
            let objs = this.map.queryObjects({"instanceof": PlatformerEntity, "active": undefined})
            //console.log("change active zone", tx, ty,  objs.length)
            // check if those deactivated objects are in the active region
            objs.forEach(obj => {
                if (obj.rect.collideRect(this.active_region)) {
                    obj.active = true
                    //console.log("changing activity for ", obj._classname)
                } else {
                    obj.active = false
                }
            })
            
            this.active_region_x = tx;
            this.active_region_y = ty;
        }
        



        //this.dirty = this.dirty //|| (this.tile_position.x != tx || this.tile_position.y != ty)

        //this.tile_position = {x:tx, y:ty}

    }

    activeRegion() {
        return this.active_region
    }
}

class PauseScreen {

    constructor(parent) {
        this.parent = parent

        this.highlight_colors = [
            "#e6ac00", "#ffbf00", "#ffcc33", 
            "#ffd966", "#ffe699", "#ffd966", 
            "#ffcc33", "#ffbf00"
        ]

        this.actions = []
        this.actions = []
        this.keyboard_actions = [[],[]]
        this.keyboard_column = 0
        this.keyboard_row = 1
        this.keyboard_index = 0
        this._buildActions()
        this._updateBeamName()


    }

    _addAction(x,y,w,h,icon, on_action) {
        let action = {rect: new Rect(x,y,w,h), icon, on_action}
        this.actions.push(action)
        return action
    }

    _buildActions() {
        let act;

        this.rect1 = new Rect(16, 16*2, 5*24+4, 10*16)
        this.rect2 = new Rect(gEngine.view.width - (this.rect1.x + this.rect1.w), this.rect1.y, this.rect1.w, this.rect1.h)
        this.action_bars = []

        let x1 = this.rect1.x + 2 + 2
        let y1 = this.rect1.y + 8

        const fn_icon = (index, state) => {
            return gAssets.sheets.pause_items.tile((index * 3) + state)
        }

        const fn_icon2 = (acquired, index, state) => {
            if (!acquired) {
                return gAssets.sheets.pause_items.tile((22 * 3) + 0)
            }
            return gAssets.sheets.pause_items.tile((index * 3) + state)
        }

        let mkaction = (x,y,skill, attr, value_enabled, value_disabled, icon) => {
            this._addAction(x, y, 20, 18, ()=>fn_icon2(gCharacterInfo.inventory[skill].acquired,icon,gCharacterInfo.current[attr]===value_enabled?2:0), ()=>{
                if (gCharacterInfo.inventory[skill].acquired) {
                    gCharacterInfo.current[attr] = (gCharacterInfo.current[attr] == value_enabled)?value_disabled:value_enabled
                }
                this._updateBeamName()
            })
        }
        
        // switch weapon profiles

        // profile 1
        act = this._addAction(x1+0*24, y1, 44, 12, null, ()=>{
            if (gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_WEAPON_SLOT].acquired) {
                gCharacterInfo.current = gCharacterInfo.weapons[0]
                gCharacterInfo.current_weapon_index = 0
            }
        })
        act.dyntext = () => {
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_WEAPON_SLOT]
            return {text: "Primary", hidden: !skill.acquired, active: skill.active}
        }

        // profile 2
        act = this._addAction(x1+3*24, y1, 44, 12, null, ()=>{
            if (gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_WEAPON_SLOT].acquired) {
                gCharacterInfo.current = gCharacterInfo.weapons[1]
                gCharacterInfo.current_weapon_index = 1
            }
        })
        act.dyntext = () => {
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_WEAPON_SLOT]
            return {text: "Secondary", hidden: !skill.acquired, active: skill.active}
        }

        // slice the last two actions
        // and add them to the end of the list
        this.keyboard_actions[0].push(this.actions.slice(this.actions.length-2, this.actions.length))

        y1 += 20

        // power, fire, water, ice, bubble
        this._addAction(x1+0*24, y1, 20, 18, ()=>fn_icon(0,gCharacterInfo.current.element===WeaponType.ELEMENT.POWER?2:0), ()=>{gCharacterInfo.current.element = WeaponType.ELEMENT.POWER})
        mkaction(x1+1*24, y1, CharacterInventoryEnum.BEAM_ELEMENT_FIRE, "element", WeaponType.ELEMENT.FIRE, WeaponType.ELEMENT.POWER, 1)
        mkaction(x1+2*24, y1, CharacterInventoryEnum.BEAM_ELEMENT_WATER, "element", WeaponType.ELEMENT.WATER, WeaponType.ELEMENT.POWER, 2)
        mkaction(x1+3*24, y1, CharacterInventoryEnum.BEAM_ELEMENT_ICE, "element", WeaponType.ELEMENT.ICE, WeaponType.ELEMENT.POWER, 3)
        mkaction(x1+4*24, y1, CharacterInventoryEnum.BEAM_ELEMENT_BUBBLE, "element", WeaponType.ELEMENT.BUBBLE, WeaponType.ELEMENT.POWER, 4)

        this.keyboard_actions[0].push(this.actions.slice(this.actions.length-5, this.actions.length))

        this.action_bars.push(new Rect(x1, y1+5, 5*24 - 4, 8))

        this.lbl_weapon_element = this._addAction(x1+0*24, y1+20, 5*24 - 4, 12, null, ()=>{})
        this.lbl_weapon_element.text = "Power"


        //this._addAction(x1+1*24, y1, 20, 18, ()=>fn_icon(1,gCharacterInfo.current.element===WeaponType.ELEMENT.FIRE?2:0), ()=>{gCharacterInfo.current.element = WeaponType.ELEMENT.FIRE})
        //this._addAction(x1+2*24, y1, 20, 18, ()=>fn_icon(2,gCharacterInfo.current.element===WeaponType.ELEMENT.WATER?2:0), ()=>{gCharacterInfo.current.element = WeaponType.ELEMENT.WATER})
        //this._addAction(x1+3*24, y1, 20, 18, ()=>fn_icon(3,gCharacterInfo.current.element===WeaponType.ELEMENT.ICE?2:0), ()=>{gCharacterInfo.current.element = WeaponType.ELEMENT.ICE})
        //this._addAction(x1+4*24, y1, 20, 18, ()=>fn_icon(4,gCharacterInfo.current.element===WeaponType.ELEMENT.BUBBLE?2:0), ()=>{gCharacterInfo.current.element = WeaponType.ELEMENT.BUBBLE})

        // wave beam, normal, bounce beam
        // wave - pass through walls
        // normal - break on contact
        // bounce - bounce off walls (bubbles bounce player)

        y1 += 24 + 12

        mkaction(x1+0*24, y1, CharacterInventoryEnum.BEAM_TYPE_WAVE, "beam", WeaponType.BEAM.WAVE, WeaponType.BEAM.NORMAL, 7)
        mkaction(x1+1*24, y1, CharacterInventoryEnum.BEAM_TYPE_BOUNCE, "beam", WeaponType.BEAM.BOUNCE, WeaponType.BEAM.NORMAL, 8)
        this.action_bars.push(new Rect(x1+0*24, y1+5, 2*24 - 4, 8))

        mkaction(x1+3*24, y1, CharacterInventoryEnum.BEAM_MOD_CHARGE, "modifier", WeaponType.MODIFIER.CHARGE, WeaponType.MODIFIER.NORMAL, 15)
        mkaction(x1+4*24, y1, CharacterInventoryEnum.BEAM_MOD_RAPID, "modifier", WeaponType.MODIFIER.RAPID, WeaponType.MODIFIER.NORMAL, 16)
        this.action_bars.push(new Rect(x1+3*24, y1+5, 2*24 - 4, 8))

        this.keyboard_actions[0].push(this.actions.slice(this.actions.length-4, this.actions.length))

        this.lbl_weapon_beam = this._addAction(x1+0*24, y1 + 20, 2*24 - 4, 12, null, ()=>{})
        this.lbl_weapon_beam.text = "Bounce"

        this.lbl_weapon_modifier = this._addAction(x1+3*24, y1 + 20, 2*24 - 4, 12, null, ()=>{})
        this.lbl_weapon_modifier.text = "Charge"

        //this._addAction(x1+0*24, y1+24, 20, 18, ()=>fn_icon(7,gCharacterInfo.current.beam===WeaponType.BEAM.WAVE?2:0), ()=>{
        //    gCharacterInfo.current.beam = (gCharacterInfo.current.beam == WeaponType.BEAM.WAVE)?WeaponType.BEAM.NORMAL:WeaponType.BEAM.WAVE
        //})
        //this._addAction(x1+2*24, y1+24, 20, 18, ()=>fn_icon(6,gCharacterInfo.current.beam===WeaponType.BEAM.NORMAL?2:0), ()=>{
        //    gCharacterInfo.current.beam = WeaponType.BEAM.NORMAL
        //})
        //this._addAction(x1+1*24, y1+24, 20, 18, ()=>fn_icon(8,gCharacterInfo.current.beam===WeaponType.BEAM.BOUNCE?2:0), ()=>{
        //    gCharacterInfo.current.beam = (gCharacterInfo.current.beam == WeaponType.BEAM.BOUNCE)?WeaponType.BEAM.NORMAL:WeaponType.BEAM.BOUNCE
        //})

        // single, double, triple
        // power, ice: 1,2,3 bullets
        // fire, normal: 1,3,5 bullets at 0,22,45 degrees
        // water: wider stream
        // bubble: more
        y1 += 24 + 12

        // level one only appears once level 2 is unlocked
        mkaction(x1+1*24, y1, CharacterInventoryEnum.BEAM_LEVEL_2, "level", WeaponType.LEVEL.LEVEL1, WeaponType.LEVEL.LEVEL1, 10)
        mkaction(x1+2*24, y1, CharacterInventoryEnum.BEAM_LEVEL_2, "level", WeaponType.LEVEL.LEVEL2, WeaponType.LEVEL.LEVEL2, 11)
        mkaction(x1+3*24, y1, CharacterInventoryEnum.BEAM_LEVEL_3, "level", WeaponType.LEVEL.LEVEL3, WeaponType.LEVEL.LEVEL3, 12)
        this.action_bars.push(new Rect(x1+1*24, y1+5, 3*24 - 4, 8))

        this.keyboard_actions[0].push(this.actions.slice(this.actions.length-3, this.actions.length))

        this.lbl_weapon_level = this._addAction(x1+1*24, y1 + 20, 3*24 - 4, 12, null, ()=>{})
        this.lbl_weapon_level.text = "Level 1"

        //this._addAction(x1+1*24, y1+48, 20, 18, ()=>fn_icon(10,gCharacterInfo.current.level===WeaponType.LEVEL.LEVEL1?2:0), ()=>{
        //    gCharacterInfo.current.level=WeaponType.LEVEL.LEVEL1
        //})
        //this._addAction(x1+2*24, y1+48, 20, 18, ()=>fn_icon(11,gCharacterInfo.current.level===WeaponType.LEVEL.LEVEL2?2:0), ()=>{
        //    gCharacterInfo.current.level=WeaponType.LEVEL.LEVEL2
        //})
        //this._addAction(x1+3*24, y1+48, 20, 18, ()=>fn_icon(12,gCharacterInfo.current.level===WeaponType.LEVEL.LEVEL3?2:0), ()=>{
        //    gCharacterInfo.current.level=WeaponType.LEVEL.LEVEL3
        //})

        // charge beam, normal, rapid shot
        // water, charge: larger orbs
        // water, rapid: stream
        


        //this._addAction(x1+3*24, y1+24, 20, 18, ()=>fn_icon(15,gCharacterInfo.current.modifier===WeaponType.MODIFIER.CHARGE?2:0), ()=>{
        //    gCharacterInfo.current.modifier = (gCharacterInfo.current.modifier == WeaponType.MODIFIER.CHARGE)?WeaponType.MODIFIER.NORMAL:WeaponType.MODIFIER.CHARGE
        //})
        //this._addAction(x1+2*24, y1+3*24, 20, 18, ()=>fn_icon(14,gCharacterInfo.current.modifier===WeaponType.MODIFIER.NORMAL?2:0), ()=>{
        //    gCharacterInfo.current.modifier=WeaponType.MODIFIER.NORMAL
        //})
        //this._addAction(x1+4*24, y1+24, 20, 18, ()=>fn_icon(16,gCharacterInfo.current.modifier===WeaponType.MODIFIER.RAPID ?2:0), ()=>{
        //    gCharacterInfo.current.modifier = (gCharacterInfo.current.modifier == WeaponType.MODIFIER.RAPID)?WeaponType.MODIFIER.NORMAL:WeaponType.MODIFIER.RAPID
        //})

        // missile, super, homing
        //this._addAction(x1+1*24, y1+12+4*24, 20, 18, null, ()=>{})
        //this._addAction(x1+2*24, y1+12+4*24, 20, 18, null, ()=>{})
        //this._addAction(x1+3*24, y1+12+4*24, 20, 18, null, ()=>{})

        let x2 = this.rect2.x + 8
        let y2 = this.rect2.y + 12 + 6
        let w2 = this.rect2.w - 16

        // suits
        // diving helmet
        act = this._addAction(x2, y2+0*16, w2, 12, null, ()=>{
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_MORPH_BALL]
            skill.active = !skill.active
        })
        act.dyntext = () => {
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_MORPH_BALL]
            let obj = {text: "Morph Ball", hidden: !skill.acquired, active: skill.active}
            //console.log("!!skill", skill, obj)
            return obj
        }
        this.keyboard_actions[1].push([act])

        act = this._addAction(x2, y2+1*16, w2, 12, null, ()=>{
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_SPIKE_BALL]
            skill.active = !skill.active
        })
        act.dyntext = () => {
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_SPIKE_BALL]
            return {text: "Spike Ball", hidden: !skill.acquired, active: skill.active}
        }
        this.keyboard_actions[1].push([act])

        act = this._addAction(x2, y2+3*16, w2, 12, null, ()=>{
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_DOUBLE_JUMP]
            skill.active = !skill.active
        })
        act.dyntext = () => {
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_DOUBLE_JUMP]
            return {text: "Double Jump", hidden: !skill.acquired, active: skill.active}
        }
        this.keyboard_actions[1].push([act])

        act = this._addAction(x2, y2+4*16, w2, 12, null, ()=>{
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_RUNNING_BOOTS]
            skill.active = !skill.active
        })
        act.dyntext = () => {
            let skill = gCharacterInfo.inventory[CharacterInventoryEnum.SKILL_RUNNING_BOOTS]
            return {text: "Running Boots", hidden: !skill.acquired, active: skill.active}
        }
        this.keyboard_actions[1].push([act])

        //act = this._addAction(x2, y2+5*16, w2, 12, null, ()=>{})
        //act = this._addAction(x2, y2+6*16, w2, 12, null, ()=>{})
        //act = this._addAction(x2, y2+7*16, w2, 12, null, ()=>{})

        //this._addAction(x2+2*24, y2+24, 20, 18, null, ()=>{})
        //this._addAction(x2+3*24, y2+24, 20, 18, null, ()=>{})

        // space jump, spin jump
        //this._addAction(x2+12+1*24, y2+12+4*24, 20, 18, null, ()=>{})
        //this._addAction(x2+12+2*24, y2+12+4*24, 20, 18, null, ()=>{})

        let x3 = gEngine.view.width/2
        let y3 = this.rect2.bottom() + 8




        let act_return = this._addAction(x3-20, y3, 40, 18, null, ()=>{this.parent.screen = null})
        act_return.text = "return"
        

        let act_reset = this._addAction(gEngine.view.width - 3*8 - 3*40,  y3, 40, 18, null, ()=>{
            Object.values(CharacterInventoryEnum).map(key=>gCharacterInfo.inventory[key] = {acquired:0, active:0})
            gCharacterInfo.current = gCharacterInfo.weapons[0]
            gCharacterInfo.current_weapon_index = 0
            gCharacterInfo.current.element = WeaponType.ELEMENT.POWER
            this._updateBeamName()
        })
        act_reset.text = "clear"

        let act_unlock = this._addAction(gEngine.view.width - 2*8 - 2*40,  y3, 40, 18, null, ()=>{
            Object.values(CharacterInventoryEnum).map(key=>gCharacterInfo.inventory[key] = {acquired:1, active:1})
            this._updateBeamName()
        })
        act_unlock.text = "unlock"

        let act_edit = this._addAction(gEngine.view.width - 8 - 40,  y3, 40, 18, null, ()=>{
            const edit = true
            gEngine.scene = new LevelLoaderScene(gAssets.mapinfo.mapurl, edit, ()=>{
                gEngine.scene = new LevelEditScene()
            })
        })
        act_edit.text = "edit"

        // add to both columns
        this.keyboard_actions[0].push(this.actions.slice(this.actions.length-4, this.actions.length))
        this.keyboard_actions[1].push(this.actions.slice(this.actions.length-4, this.actions.length))

        let values = [1,2,3,4,5,6]
        //get a slice of last two values
        let slice = values.slice(4, 6)

        console.log(this.keyboard_actions)


    }

    _updateBeamName() {

        let element = null
        let beam = null
        let level = null
        let modifier = null

        switch (gCharacterInfo.current.element) {
            case WeaponType.ELEMENT.POWER:
                element = "Power"
                break;
            case WeaponType.ELEMENT.FIRE:
                element = "Fire"
                if (gCharacterInfo.current.beam == WeaponType.BEAM.WAVE && gCharacterInfo.current.modifier == WeaponType.MODIFIER.NORMAL) {
                    element = "Spread"
                }
                else if (gCharacterInfo.current.modifier == WeaponType.MODIFIER.RAPID) {
                    element = "Flame Thrower"
                }
                break;
            case WeaponType.ELEMENT.WATER:
                element = "Water"

                if (gCharacterInfo.current.beam == WeaponType.BEAM.BOUNCE) {
                    element = "Splash"
                }
                else if (gCharacterInfo.current.modifier == WeaponType.MODIFIER.RAPID) {
                    element = "Water Jet"
                }
                break;
            case WeaponType.ELEMENT.ICE:
                element = "Ice"
                break;
            case WeaponType.ELEMENT.BUBBLE:
                element = "Bubble"
                break;
            default:
                element = "Error"
                break;
        }

        switch (gCharacterInfo.current.beam) {
            case WeaponType.BEAM.WAVE:
                beam = "Wave"
                break
            case WeaponType.BEAM.BOUNCE:
                beam = "Bounce"
                break
            default:
                beam = "Off"
                break
        }
        
        if (!gCharacterInfo.inventory[CharacterInventoryEnum.BEAM_TYPE_WAVE].acquired&&
            !gCharacterInfo.inventory[CharacterInventoryEnum.BEAM_TYPE_BOUNCE].acquired) {
            beam = "???"
        }

        switch (gCharacterInfo.current.modifier) {
            case WeaponType.MODIFIER.CHARGE:
                modifier = "Charge"
                break
            case WeaponType.MODIFIER.RAPID:
                modifier = "Auto"
                break
            default:
                modifier = "Off"
                break
        }
        if (!gCharacterInfo.inventory[CharacterInventoryEnum.BEAM_MOD_CHARGE].acquired&&
            !gCharacterInfo.inventory[CharacterInventoryEnum.BEAM_MOD_RAPID].acquired) {
            modifier = "???"
        }

        switch (gCharacterInfo.current.level) {
            case WeaponType.LEVEL.LEVEL1:
                level = "Level 1"
                break
            case WeaponType.LEVEL.LEVEL2:
                level = "Level 2"
                break
            case WeaponType.LEVEL.LEVEL3:
                level = "Level 3"
                break
        }
        if (!gCharacterInfo.inventory[CharacterInventoryEnum.BEAM_LEVEL_2].acquired) {
            level = "???"
        }

        this.lbl_weapon_element.text = element
        this.lbl_weapon_beam.text = beam
        this.lbl_weapon_modifier.text = modifier
        this.lbl_weapon_level.text = level

        return name
    }

    paint(ctx) {

        let rect0 = new Rect(0, 0, gEngine.view.width, gEngine.view.height)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.fillStyle = "#000000dd"
        ctx.rect(rect0.x, rect0.y, rect0.w, rect0.h)
        ctx.closePath()
        ctx.fill()

        let x = gEngine.view.width/2 - gAssets.sheets.pause_suit.tw/2
        let y = gEngine.view.height/2 - gAssets.sheets.pause_suit.th/2
        gAssets.sheets.pause_suit.drawTile(ctx, 0, x, y)

        ctx.lineWidth = 1
        ctx.strokeStyle = "#88e810"
        ctx.beginPath()
        
        ctx.roundRect(this.rect1.x, this.rect1.y, this.rect1.w, this.rect1.h, 8)
        ctx.closePath()
        ctx.stroke()

        ctx.strokeStyle = "#88e810"
        ctx.beginPath()
        ctx.roundRect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h, 8)
        ctx.closePath()
        ctx.stroke()

        let x1 = this.rect1.x + 2 + 2
        let y1 = this.rect1.y + 12 + 6 + (24 + 12)

        ctx.beginPath()
        ctx.fillStyle = "#C0C0C0"
        this.action_bars.forEach(bar => {
            ctx.rect(bar.x, bar.y, bar.w, bar.h)
        })
        ctx.closePath()
        ctx.fill()

        // draw a highlight around the keyboard selected action
        if (!daedalus.platform.isMobile) {
            let act = this.keyboard_actions[this.keyboard_column][this.keyboard_row][this.keyboard_index]

            ctx.beginPath()
            let idx = Math.floor(gEngine.frameIndex/10)%this.highlight_colors.length
            ctx.fillStyle = this.highlight_colors[idx]
            //console.log(idx, ctx.fillStyle)
            ctx.roundRect(act.rect.x-2, act.rect.y-2, act.rect.w+4, act.rect.h+4, 4)
            ctx.closePath()
            ctx.fill()

        }

        this.actions.forEach(act => {

            if (!!act.icon) {
                act.icon().draw(ctx, act.rect.x, act.rect.y)
            } else if (!!act.dyntext) {

                let obj = act.dyntext()

                ctx.beginPath()
                ctx.fillStyle = (obj.active&&!obj.hidden)?"#0000FF":"#7f7f7f"
                ctx.rect(act.rect.x, act.rect.y, act.rect.w, act.rect.h)
                ctx.closePath()
                ctx.fill()

                if (obj.hidden) {
                    ctx.beginPath()
                    ctx.font = "8px Verdana bold";
                    ctx.fillStyle = "white"
                    ctx.strokeStyle = "white"
                    ctx.textAlign = "center"
                    ctx.textBaseline = "middle"

                    ctx.fillText("???", act.rect.x + act.rect.w/2, act.rect.y + act.rect.h/2);

                } else {
                    ctx.beginPath()
                    ctx.font = "8px Verdana bold";
                    ctx.fillStyle = "white"
                    ctx.strokeStyle = "white"
                    ctx.textAlign = "center"
                    ctx.textBaseline = "middle"

                    ctx.fillText(obj.text, act.rect.x + act.rect.w/2, act.rect.y + act.rect.h/2);

                }

            } else {
                ctx.beginPath()
                ctx.fillStyle = "#0000FF"
                ctx.rect(act.rect.x, act.rect.y, act.rect.w, act.rect.h)
                ctx.closePath()
                ctx.fill()
                if (act.text) {
                    ctx.beginPath()
                    ctx.font = "8px Verdana bold";
                    ctx.fillStyle = "white"
                    ctx.strokeStyle = "white"
                    ctx.textAlign = "center"
                    ctx.textBaseline = "middle"

                    ctx.fillText(act.text, act.rect.x + act.rect.w/2, act.rect.y + act.rect.h/2);

                }
            }


        })

    }

    handleTouches(touches) {
        console.log("pause screen touches", touches.length)

        if (touches.length > 0 && !touches[0].pressed) {

            const t = touches[0]
            this.actions.forEach((act,i) => {
                if (act.rect.collidePoint(t.x, t.y)) {
                    act.on_action()
                }
            })
        }
    }

    handleKeyPress(keyevent) {
        console.log(keyevent)
        console.log(this.parent.keyboard)
    }

    handleKeyRelease(keyevent) {
        let rows = this.keyboard_actions[this.keyboard_column]
        let actions = this.keyboard_actions[this.keyboard_column][this.keyboard_row]

        switch (keyevent.keyCode) {
            case this.parent.keyboard.wheels[0].up:
                this.keyboard_row -= 1
                if (this.keyboard_row < 0) {
                    this.keyboard_row = rows.length - 1
                }
                this.keyboard_index  = 0
                break
            case this.parent.keyboard.wheels[0].down: 
                this.keyboard_row = (this.keyboard_row + 1) % rows.length
                this.keyboard_index  = 0
                break
            case this.parent.keyboard.wheels[0].left:
                this.keyboard_index -= 1
                if (this.keyboard_index < 0) {
                    
                    if (this.keyboard_column > 0) {
                        this.keyboard_column -= 1
                        this.keyboard_row = 0
                        this.keyboard_index = this.keyboard_actions[this.keyboard_column][this.keyboard_row].length - 1;
                    } else {
                        this.keyboard_index  = 0
                    }
                }
                break
            case this.parent.keyboard.wheels[0].right:
                this.keyboard_index += 1
                if (this.keyboard_index >= actions.length) {
                    if (this.keyboard_column < this.keyboard_actions.length - 1) {
                        this.keyboard_column += 1
                        this.keyboard_row = 0
                        this.keyboard_index = 0;
                    } else {
                        this.keyboard_index  = actions.length - 1
                    }
                }
                break
            case this.parent.keyboard.buttons[0]:
                let act = this.keyboard_actions[this.keyboard_column][this.keyboard_row][this.keyboard_index]
                act.on_action()()
                break
            case 27:
                this.parent.screen = null
                break
        }

    }

    update(dt) {

    }
}

export class MainScene extends GameScene {

    constructor() {
        super()

        this.map = new ClientCspMap(gAssets.map)
        // hack for single player game
        this.map.world_step = 0
        this.map.setPlayerId("player")
        this.map.map.instanceId = "player1"

        this.controller = new CspController(this.map);

        this.touch = new TouchInput(this.controller)
        this.keyboard = new KeyboardInput(this.controller)

        this.touch.addWheel(64+32, -64, 64, {
            align: Alignment.LEFT|Alignment.BOTTOM,
            //symbols: ["W", "D", "S", "A"],
        })
        let rad = 50
        this.touch.addButton(3*rad, -rad, rad, {text: "Z"})
        this.touch.addButton(rad, -3*rad, rad, {text: "X"})
        this.touch.addButton(rad, -rad, rad, {text: "C"})

        this.keyboard.addWheel_ArrowKeys()

        this.keyboard.addButton(90) // Z
        this.keyboard.addButton(88) // X
        this.keyboard.addButton(67) // C

        this.camera = new Camera(this.map.map, this.map.map._x_player)
        this.screen =  null //  new PauseScreen(this)

        this.dialog = null // something that implements paint(ctx), update(dt), dismiss()

        this.coin_icon = gAssets.sheets.coin.tile(0)
    }

    pause(paused) {
    }

    update(dt) {
        if (!this.screen) {
            

            if (!!this.dialog) {

                // show a dialog over the game
                // if modal, don't run the simulation
                if (!this.dialog.modal) {
                    this.map.update(dt)
                    this.camera.update(dt)
                }

                this.dialog.update(dt)
                
            } else {
                // run game logic normally
                this.map.update(dt)
                this.camera.update(dt)

                if (gEngine.frameIndex%60==0) {
                    this._check_bounds()
                }
            }

        }



    }

    _check_bounds() {
        // delete objects that have gone out of bounds
        let rect = Physics2dPlatformV2.maprect
        let [camx,camy,camw,camh] = [rect.x, gEngine.view.y, gEngine.view.w, gEngine.view.h];
        for (const obj of Object.values(this.map.map.objects)) {

            if (obj.rect.right() < rect.left() || 
                obj.rect.left() > rect.right() ||
                obj.rect.bottom() < rect.top() ||
                obj.rect.top() > rect.bottom()) {
                    console.log(`destroy out of bounds entity ${obj._classname}:${obj.entid}`)
                    obj.destroy() // no animation
            }
        }
    
    }

    _paint_status_map(ctx) {
        // draw a map 
        // 40 pixels wide by 18 pixels tall
        // each cell is 8x6
        let x = gEngine.view.width - 24 - 40
        let y = 3
        ctx.strokeStyle = '#aaaaaa'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i=0; i<5; i++) {
            ctx.moveTo(x+i*8, y);
            ctx.lineTo(x+i*8, y+18);
        }
        for (let j=0; j < 3; j++) {
            ctx.moveTo(x,    y+j*6);
            ctx.lineTo(x+40, y+j*6);
        }
        ctx.moveTo(x, y)
        ctx.rect(x,y,40,18)
        ctx.stroke()
    }

    _paint_status(ctx) {
        const barHeight = 24

        ctx.beginPath()
        ctx.fillStyle = "black";
        ctx.rect(0,0, gEngine.view.width, barHeight)
        ctx.fill()

        if (true) {
            let x = gEngine.view.width/2 - 12
            let y = barHeight/2 - 9
            gAssets.sheets.pause_items.tile((0 * 3) + 2).draw(ctx, x, y)
            gAssets.sheets.pause_items.tile((0 * 3) + 0).draw(ctx, x+24, y)

            ctx.beginPath();
            if (gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL1) {
                ctx.strokeStyle = "#CD7F32";
            }
            if (gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL2) {
                ctx.strokeStyle = "#C0C0C0";
            }
            if (gCharacterInfo.current.level == WeaponType.LEVEL.LEVEL3) {
                ctx.strokeStyle = "#FFD700";
            }
            
            ctx.lineWidth = 3;
            ctx.rect(x, y, 20, 18);
            ctx.stroke();
        }

        let max_health = 12

        for (let i=0; i < gCharacterInfo.max_health; i++) {
            ctx.beginPath();
            if (i < gCharacterInfo.current_health) {
                //ctx.fillStyle = "pink";
                //ctx.strokeStyle = "purple";
                ctx.fillStyle = "purple";
                ctx.strokeStyle = "pink";
            } else {
                ctx.fillStyle = "white";
                ctx.strokeStyle = "silver";
            }
            
            ctx.lineWidth = 1;
            ctx.rect(12 + 8*i, barHeight/2 - 6, 4, 8);
            ctx.fill();
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.strokeStyle = "silver";
        ctx.lineWidth = 1;
        ctx.rect(12, barHeight/2 - 6 + 10, 8*max_health - 4, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "gold";
        let d = this.map.map._x_player.charge_duration
        let m = this.map.map._x_player._chargeTimeout()
        let p = Math.min(1.0, d/m)
        ctx.beginPath();
        ctx.rect(12+1, barHeight/2 - 6 + 10+1, p*(8*max_health - 6), 2);
        ctx.fill();

        this.coin_icon.draw(ctx, 8*(max_health+1)+12, 4)
        
        ctx.beginPath();
        ctx.font = "12px Arial";
        ctx.fillStyle = "white"
        ctx.strokeStyle = "white"
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        ctx.fillText(`x${gCharacterInfo.coins}`, 8*13+16+12, 4+8+1);

        // draw the hamburger menu
        gAssets.sheets.editor.drawTile(ctx, 2*8+2, gEngine.view.width - 20, 4)
        // set global alpha to ease in and out based on frame index
        if (gCharacterInfo.new_upgrade_indicator != null) {
            let a = 2 * Math.abs(0.5 - ((gEngine.frameIndex%60)/60))
            a = a<.2?0:a
            if (a>0) {
                ctx.save()
                ctx.globalAlpha = a
                gAssets.sheets.editor.drawTile(ctx, 3*8+2, gEngine.view.width - 20, 4)
                ctx.restore()
            }
        }

        this._paint_status_map(ctx)

        ctx.beginPath();
        ctx.font = "6px Arial";
        ctx.fillStyle = "white"
        ctx.strokeStyle = "white"
        ctx.textAlign = "right"
        ctx.textBaseline = "middle"
        ctx.fillText(`fps:${gEngine.fps}`, gEngine.view.width - 64 - 8, 8);
        let num_active = Object.values(this.map.map.objects).filter(obj=>obj.active).length
        let num_objects = Object.keys(this.map.map.objects).length
        ctx.fillText(`objs:${num_active}/${num_objects}`, gEngine.view.width - 64 - 8, 16);

    }

    _parallax(ctx) {

        let tw = 352
        let y = gAssets.mapinfo.height - tw

        let layers = [
            {image: gAssets.sheets.theme_bg_1, scale: 7},
            {image: gAssets.sheets.theme_bg_0, scale: 5},
        ]

        for (let j=0; j < layers.length; j++) {
            let layer = layers[j]

            let x1 =  (- Math.floor(this.camera.x/layer.scale)) - tw
            let x2 = gAssets.mapinfo.width
            for (let x=x1; x < x2; x += tw) {
                if ((x + tw) < this.camera.x || (x > this.camera.x + gEngine.view.width)) {
                    continue
                }
                layer.image.drawTile(ctx, 0, x, y)
            }
        }

    }

    paint(ctx) {

        // screen boundary
        //ctx.lineWidth = 1;
        //ctx.beginPath()
        //ctx.fillStyle = "#477ed6";
        //ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        //ctx.fill()

        ctx.save()

        // camera
        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -this.camera.y)

        // blue sky background
        // this rect defines the visible region of the game world

        let bgcolor;
        if (gAssets.mapinfo.theme == "plains") {
            bgcolor = "#477ed6"
        } else {
            // dark beige
            bgcolor = "#301505"
        }

        ctx.beginPath()
        ctx.fillStyle = bgcolor;
        ctx.rect(
            Math.max(0, this.camera.x),
            Math.max(0, this.camera.y),
            Math.min(gAssets.mapinfo.width - this.camera.x, gEngine.view.width),
            Math.min(gAssets.mapinfo.height - this.camera.y, gEngine.view.height))
        ctx.closePath()
        ctx.fill()
        ctx.clip();

        //if (gAssets.mapinfo.theme == "plains") {
        //    this._parallax(ctx) 
        //} 

        // gutter
        //ctx.beginPath()
        //ctx.fillStyle = "#FF0000";
        //ctx.rect(0,-64, gAssets.mapinfo.width, 64)
        //ctx.closePath()
        //ctx.fill()

        // paint chunks
        let tx = Math.floor(this.camera.x / 16 / 4)
        let ty = Math.floor(this.camera.y / 16 / 7)

        // the map is 6 chunks wide and 1 chunk tall
        for (let i = 0; i < 8; i++) {

            let cx = tx + i

            if (cx < 0) {
                continue;
            }

            if (cx >= 127) {
                break;
            }

            for (let j = 0; j < 3; j++) {

                let cy = ty + j

                if (cy < 0) {
                    continue;
                }

                if (cy >= 127) {
                    break;
                }

                let chunkid = cy * 128 + cx

                let chunk = gAssets.mapinfo.chunks[chunkid]

                if (!!chunk) {
                    ctx.drawImage(chunk.image, chunk.x*16, chunk.y*16)
                }

            }
        }


        this.map.paint(ctx)
        this.camera.paint(ctx)

        ctx.restore()

        if (!!this.dialog) {
            this.dialog.paint(ctx)
        }

        if (!!this.screen) {
            this.screen.paint(ctx)
        } else {
            this._paint_status(ctx)
            this.touch.paint(ctx)
        }

        
        //ctx.fillText(`${gEngine.view.availWidth}x${gEngine.view.availHeight}`, 8, 8);
        //ctx.fillText(`${gEngine.view.width}x${gEngine.view.height} (${gEngine.view.scale}) (${Math.floor(this.camera.x/16)},${Math.floor(this.camera.y/16)}` , 8, gEngine.view.height);

    }

    resize() {

        this.touch.resize()
    }

    handleTouches(touches) {
        if (!!this.screen) {
            this.screen.handleTouches(touches)
        } else {
            touches = this.touch.handleTouches(touches)

            touches.forEach(t => {

                if (t.y < 24 && t.x > gEngine.view.width - 24) {
                    this.screen = new PauseScreen(this)
                    gCharacterInfo.new_upgrade_indicator = null
                }


            })
        }
        //gEngine.setFullScreen(true)
    }

    handleKeyPress(keyevent) {
        if (!!this.screen) {
            this.screen.handleKeyPress(keyevent);
        } else {
            this.keyboard.handleKeyPress(keyevent);
        }
    }

    handleKeyRelease(keyevent) {
        if (!!this.screen) {
            this.screen.handleKeyRelease(keyevent);
        } else {

            // check for escape pressed
            if (keyevent.keyCode == 27) {
                this.screen = new PauseScreen(this)
            } else {
                this.keyboard.handleKeyRelease(keyevent);
            }

        }

    }
}
