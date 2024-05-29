
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"



export class MovingPlatformUD extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        // TODO: implement `order` and process update for moving platforms 
        // before other objects which implement physics

        this.solid = 1
        
        let width = props.width??32
        let height = props.height??32 // range of travel
        let platform_height = 10 // height of the platform
        let offset = Math.min(props.offset??0, (height - platform_height))

        this.rect = new Rect(props.x, props.y+ offset, width, platform_height)
        this.range = new Rect(props.x, props.y, width, height)

        this.speed = props.speed??16
        this.accum = 0
        this.direction = 1;
    }

    paint(ctx) {

        // Bumper.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 4)

        /*
        ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()

        let rect1 = new Rect(this.rect.x, this.rect.y-1, this.rect.w, 2)
        ctx.beginPath()
        ctx.fillStyle = 'yellow'
        ctx.rect(rect1.x, rect1.y, rect1.w, rect1.h)
        ctx.fill()

        let rect2 = new Rect(this.rect.x, this.rect.bottom()-1, this.rect.w, 2)

        ctx.beginPath()
        ctx.fillStyle = 'yellow'
        ctx.rect(rect2.x+2, rect2.y, rect2.w-4, rect2.h)
        ctx.fill()
        */

        let n = this.rect.w/16
        for (let i=0; i < n; i+=1) {
            let tid;

            if (i==0) {
                tid = 4
            } else if (i==1 || i==n-2) {
                tid = Math.floor(gEngine.frameIndex/5)%4
            } else if (i == n-1) {
                tid = 5
            } else {
                tid = 6
            }
            gAssets.sheets.platformud.drawTile(ctx, tid, this.rect.x+i*16, this.rect.y-6)
        }


    }

    update(dt) {

        this.accum += dt*this.speed
        let delta = Math.trunc(this.accum);
        this.accum -= delta;

        if (this.rect.bottom() + delta >= this.range.bottom()) {
            delta = this.range.bottom() - this.rect.bottom()
            this.direction = -1
        } 

        if (this.rect.top() + delta <= this.range.top()) {
            delta = this.range.top() - this.rect.top()
            this.direction = 1
        }

        for (let i = 0; i < delta; i++) {
            this.visited = {}
            this._move(this)
            this.rect.y += this.direction
        }
        /*
        
        
            this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {
                // when traveling up or down, move objects on the platform
                let rect1 = new Rect(this.rect.x, this.rect.y-1, this.rect.w, 2)
                if (rect1.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                    obj.rect.y += this.direction
                }

                if (obj.solid) {

                }
                // TODO: not clear if this is needed?
                // when traveling down, push objects below the platform down as well
                ///let rect2 = new Rect(this.rect.x, this.rect.bottom()-1, this.rect.w, 2)
                ///if (this.direction>0 && rect2.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                ///    console.log(obj._classname, "push")
                ///    obj.rect.y += step
                ///}
            })

            this.rect.y += this.direction
        */
    }

    _move(parent) {
        this._x_debug_map.queryObjects({"physics": undefined}).forEach(obj => {
            if (obj.entid === parent.entid) { return }
            // when traveling up or down, move objects on the platform
            let rect1 = new Rect(parent.rect.x, parent.rect.y-1, parent.rect.w, 2)
            if (rect1.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {

                // recursivley apply the movement update to any objects standing
                // on the platform
                if (obj.solid) {
                    this._move(obj)
                }

                if (!this.visited[obj.entid]) {
                    // TODO: obj.step(0, this.direction) ??
                    // TODO: check for object being crushed and reverse direction
                    // TODO: if obj is not solid, kill it
                    obj.rect.y += this.direction
                }

                this.visited[obj.entid] = true

            }

            // recursivley apply the movement update to any objects standing
            // on a solid object on this platform
            

            // TODO: not clear if this is needed?
            // when traveling down, push objects below the platform down as well
            /*
            let rect2 = new Rect(this.rect.x, this.rect.bottom()-1, this.rect.w, 2)
            if (this.direction>0 && rect2.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                console.log(obj._classname, "push")
                obj.rect.y += step
            }
            */
        })
    }
}

registerEditorEntity("MovingPlatformUD", MovingPlatformUD, [32,16], EntityCategory.hazard, null, (entry)=> {
    entry.icon = makeEditorIcon(gAssets.sheets.platformud)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RANGE, 
            "name": "speed",
            "min": 16, "max": 256, 
            "step": 8
        },
        {control: EditorControl.RANGE, 
            "name": "offset",
            "min": 0, "max": 256, 
            "step": 16
        },
        {control: EditorControl.RESIZE, 
            "name": "height",
            "min_width": 32, "max_width": 256, 
            "min_height": 32,
        },
    ]
    
    entry.editorRender = (ctx,x,y,props) => {

        let n = props.width/16
        for (let i=0; i < n; i+=1) {
            let tid;

            if (i==0) {
                tid = 4
            } else if (i==1 || i==n-2) {
                tid = 0
            } else if (i == n-1) {
                tid = 5
            } else {
                tid = 6
            }

            gAssets.sheets.platformud.drawTile(ctx, tid, x+i*16, y+props.offset-6)
        }
        /*ctx.beginPath()
        ctx.fillStyle = 'blue'
        ctx.rect(x, y+props.offset, props.width, 16)
        ctx.fill()*/

    }
})

// a platform that counts how many times the player has stood on top of it
// decrement a counter after each time the player leaves
// TODO: make a switch platform. jumping off toggles the platform 
// to the other side
//  ___0   0  0___
//      -> | ->
//
export class CountingPlatform extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        // TODO: implement `order` and process update for moving platforms 
        // before other objects which implement physics
        this.solid = 1
        let width = 32
        let height = 16 // range of travel
        this.rect = new Rect(props.x, props.y, width, height)

        this.trigger = false
        this.count = props.count
    }

    paint(ctx) {

        let tid = (!this.trigger)?0:1
        CountingPlatform.sheet.drawTile(ctx, tid, this.rect.x, this.rect.y - 2)

        //ctx.beginPath()
        //ctx.fillStyle = 'blue'
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.fill()

        // draw the count centered in the rect
        ctx.beginPath()
        ctx.font = "16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`${this.count}`, this.rect.cx(), this.rect.cy()+3);  


    }

    update(dt) {
        this._x_debug_map.queryObjects({"className": "Player"}).forEach(obj => {
            // when traveling up or down, move objects on the platform
            let rect1 = new Rect(this.rect.x, this.rect.y-1, this.rect.w, 2)
            if (rect1.collidePoint(obj.rect.cx(), obj.rect.bottom()-1)) {
                this.trigger = true
            } else if (this.trigger) {
                this.trigger = false
                this.count -= 1
                if (this.count <= 0) {
                    this.destroy()
                }
            }
        })
    }

}

registerEditorEntity("CountingPlatform", CountingPlatform, [32,16], EntityCategory.hazard, null, (entry)=> {
    CountingPlatform.sheet = gAssets.sheets.countplatform
    entry.icon = makeEditorIcon(CountingPlatform.sheet)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RANGE, 
            "name": "count",
            "min": 1, "max": 10, "default": 3,
            "step": 1
        },
    ]
    
    entry.editorRender = (ctx,x,y,props) => {
        gAssets.sheets.countplatform.drawTile(ctx, 1, x, y-2)
    }
})


export class Bridge extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, props.width, props.height)
        this.visible = 1
        this.solid = 1
    }

    paint(ctx) {
        ctx.strokeStyle = '#0000cc7f'
        ctx.fillStyle = '#0000cc7f'
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        for(let x=this.rect.x; x < this.rect.right(); x+=16) {
            gAssets.sheets.ruler.tile(0).draw(ctx, x, this.rect.y)
        }
        ctx.stroke()
    }

    update(dt) {
    }

}

registerEditorEntity("Bridge", Bridge, [16,16], EntityCategory.hazard, null, (entry)=> {
    Bridge.sheet = gAssets.sheets.ruler
    entry.icon = Bridge.sheet.tile(0)
    entry.editorIcon = null
    entry.editorSchema = [
        {control: EditorControl.RESIZE, "min_width": 48, "min_height": 16},
        {control: EditorControl.CHOICE, name: "opened", "default": 1, choices: {opened:1,closed:0}}
    ]

})