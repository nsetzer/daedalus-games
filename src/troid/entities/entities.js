 
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})
$import("axertc_client", {SpriteSheet})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, PlatformBase, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("store", {gAssets, gCharacterInfo, WeaponType})

function random_choice(choices) {
  let index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

export class ProjectileBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
    }
}

export class Bullet extends ProjectileBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0 - 1, props?.y??0 - 1, 2, 2)
        this.split = props?.split??1
        this.color = props?.color??0
        this.physics = new Physics2dPlatform(this,{
            slope_walk: false,
        })
        this.physics.gravity = 0
        this.physics.xfriction = 0
        this.solid = 0
        this.collide = 1
        this.visible = 1

        this.level = props?.level??1

        this.element = props?.element??WeaponType.ELEMENT.POWER

        this.trail = []

        if (!!props?.wave) {
            // don't collide with platforms
            this.physics.group = () => {return []}
        } else {
            this.physics.group = () => {
                return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
            }
        }

        this.targets = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }

        this.alive = true

        this.animation = new AnimationComponent(this)
        this.buildAnimations()

        const d = props?.direction??Direction.RIGHT
        const v = Direction.vector(props?.direction??Direction.RIGHT)

        this.physics.xspeed = 0
        this.physics.yspeed = 0

        this.wave_counter = 0
        this.wave_loop = !!(props?.wave)

        let profile
        if (props?.wave == 2) {
            profile = Bullet.velocity_profile_spread2
        } else if (props?.wave == 1) {
            profile = Bullet.velocity_profile_wave
        } else {
            profile = Bullet.velocity_profile_spread
        }
        this.wave_profile = profile[d][this.split-1]

        this.bounce = !!(props?.bounce)
        this.bounce_max = props?.level??1
        this.bounce_counter = 0

        this.particles = [] // {x,y,dx,dy,size,color}
    }

    paint(ctx) {

        //ctx.save()
        //this.particles.forEach(p => {
        //    p.x += p.dx;
        //    p.y += p.dy;
        //    ctx.fillStyle = p.color
        //    ctx.beginPath();
        //    ctx.rect(p.x, p.y, p.size, p.size)
        //    ctx.fill()
        //    ctx.closePath();
        //})

        this.animation.paint(ctx)
        //gAssets.sheets.beams16.drawTile(ctx, this.color*7, this.rect.x - 8, this.rect.y - 8)
        //ctx.strokeStyle = this.color;
        //ctx.fillStyle = this.color;
        //ctx.beginPath();
        //ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.arc(this.rect.x+this.rect.w/2,
        //        this.rect.y+this.rect.h/2,2,0,2*Math.PI);
        //ctx.stroke();
        //ctx.fill();
        //ctx.restore()

        if (this.alive) {
            this.trail.forEach((p,i) => {
                gAssets.sheets.beams16.drawTile(ctx, this.color*7 + 1 + i, p.x - 8, p.y - 8)
            })
        }

        //this.trail.forEach((p,i) => {
        //    ctx.beginPath();
        //    ctx.fillStyle = this.color;
        //    ctx.moveTo(p.x, p.y)
        //    ctx.arc(
        //        p.x+this.rect.w/2,
        //        p.y+this.rect.h/2,
        //        2,
        //        0,2*Math.PI);
        //    ctx.closePath()
        //    ctx.fill();
        //})

    }

    update(dt) {

        this.animation.update(dt)

        if (!this.alive) {
            return
        }

        if (gEngine.frameIndex&1) {
            if (this.wave_counter < this.wave_profile.length) {
                this.physics.xspeed = this.wave_profile[this.wave_counter].x/dt
                this.physics.yspeed = this.wave_profile[this.wave_counter].y/dt
                this.wave_counter += 1
            }

            if (this.level > 1) {
                this.trail.unshift({x:this.rect.x, y:this.rect.y})
                while (this.trail.length > 2) {
                    this.trail.pop()
                }
            }

            this.physics.update(dt)
        }

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

        for (const ent of this.targets()) {
            if (ent.character.alive && this.rect.collideRect(ent.rect)) {
                ent.character.hit({element: this.element, level:this.level})
                this._kill()
            }
        }

        if (!!this.physics.collide) {
            this._kill()
        }

    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = -8
        let yoffset = -8

        this.animations = {
            "idle": null,
            "dead": null,
        }

        let ncols = 7
        let nrows = 17
        let aid;

        this.animations["idle"] = this.animation.register(gAssets.sheets.beams16,
            [this.color*7 + 0,], spf, {xoffset, yoffset})

        this.animations["dead"] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations["idle"])

    }


    _kill() {
        this.animation.setAnimationById(this.animations["dead"])
        this.physics.xspeed = 0
        this.physics.yspeed = 0
        this.alive = false
    }
    onDeathAnimationEnd() {
        this.destroy()
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
    const period = 20
    // velocity is pixels per frame
    const velocity = 300/60 * 2
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


    const vspread2_h_00 = v1
    const vspread2_h_22a = get_velocity(rotatelist(p1, -15*Math.PI/180))
    const vspread2_h_22b = get_velocity(rotatelist(p1,  15*Math.PI/180))
    const vspread2_h_45a = get_velocity(rotatelist(p1, -30*Math.PI/180))
    const vspread2_h_45b = get_velocity(rotatelist(p1,  30*Math.PI/180))

    const vspread2_d_00 = v4
    const vspread2_d_22a = get_velocity(rotatelist(p4, -15*Math.PI/180))
    const vspread2_d_22b = get_velocity(rotatelist(p4,  15*Math.PI/180))
    const vspread2_d_45a = get_velocity(rotatelist(p4, -30*Math.PI/180))
    const vspread2_d_45b = get_velocity(rotatelist(p4,  30*Math.PI/180))

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
    Bullet.velocity_profile_wave[Direction.LEFT] = Bullet.velocity_profile_wave[Direction.RIGHT].map(x => flip(x))
    Bullet.velocity_profile_wave[Direction.UPLEFT] = Bullet.velocity_profile_wave[Direction.UPRIGHT].map(x => flip(x))

    // this profile does not loop
    // bullets spread apart and then fly straight
    // spread takes the first 25% of a wave sequence (the part where the bullet
    // moves up or down). then concats the constant velocity from the first split
    const spread = (seq, p) => seq.slice(0, Math.floor(seq.length/4)).concat(p)
    Bullet.velocity_profile_spread = {
        [Direction.RIGHT]: [v1.slice(0,1), spread(v2, v1[0]), spread(v3, v1[0])],
        [Direction.UPRIGHT]: [v4.slice(0,1), spread(v5, v4[0]), spread(v6, v4[0])],
    }
    Bullet.velocity_profile_spread[Direction.LEFT] = Bullet.velocity_profile_spread[Direction.RIGHT].map(x => flip(x))
    Bullet.velocity_profile_spread[Direction.UPLEFT] = Bullet.velocity_profile_spread[Direction.UPRIGHT].map(x => flip(x))


    // up to 5 projectiles covering 60 degrees.
    Bullet.velocity_profile_spread2 = {
        [Direction.RIGHT]:   [vspread2_h_00.slice(0,1), vspread2_h_22a.slice(0,1), vspread2_h_22b.slice(0,1), vspread2_h_45a.slice(0,1), vspread2_h_45b.slice(0,1)],
        [Direction.UPRIGHT]: [vspread2_d_00.slice(0,1), vspread2_d_22a.slice(0,1), vspread2_d_22b.slice(0,1), vspread2_d_45a.slice(0,1), vspread2_d_45b.slice(0,1)],
    }
    Bullet.velocity_profile_spread2[Direction.LEFT] = Bullet.velocity_profile_spread2[Direction.RIGHT].map(x => flip(x))
    Bullet.velocity_profile_spread2[Direction.UPLEFT] = Bullet.velocity_profile_spread2[Direction.UPRIGHT].map(x => flip(x))

    console.log("spread", Bullet.velocity_profile_spread[Direction.RIGHT])
}

init_velocity()

export class BubbleBullet extends ProjectileBase {
    constructor(entid, props) {
        super(entid, props)

        this.wave = (!!props?.wave)??0
        this.bounce = (!!props?.wave)??0
        this.element = props?.element??WeaponType.ELEMENT.POWER

        let base_speed = 100
        if (props?.power < .8) {
            this.rect = new Rect((props?.x??0) - 8, (props?.y??0) - 8, 16, 16)
            this.bubble_size = 1
        } else {
            this.rect = new Rect((props?.x??0) - 16, (props?.y??0) - 16 - 5, 32, 32)
            this.bubble_size = 2
            base_speed = 60
        }

        this.physics = new Physics2dPlatform(this)
        this.physics.gravity = 0
        this.physics.xfriction = 0

        if (this.wave) {
            this.physics.group = () => {return []}
        } else {
            this.physics.group = () => {
                return Object.values(this._x_debug_map.objects).filter(ent=>{return ent instanceof PlatformBase})
            }
        }

        this.solid = 0
        this.collide = 1
        this.visible = 1
        this.alive = true

        this.alive_timer = 0
        this.alive_duration = 3.0

        this.animation = new AnimationComponent(this)
        this.buildAnimations()


        switch (props?.direction??0) {
        case Direction.LEFT:
            this.physics.xspeed = -(base_speed + Math.random()*this.rect.w*1.5)
            break;
        case Direction.RIGHT:
            this.physics.xspeed = base_speed + Math.random()*this.rect.w*1.5
            break;
        case Direction.UPLEFT:
            this.physics.xspeed = -(base_speed + Math.random()*this.rect.w*1.5)
            this.physics.xspeed = .7071 * this.physics.xspeed
            this.physics.yspeed = this.physics.xspeed
            break;
        case Direction.UPRIGHT:
            this.physics.xspeed = base_speed + Math.random()*this.rect.w*1.5
            this.physics.xspeed = .7071 * this.physics.xspeed
            this.physics.yspeed = -this.physics.xspeed
            break;
        default:
            break;
        }


        this.targets = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }


    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = 0
        let yoffset = 0

        this.animations = {
            "idle": null,
            "dead": null,
        }

        let ncols = 7
        let nrows = 17
        let aid;

        if (this.bubble_size == 1) {
            this.animations["idle"] = this.animation.register(gAssets.sheets.beams16,
                [17*ncols+0,17*ncols+1,17*ncols+2,17*ncols+1], spf, {xoffset, yoffset})
        } else {
            this.animations["idle"] = this.animation.register(gAssets.sheets.beams32,
                [0,1,2,1], spf, {xoffset, yoffset})
        }

        this.animations["dead"] = this.animation.register(
            gAssets.sheets.beams16,
            [17*ncols+4,17*ncols+5,17*ncols+6],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations["idle"])

    }

    paint(ctx) {

        //ctx.fillStyle = "red"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.closePath()
        //ctx.fill()

        this.animation.paint(ctx)

        //gAssets.sheets.beams16.drawTile(ctx, 99, this.rect.x, this.rect.y)


    }

    _kill() {
        this.animation.setAnimationById(this.animations["dead"])
        this.alive = false
    }
    onDeathAnimationEnd() {
        this.destroy()
    }


    update(dt) {

        if (this.alive) {

            this.alive_timer += dt

            this.physics.update(dt)

            if (this.alive_timer > this.alive_duration) {
                console.log(this.alive_timer)
                this._kill()
            }

            if (this.physics.xspeed >= 0) {
                this.physics.xspeed -= 50 * dt
                this.physics.yspeed -= 10 * dt

                // todo use timer to destroy
                //if (this.physics.xspeed < 5) {
                //    this._kill()
                //}
            }

            if (this.physics.xspeed <= 0) {
                this.physics.xspeed += 50 * dt
                this.physics.yspeed -= 10 * dt
                // todo use timer to destroy
                //if (this.physics.xspeed > -5) {
                //    this._kill()
                //}
            }

            if (!this.bounce && this.physics.collide) {
                this._kill()
                console.log("collision with ground")
            }


            for (const ent of this.targets()) {
                if (this.rect.collideRect(ent.rect)) {
                    ent.character.hit({element: this.element, level:this.level})
                    this._kill()
                }
            }

        }

        this.animation.update(dt)

    }
}

export class BounceBullet extends ProjectileBase {
    // a bounce bullet is only animate to appear as if it is bouncing
    // the bullet actually walks on the ground like a normal entity
    // if standing bounce the animation, otherwise do not animate the y direction


    // TODO: water should splash almost uselessly instead of bounce
    //       bubble should still be bubble bullets, but bounce off of walls and be pink
    //       level is number of bounces
    //       charge is size?
    constructor(entid, props) {
        super(entid, props)

        this.rect = new Rect((props?.x??0) - 2, (props?.y??0) - 2, 4, 4)
        this.color = props?.color??0
        this.element = props?.element??WeaponType.ELEMENT.POWER

        this.physics = new Physics2dPlatform(this,{
            xmaxspeed1: 200,
            xmaxspeed2: 200, // 35 seems right
            jumpheight: 32,
            jumpduration: .11,
        })
        this.physics.xfriction = 0
        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent instanceof PlatformBase})
        }
        this.solid = 0
        this.collide = 1
        this.visible = 1

        this.animation = new AnimationComponent(this)

        let xspeed = 180 // a bit faster than players maximum speed
        switch (props?.direction??0) {
        case Direction.LEFT:
            this.physics.xspeed = -xspeed
            break;
        case Direction.RIGHT:
            this.physics.xspeed = xspeed
            break;
        case Direction.UPLEFT:
            this.physics.xspeed = -xspeed
            this.physics.xspeed = this.physics.xspeed
            this.physics.yspeed = this.physics.jumpspeed
            break;
        case Direction.UPRIGHT:
            this.physics.xspeed = xspeed
            this.physics.xspeed = this.physics.xspeed
            this.physics.yspeed = this.physics.jumpspeed
            break;
        default:
            break;
        }

        this.buildAnimations()

        this.targets = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }


    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = -6
        let yoffset = -6

        this.animations = {
            "idle": null,
            "dead": null,
        }

        this.alive = true

        let ncols = 7
        let nrows = 17
        let aid;

        this.animations["idle"] = this.animation.register(gAssets.sheets.beams16,
            [this.color*7+4,this.color*7+5,this.color*7+6], spf, {xoffset, yoffset})

        this.animations["dead"] = this.animation.register(
            gAssets.sheets.beams16,
            [19*7+0, 19*7+1, 19*7+2, 19*7+3],
            spf, {xoffset, yoffset, loop: false, onend: this.onDeathAnimationEnd.bind(this)})



        this.animation.setAnimationById(this.animations["idle"])
    }

    paint(ctx) {

        //ctx.fillStyle = "red"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.closePath()
        //ctx.fill()

        this.animation.paint(ctx)

        //gAssets.sheets.beams16.drawTile(ctx, 99, this.rect.x, this.rect.y)


    }

    _kill() {
        this.animation.setAnimationById(this.animations["dead"])
        this.physics.xspeed = 0
        this.physics.yspeed = 0
        this.alive = false
    }
    onDeathAnimationEnd() {
        this.destroy()
    }

    update(dt) {

        if (this.alive) {
            this.physics.update(dt)

            for (const ent of this.targets()) {
                if (this.rect.collideRect(ent.rect)) {
                    ent.character.hit({element: this.element, level:this.level})
                    this._kill()
                }
            }

            if (this.physics.standing) {
            this._bounce()
            }

            if (this.physics.xcollide) {
                this._kill()
            }

        }
        this.animation.update(dt)



    }

    _bounce() {

        this.physics.yspeed = this.physics.jumpspeed
        this.physics.yaccum = 0
        this.physics.gravityboost = false
        this.physics.doublejump = true
    }
}

export class BeamBase extends ProjectileBase {
    constructor(parent) {
        super("", {})

        this.parent = parent
        this.group = this.parent.physics.group

        this.points = []

        this.targets = []
        this.influence = null

        this.charge_amount = 0
        this.charge_duration = .8

        this.strength = 6
        this.final_maximum = (20 + this.strength * 2)
        this.dx = 4

        this.oddonly = false

        this.targets2 = () => {
            return Object.values(this.parent._x_debug_map.objects).filter(ent=> ent instanceof MobBase)
        }

    }

    paint(ctx) {

        if (!!this.influence) {
            ctx.beginPath()
            ctx.fillStyle = "#00FF0022"
            ctx.rect(this.influence.x,this.influence.y,this.influence.w,this.influence.h)
            ctx.closePath()
            ctx.fill()
        }


        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            let color = (i%2==0)?"orange":"blue"
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.rect(p.x-4, p.y-1,8,6)
            ctx.closePath()
            ctx.fill()
        }
    }

    update(dt) {

        if (this.charge_amount < this.charge_duration) {
            this.charge_amount += dt
            if (this.charge_amount > this.charge_duration) {
                this.charge_amount = this.charge_duration
            }
        }

        let dx = this.parent.current_facing&Direction.LEFT?-this.dx:this.dx
        let dy = 0

        if (this.parent.current_facing&Direction.UP) {
            dy = - this.dx * .7071
            dx *= .7071
        }

        let maximum = Math.ceil(this.final_maximum * (this.charge_amount/this.charge_duration))

        this._calc_influence(this.strength, this.final_maximum, dx, dy)
        this._calc_beam(this.strength, maximum, dx, dy)


        let p = this.points[this.points.length-1]
        let rect = new Rect(p.x - 4, p.y - 4, 8, 8)
        for (const ent of this.targets2()) {
            if (rect.collideRect(ent.rect)) {
                ent.character.hit({element: WeaponType.ELEMENT.POWER, level: 1, dot: true})
            }
        }

    }

    _calc_influence(strength, maximum, dx, dy) {
        // infrequently determine the area of influence for the beam
        // objects that the beam could collide with
        if (gEngine.frameIndex%3==0) {
            this.targets = []

            // add 32 for the size of the parent sprite
            let w = ((maximum-strength) * Math.abs(dx) / 2) + ((1 + strength)*Math.abs(dx)) + 32
            let h = (maximum-strength) * Math.abs((dy || dx)) + 32 + 32 // plus an extra 32
            let x = this.parent.rect.cx()
            if (this.parent.current_facing&Direction.LEFT) {
                x -= w
            }
            let y = this.parent.rect.cy() - (maximum * Math.abs(dy) / 2) - 32 // subtract extra 32
            this.influence = new Rect(x,y,w,h)

            this.targets = this.group().filter(ent => ent.rect.collideRect(this.influence))
        }
    }

    _calc_beam(strength, maximum, dx, dy) {

        this.points = []
        let p = this.parent.weapon_offset[this.parent.current_facing]
        let x = this.parent.rect.x + p.x
        let y = this.parent.rect.y + p.y
        let d = ((dy<0)?Direction.UP:Direction.NONE) | ((dx<0)?Direction.LEFT:Direction.RIGHT)

        this.points.push({x,y,d})

        for (let i=0; i< maximum; i++) {
            if (i < strength) {
                x += dx
                y += dy
                d = ((dy<0)?Direction.UP:Direction.NONE) | ((dx<0)?Direction.LEFT:Direction.RIGHT)
            } else {
                x += dx/2
                y += (4 * .7071)

                d = Direction.DOWN | ((dx<0)?Direction.LEFT:Direction.RIGHT)

            }

            if (!this.oddonly || (this.oddonly && i%2==1)) {
                this.points.push({x,y,d})
            }

            if (this.points.length > 1) {
                if (this.targets.map(ent => ent.rect.collidePoint(x,y)).reduce((a,b)=>a+b, 0)>0) {
                    break
                }
            }
        }

    }
}

export class WaterBeam extends BeamBase {
    constructor(parent) {
        super(parent)
        // TODO: wave beam should not have gravity
        this.strength = 6
        this.final_maximum = (20 + this.strength * 2)

        this.tiles = {}

        this.tiles[Direction.RIGHT]     = [[ 7*7+0,  7*7+1,  7*7+2], [ 8*7+0,  8*7+1,  8*7+2]]
        this.tiles[Direction.LEFT]      = [[ 7*7+4,  7*7+5,  7*7+6], [ 8*7+4,  8*7+5,  8*7+6]]
        this.tiles[Direction.UPRIGHT]   = [[ 9*7+0,  9*7+1,  9*7+2], [10*7+0, 10*7+1, 10*7+2]]
        this.tiles[Direction.DOWNRIGHT] = [[ 9*7+4,  9*7+5,  9*7+6], [10*7+4, 10*7+5, 10*7+6]]
        this.tiles[Direction.UPLEFT]    = [[11*7+0, 11*7+1, 11*7+2], [12*7+0, 12*7+1, 12*7+2]]
        this.tiles[Direction.DOWNLEFT]  = [[11*7+4, 11*7+5, 11*7+6], [12*7+4, 12*7+5, 12*7+6]]

    }

    paint(ctx) {

        if (!!this.influence) {
            ctx.beginPath()
            ctx.fillStyle = "#00FF0022"
            ctx.rect(this.influence.x,this.influence.y,this.influence.w,this.influence.h)
            ctx.closePath()
            ctx.fill()
        }


        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            //let color = (i%2==0)?"orange":"blue"
            //ctx.fillStyle = color
            //ctx.beginPath()
            //ctx.rect(p.x-4, p.y-1,8,6)
            //ctx.closePath()
            //ctx.fill()
            // alternate j between 0 and 1 on every 1/4 second
            // and for every other component of the stream
            let j = (Math.floor(gEngine.frameIndex/6)+i)%2
            if (i==0) {
                gAssets.sheets.beams16.drawTile(ctx, this.tiles[p.d][j][0], p.x-8, p.y-8)
            }
            else if (i==this.points.length-1) {
                gAssets.sheets.beams16.drawTile(ctx, this.tiles[p.d][j][2], p.x-8, p.y-8)
            }
            else {
                gAssets.sheets.beams16.drawTile(ctx, this.tiles[p.d][j][1], p.x-8, p.y-8)
            }

        }
    }
}

export class FireBeam extends BeamBase {
    constructor(parent) {
        super(parent)

        // only draws every other point
        // this improves the collision detection
        this.strength = 10
        this.final_maximum = 10
        this.oddonly = true
        this.dx = 5
        this.charge_duration = .2

        this.tiles_a = []
        this.tiles_b = []

        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+1))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+1))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+2))
        this.tiles_a.push(gAssets.sheets.beams16.tile(5*7+3))

        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+1))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+1))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+2))
        this.tiles_b.push(gAssets.sheets.beams16.tile(6*7+3))

    }

    paint(ctx) {

        if (!!this.influence) {
            ctx.beginPath()
            ctx.fillStyle = "#00FF0022"
            ctx.rect(this.influence.x,this.influence.y,this.influence.w,this.influence.h)
            ctx.closePath()
            ctx.fill()
        }

        let tiles = (Math.floor(gEngine.frameIndex/15)%2==0)?this.tiles_a:this.tiles_b
        for (let i=0; i < this.points.length; i++) {
            let p = this.points[i]
            let r = Math.floor(2 + 3 * ((i+1)/this.final_maximum))
            let color = (i%2==0)?"orange":"blue"

            if (i==this.points.length-1) {
                tiles[5].draw(ctx, p.x-8+2,p.y-12+2)
            } else {
                tiles[i].draw(ctx, p.x-8+2,p.y-12+2)
            }

            //ctx.fillStyle = color
            //ctx.beginPath()
            //ctx.arc(
            //    p.x-4,
            //    p.y-1 + r,
            //    r,
            //    0,2*Math.PI)
            //ctx.closePath()
            //ctx.fill()
        }
    }
}

function generateProjectiles(x,y,direction, power) {

    let projectiles = []

    let color = 0

    switch (gCharacterInfo.element) {
    case WeaponType.ELEMENT.POWER:
        color = 1 // yellow
        break;
    case WeaponType.ELEMENT.FIRE:
        color = 0  // red
        break;
    case WeaponType.ELEMENT.WATER:
        color = 3  // red
        break;
    case WeaponType.ELEMENT.ICE:
        color = 2
        break;
    case WeaponType.ELEMENT.BUBBLE:
        color = 4
        break;
    }

    let element = gCharacterInfo.element
    let wave = (gCharacterInfo.beam === WeaponType.BEAM.WAVE)?1:0
    let bounce = gCharacterInfo.beam === WeaponType.BEAM.BOUNCE

    let normal = gCharacterInfo.modifier == WeaponType.MODIFIER.NORMAL

    let level = gCharacterInfo.level

    // ice should generate 1 projectile, which may animate with a split profile
    // fire + wave + any level + no modifier : spread gun 1,3,5 bullets
    // fire + bounce + any level + no modifier : bouncy fire ball
    // water + any beam + any level + rapid : squirt gun
    // bubble + charge : large bubbles that can be jumped on


    if (gCharacterInfo.element == WeaponType.ELEMENT.FIRE && wave && normal) {

        wave = 2
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
        if (gCharacterInfo.level >= WeaponType.LEVEL.LEVEL2) {
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
        }
        if (gCharacterInfo.level >= WeaponType.LEVEL.LEVEL3) {
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:4}})
            projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:5}})
        }

    }
    else if (gCharacterInfo.element == WeaponType.ELEMENT.BUBBLE) {
        projectiles.push({name: "BubbleBullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (bounce) {
        projectiles.push({name: "BounceBullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (wave && gCharacterInfo.level == WeaponType.LEVEL.LEVEL1) {
        // a single bullet the waves
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (bounce || gCharacterInfo.level == WeaponType.LEVEL.LEVEL1) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
    }
    else if (gCharacterInfo.level == WeaponType.LEVEL.LEVEL2) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    }
    else if (gCharacterInfo.level == WeaponType.LEVEL.LEVEL3) {
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:1}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:2}})
        projectiles.push({name: "Bullet", props: {x,y,direction,color,element,wave,bounce,level,power,split:3}})
    } else {
        throw {error: "invalid level", level: gCharacterInfo.level}
    }

    return projectiles
}

export class CharacterComponent {

    constructor(target) {
        this.target = target
        this.alive = true
        this.health = 3

        this.hurt_timer = 0
        this.hurt_cooldown = 0

        this.animation_timer = 0
        this.animation_duration = 0.4
        this.hurt_period = this.animation_duration * 3

    }

    update(dt) {

        if (this.hurt_timer > 0) {
            this.hurt_timer -= dt
            this.animation_timer += dt

            if (this.animation_timer > this.animation_duration) {
                this.animation_timer -= this.animation_duration
            }

            if (this.hurt_timer < 0 && this.health <= 0) {
                this.alive = false
            }
        }

        if (this.hurt_cooldown > 0) {
            this.hurt_cooldown -= dt
        }

    }

    hit() {
        if (this.hurt_cooldown > 0 || this.health <= 0) {
            return
        }

        this.hurt_cooldown = this.hurt_period + .25
        this.hurt_timer = this.hurt_period
        this.animation_timer = 0

        this.target.animation.effect = (ctx) => {

            if (this.hurt_timer <= 0) {
                this.target.animation.effect = null
            }
            let x;
            let d = this.animation_duration / 2
            x = ((this.animation_timer>d)?this.animation_duration-this.animation_timer:this.animation_timer)/d
            ctx.filter = `brightness(${Math.floor(100 + 100*x)}%) hue-rotate(-${90*(1-x)}deg)`

        }

        //if (this.health <= 0 && !!this.target.sound_death) {
        //    this.target.sound_death.play()
        //} else {
        //    this.target.sound_hit.play()
        //}
    }
}


export class Player extends PlatformerEntity {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 8, 24)
        this.playerId = props?.playerId??null
        this.physics = new Physics2dPlatform(this,{
            xmaxspeed1: 150,
            xmaxspeed2: 175,
            oneblock_walk: true
        })
        this.animation = new AnimationComponent(this)
        this.visible = true

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        if (Player.sheets === null) {
            throw {"error": "sprite sheet not set"}
        }

        this.character = new CharacterComponent(this)

        this.looking_up = false

        this.buildAnimations()

        this.current_action = "idle"
        this.current_facing = Direction.RIGHT

        this.charge_duration = 0.0
        this.charge_timeout = 1.1
        this.charging = false

        this.jump_pressed = false

        this._x_input = {x:0,y:0}

        this.morphed = false

        this._beam = null

        this.alive = true

    }

    buildAnimations() {

        let spf = 1/8
        let spf2 = 1/12
        let xoffset = - 12
        let yoffset = - 7
        let yoffset2 = - 19

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "morphed":{"idle": {}, "run": {}},
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

        aid = this.animation.register(Player.sheet, [1*ncols+10], spf, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.RIGHT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+10], spf, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['idle'][Direction.LEFT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+10, 1*ncols+11, 1*ncols+12, 1*ncols+13], spf2, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.LEFT] = aid

        aid = this.animation.register(Player.sheet, [1*ncols+10, 1*ncols+13, 1*ncols+12, 1*ncols+11], spf2, {xoffset, yoffset:yoffset2})
        this.animations["morphed"]['run'][Direction.RIGHT] = aid


        this.animation.setAnimationById(this.animations.run[Direction.RIGHT])

        this.weapon_offset = {}
        this.weapon_offset[Direction.RIGHT]   = {x: 12, y: 12}
        this.weapon_offset[Direction.UPRIGHT] = {x: 12, y:  3}
        this.weapon_offset[Direction.LEFT]    = {x: -8 + 3, y: 12}
        this.weapon_offset[Direction.UPLEFT]  = {x: -6, y:  3}

    }

    paint(ctx) {



        ctx.save()
        this.animation.paint(ctx)
        ctx.restore()

        //ctx.beginPath();
        //ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.fillStyle = '#FF00007f';
        //ctx.fill();

        if (!this._beam && this.charging) {
            ctx.save()
            ctx.beginPath();
            //ctx.fillStyle = '#FF0000FF';
            const p = this.charge_duration / this.charge_timeout
            const o = this.weapon_offset[this.current_facing]
            const k = Math.floor(gEngine.frameIndex/6)%3
            ctx.filter = `brightness(${75+50*k}%)`

            let color = 0
            switch (gCharacterInfo.element) {
            case WeaponType.ELEMENT.POWER:
                color = 1 // yellow
                break;
            case WeaponType.ELEMENT.FIRE:
                color = 0  // red
                break;
            case WeaponType.ELEMENT.WATER:
                color = 3  // red
                break;
            case WeaponType.ELEMENT.ICE:
                color = 2
                break;
            case WeaponType.ELEMENT.BUBBLE:
                color = 4
                break;
            }

            if (p < .3) {
                gAssets.sheets.beams16.drawTile(ctx, color*7+3, this.rect.x + o.x - 8, this.rect.y + o.y - 8 + 2)
            } else if (p < .6) {
                gAssets.sheets.beams16.drawTile(ctx, color*7+2, this.rect.x + o.x - 8, this.rect.y + o.y - 8 + 2)
            } else {
                gAssets.sheets.beams16.drawTile(ctx, color*7+0, this.rect.x + o.x - 8, this.rect.y + o.y - 8 + 2)
            }

            //ctx.rect( this.rect.x + o.x - 1, this.rect.y + o.y - 1, 5*p, 5*p);
            //ctx.arc(
            //    this.rect.x + o.x + 2, this.rect.y + o.y + 2,
            //    4*p,
            //    0,2*Math.PI);
            //ctx.fill();
            ctx.filter = ''
            ctx.closePath()
            //ctx.fill()
            ctx.restore()

        }

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.physics.action}`, this.rect.x, this.rect.y);

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        ////ctx.fillText(`${this._x_input.x.toFixed(2)},${this._x_input.y.toFixed(2)} ${this.physics.xspeed.toFixed(1)}`, this.rect.x, this.rect.y);
        //ctx.fillText(`${Math.abs(this.physics.xspeed).toFixed(1)}/${this.physics.xmaxspeed1}/${this.physics.xmaxspeed1a}`, this.rect.x, this.rect.y);
        if (!!this._beam) {
            this._beam.paint(ctx)
        }

    }

    _updateAnimation() {

        let aid;
        if (this.morphed) {
            let mfacing = this.current_facing&Direction.LEFTRIGHT
            let maction =(this.current_action != "idle")?"run":"idle"
            aid = this.animations["morphed"][maction][mfacing]
        } else {
            aid = this.animations[this.current_action][this.current_facing]
        }

        if (!aid) {
            console.error(this.physics)
            throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
        }
        this.animation.setAnimationById(aid)
    }

    update(dt) {

        this.physics.update(dt)
        this.character.update(dt)

        if (!this.alive) {

            return
        }

        if (this.charging && this.charge_duration < this.charge_timeout) {
            this.charge_duration += dt
            if (this.charge_duration > this.charge_timeout) {
                this.charge_duration = this.charge_timeout
            }

            if (!this._beam && gCharacterInfo.modifier === WeaponType.MODIFIER.RAPID) {
                let factor = 0.6
                if (gCharacterInfo.element == WeaponType.ELEMENT.BUBBLE) {
                    factor = 0.2
                }
                if (gCharacterInfo.element == WeaponType.ELEMENT.POWER) {
                    factor = 0.33
                }
                if (gCharacterInfo.element == WeaponType.ELEMENT.ICE) {
                    factor = 0.75
                }
                let timeout = this.charge_timeout*factor
                // TODO: timeout should depend on element (power faster, ice slower)
                //       or special weapon. lazer types don't need this feature
                if (this.charge_duration > timeout) {
                    this._shoot(0)
                    this.charge_duration -= timeout
                }
            }

        }

        if (!!this._beam) {
            this._beam.update(dt)
        }

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
            this._updateAnimation()

        }

        this.animation.update(dt)
    }

    onInput(payload) {

        if (!this.alive) {
            return
        }

        if ("whlid" in payload) {

            this._x_input = payload.vector
            //this.physics.direction = Direction.fromVector(payload.vector.x, payload.vector.y)

            // dead zone on mobile
            if (Math.abs(payload.vector.x) < 0.3535) {
                payload.vector.x = 0
            }

            this.physics.direction = Direction.fromVector(payload.vector.x, 0)
            //console.log(payload.vector.x, payload.vector.y)
            //if (this.physics.direction&Direction.UP) {
            if ( payload.vector.y < -0.3535) {
                this.looking_up = true
            } else {
                this.looking_up = false
            }

            // const maxspeed = 90

            //if (payload.vector.x > 0.3535) {
            //    this.physics.facing = Direction.RIGHT
            //    if (this.physics.xspeed < maxspeed) {
            //        this.physics.xspeed += maxspeed/10.0
            //        if (this.physics.xspeed > maxspeed) {
            //            this.physics.xspeed = maxspeed
            //        }
            //    }
            //}

            //else if (payload.vector.x < -0.3535) {
            //    this.physics.facing = Direction.LEFT
            //    if (this.physics.xspeed > -maxspeed) {
            //        this.physics.xspeed -= maxspeed/10.0
            //        if (this.physics.xspeed < -maxspeed) {
            //            this.physics.xspeed = -maxspeed
            //        }
            //    }
            //}

            //else {
            //    this.physics.xspeed = 0
            //}

        } else if (payload.btnid === 0) {

            this.jump_pressed = payload.pressed

            if (payload.pressed) {
                this._jump()
            } else {
                this.physics.gravityboost = true
            }

        } else if (payload.btnid === 1) {

            if (!this.morphed) {
                if (payload.pressed) {
                    this.charging = gCharacterInfo.modifier != WeaponType.MODIFIER.NORMAL
                    this.charge_duration = 0.0

                    if (gCharacterInfo.modifier == WeaponType.MODIFIER.RAPID) {

                        if (gCharacterInfo.element == WeaponType.ELEMENT.WATER && gCharacterInfo.beam != WeaponType.BEAM.BOUNCE) {
                            this._beam = new WaterBeam(this)
                        } else if (gCharacterInfo.element == WeaponType.ELEMENT.FIRE && gCharacterInfo.beam != WeaponType.BEAM.BOUNCE) {
                            this._beam = new FireBeam(this)
                        } else {
                            this._shoot(0)
                        }

                    }
                } else {
                    let power = this.charge_duration / this.charge_timeout
                    this.charge_duration = 0.0
                    this.charging = false
                    if (gCharacterInfo.modifier != WeaponType.MODIFIER.RAPID) {
                        this._shoot(power)
                    } else {
                        if (!!this._beam) {
                            this._beam = null
                        }
                    }

                }
            }

        } else if (payload.btnid === 2) {
            if (!payload.pressed) {
                if (this.morphed) {
                    this.rect.h = 24
                    this.rect.y -= 12
                    this.morphed = false

                } else {
                    this.rect.h = 12
                    this.rect.y += 12
                    this.morphed = true
                }
                this._updateAnimation()
            }

        } else {
            console.log(payload)
        }

    }

    _shoot(power) {


        let d = this.physics.facing
        if (this.looking_up) {
            d |= Direction.UP
        }

        const o = this.weapon_offset[this.current_facing]
        const px = this.rect.x + o.x
        const py = this.rect.y + o.y

        // limit the maximum number of bubbles based on weapon level
        if (gCharacterInfo.element == WeaponType.ELEMENT.BUBBLE) {
            let objs = this._x_debug_map.queryObjects({"className": "BubbleBullet"})
            objs = objs.sort((a,b)=> (+a) - +(b)).filter(obj => obj.alive)

            while (objs.length > gCharacterInfo.level*gCharacterInfo.level) {
                objs[0]._kill()
                objs.shift()
            }
        }

        generateProjectiles(px, py, d, power).forEach(obj => {

            this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), obj.name, obj.props)
        })
    }

    _bounce() {

        if (this.jump_pressed) {
            this.physics.yspeed = this.physics.jumpspeed
        } else {
            this.physics.yspeed = this.physics.jumpspeed*.75
        }
        this.physics.yaccum = 0
        this.physics.gravityboost = false
        this.physics.doublejump = true
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

    _hurt() {
        //this.character.hit()
        this._kill()
    }

    _kill() {
        this.alive =  false
        this.physics.group = () => []

        let aid = this.animations["hit"][Direction.RIGHT]
        this.animation.setAnimationById(aid)

        this.physics.direction = Direction.NONE
        this.physics.xaccum = 0
        this.physics.yspeed = this.physics.jumpspeed
        this.physics.yaccum = 0
        this.physics.gravityboost = false
        this.physics.doublejump = false
        this.physics.checkbounds = false
    }

    _revive() {

        this.alive =  true

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.rect.x = 32
        this.rect.y = 128

        let aid = this.animations["idle"][Direction.RIGHT]
        this.animation.setAnimationById(aid)

        this.physics.checkbounds = true
    }
}
Player.sheet = null

export class Brick extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    collide(other, dx, dy) {

        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            if (other instanceof Player) {
                this.destroy()
            }
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    paint(ctx) {
        Brick.icon.draw(ctx, this.rect.x, this.rect.y)
    }

    update(dt) {

    }
}
Brick.sheet = null
Brick.size = [16, 16]
Brick.icon = null

export class MobCharacterComponent {

    constructor(target) {
        this.target = target
        this.health = 300
        this.alive = true

        this.frozen = false

        this.hurt_timer = 0
        this.hurt_cooldown = 0

        this.freeze_timer = 0
        this.freeze_duration = 10

        this.animation_timer = 0
        this.animation_duration = 0.2
        this.hurt_period = this.animation_duration * 1

    }

    update(dt) {

        if (this.freeze_timer > 0) {
            this.freeze_timer -= dt
            if (this.freeze_timer <= 0) {
                this.freeze_timer = 0
                this.frozen = false
                this.target.animation.paused = false
            }
        }

        if (this.hurt_timer > 0) {
            this.hurt_timer -= dt
            this.animation_timer += dt

            if (this.animation_timer > this.animation_duration) {
                this.animation_timer -= this.animation_duration
            }

            //if (this.hurt_timer < 0 && this.health <= 0) {
            //    this.alive = false
            //    console.log("set animation", this.target.animations["dead"][Direction.NONE])
            //    this.target.setAnimationById(this.target.animations["dead"][Direction.NONE])
            //    //this.target.destroy()
            //}
        }

        if (this.hurt_cooldown > 0) {
            this.hurt_cooldown -= dt
        }

    }

    hit(attrs) {

        // dot for attacks that deal damage over time
        // allow every individual beam to deal damage
        // prevent water stream from dealing damage every frame
        if (attrs.dot) {
            if (this.hurt_cooldown > 0 || this.health <= 0) {
                return
            }
        }

        if (attrs?.element == WeaponType.ELEMENT.ICE) {
            this.frozen = true
            this.target.animation.paused = true
            this.freeze_timer = this.freeze_duration

            this.hurt_cooldown = .25
            this.hurt_timer = this.hurt_period

        } else if (attrs.dot) {
            // dot should have a per source cooldown
            this.hurt_cooldown = 0.2
            this.hurt_timer = 0.2
            this.animation_timer = 0
        } else {
            this.hurt_cooldown = this.hurt_period + .25
            this.hurt_timer = this.hurt_period
            this.animation_timer = 0
        }

        // every enemy needs a element profile
        // how much damage it takes from each attack element
        // every element needs a base damage
        const damage = 100
        this.health -= damage
        console.error(`hit ${gEngine.frameIndex} - ${this.target._classname} for ${damage}` )

        if (this.health <= 0) {
            this.target._kill()
        }

        this.target.animation.effect = (ctx) => {

            if (this.frozen) {
                let x;
                let d = this.animation_duration / 2
                x = ((this.animation_timer>d)?this.animation_duration-this.animation_timer:this.animation_timer)/d
                ctx.filter = `brightness(75%) hue-rotate(-90deg)`
            } else {
                if (this.hurt_timer <= 0) {
                    this.target.animation.effect = null
                }

                let x;
                let d = this.animation_duration / 2
                x = ((this.animation_timer>d)?this.animation_duration-this.animation_timer:this.animation_timer)/d
                ctx.filter = `brightness(${Math.floor(100 + 100*x)}%) hue-rotate(${90*(1-x)}deg)`

            }



        }

        //if (this.health <= 0 && !!this.target.sound_death) {
        //    this.target.sound_death.play()
        //} else {
        //    this.target.sound_hit.play()
        //}
    }
}

export class MobBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.character = new MobCharacterComponent(this)
    }

    _kill() {
        this.character.alive = false
    }
}

export class Spawn extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 32, 32)
        this.solid = 1

        this.spawn_timer = 0
        this.spawn_timeout = 2
        this.spawn_target = null
        this.spawning = false
    }

    paint(ctx) {

        if (this.spawn_target) {
            this.spawn_target.paint(ctx)
        }

        Spawn.sheet.drawTile(ctx, 1, this.rect.x, this.rect.y)
    }

    collide(other, dx, dy) {

        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    update(dt) {

        if (!this.spawn_target) {
            this.spawn_timer += dt
            if (this.spawn_timer > this.spawn_timeout) {
                this.spawn_timer = 0

                let objs = this._x_debug_map.queryObjects({"className": "Creeper"})

                if (objs.length < 3) {

                    // create a dummy object
                    const props = {x: this.rect.x + 8, y:this.rect.y}
                    this.spawn_target = new Creeper(-1, props)
                }

            }
        } else {

            this.spawn_target.rect.y -= 20 * dt
            if (this.spawn_target.rect.bottom() < this.rect.top()) {
                let rect = this.spawn_target.rect
                const props = {x: rect.x, y: rect.y}
                // replace the dummy with a real object
                // this is closer to the correct behavior in multiplayer
                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Creeper", props)
                this.spawn_target = null
            }

        }


    }
}
Spawn.sheet = null
Spawn.size = [32, 32]
Spawn.icon = null
Spawn.editorIcon = (props) => { return gAssets.sheets.pipes32.tile(1) }

export class Creeper extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 12, 12)

        this.animation = new AnimationComponent(this)
        this.visible = true

        this.breakable = 0
        this.solid = 1

        this.physics = new Physics2dPlatform(this,{
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
        })

        this.physics.direction = Direction.LEFT

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }


        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = - 6
        let yoffset = - 4

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "ball":{},
            "dead":{}
        }

        let ncols = 3
        let nrows = 3
        let aid;
        let sheet = Creeper.sheet

        aid = this.animation.register(sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [0*ncols+0, 0*ncols+1, 0*ncols+2], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+0, 1*ncols+1, 1*ncols+2], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animations["dead"][Direction.NONE] = this.animation.register(
            gAssets.sheets.beams16,
            [18*7+0, 18*7+1, 18*7+2, 18*7+3],
            spf, {xoffset:-2, yoffset:-2, loop: false, onend: this.onDeathAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations.run[Direction.LEFT])

    }

    collide(other, dx, dy) {

        let rect = other.rect
        let update = rect.copy()

        //if (dx > 0 && rect.right() <= this.rect.left()) {
        //    update.set_right(this.rect.left())
        //    return update
        //}

        //if (dx < 0 && rect.left() >= this.rect.right()) {
        //    update.set_left(this.rect.right())
        //    return update
        //}

        //TODO: wider collision on head the head
        if (dy > 0 && rect.bottom() <= this.rect.top()) {

            if (!this.character.frozen) {
                if (other instanceof Player) {
                    other._bounce()
                    this._kill()
                    return null
                }
            } else {
                update.set_bottom(this.rect.top())
                return update
            }

        }

        //if (dy < 0 && rect.top() >= this.rect.top()) {
        //    //this.destroy()
        //    update.set_top(this.rect.bottom())
        //    return update
        //}

        return null
    }

    paint(ctx) {
        //Brick.icon.draw(ctx, this.rect.x, this.rect.y)
        //ctx.fillStyle = "red"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.closePath()
        //ctx.fill()

        this.animation.paint(ctx)

        //ctx.font = "bold 16px";
        //ctx.fillStyle = "yellow"
        //ctx.strokeStyle = "yellow"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.physics.xspeed} ${this.physics.direction}`, this.rect.x, this.rect.y);
    }

    update(dt) {
        if (!this.character.frozen && this.character.alive) {
            this.physics.update(dt)
        }
        this.character.update(dt)
        if (this.physics.xcollide) {
            //console.log(this.physics.xspeed, this.rect.left(), this.physics.xcollisions.map(ent => ent.ent.rect.right()))
            this.physics.direction = (this.physics.direction == Direction.LEFT)?Direction.RIGHT:Direction.LEFT
            this.animation.setAnimationById(this.animations.run[this.physics.direction])
            this.physics.xspeed = 0
            this.physics.xaccum = 0
        }
        this.animation.update(dt)

    }

    _kill() {
        this.character.alive = false
        this.animation.setAnimationById(this.animations["dead"][Direction.NONE])
    }

    onDeathAnimationEnd() {
        this.destroy()
    }
}
Creeper.sheet = null
Creeper.size = [16, 16]
Creeper.icon = null

export class Shredder extends MobBase {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.animation = new AnimationComponent(this)
        this.visible = true

        this.breakable = 0
        this.alive = 1
        this.solid = 1

        this.physics = new Physics2dPlatform(this,{
            xmaxspeed1: 35,
            xmaxspeed2: 35, // 35 seems right
            gravity: 0,
        })

        this.physics.direction = Direction.LEFT

        this.physics.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        }

        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = - 4
        let yoffset = 0

        this.animations = {
            "idle":{},
            "run":{},
            "wall_slide":{},
            "jump":{},
            "fall":{},
            "hit":{},
            "ball":{},
        }

        let ncols = 3
        let nrows = 3
        let aid;
        let sheet = Shredder.sheet

        aid = this.animation.register(sheet, [0*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.LEFT] = aid

        aid = this.animation.register(sheet, [1*ncols+0], spf, {xoffset, yoffset})
        this.animations["idle"][Direction.RIGHT] = aid

        aid = this.animation.register(sheet, [0*ncols+0, 0*ncols+1], spf, {xoffset, yoffset})
        this.animations["run"][Direction.LEFT] = aid
        aid = this.animation.register(sheet, [1*ncols+0, 1*ncols+1], spf, {xoffset, yoffset})
        this.animations["run"][Direction.RIGHT] = aid

        this.animation.setAnimationById(this.animations.run[Direction.LEFT])

    }

    collide(other, dx, dy) {



        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.top()) {

            if (!this.character.frozen) {
                if (other instanceof Player) {
                    other._bounce()
                    return null
                }
            }
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            //this.destroy()
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    paint(ctx) {
        //Brick.icon.draw(ctx, this.rect.x, this.rect.y)
        ctx.fillStyle = "red"
        ctx.beginPath()
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.closePath()
        ctx.fill()

        this.animation.paint(ctx)
    }

    update(dt) {
        if (!this.character.frozen) {
            this.physics.update(dt)
        }
        this.character.update(dt)
        if (this.physics.xcollide) {
            //console.log(this.physics.xspeed, this.rect.left(), this.physics.xcollisions.map(ent => ent.ent.rect.right()))
            this.physics.direction = (this.physics.direction == Direction.LEFT)?Direction.RIGHT:Direction.LEFT
            this.animation.setAnimationById(this.animations.run[this.physics.direction])
            this.physics.xspeed = 0
            this.physics.xaccum = 0
        }
        this.animation.update(dt)

    }
}
Shredder.sheet = null
Shredder.size = [16, 16]
Shredder.icon = null

export class Coin extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        if (!Coin.tiles) {
            Coin.tiles = Coin.sheet.tiles()
        }
    }

    paint(ctx) {

        let i = Math.floor(gEngine.frameIndex / 6) % Coin.tiles.length
        Coin.sheet.drawTile(ctx, Coin.tiles[i], this.rect.x, this.rect.y)
        //Coin.icon.draw(ctx, this.rect.x, this.rect.y)

    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            let player = objs[0]

            let x1 = player.rect.cx()
            let x2 = this.rect.cx()

            let y1 = player.rect.cy()
            let y2 = this.rect.cy()

            let d = Math.sqrt(Math.pow(x1 - x2,2) + Math.pow(y1 - y2, 2))

            if (d < 16 * 7) {
                if (this.rect.collideRect(player.rect)) {
                    this.destroy()
                }

                const p = player.charge_duration / player.charge_timeout

                if (p > .9) {

                    let dx = x1 - x2
                    let dy = y1 - y2
                    let dm = Math.max(Math.abs(dx), Math.abs(dy))

                    let sx = Math.sign(dx) * (Math.abs(dx) / dm)
                    let sy = Math.sign(dy) * (Math.abs(dy) / dm)

                    this.rect.x += sx
                    this.rect.y += sy

                }

            }
        }
    }
}
Coin.sheet = null
Coin.size = [16, 16]
Coin.icon = null


export const editorEntities = [
    {name:"Coin", ctor: Coin}
    {name:"Brick", ctor: Brick}
    {name:"Creeper", ctor: Creeper}
    {name:"Shredder", ctor: Shredder}
    {name:"Spawn", ctor: Spawn}
]

export function registerEntities() {
    Player.sheet = gAssets.sheets.player

    Brick.sheet = gAssets.sheets.brick
    Brick.icon = gAssets.sheets.brick.tile(0)

    Coin.sheet = gAssets.sheets.coin
    Coin.icon = gAssets.sheets.coin.tile(0)

    // for any mob, the first row should contain
    // the 16x16 editor icon
    let editorIcon = (sheet) => {
        let icon = new SpriteSheet()
        icon.tw = 16
        icon.th = 16
        icon.rows = 1
        icon.cols = 1
        icon.xspacing = 1
        icon.yspacing = 1
        icon.xoffset = 1
        icon.yoffset = 1
        icon.image = sheet.image
        return icon.tile(0)
    }

    Creeper.sheet = gAssets.sheets.creeper
    Creeper.icon = editorIcon(Creeper.sheet)

    Shredder.sheet = gAssets.sheets.shredder
    Shredder.icon = editorIcon(Shredder.sheet)

    Spawn.sheet = gAssets.sheets.pipes32
    Spawn.icon = editorIcon(Spawn.sheet)
}