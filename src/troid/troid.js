 
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

$import("scenes", {LevelLoaderScene, LevelEditScene})
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

            const edit = true
            gEngine.scene = new LevelLoaderScene(gAssets.mapinfo.mapid, edit, ()=>{
                gEngine.scene = new LevelEditScene()
            })
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

export default class Application extends ApplicationBase {
    constructor() {

        const query = daedalus.util.parseParameters()

        super({
            portrait: 0,
            fullscreen: 0,
            screen_width: 12*32,
            screen_height: 7*32
        }, () => {

            const edit = false
            const mapid = "map-20231031-211926"

            // hack to avoid importing the main scene in the editor
            LevelLoaderScene.scenes = {main: MainScene, edit:LevelEditScene}

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