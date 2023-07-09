
/**
 * jump war
 * - client send:
 *   uid should be set by the webrtc client class
 *   client should keep track of acked messages
 *   client should resend messages that have not been acked
 *   - maybe every other update
 *   - maybe look at latency, 1/2 rtt send again
 * - server receive:
 *   - for each peer, keep track of received uids
 * - server send:
 *   - same idea as client send
 * - csp: consitent frame rate
 *        send frame deltas along with inputs?
 *        separate tick rate and frame rate? this would allow a constant tick
 * - webrtc: disconnect events from page refresh
 *           disconnect from missing keep alives
 * - pressing into a wall should require a button press
 * -
 * - send periodic update
 *    - send delta relative to last update
 *    - place updates at input_clock + 6 frames
 *      -
 *
 * - what if player inputs only send the delta (in ticks) since the last input
 *   and not the raw frame number.
 *   for any ent id - that exists - the last input frame can be recorded
 *
 * - create a counter per entity as part of the state
 *   count the number of inputs applied to the character
 *   ensure the same count for the ghost and player
 * - delay ghost by an additional 6 ms
 * - login message
 *    the login message indicates which frame to spawn on
 *    which is also the first frame to start the simulation
 *    login can return 40 and indicate to spawn on 70
 *    giving half a second before the player is spawned and controllable
 *
 * - color: green for accepted inputs
 *          red for non accepted inputs
 *          yellow for resynced inputs
 * - implement snap on error
 *      detect error from real position and simulated position
 * - adjust frequency of sending duplicate input packets
 *      with snap on error, this can be dropped to 2 assuming 10% packet loss
 * - speed up / slow down simulation
 *      detect when the simulation is falling behind real time
 *      process extra frames
 *      **  if an input comes in more than 6 frames in the future of 'now'
 *          speed up the simulation
 *      ** if every input comes in in the past, slow down the simulation
 *
 * World state
 *      receiveMessages
 *          process all received messages
 *      reconcile
 *          if there are any errors rewind the simulation and update all entities in lock step
 *      update
 *          run a single normal update for registered entities

 */
$import("daedalus", {})

$import("engine", {
    ApplicationBase, Rect, Entity,
    GameScene, CameraBase,
    TextWidget, TextInputWidget,
    Alignment, Direction,
    AnimationComponent, CharacterComponent,
    TouchInput, KeyboardInput,
    RealTimeClient, RealTimeEchoClient
    CspRingBuffer, mean, stddev,
    ArrowButtonWidget, ButtonWidget, SoundEffect
})

$import("scenes", {global, ResourceLoaderScene})

/**
 * jump war
 */


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

    onMessage(obj) {

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
    constructor(map) {
        super()
        this.map = map
        this.target = null

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

function apply_character_input(map, input, physics) {

    if (physics.target.iskill || physics.target.spawning) {
        return
    }

    if (input.btnid !== undefined) {
        //console.log("apply_input clock=", CspReceiver.instance.input_clock, physics.target.entid, "button", input.btnid, input.pressed)
        physics.ninputs += 1
        if (input.pressed) {

            // coyote time
            let standing = physics.standing_frame >= (physics.frame_index - 6)
            let pressing = physics.pressing_frame >= (physics.frame_index - 6)

            if (standing) {

                physics.yspeed = physics.jumpspeed
                physics.gravityboost = false
                physics.doublejump = true
                global.loader.sounds.jump.play(.3)

            } else if (pressing && !standing) {
                //let v = Direction.vector(physics.direction)
                //physics.xspeed = - v.x * physics.xjumpspeed
                physics.xspeed = physics.pressing_direction * physics.xjumpspeed
                physics.yspeed = physics.jumpspeed / Math.sqrt(2)
                physics.gravityboost = false
                //console.log("wall jump", physics.xspeed)

                // TODO: this causes a stutter when trying to wall jump  on the same wall
                //       if the direction of travel is the same as the current direction button
                //       the facing direction will need to be fixed, without a new input
                physics.facing = (physics.facing == Direction.LEFT)?Direction.RIGHT:Direction.LEFT
                global.loader.sounds.jump.play(.3)

            } else if (!standing && physics.doublejump && physics.yspeed > 0) {
                //console.log("double jump")
                // double jump at half the height of a normal jump
                physics.yspeed = physics.jumpspeed / Math.sqrt(2)
                physics.gravityboost = false
                physics.doublejump = false
                physics.doublejump_position = {x:physics.target.rect.cx(), y: physics.target.rect.bottom()}
                physics.doublejump_timer = .4
                global.loader.sounds.jump.play(.3)
            }
            else {
                console.log(`jump standing=${standing} pressing=${pressing}`)
            }
        } else {
            physics.gravityboost = true
        }
    }
    else if (input.whlid !== undefined) {
        //console.log("apply_input clock=", CspReceiver.instance.input_clock, physics.target.entid, "wheel", input.whlid, input.direction)
        physics.ninputs += 1
        physics.direction = input.direction
        // TODO: maybe facing should only change when physics.update is run?
        if (physics.direction != 0) {
            physics.facing = physics.direction
        }

    }
    else if (input.type === "create") {
        console.log("create projectile")
    }
}

class CspController {
    constructor(client) {
        this.client = client
        this.target = null

        this.inputqueue_capacity = 4
        this.inputqueue = []
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push([])
        }

        this.remotetimer = 0
        this.remotetimeout = 0.1

        this.keepalivetimer = 0
        this.keepalivetimeout = 1.0

        this.input_id = 1

        this.last_direction = 0

        this.frameIndex = 0

        this.lastInputFrameIndex = -1

        //this.update_sent = false

        this.inputqueue2 = [] // FIXME: rename
    }

    setTarget(target) {
        this.target = target
    }

    setInputDirection(whlid, vector){
        this.inputqueue2.push({type: "wheel", whlid, vector})
    }

    // TODO: single button with pressed/released argument
    handleButtonPress(btnid){
        this.inputqueue2.push({type: "button", btnid, pressed: true})
    }

    handleButtonRelease(btnid){
        this.inputqueue2.push({type: "button", btnid, pressed: false})
    }

    _setInputDirection(whlid, vector) {
        if (!this.target) {
            return
        }

        // de-bounce touch input
        let direction = Direction.fromVector(vector.x, vector.y)&Direction.LEFTRIGHT
        if (direction != this.last_direction) {
            // hack until sending deltas
            let message = {
                type: "input",
                entid: this.target.entid,
                frame: this.frameIndex,
                delta: (this.lastInputFrameIndex>=0)(this.frameIndex - this.lastInputFrameIndex):0,
                uid: this.input_id,
                // ---
                x: this.target.rect.x,
                y: this.target.rect.y,
                whlid: whlid,
                direction: direction,
            }
            this.input_id += 1
            this.lastInputFrameIndex = this.frame_index

            //this.update_sent = false
            let idx = (this.frameIndex)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
            this.last_direction = direction
            this.receiver._local_receive(message)
        }

    }

    _handleButtonPress(btnid) {
        if (!this.target) {
            return
        }

        if (btnid === 0) {
            // hack until sending deltas
            let message = {
                type: "input",
                entid: this.target.entid,
                frame: this.frameIndex,
                delta: (this.lastInputFrameIndex>=0)(this.frameIndex - this.lastInputFrameIndex):0,
                uid: this.input_id,
                // ---
                x: this.target.rect.x,
                y: this.target.rect.y,
                btnid: btnid,
                pressed: true,
            }
            this.input_id += 1
            this.lastInputFrameIndex = this.frame_index

            //this.update_sent = false
            let idx = (this.frameIndex)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
            this.receiver._local_receive(message)
        } else if  (btnid === 1) {
            // hack until sending deltas
            let message = {
                type: "create",
                entid: this.target.entid,
                frame: this.frameIndex,
                delta: (this.lastInputFrameIndex>=0)(this.frameIndex - this.lastInputFrameIndex):0,
                uid: this.input_id,
                // ---
                dummy: 1
            }
            this.input_id += 1
            let idx = (this.frameIndex)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
            this.receiver._local_receive(message)
        }

    }

    _handleButtonRelease(btnid) {
        if (!this.target) {
            return
        }

        if (btnid === 0) {
            // hack until sending deltas

            let message = {
                type: "input",
                entid: this.target.entid,
                frame: this.frameIndex,
                delta: (this.lastInputFrameIndex>=0)(this.frameIndex - this.lastInputFrameIndex):0,
                uid: this.input_id,
                // ---
                x: this.target.rect.x,
                y: this.target.rect.y,
                btnid: btnid,
                pressed: false,
            }
            this.input_id += 1
            this.lastInputFrameIndex = this.frame_index

            //this.update_sent = false
            let idx = (this.frameIndex)%this.inputqueue_capacity
            this.inputqueue[idx].push(message)
            this.receiver._local_receive(message)
        }
    }

    sendInput() {

        if (!this.target) {
            return
        }

        let inputs = []
        for (const messages of this.inputqueue) {
            for (const message of messages) {
                inputs.push(message)
            }
        }

        if (inputs.length > 0) {
            const message = {
                type: "inputs",
                // --
                inputs: inputs
            }
            this.client.send(message)
        }
    }

    update(dt) {
        if (!this.target) {
            return
        }

        this.frameIndex = CspReceiver.instance.input_clock + CspReceiver.instance.input_delay
        let idx = (CspReceiver.instance.input_clock)%this.inputqueue_capacity
        this.inputqueue[idx] = []

        for (const input of this.inputqueue2) {
            if (input.type == "wheel") {
                this._setInputDirection(input.whlid, input.vector)
            }
            if (input.type == "button") {
                if (input.pressed) {
                    this._handleButtonPress(input.btnid)
                } else {
                    this._handleButtonRelease(input.btnid)

                }
            }
        }
        this.inputqueue2 = []

        this.sendInput()

        this.remotetimer += dt
        if (this.remotetimer > this.remotetimeout) {
            this.remotetimer -= this.remotetimeout

            // TODO: counter to send N updates after last input?
            // send clock + 1 when the controller is updated prior to the receiver
            // otherwise just send the clock value
            let message = {
                type: "update",
                entid: this.target.entid,
                frame: CspReceiver.instance.input_clock,
                delta: (this.lastInputFrameIndex>=0)(this.frameIndex - this.lastInputFrameIndex):0,
                state: this.target.getState(),
                uid: this.input_id,
            }
            this.input_id += 1
            this.lastInputFrameIndex = this.frame_index

            this.client.send(message)

        }

        this.keepalivetimer += dt
        this.keepalivetimer += dt
        if (this.keepalivetimer > this.keepalivetimeout) {
            this.keepalivetimer -= this.keepalivetimeout
            let message = {
                "type": "keepalive",
                t0: performance.now(),
            }
            this.client.send(message)
        }

        //let msgcnt = 0
        //for (let k = 0; k < this.inputqueue_capacity; k++) {
        //    msgcnt += this.inputqueue[k].length
        //}
        //console.log(msgcnt)



    }
}

class CspReceiver {
    // run simulation on user input
    // synchronize periodically
    constructor(map) {

        //this.queue = []
        this.map = map

        // capacity allows for +/- 2 seconds of inputs to be queued or cached
        // queue is [entity.entid][seqid]
        this.inputqueue_capacity = 120
        this.inputqueue = []
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push({})
        }

        this.statequeue_capacity = 120 // must be the same size as the inputqueue
        this.statequeue = []
        for (let i=0; i < this.statequeue_capacity; i++) {
            this.statequeue.push(null)
        }

        this.error = {x:0, y:0}

        this.input_clock = 0
        this.input_delay = 6

        this.received_offset = 0

        this.dirty_index = null
        //this.snap_position = null

        // TODO: memory leak if not cleared when an entity is deleted
        this.offsets = {}

    }

    _frameIndex(k) {
        let idx = (k) % this.inputqueue_capacity
        if (idx < 0) {
            idx += this.inputqueue_capacity
        }
        return idx
    }

    _hasinput(idx, entid, uid) {
        try {
            return (!!this.inputqueue[idx]) && (entid in this.inputqueue[idx]) && (uid in this.inputqueue[idx][entid])
        } catch (e) {
            console.warn(idx, entid, uid)
            console.error(e)
        }
    }

    _getinput(idx, entid, uid) {
        if (this.inputqueue[idx][entid] === undefined) {
            throw {message: "illegal access", idx, entid, uid}
        }
        return this.inputqueue[idx][entid][uid]
    }

    _setinput(idx, entid, uid, input) {
        if (this.inputqueue[idx][entid] === undefined) {
            this.inputqueue[idx][entid] = {}
        }
        this.inputqueue[idx][entid][uid] = input
    }

    _getEntity(entid) {
        const ent = this.map.entities[entid]
        return ent
    }

    _getstate() {
        const state = {}
        for (const entid in this.map.entities) {
            state[entid] = this.map.entities[entid].getState()
        }
        //const state = {
        //    [this.map.player.entid]: this.map.player.physics.getState(),
        //    [this.map.ghost.entid]: this.map.ghost.physics.getState(),
        //    ...this.map.projectiles
        //}
        return state
    }

    _updatestate() {

        // TODO: this is always 1/60, but could be part of the state
        // its a constant
        // it  could be variable?
        //
        this.map.update_entities(1/60)
    }

    _setstate(state) {
        for (const entid in this.map.entities) {
            if (!!state[entid]) {
                this.map.entities[entid].setState(state[entid])
                this.map.entities[entid].$active = true
            } else {
                this.map.entities[entid].$active = false
            }
        }
    }

    _local_receive(state) {

        //console.log("receive local", "now=", this.input_clock, "delayed until=", state.frame)

        const idx = this._frameIndex(state.frame ) // + this.input_delay

        this._setinput(idx, state.entid, state.uid, state)
    }

    _receive(msg) {
        const alpha = 0.8

        let frameIndex;
        if (msg.type == "spawn_player") {
            frameIndex = msg.frame + this.input_delay
        } else {

            // TODO: deduplicate messages before updating offsets
            // TODO: continuosly update the offset for every message that is receiving
            //       only set a new offset when an update is received?
            // TODO: design a low pass filter for offsets (choose a better alpha)
            if (this.offsets[msg.entid] === undefined) {
                this.offsets[msg.entid] = this.input_clock - msg.frame
            }

            frameIndex = msg.frame + this.input_delay + Math.round(this.offsets[msg.entid])
            msg.$offset = this.input_clock - msg.frame

            if (frameIndex > this.input_clock + 6) {
                console.log("update offset (delay)", this.offsets[msg.entid], msg.$offset)
                this.offsets[msg.entid] = alpha * this.offsets[msg.entid] + ((1 - alpha) * (msg.$offset))
                frameIndex = msg.frame + this.input_delay + Math.round(this.offsets[msg.entid])
            }
        }


        if ((frameIndex < this.input_clock - 60) || (frameIndex > this.input_clock + 60)) {
            console.log(this.offsets)
            console.warn("drop stale msg",
                msg.entid!=this.map?.player?.entid,
                "remote clock=", msg.frame,
                "local clock=", this.input_clock,
                this.input_delay,
                "offset=", this.offsets[msg.entid],
                "frame=", frameIndex,
                msg)
            return
        }

        if (frameIndex >= this.input_clock && msg.type == "input") {
            console.log("delta input", frameIndex - this.input_clock)
        }

        let idx = this._frameIndex(frameIndex)

        if (!msg.entid || !msg.uid) {
            console.log(msg)
            throw {"message": "invalid entid or uid", type: msg.type, entid: msg.entid, uid: msg.uid}
        }

        if (!this._hasinput(idx, msg.entid, msg.uid)) {
            this._setinput(idx, msg.entid, msg.uid, msg)

            if (frameIndex <= this.input_clock) {
                if (this.dirty_index == null || frameIndex < this.dirty_index) {
                    this.dirty_index = frameIndex
                }
            }

            if (frameIndex <= this.input_clock) {
                msg.$offset += 6
                console.log("update offset (dirty)",
                    "index=", frameIndex,
                    "clock=", this.input_clock,
                    "offset=", this.offsets[msg.entid],
                    "offset=", msg.$offset)
                this.offsets[msg.entid] = alpha * this.offsets[msg.entid] + ((1 - alpha) * (msg.$offset))
            }

        }
        return
    }

    _reconcile() {

        //let x1 = this.map.player.rect.x
        //let y1 = this.map.player.rect.y
        if (this.dirty_index !== null && this.dirty_index <= this.input_clock) {
            //console.log("found dirty index at", this.dirty_index, this.input_clock, "offset", this.received_offset)

            const last_index = this._frameIndex(this.dirty_index - 1)
            const last_known_state = this.statequeue[last_index]
            //console.log("restore state", dirty_index-1, idx, last_known_state)
            if (last_known_state === null) {
                // TODO: null last state could be a non issue
                // or instead we need to get the 'first' state
                console.error("last known state is null")
            } else {
                this._setstate(last_known_state)
            }

            //if (snap_position !== null && snap_position.frameIndex == this.dirty_index) {
            //    this.physics.target.rect.x = snap_position.state.x
            //    this.physics.target.rect.y = snap_position.state.y
            //}

            // process up to the current time (+1), an update after this will take care of advancing to the next frame
            const start = this.dirty_index
            const end = this.input_clock
            let result = {}
            let error = false
            console.log("reconcile start=", start, "end=", end)

            for (let clock = start; clock <= end; clock += 1) {
                this.input_clock = clock
                let idx = this._frameIndex(clock)
                this._apply(clock, true)
                this._updatestate()
                let new_global_state = this._getstate()
                // TODO: error checking for synchronization
                if (!!this.map.player) {
                    const playerid = this.map.player.entid

                    let old_state = this.statequeue[idx]?.[playerid]
                    let new_state = new_global_state?.[playerid]
                    if (!!old_state && !!new_state) {

                        if (!!old_state && (old_state.x != new_state.x || old_state.y != new_state.y)) {
                            error = true
                        }

                        const diff = {}
                        for (const prop of Object.keys(new_state)) {
                            if (prop === "doublejump_position") {
                                continue
                            }
                            const d = new_state[prop] - old_state[prop]
                            if (d != 0) {
                                diff[prop] = d
                            }
                        }

                        result[clock] = diff

                    }
                }
                this.statequeue[idx] = new_global_state
            }

            if (error) {
                console.error("reconcile end", result)
                //throw "error"
            }

            //let x2 = this.map.player.rect.x
            //let y2 = this.map.player.rect.y
            //console.log(this.input_clock, end, {x: x2-x1, y:y2-y1})
        }

        this.dirty_index = null
    }

    _apply(clock, reconcile) {
        const idx = this._frameIndex(clock)
        for (const entid in this.inputqueue[idx]) {
            for (const uid in this.inputqueue[idx][entid]) {
                const message = this.inputqueue[idx][entid][uid]
                this._apply_one(clock, entid, message, reconcile)
            }
        }
    }

    _apply_one(clock, entid, message, reconcile) {

        //console.log(reconcile?"reconcile":"update", "clock=", clock, message.type, "entid=",message.entid)

        //console.log("apply input idx=", "message=", message)
        if (message.type === "respawn") {
            const ent = this._getEntity(message.entid)

            ent.spawn(304, 128)

            console.log(message)
        } else if (message.type === "spawn_player") {
            if (message.$state !== undefined) {
                const ent = this._getEntity(message.$entid)
                ent.setState(message.$state)
            } else {

                const ent = new Character(message.chara)
                ent.physics.group = this.map.walls
                ent.entid = message.entid
                ent.sendEvent = (event) => {
                    this.map.sendEvent(event)
                }

                ent.group_charas = this.map.ecs.players
                ent.spawn(304, 128)

                this.map.addEntity(message.entid, ent)

                if (!message.remote) {
                    ent.layer = 10
                    if (this.map.player !== null) {
                        throw "player already exists"
                    }

                    this.map.player = ent
                    this.map.controller.setTarget(ent)
                    this.map.camera.setTarget(ent)
                } else {

                    if (!this.map.ghost) {
                        this.map.ghost = ent
                    }
                    ent.filter = `hue-rotate(+180deg)`
                }

                message.$state = ent.getState()
                message.$entid = ent.entid
            }

        } else if (message.type === "input") {
            const ent = this._getEntity(message.entid)
            if (!ent) {
                //console.log("no ent ", message.entid, message)
            } else {
                apply_character_input(this.map, message, ent.physics)

                //console.log("input delta", message.entid, message.frame)
            }

            if (reconcile && !message.applied) {
                console.log("!! applying input for the first time", message.entid, message)
            }



            //if (entid == 223) {
            //    ent.rect.x += 4 // TODO: FIXME for testing snap
            //}
            message.applied = true
            //
        } else if (message.type === "update") {

            //console.log("update delta", message.entid, message.frame - this.input_clock)

            const ent = this._getEntity(message.entid)
            if (!ent) {

                if (message.$state !== undefined) {
                    const ent = this._getEntity(message.entid)
                    ent.setState(message.state)
                } else {


                    const ent = new Character(message.state.chara)
                    ent.physics.group = this.map.walls
                    ent.group_charas = this.map.ecs.players
                    ent.sendEvent = (event) => {
                        this.map.sendEvent(event)
                    }
                    ent.entid = message.entid

                    this.map.addEntity(message.entid, ent)

                    if (!this.map.ghost) {
                        this.map.ghost = ent
                    }
                    ent.filter = `hue-rotate(+180deg)`
                    ent.setState(message.state)

                }


            } else {
                // const gendiff = (state1, state2) => {
                //     const diff = {}
                //     for (const prop of Object.keys(state1)) {
                //         if (prop === "doublejump_position") {
                //             continue
                //         }
                //         const d = state1[prop] - state2[prop]
                //         if (d != 0) {
                //             diff[prop] = d
                //         }
                //     }
                //     return diff
                // }

                //const current_state = ent.getState()
                //const cached1_state = this.statequeue[this._frameIndex(this.input_clock-1)]?.[message.entid]
                //const cached2_state = this.statequeue[this._frameIndex(this.input_clock)]?.[this.map.player.entid]
                //const player_state = this.map.player.getState()
                //const message_state = message.state
                //console.log("update offset", message.$offset)

                ent.setState(message.state)
            }

        } else if (message.type === "hit") {

            const ent = this._getEntity(message.entid)
            if (!!ent) {

                gEngine.paused = true

                ent.kill()
            }

        } else if (message.type === "create") {

            console.log("do make Shuriken")

            //if (message.$state !== undefined) {
            //    const ent = this._getEntity(message.$entid)
            //    ent.setState(message.$state)
            //} else {
            //    //const src = this._getEntity(message.entid)
            //    //const ent = new Shuriken()
            //    //ent.physics.group = this.map.walls
            //    //ent.physics.xspeed *= (src.physics.facing == Direction.LEFT)?-1:1
            //    //ent.rect.x = src.rect.cx() - 8
            //    //ent.rect.y = src.rect.cy() - 24
            //    //this.map.addEntity(ent)
            //    //message.$state = ent.getState()
            //    //message.$entid = ent.entid
            //}




        } else if (message.type == "snap") {
            // TODO: I think there is a bug here
            // snap at the beginning of an update
            // but message is saved at the end
            // TODO: trying to brute force the offset to compare
            //for (let o = -7; o <= 7; o++){
            //    const st = this.statequeue[this._frameIndex(this.input_clock + o)]?.[message.entid]
            //    if (!!st) {
            //        const ent = this._getEntity(message.entid)
            //        //let a = {x: ent.physics.target.rect.x, y: ent.physics.target.rect.y}
            //        let a = {x: st.x, y: st.y}
            //        let b = {x: message.x, y: message.y}
            //        let e = ((a.x - b.x)**2 + (a.y - b.y) ** 2)**0.5
            //        console.log("snap", o, e, a, b)
            //    } else {
            //        console.error("no state")
            //    }
            //}
            //ent.rect.x = message.x
            //ent.rect.y = message.y

        }
    }

    update_before() {

        this.input_clock += 1

        // clear events from 1 second ago
        const delete_idx = this._frameIndex(this.input_clock - 60)
        for (const entid in this.inputqueue[delete_idx]) {
            for (const uid in this.inputqueue[delete_idx][entid]) {
                const state = this.inputqueue[delete_idx][entid][uid]
                if (state.type == "input") {
                    if (!state.applied) {
                        // Crash the game whenever an input is not applied cleanly
                        throw {message: "state not applied" ,state}
                    }
                }
            }
        }
        this.inputqueue[delete_idx] = {}

        // process next frame
        //const idx = this._frameIndex(this.input_clock)
        //console.log("apply", this.input_clock, this.inputqueue[idx])
        this._apply(this.input_clock, false)
    }

    update_after() {
        const idx = this._frameIndex(this.input_clock)
        this.statequeue[idx] = this._getstate()
    }

    paint(ctx) {

        ctx.save()
        ctx.filter = `hue-rotate(+180deg)`
        ctx.globalAlpha = 0.5;
        this.ent.paint(ctx)
        ctx.restore()

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
            let j = this._frameIndex(this.input_clock + i - this.input_delay)

            if (Object.keys(this.inputqueue[j]).length > 0) {
                let x = i*bw + w/2
                let y = 16
                let k = 0;
                for (const entid in this.inputqueue[j]) {
                    //if (entid != this.map.ghost.entid) {
                    //    continue
                    //}
                    for (const uid in this.inputqueue[j][entid]) {
                        const state = this.inputqueue[j][entid][uid]

                        if (state.type == "input") {
                            ctx.beginPath()
                            if (state.applied) {
                                ctx.fillStyle = "#00FF00"
                            } else {
                                ctx.fillStyle = "#FF0000"
                            }
                            ctx.rect(x, y, bw, h)
                            ctx.fill()
                        }
                    }
                }

            }
        }

        ctx.restore()
    }
}

CspReceiver.instance = null

class Physics2d {

    constructor(target) {
        this.target = target
        this.group = []

        // state
        this.ninputs = 0
        this.frame_index = 0 // candidate for 'world state'
        this.direction = 0
        this.xspeed = 0
        this.yspeed = 0
        this.xaccum = 0
        this.yaccum = 0
        this.gravityboost = false // more gravity when button not pressed
        this.doublejump = false
        this.doublejump_position = {x:0, y: 0} // animation center
        this.doublejump_timer = 0 // for the animation duration

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

        this.xmaxspeed1 = 7*32  // from pressing buttons
        this.xmaxspeed2 = 14*32 // from other sources ?
        this.xfriction = this.xmaxspeed1 / .1 // stop moving in .1 seconds
        this.xacceleration = this.xmaxspeed1 / .2 // get up to max speed in .2 seconds
        // horizontal direction in a wall jump
        // TODO: after a wall jump friction does not apply to reduce the speed from xmaxspeed2 to xmaxspeed1
        this.xjumpspeed = Math.sqrt(3*32*this.xacceleration) // sqrt(2*distance*acceleration)
         // console.log("xspeeds", this.xmaxspeed1, this.xmaxspeed2, this.xjumpspeed, this.xacceleration)

        this.jumpheight = 96
        //this.jumpduration = .1875 // total duration divided by 4?
        this.jumpduration = .22 // total duration divided by 4?
        this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)

        this.wallfriction = .2

        this.ymaxspeed = - this.jumpspeed

        // log velocity over time
        //let speeds = []
        //let times = [0, .25, .5, .75, 1.0]
        //for (const t of times) {
        //    speeds.push(this.jumpspeed + this.gravity * 4 * this.jumpduration * t)
        //}
        //console.log("velocities", speeds)
    }

    collidePoint(x, y) {
        for (let i=0; i < this.group.length; i++) {
            if ((!!this.group[i].solid) && this.group[i].rect.collidePoint(x, y)) {
                return this.group[i]
            }
        }
        return null
    }

    _move_y(dt) {

    }

    update(dt) {
        this.frame_index += 1

        if (true) {
            /////////////////////////////////////////////////////////////
            // apply x acceleration

            if ((this.direction & Direction.LEFT) > 0) {
                if (this.xspeed > -this.xmaxspeed1) {
                    this.xspeed -= this.xacceleration * dt
                }
            } else if ((this.direction & Direction.RIGHT) > 0) {
                if (this.xspeed < this.xmaxspeed1) {
                    this.xspeed += this.xacceleration * dt
                }
            } else if (this.standing) {
                // apply friction while standing
                if (Math.abs(this.xspeed) < this.xfriction * dt) {
                    this.xspeed = 0
                } else {
                    this.xspeed -= Math.sign(this.xspeed) * this.xfriction * dt
                }
            }

            // bounds check x velocity
            if (this.xspeed > this.xmaxspeed2) {
                this.xspeed = this.xmaxspeed2
            }
            if (this.xspeed < -this.xmaxspeed2) {
                this.xspeed = -this.xmaxspeed2
            }

            /////////////////////////////////////////////////////////////
            // apply y acceleration
            //console.log(this.gravity, this.yspeed, dt, this.gravityboost)

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
                if (this.yspeed > this.ymaxspeed*this.wallfriction) {
                    this.yspeed = this.ymaxspeed*this.wallfriction
                }
            }
        }

        /////////////////////////////////////////////////////////////
        // move x
        this.xaccum += dt*this.xspeed
        //sconsole.log(CspReceiver.instance.input_clock, dt, this.xspeed, this.xaccum)
        let dx = Math.trunc(this.xaccum)
        let xstep = dx
        if (xstep == 0) {
            xstep = (this.facing == Direction.LEFT)?-1:1
        }
        if (true) {
            this.xcollide = false
            this.xcollisions = new Set()
            this.xaccum -= dx

            let rect = new Rect(
                this.target.rect.x + xstep,
                this.target.rect.y,
                this.target.rect.w,
                this.target.rect.h,
            )

            let solid = false;
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

            this.target.rect.x += dx
            if (solid) {
                //this.xspeed = 0 // Math.sign(this.xspeed) * 60
                this.xcollide = true
            }


            if (this.xcollide) {
                this.pressing = true
                // check the movement vector and fix the facing direction to stick to a wall
                this.facing = (this.xspeed > 0)?Direction.RIGHT:(this.xspeed<0)?Direction.LEFT:this.facing
                // configure the direction for when pressing the jump button
                // TODO: can this be removed if instead check the facing direction?
                this.pressing_direction = (this.facing == Direction.LEFT)?1:-1;
                this.xspeed = 0
                this.xaccum = 0
            } else {
                this.pressing = false
            }
            //console.log(this.pressing?"pressing":"not", Direction.name[this.facing], xstep, dx)
            /*

            if (this.xspeed > 0 && this.xcollide) {
                this.xspeed = 0
                this.pressing = this.frame_index
                this.pressing_direction = -1
            } else if (this.xspeed < 0 && this.xcollide) {
                this.xspeed = 0
                this.pressing = this.frame_index
                this.pressing_direction = 1
            } else {
                this.pressing = false
            }
            */
            // update state
            if (this.pressing) {
                this.pressing_frame = this.frame_index
            }
        }

        /////////////////////////////////////////////////////////////
        // move y
        this.yaccum += dt*this.yspeed
        //console.log(this.target.entid, dt, this.yspeed, this.yaccum)
        let dy = Math.trunc(this.yaccum)
        let ystep = dy
        if (ystep == 0) {
            // check if standing
            ystep = 1
        }
        if (true) {
            this.ycollisions = new Set()
            this.ycollide = false
            this.yaccum -= dy
            let rect = new Rect(
                this.target.rect.x,
                this.target.rect.y + ystep,
                this.target.rect.w,
                this.target.rect.h,
            )

            let solid = false;
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

            if (this.yspeed > 0 && this.ycollide) {
                this.standing = true
                this.yspeed = 0
                this.yaccum = 0
            } else {
                if (this.yspeed < 0 && this.ycollide) {
                    this.yspeed = 0
                    this.yaccum = 0
                }
                this.standing = false
            }

            if (this.standing) {
                this.standing_frame = this.frame_index
            }

        }

        this.collide = this.xcollide || this.ycollide

        /////////////////////////////////////////////////////////////
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

        /////////////////////////////////////////////////////////////
        // update current action

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
        const state = [
            this.target.rect.x,
            this.target.rect.y,
            this.direction,
            this.xspeed,
            this.yspeed,
            this.xaccum,
            this.yaccum,
            this.gravityboost,
            this.doublejump,
            this.doublejump_position,
            this.doublejump_timer,
            this.pressing,
            this.standing,
            this.facing,
        ]

        //const state = {
        //    x: this.target.rect.x,
        //    y: this.target.rect.y,
        //    //frame_index: this.frame_index,
        //    //clock: CspReceiver.instance.input_clock,
        //    direction: this.direction,
        //    xspeed: this.xspeed,
        //    yspeed: this.yspeed,
        //    xaccum: this.xaccum,
        //    yaccum: this.yaccum,
        //    gravityboost: this.gravityboost,
        //    doublejump: this.doublejump,
        //    doublejump_position: this.doublejump_position,
        //    doublejump_timer: this.doublejump_timer,
        //    pressing: this.pressing,
        //    standing: this.standing,
        //    facing: this.facing,
        //    //ninputs: this.ninputs,
        //}
        return state
    }

    setState(state) {

        //this.target.rect.x = state.x
        //this.target.rect.y = state.y
        //this.direction = state.direction
        //this.xspeed = state.xspeed
        //this.yspeed = state.yspeed
        //this.xaccum = state.xaccum
        //this.yaccum = state.yaccum
        //this.gravityboost = state.gravityboost
        //this.doublejump = state.doublejump
        //this.doublejump_position = state.doublejump_position
        //this.doublejump_timer = state.doublejump_timer
        //this.pressing = state.pressing
        //this.standing = state.standing
        //this.facing = state.facing
        [
            this.target.rect.x,
            this.target.rect.y,
            this.direction,
            this.xspeed,
            this.yspeed,
            this.xaccum,
            this.yaccum,
            this.gravityboost,
            this.doublejump,
            this.doublejump_position,
            this.doublejump_timer,
            this.pressing,
            this.standing,
            this.facing,
        ] = state
    }
}

Physics2d.maprect = new Rect(0,0,0,0)

class CspEntity {

    constructor() {
        this.entid = -1
        // TODO: destroyed at could be a global cache in the world
        //       that contains the initial state and destroyed at information
        //       this way the object state would not need to be updated?
        this.$destroyed_at = 0  // ECS:
        this.layer = 0

        this.active = true // in view, can update and paint
        this.solid = true
        this.visible = true
        this.layer = 0

        this.rect = new Rect(0, 0, 0, 0)

        this.physics = new Physics2d(this)
        this.animation = new AnimationComponent(this)
    }

    destroy() {
        if (this.$destroyed_at == 0) {
            this.$destroyed_at = CspReceiver.instance.input_clock
        }
    }

    update(dt) {

        this.physics.update(dt)
        this.animation.update(dt)
    }

    paint(ctx) {
        this.animation.paint(ctx)
    }
}

class Wall extends CspEntity {
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

class Character extends CspEntity {

    constructor(chara) {
        super()
        this.chara = chara
        this.current_action = "idle"
        this.current_facing = Direction.RIGHT

        this.filter = null

        this.rect.w = 16
        this.rect.h = 16

        this.physics = new Physics2d(this)
        this.animation = new AnimationComponent(this)
        this.character = new CharacterComponent(this)

        this.buildAnimations()

        this.spawning = true

        this.kill_timer_1 = 0
        this.iskill = false

        this.group_charas = ()=>[]

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

        let chara = this.chara ?? "frog"
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



        for (const info of defines1) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(sheet, sheet.tiles(), spf, {xoffset, yoffset})
            this.animations[animation_name][direction] = aid
        }


        // appearing / disappearing

        spf = 1/14
        xoffset = -40
        yoffset = -48
        let onend;

        let defines2 = [
            ["appear",    Direction.LEFT,  `default_l_appear`],
            ["appear",    Direction.RIGHT, `default_r_appear`],
        ]

        onend = this.onSpawnAnimationEnd.bind(this)

        for (const info of defines2) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(
                sheet, sheet.tiles(), spf, {xoffset, yoffset, loop: false, onend}
            )
            this.animations[animation_name][direction] = aid
        }

        let defines3 = [
            ["disappear",    Direction.LEFT,  `default_l_disappear`],
            ["disappear",    Direction.RIGHT, `default_r_disappear`],
        ]

        onend = this.onDeathAnimationEnd.bind(this)

        for (const info of defines3) {
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
        if (!aid) {
            throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
        }
        this.animation.setAnimationById(aid)
        this.spawning = false
    }

    onDeathAnimationEnd() {
        this.visible = false
    }

    update(dt) {

        this.physics.update(dt)

        if (!this.spawning && !this.iskill) {
            if (this.physics.facing != this.current_facing) {
                this.current_facing = this.physics.facing
                let aid = this.animations[this.current_action][this.current_facing]
                if (!aid) {
                    console.error(this.physics)
                    throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
                }
                this.animation.setAnimationById(aid)
            }

            if (this.physics.action != this.current_action) {
                this.current_action = this.physics.action
                let aid = this.animations[this.current_action][this.current_facing]
                if (!aid) {
                    console.error(this.physics)
                    throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
                }
                this.animation.setAnimationById(aid)
            }
        }

        if (this.iskill) {
            if (this.kill_timer_1 > 0) {

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

                this.kill_timer_1 -= dt

                if (this.kill_timer_1 <= 0) {
                    this.animation.setAnimationById(this.animations.disappear[this.physics.facing])

                    this.physics.xspeed = 0
                    this.physics.yspeed = 0
                    this.physics.xaccum = 0
                    this.physics.yaccum = 0

                    this.kill_timer_1 = 0
                }
            }
        } else if (this.physics.yspeed > 0) {
            for (const other of this.group_charas()) {
                if (other.entid != this.entid) {
                    if (this.rect.collideRect(other.rect)) {
                        if (this.rect.cy() < other.rect.cy()) {
                            this.sendEvent?.({
                                type: "hit",
                                frame: CspReceiver.instance.input_clock,
                                entid: this.entid,
                                target: other.entid
                            })
                        }
                    }
                }
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

        ctx.save()
        //if (!!this.filter) {
        //    ctx.filter = this.filter + "  blur(5px)"
        //} else {
        //    ctx.filter = "hue-rotate(180deg) brightness(2)"
        //}

        if (!!this.filter) {
            if (this.iskill) {
                ctx.filter = this.filter + ` brightness(${1 + (1-this.kill_timer_1/.6)})`
            } else {
                ctx.filter = this.filter
            }
        } else {
            if (this.iskill) {
                ctx.filter = `brightness(${1 + (1-this.kill_timer_1)})`
            }
        }

        this.animation.paint(ctx)
        ctx.restore()

        if (this.physics.doublejump_timer > 0) {
            const p = this.physics.doublejump_position

            ctx.strokeStyle = "#CCCC004f"
            ctx.beginPath()
            ctx.roundRect(p.x-9, p.y, 18, 4, 4)
            ctx.stroke()
        }
    }

    getState() {
        let state = [this.visible, this.spawning, this.iskill, this.kill_timer_1]
        return {chara: this.chara, rest:[state, this.physics.getState(), this.animation.getState()]}
    }

    setState(state) {
        try {
            const [state1, state2, state3] = state.rest
            [this.visible, this.spawning, this.iskill, this.kill_timer_1] = state1
            this.physics.setState(state2)
            this.animation.setState(state3)
        } catch (e) {
            console.log(state)
            console.log(e)
            console.error(e)
        }
    }

    spawn(x, y) {
        this.rect.x = x
        this.rect.y = y
        this.spawning = true
        this.physics.facing = Direction.RIGHT
        this.animation.setAnimationById(this.animations.appear[this.physics.facing])
        this.iskill = false
        this.visible = true
        global.loader.sounds.spawn.play()
    }

    kill() {

        this.kill_timer_1 = 0.6
        this.iskill = true

        this.physics.xspeed = 0
        this.physics.yspeed = 0
        this.physics.xaccum = 0
        this.physics.yaccum = 0
        this.physics.direction = 0

        let d = this.physics.facing==Direction.LEFT?1:-1
        this.physics.xspeed = d * Math.sqrt( 32*this.physics.xacceleration)
        this.physics.yspeed = - Math.sqrt(2*48*this.physics.gravity)
        this.physics.doublejump = false
        global.loader.sounds.dead.play()
    }
}

class Shuriken extends CspEntity {

    constructor() {
        super()

        this.rect.w = 8
        this.rect.h = 8

        this.physics = new Physics2d(this)
        this.physics.xspeed = 128 * 2.5
        this.physics.gravity = 0
    }

    update(dt) {


        this.physics.update(dt)

        if (this.physics.xcollide) {
            this.destroy()
            console.log("kill", this.$destroyed_at)
        }



    }

    paint(ctx) {

        ctx.fillStyle = "#665533";
        ctx.beginPath()
        ctx.arc(this.rect.cx(),this.rect.cy(),8,8, 0, 2*Math.PI)
        ctx.fill()

    }

    getState() {
        return this.physics.getState()
    }

    setState(state) {
        this.physics.setState(state)
    }
}

class ECS {
    constructor(parent) {

        this.parent = parent

        this.cache_created = -1
        this.cache = {}

        this.addGroup('solid', (ent) => ent.solid)
    }

    addGroup(groupname, rule) {
        this[groupname] = () => {
            const now = CspReceiver.instance.input_clock

            if (now != this.cache_created) {
                this.cache = {}
                this.cache_created = now
            }

            if (!(groupname in this.cache)) {
                const rule2 = (ent) => ((!ent.$destroyed_at || now <= ent.$destroyed_at) && rule(ent))
                this.cache[groupname] = Object.values(this.parent.entities).filter(rule2)
            }

            return this.cache[groupname]
        }
    }
}


class World {
    /*

     TODO: the server will send a message indicating that the main character
           should spawn on frame N, the controller should be initialized
           with this for the clock
           this will synchronize the client and server

    */

    constructor(client) {

        let mapw = 640 * 2
        let maph = 360

        this.messages = []
        this.client = client

        this.map = {width: mapw, height: maph}

        this.login_sent = false
        this.login_received = false

        this.game_ready = false

        // statistics on received information
        this.latencies = []
        this.latency_max = 0
        this.latency_min = 0
        this.latency_mean = 0
        this.latency_stddev = 0
        this.message_count = 0

        this.entities = {}

        this.player = null
        this.ghost = null

        this.ecs = new ECS(this)

        this.ecs.addGroup("players", (ent) => {return ent instanceof Character})

    }

    buildMap() {

        this.walls = []
        //this.entities = []

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

        this.player = null
        this.ghost = null

        this.controller = new CspController(this.client)
        this.controller.map = this

        this.receiver = new CspReceiver(this)
        this.receiver.input_clock = 100

        this.controller.receiver = this.receiver
        CspReceiver.instance = this.receiver

        this.camera = new Camera(this.map)

        this.entities = {
            //[this.ghost.entid]: this.ghost,
            //[this.player.entid]: this.player,
        }

        this.next_entid = 1024
    }

    handleMockMessage(message) {

        // pretend to be the server

        if (message.type == "hit"){
            return
        }

        if (message.type == "login"){
            this.handleMessage({
                type: "login",
                //"clock": 123456,
                "entid": 123,
                "uid": 1
            })

            this.handleMessage({
                type: "player_join",
                //"clock": 123456,
                "entid": 223,
                "uid": 2
            })

            return
        }

        else if (message.type == "keepalive"){
            message.clock = CspReceiver.instance.input_clock
        }
        else if (message.type == "create"){
            console.log("server create")
            return
        }

        if (message.type == "inputs") {
            for (const input of message.inputs) {
                input.entid += 100
            }
        }
        if (message.entid !== undefined) {
            message.entid += 100
        }

        this.handleMessage(message)
    }

    handleMessage(message) {
        // TODO: handle Messages should be part of the client
        this.messages.push(message)
    }

    update(dt) {

        if (this.messages.length > 0) {
            this.message_count = this.messages.length
            for (let message of this.messages) {
                if (message.type == "logout") {
                    console.log(message)
                    if (message.entid in this.entities) {
                        this.entities[message.entid].destroy()
                    }
                    //this.receiver._receive(message)
                } else if (message.type == "login") {
                    console.log("login received", message)

                    //this.receiver.input_clock = message.clock
                    this.receiver._receive({
                        type: "spawn_player",
                        remote: false,
                        chara: message.chara,
                        frame: this.receiver.input_clock,
                        entid: message.entid,
                        uid: message.uid

                    })
                    this.login_received = true

                }
                else if (message.type == "keepalive") {
                    this.latencies.push(Math.floor(performance.now() - message.t0))
                    while (this.latencies.length > 15) {
                        this.latencies.shift()
                    }
                    this.latency_min = Math.min(...this.latencies)
                    this.latency_max = Math.max(...this.latencies)
                    this.latency_mean = mean(this.latencies)
                    this.latency_stddev = stddev(this.latencies)

                    //console.log("frame delta", message.clock, CspReceiver.instance.input_clock, message.clock - CspReceiver.instance.input_clock)
                }
                else if (message.type == "inputs") {
                    for (const msg of message.inputs) {
                        this.receiver._receive(msg)
                    }
                }
                else if (message.type == "input") {
                    this.receiver._receive(message)
                }
                else if (message.type == "update") {

                    //if (!!this.entities[message.entid]) {
                    //    this.receiver._receive({
                    //        type: "spawn_player",
                    //        remote: true,
                    //        frame: message.frame,
                    //        entid: message.entid,
                    //        uid: message.uid
                    //    })
                    //}

                    this.receiver._receive(message)
                }
                else if (message.type == "player_join") {
                    this.receiver._receive({
                        type: "spawn_player",
                        remote: true,
                        chara: message.chara,
                        frame: this.receiver.input_clock,
                        entid: message.entid,
                        uid: message.uid
                    })
                }
                else if (message.type == "respawn") {
                    this.receiver._receive({
                        type: "respawn",
                        frame: this.receiver.input_clock,
                        entid: message.entid,
                        uid: message.uid
                    })
                }
                else if (message.type == "hit") {
                    this.receiver._receive(message)


                }
                else {
                    console.log("unexpected message type", message)
                }
            }
            this.messages = []

            this.receiver._reconcile()

        }


        if (!this.login_sent) {
            console.log("sending login")
            this.client.send({type: "login", chara: global.chara})
            this.login_sent = true
            return
        }

        if (!this.login_received) {
            return
        }


        this.camera.update(dt)
        this.controller.update(dt)
        // receiver update before controller?
        this.receiver.update_before()
        this.update_entities(dt)
        this.receiver.update_after()

    }

    update_entities(dt) {

        const now = CspReceiver.instance.input_clock
        const delete_delay = 120

        const todelete = []
        for (const entid in this.entities) {
            const ent = this.entities[entid]
            if (!ent.$destroyed_at || now <= ent.$destroyed_at) {
                this.entities[entid].update(dt)
            } else if (!!ent.$destroyed_at && now > (ent.$destroyed_at + delete_delay)) {
                todelete.push(ent)
            }
        }

        for (const ent of todelete) {
            console.log("delete", ent.entid, ent.$destroyed_at, now)
            delete this.entities[ent.entid]
        }
        //for (let i = this.entities.length - 1; i >= 0; i--) {
        //    let ent = this.entities[i]
        //    ent.update(dt)
        //}
    }

    paint(ctx) {


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

        const cmp = (a, b) => (a.layer - b.layer) || (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x)
        this.entities_sorted = Object.values(this.entities).sort(cmp)

        const now = CspReceiver.instance.input_clock

        for (const ent of this.entities_sorted) {
            if (!ent.$destroyed_at || now <= ent.$destroyed_at) {
                ent.paint(ctx)
            }
        }

        //for (let i = this.entities.length - 1; i >= 0; i--) {
        //    let ent = this.entities[i]
        //    ent.paint(ctx)
        //}

        ctx.restore()

        // boxes to make text easier to read
        ctx.fillStyle = "#333344af"
        if (!this.use_network) {
            ctx.fillRect(gEngine.view.width - 165, 0, 165, 155)
        }
        ctx.fillRect(0, 0, 320, 100)

        ctx.font = "bold 12pt Courier";
        ctx.fillStyle = "yellow"
        // ${this.latency_min.toFixed(2)} ${this.latency_max.toFixed(2)}
        ctx.fillText(`${(gEngine.spt).toFixed(3)} : ${(gEngine.fps).toFixed(2)} latency: mean=${this.latency_mean.toFixed(0)}ms sd=${this.latency_stddev.toFixed(0)}ms`, 32, 40)
        ctx.fillText(`${gEngine.timings}`, 32, 56)
        //ctx.fillText(`${Direction.name[this.player.current_facing]} action=${this.player.physics.action}`, 32, 56)
        const stats = this.client.stats()
        ctx.fillText(`bytes: sent=${Math.floor(stats.sent/3)} received=${Math.floor(stats.received/3)}`, 32, 72)
        ctx.fillStyle = "#00FF00"
        //ctx.fillText(`error = (${Math.floor(this.ghost2.error.x)}, ${Math.floor(this.ghost2.error.y)}) ${this.ghost2.received_offset }`, 32, 88)
        //ctx.fillText(`pos = (${this.player.rect.x}, ${this.player.rect.y})`, 32, 104)
        if (!!this.player && !!this.ghost) {
            ctx.fillText(`player=${this.player.physics.ninputs} ghost=${this.ghost.physics.ninputs} offset=${CspReceiver.instance.offsets[this.ghost.entid]}`, 32, 104)
        }
        this.receiver.paintOverlay(ctx)

    }

    addEntity(entid, ent) {
        ent.entid = entid
        this.entities[entid] = ent
    }

    addEntityOld(ent) {
        console.log("adding ent")
        ent.entid = this.next_entid
        this.entities[this.next_entid] = ent
        this.next_entid += 1
    }

    sendEvent(event) {
        this.client.send(event)
    }
}

class DemoScene extends GameScene {

    constructor() {
        super()


        this.widgets = []

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

        global.chara = (query?.chara??["frog"])[0]

        this.map = new World()

         if (daedalus.env.backend=="webrtc") {
            // backend is a multi player webrtc server
            this.client = new DemoRealTimeClient(this.map.handleMessage.bind(this.map))
            this.client.connect("/rtc/offer", {})
            this.buildRtcWidgets()
            this.map.use_network = true

        } else if (daedalus.env.backend == "echo") {
            // backend is an echo server
            this.client = new DemoRealTimeClient(this.map.handleMockMessage.bind(this.map))
            this.client.connect("/rtc/offer", {})
            this.map.use_network = true
            SoundEffect.global_volume = 0

        } else {
            this.client = new RealTimeEchoClient(this.map.handleMockMessage.bind(this.map))
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            this.buildLatencyWidgets()
            this.map.use_network = false
            SoundEffect.global_volume = 0
        }

        this.map.client = this.client

        this.map.buildMap()

        this.touch = new TouchInput(this.map.controller)
        this.touch.addWheel(72, -72, 72)
        //this.touch.addButton(-60, -60, 40)
        this.touch.addButton(-40, -120, 40)
        this.touch.addButton(-120, -40, 40)

        this.keyboard = new KeyboardInput(this.map.controller);
        this.keyboard.addWheel_ArrowKeys()
        this.keyboard.addButton(KeyboardInput.Keys.SPACE)
        this.keyboard.addButton(KeyboardInput.Keys.CTRL)



    }

    buildRtcWidgets() {

        let wgtx = gEngine.view.width - 32
        let wgto = 128
        let wgty = 8
        let wgth = 24

        let wgt1 = new ButtonWidget(Direction.LEFT)
        wgt1.rect = new Rect(wgtx - wgto,wgty,96+16,24)
        wgt1.setText("Disconnect")
        this.widgets.push(wgt1)

        wgt1.clicked = () => {
            this.client.disconnect()
        }

        let wgt2 = new ButtonWidget(Direction.LEFT)
        wgt2.rect = new Rect(wgtx - wgto,wgty + 32,96+16,24)
        wgt2.setText("Bot")
        this.widgets.push(wgt2)

        wgt2.clicked = (() => {

            let timer = null
            let direction = Direction.RIGHT

            return () => {

                if (timer == null) {

                    timer = setInterval(()=>{
                        this.map.controller.setInputDirection(0, Direction.vector(direction))
                        direction = Direction.flip[direction]
                    }, 1500)
                } else {
                    clearInterval(timer)
                    timer = null
                }


            }

        })()


    }

    buildLatencyWidgets() {

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

        if (!this.map.game_ready) {
            if (this.client.connected()) {

                this.map.game_ready = true
            }
            return
        }

        this.map.update(dt)

        for (const wgt of this.widgets) {
            wgt.update(dt)
        }


    }

    paint(ctx) {

        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        this.map.paint(ctx)

        this.touch.paint(ctx)

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