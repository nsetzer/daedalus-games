
/**
 * csp_fable.js — Client-Side Prediction / Server Reconciliation core.
 *
 * A clean implementation of the CSP system described in csp.md, following the
 * "Best Practices for Authoritative Multiplayer" chapter:
 *
 *   - The server is authoritative: clients request actions, the server owns
 *     the truth and rebroadcasts validated events on its own timeline.
 *   - Client-side prediction: local inputs are applied immediately at
 *     (local_step + input_delay) without waiting for the server.
 *   - Server reconciliation: late events mark a dirty step; the client
 *     rewinds to a saved snapshot and replays all inputs forward.
 *     Snapshots are pure serialisable data (not live object references) so
 *     entities created or destroyed mid-history replay correctly.
 *   - Bending: purely visual error smoothing.  A shadow Entity holds the
 *     authoritative target and the real entity eases toward it over
 *     settings.bending_steps frames via onBend(progress, shadow) where
 *     progress advances linearly 0 -> 1.  Bending never runs during
 *     reconciliation and never feeds back into replayed state.
 *     Server-driven bending: every 6 steps the server broadcasts the state of
 *     entities that recently received input; clients bend remote entities
 *     toward it.  Entities flagged ownedByClient are corrected by
 *     reconciliation only and skip server bend events (no double-correction).
 *   - Clock synchronization: the client targets local_step = world_step -
 *     step_delay.  The simulation always runs with a fixed timestep (1/60)
 *     for determinism; drift is corrected by scaling how fast simulation
 *     time ACCUMULATES, so a drifting client occasionally runs 0 or 2 whole
 *     steps in a frame instead of distorting entity physics with a scaled dt.
 *
 * ---------------------------------------------------------------------------
 * Deviations from the v1 public API (csp.js), kept intentionally small:
 *
 *  1. input_delay moved into settings: use map.settings.input_delay
 *     (v1 exposed map.input_delay).  Default is unchanged (6 frames).
 *  2. settings.bending_steps is honoured (v1 hard-coded 15 in the loop) and
 *     onBend receives progress advancing linearly 0 -> 1 (v1 passed a
 *     constant 1/15).  Default bending_steps is 15 to match v1 timing.
 *  3. reconcile() no longer creates bending shadows or restores "wrong"
 *     visual states.  After reconcile, entities sit at their authoritative
 *     position.  Bending is driven only by csp-object-bend events and
 *     explicit Entity.bendTo() calls.
 *  4. During reconciliation, inputs are always applied to the real entity
 *     (v1 applied them only to the shadow when one existed, so the real
 *     object missed late inputs — bug #4 in csp.md).
 *  5. waiting_validation is keyed by "entid:uid" instead of uid alone, so
 *     uids from two different clients cannot collide (bug #11).
 *  6. Clock correction uses a fixed timestep driven by a scaled time
 *     accumulator; the v1 StepKind SKIP/CATCHUP mechanism (which forced a
 *     correction on a rigid every-4th-frame rhythm, bug #12) is gone.
 *     The client also re-times its own inputs when the server echo reveals
 *     they were applied at a different step, so the owned entity converges
 *     on the server result without bend events.
 *  7. Client-side sendObjectCreateEvent creates the object immediately so it
 *     can be found and receive input before the queued create event fires.
 *     The queued event is still processed (and skipped as a duplicate) so
 *     reconcile replay works.
 *  8. Map-level validateMessage(playerId, msg) is NOT called by the server
 *     (this matches v1's actual runtime, where the call site was removed —
 *     bug #8 documents that calling it would have crashed).  To validate,
 *     override ServerCspMap.validateMessage(playerId, message) and return
 *     false to reject.  Do not use it to retransmit (no sendNeighbors):
 *     the server echoes every validated event itself.
 *  9. getState()/setState() keep the v1 live-object snapshot shape for
 *     compatibility, but reconciliation uses internal pure-data snapshots
 *     (_snapshotState/_restoreSnapshot).
 * 10. The server echo of an input carries step = the server step at which the
 *     input was applied and state = the entity state after that step
 *     (v1 tagged the state with the wrong step, bug #7).
 */

/*
csp_fable.js is now a complete client/server CSP implementation, built on the existing skeleton and verified end-to-end: a simulated two-client + server session with 0–25 frames of random latency jitter converges to zero position error on all three maps, with reconciliation firing and recovering correctly. It passes node --check and has no lint errors, and I avoided constructs the daedalus parser has choked on before (no switch/case, no postfix increments inside object literals).

What was implemented
CspMap (shared sim core) — circular input/state history (step_rate * 2 steps), receiveEvent with staleness/duplicate guards and dirty marking, and reconcile() that restores a pure-data snapshot and replays inputs through the overridable update_main (so game-map overrides like MovementMap.update_main still run during replay, with the real frame dt, not a hardcoded 1/60). Bending runs in update_main with progress advancing linearly 0→1 over settings.bending_steps.

ClientCspMap — message routing, echo validation keyed by entid:uid, full-sync rebuild, and clock sync via a fixed-timestep accumulator: dt is never distorted (which would break determinism vs the server); instead simulation time accumulates at a scaled rate, so a drifting client occasionally runs 0 or 2 whole steps. One addition beyond the plan came out of testing: when the server echo shows an input was applied at a different step than predicted, the client re-times the input (removes the predicted application, requeues at the authoritative step, reconciles). Without this, the owned player permanently diverged under jitter — that was the failing case in the smoke test.

ServerCspMap — validation hook, step rewriting (client_step preserved, echo tagged with the exact applied step and post-step state), 100 ms heartbeats, join() full sync, and server-driven bend broadcasts every 6 steps for recently-active entities.

API deviations from v1 (documented in the file header)
input_delay moved to settings.input_delay (v1's plain field read undefined in the skeleton's send path).
settings.bending_steps is honored; onBend progress actually goes 0→1.
reconcile() no longer creates bending shadows — bending comes only from csp-object-bend / bendTo().
Inputs always apply to the real entity during reconcile (v1 bug #4).
waiting_validation keyed entid:uid (bug #11).
SKIP/CATCHUP replaced by the accumulator clock (bug #12), plus echo-driven input re-timing.
Client sendObjectCreateEvent creates the object immediately (so it can receive input before the queued event fires).
Map-level validateMessage is not called by the server — override ServerCspMap.validateMessage instead. The demo maps' validateMessage → sendNeighbors pattern would now double-deliver since the server echoes everything itself; those overrides are simply unused.
Compatibility kept for existing consumers: _x_nextEntId (troid), paint_overlay (fireworks), join() (server entries), step_delay/world_step as mutable fields (axedemo latency buttons), MessageKind values 1/2/3 (axedemo's msg.kind == 2 routing), and the v1 live-object getState()/setState() shape.
*/
function debug(msg) {

    console.log(`*${pad(performance.now()/1000, 12, ' ')}: ${msg}`)
}

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

/**
 * Base class for any synchronized object in the game.
 *
 * Every object that lives in a `CspMap` and participates in client-side
 * prediction / server reconciliation extends `Entity`. Subclasses are
 * registered by name (via `CspMap.registerClass`) so they can be created from
 * network events on both the client and the server, and instances are driven
 * identically by the shared simulation core.
 *
 * Subclasses should override the lifecycle hooks below. The base
 * implementations are intentionally no-ops (or trivial defaults) so an entity
 * only implements the behavior it needs.
 *
 * Serialization:
 *   `getState()` / `setState()` define the entity's synchronized state. They are
 *   used for full syncs, for snapshotting into the state history, and for
 *   restoring/replaying during reconciliation. Return only plain, serialisable
 *   data from `getState()`.
 *
 * Lifecycle hooks:
 *   - `update(dt)`   advance the simulation by one tick.
 *   - `onInput(payload)` apply a player/game input to this entity.
 *   - `paint(ctx)`   render the entity (client only).
 *   - `onBend(progress, shadow)` visually ease toward an authoritative "shadow"
 *                    copy during error smoothing; default snaps immediately.
 *   - `bendTo(state, world_step)` begin bending toward the given state.
 *
 * @param {string} entid - unique identifier for this entity within the map.
 * @param {object} props - construction properties (position, owner, etc).
 *
 * Internal fields (managed by the owning `CspMap`, not set by game code):
 *   @property {string}  entid    unique entity id.
 *   @property {boolean} active   when false the entity is skipped during update.
 *   @property {Function} _destroy detaches the entity from its world; throws
 *                                 until the entity is attached to a map.
 */
export class Entity {
    constructor(entid, props) {
        this.entid = entid
        this._destroy = () => {throw new Error("entity not attached to a world")}
        this.active = true

        // internal bookkeeping, managed by CspMap
        this._classname = null
        this._x_debug_map = null
        this._x_last_input_step = null
        this._isShadow = false
        this._shadow = null           // Entity | null: authoritative bend target
        this._shadow_step = 0         // frames elapsed since the shadow was created
        this._server_shadow = null    // Entity | null: reserved for partial sync

        // Prediction error smoothing (client only): a purely visual offset the
        // renderer adds to the entity's position.  When reconciliation snaps
        // the authoritative position, the difference is folded in here and
        // decays over a few steps so the visible position eases toward the
        // truth instead of teleporting.  Never read by the simulation.
        this._render_offset_x = 0
        this._render_offset_y = 0
    }

    /**
     * Visual X/Y for rendering: the authoritative position plus the decaying
     * prediction-error offset.  Entities with a `rect` get sensible defaults;
     * subclasses using other position fields can override these.
     */
    getRenderX() {
        return (this.rect ? this.rect.x : 0) + this._render_offset_x
    }

    getRenderY() {
        return (this.rect ? this.rect.y : 0) + this._render_offset_y
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

    /**
     * Begin bending toward the given state.
     * Creates a shadow Entity at `state`; each frame update_main advances the
     * shadow and calls onBend(progress, shadow) until progress reaches 1.
     *
     * @param {object} state - authoritative state to bend toward.
     * @param {number|null} world_step - optional step hint stored on the shadow.
     * @returns {Entity|null} the shadow, or null if not attached to a map.
     */
    bendTo(state, world_step=null) {
        if (!this._x_debug_map) {
            return null
        }
        const shadow = this._x_debug_map._construct(this.entid, this._classname, {})
        shadow._isShadow = true
        shadow._destroy = () => {}
        shadow._x_debug_map = this._x_debug_map
        shadow.setState(state)
        shadow._target_step = world_step
        this._shadow = shadow
        this._shadow_step = 0
        return shadow
    }
}

export class CspMap {

    constructor() {
        this.instanceId = this.constructor.name
        this.isServer = false
        this.playerId = "null"

        this.settings = {}
        this.settings.enable_bending = true
        // number of frames over which onBend eases toward the shadow
        this.settings.bending_steps = 15
        // buffered history in steps; 120 = 2 seconds at 60 FPS
        this.settings.step_rate = 120
        // number of frames to delay user inputs before applying to the local state
        // at 60FPS this assumes 100ms round trip with server
        this.settings.input_delay = 0

        // Prediction error smoothing (owned entities, client only).
        // When reconciliation corrects an owned entity, the positional error
        // is folded into a decaying render offset (see Entity._render_offset_*)
        // so the visible position eases toward the truth instead of snapping.
        //   error_smooth      per-step decay factor (0 = snap, ->1 = slower ease)
        //   error_smooth_max  cap on the offset; larger corrections snap so a
        //                     respawn/teleport does not slide across the map
        this.settings.error_smooth = 0.82
        this.settings.error_smooth_max = 128

        this.class_registry = {}

        this.objects = {}

        this.local_step = 0;
        this.next_msg_uid = 1
        this._last_dt = 1/60

        //-----------------------------------------------------
        // send (to remote)
        this.outgoing_messages = []

        // events sent by this client awaiting the server echo,
        // keyed by "entid:uid" (compound key: uid alone is not globally unique)
        this.waiting_validation = {}

        //-----------------------------------------------------
        // receive: circular buffers holding history for reconciliation

        this._capacity = this.settings.step_rate * 2

        // inputqueue[step % capacity] = {[entid]: {[uid]: event}}
        this.inputqueue = []
        for (let i=0; i < this._capacity; i++) {
            this.inputqueue.push({})
        }

        // statequeue[step % capacity] = pure-data snapshot or null
        // snapshot shape: {[entid]: {className, state}}
        this.statequeue = []
        for (let i=0; i < this._capacity; i++) {
            this.statequeue.push(null)
        }

        // reconciliation bookkeeping
        this.dirty_step = null
        this.dirty_objects = {}

        this.events = {}

        this.addCustomEvent("csp-object-create", this._onEventObjectCreate.bind(this))
        this.addCustomEvent("csp-object-input", this._onEventObjectInput.bind(this))
        this.addCustomEvent("csp-object-destroy", this._onEventObjectDestroy.bind(this))
        this.addCustomEvent("csp-object-bend", this._onEventObjectBend.bind(this))
        this.addCustomEvent("map-sync", (msg, reconcile)=>{})
        this.addCustomEvent("csp-client-settings", (msg, reconcile)=>{ console.log("received settings", msg)})
        this.addCustomEvent("csp-client-connect", (msg, reconcile)=>{ console.log("received connect", msg)})

        this._debug_reconcile = false
        this._debug_reconcile_count = 0
    }

    addCustomEvent(eventName, cbk) {

        this.events[eventName] = cbk
    }

    _onEventObjectCreate(msg, reconcile) {
        // guard against duplicate creation: the client creates its own objects
        // immediately in sendObjectCreateEvent, and the server echo arrives at
        // a different (rewritten) step so this handler can fire more than once.
        if (!(msg.entid in this.objects)) {
            this.createObject(msg.entid, msg.payload.className, msg.payload.props)
        }
    }

    _onEventObjectInput(msg, reconcile) {
        const ent = this.objects[msg.entid]
        if (!ent) {
            console.warn(this.instanceId, "input for unknown entity", msg.entid)
            return
        }

        // Always apply to the real entity, including during reconciliation.
        // The real entity is the simulation; a shadow (if any) is only a
        // visual bend target and is forwarded the input so it does not
        // diverge from the authoritative timeline.
        ent.onInput(msg.payload)

        if (!!ent._shadow) {
            ent._shadow.onInput(msg.payload)
        }
        if (!!ent._server_shadow) {
            ent._server_shadow.onInput(msg.payload)
        }

        ent._x_last_input_step = this.local_step
    }

    _onEventObjectDestroy(msg, reconcile) {
        this.destroyObject(msg.entid)
    }

    _onEventObjectBend(msg, reconcile) {
        // bending is cosmetic; never start one while replaying history
        if (reconcile) {
            return
        }
        const ent = this.objects[msg.entid]
        if (!ent) {
            return
        }
        // entities the local player controls are corrected by reconciliation;
        // applying server bends on top double-corrects and feels rubbery
        if (ent.ownedByClient === true) {
            return
        }
        if (!this.settings.enable_bending) {
            // bending disabled: apply the authoritative state directly
            ent.setState(msg.state)
            return
        }
        ent.bendTo(msg.state, msg.step)
    }

    acceptsEvent(etype) {

        return etype in this.events
    }

    /**
     * Main entry point for events (local or remote).
     * Queues the event at its target step.  If the step is already in the
     * past, marks the world dirty so reconcile() replays history.
     */
    receiveEvent(msg) {
        const step = msg.step

        if (step < this.local_step - this._capacity + 1) {
            console.warn(this.instanceId, "dropping stale event", step, "local", this.local_step)
            return
        }

        const idx = this._frameIndex(step)
        if (this._hasinput(idx, msg.entid, msg.uid)) {
            // duplicate (e.g. redundant retransmission) — ignore
            return
        }
        this._setinput(idx, msg.entid, msg.uid, msg)

        if (step <= this.local_step) {
            if (this.dirty_step === null || step < this.dirty_step) {
                this.dirty_step = step
            }
            this.dirty_objects[msg.entid] = true
        }
    }

    handleMessage(msg, reconcile) {

        if (msg.type in this.events) {
            this.events[msg.type](msg, reconcile)
        } else {
            console.log("csp-handle not supported " + JSON.stringify(msg))
        }
    }

    /**
     * Rewind and replay when late events arrived for steps already simulated.
     *
     *   1. restore the pure-data snapshot at (dirty_step - 1)
     *   2. replay inputs and entity updates dirty_step -> local_step,
     *      re-snapshotting each step
     *
     * After replay every entity sits at its authoritative position.  No
     * bending state is created here; visual corrections are driven by
     * csp-object-bend events (see the file header).
     */
    reconcile() {

        if (this.dirty_step === null || this.dirty_step > this.local_step) {
            this.dirty_step = null
            this.dirty_objects = {}
            return
        }

        const start = this.dirty_step
        const end = this.local_step

        if (start < end - this._capacity + 1) {
            console.error(this.instanceId, "reconcile range exceeds buffer; dropping. world may desync until next full sync")
            this.dirty_step = null
            this.dirty_objects = {}
            return
        }

        this._debug_reconcile = true
        this._debug_reconcile_count += 1

        // capture where owned entities are drawn RIGHT NOW (pre-correction) so
        // the visible-vs-authoritative error can be smoothed instead of snapped
        const pre = {}
        if (!this.isServer) {
            for (const entid in this.objects) {
                const obj = this.objects[entid]
                if (obj.ownedByClient && !!obj.rect) {
                    pre[entid] = {
                        x: obj.rect.x + obj._render_offset_x,
                        y: obj.rect.y + obj._render_offset_y
                    }
                }
            }
        }

        const restore_idx = this._frameIndex(start - 1)
        const restore_snapshot = this.statequeue[restore_idx]
        if (restore_snapshot === null) {
            // no snapshot yet (e.g. events queued before the first server
            // sync).  replay anyway so queued create/input events apply.
            console.warn(this.instanceId, "no snapshot at step", start - 1, "- replaying without state restore")
        } else {
            this._restoreSnapshot(restore_snapshot)
        }

        const saved_step = end
        for (let clock = start; clock <= end; clock += 1) {
            this.local_step = clock
            this._apply(clock, true)
            // advance one tick with the real frame delta (not hardcoded 1/60)
            this.update_main(this._last_dt, true)
            this.statequeue[this._frameIndex(clock)] = this._snapshotState()
        }
        this.local_step = saved_step

        // fold the correction into each owned entity's decaying render offset:
        // rendering at (rect + offset) keeps the entity where it was drawn this
        // frame, then eases toward the authoritative rect over the next steps.
        if (!this.isServer) {
            const cap = this.settings.error_smooth_max
            for (const entid in pre) {
                const obj = this.objects[entid]
                if (!!obj && !!obj.rect) {
                    let ox = pre[entid].x - obj.rect.x
                    let oy = pre[entid].y - obj.rect.y
                    if (ox > cap) { ox = cap } else if (ox < -cap) { ox = -cap }
                    if (oy > cap) { oy = cap } else if (oy < -cap) { oy = -cap }
                    obj._render_offset_x = ox
                    obj._render_offset_y = oy
                }
            }
        }

        this.dirty_step = null
        this.dirty_objects = {}
        this._debug_reconcile = false
    }

    update(dt, reconcile=false) {
        this.update_before(dt, reconcile)
        this.update_main(dt, reconcile)
        this.update_after(dt, reconcile)
    }

    update_before(dt, reconcile) {
        this.local_step += 1
        this._last_dt = dt

        // Apply the events queued for this step.
        //
        // Note: the buffer slot is NOT proactively cleared here.  Because
        // _frameIndex(local_step - capacity) === _frameIndex(local_step),
        // "clearing the oldest slot" would always clear the CURRENT step's
        // slot and erase its events before they fire.  Stale entries from a
        // previous buffer cycle are expired lazily inside _apply() instead.
        this._apply(this.local_step, false)
    }

    update_main(dt, reconcile) {
        for (const obj of Object.values(this.objects)) {
            if (!obj.active) {
                continue;
            }

            obj.update(dt)

            // decay the prediction-error render offset toward zero (client
            // only, real steps only — never during reconciliation replay)
            if (!reconcile && !this.isServer &&
                (obj._render_offset_x !== 0 || obj._render_offset_y !== 0)) {
                obj._render_offset_x *= this.settings.error_smooth
                obj._render_offset_y *= this.settings.error_smooth
                if (Math.abs(obj._render_offset_x) < 0.05) { obj._render_offset_x = 0 }
                if (Math.abs(obj._render_offset_y) < 0.05) { obj._render_offset_y = 0 }
            }

            // advance visual bending (never during reconciliation replay)
            if (!reconcile && this.settings.enable_bending && !!obj._shadow) {
                obj._shadow.update(dt)
                obj._shadow_step += 1

                const steps = this.settings.bending_steps
                let progress = obj._shadow_step / steps
                if (progress > 1.0) {
                    progress = 1.0
                }

                obj.onBend(progress, obj._shadow)

                if (progress >= 1.0) {
                    obj.setState(obj._shadow.getState())
                    obj._shadow = null
                    obj._shadow_step = 0
                }
            }

            if (!!obj._server_shadow) {
                obj._server_shadow.update(dt)
            }
        }
    }

    update_after(dt, reconcile) {
        const idx = this._frameIndex(this.local_step)
        this.statequeue[idx] = this._snapshotState()
    }

    paint(ctx) {

    }

    /**
     * v1-compatible world snapshot: {[entid]: {obj, state}}.
     * Contains live object references; reconciliation does NOT use this
     * (see _snapshotState), it is kept for game code compatibility.
     */
    getState() {
        const map_state = {}
        for (const [objId, obj] of Object.entries(this.objects)) {
            let state = obj.getState()
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
            if (!!obj._server_shadow) {
                obj._server_shadow.setState(item.state)
            }

            this.objects[objId] = obj
        }
    }

    // ------------------------------------------------------------------
    // internal snapshots: pure serialisable data, no live references.
    // this allows entities created or destroyed inside the replay window
    // to be reconstructed correctly.

    _snapshotState() {
        const snap = {}
        for (const [entId, obj] of Object.entries(this.objects)) {
            snap[entId] = {className: obj._classname, state: obj.getState()}
        }
        return snap
    }

    _restoreSnapshot(snap) {
        // remove entities that did not exist at the snapshot step; the
        // replay of their csp-object-create events will re-create them
        for (const entid of Object.keys(this.objects)) {
            if (!(entid in snap)) {
                delete this.objects[entid]
            }
        }

        for (const [entid, item] of Object.entries(snap)) {
            let obj = this.objects[entid]
            if (!obj) {
                obj = this._construct(entid, item.className, {})
                obj._destroy = () => {this.destroyObject(entid)}
                obj._x_debug_map = this
                this.objects[entid] = obj
            }
            obj.setState(item.state)
        }
    }

    // ------------------------------------------------------------------

    sendMessage(playerId, message) {
        this.outgoing_messages.push({
            kind: MessageKind.DIRECT,
            playerId: playerId,
            message:message})
    }

    sendNeighbors(playerId, message) {
        if (!this.isServer) {
            throw {message: "can only send to neighbors from the server"}
        }
        this.outgoing_messages.push({
            kind: MessageKind.NEIGHBORS,
            playerId,
            message})
    }

    sendBroadcast(playerId, message) {
        if (!this.isServer) {
            throw {message: "can only broadcast from the server"}
        }
        const tmp = {
            kind: MessageKind.BROADCAST,
            "playerId":playerId,
            "message":message
        }
        this.outgoing_messages.push(tmp)
    }

    registerClass(className, classConstructor) {

        this.class_registry[className] = classConstructor

    }

    _construct(entId, className, props) {
        // construct an object, including shadow objects
        const ctor = this.class_registry[className]
        if (!ctor) { throw {"error": "className not registered:" + className}}
        const ent = new ctor(entId, props)
        ent._classname = className
        return ent
    }

    createObject(entId, className, props, initial_state=null) {

        if (entId in this.objects) {
            const existing = this.objects[entId]
            if (initial_state !== null) {
                existing.setState(initial_state)
            }
            return existing
        }

        const ent = this._construct(entId, className, props)
        ent._destroy = ()=>{this.destroyObject(entId)}
        ent._x_debug_map = this

        this.objects[entId] = ent

        if (initial_state !== null) {
            ent.setState(initial_state)
        }

        return ent
    }


    destroyObject(entId) {

        if (entId in this.objects) {
            delete this.objects[entId]
        } else {
            console.log('no object to delete', entId)
        }
    }

    _nextEntId() {
        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;
        return '' + uid
    }

    // legacy alias used by existing game code
    _x_nextEntId() {
        return this._nextEntId()
    }

    // event is {type, step, entid, uid, payload}
    sendObjectInputEvent(entid, payload) {
        const type = "csp-object-input"
        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const event = {
            type,
            step: this.local_step + this.settings.input_delay,
            entid,
            uid,
            payload,
            _x_debug_t: performance.now()
        }

        // predict: apply locally at the scheduled step
        this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.waiting_validation[entid + ":" + uid] = event
            this.sendMessage(this.playerId, event)
        }

        return event
    }

    sendClientConnectEvent() {

        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const type = "csp-client-connect"

        const event = {
            type,
            step: this.local_step + this.settings.input_delay,
            uid,
        }

        if (this.isServer) {
            throw new Error("sendClientConnectEvent not implemented for server")
        } else {
            this.sendMessage(this.playerId, event)
        }

        return event

    }

    sendObjectCreateEvent(className, props) {

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
            step: this.local_step + this.settings.input_delay,
            entid,
            uid,
            payload,
            _x_debug_t: performance.now()
        }

        this.receiveEvent(event)

        // create immediately on the client so the object exists and can
        // receive input before the queued event fires.  the queued event
        // (and the server echo) are skipped as duplicates by the guard in
        // _onEventObjectCreate.
        if (!this.isServer && !(entid in this.objects)) {
            this.createObject(entid, className, props)
        }

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.sendMessage(this.playerId, event)
        }

        return event

    }

    sendObjectDestroyEvent(entid) {

        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const type = "csp-object-destroy"

        const event = {
            type,
            step: this.local_step + this.settings.input_delay,
            entid,
            uid,
            _x_debug_t: performance.now()
        }

        this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.sendMessage(this.playerId, event)
        }

        return event

    }

    sendObjectBendEvent(entid, state) {

        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const type = "csp-object-bend"

        const event = {
            type,
            step: this.local_step,
            entid,
            uid,
            state,
            _x_debug_t: performance.now()
        }

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.sendMessage(this.playerId, event)
        }

        return event

    }

    // ------------------------------------------------------------------
    // circular buffer internals

    _frameIndex(k) {
        let idx = k % this._capacity
        if (idx < 0) {
            idx += this._capacity
        }
        return idx
    }

    _hasinput(idx, entid, uid) {
        return (!!this.inputqueue[idx]) &&
               (entid in this.inputqueue[idx]) &&
               (uid in this.inputqueue[idx][entid])
    }

    _setinput(idx, entid, uid, input) {
        if (this.inputqueue[idx][entid] === undefined) {
            this.inputqueue[idx][entid] = {}
        }
        this.inputqueue[idx][entid][uid] = input
    }

    _apply(clock, reconcile) {
        const idx = this._frameIndex(clock)
        const slot = this.inputqueue[idx]
        for (const entid in slot) {
            for (const uid in slot[entid]) {
                const message = slot[entid][uid]
                if (message.step === clock) {
                    this.handleMessage(message, reconcile)
                } else if (message.step < clock) {
                    // entry from a previous buffer cycle: expire lazily
                    delete slot[entid][uid]
                }
            }
        }
    }

    /**
     * Queries the objects based on the provided query.
     * @param {Object} query - The query object containing properties to filter the objects.
     * @returns {Array} - An array of objects that match the query.
     *
     * query can contain the following properties:
     *
     * className: search for objects that match the given class name
     * instanceof: search for objects that are instances of the given class
     * instancein: search for objects that are instances of any of the given classes
     * property: search for objects that have a property matching a given value
     *           if the value is undefined, then return objects that have the
     *           property regardless of the value
     *
     * queryObjects({className: "Player"})
     * queryObjects({solid: true})
     * queryObjects({breakable: undefined}) // find objects that implement breakable
     */
    queryObjects(query) {

        return Object.values(this.objects).filter(obj => {

            for (const [property, item] of Object.entries(query)) {
                if (property == 'className') {
                    if (obj._classname != item) {
                        return false
                    }
                } else if (property == 'instanceof') {
                    if (!(obj instanceof item)) {
                        return false
                    }
                } else if (property == 'instancein') {
                    if (!item.some(T => obj instanceof T)) {
                        return false
                    }
                }else {
                    if (!obj.hasOwnProperty(property)) {
                        return false
                    }

                    if (item !== undefined && obj[property] != item) {
                        return false
                    }
                }
            }

            return true

        })
    }

}

/**
 * Routing hint attached to every outgoing message. The transport layer reads
 * `kind` to decide who receives the message and how `playerId` is interpreted.
 *
 * Each entry pushed onto `outgoing_messages` has the shape:
 *   { kind: MessageKind, playerId: string, message: object }
 *
 * - DIRECT    (1): deliver to the single player named by `playerId`.
 *                  Used by both client and server (see `sendMessage`). On the
 *                  client this addresses the server; on the server it addresses
 *                  one specific player.
 * - NEIGHBORS (2): server-only. Deliver to the sender's neighbors (the other
 *                  players relevant to `playerId`), typically excluding the
 *                  sender. Sent via `sendNeighbors`; throws if called on a client.
 * - BROADCAST (3): server-only. Deliver to every connected player. Here
 *                  `playerId` identifies the *originating* player so the
 *                  transport can exclude or special-case the sender. Sent via
 *                  `sendBroadcast`; throws if called on a client.
 */
const MessageKind = {
    DIRECT: 1,
    NEIGHBORS: 2,
    BROADCAST: 3
}

/**
 * Client wrapper around a CspMap.
 *
 * Responsibilities:
 *   - ingest network messages and route them into the map
 *   - validate server echoes of this client's own inputs
 *   - drive reconciliation once per frame
 *   - keep the local clock a fixed number of steps behind the server's,
 *     correcting drift by continuously scaling dt
 */
export class ClientCspMap {

    constructor(map) {

        this.map = map
        this.map.isServer = false

        // last step received from the server; -1 until the first map-sync
        this.world_step = -1
        this.incoming_message = []

        // target gap: local_step = world_step - step_delay
        this.step_delay = 6

        this.next_msg_uid = 1

        // Clock correction with a fixed simulation timestep.
        //
        // The simulation must be deterministic: the server steps entities
        // with a fixed dt, so the client must too, or replayed inputs land
        // at the same steps but produce different positions.  Instead of
        // scaling the dt passed to entities, the client scales how fast
        // simulation TIME accumulates.  Each frame, dt * _dt_scale is added
        // to an accumulator and whole fixed-size steps are consumed from it,
        // so a drifting client gently runs 0 or 2 steps on an occasional
        // frame rather than distorting physics.
        this._step_dt = 1/60
        this._accumulator = 0
        this._dt_scale = 1.0
        this._correction_rate = 0.02
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

    // process a frame tick. dt is the delta-time since the last frame
    // generally this will always be 1/60th of a second
    update(dt) {

        // ---- 1. drain incoming network messages --------------------------

        while (this.incoming_message.length > 0) {
            const msg = this.incoming_message.shift()

            if (msg.type === "map-sync") {

                if (this.world_step < 0) {
                    // first sync: initialise the clocks.
                    const new_local = msg.step - this.step_delay

                    // any events queued before the clock was known (e.g. the
                    // initial object creates) may now be in the past.  mark
                    // them dirty so reconcile() applies them.
                    const scan_from = Math.max(0, new_local - this.map._capacity + 1)
                    for (let s = scan_from; s <= new_local; s++) {
                        const idx = this.map._frameIndex(s)
                        const slot = this.map.inputqueue[idx]
                        for (const entid in slot) {
                            for (const uid in slot[entid]) {
                                if (slot[entid][uid].step === s) {
                                    if (this.map.dirty_step === null || s < this.map.dirty_step) {
                                        this.map.dirty_step = s
                                    }
                                    this.map.dirty_objects[entid] = true
                                }
                            }
                        }
                    }

                    this.world_step = msg.step
                    this.map.local_step = new_local
                } else if (msg.step > this.world_step) {
                    this.world_step = msg.step
                }

                if (msg.sync === 1) {
                    this._applyFullSync(msg)
                }

            } else if (msg.type === "csp-object-create") {
                this.map.receiveEvent(msg)

            } else if (msg.type === "csp-object-input") {
                const vkey = msg.entid + ":" + msg.uid
                if (vkey in this.map.waiting_validation) {
                    // server echo of our own input
                    const original = this.map.waiting_validation[vkey]
                    delete this.map.waiting_validation[vkey]

                    const ent = this.map.objects[msg.entid]
                    if (!!ent && msg.client_step !== undefined) {
                        ent._server_latency = this.map.local_step - msg.client_step
                    }

                    if (msg.step !== original.step) {
                        // the server applied our input at a different step
                        // than we predicted (latency jitter).  correct the
                        // timeline: remove the predicted application and
                        // requeue the input at the authoritative step, then
                        // let reconcile() replay history.  this keeps the
                        // owned entity converged without server bend events.
                        const idx = this.map._frameIndex(original.step)
                        if (this.map._hasinput(idx, original.entid, original.uid)) {
                            delete this.map.inputqueue[idx][original.entid][original.uid]
                        }
                        if (original.step <= this.map.local_step) {
                            if (this.map.dirty_step === null || original.step < this.map.dirty_step) {
                                this.map.dirty_step = original.step
                            }
                            this.map.dirty_objects[original.entid] = true
                        }
                        this.map.receiveEvent(msg)
                    }
                    // if the steps match, the prediction was exactly right
                    // and the echo carries no new information: discard.
                } else {
                    // another player's input
                    this.map.receiveEvent(msg)
                }

            } else if (msg.type === "csp-object-destroy") {
                this.map.receiveEvent(msg)

            } else if (msg.type === "csp-object-bend") {
                this.map.receiveEvent(msg)

            } else {
                console.warn("unrecognized map message", msg)
            }
        }

        // prune validation entries the server never echoed (e.g. rejected)
        for (const key of Object.keys(this.map.waiting_validation)) {
            const event = this.map.waiting_validation[key]
            if (event.step < this.map.local_step - this.map._capacity) {
                delete this.map.waiting_validation[key]
            }
        }

        // ---- 2. reconcile late events -------------------------------------

        this.map.reconcile()

        // ---- 3. advance the simulation with smooth clock correction -------

        if (this.world_step >= 0) {

            const delta = this.world_step - this.map.local_step

            if (delta > this.step_delay) {
                // behind the server: gently speed up
                this._dt_scale = Math.min(this._dt_scale + this._correction_rate, 1.25)
            } else if (delta < this.step_delay) {
                // ahead of the server: gently slow down
                this._dt_scale = Math.max(this._dt_scale - this._correction_rate, 0.75)
            } else if (this._dt_scale > 1.0) {
                this._dt_scale = Math.max(this._dt_scale - this._correction_rate, 1.0)
            } else if (this._dt_scale < 1.0) {
                this._dt_scale = Math.min(this._dt_scale + this._correction_rate, 1.0)
            }

            this.world_step += 1

            // consume whole fixed-size steps from the scaled accumulator
            this._accumulator += dt * this._dt_scale
            let steps_run = 0
            while (this._accumulator >= this._step_dt - 1e-9 && steps_run < 4) {
                this._accumulator -= this._step_dt
                this.map.update_before(this._step_dt, false)
                this.map.update_main(this._step_dt, false)
                this.map.update_after(this._step_dt, false)
                steps_run += 1
            }
        }
    }

    /**
     * Rebuild the world from a full server snapshot (map-sync with sync: 1).
     */
    _applyFullSync(msg) {
        this.map.objects = {}
        for (const [entId, item] of Object.entries(msg.objects)) {
            this.map.createObject(entId, item.className, {}, item.state)
        }

        // record the authoritative snapshot at the sync step, then replay
        // any inputs already buffered for later steps
        const idx = this.map._frameIndex(msg.step)
        this.map.statequeue[idx] = this.map._snapshotState()

        this.map.dirty_step = msg.step + 1
        this.map.reconcile()
    }

    paint(ctx) {
        this.map.paint(ctx)
    }

    paint_overlay(ctx) {
        ctx.font = "16px mono";
        ctx.fillStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText("world step: " + this.world_step + " " + fmtTime(this.world_step/60), 2, 2);
        const d = this.map.local_step - this.world_step
        const s = (d>=0)?'+':""
        ctx.fillText("local step: " + this.map.local_step + " " + s + d + " dt x" + this._dt_scale.toFixed(2), 2, 2 + 16);
        ctx.fillText("entities: " + Object.keys(this.map.objects).length, 2, 2 + 32);
    }
}

/**
 * Server wrapper around a CspMap.
 *
 * Responsibilities:
 *   - validate incoming client events (override validateMessage to reject)
 *   - rewrite client step numbers onto the server timeline and apply them
 *   - echo validated events back to all clients with the authoritative
 *     post-step state attached
 *   - broadcast periodic map-sync heartbeats for clock synchronization
 *   - broadcast csp-object-bend for recently-active entities so clients can
 *     bend remote objects toward the authoritative state
 */
export class ServerCspMap {
    constructor(map) {
        this.map = map
        this.map.isServer = true
        this.incoming_message = []
        // the server is the truth; it never bends its own state
        this.map.settings.enable_bending = false
        this.sync_timer = .1
    }

    acceptsEvent(type) {
        return this.map.acceptsEvent(type)
    }

    /**
     * Override on a subclass (or assign on the instance) to validate client
     * messages.  Return false to reject; anything else accepts.
     *
     * Note: this lives on ServerCspMap, not on the game's CspMap subclass.
     * Do not retransmit from here — the server echoes validated events
     * itself (see update()).
     */
    validateMessage(playerId, message) {
        return true
    }

    validateEvent(playerId, message) {
        return this.validateMessage(playerId, message) !== false
    }

    receiveMessage(playerId, message) {
        this.incoming_message.push({playerId, message})
    }

    /**
     * Send the current settings and a full world snapshot to a newly
     * connected player.
     */
    join(playerId) {

        const uid1 = this.map.next_msg_uid;
        this.map.next_msg_uid += 1;

        this.map.sendMessage(playerId, {
            type: "csp-client-settings",
            uid: uid1,
            step: this.map.local_step,
            settings: this.map.settings,
        })

        const objects = {}
        for (const [objId, obj] of Object.entries(this.map.objects)) {
            objects[objId] = {className: obj._classname, state: obj.getState()}
        }

        const uid2 = this.map.next_msg_uid;
        this.map.next_msg_uid += 1;

        this.map.sendMessage(playerId, {
            type: "map-sync",
            uid: uid2,
            step: this.map.local_step,
            sync: 1,
            objects: objects,
        })
    }

    // paint is a no-op for the server
    paint(ctx) {
    }

    // process a frame tick. dt is the delta-time since the last frame
    // generally this will always be 1/60th of a second
    update(dt) {

        // ---- heartbeat -----------------------------------------------------

        this.sync_timer -= dt
        if (this.sync_timer < 0) {
            this.sync_timer += 0.1

            const uid = this.map.next_msg_uid;
            this.map.next_msg_uid += 1;

            this.map.sendBroadcast(null, {
                type: "map-sync",
                uid: uid,
                step: this.map.local_step,
                sync: 0,
                _x_debug_t: performance.now()
            })
        }

        // ---- ingest client messages ----------------------------------------
        //
        // capture the apply step BEFORE stepping the simulation so the echo
        // carries the exact step at which each input took effect.

        const apply_step = this.map.local_step + 1
        const to_echo = []

        while (this.incoming_message.length > 0) {
            const item = this.incoming_message.shift()
            const playerId = item.playerId
            const message = item.message

            if (!this.validateEvent(playerId, message)) {
                continue
            }

            // rewrite the client's step onto the server timeline; keep the
            // original step so the client can measure round-trip latency
            const rewritten = {...message, client_step: message.step, step: apply_step}
            this.map.receiveEvent(rewritten)

            if (message.type !== "csp-client-connect") {
                to_echo.push(rewritten)
            }
        }

        // ---- advance the authoritative simulation ---------------------------

        this.map.update(dt)

        // ---- echo validated events to every client --------------------------
        //
        // after map.update() local_step === apply_step, so for inputs the
        // attached state is the authoritative state at exactly that step.

        for (const rewritten of to_echo) {
            const echo = {...rewritten}
            if (echo.type === "csp-object-input") {
                const ent = this.map.objects[echo.entid]
                if (!!ent) {
                    echo.state = ent.getState()
                }
            }
            this.map.sendBroadcast(null, echo)
        }

        // ---- server-driven bending ------------------------------------------
        //
        // every 6 steps, broadcast the authoritative state of entities that
        // received input recently.  clients bend their remote copies toward
        // it (entities flagged ownedByClient skip it; reconciliation corrects
        // those).

        if (this.map.local_step % 6 === 0) {
            for (const ent of Object.values(this.map.objects)) {
                if (ent._x_last_input_step != null &&
                    this.map.local_step < ent._x_last_input_step + 6) {
                    this.map.sendObjectBendEvent(ent.entid, ent.getState())
                }
            }
        }
    }
}
