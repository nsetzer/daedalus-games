

/**
 * 
 * TODO: implement a way on the client to disable extrapolation
 * purely for illustrative purposes
 * 
 * 
 * one way to implement reconciliation is to hydrate a shadow world
 * using the saved state, then run the simulation forward
 * then for up to N steps after run both the shadow world and current world
 * at every step bend objects that are detected to be out of sync
 *
 *
 * TODO: how to handle just kidding events
 *  the server receives a batch of inputs and processes them
 *  it decides a certain player died
 *  a late arriving input indicates that player actually moved out of the way
 *  reconciliation determines the player did not die.
 *  but the death notification has already been sent out.
 * - server is authoritative, at a certain point new inputs should be rejected
 * - the state, say 500ms in the past can be queried to the truth
 * - the game should send the authoritative truth as deltas ever 100 ms
 * answer: server sends out notification of death, but clients can process taking damage
 * https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
 * https://gamedev.stackexchange.com/questions/141496/server-reconciliation-for-multiplayer-games
 *
 * TODO: avoid server reconcillication on every input message
 * server can be run with a delay of 100 ms.
 *
 *
 * bending and partial sync should be optional features
 *  - mostly to demo performance without
 */

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

export function fmtTime(s) {
    let z = pad(Math.floor((s%1)*10), 1)
    let m = Math.floor(s / 60)
    s = pad(Math.floor(s % 60), 2);
    let h = Math.floor(m / 60)
    m = m % 60
    if (h > 0) {
        m = pad(m, 2);
        return `${h}:${m}:${s}.${z}`
    } else {
        return `${m}:${s}.${z}`
    }
}

export class Entity {
    constructor(entid, props) {
        this.entid = entid
        this._destroy = () => {throw new Error("entity not attached to a world")}
    }

    paint(ctx) {
    }

    update(dt) {
    }

    onInput(payload) {

    }

    onBend(progress, shadow) {
        // no bending by default
        this.setState(shadow.getState())
    }

    getState() {
        return {}
    }

    setState(state) {
        return
    }

    destroy() {
        this._destroy()
    }
}

export class CspMap {

    constructor() {
        this.instanceId = this.constructor.name
        this.isServer = false
        this.playerId = "null"

        this.enable_bending = true
        this.enable_partial_sync = true

        this.step_rate = 120 // 2 seconds of buffered inputs

        this.class_registry = {}

        this.objects = {}

        //this.world_step = 0
        this.local_step = 0;
        this.next_msg_uid = 1

        //-----------------------------------------------------
        // send (to remote)
        this.input_delay = 6
        this.outgoing_messages = []

        //-----------------------------------------------------
        // receive

        // capacity allows for +/- 4 seconds of inputs to be queued or cached
        // queue is [entity.entid][seqid]

        this.inputqueue_capacity = this.step_rate * 2
        this.inputqueue = []
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push({})
        }

        this.statequeue = []
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.statequeue.push(null)
        }

        this.dirty_step = null
        this.dirty_objects = {}

        this.partial_sync_objects = {}

        this.events = {}

        this.addCustomEvent("csp-object-create", this._onEventObjectCreate.bind(this))
        this.addCustomEvent("csp-object-input", this._onEventObjectInput.bind(this))
        this.addCustomEvent("csp-object-destroy", this._onEventObjectDestroy.bind(this))
        this.addCustomEvent("map-sync", (msg, reconcile)=>{})

        this._debug_reconcile = false
        this._debug_reconcile_count = 0

    }

    addCustomEvent(eventName, cbk) {

        this.events[eventName] = cbk
    }

    _onEventObjectCreate(msg, reconcile) {
        this.createObject(msg.entid, msg.payload.className, msg.payload.props)
    }

    _onEventObjectInput(msg, reconcile) {
        // TODO: if not reconciling, apply to both shadow and real object
        const ent = this.objects[msg.entid]
        if (!!ent._shadow) {
            ent._shadow.onInput(msg.payload)
            if (!reconcile) {
                ent.onInput(msg.payload)
            }
        } else {
            ent.onInput(msg.payload)
        }
    }

    _onEventObjectDestroy(msg, reconcile) {
        this.destroyObject(msg.entid)
    }

    acceptsEvent(etype) {

        return etype in this.events

    }

    receiveEvent(msg) {

        let step = msg.step
        let idx = this._frameIndex(step)

        if (step < this.local_step - this.step_rate) {
            console.warn("dropping stale input")
            return
        }

        if (!this._hasinput(idx, msg.entid, msg.uid)) {
            this._setinput(idx, msg.entid, msg.uid, msg)

            if (step <= this.local_step) {
                if (this.dirty_step == null || step < this.dirty_step) {
                    this.dirty_step = step
                }

                if (this.enable_bending) {
                    this.dirty_objects[msg.entid] = true
                }

                if (this.enable_partial_sync) {
                    this.partial_sync_objects[msg.entid] = 5 // for the next 5 syncs, send partial syncs for this object
                }
            }
        }


    }

    reconcile() {
        // call after all remote messages have been received

        if (this.dirty_step !== null && this.dirty_step <= this.local_step) {
            //console.log("found dirty index at", this.dirty_step, this.local_step, "offset", this.received_offset)

            this._debug_reconcile = true
            this._debug_reconcile_count += 1

            const last_index = this._frameIndex(this.dirty_step - 1)
            const last_known_state = this.statequeue[last_index]
            //console.log("restore state", dirty_step-1, idx, last_known_state)
            if (last_known_state === null) {
                // TODO: null last state could be a non issue
                // or instead we need to get the 'first' state
                console.error("last known state is null")
            } else {
                this._setstate(last_known_state)
            }

            if (this.enable_bending) {
                for (const objId of Object.keys(this.dirty_objects)) {
                    if (!!this.objects[objId]) {
                        const obj = this.objects[objId]
                        if (!obj._shadow) {
                            const ctor = this.class_registry[obj.constructor.name]
                            obj._shadow = new ctor(objId, {})
                            obj._shadow._destroy = ()=>{}
                            //obj._shadow.setState(obj.getState())
                            obj._shadow.setState(last_known_state[objId].state)
                        }
                        // TODO: shadow step should be set when reconciliation is done.
                        //       after N frames are drawn, then delete the shadow
                        //       as the objects will have converged to the right position
                        obj._shadow_step = 0
                    }
                }
            }

            //if (snap_position !== null && snap_position.frameIndex == this.dirty_step) {
            //    this.physics.target.rect.x = snap_position.state.x
            //    this.physics.target.rect.y = snap_position.state.y
            //}

            // process up to the current time (+1), an update after this will take care of advancing to the next frame
            const start = this.dirty_step
            const end = this.local_step
            //console.log(this.instanceId, `reconcile start=${start} end=${end} delta=${end-start} num_objects=${Object.keys(this.dirty_objects).length}`)
            if (start < this.local_step - this.step_rate) {
                throw new Error("reconcile starts before the last cached input")
            }

            for (let clock = start; clock <= end; clock += 1) {
                this.local_step = clock
                let idx = this._frameIndex(clock)
                this._apply(clock, true)
                this._stepstate()

                if (this.enable_bending) {
                    for (const objId of Object.keys(this.dirty_objects)) {
                        if (!!this.objects[objId]) {
                            // restore the incorrect state
                            const obj = this.objects[objId]
                            if (!!this.statequeue[idx][objId]) {
                                //console.log("shadow restore", this.statequeue[idx][objId].state)
                                obj.setState(this.statequeue[idx][objId].state)
                            } else {
                                // TODO: double check this, it might be a hack
                                // an object now exists that did not used to exist
                                // deleting breaks things but does fix the double explode issue from sever latency
                                //delete this.objects[objId]
                                // TODO: the bug here is that the object was created during reconciliation
                                //       so it would not have any prior state information to restore
                                // the solution may be to only create shadow objects during reconciliation
                                if (!obj._shadow) {
                                    console.warn(this.instanceId, "warning: missing state info for", objId) // , "step", this.local_step)
                                }
                            }
                        }
                    }
                }

                let new_global_state = this._getstate()
                this.statequeue[idx] = new_global_state
            }


        }

        this.dirty_step = null
        this.dirty_objects = {}
        this._debug_reconcile = false

    }

    handleMessage(msg, reconcile) {

        if (msg.type in this.events) {
            this.events[msg.type](msg, reconcile)
        } else {
            console.log(`csp-handle not supported ${JSON.stringify(msg)}`)
        }
    }

    update_before(dt, reconcile) {

        this.local_step += 1

        const delete_idx = this._frameIndex(this.local_step - this.step_rate)
        //for (const entid in this.inputqueue[delete_idx]) {
        //    for (const uid in this.inputqueue[delete_idx][entid]) {
        //        const msg = this.inputqueue[delete_idx][entid][uid]
        //        //TODO: check msg / state types
        //        //if (msg.type == "input") {
        //        //    if (!msg.applied) {
        //        //        // Crash the game whenever an input is not applied cleanly
        //        //        throw {message: "state not applied", msg}
        //        //    }
        //        //}
        //    }
        //}
        //if (Object.keys(this.inputqueue[delete_idx]).length > 0) {
        //    console.error(this.instanceId, "clear input index at", this.local_step, delete_idx)
        //}
        this.inputqueue[delete_idx] = {}

        this._apply(this.local_step, false)

    }

    update_main(dt, reconcile) {
        // todo: move this into the CspMap, require super?
        // add a check in update_after to see if super was called?
        for (const obj of Object.values(this.objects)) {
            obj.update(dt)
            if (!!obj._shadow) {
                //if (!obj._shadow.x) {
                //    console.log(obj)
                //    throw new Error(JSON.stringify(obj))
                //}
                //if (!obj._shadow.y) {
                //    console.log(obj)
                //    throw new Error(JSON.stringify(obj))
                //}
                obj._shadow.update(dt);

                if (!reconcile) {

                    const bend_steps = 30

                    obj._shadow_step += 1
                    const p = (obj._shadow_step) / bend_steps
                    obj.onBend(p, obj._shadow)

                    if (obj._shadow_step >= bend_steps){
                        if (this._debug_reconcile) {
                            throw new Error("shadow copy bending finished during reconcile")
                        }
                        //console.log(this.instanceId, this.local_step, "do bend finish", obj.entid)
                        //obj.setState(obj._shadow.getState())
                        delete obj._shadow
                    }

                }
            }

            //if (!obj.x) {
            //    throw new Error(JSON.stringify(obj))
            //}
            //if (!obj.y) {
            //    console.log(obj)
            //    throw new Error(obj)
            //}
        }
    }

    update_after(dt, reconcile) {
        const idx = this._frameIndex(this.local_step)
        this.statequeue[idx] = this._getstate()
    }

    update(dt, reconcile=false) {
        this.update_before(dt, reconcile)
        this.update_main(dt, reconcile)
        this.update_after(dt, reconcile)
    }

    paint(ctx) {

    }

    getState() {
        // TODO: this state is not serializeable for a full sync
        const map_state = {}
        for (const [objId, obj] of Object.entries(this.objects)) {
            let state;

            if (!!obj._shadow) {
                // if bending is enabled copy the shadow state
                // TODO: there could be a small amount of jitter
                //       if there is a second reconcile shortly after a reconcile completes.
                // when reconciliation begins, it rewinds to the last known good state
                // when bending is enabled, the 'last known good state' needs to have
                // the shadow state -- the true state of the object
                // an alternative solution could be to instead force reconciliation to
                // always begin from the last key frame, when partial updates are implemented
                // without keyframes, grabbing the state from the shadow copy ensures
                // that the object eventually ends up in the correct position
                state = obj._shadow.getState()
            } else {
                state = obj.getState()
            }
            map_state[objId] = {obj, state}
        }
        return map_state;
    }

    setState(state) {
        this.objects = {}
        for (const [objId, item] of Object.entries(state)) {
            const obj = item.obj
            obj.setState(item.state)
            if (!!obj._shadow) {
                obj._shadow.setState(item.state)
            }
            this.objects[objId] = obj
        }
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

    _apply(clock, reconcile) {
        const idx = this._frameIndex(clock)
        for (const entid in this.inputqueue[idx]) {
            for (const uid in this.inputqueue[idx][entid]) {
                const message = this.inputqueue[idx][entid][uid]
                if (message.step != this.local_step) {
                    //TODO: state history does not seem to be cleared correctly
                    console.error("illegal step", idx, this.local_step, message.step)
                } else {
                    this.handleMessage(message, reconcile)
                }
            }
        }
    }

    _getstate() {
        return this.getState()
    }

    _setstate(state) {
        this.setState(state)
    }

    _stepstate() {

        this.update_main(1.0/60, true)
    }

    sendMessage(playerId, message) {
        this.outgoing_messages.push({kind: 1, playerId: playerId, message:message})
    }

    sendNeighbors(playerId, message) {
        if (!this.isServer) {
            throw {message: "can only send to neighbors from the server"}
        }
        this.outgoing_messages.push({kind: 2, playerId, message})
    }

    sendBroadcast(playerId, message) {
        if (!this.isServer) {
            throw {message: "can only send to neighbors from the server"}
        }
        const tmp = {
            kind: 3,
            "playerId":playerId,
            "message":message
        }
        this.outgoing_messages.push(tmp)
    }

    registerClass(className, classConstructor) {

        this.class_registry[className] = classConstructor

    }

    createObject(entId, className, props) {
        // get the class from the registered set of classes
        // check if the object has already been created

        // TODO: if the object already exists, reset to initial state
        const ctor = this.class_registry[className]

        const ent = new ctor(entId, props)
        ent._destroy = ()=>{this.destroyObject(entId)}

        if (this.enable_bending) {
            if (entId in this.dirty_objects) {
                ent._shadow = new ctor(entId, props)
                ent._shadow._destroy = ()=>{}
                ent._shadow_step = 0
            }
        }

        this.objects[entId] = ent

        //console.log(this.instanceId, this._debug_reconcile?"reconcile":"normal", 'object created', this.local_step, this._frameIndex(this.local_step), entId)

        return ent
    }


    destroyObject(entId) {

        if (entId in this.objects) {
            //console.log(this.instanceId, 'object destroyed', this.local_step, entId, this.objects[entId].timer)

            delete this.objects[entId]
        } else {
            console.log('no object to delete', entId)
        }
    }

    sendObjectInputEvent(entid, payload) {
        const type = "csp-object-input"
        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const event = {
            type,
            step: this.local_step + this.input_delay,
            entid,
            uid,
            payload
        }

        this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.sendMessage(this.playerId, event)
        }

    }

    sendCreateObjectEvent(className, props) {

        // provide api to generate entid from message
        // entid is playerId + msg uid + localstep
        // entid is msg uid + localstep
        // because playerId may not be known by this class

        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const type = "csp-object-create"
        const payload = {className, props}

        let entid;

        if (this.isServer) {
            entid= "s" + uid
        } else {
            if (this.playerId === null) {
                throw {message: "playerId not set"}
            }
            entid= this.playerId + "-" + uid
        }

        const event = {
            type,
            step: this.local_step + this.input_delay,
            entid,
            uid,
            payload
        }

        //console.log("csp-send", this.local_step, event)


        this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.sendMessage(this.playerId, event)
        }

        return event

    }

    sendObjectDestroyEvent(entid) {

        // provide api to generate entid from message
        // entid is playerId + msg uid + localstep
        // entid is msg uid + localstep
        // because playerId may not be known by this class

        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const type = "csp-object-destroy"

        const event = {
            type,
            step: this.local_step + this.input_delay,
            entid,
            uid,
        }

        this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.sendMessage(this.playerId, event)
        }

        return event

    }

}

const STEP_NORMAL = 0
const STEP_SKIP = 1
const STEP_CATCHUP = 2

export class ClientCspMap {

    constructor(map) {

        this.map = map
        this.map.isServer = false

        this.world_step = -1
        this.incoming_message = []

        this.step_delay = 6

        this.next_msg_uid = 1

    }

    clientEvent(type, entid, payload) {

        let uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const event = {
            type,
            step: this.map.local_step + this.step_delay,
            entid,
            uid,
            payload
        }

        console.log("csp-send", this.map.local_step, event)

        this.map.receiveEvent(event)

        this.map.sendMessage(null, event)

    }

    setPlayerId(playerId) {
        this.map.playerId = playerId
    }

    acceptsEvent(type) {
        return this.map.acceptsEvent(type)
    }

    receiveMessage(message) {
        this.incoming_message.push(message)
    }

    update(dt) {

        while (this.incoming_message.length > 0) {
            const msg = this.incoming_message.shift()
            if (msg.type == "map-sync") {

                if (this.world_step < 0) {

                    // TODO: check reset
                    this.world_step = msg.step
                    this.map.local_step = msg.step - this.step_delay
                } else {
                    if (msg.step > this.world_step) {
                        this.world_step = msg.step
                    }
                }

                if (msg.sync === 1) {
                    console.log("received full sync")

                    let idx = this.map._frameIndex(msg.step)

                    this.map.objects = {}
                    for (const [entId, item] of Object.entries(msg.objects)) {
                        console.log("hydrate", entId)
                        const ent = this.map.createObject(entId, item.className, {})
                        ent.setState(item.state)
                    }

                    let new_global_state = this.map._getstate()
                    this.map.statequeue[idx] = new_global_state

                    this.map.dirty_step = msg.step + 1
                    this.map.reconcile()
                }

                //this.receiveEvent()

            }
            else if (msg.type == "csp-object-create") {
                this.map.receiveEvent(msg)
            }
            else if (msg.type == "csp-object-input") {
                this.map.receiveEvent(msg)
            }
            else if (msg.type == "csp-object-destroy") {
                this.map.receiveEvent(msg)
            }
            else {
                console.log("unreconized map message", msg)
            }
        }

        this.map.reconcile()

        if (this.world_step >= 0) {

            const delta = this.world_step - this.map.local_step
            let step_kind = STEP_NORMAL

            // this checks to see if the client step is out of sync with the
            // last message received from the server. Every forth
            // frame it takes corrective action to try and bring it into sync
            // however this has a side effect of not drawing certain frames
            // TODO: a better implementation would be to change the frame rate
            // of the client to be 58,59 or 61,62 FPS until the game is synchronized again
            if (this.map.local_step%4==0) {
                if (delta > this.step_delay) {
                    step_kind = STEP_CATCHUP
                    console.log("catchup", this.map.local_step)
                }
                if (delta < this.step_delay) {
                    step_kind = STEP_SKIP
                    console.log("skip", this.map.local_step)
                }
            }

            this.world_step += 1

            if (step_kind == STEP_SKIP) {

            } else if (step_kind == STEP_CATCHUP) {
                this.map.update_before(dt, false)
                this.map.update_main(dt, false)
                this.map.update_after(dt, false)

                this.map.update_before(dt, false)
                this.map.update_main(dt, false)
                this.map.update_after(dt, false)
            } else {

                this.map.update_before(dt, false)
                this.map.update_main(dt, false)
                this.map.update_after(dt, false)
            }
        }
    }

    paint(ctx) {
        this.map.paint(ctx)

    }

    paint_overlay(ctx) {

        ctx.font = "16px mono";
        ctx.fillStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`world step: ${this.world_step} ${fmtTime(this.world_step/60)}`, 2, 2);
        const d = this.map.local_step - this.world_step
        const s = (d>=0)?'+':""
        ctx.fillText(`local step: ${this.map.local_step} ${s}${d}`, 2, 2 + 16);
        ctx.fillText(`entities ${Object.keys(this.map.objects).length}`, 2, 2 + 32);
    }
}


export class ServerCspMap {
    constructor(map) {
        this.map = map
        this.map.isServer = true
        this.incoming_message = []
        this.map.enable_bending = false
        this.sync_timer = .1
    }

    acceptsEvent(type) {
        return this.map.acceptsEvent(type)
    }

    validateEvent(playerId, message) {
        return this.map.validateMessage(playerId, message) !== false
    }

    receiveMessage(playerId, message) {

        if (this.map.validateMessage(playerId, message) === false) {
            ;
        } else {
            this.incoming_message.push(message)
        }

    }

    join(playerId) {

        const objects = {}
        for (const [objId, obj] of Object.entries(this.map.objects)) {
            objects[objId] = {className:obj.constructor.name, state: obj.getState()}
        }

        const state = {
            type: "map-sync",
            step: this.map.local_step,
            sync: 1,
            objects: objects
        }

        const s = JSON.stringify(objects)
        console.log("full sync:", s.length)



        this.map.sendMessage(playerId, state)

    }
    

    paint(ctx) {
        this.map.paint(ctx)

    }

    update(dt) {

        this.sync_timer -= dt
        if (this.sync_timer < 0) {
            this.sync_timer += 0.1

            this.map.sendBroadcast(null, {
                type: "map-sync",
                step: this.map.local_step,
                sync: 0
            })
        }

        while (this.incoming_message.length > 0) {
            const msg = this.incoming_message.shift()
            this.map.receiveEvent(msg)
        }
        this.map.reconcile()
        this.map.update(dt)
    }
}