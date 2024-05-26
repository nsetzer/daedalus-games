

import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"


export class WindFan extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.solid = 1
        this.rect = new Rect(props.x, props.y, 32, 16)
        let size = 6*16
        this.rect2 = new Rect(props.x, props.y - size, 32, size)
        this.factor = 0

        let color = 0
        this.tiles = WindFan.sheet.tiles().slice(color*WindFan.sheet.cols, (color+1)*WindFan.sheet.cols)
    }

    paint(ctx) {
        let i = Math.floor(gEngine.frameIndex / 6) % this.tiles.length
        WindFan.sheet.drawTile(ctx, this.tiles[i], this.rect.x, this.rect.y)

        ctx.beginPath()
        ctx.strokeStyle = 'yellow'
        ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)
        ctx.stroke()
    }

    _x_paint(ctx) {

        // Bumper.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

        ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()

        ctx.beginPath()
        ctx.strokeStyle = 'yellow'
        ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)
        ctx.stroke()

        let player = this._x_debug_map.queryObjects({"className": "Player"})[0]

        ctx.beginPath()
        ctx.font = "16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`${Math.round(player.physics.speed.y)}, ${this.factor.toFixed(3)}`, this.rect.x, this.rect.y);
        ctx.fillText(`boost=${Math.round(player.physics.gravityboost)} `, this.rect.x, this.rect.y+8);

    }

    update(dt) {

        // TODO: find objects that implement physics 2
        // TODO: tune the margin and scale factor to pick a specific maximum height
        this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {

            // dont blow objects stuck to the wall
            if (obj.physics.can_wallwalk && obj.physics._x_is_standing) {
                return
            }
            // TODO: this uncovered a bug in the physics engine
            // when next_rect is active, the speed y or x could be used
            // to accumulate moving towards the next rect, but the fan is adding
            // to the y component which will sometimes break it
            if (obj.physics.next_rect != null) {
                return
            }

            if (this.rect2.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {

                let factor;
                let margin = 32

                let y3 = this.rect2.bottom()
                let y2 = y3 - margin
                let y1 = this.rect2.top()
                let p1 = obj.rect.bottom() 

                //if (p1 > y2) {
                //    factor = 2
                //} else {
                //    factor = 1.0 - (y2 - p1) / (y2 - y1)
                //}
                factor = 2*(1.0 - (y3 - p1) / (y3 - y1))

                this.factor = factor

                let gforce1 = Math.abs(obj.physics.gravity * dt)
                let gforce2 = -Math.abs(1 * factor * gforce1)
                if (obj.physics.speed.y > 100) {
                    obj.physics.speed.y *= .9
                }
                obj.physics.speed.y += gforce2
            }
        })

    }

}

registerEditorEntity("WindFan", WindFan, [32,16], EntityCategory.hazard, null, (entry)=> {
    WindFan.sheet = gAssets.sheets.windfan
    entry.icon = makeEditorIcon(WindFan.sheet)
    entry.editorIcon = (props) => {
        return gAssets.sheets.windfan.tile(0)
    }
    entry.editorSchema = []
    // todo: highlight the region the fan affects
    entry.editorRender = undefined
})