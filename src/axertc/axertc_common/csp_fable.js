
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

    bendTo(state, world_step=null) {

    }
}

export class CspMap {

    constructor() {
        this.instanceId = this.constructor.name
        this.isServer = false
        this.playerId = "null"

        this.settings = {}
        this.settings.enable_bending = true
        this.settings.step_rate = true // 2 seconds of buffered inputs
        // number of frames to delay user inputs before applying to the local state
        // at 60FPS this assumes 100ms round trip with server
        this.settings.input_delay = 6

        this.class_registry = {}

        this.objects = {}

        this.local_step = 0;
        this.next_msg_uid = 1

        //-----------------------------------------------------
        // send (to remote)
        this.outgoing_messages = []

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

        ent._x_last_input_step = this.local_step

        if (!!ent._server_shadow) {
            ent._server_shadow.onInput(msg.payload)
        }

    }

    _onEventObjectDestroy(msg, reconcile) {
        this.destroyObject(msg.entid)
    }

    _onEventObjectBend(msg, reconcile) {

        this.objects[msg.entid].bendTo(msg.state)
    }

    acceptsEvent(etype) {

        return etype in this.events
    }

    receiveEvent(msg) {

    }

    handleMessage(msg, reconcile) {

        if (msg.type in this.events) {
            this.events[msg.type](msg, reconcile)
        } else {
            console.log(`csp-handle not supported ${JSON.stringify(msg)}`)
        }
    }

    update(dt, reconcile=false) {
    }

    paint(ctx) {

    }

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
            throw {message: "can only send to neighbors from the server"}
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

        const ent = this._construct(entId, className, props)
        ent._destroy = ()=>{this.destroyObject(entId)}
        ent._x_debug_map = this

        if (this.settings.enable_bending) {
            if (entId in this.dirty_objects) {
                ent._shadow = this._construct(entId, ent._classname, props)
                ent._shadow._isShadow = true
                ent._shadow._destroy = ()=>{}
                ent._shadow_step = 0
                ent._shadow._x_debug_map = this
            }
        }

        if (!(entId in this.objects)) {
            this.objects[entId] = ent
        }

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

    // event is {type, step, entid, uid, payload}
    sendObjectInputEvent(entid, payload) {
        const type = "csp-object-input"
        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const event = {
            type,
            step: this.local_step + this.input_delay,
            entid,
            uid,
            payload,
            _x_debug_t: performance.now()
        }

        this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            this.waiting_validation[uid] = event
            this.sendMessage(this.playerId, event)
        }
    }

    sendClientConnectEvent() {

        const uid = this.next_msg_uid;
        this.next_msg_uid += 1;

        const type = "csp-client-connect"

        const event = {
            type,
            step: this.local_step + this.input_delay,
        }

        if (this.isServer) {
            throw new Error("sendClientConnectEvent not implemented for client")
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
            step: this.local_step + this.input_delay,
            entid,
            uid,
            payload,
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
            step: this.local_step /* + this.input_delay */,
            entid,
            uid,
            state,
            _x_debug_t: performance.now()
        }

        // this.receiveEvent(event)

        if (this.isServer) {
            this.sendBroadcast(this.playerId, event)
        } else {
            //throw new Error("sendObjectBendEvent not implemented for client")
            this.sendMessage(this.playerId, event)
        }

        return event

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
        this.map.settings.enable_bending = false
        this.sync_timer = .1
    }

    acceptsEvent(type) {
        return this.map.acceptsEvent(type)
    }

    validateEvent(playerId, message) {
        return this.map.validateMessage(playerId, message) !== false
    }

    receiveMessage(playerId, message) {
        this.incoming_message.push({playerId, message})
    }

    // paint is a no-op for the server
    paint(ctx) {
    }

    // process a frame tick. dt is the delta-time since the last frame
    // generally this will always be 1/60th of a second
    update(dt) {
    }
}