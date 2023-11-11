 
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
$import("store", {MapInfo, gAssets, gCharacterInfo, WeaponType})

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

            gEngine.scene.screen = new PauseScreen(gEngine.scene)

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

        this.header_height = 24

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

        if (!this.target || !this.target.alive) {
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

        if (y < -this.header_height) {y = -this.header_height}

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

class PauseScreen {

    // todo: keyboard interation
    //       actions indicate tab order
    //       up/down skip to next row
    //       left/right move within a row
    //
    constructor(parent) {
        this.parent = parent


        this.actions = []
        this._buildActions()

    }

    _addAction(x,y,w,h,icon, on_action) {
        this.actions.push({rect: new Rect(x,y,w,h), icon, on_action})
    }

    _buildActions() {

        this.rect1 = new Rect(16, 16*2, 5*24+4, 10*16)
        this.rect2 = new Rect(gEngine.view.width - (this.rect1.x + this.rect1.w), this.rect1.y, this.rect1.w, this.rect1.h)

        let x1 = this.rect1.x + 2 + 2
        let y1 = this.rect1.y + 12 + 6

        const fn_icon = (index, state) => {
            return gAssets.sheets.pause_items.tile((index * 3) + state)
        }


        // power, fire, water, ice, bubble
        this._addAction(x1+0*24, y1, 20, 18, ()=>fn_icon(0,gCharacterInfo.element===WeaponType.ELEMENT.POWER?2:0), ()=>{gCharacterInfo.element = WeaponType.ELEMENT.POWER})
        this._addAction(x1+1*24, y1, 20, 18, ()=>fn_icon(1,gCharacterInfo.element===WeaponType.ELEMENT.FIRE?2:0), ()=>{gCharacterInfo.element = WeaponType.ELEMENT.FIRE})
        this._addAction(x1+2*24, y1, 20, 18, ()=>fn_icon(2,gCharacterInfo.element===WeaponType.ELEMENT.WATER?2:0), ()=>{gCharacterInfo.element = WeaponType.ELEMENT.WATER})
        this._addAction(x1+3*24, y1, 20, 18, ()=>fn_icon(3,gCharacterInfo.element===WeaponType.ELEMENT.ICE?2:0), ()=>{gCharacterInfo.element = WeaponType.ELEMENT.ICE})
        this._addAction(x1+4*24, y1, 20, 18, ()=>fn_icon(4,gCharacterInfo.element===WeaponType.ELEMENT.BUBBLE?2:0), ()=>{gCharacterInfo.element = WeaponType.ELEMENT.BUBBLE})

        // wave beam, normal, bounce beam
        // wave - pass through walls
        // normal - break on contact
        // bounce - bounce off walls (bubbles bounce player)
        this._addAction(x1+1*24, y1+24, 20, 18, ()=>fn_icon(7,gCharacterInfo.beam===WeaponType.BEAM.WAVE?2:0), ()=>{gCharacterInfo.beam = WeaponType.BEAM.WAVE})
        this._addAction(x1+2*24, y1+24, 20, 18, ()=>fn_icon(6,gCharacterInfo.beam===WeaponType.BEAM.NORMAL?2:0), ()=>{gCharacterInfo.beam = WeaponType.BEAM.NORMAL})
        this._addAction(x1+3*24, y1+24, 20, 18, ()=>fn_icon(8,gCharacterInfo.beam===WeaponType.BEAM.BOUNCE?2:0), ()=>{gCharacterInfo.beam = WeaponType.BEAM.BOUNCE})

        // single, double, triple
        // power, ice: 1,2,3 bullets
        // fire, normal: 1,3,5 bullets at 0,22,45 degrees
        // water: wider stream
        // bubble: more
        this._addAction(x1+1*24, y1+48, 20, 18, ()=>fn_icon(10,gCharacterInfo.level===WeaponType.LEVEL.LEVEL1?2:0), ()=>{gCharacterInfo.level=WeaponType.LEVEL.LEVEL1})
        this._addAction(x1+2*24, y1+48, 20, 18, ()=>fn_icon(11,gCharacterInfo.level===WeaponType.LEVEL.LEVEL2?2:0), ()=>{gCharacterInfo.level=WeaponType.LEVEL.LEVEL2})
        this._addAction(x1+3*24, y1+48, 20, 18, ()=>fn_icon(12,gCharacterInfo.level===WeaponType.LEVEL.LEVEL3?2:0), ()=>{gCharacterInfo.level=WeaponType.LEVEL.LEVEL3})

        // charge beam, normal, rapid shot
        // water, charge: larger orbs
        // water, rapid: stream
        this._addAction(x1+1*24, y1+3*24, 20, 18, ()=>fn_icon(15,gCharacterInfo.modifier===WeaponType.MODIFIER.CHARGE?2:0), ()=>{gCharacterInfo.modifier=WeaponType.MODIFIER.CHARGE})
        this._addAction(x1+2*24, y1+3*24, 20, 18, ()=>fn_icon(14,gCharacterInfo.modifier===WeaponType.MODIFIER.NORMAL?2:0), ()=>{gCharacterInfo.modifier=WeaponType.MODIFIER.NORMAL})
        this._addAction(x1+3*24, y1+3*24, 20, 18, ()=>fn_icon(16,gCharacterInfo.modifier===WeaponType.MODIFIER.RAPID ?2:0), ()=>{gCharacterInfo.modifier=WeaponType.MODIFIER.RAPID })

        // missile, super, homing
        this._addAction(x1+1*24, y1+12+4*24, 20, 18, null, ()=>{})
        this._addAction(x1+2*24, y1+12+4*24, 20, 18, null, ()=>{})
        this._addAction(x1+3*24, y1+12+4*24, 20, 18, null, ()=>{})

        let x2 = this.rect2.x + 8
        let y2 = this.rect2.y + 12 + 6

        // suits
        // diving helmet
        this._addAction(x2+1*24, y2, 20, 18, null, ()=>{})
        this._addAction(x2+2*24, y2, 20, 18, null, ()=>{})
        this._addAction(x2+3*24, y2, 20, 18, null, ()=>{})

        // space jump, spin jump
        this._addAction(x2+12+1*24, y2+12+4*24, 20, 18, null, ()=>{})
        this._addAction(x2+12+2*24, y2+12+4*24, 20, 18, null, ()=>{})

        let x3 = gEngine.view.width/2
        let y3 = this.rect2.bottom() + 8
        this._addAction(x3-20, y3, 40, 18, null, ()=>{this.parent.screen = null})
        this._addAction(gEngine.view.width - 8 - 40,  y3, 40, 18, null, ()=>{
            const edit = true
            gEngine.scene = new LevelLoaderScene(gAssets.mapinfo.mapid, edit, ()=>{
                gEngine.scene = new LevelEditScene()
            })

        })

    }

    paint(ctx) {

        let rect0 = new Rect(0, 24, gEngine.view.width, gEngine.view.height-24)
        ctx.lineWidth = 1
        ctx.fillStyle = "#000000dd"
        ctx.beginPath()
        ctx.rect(rect0.x, rect0.y, rect0.w, rect0.h)
        ctx.closePath()
        ctx.fill()

        let x = gEngine.view.width/2 - gAssets.sheets.pause_suit.tw/2
        let y = gEngine.view.height/2 - gAssets.sheets.pause_suit.th/2
        gAssets.sheets.pause_suit.drawTile(ctx, 0, x, y)

        ctx.lineWidth = 1
        ctx.strokeStyle = "#88e810"
        ctx.beginPath()
        ctx.roundRect(this.rect1.x, this.rect1.y, this.rect1.w, this.rect1.h, 8)
        ctx.closePath()
        ctx.stroke()

        ctx.strokeStyle = "#88e810"
        ctx.beginPath()
        ctx.roundRect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h, 8)
        ctx.closePath()
        ctx.stroke()

        ctx.beginPath()
        ctx.fillStyle = "#0000FF"
        this.actions.forEach(act => {
            ctx.rect(act.rect.x, act.rect.y, act.rect.w, act.rect.h)
        })
        ctx.fill()

        this.actions.forEach(act => {
            if (!!act.icon) {
                act.icon().draw(ctx, act.rect.x+2, act.rect.y+1)
            }
        })


    }

    handleTouches(touches) {

        if (touches.length > 0 && !touches[0].pressed) {

            const t = touches[0]
            this.actions.forEach((act,i) => {
                if (act.rect.collidePoint(t.x, t.y)) {
                    act.on_action()
                    console.log("action",i)
                }
            })
        }
    }
    update(dt) {

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
        //this.touch.addButton(240 - 32, -24, 32, {
        //    align: Alignment.LEFT|Alignment.BOTTOM,
        //    style: 'rect',
        //})
        //this.touch.addButton(240 - 32, -24, 32, {
        //    align: Alignment.RIGHT|Alignment.BOTTOM,
        //    style: 'rect',
        //})

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
        this.screen =  null //  new PauseScreen(this)

    }

    pause(paused) {
    }

    update(dt) {
        this.map.update(dt)
        this.camera.update(dt)

        if (!this.map.map._x_player.alive) {
            if (this.map.map._x_player.rect.y - 32 > this.camera.y + gEngine.view.height) {
                this.map.map._x_player._revive()
            }
        }
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
        //ctx.lineWidth = 1;
        //ctx.beginPath()
        //ctx.fillStyle = "#477ed6";
        //ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        //ctx.fill()

        ctx.save()

        // camera
        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -this.camera.y)

        // blue sky background
        // this rect defines the visible region of the game world
        ctx.beginPath()
        ctx.fillStyle = "#477ed6";
        ctx.rect(
            Math.max(0, this.camera.x),
            Math.max(0, this.camera.y),
            Math.min(gAssets.mapinfo.width - this.camera.x, gEngine.view.width),
            Math.min(gAssets.mapinfo.height - this.camera.y, gEngine.view.height))
        ctx.closePath()
        ctx.fill()

        // gutter
        //ctx.beginPath()
        //ctx.fillStyle = "#FF0000";
        //ctx.rect(0,-64, gAssets.mapinfo.width, 64)
        //ctx.closePath()
        //ctx.fill()

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

        if (!!this.screen) {
            this.screen.paint(ctx)
        } else {
            this.touch.paint(ctx)
        }

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "black"
        //ctx.strokeStyle = "black"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "bottom"

        //ctx.fillText(`${gEngine.view.availWidth}x${gEngine.view.availHeight}`, 8, 8);
        //ctx.fillText(`${gEngine.view.width}x${gEngine.view.height} (${gEngine.view.scale}) (${Math.floor(this.camera.x/16)},${Math.floor(this.camera.y/16)}` , 8, gEngine.view.height);

    }

    resize() {

        this.touch.resize()
    }

    handleTouches(touches) {
        if (!!this.screen) {
            this.screen.handleTouches(touches)
        } else {
            touches = this.touch.handleTouches(touches)

        }
        //gEngine.setFullScreen(true)
    }

    handleKeyPress(keyevent) {
        if (!!this.screen) {
        } else {
            this.keyboard.handleKeyPress(keyevent);
        }

        if (keyevent.text == "d") {
            let objs = this.map.map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                objs[0]._hurt()
            }
        }
    }

    handleKeyRelease(keyevent) {
        if (!!this.screen) {
        } else {
            this.keyboard.handleKeyRelease(keyevent);

        }

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
            // mapid can be null or a filename
            const mapid = "map-2x1-20231111-073345"

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