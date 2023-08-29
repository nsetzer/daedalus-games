
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
    Physics2dPlatform
})
$import("axedemo_common", {FireworksMap, PlatformMap})

class DemoClient {

    constructor(map_player1, map_player2, map_server) {
        this.map_player1 = map_player1
        this.map_player2 = map_player2
        this.map_server = map_server

        this.p1_receive = message => {

            if (this.map_player1.acceptsEvent(message.type)) {
                this.map_player1.receiveMessage(message)
            }
        }

        this.p2_receive = message => {

            if (this.map_player2.acceptsEvent(message.type)) {
                this.map_player2.receiveMessage(message)
            }
        }

        this.server_receive = (playerId, message) => {
            if (this.map_server.acceptsEvent(message.type)) {
                this.map_server.receiveMessage(playerId, message)
            }
        }

        this.queue_p1_in = [] // from player 1 to the server
        this.queue_p1_out = [] // from the server to player 1
        this.queue_p2_in = []
        this.queue_p2_out = []

        this.queues = [
            {queue:this.queue_p1_in,  latency: .05, callback: (msg) => this.server_receive("player1", msg)},
            {queue:this.queue_p1_out, latency: .05, callback: this.p1_receive},
            {queue:this.queue_p2_in,  latency: .25, callback: (msg) => this.server_receive("player2", msg)},
            {queue:this.queue_p2_out, latency: .25, callback: this.p2_receive},
        ]

    }

    connect() {

    }

    update(dt) {

        while (this.map_player1.map.outgoing_messages.length > 0) {
            const msg = this.map_player1.map.outgoing_messages.shift()
            this.queue_p1_in.push({delay: 0, message: msg.message})
        }

        while (this.map_player2.map.outgoing_messages.length > 0) {
            const msg = this.map_player2.map.outgoing_messages.shift()
            this.queue_p2_in.push({delay: 0, message: msg.message})
        }

        while (this.map_server.map.outgoing_messages.length > 0) {
            const msg = this.map_server.map.outgoing_messages.shift()
            if ((msg.kind == 2 && msg.playerId!="player1") || msg.kind!=2) {
                this.queue_p1_out.push({delay: 0, message: msg.message})
            }
            if ((msg.kind == 2 && msg.playerId!="player2") || msg.kind!=2) {
                this.queue_p2_out.push({delay: 0, message: msg.message})
            }
        }

        for (let i=0; i < this.queues.length; i++) {
            const queue = this.queues[i]

            for (const item of queue.queue) {
                item.delay += dt
            }

            while (queue.queue.length > 0) {
                if (queue.queue[0].delay > queue.latency) {
                    //console.log(i, queue.latency, queue.queue[0].delay)
                    const msg = queue.queue.shift()
                    queue.callback(msg.message)
                } else {
                    break
                }
            }
        }

    }

    connected() {
        return true
    }

    state() {
        return "connected"
    }

    changeLatency(playerId, amount) {
        const step = 10

        if (playerId === "player1") {
            let latency = this.queues[0].latency
            latency += (step * amount) / 1000
            if (latency < 0.01) {
                latency = 0.01
            } else if (latency > .750) {
                latency = 0.750
            }
            this.queues[0].latency = latency
            this.queues[1].latency = latency
        }

        if (playerId === "player2") {
            let latency = this.queues[2].latency
            latency += (step * amount) / 1000
            if (latency < 0.01) {
                latency = 0.01
            } else if (latency > .750) {
                latency = 0.750
            }
            this.queues[2].latency = latency
            this.queues[3].latency = latency
        }

    }

    changeDelay(playerId, amount) {

        if (playerId === "player1") {
            let delay = this.map_player1.step_delay
            delay += amount
            if (delay < -60) {
                delay = -60
            }
            if (delay > 60) {
                delay = 60
            }
            this.map_player1.step_delay = delay
        }

        if (playerId === "player2") {
            let delay = this.map_player2.step_delay
            delay += amount
            if (delay < -60) {
                delay = -60
            }
            if (delay > 60) {
                delay = 60
            }
            this.map_player2.step_delay = delay
        }
    }
}

class CspController {
    constructor(map_player1, map_player2) {

        this.map_player1 = map_player1
        this.map_player2 = map_player2

        this.player1 = null
        this.player2 = null

    }

    getPlayer1() {
        if (this.player1 === null) {
            for (const obj of Object.values(this.map_player1.map.objects)) {
                if (!!obj.playerId && obj.playerId=="player1") {
                    this.player1 = obj
                    break
                }
            }
        }
        return this.player1
    }

    getPlayer2() {
        if (this.player2 === null) {
            for (const obj of Object.values(this.map_player2.map.objects)) {
                if (!!obj.playerId && obj.playerId=="player2") {
                    this.player2 = obj
                    break
                }
            }
        }
        return this.player2
    }

    setInputDirection(whlid, vector){
        if (whlid == 0) {
            const player = this.getPlayer1()
            if (!player) {
                return
            }
            this.map_player1.map.sendObjectInputEvent(player.entid, {whlid, vector})
        } else {
            const player = this.getPlayer2()
            if (!player) {
                return
            }
            this.map_player2.map.sendObjectInputEvent(player.entid, {whlid, vector})
        }
    }

    handleButtonPress(btnid){
    }

    handleButtonRelease(btnid){
    }
}

const DEMO_MODE_CLOCK     = (1<<0)
const DEMO_MODE_FIREWORKS = (1<<1)
const DEMO_MODE_MOVEMENT  = (1<<2)
const DEMO_MODE_PLATFORM  = (1<<3)
const DEMO_MODE_BULLET    = (1<<4)
const DEMO_MODE_ALL = DEMO_MODE_CLOCK|DEMO_MODE_FIREWORKS|DEMO_MODE_MOVEMENT

class AxeSimulatorScene extends GameScene {

    constructor(map_ctor) {

        super()

        this.map_player1 = new ClientCspMap(new map_ctor())
        this.map_player1.setPlayerId("player1")
        this.map_player2 = new ClientCspMap(new map_ctor())
        this.map_player2.setPlayerId("player2")
        this.map_server = new ServerCspMap(new map_ctor())

        this.map_player1.map.instanceId = "map-player1"
        this.map_player2.map.instanceId = "map-player2"
        this.map_server.map.instanceId = "map-server"
        this.maps = [this.map_player1, this.map_server, this.map_player2]

        this.client = new DemoClient(this.map_player1, this.map_player2, this.map_server)

        this.grp = new WidgetGroup()

        this.resize()
    }

    resize() {

        const width = Math.floor(gEngine.view.width/3) - 2
        this.views = [
            {name: "Player 1", x: 0,y: 0, width: width, height: gEngine.view.height},
            {name: "Server",x: Math.floor(gEngine.view.width/2 - width/2),y: 0, width: width, height: gEngine.view.height},
            {name: "Player 2",x: gEngine.view.width - width,y: 0, width: width, height: gEngine.view.height},
        ]
    }

    update(dt) {
        this.client.update(dt)

        this.map_player1.update(dt)
        this.map_player2.update(dt)
        this.map_server.update(dt)

        this.grp.update(dt)
    }


    initWidgets(enable_delta) {

        //

        const view1 = this.views[0]
        const view2 = this.views[2]
        const btn_height = 24
        const btn_width = 32

        // player 1

        this.btn_p1_latency_dn = new ArrowButtonWidget(Direction.LEFT)
        this.btn_p1_latency_dn.rect = new Rect(
            view1.x,
            view1.y+32,
            btn_width,
            btn_height)
        this.btn_p1_latency_dn.clicked = () => {this.client.changeLatency("player1", -1)}
        this.grp.addWidget(this.btn_p1_latency_dn)


        this.btn_p1_latency_up = new ArrowButtonWidget(Direction.RIGHT)
        this.btn_p1_latency_up.rect = new Rect(
            view1.x + view1.width - btn_width,
            view1.y+32,
            btn_width,
            btn_height)
        this.btn_p1_latency_up.clicked = () => {this.client.changeLatency("player1", 1)}
        this.grp.addWidget(this.btn_p1_latency_up)

        if (enable_delta) {
            this.btn_p1_delay_dn = new ArrowButtonWidget(Direction.LEFT)
            this.btn_p1_delay_dn.rect = new Rect(
                view1.x,
                view1.y+64,
                btn_width,
                btn_height)
            this.btn_p1_delay_dn.clicked = () => {this.client.changeDelay("player1", -1)}
            this.grp.addWidget(this.btn_p1_delay_dn)

            this.btn_p1_delay_up = new ArrowButtonWidget(Direction.RIGHT)
            this.btn_p1_delay_up.rect = new Rect(
                view1.x + view1.width - btn_width,
                view1.y+64,
                btn_width,
                btn_height)
            this.btn_p1_delay_up.clicked = () => {this.client.changeDelay("player1", 1)}
            this.grp.addWidget(this.btn_p1_delay_up)
        }

        // player 2
        this.btn_p2_latency_dn = new ArrowButtonWidget(Direction.LEFT)
        this.btn_p2_latency_dn.rect = new Rect(
            view2.x,
            view2.y+32,
            btn_width,
            btn_height)
        this.btn_p2_latency_dn.clicked = () => {this.client.changeLatency("player2", -1)}
        this.grp.addWidget(this.btn_p2_latency_dn)

        this.btn_p2_latency_up = new ArrowButtonWidget(Direction.RIGHT)
        this.btn_p2_latency_up.rect = new Rect(
            view2.x + view2.width - btn_width,
            view2.y+32,
            btn_width,
            btn_height)
        this.btn_p2_latency_up.clicked = () => {this.client.changeLatency("player2", 1)}
        this.grp.addWidget(this.btn_p2_latency_up)

        if (enable_delta) {
            this.btn_p2_delay_dn = new ArrowButtonWidget(Direction.LEFT)
            this.btn_p2_delay_dn.rect = new Rect(
                view2.x,
                view2.y+64,
                btn_width,
                btn_height)
            this.btn_p2_delay_dn.clicked = () => {this.client.changeDelay("player2", -1)}
            this.grp.addWidget(this.btn_p2_delay_dn)

            this.btn_p2_delay_up = new ArrowButtonWidget(Direction.RIGHT)
            this.btn_p2_delay_up.rect = new Rect(
                view2.x + view2.width - btn_width,
                view2.y+64,
                btn_width,
                btn_height)
            this.btn_p2_delay_up.clicked = () => {this.client.changeDelay("player2", 1)}
            this.grp.addWidget(this.btn_p2_delay_up)
        }
    }

    paint(ctx) {

        ctx.save();
        for (let i=0; i < 3; i++) {
            const view = this.views[i]
            const map = this.maps[i]
            //ctx.resetTransform()
            ctx.beginPath()
            ctx.strokeStyle = "blue";
            ctx.rect(view.x, view.y, view.width, view.height)
            ctx.stroke()

            ctx.save();
            ctx.translate(view.x, view.y)
            ctx.beginPath()
            ctx.rect(-2, -2, view.width+4, view.height+4);
            ctx.clip();

            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;

            map.paint(ctx)

            ctx.font = "8px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "right"
            ctx.textBaseline = "top"
            const delta1 = map.map.local_step - this.map_server.map.local_step
            ctx.fillText(`DELAY: ${delta1}`, 211, 0);

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "center"
            ctx.textBaseline = "top"

            if (i==1) {
                ctx.fillText(view.name, 211/2, 2);
            } else {
                ctx.fillText(view.name, 211/2, 2);
            }


            if (i==0) {
                ctx.font = "12px mono";
                ctx.textBaseline = "middle"

                let latency = (this.client.queues[0].latency*1000).toFixed(0)
                ctx.fillText(`Latency: ${latency} ms`, 211/2, 2+32+12);

                if (this.demo_mode&DEMO_MODE_CLOCK) {
                    let delay = this.map_player1.step_delay
                    ctx.fillText(`Step Delay: ${delay} `, 211/2, 2+64+12);
                }
            }

            if (i==2) {
                ctx.font = "12px mono";
                ctx.textBaseline = "middle"

                let latency = (this.client.queues[2].latency*1000).toFixed(0)
                ctx.fillText(`Latency: ${latency} ms`, 211/2, 2+32+12);

                if (this.demo_mode&DEMO_MODE_CLOCK) {
                    let delay = this.map_player2.step_delay
                    ctx.fillText(`Step Delay: ${delay} `, 211/2, 2+64+12);
                }
            }

            if (this.demo_mode&DEMO_MODE_CLOCK) {
                ctx.textBaseline = "top"
                ctx.font = "24px mono";
                ctx.fillText(`${fmtTime(map.map.local_step/60)} `, 211/2, 180);
            }

            ctx.restore()

            ctx.font = "12px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "top"
            ctx.fillText(`Bending ${map.map.enable_bending?"enabled":"disabled"} (${map.map._debug_reconcile_count})`, view.x+4, view.height);


        }
        ctx.restore();

        this.grp.paint(ctx)
        this.touch.paint(ctx)

        if (this.client) {

            ctx.font = "8px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "top"

            ctx.fillText(`FPS: ${gEngine.fps}`, 0, 0);
        }
    }

}

class DemoScene extends AxeSimulatorScene {


    constructor() {

        const query = daedalus.util.parseParameters()
        let demo_mode;
        switch (query?.mode?.[0]) {
            case "clock":
                demo_mode = DEMO_MODE_CLOCK;
                break
            case "fireworks":
                demo_mode = DEMO_MODE_FIREWORKS;
                break
            case "movement":
                demo_mode = DEMO_MODE_MOVEMENT;
                break
            case "all":
                demo_mode = DEMO_MODE_FIREWORKS|DEMO_MODE_MOVEMENT;
                break
            case "platform":
                demo_mode = DEMO_MODE_PLATFORM;
                break
            case "bullet":
                demo_mode = DEMO_MODE_BULLET;
                break
            default:
                //demo_mode = DEMO_MODE_FIREWORKS|DEMO_MODE_MOVEMENT
                demo_mode = DEMO_MODE_PLATFORM
                break
        }

        let map_ctor = (demo_mode&DEMO_MODE_PLATFORM)?PlatformMap:FireworksMap
        super(map_ctor)
        this.demo_mode = demo_mode

        this.initWidgets(this.demo_mode&DEMO_MODE_CLOCK)

        this.controller = new CspController(this.map_player1, this.map_player2);

        this.touch = new TouchInput(this.controller)

        Physics2dPlatform.maprect = new Rect(0, 0, 211, Math.floor(360*2/3 - 16))

        if (this.demo_mode&DEMO_MODE_PLATFORM || this.demo_mode&DEMO_MODE_MOVEMENT) {

            this.touch.addWheel(64, -64, 32, {align: Alignment.LEFT|Alignment.BOTTOM})
            this.touch.addWheel(64, -64, 32, {align: Alignment.RIGHT|Alignment.BOTTOM})

            const x1 = Physics2dPlatform.maprect.left() + 8
            const x2 = Physics2dPlatform.maprect.right() - 40
            this.map_player1.map.sendCreateObjectEvent("Player", {x: 9, y:128, playerId: "player1"})
            this.map_player2.map.sendCreateObjectEvent("Player", {x: 170, y:128, playerId: "player2"})
        }

        if (this.demo_mode&DEMO_MODE_PLATFORM) {
            const y = Physics2dPlatform.maprect.bottom() - 64
            const x = Physics2dPlatform.maprect.cx() - 24
            this.map_server.map.sendCreateObjectEvent("Wall", {x:x, y:y, w:48, h:12})
        }

    }


    pause(paused) {

    }

    update(dt) {

        super.update(dt)

    }



    handleTouches(touches) {

        touches = this.grp.handleTouches(touches)
        touches = this.touch.handleTouches(touches)

        if (this.demo_mode&DEMO_MODE_FIREWORKS) {
            if (touches.length > 0) {
                let touch = {...touches[0]}
                if (touch.pressed) {

                    if (touch.x < (this.views[0].x+this.views[0].width)) {
                        touch.x -= this.views[0].x
                        console.log("player1 create firework")
                        this.map_player1.map.sendCreateObjectEvent("Firework", touch)
                    }

                    else if (touch.x > (this.views[2].x)) {
                        touch.x -= this.views[2].x
                        console.log("player2 create firework")
                        this.map_player2.map.sendCreateObjectEvent("Firework", touch)

                    }
                }
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
