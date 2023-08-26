
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient, WidgetGroup, ButtonWidget
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
            {queue:this.queue_p2_in,  latency: .75, callback: (msg) => this.server_receive("player2", msg)},
            {queue:this.queue_p2_out, latency: .75, callback: this.p2_receive},
        ]

    }

    connect() {

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

    send1(msg) {
        this.queue1.push(msg)
    }

    send2(msg) {
        this.queue2.push(msg)
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
}

class DemoScene {


    constructor() {


        this.map_player1 = new ClientCspMap(new FireworksMap())
        this.map_player1.setPlayerId("player1")

        this.map_player2 = new ClientCspMap(new FireworksMap())
        this.map_player2.setPlayerId("player2")

        this.map_server = new ServerCspMap(new FireworksMap())

        this.client = new DemoClient(this.map_player1, this.map_player2, this.map_server)

        this.maps = [this.map_player1, this.map_server, this.map_player2]
        this.resize()


    }

    pause(paused) {

    }

    update(dt) {



        this.client.update(dt)

        this.map_player1.update(dt)
        this.map_player2.update(dt)
        this.map_server.update(dt)

    }

    paint(ctx) {


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

            ctx.fillText(view.name, 211/2, 2);
            const delta1 = map.map.local_step - this.map_server.map.local_step
            if (view.name!="Server") {
                const delta2 = map.map.local_step - map.world_step
                ctx.fillText(`step:${map.map.local_step%1000} (${delta2}) (${delta1}) `, 211/2, 2+16);
            } else {
                ctx.fillText(`step:${map.map.local_step%1000} (${delta1})`, 211/2, 2+16);
            }

            ctx.restore()
        }

        if (this.client) {

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "left"
            ctx.textBaseline = "bottom"

            ctx.fillText(`FPS: ${gEngine.fps}`, 2, gEngine.view.height - 2);
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

        if (touches.length > 0) {
            let touch = touches[0]
            if (touch.pressed) {

                if (touch.x < (this.views[0].x+this.views[0].width)) {
                    touch.x -= this.views[0].x
                    this.map_player1.map.sendCreateObjectEvent("Firework", touch)
                }

                else if (touch.x > (this.views[2].x)) {
                    touch.x -= this.views[2].x
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
