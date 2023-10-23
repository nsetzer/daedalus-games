 
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})

$import("axertc_physics", {Physics2dPlatform, PlatformerEntity, Wall, Slope})

class CspController {
    constructor(map) {

        this.map = map
        this.player = null

    }

    getPlayer() {
        if (this.player === null) {
            for (const obj of Object.values(this.map.map.objects)) {
                console.log(obj)
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

        const player = this.getPlayer()
        if (!player) {
            console.log("player not found")
            return
        }
        player.ownedByClient = true
        this.map.map.sendObjectInputEvent(player.entid, {btnid, pressed: false})

    }
}

class Player extends PlatformerEntity {


    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 24)
        this.playerId = props?.playerId??null
        this.physics = new Physics2dPlatform(this)

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'red';
        ctx.fillStyle = 'red';
        ctx.stroke();
        ctx.fill();
    }

    update(dt) {

        this.physics.update(dt)
    }

    onInput(payload) {

        if ("whlid" in payload) {
            this.physics.direction = Direction.fromVector(payload.vector.x, payload.vector.y)
            //console.log(payload.vector.x, payload.vector.y)
            //if (this.physics.direction&Direction.UP) {
            if ( payload.vector.y < -0.7071) {

                this._jump()

            } else {
                this.physics.xspeed = 90 * payload.vector.x
            }

        } else if (payload.btnid === 0) {

                this._jump()

        } else {
            console.log(payload)
        }

    }

    _jump() {
        let standing = this.physics.standing_frame >= (this.physics.frame_index - 6)

        if (standing) {
            this.physics.yspeed = this.physics.jumpspeed
            this.physics.yaccum = 0
            this.physics.gravityboost = false
            this.physics.doublejump = true
        }
    }
}

export class PlatformMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Wall", Wall)
        this.registerClass("Slope", Slope)
        this.registerClass("Player", Player)
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.strokeStyle = "blue"
        ctx.moveTo( Physics2dPlatform.maprect.left(), Physics2dPlatform.maprect.top());
        ctx.lineTo( Physics2dPlatform.maprect.cx(), Physics2dPlatform.maprect.bottom());
        ctx.lineTo( Physics2dPlatform.maprect.right(), Physics2dPlatform.maprect.top());
        ctx.stroke()

        for (const obj of Object.values(this.objects)) {

            obj.paint(ctx)
        }

    }
}

export class MainScene extends GameScene {

    constructor() {
        super()

        this.map = new ClientCspMap(new PlatformMap())
        this.map.setPlayerId("player")
        this.map.map.instanceId = "player1"
        this.controller = new CspController(this.map);

        this.touch = new TouchInput(this.controller)
        this.keyboard = new KeyboardInput(this.controller)

        Physics2dPlatform.maprect = new Rect(0, 0, gEngine.view.width, gEngine.view.height)

        this.touch.addWheel(64, -64, 48, {
            align: Alignment.LEFT|Alignment.BOTTOM,
            //symbols: ["W", "D", "S", "A"],
        })
        this.touch.addButton(120, -40, 32, {})
        this.touch.addButton(40, -120, 32, {})
        this.touch.addButton(40, -40, 32, {})
        this.touch.addButton(40, 40, 32, {
            align: Alignment.LEFT|Alignment.TOP,
        })

        this.keyboard.addWheel_ArrowKeys()
        this.keyboard.addButton(KeyboardInput.Keys.CTRL)
        this.keyboard.addButton(KeyboardInput.Keys.SPACE)

        this.map.world_step = 0 // hack for single player game
        this.map.map.sendObjectCreateEvent("Player", {x: 9, y:128, playerId: "player"})
    }
    pause(paused) {

    }

    update(dt) {

        this.map.update(dt)
    }

    paint(ctx) {

        ctx.beginPath()
        ctx.strokeStyle = "blue";
        ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        this.map.paint(ctx)

        this.touch.paint(ctx)
    }

    resize() {
        Physics2dPlatform.maprect = new Rect(0, 0, gEngine.view.width, gEngine.view.height)
    }

    handleTouches(touches) {
        touches = this.touch.handleTouches(touches)
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }
}

export default class Application extends ApplicationBase {
    constructor() {

        const query = daedalus.util.parseParameters()

        super({
            portrait: 0,
            fullscreen: 0
        }, () => {
            return new MainScene()
        })
    }
}