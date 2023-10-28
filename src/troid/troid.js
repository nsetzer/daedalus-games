 
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
//   like a secret exit/entrzance pair. doors warp to the corresponding named
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

        ctx.save()
        this.particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            ctx.fillStyle = p.color
            ctx.beginPath();
            ctx.rect(p.x, p.y, p.size, p.size)
            ctx.fill()
            ctx.closePath();
        })

        ctx.beginPath();
        ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.strokeStyle = 'purple';
        ctx.fillStyle = 'purple';
        ctx.arc(this.rect.x+this.rect.w/2,
                this.rect.y+this.rect.h/2,2,0,2*Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.restore()


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
    const velocity = 300/60
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

        const mapinfo = loader.json.map.data
        const createObject = (t, p) => {return this.map.map.createObject(this.map.map._x_nextEntId(), t, p)}

        const player = createObject("Player", {x: 200-64, y:128, playerId: "player"})

        this.camera = new Camera(this.map.map, player)

        Object.entries(mapinfo.layers[0]).forEach(t => {
            let [tid, tile] = t
            let y = 16*(Math.floor(tid/512 - 4))
            let x = 16*(tid%512)
            if (tile.shape==1) {
                createObject("Wall", {x:x, y:y, w:16, h:16})
            } else if (tile.shape==2) {
                createObject("Slope", {x:x, y:y, w:16, h:16, direction:tile.direction})
            } else if (tile.shape==3) {
                if (tile.direction&Direction.UP) {
                    y += 8
                }
                createObject("Slope", {x:x, y:y, w:16, h:8, direction:tile.direction})
            } else if (tile.shape==4) {
                if (tile.direction&Direction.DOWN) {
                    y += 8
                }
                createObject("Slope", {x:x, y:y, w:16, h:8, direction:tile.direction})
            } else {
                console.log(tile)
            }
        })

        const mh = 224
        const mw = 384
        const mwh = 192
        //createObject("Wall", {x:0, y:0, w:16, h:mh})
//
        //createObject("Wall", {x:0, y:mh-16, w:mw, h:16})
        //createObject("Wall", {x:mw, y:mh-16, w:mw, h:16})
        //createObject("Wall", {x:2*mw, y:mh-16, w:mw, h:16})
//
        //createObject("Slope", {
        //        x:mwh-24, y:mh-32, w:16, h:16, direction:Direction.UPLEFT})
        //createObject("Wall", {x:mwh-8, y:mh-32, w:16, h:16})
        //createObject("Slope", {
        //        x:mwh+8, y:mh-32, w:16, h:16, direction:Direction.UPRIGHT})

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

class TileMenu {

    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 6, 8 + 24 * 3)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            if (!t.pressed) {
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
            }

            else if (ty == 2) {
                if (tx < 2) {
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

        k = (this.parent.tile_shape - 1)
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

        // ---------------------------------------------------------------
        // Row 3 Tile Set

        x = 8
        y = 32 + 24 + 24


        k = (this.parent.tile_sheet - 1)
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()

        ctx.beginPath();
        ctx.roundRect(x,y,16,16)
        ctx.fill()

        if (this.parent.tile_property <= 4) {

            x += 24
            ctx.beginPath();
            ctx.roundRect(x,y,16,16)
            ctx.fill()

        }

    }
}

const TileShape = {}
TileShape.RESERVED = 0
TileShape.FULL = 1
TileShape.HALF = 2
TileShape.ONETHIRD = 3
TileShape.TWOTHIRD = 4

const TileProperty = {}
TileShape.RESERVED = 0
TileProperty.SOLID = 1
TileProperty.NOTSOLID = 2
TileProperty.ONEWAY = 3
TileProperty.ICE = 4
TileProperty.WATER = 5
TileProperty.LAVA = 6

class LevelEditScene extends GameScene {

    constructor(loader) {
        super()

        this.loader = loader

        this.camera = {x:-48, y:-48, scale:2}
        this.map = {
            width: 15*32,
            height: 9*32,
            layers: [{}]
        }

        this.theme_sheets = [null, this.loader.sheets.zone_01_sheet_01]

        this._init_slopes()

        const mapinfo = loader.json.map.data

        this.map.width = mapinfo.width
        this.map.height = mapinfo.height
        this.map.layers = mapinfo.layers
        console.log(this.map.layers)

        let t0 = performance.now()
        Object.entries(this.map.layers[0]).map(t => {
            const [tid, tile] = t;
            let y = Math.floor(tid/512 - 4)
            let x = tid%512
            this._updateTileImpl(x, y, tile)
        })
        let t1 = performance.now()
        console.log("loaded tiles in ", t1 - t0)

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

        // pan and
        for (let i=0; i < 5; i++) {

            ctx.beginPath();
            ctx.strokeStyle = "red";
            ctx.lineWidth = 3;
            ctx.rect(gEngine.view.width - 24*i - 24, barHeight/2 - 9, 18, 18);
            ctx.stroke();
        }

        // tile editor / object editor switch

        // tile picker / object picker
        //      how to pick solid? ice? lava? water?
        //      dialog pick
        //          (solid, ice, lava, water)
        //      which constrains the set of tiles to select
        //          (full, half, onethird, twothird)
        // erase
        for (let i=0; i < 5; i++) {
            ctx.beginPath();
            ctx.fillStyle = "#00FF00"
            ctx.rect(6 + 24*i, barHeight/2 - 9, 18, 18);
            ctx.closePath();
            ctx.fill();

            if (i == 1 && this.active_tool==1) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }
            if (i == 2 && this.active_tool==2) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "gold"
                ctx.stroke();
            }


        }

        this.paintTile(ctx, 6 + 24 + 1, barHeight/2 - 9 + 1, {
            shape: this.tile_shape,
            property: this.tile_property,
            direction: Direction.UPRIGHT
        })

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

    paintTile(ctx, x, y, tile) {
        ctx.beginPath()

        switch(tile.property) {
            case 1:
                ctx.fillStyle = "#000000";
                break;
            case 2:
                ctx.fillStyle = "#7f7f7f";
                break;
            case 3:
                ctx.fillStyle = "#d66d47";
                break;
            case 4:
                ctx.fillStyle = "#36c6e3";
                break;
            case 5:
                ctx.fillStyle = "#364de3";
                break;
            case 6:
                ctx.fillStyle = "#e33c36";
                break;
        }

        if (tile.shape > TileShape.FULL) {

            if (!!tile.tile) {
                ctx.save()
                if (tile.property == TileProperty.NOTSOLID) {
                    ctx.filter = "brightness(50%) hue-rotate(-90deg)";
                }
                if (tile.property == TileProperty.ONEWAY) {
                    ctx.filter = "brightness(50%) hue-rotate(90deg)";
                }
                tile.tile.draw(ctx,x,y)
                ctx.restore()
            } else {
                ctx.beginPath();
                let points;
                switch (tile.shape) {
                case TileShape.HALF:
                    points = this.slopes_half[tile.direction]
                    break
                case TileShape.ONETHIRD:
                    points = this.slopes_onethird[tile.direction]
                    break
                case TileShape.TWOTHIRD:
                    points = this.slopes_twothird[tile.direction]
                    break
                default:
                    break
                }
                ctx.moveTo(x + points[0].x, y + points[0].y);
                points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
                ctx.fill();
            }
        } else {

            if (!!tile.tile) {
                ctx.save()
                if (tile.property == TileProperty.NOTSOLID) {
                    ctx.filter = "brightness(50%) hue-rotate(-90deg)";
                }
                if (tile.property == TileProperty.ONEWAY) {
                    ctx.filter = "brightness(50%) hue-rotate(90deg)";
                }
                tile.tile.draw(ctx,x,y)
                ctx.restore()
            } else {
                ctx.rect(x,y,16,16)
            }
        }

        ctx.fill()
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

        ctx.rect(
            x1,
            y1,
            x2 - x1,
            y2 - y1)
        ctx.fill()
        ctx.stroke()

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
            let x = 16*tid%512

            this.paintTile(ctx, x, y, tile)

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

        ctx.font = "bold 16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        //let text = `${-this.ygutter}, ${-Math.ceil(this.camera.y/16)*16}`
        let text = `${Math.floor(this.camera.x)}, ${Math.floor(this.camera.y)}`
        ctx.fillText(text, 8, 8);
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

    _updateTileImpl(x, y, tile) {
        // return true if the tile was updated.
        // update neighbors
        // loop until no more tiles are changed

        const tile_before = tile.tile

        const solid = (p) => p == TileProperty.SOLID

        if (tile.sheet == 0) {
            tile.sheet = 1
        }

        if (tile.shape == TileShape.FULL) {

            const ntid = ((y + 4)*512 + x)
            const ntid_u = ((y + 4-1)*512 + x)
            const ntid_d = ((y + 4+1)*512 + x)
            const ntid_l = ((y + 4)*512 + (x - 1))
            const ntid_r = ((y + 4)*512 + (x + 1))

            const eu = !!this.map.layers[0][ntid_u] && solid(this.map.layers[0][ntid_u].property) == solid(this.map.layers[0][ntid].property)
            const ed = !!this.map.layers[0][ntid_d] && solid(this.map.layers[0][ntid_d].property) == solid(this.map.layers[0][ntid].property)
            const el = !!this.map.layers[0][ntid_l] && solid(this.map.layers[0][ntid_l].property) == solid(this.map.layers[0][ntid].property)
            const er = !!this.map.layers[0][ntid_r] && solid(this.map.layers[0][ntid_r].property) == solid(this.map.layers[0][ntid].property)

            let tid = -1
            let n = (eu+ed+el+er)

            if (n == 0) {
                tid = 0
            }

            if (n==1) {
                if (eu) { tid = 1*11 + 3 }
                if (ed) { tid = 0*11 + 3 }
                if (el) { tid = 1*11 + 4 }
                if (er) { tid = 0*11 + 4 }
            }

            if (n==2) {

                let q = (er<<3)|(el<<2)|(ed<<1)|(eu)

                // the top right and bottom left correspond to
                // three in a row
                // the group in the middle handle the cases
                // for the 4 rotations of an 'L' shape
                // other cases (like eu and eu) are not possible
                // only entries with exactly 2 bits set are given
                // (" ".join([bin(i) for i in range(16)])).replace("0b","")
                //                   3         5    6              9   10        11
                // 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111
                let t = [
                           -1,       -1,       -1, 2*11 + 0,
                           -1, 1*11 + 2, 0*11 + 2,       -1,
                           -1, 1*11 + 1, 0*11 + 1,       -1,
                     2*11 + 0,       -1,       -1,       -1,
                ]
                if (t < 0) {
                    console.log("!! n==2 not set", q)
                }
                tid = t[q]

                // non solid walls should join with the solid floor
                if (!solid(this.map.layers[0][ntid].property) && solid(this.map.layers[0][ntid_d]?.property)) {
                    if (tid == 1*11 + 1) { tid = 0*11 + 4}
                    if (tid == 1*11 + 2) { tid = 1*11 + 4}
                }

            }

            if (n==3) {
                if (!eu) { tid = 0*11 + 3 }
                if (!ed) { tid = 1*11 + 3 }
                if (!el) { tid = 0*11 + 4 }
                if (!er) { tid = 1*11 + 4 }

                // non solid walls should join with the solid floor
                if (!solid(this.map.layers[0][ntid].property) && solid(this.map.layers[0][ntid_d]?.property)) {
                    tid = 2*11 + 0
                }

            }

            //check for air on the diagonal up,  left and right
            //change this tile to close off the grass
            if (n==4) {
                tid = 2*11 + 0


            }

            if (this.map.layers[0][ntid].property == TileProperty.SOLID) {

                if (n==4) {
                    const tiddl = ((y + 4 - 1)*512 + (x-1))
                    const tiddr = ((y + 4 - 1)*512 + (x+1))
                    const dl = !this.map.layers[0][tiddl]
                    const dr = !this.map.layers[0][tiddr]
                    if (dl) {tid = 3*11 + 7}
                    if (dr) {tid = 3*11 + 8}
                }

                // fill the corners when there are neighbor diagonal slopes
                if (n >= 2) {
                    const du = !!this.map.layers[0][ntid_u] && solid(this.map.layers[0][ntid_u].property) == solid(this.map.layers[0][ntid].property) && this.map.layers[0][ntid_u].shape == TileShape.HALF
                    const dl = !!this.map.layers[0][ntid_l] && solid(this.map.layers[0][ntid_l].property) == solid(this.map.layers[0][ntid].property) && (this.map.layers[0][ntid_l].shape == TileShape.HALF || this.map.layers[0][ntid_l].shape == TileShape.FULL)
                    const dr = !!this.map.layers[0][ntid_r] && solid(this.map.layers[0][ntid_r].property) == solid(this.map.layers[0][ntid].property) && (this.map.layers[0][ntid_r].shape == TileShape.HALF || this.map.layers[0][ntid_r].shape == TileShape.FULL)
                    if (du && dl) { tid = 3*11 + 10 }
                    if (du && dr) { tid = 3*11 + 9 }
                }

                // fill the corners when there are neighbor diagonal slopes
                if (n >= 2) {

                    const du = !!this.map.layers[0][ntid_u] && solid(this.map.layers[0][ntid_u].property) == solid(this.map.layers[0][ntid].property) && this.map.layers[0][ntid_u].shape == TileShape.ONETHIRD
                    const dl = !!this.map.layers[0][ntid_l] && solid(this.map.layers[0][ntid_l].property) == solid(this.map.layers[0][ntid].property) && (this.map.layers[0][ntid_l].shape == TileShape.TWOTHIRD || this.map.layers[0][ntid_l].shape == TileShape.FULL)
                    const dr = !!this.map.layers[0][ntid_r] && solid(this.map.layers[0][ntid_r].property) == solid(this.map.layers[0][ntid].property) && (this.map.layers[0][ntid_r].shape == TileShape.TWOTHIRD || this.map.layers[0][ntid_r].shape == TileShape.FULL)
                    if (du && dl) { tid = 2*11 + 8 }
                    if (du && dr) { tid = 2*11 + 7 }
                }
            }

            // fix for diagonal oneway platforms (smw style)
            if (this.map.layers[0][ntid].property == TileProperty.NOTSOLID) {
                if (n >= 2) {
                    const du = !!this.map.layers[0][ntid_u] && this.map.layers[0][ntid_u].shape == TileShape.HALF && this.map.layers[0][ntid_u].property != TileProperty.NOTSOLID
                    const dl = !!this.map.layers[0][ntid_l] && this.map.layers[0][ntid_l].shape == TileShape.HALF && this.map.layers[0][ntid_l].property != TileProperty.NOTSOLID
                    const dr = !!this.map.layers[0][ntid_r] && this.map.layers[0][ntid_r].shape == TileShape.HALF && this.map.layers[0][ntid_r].property != TileProperty.NOTSOLID
                    if (du && dl) { tid = 3*11 +10 }
                    if (du && dr) { tid = 3*11 + 9 }
                }
            }

            if (tid >= 0) {
                tile.tile = this.theme_sheets[tile.sheet].tile(tid)
            }

        } else if (tile.shape == TileShape.HALF) {
            let tid = -1

            if (tile.property == TileProperty.NOTSOLID) {
                if (tile.direction == Direction.UPRIGHT) { tid = 2*11 + 6}
                if (tile.direction == Direction.UPLEFT)  { tid = 2*11 + 5}
            } else {
                if (tile.direction == Direction.UPRIGHT) { tid = 0*11 + 6}
                if (tile.direction == Direction.UPLEFT)  { tid = 0*11 + 5}
            }

            if (tile.direction == Direction.DOWNRIGHT) { tid = 3*11 + 6}
            if (tile.direction == Direction.DOWNLEFT)  { tid = 3*11 + 5}

            if (tid >= 0) {
                tile.tile = this.theme_sheets[tile.sheet].tile(tid)
            }

        } else if (tile.shape == TileShape.ONETHIRD) {

            let tid = -1

            if (tile.property == TileProperty.NOTSOLID) {
                if (tile.direction == Direction.UPRIGHT) { tid = 1*11 + 0} // invalid, no tile
                if (tile.direction == Direction.UPLEFT)  { tid = 1*11 + 0} // invalid, no tile
            } else {
                if (tile.direction == Direction.UPRIGHT) { tid = 0*11 + 8}
                if (tile.direction == Direction.UPLEFT)  { tid = 0*11 + 7}
            }

            if (tile.direction == Direction.DOWNRIGHT) { tid = 0*11 + 10}
            if (tile.direction == Direction.DOWNLEFT)  { tid = 0*11 + 9}

            if (tid >= 0) {
                tile.tile = this.theme_sheets[tile.sheet].tile(tid)
            }

        } else if (tile.shape == TileShape.TWOTHIRD) {

            let tid = -1

            if (tile.property == TileProperty.NOTSOLID) {
                if (tile.direction == Direction.UPRIGHT) { tid = 1*11 + 0} // invalid, no tile
                if (tile.direction == Direction.UPLEFT)  { tid = 1*11 + 0} // invalid, no tile
            } else {
                if (tile.direction == Direction.UPRIGHT) { tid = 1*11 + 8}
                if (tile.direction == Direction.UPLEFT)  { tid = 1*11 + 7}
            }

            if (tile.direction == Direction.DOWNRIGHT) { tid = 1*11 + 10}
            if (tile.direction == Direction.DOWNLEFT)  { tid = 1*11 + 9}

            if (tid >= 0) {
                tile.tile = this.theme_sheets[tile.sheet].tile(tid)
            }

        } else {
            console.log("error shape", tile.shape)
        }

        // check to see if any changes were made
        if (!!tile_before && !!tile.tile) {
            return tile_before.sheet != tile.tile.sheet || tile_before.tid != tile.tile.tid
        }

        return (!!tile_before) !== (!!tile.tile)
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
                delta = this._updateTileImpl(qx, qy, this.map.layers[0][tid])
            }

            if (delta) {
                queue.push([x-1, y])
                queue.push([x+1, y])
                queue.push([x, y-1])
                queue.push([x, y+1])
            }

        }

        /*
        if (y > -4) {
            const tid = (y - 1 + 4)*512+x
            const tile = this.map.layers[0][tid]
            if (!!tile) {this._updateTileImpl(x, y-1, tile)}
        }

        if (y < 511) {
            const tid = (y + 1 + 4)*512+x
            const tile = this.map.layers[0][tid]
            if (!!tile) {this._updateTileImpl(x, y+1, tile)}
        }

        if (x > 0) {
            const tid = (y + 4)*512+(x-1)
            const tile = this.map.layers[0][tid]
            if (!!tile) {this._updateTileImpl(x-1, y, tile)}
        }

        if (x < 511) {
            const tid = (y + 4)*512+(x+1)
            const tile = this.map.layers[0][tid]
            if (!!tile) {this._updateTileImpl(x+1, y, tile)}
        }
        */


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

            // rotate the tile or change the property
            if (this.map.layers[0][tid].shape == this.tile_shape) {

                const d = [Direction.UPRIGHT,Direction.DOWNRIGHT,Direction.DOWNLEFT,Direction.UPLEFT]
                if (this.tile_shape > 1) {
                    this.map.layers[0][tid].direction = d[(d.indexOf(this.map.layers[0][tid].direction) + 1) % 4]
                }
                this.map.layers[0][tid].property = this.tile_property

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

                if (t.pressed) {

                    if (ix == 0) {

                        this.saveAs()
                    }
                    if (ix == 1) {
                        this.active_tool = 1
                        this.active_menu = new TileMenu(this)
                    }
                    if (ix == 2) {
                        this.active_tool = 2
                    }

                    if (ix == 3) {
                        if (this.camera.scale < 3) {
                            this.camera.scale += 0.5
                        }
                    }

                    if (ix == 4) {
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
            this.camera.y += 8
        } else if (keyevent.keyCode == 40) {
            //down
            this.camera.y -= 8
        } else if (keyevent.keyCode == 37) {
            //left
            this.camera.x += 8
        } else if (keyevent.keyCode == 39) {
            //right
            this.camera.x -= 8
        } else if (keyevent.text == '1') {
            this.tile_shape = 0
        } else if (keyevent.text == '2') {
            this.tile_shape = 1
        } else if (keyevent.text == '3') {
            this.tile_shape = 2
        } else if (keyevent.text == '4') {
            this.tile_shape = 3
        } else if (keyevent.text == '5') {
            this.tile_shape = -1
        } else if (keyevent.text == 's') {
            this.tile_property = 1
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

            return new ResourceLoaderScene((loader)=> {
                //gEngine.scene = new MainScene(loader)
                gEngine.scene = new LevelEditScene(loader)

            })
        })
    }
}