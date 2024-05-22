import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, Slope
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"



// TODO: extend from PlatformerEntity, not Slope
export class Flipper extends Slope {
    constructor(entid, props) {
        if (props.direction == Direction.LEFT) {
            props.x += 10
        } else {
            props.x += 12
        }
        props.w = 26
        props.h = 27
        super(entid, props)

        
        this.visible =1

        let tid = 0
        switch(this.direction) {
            case Direction.LEFT:
                tid = 6
                break;
            case Direction.RIGHT:
                tid = 2
                break;
        }
        this.tid = tid

        this.timer = 0
    }

    isSolid(other) {
        //console.log(other.rect.bottom(), this.rect.top(), other.rect.bottom() < this.rect.top())
        //return other.rect.bottom() <= this.rect.top()
        return true
    }

    init_points() {
        this.points = []
        // points are organized such that:
        // origin is always first
        // left most non-origin point is second
        // right most non-origin point is third
        switch (this.direction) {

            case Direction.RIGHT:
                this.points.push({x: this.rect.left() + 12 - 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.left() + 38 - 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.left() + 12 - 12, y: this.rect.top()})
                this.rect3 = new Rect(this.rect.left()-10, this.rect.top(), 10, 12)
                this.rect2 = new Rect(this.rect.right()-12,  this.rect.bottom() - 12, 12, 12)
                //this.direction = Direction.UPRIGHT
                break
            case Direction.LEFT:
                this.points.push({x: this.rect.right() - 12 + 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.right() - 38 + 12, y: this.rect.top() + 27})
                this.points.push({x: this.rect.right() - 12 + 12, y: this.rect.top()})
                this.rect3 = new Rect(this.rect.right(), this.rect.top(), 10, 12)
                this.rect2 = new Rect(this.rect.x,  this.rect.bottom() - 12, 12, 12)
                //this.direction = Direction.UPLEFT
                break
            default:
                throw {message: "invalid direction", direction: this.direction}
        }
    }

    collidePoint(x, y) {
        return super.collidePoint(x, y) || this.rect3.collidePoint(x,y)
    }
    
    paint(ctx) {

        let tid = this.tid
        if (this.timer > 0) {
            tid += 1
        }

        if (this.direction == Direction.LEFT) {
            Flipper.sheet.drawTile(ctx, tid, this.rect.x-10, this.rect.y)
        } else {
            Flipper.sheet.drawTile(ctx, tid, this.rect.x-12, this.rect.y)
        }

        super.paint(ctx)



        ctx.strokeStyle = 'red'
        ctx.fillStyle = "#c3a3a3";
        ctx.beginPath();
        let pts = this.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath()
        ctx.strokeStyle = 'blue'
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = 'green'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.stroke()

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

registerEditorEntity("Flipper", Flipper, [48,32], EntityCategory.hazard, null, (entry)=> {
    Flipper.sheet = gAssets.sheets.flipper
    entry.icon = makeEditorIcon(Flipper.sheet)
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
    
        return gAssets.sheets.flipper.tile(tid)
    }
    entry.editorSchema = [
        {
            control: EditorControl.CHOICE,
            name: "direction",
            "default": Direction.RIGHT,
            choices: {
                "RIGHT": Direction.RIGHT,
                "LEFT": Direction.LEFT
            }
        },
    ]
})