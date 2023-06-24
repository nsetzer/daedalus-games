
$import("engine", {
    ApplicationBase, Rect, Entity,
    GameScene, CameraBase,
    TextWidget, TextInputWidget,
    Alignment, Direction, CharacterComponent,
    TouchInput, KeyboardInput
})

// todo: parallax background

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

    resize() {
        this.width = gEngine.view.width
        this.height = gEngine.view.height
    }

    update(dt) {

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
        //if (x < 0) { x = 0 }
        //if (y < -32) { y = -32 }
        //let mx = this.map.width - gEngine.view.width
        //let my = this.map.height - gEngine.view.height/2
        //if (x > mx) { x = mx }
        //if (y > my) { y = my }

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

class Controller {
    constructor(scene, target) {
        this.scene = scene
        this.target = target
        this.direction = 0
        this.remotedelay = 0.1
        this.inputqueue = []
    }

    setInputDirection(whlid, vector) {
        this.inputqueue.push({t: this.remotedelay, whlid: whlid, vector: vector})
    }

    handleButtonPress(btnid) {
        // TODO: debounce keyboard input: require a release before another press
        if (btnid === 0 || btnid === 1) {
            this.inputqueue.push({t: this.remotedelay, btnid: btnid, pressed: true})
        }
    }

    handleButtonRelease(btnid) {
        if (btnid === 0 || btnid === 1) {
            this.inputqueue.push({t: this.remotedelay, btnid: btnid, pressed: false})
        }
    }

    update(dt) {

        let slice = 0
        for (let input of this.inputqueue) {
            input.t -= dt
            if (input.t < 0) {
                if (input.btnid !== undefined) {
                    if (input.pressed) {
                        this.target.physics.yspeed = this.target.physics.jumpspeed
                        this.target.physics.jumptime = performance.now()
                        this.target.physics.gravityboost = false
                        if (this.target.physics.pressing) {
                            let v = Direction.vector(this.target.direction)
                            this.target.physics.xspeed = - v.x * 512
                        }
                    } else {
                        this.target.physics.gravityboost = true
                    }
                } else if (input.whlid !== undefined) {
                    this.direction = Direction.fromVector(input.vector.x, input.vector.y)
                    this.target.setDirection(this.direction)
                }
                slice += 1
            }
        }
        if (slice > 0) {
            this.inputqueue = this.inputqueue.slice(slice)
        }

        // let speed = 128;
        // let v = Direction.vector(this.direction)
        // this.target.physics.xspeed = speed*v.x;
        // this.target.physics.yspeed = speed*v.y;

    }
}

/*

https://medium.com/@brazmogu/physics-for-game-dev-a-platformer-physics-cheatsheet-f34b09064558

g = negative
position = 0.5*g*t*t + v'*t
speed = g*t + v'

initial velocity = sqrt(2*H*g)
283.3400783510868

gravity = H/(2t*t)
jumpspeed = - sqrt(2*H*g)

*/
class Physics2d {

    constructor(target) {
        this.target = target

        this.xspeed = 0
        this.yspeed = 0

        this.ximpulse = 0
        this.yimpulse = 0

        this.group = []

        // properties that are updated on every update()
        this.xcollide = false
        this.ycollide = false
        this.collide = false
        this.collisions = new Set()

        // new for platformer
        this.standing = false
        this.pressing = false

        // the duration that gives some specified maximum velocity v'
        //      t = sqrt(H^2 / v'^2)
        // gravity for some specified height and duration
        //      g = H / (2*t^2)
        // jump speed for a given height and gravity
        //      v' = sqrt(2 * H * g)
        // height for a given initial velocity
        //      v'^2 = 2*H*g

        // selecting a maximum speed of 8 pixels per frame, at 60 frames per second
        //      max speed = 8 PPF * 60 FPS = 480
        //      h = 128
        //      t = .2666

        // jump cancel
        // instead of messing with initial velocity and duration
        //      apply a a curve to the max speed
        // when the user releases the button rapidly drop the speed to zero over multiple frames
        // this will ensure the maximum height is as calculated
        // and that when the user releases, they will go a little higher and drop normally


        this.jumpheight = 128
        this.jumpduration = .1875 // total duration divided by 4?
        this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)
        this.xmaxspeed = 50
        this.ymaxspeed = - this.jumpspeed
        this.jumptime = 0
        this.gravityboost = false
        console.log("duration", Math.sqrt(this.jumpheight*this.jumpheight / (480*480)))
        console.log("gravity", this.gravity)
        console.log("jumpspeed", this.jumpspeed)
        console.log("max vy", this.gravity * this.jumpduration/2)
        //.5 * g * t * t + v * t
        //g * t + v
        let speeds = []
        let times = [0, .25, .5, .75, 1.0, 1.04]
        for (const t of times) {
            speeds.push(this.jumpspeed + this.gravity * 4 * this.jumpduration * t)
        }
        console.log("velocities", speeds)
    }

    collidePoint(x, y) {
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && this.group[i].rect.collidePoint(x, y)) {
                return this.group[i]
            }
        }
        return null
    }

    impulse(dx, dy) {
        this.ximpulse = dx
        this.yimpulse = dy
    }

    update(dt) {
        this.xcollide = false
        this.ycollide = false
        this.collide = false
        this.collisions = new Set()

        let rect, solid;
        let dx, dy

        dx = dt*this.xspeed
        dy = dt*this.yspeed


        // move x
        rect = new Rect(
            this.target.rect.x + dx,
            this.target.rect.y,
            this.target.rect.w,
            this.target.rect.h,
        )

        solid = false;
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && rect.collideRect(this.group[i].rect)) {
                this.collisions.add(this.group[i])
                solid = true
                if (this.xspeed > 0) {
                    dx = Math.min(this.group[i].rect.left() - this.target.rect.right())
                } else if (this.xspeed < 0) {
                    dx = Math.min(this.group[i].rect.right() - this.target.rect.left())
                }
                break;
            }
        }

        if (solid) {
            //this.xspeed = 0 // Math.sign(this.xspeed) * 60
            this.xcollide = true
        }


        this.target.rect.x += dx
        if (this.xspeed > 0 && this.xcollide) {
            this.xspeed = 0
            this.pressing = true
        } else if (this.xspeed < 0 && this.xcollide) {
            this.xspeed = 0
            this.pressing = true
        } else {
            this.pressing = false
        }



        // move y
        rect = new Rect(
            this.target.rect.x,
            this.target.rect.y + dy,
            this.target.rect.w,
            this.target.rect.h,
        )

        solid = false;
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && rect.collideRect(this.group[i].rect)) {
                this.collisions.add(this.group[i])
                solid = true
                if (this.yspeed > 0) {
                    dy = Math.min(this.group[i].rect.top() - this.target.rect.bottom())
                } else if (this.yspeed < 0) {
                    dy = Math.min(this.group[i].rect.bottom() - this.target.rect.top())
                }
                break;
            }
        }

        this.target.rect.y += dy
        if (solid) {
            this.ycollide = true
        }


        this.collide = this.xcollide || this.ycollide

        if (this.yspeed > 0 && this.ycollide) {
            this.standing = true
            if (this.yspeed > 100) {
                console.log((this.jumptime - performance.now())/1000, this.yspeed)
            }
            this.yspeed = 0
        } else {
            if (this.yspeed < 0 && this.ycollide) {
                this.yspeed = 0
            }
            this.standing = false
        }


        this.yspeed += this.gravity * dt

        // increase gravity when not pressing a jump button
        if (this.gravityboost && this.yspeed < 0) {
            this.yspeed += this.gravity * dt
        }

        // check for terminal velocity
        if (this.yspeed > this.ymaxspeed) {
            this.yspeed = this.ymaxspeed
        }

        // reduce speed when pressed on a wall?
        if (this.pressing && this.yspeed > 0) {
            if (this.yspeed > this.ymaxspeed/5) {
                this.yspeed = this.ymaxspeed/5
            }
        }

        // bounds check
        if (Physics2d.maprect.w > 0) {
            if (this.target.rect.x < 0) {
                this.target.rect.x = 0
                this.xspeed = 0
            }

            let maxx = Physics2d.maprect.w - this.target.rect.w
            if (this.target.rect.x > maxx) {
                this.target.rect.x = maxx
                this.xspeed = 0
            }

            if (this.target.rect.y < 0) {
                this.target.rect.y = 0
                this.yspeed = 0
            }

            let maxy = Physics2d.maprect.h - this.target.rect.h
            if (this.target.rect.y > maxy) {

                this.target.rect.y = maxy
                this.yspeed = 0
            }
        }

    }
}

Physics2d.maprect = new Rect(0,0,0,0)

class Wall extends Entity {
    constructor() {
        super()
        //this.sheet = sheet
        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    paint(ctx) {

        let l = this.rect.x
        let t = this.rect.y
        let r = this.rect.x+this.rect.w
        let b = this.rect.y+this.rect.h

        ctx.beginPath();
        ctx.fillStyle = "#c3c3c3";
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        //for (let x=l; x<r; x+=32) {
        //    for (let y=t; y<b; y+=32) {
        //        this.sheet.drawTile(ctx, this.breakable?2:1, x, y)
        //    }
        //}
    }
}

class Character extends Entity {

    constructor() {
        super()
        this.facing = Direction.RIGHT

        this.physics = new Physics2d(this)
        this.character = new CharacterComponent(this)

    }

    setDirection(direction) {

        this.direction = direction

        if (direction&Direction.LEFTRIGHT) {
            this.facing = direction&Direction.LEFTRIGHT
        }
    }
    update(dt) {

        this.physics.xfriction = 1024
        this.physics.xacceleration = 512
        this.physics.xmaxspeed = 256

        if ((this.direction & Direction.LEFT) > 0) {
            if (this.physics.xspeed > -this.physics.xmaxspeed) {
                this.physics.xspeed -= this.physics.xacceleration * dt
            }
        } else if ((this.direction & Direction.RIGHT) > 0) {
            if (this.physics.xspeed < this.physics.xmaxspeed) {
                this.physics.xspeed += this.physics.xacceleration * dt
            }
        } else if (this.physics.standing) {
            if (Math.abs(this.physics.xspeed) < this.physics.xfriction * dt) {
                this.physics.xspeed = 0
            } else {
                this.physics.xspeed -= Math.sign(this.physics.xspeed) * this.physics.xfriction * dt
            }
        }
        if (this.physics.xspeed > this.physics.xmaxspeed) {
            this.physics.xspeed = this.physics.xmaxspeed
        }
        if (this.physics.xspeed < -this.physics.xmaxspeed) {
            this.physics.xspeed = -this.physics.xmaxspeed
        }

        this.physics.update(dt)
        // this.animation.update(dt)
        this.character.update(dt)

    }

    paint(ctx) {

        ctx.fillStyle = this.physics.standing?"#00bb00":this.physics.pressing?"#665533":"#009933";
        ctx.beginPath()
        ctx.rect(this.rect.x,this.rect.y,this.rect.w,this.rect.h)
        ctx.fill()

        ctx.fillText(`${this.direction} ${this.physics.standing} ${Math.floor(this.physics.xspeed)}`, 32, 32)

        ctx.beginPath()
        ctx.fillStyle = "#000000";
        let offset = (this.facing==Direction.LEFT)?-5:5
        ctx.rect(this.rect.x+16+offset+2,this.rect.y + 6,6,3)
        ctx.rect(this.rect.x+16+offset-2-6,this.rect.y + 6,6,3)
        ctx.fill()


        //this.animation.paint(ctx)


    }
}

class DemoScene extends GameScene {

    constructor() {
        super()

        this.walls = []
        this.entities = []

        let mapw = 640
        let maph = 360
        Physics2d.maprect = new Rect(0,0,mapw,maph)

        this.map = {width: mapw, height: maph}
        console.log(gEngine.view, this.map)

        let w;
        w = new Wall()
        w.rect.x = 0
        w.rect.y = 320
        w.rect.w = mapw
        w.rect.h = 32
        this.walls.push(w)

        w = new Wall()
        w.rect.x = this.map.width/2 - 32
        w.rect.y = 320 - 32
        w.rect.w = 64
        w.rect.h = 32
        this.walls.push(w)

        w = new Wall()
        w.rect.x = 128
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = maph - 128
        this.walls.push(w)

        w = new Wall()
        w.rect.x = mapw - 128 - 32
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = maph - 128
        this.walls.push(w)

        let ent;
        ent = new Character()
        ent.rect.x = 304
        ent.rect.y = 128
        ent.rect.w = 32
        ent.rect.h = 32
        ent.physics.group = this.walls

        this.player = ent

        this.entities.push(ent)


        this.controller = new Controller(this, this.player)
        this.touch = new TouchInput(this.controller)

        this.keyboard = new KeyboardInput(this.controller);
        this.camera = new Camera(this.map, this.player)
    }

    handleTouches(touches) {
        this.touch.handleTouches(touches)
    }

    handleKeyPress(keyevent) {
        this.keyboard.handleKeyPress(keyevent);
    }

    handleKeyRelease(keyevent) {
        this.keyboard.handleKeyRelease(keyevent);

    }

    resize() {

    }

    update(dt) {

        this.controller.update(dt)
        this.camera.update(dt)

        for (let i = this.entities.length - 1; i >= 0; i--) {
            let ent = this.entities[i]
            ent.update(dt)
        }

    }

    paint(ctx) {

        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        ctx.save()

        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -this.camera.y)

        for (let y=32; y < this.map.height; y+=32) {
            ctx.strokeStyle = "#FFFFFF1f"
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(this.map.width, y)
            ctx.stroke()
        }

        for (let i = this.walls.length - 1; i >= 0; i--) {
            let ent = this.walls[i]
            ent.paint(ctx)
        }

        for (let i = this.entities.length - 1; i >= 0; i--) {
            let ent = this.entities[i]
            ent.paint(ctx)
        }

        ctx.restore()
        this.touch.paint(ctx)

    }

}


export default class Application extends ApplicationBase {
    constructor() {
        super({
            portrait: 0,
            fullscreen: 0
        }, () => {
            return new DemoScene()
        })


    }
}