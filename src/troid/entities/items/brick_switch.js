

import {
    Rect,
} from "@axertc/axertc_common"

import {gAssets} from "@troid/store"

import {registerEditorEntity, EntityCategory} from "@troid/entities/sys"
import {
    PlatformerEntity, AnimationComponent
} from "@axertc/axertc_physics"
import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"
import {Player} from "@troid/entities/player"

/**
 * red switches active red platforms
 * and deactivate blue platforms
 * by default red platforms are always solid
 */
export class RedSwitch extends Brick {

    paint(ctx) {
        gAssets.sheets.brick.tile(1).draw(ctx, this.rect.x, this.rect.y)
    }

    _kill() {

        this._x_debug_map.queryObjects({"className": "RedPlatform"}).forEach(obj => {
            //obj.visible = true;
            obj.solid = true;
        })

        this._x_debug_map.queryObjects({"className": "BluePlatform"}).forEach(obj => {
            //obj.visible = false;
            obj.solid = false;
        })
        console.log("reveal red")
    }
}

registerEditorEntity("RedSwitch", RedSwitch, [16,16], EntityCategory.switches, null, (entry)=> {
    RedSwitch.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(1)
    entry.editorIcon = null
    entry.editorSchema = []
})

/**
 * blue switches active blue platforms
 * and deactivate red platforms
 * by default blue platforms are always not solid
 */
export class BlueSwitch extends Brick {

    paint(ctx) {
        gAssets.sheets.brick.tile(5).draw(ctx, this.rect.x, this.rect.y)
    }

    _kill() {
        this._x_debug_map.queryObjects({"className": "RedPlatform"}).forEach(obj => {
            //obj.visible = false;
            obj.solid = false;
        })

        this._x_debug_map.queryObjects({"className": "BluePlatform"}).forEach(obj => {
            //obj.visible = true;
            obj.solid = true;
        })
        console.log("reveal blue")
    }

}

registerEditorEntity("BlueSwitch", BlueSwitch, [16,16], EntityCategory.switches, null, (entry)=> {
    BlueSwitch.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(5)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class RedPlatform extends Brick {

    paint(ctx) {
        this.constructor.sheet.drawTile(ctx, this.solid?2:3, this.rect.x, this.rect.y)
    }

    _kill() {

    }
}

registerEditorEntity("RedPlatform", RedPlatform, [16,16], EntityCategory.switches, null, (entry)=> {
    RedPlatform.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(2)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class BluePlatform extends Brick {

    constructor(entid, props) {
        super(entid, props)
        this.solid = false
    }
    paint(ctx) {
        this.constructor.sheet.drawTile(ctx, this.solid?6:7, this.rect.x, this.rect.y)
    }

    _kill() {

    }
}

registerEditorEntity("BluePlatform", BluePlatform, [16,16], EntityCategory.switches, null, (entry)=> {
    BluePlatform.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(6)
    entry.editorIcon = null
    entry.editorSchema = []
})