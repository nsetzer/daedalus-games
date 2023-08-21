

export class CspMap {

    constructor() {

        this.step_rate = 60

        this.objects = {}

        //this.world_step = 0
        this.local_step = 0;

        //-----------------------------------------------------
        // send
        this.input_delay = 6

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

}

const STEP_NORMAL = 0
const STEP_SKIP = 1
const STEP_CATCHUP = 2

export class ClientCspMap extends CspMap {

    constructor(xsend = null) {
        super()

        this.xsend = xsend

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
            step: this.local_step + this.step_delay,
            entid,
            uid,
            payload
        }

        console.log("csp-send", this.local_step, event)

        this.receiveEvent(event)

        console.log(this.xsend)

        this.xsend?.(event)

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
                    this.local_step = msg.step
                } else {
                    if (msg.step > this.world_step) {
                        this.world_step = msg.step
                    }
                }

                //this.receiveEvent()

            } else {
                console.log("unreconized map message", msg)
            }
        }

        this.reconcile()

        if (this.world_step >= 0) {

            const delta = this.world_step - this.local_step
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
                this.update_before(dt, false)
                this.update_main(dt, false)
                this.update_after(dt, false)

                this.update_before(dt, false)
                this.update_main(dt, false)
                this.update_after(dt, false)
            } else {

                this.update_before(dt, false)
                this.update_main(dt, false)
                this.update_after(dt, false)
            }
        }


    }

}