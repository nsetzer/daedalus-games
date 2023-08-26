 
/*

fireworks game

tap the screen to make fireworks. synchronized to all connected players



architecture

ClientApplication
ClientEngine (canvas)
Scene
CspReceiver
CspMap

ServerContext
ServerLobby
CspReceiver
CspMap

CspReceiver and CspMap may be blended together
    addObject
    receiveInput
    getState
    setState

map and entities implement get/set state

tap the screen
    scene sends a message to the server
    server receives message
    lobby receives message
        message is validated
        message is rebroadcast to all neighbors
        csp receiver receives message


csp-sync-message
    step: int
    fragment: int
    num_fragments: int
    events: list


Implementation order

- [easy]   implement synchronized clocks
- [medium] implement message sending / receiving
- [hard]   implement create/destroy


use pause break key to test resync


user presses a button
    sends a message with playerId, local_step+6, msg_uid, indicating the intent to create an object
    creates a firework with objectid <obj-`playerId`-`msg_uid`>
    server validates that the user is allowed to create this object, assigns an object id <obj-`playerId`-`msg_uid`>
    server broadcasts to all players that <playerid, msg_uid, oid> created an object at step <step>
    other players create the same object


    client:
        prop playerId
        fun  createObject(msg_uid, class-ctor, props)
                shadowObjects[(playerId, msg_uid)] = new class-ctor(props)
        fun  createObject(playerId, msg_uid, oid, class-ctor, props)

Shadow Objects
two kinds
    Predictive Shadow Copies
        player fires a gun,
        client creates the bullet
        server validates and updates the client to the true state
        the bullet can be created a head of time assuming that the server will validate it correctly

        solving this requires that object-ids are the player id that created them + a unique id


    Bending
        objects controlled by remote players should have a shadow copy
        the shadow copy receives all updates, including reconciliation
        the true objects dont get reconciled
        instead, at each step the true object is updated to be a little more like the shadow

validate / invalidate

when a client sends an input message
the server can just respond with the <entid, msg_uid> and whether it is valid/invalid
invalid messages are deleted by the framework and then reconciled.
the server can use sendNeighbors to forward the input to all peers
*/
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget, KeyboardInput, TouchInput
})
$import("axertc_common", {CspMap, ClientCspMap})
$import("maze_common", {MazeMap})



class DemoRealTimeClient extends RealTimeClient {

    constructor() {
        super();
        this.dcInterval = null
    }

    setCallback(callback) {
        this.callback = callback

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

class CspController {
    constructor(map) {

        this.map = map
        // cache buttons in case they need to be re-applied to a new object
        this.wheels = {}
        this.buttons = {}

    }

    getPlayer() {
        for (const obj of Object.values(this.map.map.objects)) {
            if (!!obj.playerId && obj.playerId==this.map.map.playerId) {
                return obj
            }
        }
        return null
    }

    setInputDirection(whlid, vector){
        //console.log("input wheel", whlid, vector)
        this.wheels[whlid] = vector
        const player = this.getPlayer()
        if (!player) {
            return
        }

        this.map.map.sendObjectInputEvent(player.entid, {whlid, vector})
        //this.inputqueue2.push({type: "wheel", whlid, vector})
    }

    // TODO: single button with pressed/released argument
    handleButtonPress(btnid){


        console.log("input button press", btnid)
        this.buttons[btnid] = true
        //this.inputqueue2.push({type: "button", btnid, pressed: true})
    }

    handleButtonRelease(btnid){
        console.log("input button release", btnid)
        this.buttons[btnid] = false
        //this.inputqueue2.push({type: "button", btnid, pressed: false})
    }
}

class DemoScene {


    constructor() {

        this.client = null

        this.keepalive_timer = 1
        this.incoming_messages = []
        this.latency = 0


        this.grp = new WidgetGroup()
        this.btn = this.grp.addWidget(new ButtonWidget())
        const btnw = 128
        const btnh = 32
        this.btn.setText("Disconnect")
        this.btn.rect.x = gEngine.view.width - btnw - 4
        this.btn.rect.y = 4
        this.btn.rect.w = btnw
        this.btn.rect.h = btnh
        this.btn.clicked = () => {
            this.client.disconnect()
        }

        this.client = new DemoRealTimeClient()
        this.client.setCallback(message => {

            if (this.map.acceptsEvent(message.type)) {
                this.map.receiveMessage(message)
            } else {
                this.incoming_messages.push(message)
            }
        })


        this.connection_sent = false

        console.log("create map", this.client.send)
        //let xsend = this.client.send.bind(this.client)
        this.map = new ClientCspMap(new MazeMap())

        console.log("map created", this.map)

        this.playerId = null

        this.controller = new CspController(this.map);

        this.touch = new TouchInput(this.controller)
        this.touch.addWheel(72, -72, 72)
        //this.touch.addButton(-60, -60, 40)
        this.touch.addButton(-40, -120, 40)
        this.touch.addButton(-120, -40, 40)

        this.keyboard = new KeyboardInput(this.controller);
        this.keyboard.addWheel_ArrowKeys()
        this.keyboard.addButton(KeyboardInput.Keys.SPACE)
        this.keyboard.addButton(KeyboardInput.Keys.CTRL)

    }

    pause(paused) {

    }

    update(dt) {

        if (!this.connection_sent) {


            this.client.connect("/rtc/offer", {})
            this.connection_sent = true

        } else {

            if (this.client.connected()) {
                this.client.update(dt)
                //console.log("xmit")
                this.keepalive_timer -= dt
                if (this.keepalive_timer < 5) {
                    this.keepalive_timer += 5
                    const msg = {"type": "keepalive", 't': performance.now()}
                    this.client.send(msg)
                }
            }

        }

        this.map.update(dt)

        this.grp.update(dt)


        while (this.incoming_messages.length > 0) {
            const msg = this.incoming_messages.shift()
            if (msg.type == "keepalive") {

                let t1 = performance.now();
                let t0 = msg.t
                this.latency = (t1 - t0)/2

            } else if (msg.type === "connect") {
                // todo grab player id from the client
                console.log(msg)
                this.playerId = msg.playerId
                this.map.setPlayerId(this.playerId)
                console.log("playerId:", this.playerId)
            } else {
                console.log("client scene received unknown message", msg)
            }

        }

        while (this.map.map.outgoing_messages.length > 0) {
            const msg = this.map.map.outgoing_messages.shift()
            this.client.send(msg.message)
        }



    }

    paint(ctx) {

        // TODO: move this into the client CSP implementation
        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        this.map.paint(ctx)
        this.grp.paint(ctx)
        this.touch.paint(ctx)

        if (this.client) {

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "bottom"

            ctx.fillText(`FPS: ${gEngine.fps} latency=${this.latency} ms ${this.client.state()}`, 2, gEngine.view.height - 2);
        }

        this.map.paint_overlay(ctx)

    }

    resize() {
    }

    handleTouches(touches) {
        this.touch.handleTouches(touches)
        this.grp.handleTouches(touches)
    }

    handleKeyPress(keyevent) {
        this.keyboard.handleKeyPress(keyevent);
    }

    handleKeyRelease(keyevent) {
        this.keyboard.handleKeyRelease(keyevent);
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
