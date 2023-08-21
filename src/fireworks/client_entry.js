 
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

*/
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient, WidgetGroup, ButtonWidget
})

$import("fireworks_common", {FireworksMap})

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function fmtTime(s) {
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
            if (message.type === "map-sync") {
                this.map.receiveMessage(message)
            } else {
                this.incoming_messages.push(message)
            }
        })

        this.connection_sent = false

        console.log("create map", this.client.send)
        this.map = new FireworksMap(this.client.send.bind(this.client))

    }

    pause(paused) {

    }

    update(dt) {

        if (!this.connection_sent) {


            this.client.connect("/rtc/offer", {})
            this.connection_sent = true

        } else {

            if (this.client.state() == "disconnected") {


            } else {
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

            } else {
                console.log("client update", msg)
            }

        }


    }

    paint(ctx) {

        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        this.grp.paint(ctx)

        if (this.client) {

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "top"
            ctx.fillText(`world step: ${this.map.world_step} ${fmtTime(this.map.world_step/60)}`, 2, 2);
            const d = this.map.world_step - this.map.local_step
            const s = (d>=0)?'+':""
            ctx.fillText(`local step: ${this.map.local_step} ${s}${d}`, 2, 2 + 16);
            ctx.fillText(`latency ${this.latency}`, 2, 2 + 32);

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "bottom"
            ctx.fillText(this.client.state(), 2, gEngine.view.height - 2);
        }

    }

    resize() {
    }

    handleTouches(touches) {

        this.grp.handleTouches(touches)

        if (touches.length > 0) {
            let touch = touches[0]
            if (touch.pressed) {
                this.map.clientEvent("csp-player-input", 0, touch)
            }
        }
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
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
