

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