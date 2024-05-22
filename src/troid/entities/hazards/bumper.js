import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"


export class Bumper extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y+4, 32, 12)
        this.rect2 = new Rect(props.x+2, props.y+2, 32-4, 2)

        this.timer = 0
    }

    paint(ctx) {

        let tid = 2
        if (this.timer > 0) {
            tid = 0
        }

        Bumper.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

        //ctx.strokeStyle = 'blue'
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)
        //ctx.stroke()
    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            if (this.rect2.collideRect(player.rect)) {
                player._bounce2()
                this.timer = 0.3
            }
        }

        if (this.timer > 0) {
            this.timer -= dt
        }

    }

}

registerEditorEntity("Bumper", Bumper, [32,16], EntityCategory.hazard, null, (entry)=> {
    Bumper.sheet = gAssets.sheets.bumper
    entry.icon = makeEditorIcon(Bumper.sheet)
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 6;
                break;
            case Direction.RIGHT:
            default:
                tid = 2;
                break;
        }
    
        return gAssets.sheets.bumper.tile(tid)
    }
    entry.editorSchema = []
})