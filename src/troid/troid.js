 
// stages should be 15 screens wide (15*12*32 = 5760 pixels)
// at 150 pixels per second, a flat run would clear a stage in 5760/150 ~ 38.4 seconds
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

function random_choice(choices) {
  var index = Math.floor(Math.random() * choices.length);
  return choices[index];
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
        this.wave_loop = true
        this.wave_profile = Bullet.velocity_profile_wave[d][this.split-1]

        this.particles = [] // {x,y,dx,dy,size,color}
    }

    paint(ctx) {

        this.particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            ctx.fillStyle = p.color
            ctx.rect(p.x, p.y, p.size, p.size)
            ctx.fill()
        })

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

        if (this.wave_counter < this.wave_profile.length) {
            this.physics.xspeed = this.wave_profile[this.wave_counter].x/dt
            this.physics.yspeed = this.wave_profile[this.wave_counter].y/dt
            this.wave_counter += 1
        }
        this.physics.update(dt)

        this.particles.push({
            x:this.rect.x, y:this.rect.y + 2 * (Math.random() - 0.5),
            dx:0, dy:Math.random()-0.5,
            size: 1,
            color: random_choice(["#e81202", "#e85702", "#e8be02"])
        })
        this.particles.push({
            x:this.rect.x, y:this.rect.y + 2 * (Math.random() - 0.5),
            dx:0, dy:2 * (Math.random() - 0.5),
            size:1,
            color: random_choice(["#e81202", "#e85702", "#e8be02"])
        })
        while (this.particles.length > 10) {
            this.particles.shift()
        }

        if (this.wave_loop && this.wave_counter >= this.wave_profile.length) {
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
    // mirror x coordinate
    const flip = (seq) => seq.map(p=>({x:-p.x, y:p.y}))

    // the number of points to sample
    const period = 40
    // velocity is pixels per frame
    const velocity = 240/60
    // bullet will move perpendicular to the
    // direction by +/- half the amplitude
    const amplitude = 8

    // time (frame tick)
    const t = [...Array(period + 1).keys()]
    // position data. x and y position
    const x0 = t.map(i=> velocity*i)
    // no wave motion
    const y1 = t.map(i=> 0)
    // positive sin wave
    const y2 = t.map(i=> +amplitude*Math.sin(i/period * Math.PI * 2))
    // negative sin wave
    const y3 = t.map(i=> -amplitude*Math.sin(i/period * Math.PI * 2))

    const p1 = x0.map((v,i)=>({x:v,y:y1[i]})) //zip
    const p2 = x0.map((v,i)=>({x:v,y:y2[i]})) //zip
    const p3 = x0.map((v,i)=>({x:v,y:y3[i]})) //zip

    const v1 = get_velocity(p1)
    const v2 = get_velocity(p2)
    const v3 = get_velocity(p3)

    const p4 = rotatelist(p1, -45*Math.PI/180)
    const p5 = rotatelist(p2, -45*Math.PI/180)
    const p6 = rotatelist(p3, -45*Math.PI/180)

    const v4 = get_velocity(p4)
    const v5 = get_velocity(p5)
    const v6 = get_velocity(p6)

    // profiles have the pattern [straight, wave-up, wave-down]
    // each list is the velocity to apply in a looping fashion on each time step

    // when firing one projectile, any of the splits could be used
    // when firing two projectiles, each uses one of the second or third splits
    // when firing three projectiles, each uses one of the splits

    // this profile loops. creating a wave effect
    Bullet.velocity_profile_wave = {
        [Direction.RIGHT]: [v1.slice(0,1), v2, v3],
        [Direction.UPRIGHT]: [v4.slice(0,1), v5 ,v6],
        [Direction.LEFT]: [flip(v1.slice(0,1)), flip(v2), flip(v3)],
        [Direction.UPLEFT]: [flip(v4.slice(0,1)), flip(v5), flip(v6)],
    }

    // this profile does not loop
    // bullets spread apart and then fly straight
    // spread takes the first 25% of a wave sequence (the part where the bullet
    // moves up or down). then concats the constant velocity from the first split
    const spread = (seq, p) => seq.slice(0, Math.floor(seq.length/4)).concat(p)
    Bullet.velocity_profile_spread = {
        [Direction.RIGHT]: [v1.slice(0,1), spread(v2, v1[0]), spread(v3, v1[0])],
        [Direction.UPRIGHT]: [v4.slice(0,1), spread(v5, v4[0]), spread(v6, v4[0])],
        [Direction.LEFT]: [flip(v1.slice(0,1)), flip(spread(v2, v1[0])), flip(spread(v3, v1[0]))],
        [Direction.UPLEFT]: [flip(v4.slice(0,1)), flip(spread(v5, v4[0])), flip(spread(v6, v4[0]))],
    }

}

init_velocity()

export class CameraBase {

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

class Player extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 8, 24)
        this.playerId = props?.playerId??null
        this.physics = new Physics2dPlatform(this,{
            xmaxspeed1: 150,
            xmaxspeed2: 175
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

        this.charge_duration = 0.0
        this.charge_timeout = 1.1
        this.charging = false
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

        //ctx.beginPath();
        //ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.fillStyle = '#FF00007f';
        //ctx.fill();

        if (this.charging) {
            ctx.beginPath();
            ctx.fillStyle = '#FF0000FF';
            const p = this.charge_duration / this.charge_timeout
            const o = this.weapon_offset[this.current_facing]
            //ctx.rect( this.rect.x + o.x - 1, this.rect.y + o.y - 1, 5*p, 5*p);
            ctx.arc(
                this.rect.x + o.x + 2, this.rect.y + o.y + 2,
                4*p,
                0,2*Math.PI);
            ctx.fill();

        }

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.physics.action}`, this.rect.x, this.rect.y);

    }

    update(dt) {

        if (this.charging && this.charge_duration < this.charge_timeout) {
            this.charge_duration += dt
            if (this.charge_duration > this.charge_timeout) {
                this.charge_duration = this.charge_timeout
            }
        }

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

            if (payload.pressed) {
                this.charging = true
                this.charge_duration = 0.0
            } else {

                this.charging = false
                const charge_percent = this.charge_duration / this.charge_timeout
                console.log("charged!", charge_percent)

                let d = this.physics.facing
                if (this.looking_up) {
                    d |= Direction.UP
                }

                const o = this.weapon_offset[this.current_facing]
                const px = this.rect.x + o.x
                const py = this.rect.y + o.y

                //this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Bullet", {
                //    x: px, y: py, direction: d, split:1})
                //this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Bullet", {
                //    x: px, y: py, direction: d, split:2})
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

        const createObject = (t, p) => {return this.map.map.createObject(this.map.map._x_nextEntId(), t, p)}

        const player = createObject("Player", {x: 200, y:128, playerId: "player"})

        this.camera = new Camera(this.map.map, player)

        const mh = 224
        const mw = 384
        const mwh = 192
        createObject("Wall", {x:0, y:0, w:16, h:mh})

        createObject("Wall", {x:0, y:mh-16, w:mw, h:16})
        createObject("Wall", {x:mw, y:mh-16, w:mw, h:16})
        createObject("Wall", {x:2*mw, y:mh-16, w:mw, h:16})

        createObject("Slope", {
                x:mwh-24, y:mh-32, w:16, h:16, direction:Direction.UPLEFT})
        createObject("Wall", {x:mwh-8, y:mh-32, w:16, h:16})
        createObject("Slope", {
                x:mwh+8, y:mh-32, w:16, h:16, direction:Direction.UPRIGHT})

        Physics2dPlatform.maprect = new Rect(0, 0, 3 * gEngine.view.width, gEngine.view.height)

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

        ctx.beginPath()
        ctx.fillStyle = "#477ed6";
        ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        ctx.fill()

        ctx.lineWidth = 1;
        ctx.beginPath()
        ctx.strokeStyle = "blue";
        ctx.rect(0,0, gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        ctx.lineWidth = 1;

        ctx.save()

        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -this.camera.y)

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
        ctx.fillText(`${gEngine.view.width}x${gEngine.view.height} (${gEngine.view.scale})` , 8, gEngine.view.height);

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

            return new ResourceLoaderScene((loader)=> {
                gEngine.scene = new MainScene(loader)

            })
        })
    }
}