import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"


export class BumperSwitch extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.solid = 1
        this.rect = new Rect(props.x, props.y+4, 32, 12)
        this.rect2 = new Rect(props.x+2, props.y+2, 32-4, 2)

        this.pressed = false

        this.switch_trigger_id = props.switch_trigger_id
        this.switch_mode = props.switch_mode

    }

    paint(ctx) {

        let tid = this.pressed ? 5: 1

        gAssets.sheets.bumper.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]

            const pressed = this.rect2.collideRect(player.rect);

            if (pressed && !this.pressed) {
                console.log("bump switch", this.switch_trigger_id, this.switch_mode)
                this._x_debug_map.queryObjects({"switch_target_id": this.switch_trigger_id}).forEach(obj => {
                    console.log("bump entity", obj.entid)
                    obj.onSwitchTrigger(this.switch_mode)
                })
            }

            this.pressed = pressed
        }

    }

}

registerEditorEntity("BumperSwitch", BumperSwitch, [32,16], EntityCategory.hazard, null, (entry)=> {
    entry.icon = makeEditorIcon(gAssets.sheets.bumper, 1)
    entry.editorIcon = (props) => {
        let tid = 1
        return gAssets.sheets.bumper.tile(tid)
    }
    entry.editorSchema = [
        {
            control: EditorControl.SWITCH_TRIGGER,
        },
    ]
})