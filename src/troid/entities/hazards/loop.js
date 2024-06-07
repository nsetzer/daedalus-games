
import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, ProjectileBase, PlayerBase, makeEditorIcon} from "@troid/entities/sys"

function tangentLine(degrees, radius) {
    // Convert degrees to radians
    let radians = degrees * (Math.PI / 180);
    
    // Calculate the coordinates of the point on the circle

    
    if (degrees == 0) {
        return { m: null, b: null, x: radius, y: 0, degrees: degrees};
    }

    if (degrees == 180) {
        return { m: null, b: null, x: -radius, y: 0, degrees: degrees};
    }

    let x0 = radius * Math.cos(radians);
    let y0 = radius * Math.sin(radians);
    // Calculate the slope of the tangent line
    let m = -x0 / y0;
    
    // Calculate the y-intercept of the tangent line
    let b = y0 - m * x0;
    
    // Return the slope and y-intercept
    return { m: m, b: b, x: x0, y: y0, degrees: degrees};
}


export class Loop extends PlatformerEntity {
    /*
    loops act like special doors that can only be opened with the spider ball
    */
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect(props.x, props.y, 128, 128)
        this.visible = 1
        this.solid = 1
        this.layer = -1

        this.object_state = {[0]: 1} // entid => (0: left, 1: right)

        this.offset_y = 8
        this.center_y = this.rect.cy() + this.offset_y/2
        this.center_x = this.rect.cx()
        this.radius = (this.rect.w - this.offset_y)/2

        this.dirt = gAssets.themes[gAssets.mapinfo.theme][1].tile(33)


        let sens_w = 12
        this.sensor_switch1 = new Rect(this.center_x - 2*sens_w, this.rect.y + this.offset_y, sens_w, 16)
        this.sensor_switch2 = new Rect(this.center_x +   sens_w, this.rect.y + this.offset_y, sens_w, 16)

        this.sensor_door1 = new Rect(this.rect.left() - 8, this.rect.bottom() - 32, 8, 32)
        this.sensor_door2 = new Rect(this.rect.right() , this.rect.bottom() - 32, 8, 32)

        this.lines = []
        for (let i = 45; i < 360; i+=90) {
            this.lines.push(tangentLine(i, this.radius))
        }
        for (let i = 0; i < 360; i+=30) {
            this.lines.push(tangentLine(i, this.radius))
        }
        this._x_debug_mask()

    }


    _x_debug_mask() {

        let w = this.rect.w
        let h = this.rect.h

        let canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        let ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, w, h)

        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                if (this.collidePoint(this.rect.x + x, this.rect.y + y)) {
                    ctx.fillStyle = ((x+y)%2==0)?"#FF00FF":"#FFFFFF";
                    ctx.beginPath();
                    ctx.rect(x, y, 1, 1);
                    ctx.fill();
                }
            }
        }

        let chunk_image = ctx.getImageData(0, 0, canvas.width, canvas.height)

        this._x_mask = null
        createImageBitmap(chunk_image)
            .then(image => {
                this._x_mask = image
            })
            .catch(err => {
                console.error(err)
            })


    }

    isSolid(other) {
        return true
    }

    collidePoint(x, y) {
        // check point is not within circle
        if (!this.rect.collidePoint(x, y)) {
            return false
        }

        let check_x, check_y, check_r

        check_y = y <= this.center_y
        check_x = (this.object_state[0]==1)?x > this.center_x:x < this.center_x

        if (false) {
            let dx = x - this.center_x;
            let dy = y - this.center_y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            check_r = (distance > this.radius)
        } else {
            let px = x - this.center_x
            let py = y - this.center_y

            let oob = false
            for (let i=0; i < this.lines.length; i++) {
                let line = this.lines[i]
                if (line.m == null) {
                    if (line.degrees == 0 && px > line.x) {
                        oob = true
                        break;
                    }
                    if (line.degrees == 180 && px < line.x) {
                        oob = true
                        break;
                    }
                } else {
                    let y = line.m * px + line.b
                    if (line.degrees < 180 && py > y) {
                        oob = true
                        break;
                    }
                    if (line.degrees >= 180 && py < y) {
                        oob = true
                        break;
                    }
                }
            }
            check_r = oob
        }
        return check_r  && (check_y || check_x) 
    }


    static paint_loop(ctx, tile, x, y, w, h, cx, cy, radius) {
        // draw a circle, 128 px in diameter
        ctx.save()
        
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI, true)
        ctx.closePath()
        ctx.clip()

        for (let i = 0; i < w; i+=16) {
            for (let j = 0; j < h; j+=16) {
                tile.draw(ctx, x + i, y + j)
            }
        }

        ctx.beginPath()
        ctx.lineWidth=2
        ctx.strokeStyle = 'black'
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI, true)
        ctx.stroke()

        // use composition moves to darken part of the screen
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(x, y + h/2, w/2, h/2)

        ctx.restore()
    }
    
    paint(ctx) {

        Loop.paint_loop(ctx, this.dirt, this.rect.x, this.rect.y, this.rect.w, this.rect.h, this.center_x, this.center_y, this.radius)

        //let image = this._x_mask
        //if (!!image) {
        //    ctx.drawImage(image, this.rect.x, this.rect.y)
        //}

        if (false) {
            

            // paint sensors
            ctx.beginPath()
            ctx.fillStyle = 'red';
            ctx.rect(this.sensor_switch1.x, this.sensor_switch1.y, this.sensor_switch1.w, this.sensor_switch1.h)
            ctx.rect(this.sensor_door2.x, this.sensor_door2.y, this.sensor_door2.w, this.sensor_door2.h)
            ctx.fill()

            ctx.beginPath()
            ctx.fillStyle = 'blue';
            ctx.rect(this.sensor_door1.x, this.sensor_door1.y, this.sensor_door1.w, this.sensor_door1.h)
            ctx.rect(this.sensor_switch2.x, this.sensor_switch2.y, this.sensor_switch2.w, this.sensor_switch2.h)
            ctx.fill()
            
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 1
            for (let i=0; i < this.lines.length; i++) {
                let line = this.lines[i]

                let x1,y1,x2,y2

                if (line.m == null) {
                    y1 = line.y - 32
                    y2 = line.y + 32
                    x1 = line.x
                    x2 = line.x
                } else {
                    x1 = line.x - 32
                    x2 = line.x + 32
                    y1 = line.m * x1 + line.b
                    y2 = line.m * x2 + line.b
                    
                }
                ctx.beginPath()
                ctx.moveTo(this.center_x + x1, this.center_y + y1)
                ctx.lineTo(this.center_x + x2, this.center_y + y2)
                ctx.stroke()
            }

            ctx.beginPath()
            ctx.moveTo(this.center_x, this.center_y)
            ctx.lineTo(this.center_x, this.center_y + this.radius)
            ctx.stroke()
        }

        


    

    }

    update(dt) {

        // check if the player collides with a sensor
        
        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        let player = objs[0]
        if (objs.length > 0) {

            let is_standing = player.physics.standing_frame >= (player.physics.frame_index - 6)

            if (this.sensor_switch1.collideRect(player.rect)) {
                if (is_standing && this.object_state[0] != 2) {
                    this.object_state[0] = 2
                    this._x_debug_mask()
                    console.log("trigger switch 1")
                }
            }
            if (this.sensor_switch2.collideRect(player.rect)) {
                if (is_standing && this.object_state[0] != 1) {
                    this.object_state[0] = 1
                    this._x_debug_mask()
                    console.log("trigger switch 2")
                }
            }
            if (this.sensor_door1.collideRect(player.rect)) {
                if (this.object_state[0] != 1) {
                    this.object_state[0] = 1
                    this._x_debug_mask()
                }
            }
            if (this.sensor_door2.collideRect(player.rect)) {
                if (this.object_state[0] != 2) {
                    this.object_state[0] = 2
                    this._x_debug_mask()
                }
            }
        }

        
    }

}

registerEditorEntity("Loop", Loop, [128,128], EntityCategory.switches, null, (entry)=> {
    entry.icon = gAssets.sheets.hazard_icons.tile(0)
    entry.editorIcon = null
    entry.editorSchema = [
    ]
    entry.editorRender = (ctx, x, y, props) => {
        let tile = gAssets.themes[gAssets.mapinfo.theme][1].tile(33)
        Loop.paint_loop(ctx, tile, x, y, 128, 128, x + 64, y + 64 + 8, 64)
    }

})