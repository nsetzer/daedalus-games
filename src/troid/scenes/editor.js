 
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("store", {MapInfo, gAssets})

$import("tiles", {TileShape, TileProperty, updateTile, paintTile})
$import("entities", {Player})
$import("maps", {PlatformMap})

function random_choice(choices) {
  var index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

const EditorTool = {}
EditorTool.PLACE_TILE = 1
EditorTool.ERASE_TILE = 2
EditorTool.PAINT_TILE = 3
EditorTool.SELECT_TILE = 4
EditorTool.PLACE_OBJECT = 5
EditorTool.ERASE_OBJECT = 6


class FileMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 1, 8 + 24 * 2)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            let tx = Math.floor((t.x -  8) / 24)
            let ty = Math.floor((t.y - 32) / 24)

            if (tx < 0) {
                return
            }

            if (tx == 0 && ty == 0) {

                this.parent.saveAs()
            }
        }
    }

    paint(ctx) {
        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"

        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()

        let x = 8
        let y = 32

        this.parent.editor_icons.save.draw(ctx, x, y)

        y += 24
        this.parent.editor_icons.load.draw(ctx, x, y)

    }
}

class TileMenu {

    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 6, 8 + 24 * 3)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }



            let tx = Math.floor((t.x -  8) / 24)
            let ty = Math.floor((t.y - 32) / 24)

            if (tx < 0) {
                return
            }

            if (ty == 0) {
                if (tx < 6) {
                    this.parent.tile_property = 1 + tx
                    console.log("set prop", 1 + tx)
                    if (this.parent.tile_property > 4) {
                        this.parent.tile_shape = 1
                    }
                    if (this.parent.tile_property > 4) {
                        this.parent.tile_sheet = 1
                    }

                }
            }

            else if (ty == 1) {
                if (tx < 4) {
                    if (this.parent.tile_property <= 4) {
                        this.parent.tile_shape = 1 + tx
                        console.log("set shape", 1 + tx)
                    }
                }

                if (tx == 4) {
                    this.parent.active_tool = EditorTool.PAINT_TILE
                } else {
                    this.parent.active_tool = EditorTool.PLACE_TILE
                }
            }

            else if (ty == 2) {
                if (tx < this.parent.theme_sheets.length - 1) {
                    if (this.parent.tile_property <= 4) {
                        this.parent.tile_sheet = 1 + tx
                        console.log("set sheet", 1 + tx)
                    }
                }
            }
        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"

        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill()

        let points,x,y;
        ctx.fillStyle = "#000000"
        ctx.strokeStyle = "#000000"

        // ---------------------------------------------------------------
        // Row 1 Style
        x = 8
        y = 32

        let k = (this.parent.tile_property - 1)
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()

        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // not solid
        x += 24
        ctx.save()
        ctx.strokeStyle = "#000000"
        ctx.fillStyle = "#7f7f7f"
        ctx.beginPath();
        ctx.setLineDash([4]);
        ctx.rect(x,y,16,16)
        ctx.strokeRect(x,y,16,16)
        ctx.fill()
        ctx.restore()

        // one way
        x += 24
        ctx.save()
        ctx.strokeStyle = "#000000"
        ctx.fillStyle = "#d66d47"
        ctx.beginPath();
        ctx.setLineDash([4]);
        ctx.rect(x,y,16,16)
        ctx.strokeRect(x,y,16,16)
        ctx.fill()
        ctx.restore()

        // ice
        x += 24
        ctx.fillStyle = "#36c6e3"
        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // water
        x += 24
        ctx.fillStyle = "#364de3"
        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // lava
        x += 24
        ctx.fillStyle = "#e33c36"
        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // ---------------------------------------------------------------
        // Row 2 Shape
        ctx.fillStyle = "#000000"
        x = 8
        y = 32 + 24

        if (this.parent.active_tool == EditorTool.PAINT_TILE) {
            k = 4
        } else {
            k = (this.parent.tile_shape - 1)
        }
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()


        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        if (this.parent.tile_property <= 4) {
            x += 24
            points = this.parent.slopes_half[Direction.UPRIGHT]
            ctx.beginPath();
            ctx.moveTo(x + points[0].x, y + points[0].y);
            points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
            ctx.fill()

            x += 24
            points = this.parent.slopes_onethird[Direction.UPRIGHT]
            ctx.beginPath();
            ctx.moveTo(x + points[0].x, y + points[0].y);
            points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
            ctx.fill()

            x += 24
            points = this.parent.slopes_twothird[Direction.UPRIGHT]
            ctx.beginPath();
            ctx.moveTo(x + points[0].x, y + points[0].y);
            points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
            ctx.fill()
        }

        x = 8 + 4*24
        this.parent.editor_icons.brush.draw(ctx, x, y)
        //points = this.parent.slopes_twothird[Direction.UPRIGHT]
        //ctx.beginPath();
        //ctx.moveTo(x + points[0].x, y + points[0].y);
        //points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
        //ctx.fill()

        // ---------------------------------------------------------------
        // Row 3 Tile Set

        x = 8
        y = 32 + 24 + 24


        k = (this.parent.tile_sheet - 1)
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()

        this.parent.theme_sheets_icon.slice(1).forEach(t => {
            t.draw(ctx, x,y)
            x += 24
        })

    }
}

class SettingsMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 5, 8 + 24 * 3)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }
        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"

        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h,8)
        ctx.fill()


        let x = 8
        let y = 32

        //let k = (this.parent.tile_property - 1)
        //ctx.beginPath();
        //ctx.strokeStyle = "gold"
        //ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        //ctx.stroke()
        ctx.fillStyle = "#0000FF"

        for (let j=0; j < 3; j++) {

            x = 8 + 24*2

            for (let i=0; i < 3; i++) {
                ctx.beginPath()
                ctx.rect(x,y,16,16)
                ctx.closePath()
                ctx.fill()
                x += 24
            }

            y += 24
        }

    }

}

class ObjectMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 6, 8 + 24 * 5)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            let tx = Math.floor((t.x -  8) / 24)
            let ty = Math.floor((t.y - 32) / 24)

            if (tx < 0) {
                return
            }

            if (tx > 0) {
                tx -= 1
                let n = ty * 4 + tx

                if (n < this.parent.object_pages[this.parent.objmenu_current_page].objects.length) {
                    this.parent.objmenu_current_object = n
                }

            }

        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"

        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h,8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        ctx.beginPath();
        ctx.moveTo(8+18+2,this.rect.y)
        ctx.lineTo(8+18+2,this.rect.y + this.rect.h)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        let x = 8
        let y = 32



        ctx.fillStyle = "#0000FF"

        // headers
        x = 8
        y = 32
        for (let j=0; j < 3; j++) {

            if (this.parent.objmenu_current_page == j) {
                ctx.beginPath()
                ctx.strokeStyle = "gold"
                ctx.roundRect(x-2,y-2,16+4,16+4, 4)
                ctx.closePath()
                ctx.stroke()
            }

            ctx.beginPath()
            ctx.rect(x,y,16,16)
            ctx.closePath()
            ctx.fill()
            y += 24
        }

        // header scroll
        x = 8
        y = 32 + 24*3
        this.parent.editor_icons.arrow_up.draw(ctx, x,y)
        y += 24
        this.parent.editor_icons.arrow_down.draw(ctx, x,y)

        // object info
        x = 8
        y = 32

        let n = 0;
        for (let j=0; j < 5; j++) {

            x = 8 + 24

            for (let i=0; i < 4; i++) {

                if (n >= this.parent.object_pages[this.parent.objmenu_current_page].objects.length) {
                    break
                }

                if (n == this.parent.objmenu_current_object) {
                    ctx.beginPath()
                    ctx.strokeStyle = "gold"
                    ctx.roundRect(x-2,y-2,16+4,16+4, 4)
                    ctx.closePath()
                    ctx.stroke()
                }

                ctx.beginPath()
                ctx.rect(x,y,16,16)
                ctx.closePath()
                ctx.fill()
                x += 24
                n += 1
            }

            y += 24
        }

        // object scroll
        x = 8 + 24*5
        y = 32
        this.parent.editor_icons.arrow_up.draw(ctx, x,y)

        y += 24 * 4
        this.parent.editor_icons.arrow_down.draw(ctx, x,y)


    }

}

export class LevelEditScene extends GameScene {

    // TODO: optimize: only do a full paint if something changed
    //       change the engine to not clear on every frame
    //       scene is still 60fps. but there are no animations

    constructor(loader) {
        super()

        this.camera = {x:-48, y:-48, scale:2}
        this.map = {
            width: 15*32,
            height: 9*32,
            layers: [{}],
            objects: {}
        }

        gAssets.mapinfo.objects.forEach(obj => {
            if (!this.map.objects[obj.oid]) {
                this.map.objects[obj.oid] = obj
            }
        })

        this.theme_sheets = [null, gAssets.sheets.zone_01_sheet_01]

        this.theme_sheets_icon = [null, gAssets.sheets.zone_01_sheet_01.tile(0)]

        this.editor_icons = {
            "pencil": gAssets.sheets.editor.tile(0),
            "erase": gAssets.sheets.editor.tile(1),
            "zoom_in": gAssets.sheets.editor.tile(2),
            "zoom_out": gAssets.sheets.editor.tile(3),
            "brush": gAssets.sheets.editor.tile(5),
            "arrow_up": gAssets.sheets.editor.tile(6),
            "arrow_down": gAssets.sheets.editor.tile(7),

            "save": gAssets.sheets.editor.tile(1*8+0),
            "load": gAssets.sheets.editor.tile(1*8+1),
            "trash": gAssets.sheets.editor.tile(1*8+2),
            "gear": gAssets.sheets.editor.tile(1*8+3),
        }

        this.object_pages = [

            {
                icon: gAssets.sheets.editor.tile(1),
                objects: [
                    {name: "brick"},
                    {name: "coin"},
                    {name: "monster"},
                ]
            },
        ]
        this.objmenu_current_page = 0
        this.objmenu_current_object = 0
        this.objmenu_page_scroll_index = 0
        this.objmenu_object_scroll_index = 0

        this._init_slopes()

        const mapinfo = gAssets.mapinfo

        this.map.width = mapinfo.width
        this.map.height = mapinfo.height
        this.map.layers = mapinfo.layers

        //this.map.layers[0] = Object.fromEntries(mapinfo.layers[0].map(x => {
        //    const tid = (x >> 13)&0x3ffff
        //    const shape = (x >> 10) & 0x07
        //    const property = (x >> 7) & 0x07
        //    const sheet = (x >> 4) & 0x07
        //    const direction = x & 0x0F
        //    const tile = {shape, property, sheet, direction}
        //    return [tid, tile]
        //}))

        this.tile_shape = TileShape.FULL // full, half, one third, two third
        this.tile_property = 1 // 1: solid, 2: not solid, 3: ice (solid), 4: water (not solid), 5: lava (not solid)
        this.tile_sheet = 1 // 1: ground, 2: pipes, 3: omake

        this.active_menu = null
        this.active_tool = EditorTool.PLACE_TILE

        this.ygutter = 64
    }

    _init_slopes() {

        const rect = new Rect(0,0,16,16)

        this.slopes_half = {
            [Direction.UPRIGHT]: [
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.right(), y: rect.bottom()},
                {x: rect.left(),  y: rect.top()},
            ],
            [Direction.UPLEFT]: [
                {x: rect.right(), y: rect.bottom()},
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.right(), y: rect.top()},
            ],
            [Direction.DOWNRIGHT]: [
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.bottom()},
            ],
            [Direction.DOWNLEFT]: [
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.bottom()},
            ]
        }

        this.slopes_onethird = {
            [Direction.UPRIGHT]: [
                {x: rect.left(),  y: rect.bottom()}, // origin
                {x: rect.right(), y: rect.bottom()}, //
                {x: rect.left(),  y: rect.cy()},
            ],
            [Direction.UPLEFT]: [
                {x: rect.right(), y: rect.bottom()}, // origin
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.right(), y: rect.cy()},
            ],
            [Direction.DOWNRIGHT]: [
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.cy()},
            ],
            [Direction.DOWNLEFT]: [
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.cy()},
            ]
        }

        this.slopes_twothird = {
            [Direction.UPRIGHT]: [
                {x: rect.left(),  y: rect.bottom()}, // origin
                {x: rect.right(),  y: rect.bottom()},
                {x: rect.right(),  y: rect.cy()},
                {x: rect.left(), y: rect.top()},
            ],
            [Direction.UPLEFT]: [
                {x: rect.right(), y: rect.bottom()}, // origin
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.left(),  y: rect.cy()},
                {x: rect.right(), y: rect.top()},
            ],
            [Direction.DOWNRIGHT]: [
                {x: rect.left(),  y: rect.top()}, // origin
                {x: rect.right(), y: rect.top()},
                {x: rect.right(), y: rect.cy()},
                {x: rect.left(),  y: rect.bottom()},
            ],
            [Direction.DOWNLEFT]: [
                {x: rect.right(), y: rect.top()}, // origin
                {x: rect.left(),  y: rect.top()},
                {x: rect.left(), y: rect.cy()},
                {x: rect.right(), y: rect.bottom()},
            ]
        }

    }

    pause(paused) {

    }

    update(dt) {

    }

    _paint_header(ctx) {
        const barHeight = 24

        ctx.beginPath()
        ctx.fillStyle = "black";
        ctx.rect(0,0, gEngine.view.width, barHeight)
        ctx.fill()

        // tile editor / object editor switch

        // tile picker / object picker
        //      how to pick solid? ice? lava? water?
        //      dialog pick
        //          (solid, ice, lava, water)
        //      which constrains the set of tiles to select
        //          (full, half, onethird, twothird)
        // erase

        const y = barHeight/2 - 9

        for (let i=0; i < 7; i++) {
            ctx.beginPath();
            ctx.fillStyle = "#00FF00"
            ctx.rect(6 + 24*i, barHeight/2 - 9, 18, 18);
            ctx.closePath();
            ctx.fill();

            if (i == 2 && this.active_tool==EditorTool.PLACE_OBJECT) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }

            if (i == 3 && (this.active_tool==EditorTool.PAINT_TILE || this.active_tool== EditorTool.PLACE_TILE)) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }
            if (i == 4 && this.active_tool==EditorTool.ERASE_TILE) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }
        }

        this.editor_icons.save.draw(ctx, 6+24*0+1, y+1)
        this.editor_icons.gear.draw(ctx, 6+24*1+1, y+1)
        this.editor_icons.erase.draw(ctx, 6+24*4+1, y+1)
        this.editor_icons.zoom_out.draw(ctx, 6+24*5+1, y+1)
        this.editor_icons.zoom_in.draw(ctx, 6+24*6+1, y+1)

        let points;
        switch (this.tile_shape) {
        case TileShape.HALF:
            points = this.slopes_half[Direction.UPRIGHT]
            break
        case TileShape.ONETHIRD:
            points = this.slopes_onethird[Direction.UPRIGHT]
            break
        case TileShape.TWOTHIRD:
            points = this.slopes_twothird[Direction.UPRIGHT]
            break
        default:
            break
        }

        if (this.active_tool == EditorTool.PAINT_TILE) {


            this.editor_icons.brush.draw(ctx, 6 + 24*3 + 1, y + 1)
        } else {
            const tile = {
                shape: this.tile_shape,
                property: this.tile_property,
                sheet: this.tile_sheet,
                direction: Direction.UPRIGHT,
                points: points,
            }
            paintTile(ctx, 6 + 24*3 + 1, y + 1, tile)
        }

    }

    _paint_grid(ctx) {
        ctx.strokeStyle = "#22222233";
        ctx.stroke.lineWidth = 1;

        let gs = 16
        const sw = gEngine.view.width * this.camera.scale
        const sh = gEngine.view.height * this.camera.scale

        // correct scaling to start drawing at first pixel in display
        let x1 = Math.floor((this.camera.x*this.camera.scale)/gs)*gs
        x1 = Math.max(0, x1)
        let y1 = Math.floor((this.camera.y*this.camera.scale)/gs)*gs
        y1 = Math.max(-this.ygutter, y1)

        let x2 = Math.min(x1 + sw, this.map.width)
        let y2 = Math.min(y1 + sh, this.map.height)

        let p = []
        for (let gx = x1; gx < x2; gx += gs) {
            if (gx%gEngine.view.width==0) {
                ctx.strokeStyle = "#222222aa";
            } else {
                ctx.strokeStyle = "#22222233";
            }
            p.push(gx)
            ctx.beginPath()
            ctx.moveTo(gx, y1)
            ctx.lineTo(gx, y2)
            ctx.stroke()
        }

        for (let gy = y1; gy < y2; gy += gs) {
            if (gy%gEngine.view.height==0) {
                ctx.strokeStyle = "#222222aa";
            } else {
                ctx.strokeStyle = "#22222233";
            }
            ctx.beginPath()
            ctx.moveTo(x1, gy)
            ctx.lineTo(x2, gy)
            ctx.stroke()
        }
    }



    paint(ctx) {

        const barHeight = 24

        ctx.strokeStyle = "#FF00FF";
        ctx.beginPath()
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.stroke()

        ctx.save()
        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -(this.camera.y-barHeight))
        ctx.scale(1/this.camera.scale,1/this.camera.scale);

        ctx.beginPath()
        ctx.fillStyle = "#477ed6";
        ctx.strokeStyle = "#000000";
        //const rw = Math.min(this.camera.x + gEngine.view.width, this.map.width) - this.camera.x
        //const rh = Math.min(this.camera.y + gEngine.view.height, this.map.height) - this.camera.y

        const sw = gEngine.view.width * this.camera.scale
        const sh = gEngine.view.height * this.camera.scale
        let x1 = Math.max(0, this.camera.x)
        let y1 = Math.max(0, this.camera.y)
        let x2 = Math.min(x1 + sw, this.map.width)
        let y2 = Math.min(y1 + sh, this.map.height)

        // draw blue for the background
        ctx.rect(
            x1,
            y1,
            x2 - x1,
            y2 - y1)
        ctx.fill()
        ctx.stroke()

        // draw orange for the -y gutter
        ctx.beginPath()
        x1 = Math.max(0, this.camera.x)
        y1 = -this.ygutter, this.camera.y
        x2 = Math.min(x1 + sw, this.map.width)
        y2 = 0
        ctx.fillStyle = "#d66d47";
        if (y1 < y2) {
            ctx.rect(
                x1,
                y1,
                x2 - x1,
                y2 - y1)
            ctx.fill()
            ctx.stroke()
        }

        // TODO: only draw visible tiles
        for (const [tid, tile] of Object.entries(this.map.layers[0])) {

            let y = 16*Math.floor(tid/512 - 4)
            let x = 16*(tid%512)

            paintTile(ctx, x, y, tile)

        }

        ctx.save()
        ctx.setLineDash([3]);
        for (const [oid, obj] of Object.entries(this.map.objects)) {

            let y = 16*Math.floor(oid/512 - 4)
            let x = 16*(oid%512)

            //let objinfo = this.object_registry[obj.name]

            ctx.beginPath()
            ctx.strokeStyle = "blue"
            ctx.rect(x,y,16,16)
            ctx.closePath()
            ctx.stroke()

        }
        ctx.restore()

        this._paint_grid(ctx)

        //ctx.beginPath()
        //ctx.fillStyle = "yellow"
        //ctx.rect(0,0,16,16)
        //ctx.fill()

        ctx.restore()

        this._paint_header(ctx)

        if (!!this.active_menu) {
            this.active_menu.paint(ctx)
        }

        ctx.font = "bold 16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        //let text = `${-this.ygutter}, ${-Math.ceil(this.camera.y/16)*16}`
        //let text = `${Math.floor(this.camera.x)}, ${Math.floor(this.camera.y)}`
        let text = `n=${this?.num_touches??0}`
        ctx.fillText(text, 8, 24);
    }

    resize() {
    }

    _getTileDirection(x,y) {
        const tid = (y + 4)*512+x
        const ntid_u = ((y + 4-1)*512 + x)
        const ntid_d = ((y + 4+1)*512 + x)
        const ntid_l = ((y + 4)*512 + (x - 1))
        const ntid_r = ((y + 4)*512 + (x + 1))

        const exists_u = !!this.map.layers[0][ntid_u] && this.map.layers[0][ntid_u].property == this.tile_property
        const exists_d = !!this.map.layers[0][ntid_d] && this.map.layers[0][ntid_d].property == this.tile_property
        const exists_l = !!this.map.layers[0][ntid_l] && this.map.layers[0][ntid_l].property == this.tile_property
        const exists_r = !!this.map.layers[0][ntid_r] && this.map.layers[0][ntid_r].property == this.tile_property

        let d1 = Direction.NONE
        if (exists_d && !exists_u) {
            d1 = Direction.UP
        } else if (!exists_d && exists_u) {
            d1 = Direction.DOWN
        } else {
            d1 = random_choice([Direction.UP, Direction.DOWN])
        }

        // if the neighbor that exists is a onethird or twothird
        // and the current shape is of the opposite shape.
        // then this logic below should be inverted

        let d2 = Direction.NONE
        if (exists_l && !exists_r) {
            d2 = Direction.RIGHT
        } else if (!exists_l && exists_r) {
            d2 = Direction.LEFT
        } else {
            d2 = random_choice([Direction.LEFT, Direction.RIGHT])
        }

        let direction = d1|d2

        return direction
    }

    _updateTile(x, y, tile) {
        // return true if the tile was updated.
        // update neighbors
        // loop until no more tiles are changed

        let queue = [[x,y]]

        while (queue.length > 0) {
            let [qx,qy] = queue.shift()
            const tid = (qy + 4)*512+qx

            let delta = false
            if (!!this.map.layers[0][tid]) {
                delta = updateTile(this.map.layers[0], this.map.width, this.map.height, this.theme_sheets, qx, qy, this.map.layers[0][tid])
            }

            if (delta) {
                queue.push([x-1, y])
                queue.push([x+1, y])
                queue.push([x, y-1])
                queue.push([x, y+1])

                queue.push([x-1, y-1])
                queue.push([x+1, y+1])
                queue.push([x+1, y-1])
                queue.push([x+1, y+1])

                queue.push([x-2, y])
                queue.push([x+2, y])
                queue.push([x, y-2])
                queue.push([x, y+2])

            }

        }

    }

    placeObject(x, y) {

        const oid = (y + 4)*512+x
        if (oid === this.previous_oid) {
            return
        }
        this.previous_oid = oid

        if (!this.map.objects[oid]) {

            let obj = this.object_pages[this.objmenu_current_page].objects[this.objmenu_current_object]

            console.log("place", obj)


            this.map.objects[oid] = {
                name: obj.name,
            }
        }

    }

    placeTile(x, y) {

        const tid = (y + 4)*512+x
        if (tid === this.previous_tid) {
            return
        }
        this.previous_tid = tid

        if (!!this.map.layers[0][tid]) {

            // erase the tile
            if (this.active_tool == EditorTool.ERASE_TILE) {
                delete this.map.layers[0][tid]
                return
            }

            if (this.active_tool == EditorTool.PAINT_TILE) {
                this.map.layers[0][tid].property = this.tile_property
                this.map.layers[0][tid].sheet = this.tile_sheet
                return
            }

            // rotate the tile or change the property
            if (this.map.layers[0][tid].shape == this.tile_shape) {

                // tool 3 changes props and sheet only
                const d = [Direction.UPRIGHT,Direction.DOWNRIGHT,Direction.DOWNLEFT,Direction.UPLEFT]
                if (this.tile_shape > 1) {
                    this.map.layers[0][tid].direction = d[(d.indexOf(this.map.layers[0][tid].direction) + 1) % 4]
                }

                this.map.layers[0][tid].property = this.tile_property
                this.map.layers[0][tid].sheet = this.tile_sheet

                this._updateTile(x,y,this.map.layers[0][tid])
                return
            }
        }

        // if not placing exit
        if (this.active_tool != EditorTool.PLACE_TILE) {
            return
        }

        if (this.tile_shape == 1) {
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 2) {
            let direction = this._getTileDirection(x, y)
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                direction: direction,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 3) {
            let direction = this._getTileDirection(x, y)
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                direction: direction,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 4) {
            let direction = this._getTileDirection(x, y)
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                direction: direction,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        }

        this._updateTile(x,y,this.map.layers[0][tid])
    }

    saveAs() {

        // compress each tile into a 32bit integer
        // 1 bit, the sign bit, is unused
        const tiles0 = Object.entries(this.map.layers[0]).map((t) => {
            const [tid, tile] = t
            let x = 0;
            // tid is 18 bits (two 512 bit numbers)
            // shape, property, and sheet are each 3 bits
            // allowing 8 different values. zero is reserved for each
            // direction is 4 bits and optional (square tiles do not use it)
            x |= tid << 13 // position
            x |= tile.shape << 10
            x |= tile.property << 7
            x |= tile.sheet << 4
            x |= tile?.direction??0
            return x
        })

        // use objects with empty names as placeholders, to prevent dragging
        // or creating new objects ontop of other objects. filter these out
        // when saving
        const objects0 = Object.entries(this.map.objects)
            .filter( t => !!t[1].name )
            .map(t => ({oid: t[0], name: t[1].name}))

        const map = {
            width: this.map.width,
            height: this.map.height,
            theme: 0,
            layers: [tiles0],
            objects: objects0
        }

        let date = new Date()
        let y = "" + date.getFullYear()
        let m = "" + (1 + date.getMonth())
        if (m.length < 2) { m = "0"+m; }
        let d = "" + date.getDate()
        if (d.length < 2) { d = "0"+d; }
        let H = "" + date.getHours()
        if (H.length < 2) { H = "0"+H; }
        let M = "" + date.getMinutes()
        if (M.length < 2) { M = "0"+M; }
        let S = "" + date.getSeconds()
        if (S.length < 2) { S = "0"+S; }

        let fname = "map-" + y+m+d+"-"+H+M+S + ".json"

        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(map));
        var downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", fname);
        downloadAnchorNode.setAttribute("target", "_blank");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    handleTouches(touches) {
        if (touches.length > 0) {
            // transform the touch into a tile index
            if (touches[0].y < 24) {
                let t = touches[0]

                // buttons are 18x18 pixels.
                // with 6 pixels between buttons
                //
                let ix = Math.floor((t.x - 6) / 24)
                let iclicked = ((t.x - 6) % 24) < 18

                console.log("menu clicked", ix, iclicked)

                if (!t.pressed) {

                    if (ix == 0) {

                        if (!!this.active_menu) {
                            this.active_menu = null
                        } else {
                            this.active_menu = new FileMenu(this)
                        }
                    }
                    if (ix == 1) {

                        if (!!this.active_menu) {
                            this.active_menu = null
                        } else {
                            this.active_menu = new SettingsMenu(this)
                        }
                    }
                    if (ix == 2) {

                        this.active_tool = EditorTool.PLACE_OBJECT
                        if (!!this.active_menu) {
                            this.active_menu = null
                        } else {
                            this.active_menu = new ObjectMenu(this)
                        }
                    }

                    if (ix == 3) {
                        this.active_tool = EditorTool.PLACE_TILE
                        if (!!this.active_menu) {
                            this.active_menu = null
                        } else {
                            this.active_menu = new TileMenu(this)
                        }
                    }
                    if (ix == 4) {
                        // erase tool
                        // TODO: move this into the tile menu?
                        //       have separate object and tile erase
                        this.active_menu = null
                        this.active_tool = EditorTool.ERASE_TILE
                    }

                    if (ix == 5) {
                        this.active_menu = null
                        if (this.camera.scale < 3) {
                            this.camera.scale += 0.5
                        }
                    }

                    if (ix == 6) {
                        this.active_menu = null
                        if (this.camera.scale > 1.0) {
                            this.camera.scale -= 0.5
                        }
                    }
                }


            } else if (!!this.active_menu) {

                this.active_menu.handleTouches(touches)

            } else {

                // right click or two touches to pan
                // TODO: middle click to toggle zoom?
                // TODO: don't place tiles  on the first click, wait for two touches
                //       disable placing tiles if two touches occur

                // for devices that support multi touch, disable placing tiles when
                // there is more than one touch. wait for the next single touch
                // to re-enable placing tiles
                // this requires placing tiles on release or drag
                if (touches.length > 1) {
                    this.disable_place = true
                }
                if (this.disable_place && touches.length == 1) {
                    if (touches[0].first && touches[0].pressed) {
                        this.disable_place = false
                    }
                }
                this.num_touches = this.disable_place + "|" +touches.map(t=> t.pressed).join()

                // right click or two touches to scroll the screen
                if (touches[0].buttons&2 || touches.length==2) {

                    let t = touches[0]
                    if (touches.length == 2) {
                        t = {
                            x: (touches[0].x + touches[1].x)/2,
                            y: (touches[0].y + touches[1].y)/2,
                            pressed: t.pressed,
                            first: t.first,
                        }
                    }

                    if (t.pressed && t.first) {
                        this.mouse_down = {x:t.x, y:t.y, camerax:this.camera.x, cameray:this.camera.y}
                    } else if (t.pressed) {
                        let dx = (this.mouse_down.x - t.x) // this.camera.scale
                        let dy = (this.mouse_down.y - t.y) // this.camera.scale

                        this.camera.x = this.mouse_down.camerax + dx
                        this.camera.y = this.mouse_down.cameray + dy
                    }


                } else if (!this.disable_place) {

                    if (touches[0].first) {
                        return
                    }

                    let gs = 16 / this.camera.scale
                    touches = touches.map(t => ({
                        x: Math.floor((t.x + this.camera.x) / gs),
                        y: Math.floor((t.y + this.camera.y - 24) / gs),
                        pressed: t.pressed
                    }))


                    // TODO: if two touches pan. use the center between the two touches as the single point
                    //       pinch to zoom. if the distance between two touches shrinks or grows past a threshold
                    //       change the scale to either 1 or 2.
                    const t = touches[0]

                    if (t.y >= -this.ygutter/16 && t.x >= 0 && t.x < this.map.width/16 && t.y < this.map.height/16) {
                        if (this.active_tool === EditorTool.PLACE_OBJECT) {
                            this.placeObject(t.x, t.y)
                        } else {
                            this.placeTile(t.x, t.y)
                        }
                    }

                    if (!t.pressed) {
                        this.previous_tid = -1
                        this.previous_oid = -1
                    }
                }
            }
        }
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {

        if (keyevent.text == 'q') {
            this.camera.scale = (this.camera.scale==1)?2:1
        } else if (keyevent.keyCode == 38) {
            //up
            this.camera.y -= 8
        } else if (keyevent.keyCode == 40) {
            //down
            this.camera.y += 8
        } else if (keyevent.keyCode == 37) {
            //left
            this.camera.x -= 8
        } else if (keyevent.keyCode == 39) {
            //right
            this.camera.x += 8
        } else if (keyevent.text == '1') {
            this.tile_shape = TileShape.FULL
        } else if (keyevent.text == '2') {
            this.tile_shape = TileShape.HALF
        } else if (keyevent.text == '3') {
            this.tile_shape = TileShape.ONETHIRD
        } else if (keyevent.text == '4') {
            this.tile_shape = TileShape.TWOTHIRD
        } else if (keyevent.text == '5') {
            this.tile_shape = -1
        } else if (keyevent.text == 's') {
            this.tile_property = TileProperty.SOLID
        } else {
            console.log(keyevent)
        }
        console.log(this.camera)

    }

}