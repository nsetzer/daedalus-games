import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"

export class FireBar extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y+4, 16, 16)

        this.rot_time = props.rot_time??4
        this.bar_length = props.bar_length??5
        this.direction = props.direction??1

        this.offset_angle = (props.offset??0) * Math.PI / 180

        console.log({direction: this.direction,length: this.bar_length})

        this.points = [];

        this.tiles_a = []
        this.tiles_b = []

        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+0))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+1))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+2))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+3))

        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+0))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+1))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+2))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+3))

        this.block_icon = gAssets.themes[gAssets.mapinfo.theme][1].tile(33)
        this.timer = 0

        

    }

    paint(ctx) {

        this.block_icon.draw(ctx, this.rect.x, this.rect.y)

        // draw the hour hand of a clock in red using this.timer
        // every 8 pixels from the center, draw a black dot along the hand

        // draw a black dot for each point in this.points
        let tiles = (Math.floor(gEngine.frameIndex/15)%2==0)?this.tiles_a:this.tiles_b

        let k = this.bar_length - 1
        this.points.forEach((p, i) => {

            ctx.fillStyle = 'black';

            let j;
            if (i < this.bar_length-1) {
                j = Math.round(2*i/k);
            } else {
                j = 3;
            }
            
            tiles[j].draw(ctx, this.rect.cx() + p.x-8, this.rect.cy() + p.y-12)

        })

    }

    update(dt) {

        // Note: using gEngine.frameIndex caused weird behavior
        this.timer += dt
        let angle = this.direction * this.timer * (2 * Math.PI / this.rot_time) + this.offset_angle

        let dx = Math.cos(angle)
        let dy = Math.sin(angle)
        this.points = []
        for (let i=0; i<this.bar_length;i++) {
            let pt = {x: 8*i*dx, y: 8*i*dy}
            this.points.push(pt)
        }

        //let objs = this._x_debug_map.queryObjects({"className": "Player"})
        //if (objs.length > 0) {
        //}

    }

}

registerEditorEntity("FireBar", FireBar, [16,16], EntityCategory.hazard, null, (entry)=> {
    entry.icon = gAssets.sheets.brick.tile(15)
    //entry.editorIcon = gAssets.sheets.brick.tile(15)
    entry.editorSchema = [
        // how many flame nodes to render
        {control: EditorControl.RANGE, name: "bar_length", "min": 3, "max": 15, "default": 5, "step": 1},
        // speed is seconds per revolution
        {control: EditorControl.RANGE, name: "rot_time", "display_name":"Rotation Time (s)","default": 4, "min": 1, "max": 10, "step": 0.5},
        // offset is the starting angle, in 45 degree increments
        {control: EditorControl.RANGE, name: "offset", "display_name":"Starting Angle", "default": 0, "min": 0, "max": 315, "step": 45},
        // the rotation direction
        {control: EditorControl.CHOICE, name: "direction", "choices": {
            "Clockwise": 1,
            "Counter-Clockwise": -1,
        }}
        
    ]
    entry.editorRender = (ctx, x, y, props) => {

        let tile = gAssets.themes[gAssets.mapinfo.theme][1].tile(33)
        tile.draw(ctx, x, y)
        // draw red dots 8pxs apart starting at x,y
        let cx = x + 8 
        let cy = y + 8
        let dx = Math.cos(props.offset * Math.PI / 180)
        let dy = Math.sin(props.offset * Math.PI / 180)

        for (let i=0; i < props.bar_length; i++) {
            ctx.fillStyle = 'red'
            ctx.beginPath()
            ctx.arc(cx + 8*dx*i, cy + 8*dy*i, 3, 0, 2 * Math.PI)
            ctx.fill()
        }
    }
})