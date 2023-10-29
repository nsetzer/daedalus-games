 
// stages should be 15 screens wide (15*12*32 = 5760 pixels)
// at 150 pixels per second, a flat run would clear a stage in 5760/150 ~ 38.4 seconds

// as for objects
// every map needs a spawn point and an exit point
// spawn:
//   warp pipe (player jumps out of it)
//   secret entrance (from some other maps secret exit)
// exit point
//   flag pole
//   secret exit (goes to a target maps secret entrance or default spawn)
// doors
//   up to N doors each named A,B,C
//   like a secret exit/entrance pair. doors warp to the corresponding named
//   door of another map.
// when using the map editor: all exits kick you back to the editor
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

$import("scenes", {ResourceLoaderScene, LevelLoaderScene})
$import("store", {MapInfo, gAssets})

$import("tiles", {TileShape, TileProperty, updateTile, paintTile})
$import("entities", {Player})
$import("maps", {PlatformMap})

class CspController {
    constructor(map) {

        this.map = map
        this.player = null

    }

    getPlayer() {
        if (this.player === null) {
            for (const obj of Object.values(this.map.map.objects)) {
                if (!!obj.playerId && obj.playerId=="player") {
                    this.player = obj
                    break
                }
            }
        }
        return this.player
    }

    setInputDirection(whlid, vector){
        if (whlid == 0) {
            const player = this.getPlayer()
            if (!player) {
                console.log("player not found")
                return
            }
            player.ownedByClient = true
            //debug(`world_step: ${this.map_player1.world_step} local_step: ${this.map_player1.map.local_step}` + \
            //    " client input event");
            this.map.map.sendObjectInputEvent(player.entid, {whlid, vector})
        }
    }

    handleButtonPress(btnid){

        const player = this.getPlayer()
        if (!player) {
            console.log("player not found")
            return
        }
        player.ownedByClient = true
        this.map.map.sendObjectInputEvent(player.entid, {btnid, pressed: true})

    }

    handleButtonRelease(btnid){

        if (btnid == 3) {
            gEngine.scene = new LevelEditScene()
            return
        }

        const player = this.getPlayer()
        if (!player) {
            console.log("player not found")
            return
        }
        player.ownedByClient = true
        this.map.map.sendObjectInputEvent(player.entid, {btnid, pressed: false})

    }
}

function random_choice(choices) {
  var index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

class CameraBase {

    constructor() {
        this.dirty = true

    }

    resize() {

    }

    update(dt) {

    }

    activeRegion() {
        return new Rect(0,0,0,0)
    }
}

class Camera extends CameraBase {
    constructor(map, target) {
        super()
        this.map = map
        this.target = target

        this.x = 0;
        this.y = 0;
        this.width = gEngine.view.width
        this.height = gEngine.view.height

        this.active_border = new Rect(0,0,0,0)
        this.active_region = new Rect(0,0,0,0)

        this.tile_position = {x:-1024, y:-1024}
        this.dirty = true

        //margin of 4 tiles in the direction the target is facing
        //and 2 tiles in all other directions
    }

    setTarget(target) {
        this.target = target
    }

    resize() {
        this.width = gEngine.view.width
        this.height = gEngine.view.height
    }

    update(dt) {

        if (!this.target) {
            return
        }

        //let wnd = new Rect(
        //    Math.floor(this.target.rect.x-32-8),
        //    Math.floor(this.target.rect.y-32-16),
        //    3*32,
        //    3*32)
        //let v = Direction.vector(this.target.facing)
        //if (v.x < 0) { wnd.x -= 32; wnd.w += 32 }
        //if (v.x > 0) { wnd.w += 32 }
        //if (v.y < 0) { wnd.y -= 32; wnd.h += 32 }
        //if (v.y > 0) { wnd.h += 32 }
        let xborder1 = Math.floor(gEngine.view.width/4)
        let xborder2 = Math.floor(gEngine.view.width/4)
        let yborder1 = Math.floor(gEngine.view.height/4)
        let yborder2 = Math.floor(gEngine.view.height/4)
        let wnd = new Rect(
            this.x + xborder1,
            this.y + yborder1,
            this.width - xborder1 - xborder2,
            this.height - yborder1 - yborder2)
        //console.log(wnd, this.width, this.height)
        this.active_border = wnd

        let x,y;

        let tcx = this.target.rect.cx()
        let tcy = this.target.rect.cy()

        if (tcx < wnd.left()) {
            x = tcx - xborder1
        }
        else if (tcx > wnd.right()) {
            x = tcx + xborder2 - this.width
        } else {
            x = this.x
        }

        if (tcy < wnd.top()) {
            y = tcy - yborder1
        }
        else if (tcy > wnd.bottom()) {
            y = tcy + yborder2 - this.height
        } else {
            y = this.y
        }
        // force camera to center player
        //x = Math.floor(this.target.rect.cx() - gEngine.view.width/2)
        //y = Math.floor(this.target.rect.cy() - gEngine.view.height/2)
        // allow the camera to display outside of the map
        // so that the character is never under the inputs
        let input_border = 192
        if (x < -input_border) { x = -input_border}
        //if (y < -32) { y = -32 }

        let mx = Physics2dPlatform.maprect.w - gEngine.view.width + input_border
        let my = Physics2dPlatform.maprect.h - gEngine.view.height
        if (x > mx) { x = mx }
        if (y > my) { y = my }

        this.x = Math.floor(x)
        this.y = Math.floor(y)

        let tx = Math.floor((this.x-32)/32)
        let ty = Math.floor((this.y-32)/32)

        this.active_region = new Rect(
            tx*32,
            ty*32,
            this.width + 64,
            this.height + 64)

        this.dirty = this.dirty || (this.tile_position.x != tx || this.tile_position.y != ty)

        this.tile_position = {x:tx, y:ty}

    }

    activeRegion() {
        return this.active_region
    }
}

class MainScene extends GameScene {

    constructor(loader) {
        super()

        this.loader = loader

        this.map = new ClientCspMap(gAssets.map)
        // hack for single player game
        this.map.world_step = 0
        this.map.setPlayerId("player")
        this.map.map.instanceId = "player1"

        this.controller = new CspController(this.map);

        this.touch = new TouchInput(this.controller)
        this.keyboard = new KeyboardInput(this.controller)

        this.touch.addWheel(64, -64, 48, {
            align: Alignment.LEFT|Alignment.BOTTOM,
            //symbols: ["W", "D", "S", "A"],
        })
        this.touch.addButton(120, -40, 32, {})
        this.touch.addButton(40, -120, 32, {})
        this.touch.addButton(40, -40, 32, {})
        this.touch.addButton(24, 24, 20, {
            align: Alignment.RIGHT|Alignment.TOP,
            style: 'rect',
        })

        this.keyboard.addWheel_ArrowKeys()
        //this.keyboard.addButton(KeyboardInput.Keys.CTRL)
        //this.keyboard.addButton(KeyboardInput.Keys.SPACE)

        this.keyboard.addButton(90) // Z
        this.keyboard.addButton(88) // X
        this.keyboard.addButton(67) // C
        this.keyboard.addButton(27) // ESC

        this.camera = new Camera(this.map.map, this.map.map._x_player)
    }

    pause(paused) {
    }

    update(dt) {
        this.map.update(dt)
        this.camera.update(dt)
    }

    _paint_status(ctx) {
        const barHeight = 24

        ctx.beginPath()
        ctx.fillStyle = "black";
        ctx.rect(0,0, gEngine.view.width, barHeight)
        ctx.fill()

        ctx.beginPath();
        ctx.strokeStyle = "gold";
        ctx.lineWidth = 3;
        ctx.rect(gEngine.view.width/2 - 18, barHeight/2 - 9, 18, 18);
        ctx.stroke();

        for (let i=0; i < 3; i++) {
            ctx.beginPath();
            ctx.fillStyle = "pink";
            ctx.strokeStyle = "purple";
            ctx.lineWidth = 2;
            ctx.rect(12 + 24*i, barHeight/2 - 6, 12, 12);
            ctx.fill();
            ctx.stroke();
        }

    }
    paint(ctx) {

        // screen boundary
        ctx.lineWidth = 1;
        ctx.beginPath()
        ctx.fillStyle = "#477ed6";
        ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        ctx.fill()

        ctx.save()

        // camera
        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -this.camera.y)

        // blue sky background
        ctx.beginPath()
        ctx.fillStyle = "#477ed6";
        ctx.rect(0,0, gAssets.mapinfo.width, gAssets.mapinfo.height)
        ctx.closePath()
        ctx.fill()

        // gutter
        ctx.beginPath()
        ctx.fillStyle = "#FF0000";
        ctx.rect(0,-64, gAssets.mapinfo.width, 64)
        ctx.closePath()
        ctx.fill()

        // paint chunks
        let tx = Math.floor(this.camera.x / 16 / 4)
        let ty = Math.floor(this.camera.y / 16 / 7)

        // the map is 6 chunks wide and 1 chunk tall
        for (let i = 0; i < 8; i++) {

            let cx = tx + i

            if (cx < 0) {
                continue;
            }

            if (cx >= 127) {
                break;
            }

            for (let j = 0; j < 3; j++) {

                let cy = ty + j

                if (cy < 0) {
                    continue;
                }

                if (cy >= 127) {
                    break;
                }

                let chunkid = cy * 128 + cx

                let chunk = gAssets.mapinfo.chunks[chunkid]

                if (!!chunk) {
                    ctx.drawImage(chunk.image, chunk.x*16, chunk.y*16)
                }

            }
        }

        this.map.paint(ctx)

        ctx.restore()

        this._paint_status(ctx)
        this.touch.paint(ctx)

        ctx.font = "bold 16px";
        ctx.fillStyle = "black"
        ctx.strokeStyle = "black"
        ctx.textAlign = "left"
        ctx.textBaseline = "bottom"




        //ctx.fillText(`${gEngine.view.availWidth}x${gEngine.view.availHeight}`, 8, 8);
        ctx.fillText(`${gEngine.view.width}x${gEngine.view.height} (${gEngine.view.scale}) (${Math.floor(this.camera.x/16)},${Math.floor(this.camera.y/16)}` , 8, gEngine.view.height);

    }

    resize() {

        this.touch.resize()
    }

    handleTouches(touches) {
        touches = this.touch.handleTouches(touches)
        //gEngine.setFullScreen(true)
    }

    handleKeyPress(keyevent) {
        this.keyboard.handleKeyPress(keyevent);
    }

    handleKeyRelease(keyevent) {
        this.keyboard.handleKeyRelease(keyevent);

    }
}

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

        this.parent.editor_icons.brush.draw(ctx, x, y)

        y += 24
        this.parent.editor_icons.brush.draw(ctx, x, y)

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
                    this.parent.active_tool = 3
                } else {
                    this.parent.active_tool = 1
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

        if (this.parent.active_tool == 3) {
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

class LevelEditScene extends GameScene {

    // TODO: optimize: only do a full paint if something changed
    //       change the engine to not clear on every frame
    //       scene is still 60fps. but there are no animations

    constructor(loader) {
        super()

        this.camera = {x:-48, y:-48, scale:2}
        this.map = {
            width: 15*32,
            height: 9*32,
            layers: [{}]
        }

        this.theme_sheets = [null, gAssets.sheets.zone_01_sheet_01]

        this.theme_sheets_icon = [null, gAssets.sheets.zone_01_sheet_01.tile(0)]

        this.editor_icons = {
            "pencil": gAssets.sheets.editor.tile(0),
            "erase": gAssets.sheets.editor.tile(1),
            "zoom_in": gAssets.sheets.editor.tile(2),
            "zoom_out": gAssets.sheets.editor.tile(3),
            "brush": gAssets.sheets.editor.tile(5),
        }

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
        this.active_tool = 1 // 1: paint 2: erase, 3: select?

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

            if (i == 3 && (this.active_tool==1 || this.active_tool==3)) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }
            if (i == 4 && this.active_tool==2) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }
        }

        this.editor_icons.pencil.draw(ctx, 6+24*0+1, y+1)
        this.editor_icons.pencil.draw(ctx, 6+24*1+1, y+1)
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

        if (this.active_tool == 3) {


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

        this._paint_grid(ctx)

        //ctx.beginPath()
        //ctx.fillStyle = "yellow"
        //ctx.rect(0,0,16,16)
        //ctx.fill()

        ctx.restore()

        if (!!this.active_menu) {
            this.active_menu.paint(ctx)
        }

        this._paint_header(ctx)

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        ////let text = `${-this.ygutter}, ${-Math.ceil(this.camera.y/16)*16}`
        //let text = `${Math.floor(this.camera.x)}, ${Math.floor(this.camera.y)}`
        //ctx.fillText(text, 8, 8);
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

    placeTile(x, y) {

        const tid = (y + 4)*512+x
        if (tid === this.previous_tid) {
            return
        }
        this.previous_tid = tid

        if (!!this.map.layers[0][tid]) {

            // erase the tile
            if (this.active_tool == 2) {
                delete this.map.layers[0][tid]
                return
            }

            if (this.active_tool == 3) {
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

        // if not painting exit
        if (this.active_tool != 1) {
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

        const map = {
            width: this.map.width,
            height: this.map.height,
            theme: 0,
            layers: [tiles0]
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
                    if (ix == 3) {
                        this.active_tool = 1
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
                        this.active_tool = 2
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


                } else {

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
                    if (t.pressed) {
                        if (t.y >= -this.ygutter/16 && t.x >= 0 && t.x < this.map.width/16 && t.y < this.map.height/16) {
                            this.placeTile(t.x, t.y)
                        }
                    } else {
                        this.previous_tid = -1
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

export default class Application extends ApplicationBase {
    constructor() {

        const query = daedalus.util.parseParameters()

        super({
            portrait: 0,
            fullscreen: 0,
            screen_width: 12*32,
            screen_height: 7*32
        }, () => {

            const edit = true
            const mapid = "map-20231029-155050"
            return new LevelLoaderScene(mapid, edit, ()=>{

                if (edit) {
                    gEngine.scene = new LevelEditScene()
                } else {
                    gEngine.scene = new MainScene()
                }

                console.log("done!")
            })
        })
    }
}