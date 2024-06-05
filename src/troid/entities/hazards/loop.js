
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, ProjectileBase, PlayerBase, makeEditorIcon} from "@troid/entities/sys"


export class Loop extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, 128, 128)
        this.visible = 1
        this.solid = 1


        

    }

    isSolid(other) {
        return true
    }

    collidePoint(x, y) {
        // check point is not within circle
        let dx = x - this.rect.cx();
        let dy = y - this.rect.cy();
        let radius = Math.floor(this.rect.w/2) - 1
        let distance = Math.sqrt(dx * dx + dy * dy);

        return x > this.rect.cx() && this.rect.collidePoint(x, y) && (distance > radius)

    }


    paint(ctx) {
        // draw a circle, 128 px in diameter
        ctx.save()
        
        ctx.globalCompositeOperation='destination-out'
        ctx.fillStyle = 'blue';

        ctx.beginPath()
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.arc(this.rect.cx(), this.rect.cy(), Math.floor(this.rect.w/2) - 1, 0, 2 * Math.PI, true)
        ctx.closePath()
        ctx.fill()
        //ctx.clip()

        ctx.restore()
    

    }

    update(dt) {
    }

}

registerEditorEntity("Loop", Loop, [128,128], EntityCategory.hazard, null, (entry)=> {
    entry.icon = gAssets.sheets.ruler.tile(0)
    entry.editorIcon = null
    entry.editorSchema = [
    ]
})