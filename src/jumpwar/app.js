
/**
 * jump war
 */
$import("daedalus", {})

$import("engine", {
    ApplicationBase, Rect, Entity,
    GameScene, CameraBase,
    TextWidget, TextInputWidget,
    Alignment, Direction,
    AnimationComponent, CharacterComponent,
    TouchInput, KeyboardInput, RealTimeClient,
    ArrowButtonWidget
})

$import("scenes", {global, ResourceLoaderScene})

/**
 * jump war
 */

function mean(seq) {

    let total = 0
    for (const v of seq) {
        total += v
    }
    return total / seq.length
}

function stddev(seq, ddof = 1) {
    let m = mean(seq)
    if (seq.length < 2) {
        return 0
    }

    let total = 0
    for (const v of seq) {
        total += (v - m) * (v - m)
    }

    return Math.sqrt(total / (seq.length - ddof))
}

function normalPolar(mean=0, stdev=1) {
    while (true) {

        const x = ((1 - Math.random()) * 2) - 1
        const y = (Math.random() * 2) - 1
        const s = x*x + y*y
        const t = Math.sqrt(-2 * Math.log(s)/s)
        if (s < 1) {
            return mean + stdev * (x * t)
        }
    }
}

function normalBoxMuller(mean=0, stdev=1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

class RingBuffer {

    constructor(capacity) {

        this.capacity = capacity
        this.data = []
        for (let i = 0; i < capacity; i++) {
            this.data.push(null)
        }

    }

    set(index, value) {
        this.data[index % this.capacity] = value
    }

    get(index) {
        return this.data[index % this.capacity]
    }
}

const byteSize = str => new Blob([str]).size

class DummyClient {

    constructor(callback) {

        // average total bytes sent and received over a 3 second window
        this.rb_xmit = new RingBuffer(60*3)
        this.total_sent = 0
        this.total_received = 0

        this.callback = callback

        this.latency_mean = 200
        this.latency_stddev = 75
        this.packet_lossrate = 0.0


        this.frame_index = 0
        this.inputqueue = []
        this.inputqueue_capacity = 240
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push([])
        }

        this.rb_xmit.set(this.frame_index, {sent:0, received:0})
    }

    send(obj) {

        let nbytes = byteSize(JSON.stringify(obj))
        this.total_sent += nbytes
        this.rb_xmit.get(this.frame_index).sent += nbytes

        if (Math.random() < this.packet_lossrate) {
            return
        }

        const framerate = 60
        const latmin = this.latency_mean - this.latency_stddev
        const latmax = this.latency_mean + this.latency_stddev
        let latency = normalBoxMuller(this.latency_mean, this.latency_stddev)
        latency = Math.min(latmax, Math.max(latmin, latency))
        const offset = Math.round(framerate*latency/1000)
        const idx = (this.frame_index + offset) % this.inputqueue_capacity
        this.inputqueue[idx].push(obj)
    }

    update(dt) {
        this.frame_index += 1

        const info = this.rb_xmit.get(this.frame_index)
        if (!!info) {
            this.total_sent -= info.sent
            this.total_received -= info.received
        }
        this.rb_xmit.set(this.frame_index, {sent:0, received:0})

        const idx = (this.frame_index) % this.inputqueue_capacity
        if (this.inputqueue[idx].length > 0) {
            for (const obj of this.inputqueue[idx]) {
                this.onMessage(obj)
            }
            this.inputqueue[idx] = []
        }
    }

    connected() {
        return true
    }

    onMessage(obj) {

        let nbytes = byteSize(JSON.stringify(obj))
        this.total_received += nbytes
        this.rb_xmit.get(this.frame_index).received += nbytes

        this.callback(obj)
    }
}

class DemoRealTimeClient extends RealTimeClient {

    constructor(callback) {
        super();
        this.callback = callback
        this.dcInterval = null
    }

    onClose() {
        console.log("rtc closed")
    }

    onOpen() {
        console.log("rtc opened")
    }

    onMessage(evt) {
        const obj = JSON.parse(evt.data)
        this.callback(obj)
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
        // allow the camera to display outside of the map
        // so that the character is never under the inputs
        let input_border = 192
        if (x < -input_border) { x = -input_border}
        //if (y < -32) { y = -32 }
        let mx = this.map.width - gEngine.view.width + input_border
        let my = this.map.height - gEngine.view.height
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

function apply_input(input, physics) {

    if (input.btnid !== undefined) {
        if (input.pressed) {

            // coyote time
            let standing = physics.standing_frame >= (physics.frame_index - 6)
            let pressing = physics.pressing_frame >= (physics.frame_index - 6)

            if (standing) {

                physics.yspeed = physics.jumpspeed
                physics.gravityboost = false
                physics.doublejump = true

            } else if (pressing && !standing) {
                //let v = Direction.vector(physics.direction)
                //physics.xspeed = - v.x * physics.xjumpspeed
                physics.xspeed = physics.pressing_direction * physics.xjumpspeed
                physics.yspeed = physics.jumpspeed / Math.sqrt(2)
                physics.gravityboost = false
                console.log("wall jump", physics.xspeed)

            } else if (!standing && physics.doublejump && physics.yspeed > 0) {
                console.log("double jump")
                // double jump at half the height of a normal jump
                physics.yspeed = physics.jumpspeed / Math.sqrt(2)
                physics.gravityboost = false
                physics.doublejump = false
                physics.doublejump_position = {x:physics.target.rect.cx(), y: physics.target.rect.bottom()}
                physics.doublejump_timer = .4
            }
        } else {
            physics.gravityboost = true
        }
    }
    else if (input.whlid !== undefined) {
        physics.direction = input.direction
        // TODO: maybe facing should only change when physics.update is run?
        if (physics.direction != 0) {
            physics.facing = physics.direction
        }
    }
}

class Controller {
    constructor(scene, target) {
        this.scene = scene
        this.target = target
        this.remotedelay = 6

        this.inputqueue_capacity = 7
        this.inputqueue = []
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push([])
        }

        this.remotetimer = 0
        this.remotetimeout = 0.1

        this.keepalivetimer = 0
        this.keepalivetimeout = 1.0

        this.frame_id = 0
        this.input_id = 0

        this.last_direction = 0

        //this.update_sent = false
    }

    setInputDirection(whlid, vector) {

        // de-bounce touch input
        let direction = Direction.fromVector(vector.x, vector.y)&Direction.LEFTRIGHT
        if (direction != this.last_direction) {
            let message = {
                whlid: whlid,
                direction: direction,
                frame: this.frame_id,
                uid: this.input_id
            }
            this.input_id += 1

            //this.update_sent = false
            let idx = (this.frame_id+this.remotedelay)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
            this.last_direction = direction
        }

    }

    handleButtonPress(btnid) {
        if (btnid === 0 || btnid === 1) {
            let message = {
                btnid: btnid,
                pressed: true,
                frame: this.frame_id,
                uid: this.input_id
            }
            this.input_id += 1

            //this.update_sent = false
            let idx = (this.frame_id+this.remotedelay)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
        }
    }

    handleButtonRelease(btnid) {
        if (btnid === 0 || btnid === 1) {
            let message = {
                btnid: btnid,
                pressed: false,
                frame: this.frame_id,
                uid: this.input_id
            }
            this.input_id += 1

            //this.update_sent = false
            let idx = (this.frame_id+this.remotedelay)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
        }
    }

    sendInput() {

        let inputs = []
        for (const messages of this.inputqueue) {
            for (const message of messages) {
                inputs.push(message)
            }
        }

        if (inputs.length > 0) {
            const message = {
                type: "input",
                inputs: inputs
            }
            this.scene.client.send(message)
        }
    }

    update(dt) {

        this.frame_id += 1

        this.sendInput()

        this.remotetimer += dt
        if (this.remotetimer > this.remotetimeout) {
            this.remotetimer -= this.remotetimeout

            // TODO: counter to send N updates after last input?
            //if (!this.update_sent) {
                let message = {
                    type: "update",
                    x: this.target.rect.x,
                    y: this.target.rect.y,
                    frame: this.frame_id,
                }
                this.scene.client.send(message)

                this.update_sent = true
            //}
        }

        this.keepalivetimer += dt
        if (this.keepalivetimer > this.keepalivetimeout) {
            this.keepalivetimer -= this.keepalivetimeout
            let message = {
                "type": "keepalive",
                t0: performance.now(),
            }
            this.scene.client.send(message)
        }

        let msgcnt = 0
        for (let k = 0; k < this.inputqueue_capacity; k++) {
            msgcnt += this.inputqueue[k].length
        }
        //console.log(msgcnt)

        let idx = (this.frame_id)%this.inputqueue_capacity
        if (this.inputqueue[idx].length > 0){
            for (let input of this.inputqueue[idx]) {
                apply_input(input, this.target.physics)
            }
            this.inputqueue[idx] = []
        }

    }
}

class RemoteController1 {
    // interpolate between two received states
    constructor() {

        this.queue = []

        this.first_received = false
        this.previous_state = null
        this.previous_clock = 0

        this.position = {x:0, y:0}
        this.input_clock = 0
        this.input_delay = 0.1
    }

    receiveState(state) {
        //
        //this.position.x = state.x
        //this.position.y = state.y

        // state.t0 /= 1000

        if (!this.first_received) {
            this.input_clock = state.t0
            this.first_received =  true
        }

        let t =  this.input_clock - this.input_delay

        if (state.t0 >= t) {
            this.queue.push(state)
            this.queue.sort((a,b) => {
                a.t0 - b.t0
            })
        } else {
            console.log("drop", state)
            self.input_clock += (t - state.t0)/4
        }

    }

    update(dt) {

        this.input_clock += dt

        if (this.queue.length > 0) {

            let t = this.queue[0].t0
            let c = this.input_clock - this.input_delay
            if (t < c) {

                let state = this.queue.shift()

                this.position.x = state.x
                this.position.y = state.y

                this.previous_state = state
                this.previous_clock = state.t0
                //console.log(1, t, c, this.position, state)

            } else if (this.previous_state != null) {
                let t0 = this.previous_clock
                let p = (c - t0) / (t - t0)

                let x1 = this.previous_state.x
                let y1 = this.previous_state.y
                let x2 = this.queue[0].x
                let y2 = this.queue[0].y

                this.position.x = x1 + p * (x2 - x1)
                this.position.y = y1 + p * (y2 - y1)
                //console.log(2, p, this.position)

            }
        }



    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#FFFF007f"
        ctx.rect(this.position.x, this.position.y, 16, 16)
        ctx.fill()
    }
}

class RemoteController2 {
    // run simulation on user input
    // synchronize periodically
    constructor() {

        //this.queue = []

        // capacity allows for +/- 2 seconds of inputs to be queued or cached
        this.inputqueue_capacity = 120
        this.inputqueue = []
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push({})
        }

        this.ent = new Character()
        this.rect = this.ent.rect

        this.position = {x:0, y:0}
        this.error = {x:0, y:0}
        this.physics = this.ent.physics // new Physics2d(this)

        this.first_received = false
        this.previous_state = null
        this.previous_clock = 0

        this.input_clock = 0
        // double the input delay from 6 to 12
        // the simulation now runs 6 frames behind real time
        // the update ghost runs 6 frames behind

        this.input_delay = 12

        this.received_offset = 0
    }

    receiveState(message) {

        let inputs;
        if (message.type == "update") {
            inputs = [message]
        } else {
            inputs = message.inputs
        }

        let dirty_index = this.input_clock

        for (const state of inputs) {

            if (!this.first_received) {
                // TODO: should this be index - delay?
                this.input_clock = state.frame
                this.first_received =  true
            }

            // TODO: check for rounding errors and modulous index
            let delta = this.inputqueue_capacity/2
            if (state.frame < (this.input_clock - delta) || state.frame > (this.input_clock + delta)) {
                console.log("drop stale state", this.input_clock - state.frame, this.input_clock, state.frame, state)
                //this.input_clock -= Math.round((this.input_clock - state.frame)/4)
                return
            }


            // console.log("offset", )


            let idx = (state.frame) % this.inputqueue_capacity
            if (this.inputqueue[idx][state.uid] === undefined) {
                this.inputqueue[idx][state.uid] = state

                if (state.frame <= this.input_clock - this.input_delay && state.type !== "update") {

                    dirty_index = Math.min(dirty_index, state.frame)
                }
                //this.received_offset = Math.max(this.received_offset, state.frame - (this.input_clock - this.input_delay))
            }

            // received offset is how far in the future there are updates from now
            this.received_offset = -1
            for (let i = 0; i < 60; i++) {
                let j = (this.input_clock - this.input_delay + i) % this.inputqueue_capacity
                if (j > 0 && Object.keys(this.inputqueue[j]).length > 0) {
                    this.received_offset = i
                }
            }
        }

        if (dirty_index < this.input_clock) {
            console.log("found dirty index at", dirty_index, this.input_clock- this.input_delay, "offset", this.received_offset)
        }

    }

    update(dt) {

        this.input_clock += 1


        let idx;
        idx = (this.input_clock - 60) % this.inputqueue_capacity
        if (idx < 0) {
            idx += this.inputqueue_capacity
        }
        this.inputqueue[idx] = {}

        idx = (this.input_clock - 6) % this.inputqueue_capacity
        if (idx < 0) {
            idx += this.inputqueue_capacity
        }
        if (Object.keys(this.inputqueue[idx]).length > 0) {
            for (const key in this.inputqueue[idx]) {
                const state = this.inputqueue[idx][key]
                if (state.type === "update") {

                    this.position.x = state.x
                    this.position.y = state.y

                    this.error.x = this.rect.x - this.position.x
                    this.error.y = this.rect.y - this.position.y

                    // todo: smooth this out somehow
                    this.rect.x = this.position.x
                    this.rect.y = this.position.y


                }
            }
        }

        idx = (this.input_clock - this.input_delay) % this.inputqueue_capacity
        if (idx < 0) {
            idx += this.inputqueue_capacity
        }

        if (Object.keys(this.inputqueue[idx]).length > 0) {

            for (const uid in this.inputqueue[idx]) {
                const state = this.inputqueue[idx][uid]
                if (state.type !== "update") {
                    apply_input(state, this.physics)
                    state.applied = true
                }
            }
        }

        this.ent.update(dt)
        // this.physics.update(dt)
    }

    paint(ctx) {

        ctx.save()
        ctx.filter = `hue-rotate(+180deg)`
        ctx.globalAlpha = 0.25;
        this.ent.paint(ctx)
        ctx.restore()

        //ctx.beginPath();
        //ctx.fillStyle = "#00FF007f"
        //ctx.rect(this.rect.x, this.rect.y, 16, 16)
        //ctx.fill()

        //ctx.beginPath();
        //ctx.fillStyle = "#FF00007f"
        //ctx.rect(this.position.x, this.position.y, 16, 16)
        //ctx.fill()

    }

    paintOverlay(ctx) {
        // draw an animation of the packets as they arrive
        ctx.save()
        let bw = 4
        let w = bw*this.inputqueue_capacity
        let h = 6
        ctx.fillStyle = "#7f7f7f"
        ctx.beginPath()
        ctx.rect(0, 16, w, h)
        ctx.fill()
        // draw center marker
        ctx.fillStyle = "#0000FF"
        ctx.beginPath()
        ctx.rect(w/2, 8, 2, 16)
        ctx.fill()

        for (let i=-60; i<60; i++) {
            let j = this.input_clock + i - this.input_delay
            if (j < 0) {
                j += this.inputqueue_capacity
            }
            j = j % this.inputqueue_capacity

            if (Object.keys(this.inputqueue[j]).length > 0) {
                let x = i*bw + w/2
                let y = 16
                let k = 0;
                for (const key in this.inputqueue[j]) {
                    let state = this.inputqueue[j][key]
                    ctx.beginPath()
                    if (state.type == "update") {
                        ctx.fillStyle = "#FFFF00"
                        continue
                    } else if (state.applied) {
                        ctx.fillStyle = "#00FF00"
                    } else {
                        ctx.fillStyle = "#FF0000"
                    }
                    ctx.rect(x, y, bw, h)
                    ctx.fill()
                }

            }
        }
        ctx.restore()
    }

}

class Physics2d {

    constructor(target) {
        this.target = target
        this.group = []

        // state
        this.frame_index = 0 // candidate for 'world state'
        this.direction = 0
        this.xspeed = 0
        this.yspeed = 0
        this.gravityboost = false // more gravity when button not pressed
        this.doublejump = false
        this.doublejump_position = {x:0, y: 0}
        this.doublejump_timer = 0

        // computed states
        this.action = "idle"
        this.facing = Direction.RIGHT

        // properties that are updated on every update()
        this.xcollide = false
        this.ycollide = false
        this.collide = false
        this.collisions = new Set()

        this.standing = false       //
        this.standing_frame = 0     // last frame standing on the ground
        this.pressing = false       //
        this.pressing_frame = 0     // last frame pressing on a wall
        this.pressing_direction = 1 // multiplier to wall jump in the opposite direction

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

        this.xmaxspeed = 7*32
        this.xfriction = this.xmaxspeed / .1 // stop moving in .1 seconds
        this.xacceleration = this.xmaxspeed / .2 // get up to max speed in .2 seconds
        // horizontal direction in a wall jump
        this.xjumpspeed = Math.sqrt(2*32*this.xacceleration) // sqrt(2*distance*acceleration)

        this.jumpheight = 96
        //this.jumpduration = .1875 // total duration divided by 4?
        this.jumpduration = .22 // total duration divided by 4?
        this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)

        this.ymaxspeed = - this.jumpspeed

        // log velocity over time
        let speeds = []
        let times = [0, .25, .5, .75, 1.0]
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

    update(dt) {
        this.frame_index += 1

        this.xcollide = false
        this.ycollide = false
        this.collide = false
        this.collisions = new Set()

        if ((this.direction & Direction.LEFT) > 0) {
            if (this.xspeed > -this.xmaxspeed) {
                this.xspeed -= this.xacceleration * dt
            }
        } else if ((this.direction & Direction.RIGHT) > 0) {
            if (this.xspeed < this.xmaxspeed) {
                this.xspeed += this.xacceleration * dt
            }
        } else if (this.standing) {
            if (Math.abs(this.xspeed) < this.xfriction * dt) {
                this.xspeed = 0
            } else {
                this.xspeed -= Math.sign(this.xspeed) * this.xfriction * dt
            }
        }
        if (this.xspeed > this.xmaxspeed) {
            this.xspeed = this.xmaxspeed
        }
        if (this.xspeed < -this.xmaxspeed) {
            this.xspeed = -this.xmaxspeed
        }


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
            this.pressing = this.frame_index
            this.pressing_frame = this.frame_index
            this.pressing_direction = -1
        } else if (this.xspeed < 0 && this.xcollide) {
            this.xspeed = 0
            this.pressing = this.frame_index
            this.pressing_frame = this.frame_index
            this.pressing_direction = 1
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
            this.standing_frame = this.frame_index
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
            if (this.target.rect.x < Physics2d.maprect.x) {
                this.target.rect.x = Physics2d.maprect.x
                this.xspeed = 0
            }

            let maxx = Physics2d.maprect.w - this.target.rect.w
            if (this.target.rect.x > maxx) {
                this.target.rect.x = maxx
                this.xspeed = 0
            }

            if (this.target.rect.y < Physics2d.maprect.y) {
                this.target.rect.y = Physics2d.maprect.y
                this.yspeed = 0
            }

            let maxy = Physics2d.maprect.h - this.target.rect.h
            if (this.target.rect.y > maxy) {

                this.target.rect.y = maxy
                this.yspeed = 0
            }
        }

        // double_jump
        // fall
        // hit
        // idle
        // jump
        // run
        // wall_slide

        if (this.doublejump_timer > 0) {
            this.doublejump_timer -= dt
        }


        let not_moving = this.direction == 0 && Math.abs(this.xspeed) < 30
        let falling = !this.standing && this.yspeed > 0
        let rising = this.yspeed < 0
        if (falling) {
            if (this.pressing) {
                this.action = "wall_slide"
            } else {
                this.action = "fall"
            }
        } else if (rising) {
            if (!this.doublejump) {
                this.action = "double_jump"
            } else {
                this.action = "jump"
            }
        } else if (not_moving) {
            this.action = "idle"
        } else {
            this.action = "run"
        }

    }

    getState() {
        const state = {
            x: this.target.rect.x,
            y: this.target.rect.y,
            frame_index: this.frame_index,
            direction: this.direction,
            xspeed: this.xspeed,
            yspeed: this.yspeed,
            gravityboost: this.gravityboost,
            doublejump: this.doublejump,
            doublejump_position: this.doublejump_position,
            doublejump_timer: this.doublejump_timer,
        }
    }

    setState(state) {
        this.target.rect.x = state.x
        this.target.rect.y = state.y
        this.frame_index = state.frame_index
        this.direction = state.direction
        this.xspeed = state.xspeed
        this.yspeed = state.yspeed
        this.gravityboost = state.gravityboost
        this.doublejump = state.doublejump
        this.doublejump_position = state.doublejump_position
        this.doublejump_timer = state.doublejump_timer
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
        this.current_action = "idle"
        this.current_facing = Direction.RIGHT


        this.rect.w = 16
        this.rect.h = 16

        this.physics = new Physics2d(this)
        this.animation = new AnimationComponent(this)
        this.character = new CharacterComponent(this)

        this.buildAnimations()

        this.spawning = true

    }

    buildAnimations() {

        this.animations = {
            "double_jump": {},
            "fall": {},
            "hit": {},
            "idle": {},
            "jump": {},
            "run": {},
            "wall_slide": {},
            "appear": {},
            "disappear": {},
        }

        let chara = "frog"
        let idx = "0"
        let spf = 0.06
        let xoffset = - 8
        let yoffset = - 16

        let defines1 = [
            ["double_jump",Direction.LEFT,  `${chara}_${idx}_l_double_jump`],
            ["fall",       Direction.LEFT,  `${chara}_${idx}_l_fall`],
            ["hit",        Direction.LEFT,  `${chara}_${idx}_l_hit`],
            ["idle",       Direction.LEFT,  `${chara}_${idx}_l_idle`],
            ["jump",       Direction.LEFT,  `${chara}_${idx}_l_jump`],
            ["run",        Direction.LEFT,  `${chara}_${idx}_l_run`],
            ["wall_slide", Direction.LEFT,  `${chara}_${idx}_l_wall_slide`],
            ["double_jump",Direction.RIGHT, `${chara}_${idx}_r_double_jump`],
            ["fall",       Direction.RIGHT, `${chara}_${idx}_r_fall`],
            ["hit",        Direction.RIGHT, `${chara}_${idx}_r_hit`],
            ["idle",       Direction.RIGHT, `${chara}_${idx}_r_idle`],
            ["jump",       Direction.RIGHT, `${chara}_${idx}_r_jump`],
            ["run",        Direction.RIGHT, `${chara}_${idx}_r_run`],
            ["wall_slide", Direction.RIGHT, `${chara}_${idx}_r_wall_slide`],
        ]

        let defines2 = [
            ["appear",    Direction.LEFT,  `default_l_appear`],
            ["disappear", Direction.LEFT,  `default_l_disappear`],
            ["appear",    Direction.RIGHT, `default_r_appear`],
            ["disappear", Direction.RIGHT, `default_r_disappear`],
        ]

        for (const info of defines1) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(sheet, sheet.tiles(), spf, {xoffset, yoffset})
            this.animations[animation_name][direction] = aid
        }

        spf = 1/14
        xoffset = -40
        yoffset = -48
        let onend = this.onSpawnAnimationEnd.bind(this)
        for (const info of defines2) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(
                sheet, sheet.tiles(), spf, {xoffset, yoffset, loop: false, onend}
            )
            this.animations[animation_name][direction] = aid
        }

        this.animation.setAnimationById(this.animations.appear[this.physics.facing])
    }

    //setDirection(direction) {

        //this.physics.direction = direction&Direction.LEFTRIGHT

        //if (direction&Direction.LEFTRIGHT) {
        //    this.physics.facing = direction&Direction.LEFTRIGHT
        //    this.animation.setAnimationById(this.animations[this.current_action][this.physics.facing])
        //}
    //}

    onSpawnAnimationEnd() {
        let aid = this.animations[this.current_action][this.current_facing]
        this.animation.setAnimationById(aid)
        this.spawning = false
    }

    update(dt) {


        this.physics.update(dt)

        if (!this.spawning) {
            if (this.physics.facing != this.current_facing) {
                this.current_facing = this.physics.facing
                let aid = this.animations[this.current_action][this.current_facing]
                this.animation.setAnimationById(aid)
            }

            if (this.physics.action != this.current_action) {
                this.current_action = this.physics.action
                let aid = this.animations[this.current_action][this.current_facing]
                this.animation.setAnimationById(aid)
            }
        }

        this.animation.update(dt)
        this.character.update(dt)

    }

    paint(ctx) {

        //ctx.fillStyle = this.physics.standing?"#00bb00":this.physics.pressing?"#665533":"#009933";
        //ctx.beginPath()
        //ctx.rect(this.rect.x,this.rect.y,this.rect.w,this.rect.h)
        //ctx.fill()

        this.animation.paint(ctx)

        if (this.physics.doublejump_timer > 0) {
            const p = this.physics.doublejump_position

            ctx.strokeStyle = "#CCCC004f"
            ctx.beginPath()
            ctx.roundRect(p.x-9, p.y, 18, 4, 4)
            ctx.stroke()
        }
    }
}

class DemoScene extends GameScene {

    constructor() {
        super()

        let mapw = 640 * 2
        let maph = 360

        this.game_ready = false

        this.messages = []
        this.widgets = []
        this.map = {width: mapw, height: maph}
        this.buildMap()

        this.profiles = [
            {name: "Excellent", mean: 25, stddev: 0, droprate: 0},
            {name: "good", mean: 50, stddev: 10, droprate: 0},
            {name: "bad", mean: 200, stddev: 100, droprate: 0},
            {name: "poor", mean: 250, stddev: 150, droprate: 0},
        ]

        const query = daedalus.util.parseParameters()
        this.profile_index = parseInt(query.quality)||0
        if (this.profile_index < 0 || this.profile_index > this.profiles.length - 1) {
            this.profile_index = 0
        }


        if (0 && daedalus.env.debug) {
            this.client = new DemoRealTimeClient(this.handleMessage.bind(this))
            this.client.connect("/rtc/offer", {})




        } else {
            this.client = new DummyClient(this.handleMessage.bind(this))
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            this.buildWidgets()
        }

        // statistics on received information
        this.latencies = []
        this.latency_max = 0
        this.latency_min = 0
        this.latency_mean = 0
        this.latency_stddev = 0
        this.message_count = 0

    }

    buildWidgets() {

        let wgtx = gEngine.view.width - 32
        let wgto = 128
        let wgty = 8
        let wgth = 24

        let wgt1, wgt2, txt1, txt2;
        wgt1 = new ArrowButtonWidget(Direction.LEFT)
        wgt1.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt1)
        wgt2 = new ArrowButtonWidget(Direction.RIGHT)
        wgt2.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt2)
        txt1 = new TextWidget()
        txt1.rect = new Rect(
            wgt1.rect.right() + 8,
            wgt1.rect.y - 2,
            wgt2.rect.left() - wgt1.rect.right() - 16,
            wgt1.rect.h + 4
        )
        txt1._text = "lat mean"
        txt1._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt1)
        txt2 = new TextWidget()
        txt2.rect = new Rect(
            wgt1.rect.right() + 8,
            wgt1.rect.y - 8,
            wgt2.rect.left() - wgt1.rect.right() - 16,
            wgt1.rect.h + 16
        )
        txt2._text = this.client.latency_mean
        txt2._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt2)


        let wgt3, wgt4, txt3, txt4;
        wgty += wgth + 12
        wgt3 = new ArrowButtonWidget(Direction.LEFT)
        wgt3.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt3)
        wgt4 = new ArrowButtonWidget(Direction.RIGHT)
        wgt4.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt4)
        txt3 = new TextWidget()
        txt3.rect = new Rect(
            wgt3.rect.right() + 8,
            wgt3.rect.y - 2,
            wgt4.rect.left() - wgt3.rect.right() - 16,
            wgt3.rect.h + 4
        )
        txt3._text = "lat stddev"
        txt3._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt3)
        txt4 = new TextWidget()
        txt4.rect = new Rect(
            wgt3.rect.right() + 8,
            wgt3.rect.y - 8,
            wgt4.rect.left() - wgt3.rect.right() - 16,
            wgt3.rect.h + 16
        )
        txt4._text = this.client.latency_stddev
        txt4._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt4)



        let wgt5, wgt6, txt5, txt6;
        wgty += wgth + 12
        wgt5 = new ArrowButtonWidget(Direction.LEFT)
        wgt5.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt5)
        wgt6 = new ArrowButtonWidget(Direction.RIGHT)
        wgt6.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt6)
        txt5 = new TextWidget()
        txt5.rect = new Rect(
            wgt5.rect.right() + 8,
            wgt5.rect.y - 2,
            wgt6.rect.left() - wgt5.rect.right() - 16,
            wgt5.rect.h + 4
        )
        txt5._text = "droprate"
        txt5._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt5)
        txt6 = new TextWidget()
        txt6.rect = new Rect(
            wgt5.rect.right() + 8,
            wgt5.rect.y - 8,
            wgt6.rect.left() - wgt5.rect.right() - 16,
            wgt5.rect.h + 16
        )
        txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
        txt6._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt6)

        let wgt7, wgt8, txt7, txt8;
        wgty += wgth + 12
        wgt7 = new ArrowButtonWidget(Direction.LEFT)
        wgt7.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt7)
        wgt8 = new ArrowButtonWidget(Direction.RIGHT)
        wgt8.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt8)
        txt7 = new TextWidget()
        txt7.rect = new Rect(
            wgt7.rect.right() + 8,
            wgt7.rect.y - 2,
            wgt8.rect.left() - wgt7.rect.right() - 16,
            wgt7.rect.h + 4
        )
        txt7._text = "quality"
        txt7._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt7)
        txt8 = new TextWidget()
        txt8.rect = new Rect(
            wgt7.rect.right() + 8,
            wgt7.rect.y - 8,
            wgt8.rect.left() - wgt7.rect.right() - 16,
            wgt7.rect.h + 16
        )
        txt8._text = this.profiles[this.profile_index].name
        txt8._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt8)

        wgt1.clicked = () => {
            this.client.latency_mean -= 5
            this.client.latency_mean = Math.max(25, Math.min(1000,this.client.latency_mean))
            this.client.latency_stddev = Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean/2)
            )
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt2.clicked = () => {
            this.client.latency_mean += 5
            this.client.latency_mean = Math.max(25, Math.min(1000,this.client.latency_mean))
            this.client.latency_stddev = Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean/2)
            )
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt3.clicked = () => {
            this.client.latency_stddev -= 5
            this.client.latency_stddev = Math.max(0, Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean/2)
            ))
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt4.clicked = () => {
            this.client.latency_stddev += 5
            this.client.latency_stddev = Math.max(0, Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean/2)
            ))
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt5.clicked = () => {
            this.client.packet_lossrate -= 0.01
            this.client.packet_lossrate = Math.max(0, Math.min(.20,
                this.client.packet_lossrate
            ))
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt6.clicked = () => {
            this.client.packet_lossrate += 0.01
            this.client.packet_lossrate = Math.max(0, Math.min(.20,
                this.client.packet_lossrate
            ))
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt7.clicked = () => {
            this.profile_index -= 1
            if (this.profile_index < 0) {
                this.profile_index = this.profiles.length - 1
            }
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = profile.name
        }
        wgt8.clicked = () => {
            this.profile_index += 1
            if (this.profile_index >= this.profiles.length) {
                this.profile_index = 0
            }
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = profile.name
        }

        console.log("ASDASDASDASD")


    }

    buildMap() {
                this.walls = []
        this.entities = []


        Physics2d.maprect = new Rect(0,-128, this.map.width, this.map.height+64)

        console.log(gEngine.view, this.map)

        let w;
        w = new Wall()
        w.rect.x = 0
        w.rect.y = 320 - 32
        w.rect.w = this.map.width
        w.rect.h = 32
        this.walls.push(w)

        w = new Wall()
        w.rect.x = this.map.width/4 - 32
        w.rect.y = 320 - 64
        w.rect.w = 64
        w.rect.h = 32
        this.walls.push(w)

        w = new Wall()
        w.rect.x = 128
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height - 128
        this.walls.push(w)

        w = new Wall()
        w.rect.x = this.map.width/2 - 128 - 32
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height - 128
        this.walls.push(w)

        w = new Wall()
        w.rect.x = this.map.width/2 - 128 - 32 + 96
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height - 128
        this.walls.push(w)


        let ent;
        ent = new Character()
        ent.rect.x = 304
        ent.rect.y = 128
        ent.physics.group = this.walls

        //this.ghost = new RemoteController1()
        //this.ghost.position.x = 304
        //this.ghost.position.y = 128
        this.ghost2 = new RemoteController2()
        this.ghost2.rect.x = 304
        this.ghost2.rect.y = 128
        this.ghost2.physics.group = this.walls


        this.player = ent

        this.entities.push(ent)

        this.controller = new Controller(this, this.player)
        this.touch = new TouchInput(this.controller)

        this.touch.addWheel(72, -72, 72)
        this.touch.addButton(-60, -60, 40)

        this.keyboard = new KeyboardInput(this.controller);
        this.camera = new Camera(this.map, this.player)
    }

    handleMessage(message) {
        this.messages.push(message)
    }

    handleTouches(touches) {
        this.touch.handleTouches(touches)

        for (const wgt of this.widgets) {
            wgt.handleTouches(touches)
        }
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


        this.client.update(dt)
        this.camera.update(dt)

        if (this.messages.length > 0) {
            this.message_count = this.messages.length
            for (let message of this.messages) {
                //console.log("received", performance.now() - message.t0, message)
                if (message.type == "keepalive") {
                    this.latencies.push(Math.floor(performance.now() - message.t0))
                    while (this.latencies.length > 15) {
                        this.latencies.shift()
                    }
                    this.latency_min = Math.min(...this.latencies)
                    this.latency_max = Math.max(...this.latencies)
                    this.latency_mean = mean(this.latencies)
                    this.latency_stddev = stddev(this.latencies)
                }
                //if (message.type == "update") {
                //    this.ghost.receiveState(message)
                //}
                if (message.type === "input" || message.type === "update") {
                    this.ghost2.receiveState(message)
                }
            }
            this.messages = []

        }

        if (!this.game_ready) {
            if (this.client.connected()) {
                this.game_ready = true
            }
            return
        }

        this.controller.update(dt)


        for (let i = this.entities.length - 1; i >= 0; i--) {
            let ent = this.entities[i]
            ent.update(dt)
        }

        //this.ghost.update(dt)
        this.ghost2.update(dt)

        for (const wgt of this.widgets) {
            wgt.update(dt)
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

        ctx.fillStyle = "#69698c"
        let buildings = [300, 100, 250, 300]
        let bo = 200*5
        for (let i = 0; i < buildings.length; i++) {
            let bh = buildings[i]
            let bw = 168
            ctx.fillRect(  (this.camera.x + bo*(i+1))/5 , this.map.height - bh, bw, bh)
        }

        ctx.strokeStyle = "#FFFFFF1f"
        ctx.beginPath()
        ctx.rect(0,0,this.map.width,  this.map.height)
        ctx.stroke()

        for (let y=32; y < this.map.height; y+=32) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(this.map.width, y)
            ctx.stroke()
        }

        for (let i = this.walls.length - 1; i >= 0; i--) {
            let ent = this.walls[i]
            ent.paint(ctx)
        }

        if (!this.game_ready) {
            return
        }

        //this.ghost.paint(ctx)
        this.ghost2.paint(ctx)

        for (let i = this.entities.length - 1; i >= 0; i--) {
            let ent = this.entities[i]
            ent.paint(ctx)
        }





        ctx.restore()

        // boxes to make text easier to read
        ctx.fillStyle = "#333344af"
        ctx.fillRect(gEngine.view.width - 165, 0, 165, 155)
        ctx.fillRect(0, 0, 320, 100)


        this.touch.paint(ctx)
        ctx.font = "bold 12pt Courier";
        ctx.fillStyle = "yellow"
        // ${this.latency_min.toFixed(2)} ${this.latency_max.toFixed(2)}
        ctx.fillText(`latency: mean=${this.latency_mean.toFixed(0)}ms sd=${this.latency_stddev.toFixed(0)}ms`, 32, 40)
        ctx.fillText(`${Direction.name[this.player.current_facing]} action=${this.player.physics.action}`, 32, 56)
        ctx.fillText(`bytes: sent=${Math.floor(this.client.total_sent/3)} received=${Math.floor(this.client.total_received/3)}`, 32, 72)
        ctx.fillStyle = "#00FF00"
        ctx.fillText(`error = (${Math.floor(this.ghost2.error.x)}, ${Math.floor(this.ghost2.error.y)}) ${this.ghost2.received_offset }`, 32, 88)

        this.ghost2.paintOverlay(ctx)



        for (const wgt of this.widgets) {
            wgt.paint(ctx)
        }



    }
}


export default class Application extends ApplicationBase {
    constructor() {
        super({
            portrait: 0,
            fullscreen: 0
        }, () => {
            return new ResourceLoaderScene(() => {
                gEngine.scene = new DemoScene()
            })
        })


    }
}