import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"


class SpikesBase extends PlatformerEntity {
    constructor(entid, props, color, size) {
        // color: row in the tile sheet
        // size: in pixels, of how tall the solid region is
        //       if size is 16, there is no solid region
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.rect2 = new Rect(this.rect.x+4, this.rect.y+4, 8, 8)
        this.point = {x: props?.x??0, y: props?.y??0} // where to draw the spikes
        this.solid = (size<16)?1:0
        this.direction = props?.direction??Direction.UP

        let tid = 0
        switch(this.direction) {
            case Direction.LEFT:
                tid = 3
                this.rect.x += 16 - size
                this.rect.w = s
                this.offset_x = -8
                this.offset_y = 0
                break;
            case Direction.DOWN:
                tid = 2
                this.rect.h = size
                this.offset_x = 0
                this.offset_y = 0
                break;
            case Direction.RIGHT:
                tid = 1
                this.rect.w = size
                this.offset_x = 0
                this.offset_y = 0
                break;
            case Direction.UP:
            default:
                tid = 0
                this.rect.y += 16 - size
                this.rect.h = size
                this.offset_x = 0
                this.offset_y = -8
                break;
        }
        this.tid = 4*color + tid
    }

    paint(ctx) {
        gAssets.sheets.spikes.drawTile(ctx, this.tid, this.point.x, this.point.y)
    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            if (this.rect2.collideRect(player.rect)) {
                player.character.hit(this)
            }
        }
    }

}

export class Spikes extends SpikesBase {
    constructor(entid, props) {
        super(entid, props, 0, 8)
    }
}

export class Spikes2 extends SpikesBase {
    constructor(entid, props) {
        super(entid, props, 1, 16)
    }
}

registerEditorEntity("Spikes", Spikes, [16,16], EntityCategory.hazard, null, (entry)=> {
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

registerEditorEntity("Spikes2", Spikes2, [16,16], EntityCategory.hazard, null, (entry)=> {
    entry.icon = gAssets.sheets.spikes.tile(4)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 7;
                break;
            case Direction.DOWN:
                tid = 6;
                break;
            case Direction.RIGHT:
                tid = 5;
                break;
            case Direction.UP:
            default:
                tid = 4;
                break;
        }

        return gAssets.sheets.spikes.tile(tid)
    }
    entry.editorSchema = [
        {control: EditorControl.DIRECTION_4WAY, "default": Direction.UP},
    ]
})