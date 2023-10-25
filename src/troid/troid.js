 
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
    Physics2dPlatform, PlatformerEntity, Wall, Slope,
    AnimationComponent
})

$import("scenes", {ResourceLoaderScene})

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

        const player = this.getPlayer()
        if (!player) {
            console.log("player not found")
            return
        }
        player.ownedByClient = true
        this.map.map.sendObjectInputEvent(player.entid, {btnid, pressed: false})

    }
}

class Bullet extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0 - 1, props?.y??0 - 1, 2, 2)
        this.split = props?.split??1
        this.physics = new Physics2dPlatform(this)
        this.physics.gravity = 0
        this.physics.xfriction = 0

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        const d = props?.direction??Direction.RIGHT
        const v = Direction.vector(props?.direction??Direction.RIGHT)

        this.physics.xspeed = 0
        this.physics.yspeed = 0
        this.wave_counter = 0
        this.wave_profile = null

        if (d == Direction.RIGHT) {
            this.wave_profile = Bullet.velocity_profile_h[this.split-1].map(p => ([p.x, -p.y]))

            //for (let i=0;i<bullet_h.length;i++) {
            //    //const [dx, dy] = bullet_h[i][this.split-1]
            //    //this.wave_profile.push([dx, -dy])
            //}
        }

        if (d == Direction.LEFT) {
            this.wave_profile = Bullet.velocity_profile_h[this.split-1].map(p => ([-p.x, -p.y]))
            //for (let i=0;i<bullet_h.length;i++) {
            //    const [dx, dy] = bullet_h[i][this.split-1]
            //    this.wave_profile.push([-dx, -dy])
            //}
        }

        if (d == Direction.UPRIGHT) {
            this.wave_profile = Bullet.velocity_profile_d[this.split-1].map(p => ([p.x, -p.y]))
            //for (let i=0;i<bullet_d.length;i++) {
            //    const [dx, dy] = bullet_d[i][this.split-1]
            //    this.wave_profile.push([dx, -dy])
            //}
        }

        if (d == Direction.UPLEFT) {
            this.wave_profile = Bullet.velocity_profile_d[this.split-1].map(p => ([-p.x, -p.y]))
            //for (let i=0;i<bullet_d.length;i++) {
            //    const [dx, dy] = bullet_d[i][this.split-1]
            //    this.wave_profile.push([-dx, -dy])
            //}
        }

    }

    paint(ctx) {

        ctx.beginPath();
        ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'purple';
        ctx.fillStyle = 'purple';
        ctx.arc(this.rect.x+this.rect.w/2,
                this.rect.y+this.rect.h/2,2,0,2*Math.PI);
        ctx.stroke();
        ctx.fill();
    }

    update(dt) {

        this.physics.xspeed = this.wave_profile[this.wave_counter][0]/dt
        this.physics.yspeed = this.wave_profile[this.wave_counter][1]/dt
        this.physics.update(dt)

        this.wave_counter += 1

        if (this.wave_counter >= this.wave_profile.length) {
            this.wave_counter = 0
        }

        if (!!this.physics.collide) {
            this._x_debug_map.destroyObject(this.entid)
        }
        if (this.physics.xspeed == 0 && this.physics.yspeed == 0) {
            this._x_debug_map.destroyObject(this.entid)
        }
    }

}
function init_velocity() {
    // generate the velocity profile for a bullet moving
    // forward at a constant velocity, even if traveling in
    // a sin pattern. generate three profiles for no wave
    // positive, and negative sin. generate an additional
    // three profiles that are rotate 45 degrees up.
    // the six profiles can be mirrored about the x axis.

    // rotate a point by angle in radians (positive numbers are clock wise)
    const rotate  = (p,a) => ({
        x: Math.cos(a) * p.x - Math.sin(a) * p.y,
        y: Math.sin(a) * p.x + Math.cos(a) * p.y,
    })
    // rotate a list of points
    const rotatelist = (seq, a) => seq.map(x => rotate(x, a))
    // get the difference for each point in the list
    const get_velocity = (seq) => seq.slice(1).map((p, i) => ({x: p.x - seq[i].x, y: p.y - seq[i].y}))

    // the number of points to sample
    const period = 24
    // velocity is pixels per second
    const velocity = 240/60
    // time (frame tick)
    const t = [...Array(period + 1).keys()]
    // position data. x and y position
    const x0 = t.map(i=> velocity*i)
    // no wave motion
    const y1 = t.map(i=> 0)
    // positive sin wave
    const y2 = t.map(i=> +8*Math.sin(i/period * Math.PI * 2))
    // negative sin wave
    const y3 = t.map(i=> -8*Math.sin(i/period * Math.PI * 2))

    const p1 = x0.map((v,i)=>({x:v,y:y1[i]})) //zip
    const p2 = x0.map((v,i)=>({x:v,y:y2[i]})) //zip
    const p3 = x0.map((v,i)=>({x:v,y:y3[i]})) //zip

    const v1 = get_velocity(p1)
    const v2 = get_velocity(p2)
    const v3 = get_velocity(p3)

    const p4 = rotatelist(p1, 45*Math.PI/180)
    const p5 = rotatelist(p2, 45*Math.PI/180)
    const p6 = rotatelist(p3, 45*Math.PI/180)

    const v4 = get_velocity(p4)
    const v5 = get_velocity(p5)
    const v6 = get_velocity(p6)

    Bullet.velocity_profile_h = [v1, v2 ,v3]
    Bullet.velocity_profile_d = [v4, v5 ,v6]

}
init_velocity()

class Player extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 8, 24)
        this.playerId = props?.playerId??null
        this.physics = new Physics2dPlatform(this,{
            xmaxspeed1: 180,
            xmaxspeed2: 220
        })
        this.animation = new AnimationComponent(this)
        this.visible = true

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        if (Player.sheets === null) {
            throw {"error": "sprite sheet not set"}
        }

        this.looking_up = false

        this.buildAnimations()

        this.current_action = "idle"
        this.current_facing = Direction.RIGHT
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = - 12
        let yoffset = - 7

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "ball":{},
        }

        let ncols = 17
        let nrows = 6
        let aid;

        aid = this.animation.register(Player.sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid
        aid = this.animation.register(Player.sheet, [0*ncols+3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.UPRIGHT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid
        aid = this.animation.register(Player.sheet, [1*ncols+3], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.UPLEFT] = aid

        aid = this.animation.register(Player.sheet, [0*ncols+0, 0*ncols+1, 0*ncols+2], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid
        aid = this.animation.register(Player.sheet, [0*ncols+3, 0*ncols+4, 0*ncols+5], spf, {xoffset, yoffset})
        this.animations["run"][Direction.UPRIGHT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+0, 1*ncols+1, 1*ncols+2], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(Player.sheet, [1*ncols+3, 1*ncols+4, 1*ncols+5], spf, {xoffset, yoffset})
        this.animations["run"][Direction.UPLEFT] = aid

        aid = this.animation.register(Player.sheet, [0*ncols+6], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.RIGHT] = aid
        aid = this.animation.register(Player.sheet, [0*ncols+7], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.UPRIGHT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+6], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.LEFT] = aid
        aid = this.animation.register(Player.sheet, [1*ncols+7], spf, {xoffset, yoffset})
        this.animations["jump"][Direction.UPLEFT] = aid

        aid = this.animation.register(Player.sheet, [0*ncols+2], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.RIGHT] = aid
        aid = this.animation.register(Player.sheet, [0*ncols+5], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.UPRIGHT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+2], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.LEFT] = aid
        aid = this.animation.register(Player.sheet, [1*ncols+5], spf, {xoffset, yoffset})
        this.animations["fall"][Direction.UPLEFT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+9], spf, {xoffset, yoffset})
        this.animations["hit"][Direction.RIGHT] = aid
        this.animations["hit"][Direction.LEFT] = aid
        this.animations["hit"][Direction.UPRIGHT] = aid
        this.animations["hit"][Direction.UPLEFT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+10, 1*ncols+11, 1*ncols+12, 1*ncols+13], spf, {xoffset, yoffset})
        this.animations["ball"][Direction.RIGHT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+10, 1*ncols+13, 1*ncols+12, 1*ncols+11], spf, {xoffset, yoffset})
        this.animations["ball"][Direction.LEFT] = aid

        this.animation.setAnimationById(this.animations.run[Direction.RIGHT])

        this.weapon_offset = {}
        this.weapon_offset[Direction.RIGHT]   = {x: 12, y: 12}
        this.weapon_offset[Direction.UPRIGHT] = {x: 11, y:  3}
        this.weapon_offset[Direction.LEFT]    = {x: -8, y: 12}
        this.weapon_offset[Direction.UPLEFT]  = {x: -7, y:  3}

    }

    paint(ctx) {



        ctx.save()
        this.animation.paint(ctx)
        ctx.restore()

        ctx.beginPath();
        ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fillStyle = '#FF00007f';
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = '#FF00007f';



        const o = this.weapon_offset[this.current_facing]

        ctx.rect( this.rect.x + o.x, this.rect.y + o.y, 4, 4);
        //switch (this.current_facing) {
        //    case Direction.RIGHT:
        //        ctx.rect( this.rect.x + this.rect.w + 4, this.rect.y + 12, 4, 4);
        //        break;
        //    case Direction.UPRIGHT:
        //        ctx.rect( this.rect.x + this.rect.w + 3, this.rect.y + 3, 4, 4);
        //        break;
        //    case Direction.LEFT:
        //        ctx.rect( this.rect.x - 8, this.rect.y + 12, 4, 4);
        //        break;
        //    case Direction.UPLEFT:
        //        ctx.rect( this.rect.x - 7, this.rect.y + 3, 4, 4);
        //        break;
        //    default:
        //        break;
        //}
        ctx.fill();


        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.physics.action}`, this.rect.x, this.rect.y);

    }

    update(dt) {

        this.physics.update(dt)

        let pfacing = this.physics.facing
        if (this.looking_up) {
            pfacing |= Direction.UP
        }

        let paction = "idle"
        switch (this.physics.action) {
            case "run":
                paction = "run"
                break;
            case "jump":
                paction = "jump"
                break;
            case "fall":
                paction = "fall"
                break;
            default:
                break;
        }

        if (pfacing != this.current_facing ||
            paction != this.current_action) {

            this.current_facing = pfacing
            this.current_action = paction

            let aid = this.animations[this.current_action][this.current_facing]
            if (!aid) {
                console.error(this.physics)
                throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
            }
            this.animation.setAnimationById(aid)

        }

        this.animation.update(dt)
    }

    onInput(payload) {

        if ("whlid" in payload) {
            //this.physics.direction = Direction.fromVector(payload.vector.x, payload.vector.y)
            this.physics.direction = Direction.fromVector(payload.vector.x, 0)
            //console.log(payload.vector.x, payload.vector.y)
            //if (this.physics.direction&Direction.UP) {
            if ( payload.vector.y < -0.3535) {
                this.looking_up = true
            } else {
                this.looking_up = false
            }

            if (payload.vector.x > 0.3535) {
                this.physics.xspeed = 90
                this.physics.facing = Direction.RIGHT
            }

            else if (payload.vector.x < -0.3535) {
                this.physics.xspeed = -90
                this.physics.facing = Direction.LEFT
            }

            else {
                this.physics.xspeed = 0
            }

        } else if (payload.btnid === 0) {

            if (payload.pressed) {
                this._jump()
            } else {
                this.physics.gravityboost = true
            }

        } else if (payload.btnid === 1) {

            if (!payload.pressed) {
                let d = this.physics.facing
                if (this.looking_up) {
                    d |= Direction.UP
                }

                const o = this.weapon_offset[this.current_facing]
                const px = this.rect.x + o.x
                const py = this.rect.y + o.y

                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Bullet", {
                    x: px, y: py, direction: d, split:1})
                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Bullet", {
                    x: px, y: py, direction: d, split:2})
                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Bullet", {
                    x: px, y: py, direction: d, split:3})
            }
        } else {
            console.log(payload)
        }

    }

    _jump() {

        // coyote time

        let standing = this.physics.standing_frame >= (this.physics.frame_index - 6)
        let pressing = this.physics.pressing_frame >= (this.physics.frame_index - 6)

        if (standing) {
            this.physics.yspeed = this.physics.jumpspeed
            this.physics.yaccum = 0
            this.physics.gravityboost = false
            this.physics.doublejump = true
        } else if (pressing && !standing) {
            this.physics.xspeed = this.physics.pressing_direction * this.physics.xjumpspeed
            this.physics.xaccum = 0
            this.physics.yspeed = this.physics.jumpspeed / Math.sqrt(2)
            this.physics.yaccum = 0
            this.physics.gravityboost = false

        } else if (!standing && this.physics.doublejump && this.physics.yspeed > 0) {
            this.physics.yspeed = this.physics.jumpspeed / Math.sqrt(2)
            this.physics.yaccum = 0
            this.physics.gravityboost = false
            this.physics.doublejump = false
            this.physics.doublejump_position = {x:this.physics.target.rect.cx(), y: this.physics.target.rect.bottom()}
            this.physics.doublejump_timer = .4
        } else {
            console.log(`jump standing=${standing} pressing=${pressing}`)
        }
    }
}
Player.sheet = null

class PlatformMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Wall", Wall)
        this.registerClass("Slope", Slope)
        this.registerClass("Player", Player)
        this.registerClass("Bullet", Bullet)
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

class MainScene extends GameScene {

    constructor(loader) {
        super()

        this.loader = loader

        Player.sheet = this.loader.sheets.player

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

        this.map.world_step = 0 // hack for single player game
        this.map.map.sendObjectCreateEvent("Player", {x: 200, y:128, playerId: "player"})

        this.map.map.sendObjectCreateEvent("Wall", {x:0, y:0, w:16, h:300})

        this.map.map.sendObjectCreateEvent("Wall", {x:0, y:300, w:640, h:32})
        this.map.map.sendObjectCreateEvent("Slope", {
                x:320-32, y:300-32, w:32, h:32, direction:Direction.UPLEFT})
        this.map.map.sendObjectCreateEvent("Wall", {x:320, y:300-32, w:32, h:32})
        this.map.map.sendObjectCreateEvent("Slope", {
                x:320+32, y:300-32, w:32, h:32, direction:Direction.UPRIGHT})
    }
    pause(paused) {

    }

    update(dt) {

        this.map.update(dt)
    }

    paint(ctx) {

        ctx.beginPath()
        ctx.fillStyle = "#477ed6";
        ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        ctx.fill()

        ctx.lineWidth = 1;
        ctx.beginPath()
        ctx.strokeStyle = "blue";
        ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        const barHeight = 48

        ctx.beginPath()
        ctx.fillStyle = "black";
        ctx.rect(0,0, gEngine.view.width, barHeight)
        ctx.fill()

        ctx.beginPath();
        ctx.strokeStyle = "gold";
        ctx.lineWidth = 3;
        ctx.rect(gEngine.view.width/2 - 18, barHeight/2 - 18, 36, 36);
        ctx.stroke();

        for (let i=0; i < 3; i++) {
            ctx.beginPath();
            ctx.fillStyle = "pink";
            ctx.strokeStyle = "purple";
            ctx.lineWidth = 2;
            ctx.rect(48 + 48*i, barHeight/2 - 12, 24, 24);
            ctx.fill();
            ctx.stroke();
        }


        ctx.lineWidth = 1;

        this.map.paint(ctx)

        this.touch.paint(ctx)


        ctx.font = "bold 16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        ctx.fillText(`${gEngine.view.availWidth}x${gEngine.view.availHeight}`, 8, 8);
        ctx.fillText(`${gEngine.view.width}x${gEngine.view.height}` , 8, 8+32);

    }

    resize() {
        Physics2dPlatform.maprect = new Rect(0, 0, gEngine.view.width, gEngine.view.height)
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

            return new ResourceLoaderScene((loader)=> {
                gEngine.scene = new MainScene(loader)

            })
        })
    }
}