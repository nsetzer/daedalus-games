
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon, registerDefaultEntity} from "@troid/entities/sys"
import {Direction} from "@axertc/axertc_common"

export class PistonUDBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        // TODO: implement `order` and process update for moving platforms
        // before other objects which implement physics

        this.solid = 1

        let width = props.width??16
        let height = props.height??32 // range of travel

        // objects are only activated when their size is non-zero
        // hack: make the object 2px when the smallest so it
        // can always be on the screen. we just dont render the first 2 pixels

        this.source = props.direction??Direction.UP
        if (this.source == Direction.UP) {
            // grow up
            this.rect = new Rect(props.x, props.y, width, 2)
            this.range = new Rect(props.x, props.y, width, height + 2)
        } else {
            // grow down
            this.rect = new Rect(props.x, props.y - 2, width, 2)
            this.range = new Rect(props.x, props.y - 2, width, height + 2)
        }

        this.rect.y = (this.source == Direction.UP) ? this.range.bottom() - this.size : this.range.y
        this.face_dir = (this.source == Direction.UP) ? -1 : 1

        this.speed = props.speed??16 // pixels per second
        this.accum = 0
        // +1 : growing. -1:  shrinking
        this.grow_direction = 1;

        this.size = 2;
        this.min_size = 2;

        console.log("piston created", this.rect, this.range, this.direction)

        this._reshape()

    }

    isSolid(other) {
        return true
    }

    paint(ctx) {



        // outline a rectange in black
        ctx.strokeStyle = 'black'
        ctx.strokeRect(this.range.x, this.range.y, this.range.w, this.range.h)

        // fill a red rectangle
        ctx.fillStyle = 'red'
        ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)

        // write text with the current size
        ctx.font = '12px Arial'
        ctx.fillStyle = 'black'
        ctx.fillText(`${this.size}/${this.range.h}`, this.rect.x, this.rect.y)

        // render tiles from piston sheet instead
        // skip first 2 pixels. clip the sprite to range

        ctx.save()
        ctx.beginPath()
        ctx.rect(this.range.x, this.range.y, this.range.w, this.range.h)
        ctx.clip()
        if (this.source == Direction.UP) {
            for (let j=0; j < this.rect.w; j+=16) {
                gAssets.sheets.piston.drawTile(ctx, 1, this.rect.x + j, this.rect.y)
            }
            for (let i=16; i < this.rect.h; i+=16) {
                for (let j=0; j < this.rect.w; j+=16) {
                    gAssets.sheets.piston.drawTile(ctx, 0, this.rect.x + j, this.rect.y + i)
                }
            }
        } else {
            for (let j=0; j < this.rect.w; j+=16) {
                gAssets.sheets.piston.drawTile(ctx, 2, this.rect.x + j, this.rect.y + this.rect.h - 16)
            }
            for (let i=0; i < this.rect.h - 16; i+=16) {
                for (let j=0; j < this.rect.w; j+=16) {
                    gAssets.sheets.piston.drawTile(ctx, 0, this.rect.x + j, this.rect.y + i)
                }
            }
        }
        ctx.restore()
        // let n = this.rect.w/16
        // for (let i=0; i < n; i+=1) {
        //     let tid;

        //     if (i==0) {
        //         tid = 4
        //     } else if (i==1 || i==n-2) {
        //         tid = Math.floor(gEngine.frameIndex/5)%4
        //     } else if (i == n-1) {
        //         tid = 5
        //     } else {
        //         tid = 6
        //     }
        //     gAssets.sheets.platformud.drawTile(ctx, tid, this.rect.x+i*16, this.rect.y-6)
        // }


    }

    _reshape() {
        // the anchored edge stays put, the opposite edge does the moving
        this.rect.y = (this.source == Direction.UP)
            ? this.range.bottom() - this.size
            : this.range.y
        this.rect.h = this.size
    }

    update(dt) {

        this.accum += dt*this.speed
        let delta = Math.trunc(this.accum);
        this.accum -= delta;

        for (let i = 0; i < delta; i++) {
            this.visited = {}
            let dy = this.face_dir * this.grow_direction
            // a retracting ceiling piston must not drag anything upward with it
            if (this.source != Direction.UP && this.grow_direction < 0) {
                dy = 0
            }
            if (dy != 0) {
                this._move(this, dy)
            }
            this.size += this.grow_direction
            if (this.size >= this.range.h) {
                this.size = this.range.h
                this.grow_direction = -1
            } else if (this.size <= this.min_size) {
                this.size = this.min_size
                this.grow_direction = 1
            }
            this._reshape()
        }

    }

    _move(parent) {
        // feet on a rising top edge, or heads under a descending bottom edge
        const from_floor = this.source == Direction.UP
        const face = from_floor ? parent.rect.top() : parent.rect.bottom()
        const band = new Rect(parent.rect.x, face - 1, parent.rect.w, 2)
        this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {
            if (obj.entid === parent.entid) { return }
            const probe = from_floor ? obj.rect.bottom() - 1 : obj.rect.top()
            if (band.collidePoint(obj.rect.cx(), probe)) {
                if (obj.solid) {
                    this._move(obj)
                }
                if (!this.visited[obj.entid] && parent.isSolid(obj)) {
                    obj.rect.y += this.face_dir * this.grow_direction
                }
                this.visited[obj.entid] = true
            }
        })
    }
}

export class PistonUD extends PistonUDBase {
    constructor(entid, props) {
        super(entid, props)
    }
}

registerEditorEntity("PistonUD", PistonUD, [16,16], EntityCategory.hazard, null, (entry)=> {
    entry.icon = makeEditorIcon(gAssets.sheets.platformud)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RANGE,
            "name": "speed",
            "min": 4, "max": 256,
            "step": 4,
            "default": 16
        },
        {control: EditorControl.CHOICE,
            "name": "direction",
            "choices": {
                "Down": Direction.DOWN, // from the ceiling pushing down
                "Up": Direction.UP // from the floor pushing up
            },

            "default": Direction.UP
        },
        {control: EditorControl.RESIZE,
            "min_width": 16, "max_width": 32,
            "min_height": 16, "max_height": 256,
        },


    ]

    entry.editorRender = (ctx,x,y,props) => {

        // 0 1 2
        // 3 4 5
        for (let j=0; j < props.height; j+=16) {
            let tid = 0;

            // first row when direction is up used tid 1
            if (props.direction == Direction.UP && j == 0) {
                tid = 1;
            }
            // last row when direction is down used tid 2
            if (props.direction == Direction.DOWN && j == props.height - 16) {
                tid = 2;
            }
            for (let i=0; i < props.width; i+=16) {
                gAssets.sheets.piston.drawTile(ctx, tid, x+i, y+j)
            }
        }
    }
})

