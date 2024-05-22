import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"


export class Spikes extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.rect2 = new Rect(this.rect.x+4, this.rect.y+4, 8, 8)
        this.solid = 1
        this.direction = props?.direction??Direction.UP

        let tid = 0
        switch(this.direction) {
            case Direction.LEFT:
                tid = 3
                this.rect.x += 8
                this.rect.w = 8
                this.offset_x = -8
                this.offset_y = 0
                break;
            case Direction.DOWN:
                tid = 2
                this.rect.h = 8
                this.offset_x = 0
                this.offset_y = 0
                break;
            case Direction.RIGHT:
                tid = 1
                this.rect.w = 8
                this.offset_x = 0
                this.offset_y = 0
                break;
            case Direction.UP:
            default:
                tid = 0
                this.rect.y += 8
                this.rect.h = 8
                this.offset_x = 0
                this.offset_y = -8
                break;
        }
        this.tid = tid
    }

    paint(ctx) {
        Spikes.sheet.drawTile(ctx, this.tid, this.rect.x + this.offset_x, this.rect.y + this.offset_y)
    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            if (this.rect2.collideRect(player.rect)) {
                player.character.hit()
            }
        }
    }

}

registerEditorEntity("Spikes", Spikes, [16,16], EntityCategory.hazard, null, (entry)=> {
    Spikes.sheet = gAssets.sheets.spikes
    entry.icon = gAssets.sheets.spikes.tile(0)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 3;
                break;
            case Direction.DOWN:
                tid = 2;
                break;
            case Direction.RIGHT:
                tid = 1;
                break;
            case Direction.UP:
            default:
                tid = 0;
                break;
        }

        return gAssets.sheets.spikes.tile(tid)
    }
    entry.editorSchema = [
        {control: EditorControl.DIRECTION_4WAY, "default": Direction.UP},
    ]
})