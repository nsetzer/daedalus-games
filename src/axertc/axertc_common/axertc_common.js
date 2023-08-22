

export class CspMap {

    constructor() {
        this.isServer = false
        this.playerId = "null"

        this.step_rate = 60

        this.class_registry = {}

        this.objects = {}
        this.destroyed_objects = {}

        //this.world_step = 0
        this.local_step = 0;
        this.next_msg_uid = 1

        //-----------------------------------------------------
        // send (to remote)
        this.input_delay = 6
        this.outgoing_messages = []

        //-----------------------------------------------------
        // receive

        // capacity allows for +/- 2 seconds of inputs to be queued or cached
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

    }

    receiveEvent(msg) {


        let step = msg.step
        let idx = this._frameIndex(step)
        console.log(idx)

        if (!this._hasinput(idx, msg.entid, msg.uid)) {
            this._setinput(idx, msg.entid, msg.uid, msg)

            if (step <= this.local_step) {
                if (this.dirty_step == null || step < this.dirty_step) {
                    this.dirty_step = step
                }
            }


        }
    }

    reconcile() {
        // call after all remote messages have been received

        if (this.dirty_step !== null && this.dirty_step <= this.local_step) {
            //console.log("found dirty index at", this.dirty_step, this.local_step, "offset", this.received_offset)

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

            //if (snap_position !== null && snap_position.frameIndex == this.dirty_step) {
            //    this.physics.target.rect.x = snap_position.state.x
            //    this.physics.target.rect.y = snap_position.state.y
            //}

            // process up to the current time (+1), an update after this will take care of advancing to the next frame
            const start = this.dirty_step
            const end = this.local_step
            let error = false
            console.log("reconcile start=", start, "end=", end)

            for (let clock = start; clock <= end; clock += 1) {
                this.local_step = clock
                let idx = this._frameIndex(clock)
                this._apply(clock, true)
                this._stepstate()
                let new_global_state = this._getstate()
                this.statequeue[idx] = new_global_state
            }
        }

        this.dirty_step = null
    }

    handleMessage(msg) {

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
        this.inputqueue[delete_idx] = {}

        this._apply(this.local_step, false)

    }

    update_main(dt, reconcile) {

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
        return null
    }

    setState(state) {

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
                this.handleMessage(message)
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

        this.update_main(1.0/this.step_rate, true)
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

    setPlayerId(playerId) {
        // TODO: only needed on the client
        this.playerId = playerId
    }

    createObject(entId, className, props) {
        // get the class from the registered set of classes
        // check if the object has already been created


        // TODO: if the object already exists, reset to initial state
        const ctor = this.class_registry[className]

        const ent = new ctor(entId, props)

        this.objects[entId] = ent

        console.log('object created', entId)
    }


    destroyObject(entId) {

        if (entId in this.objects) {

            this.destroyed_objects[entId] = this.objects[entId]
            delete this.objects[entId]
            console.log('object destroyed', entId)
        } else {
            console.log('no object to delete', entId)
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
            entid= "" + uid
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

        console.log("csp-send", this.local_step, event)

        this.receiveEvent(event)

        this.sendMessage(null, event)
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
                    this.map.local_step = msg.step
                } else {
                    if (msg.step > this.world_step) {
                        this.world_step = msg.step
                    }
                }

                //this.receiveEvent()

            }
            else if (msg.type == "csp-object-create") {
                this.map.receiveEvent(msg)
            } else {
                console.log("unreconized map message", msg)
            }
        }

        this.map.reconcile()

        if (this.world_step >= 0) {

            const delta = this.world_step - this.map.local_step
            let step_kind = STEP_NORMAL

            if (delta > this.step_delay) {
                step_kind = STEP_CATCHUP
            }
            if (delta < this.step_delay) {
                step_kind = STEP_SKIP
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


}


export class ServerCspMap {
    constructor(map) {
        this.map = map
        this.map.isServer = true
        this.incoming_message = []
    }

    receiveMessage(playerId, message) {

        console.log("server received", message)

        if (this.map.validateMessage(playerId, message) === false) {
            ;
        } else {
            this.incoming_message.push(message)
        }

    }

    update(dt) {

        while (this.incoming_message.length > 0) {
            const msg = this.incoming_message.shift()
            this.map.receiveEvent(msg)
        }
        this.map.reconcile()
        this.map.update(dt)
    }
}