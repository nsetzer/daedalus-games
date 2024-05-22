import {
    Rect,
} from "@axertc/axertc_common"

import {
    PlatformerEntity, 
} from "@axertc/axertc_physics"

import {gAssets} from "@troid/store"
import { registerEditorEntity, EntityCategory} from "@troid/entities/sys"

export class Stamp extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, props.width, props.height)
        this.visible = 1
        this.solid = 0
    }

    paint(ctx) {
        ctx.strokeStyle = '#0000cc7f'
        ctx.fillStyle = '#0000cc7f'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        gAssets.sheets.ruler.tile(0).draw(ctx, this.rect.x, this.rect.y)
        ctx.stroke()
    }

    update(dt) {
    }

}

registerEditorEntity("Stamp", Stamp, [16,16], EntityCategory.stamp, null, (entry)=> {
    Stamp.sheet = gAssets.sheets.ruler
    entry.icon = Stamp.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})
