
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, Direction, Alignment, Rect, TouchInput
})
$import("axertc_common", {CspMap, ClientCspMap, ServerCspMap})
$import("fireworks_common", {FireworksMap})

class DemoClient {

    constructor(map_player1, map_player2, map_server) {
        this.map_player1 = map_player1
        this.map_player2 = map_player2
        this.map_server = map_server
        this.sync_timer = .1

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

        this.sync_timer -= dt
        if (this.sync_timer < 0) {
            this.sync_timer += 0.1

            this.map_server.map.sendBroadcast(null, {
                type: "map-sync",
                step: this.map_server.map.local_step,
                sync: 0
            })
        }

        while (this.map_player1.map.outgoing_messages.length > 0) {
            const msg = this.map_player1.map.outgoing_messages.shift()
            console.log("p1 out", msg)
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
        console.log("change latency", playerId, step*amount)

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
        console.log("change delay", playerId, amount)

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

class DemoScene {


    constructor() {


        this.map_player1 = new ClientCspMap(new FireworksMap())
        this.map_player1.setPlayerId("player1")

        this.map_player2 = new ClientCspMap(new FireworksMap())
        this.map_player2.setPlayerId("player2")
        // TODO: use latency estimation to adjust step delay?
        //this.map_player2.step_delay = 0

        this.map_server = new ServerCspMap(new FireworksMap())

        this.map_player1.map.instanceId = "map-player1"
        this.map_player2.map.instanceId = "map-player2"
        this.map_server.map.instanceId = "map-server"

        this.client = new DemoClient(this.map_player1, this.map_player2, this.map_server)

        this.maps = [this.map_player1, this.map_server, this.map_player2]
        this.resize()

        this.initWidgets()

        this.controller = new CspController(this.map_player1, this.map_player2);

        this.touch = new TouchInput(this.controller)
        this.touch.addWheel(72, -72, 32, {align: Alignment.LEFT|Alignment.BOTTOM})
        this.touch.addWheel(72, -72, 32, {align: Alignment.RIGHT|Alignment.BOTTOM})


        this.map_player1.map.sendCreateObjectEvent("Player", {x: 9, y:128, playerId: "player1"})
        this.map_player2.map.sendCreateObjectEvent("Player", {x: 170, y:128, playerId: "player2"})

    }

    initWidgets() {

        const view1 = this.views[0]
        const view2 = this.views[2]
        const btn_height = 24
        const btn_width = 32

        this.grp = new WidgetGroup()



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

    pause(paused) {

    }

    update(dt) {

        this.client.update(dt)

        this.map_player1.update(dt)
        this.map_player2.update(dt)
        this.map_server.update(dt)

        this.grp.update(dt)


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

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "center"
            ctx.textBaseline = "top"


            const delta1 = map.map.local_step - this.map_server.map.local_step
            if (i==0) {
                //const delta2 = map.map.local_step - map.world_step
                ctx.fillText(view.name + ` (${delta1})`, 211/2, 2);
                let latency = (this.client.queues[0].latency*1000).toFixed(0)
                let delay = this.map_player1.step_delay
                ctx.font = "12px mono";
                ctx.fillText(`Latency: ${latency} ms`, 211/2, 2+32);
                ctx.fillText(`Step Delay: ${delay} `, 211/2, 2+64);
            }
            if (i==1) {
                ctx.fillText(view.name, 211/2, 2);
            }
            if (i==2) {
                ctx.fillText(view.name + ` (${delta1})`, 211/2, 2);
                let latency = (this.client.queues[2].latency*1000).toFixed(0)
                let delay = this.map_player2.step_delay
                ctx.font = "12px mono";
                ctx.fillText(`Latency: ${latency} ms`, 211/2, 2+32);
                ctx.fillText(`Step Delay: ${delay} `, 211/2, 2+64);
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

    resize() {

        const width = Math.floor(gEngine.view.width/3) - 2
        this.views = [
            {name: "Player 1", x: 0,y: 0, width: width, height: gEngine.view.height},
            {name: "Server",x: Math.floor(gEngine.view.width/2 - width/2),y: 0, width: width, height: gEngine.view.height},
            {name: "Player 2",x: gEngine.view.width - width,y: 0, width: width, height: gEngine.view.height},
        ]

    }

    handleTouches(touches) {

        touches = this.grp.handleTouches(touches)
        touches = this.touch.handleTouches(touches)

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
