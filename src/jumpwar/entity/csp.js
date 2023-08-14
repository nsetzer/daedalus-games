
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

export class CspEntity {

    constructor() {
        this.entid = -1
        // TODO: destroyed at could be a global cache in the world
        //       that contains the initial state and destroyed at information
        //       this way the object state would not need to be updated?
        this.$csp_destroyed_at = -1  // ECS:

        this.active = true // in view, can update and paint
        this.solid = true
        this.visible = true
        this.layer = 0
        this.order = 1000

        this.rect = new Rect(0, 0, 0, 0);

        this.physics = null//new Physics2d(this)
        this.animation = null//new AnimationComponent(this)
    }

    destroy() {
        if (this.$csp_destroyed_at < 0) {
            this.visible = false
            this.solid = false
            this.$csp_destroyed_at = CspReceiver.instance.input_clock
        }
    }

    update(dt) {

        //this.physics.update(dt)
        //this.animation.update(dt)
    }

    paint(ctx) {
        //this.animation.paint(ctx)
    }

    getState() {
        return null
    }

    setState(state) {

    }

    collidePoint(x, y) {
        return this.rect.collidePoint(x, y)
    }
}


export class ECS {
    constructor(parent) {

        this.parent = parent // the world

        this.cache_created = -1
        this.cache = {}

        this.addGroup('updatable', (ent) => ent.order > 0, (a,b) => a.order - b.order)
        this.addGroup('visible', (ent) => ent.visible,
            (a, b) => (a.layer - b.layer) ||
                      (a.rect.y - b.rect.y) ||
                      (a.rect.x - b.rect.x)
        )
        this.addGroup('solid', (ent) => ent.solid)
    }

    addGroup(groupname, rule, sort_rule = null) {
        this[groupname] = () => {
            const now = CspReceiver.instance.input_clock

            if (now != this.cache_created) {
                this.cache = {}
                this.cache_created = now
            }

            if (!(groupname in this.cache)) {
                const rule2 = (ent) => {return (ent.$csp_destroyed_at < 0 || now <= ent.$csp_destroyed_at) && rule(ent)}
                let grp = Object.values(this.parent.entities).filter(rule2)

                if (sort_rule !== null) {
                    grp = grp.sort(sort_rule)
                }

                this.cache[groupname] = grp


            }

            return this.cache[groupname]
        }
    }
}


export class CspWorld {
    constructor(client) {
        this.client = client
        this.ecs = new ECS(this)
        this.entities = {}

        // assume the network synced entities are in the range 0x0000 to 0xFFFF
        this.next_entid = 0x010000

    }


    addNetworkEntity(ent, entid) {
        ent.entid = entid
        this.entities[entid] = ent
    }

    addEntity(ent, entid=-1) {
        if (entid < 0) {
            entid = this.next_entid
            this.next_entid += 1
        }
        ent.entid = entid
        this.entities[entid] = ent
    }

    sendEvent(event) {
        this.client.send(event)
    }

    update(dt) {

    }

    // todo this feels like a hack
    update_entities(dt) {

    }

    paint(ctx) {

    }

    getState() {
        const state = {}
        for (const entid in this.entities) {
            const es = this.entities[entid].getState()
            if (es !== null) {
                state[entid] = es
            }
        }
        return state
    }

    setState(state) {
        for (const entid in this.entities) {
            if (!!state[entid]) {
                this.entities[entid].setState(state[entid])
                this.entities[entid].$csp_active = true
            } else {
                this.entities[entid].$csp_active = false
            }
        }
    }

}

export class CspController {
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

export class CspReceiver {
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
        return this.map.getState()
    }

    _updatestate() {

        // TODO: this is always 1/60, but could be part of the state
        // its a constant
        // it  could be variable?
        //
        this.map.update_entities(1/60)
    }

    _setstate(state) {
        this.map.setState(state)
    }

    _local_receive(state) {

        //console.log("receive local", "now=", this.input_clock, "delayed until=", state.frame)

        const idx = this._frameIndex(state.frame ) // + this.input_delay

        this._setinput(idx, state.entid, state.uid, state)
    }

    _receive(msg) {
        const alpha = 0.8

        let frameIndex;

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
            //console.log("update offset (delay)", this.offsets[msg.entid], msg.$offset)
            this.offsets[msg.entid] = alpha * this.offsets[msg.entid] + ((1 - alpha) * (msg.$offset))
            frameIndex = msg.frame + this.input_delay + Math.round(this.offsets[msg.entid])
        }


        if ((frameIndex < this.input_clock - 60) || (frameIndex > this.input_clock + 60)) {
            //console.log(this.offsets)
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

        //if (frameIndex >= this.input_clock && msg.type == "input") {
        //    console.log("delta input", frameIndex - this.input_clock)
        //}

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
                //console.log("update offset (dirty)",
                //    "index=", frameIndex,
                //    "clock=", this.input_clock,
                //    "offset=", this.offsets[msg.entid],
                //    "offset=", msg.$offset)
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
                this.handleMessage(clock, entid, message, reconcile)
            }
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

    handleMessage(clock, entid, message, reconcile) {

    }
}

CspReceiver.instance = null
