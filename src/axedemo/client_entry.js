
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})
$import("axedemo_common", {ClockMap, MovementMap, FireworksMap, PlatformMap})
$import("axertc_physics", {Physics2dPlatform, Physics2dPlatformV2})

function debug(msg) {

    console.log(`*${pad(performance.now()/1000, 12, ' ')}: ${msg}`)
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function random( min, max ) {
    return Math.random() * ( max - min ) + min;
}

function random_squared( min, max ) {
    return Math.pow(Math.random(),2) * ( max - min ) + min;
}

function gamma(z) {
    const g = 7;
    const C = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7
    ];


    if (z < 0.5) {
        return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    }
    else {
        z -= 1;

        let x = C[0];
        for (let i = 1; i < g + 2; i++) {
            x += C[i] / (z + i);
        }

        let t = z + g + 0.5;
        return Math.sqrt(2 * Math.PI) * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x;
    }
}

function poisson_pdf(x, k, theta) {
    let n = 1
    let d = gamma(k) * Math.pow(theta, k)
    let c1 = Math.pow(x, k-1)
    let c2 = Math.exp(-x/theta)
    return (n/d) * c1 * c2
}

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

        this.queues[0].history = [...Array(6)].map(x => ({count: 0, size: 0}));
        this.queues[1].history = [...Array(6)].map(x => ({count: 0, size: 0}));
        this.queues[2].history = [...Array(6)].map(x => ({count: 0, size: 0}));
        this.queues[3].history = [...Array(6)].map(x => ({count: 0, size: 0}));

        this.history_timer = 0.0
        this.history_duration = 0.2
        this.history_size = 5
        this.history_index = 0
    }

    connect() {
    }

    update(dt) {

        const jitter = 100 // messages can be up to 100ms late
        const getLatency = (idx) => this.queues[idx].latency + random_squared(0, jitter)/1000

        while (this.map_player1.map.outgoing_messages.length > 0) {
            const msg = this.map_player1.map.outgoing_messages.shift()
            this.queue_p1_in.push({delay: getLatency(0), message: msg.message})
        }

        while (this.map_player2.map.outgoing_messages.length > 0) {
            const msg = this.map_player2.map.outgoing_messages.shift()
            this.queue_p2_in.push({delay: getLatency(2), message: msg.message})
        }

        while (this.map_server.map.outgoing_messages.length > 0) {
            const msg = this.map_server.map.outgoing_messages.shift()

            if ((msg.kind == 2 && msg.playerId!="player1") || msg.kind!=2) {
                this.queue_p1_out.push({delay: getLatency(1), message: msg.message})
            }
            if ((msg.kind == 2 && msg.playerId!="player2") || msg.kind!=2) {
                this.queue_p2_out.push({delay: getLatency(3), message: msg.message})
            }
        }

        this.history_timer += dt
        if (this.history_timer > this.history_duration) {
            this.history_timer -= this.history_duration
            this.history_index += 1

            if (this.history_index > this.history_size) {
                this.history_index = 0
            }

            this.queues[0].history[this.history_index] = {count: 0, size: 0}
            this.queues[1].history[this.history_index] = {count: 0, size: 0}
            this.queues[2].history[this.history_index] = {count: 0, size: 0}
            this.queues[3].history[this.history_index] = {count: 0, size: 0}
        }

        for (let i=0; i < this.queues.length; i++) {
            const queue = this.queues[i]

            for (const item of queue.queue) {
                item.delay -= dt
            }

            while (queue.queue.length > 0) {
                if (queue.queue[0].delay < 0) {
                    const msg = queue.queue.shift()
                    queue.history[this.history_index].size += JSON.stringify(msg.message).length
                    queue.history[this.history_index].count += 1
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

            return latency
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

            return latency
        }

        return 0
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

    tapDirection(whlid, direction, count) {

    }

    setInputDirection(whlid, vector){
        if (whlid == 0) {
            const player = this.getPlayer1()
            if (!player) {
                console.warn("player 1 not found")
                return
            }
            player.ownedByClient = true
            //debug(`world_step: ${this.map_player1.world_step} local_step: ${this.map_player1.map.local_step}` + \
            //    " client input event");
            this.map_player1.map.sendObjectInputEvent(player.entid, {whlid, vector})
        } else {
            const player = this.getPlayer2()
            if (!player) {
                console.warn("player 2 not found")
                return
            }
            player.ownedByClient = true
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
const DEMO_MODE_PLATFORM2 = (1<<5)|DEMO_MODE_PLATFORM
const DEMO_MODE_ALL = DEMO_MODE_CLOCK|DEMO_MODE_FIREWORKS|DEMO_MODE_MOVEMENT

class AxeSimulatorScene extends GameScene {

    constructor(map_ctor) {

        super()

        this.map_ctor = map_ctor

        this.map_player1 = new ClientCspMap(new map_ctor())
        this.map_player1.setPlayerId("player1")
        this.map_player2 = new ClientCspMap(new map_ctor())
        this.map_player2.setPlayerId("player2")
        this.map_server = new ServerCspMap(new map_ctor())

        this.map_player1.map.instanceId = "player1"
        this.map_player2.map.instanceId = "player2"
        this.map_server.map.instanceId = "map-server"
        this.maps = [this.map_player1, this.map_server, this.map_player2]

        this.client = new DemoClient(this.map_player1, this.map_player2, this.map_server)

        this.grp = new WidgetGroup()

        //this.enable_documentation = true

        this.resize()
    }

    resize() {

        const width = Math.floor(gEngine.view.width/3) - 2
        const height = 360 // gEngine.view.height
        this.views = [
            {name: "Player 1", x: 0,y: 0, width, height},
            {name: "Server",x: Math.floor(gEngine.view.width/2 - width/2),y: 0, width, height},
            {name: "Player 2",x: gEngine.view.width - width,y: 0, width, height},
        ]

        this.map_ctor
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
        const btn_width = 24

        // player 1

        this.btn_p1_latency_dn = new ArrowButtonWidget(Direction.LEFT)
        this.btn_p1_latency_dn.rect = new Rect(
            view1.x+8,
            view1.y+32,
            btn_width,
            btn_height)
        this.btn_p1_latency_dn.clicked = () => {
            const latency = this.client.changeLatency("player1", -1)
            this.map_player1.world_step -= Math.floor(latency*60) + 1
            if (this.map_player1.world_step < this.map_player1.map.local_step) {
                this.map_player1.world_step = this.map_player1.map.local_step
            }
        }
        this.grp.addWidget(this.btn_p1_latency_dn)


        this.btn_p1_latency_up = new ArrowButtonWidget(Direction.RIGHT)
        this.btn_p1_latency_up.rect = new Rect(
            view1.x + view1.width - btn_width - 8,
            view1.y+32,
            btn_width,
            btn_height)
        this.btn_p1_latency_up.clicked = () => {
            const latency = this.client.changeLatency("player1", 1)
            this.map_player1.world_step -= Math.floor(latency*60) + 1
            if (this.map_player1.world_step < this.map_player1.map.local_step) {
                this.map_player1.world_step = this.map_player1.map.local_step
            }
        }
        this.grp.addWidget(this.btn_p1_latency_up)

        if (enable_delta) {
            this.btn_p1_delay_dn = new ArrowButtonWidget(Direction.LEFT)
            this.btn_p1_delay_dn.rect = new Rect(
                view1.x+8,
                view1.y+64,
                btn_width,
                btn_height)
            this.btn_p1_delay_dn.clicked = () => {this.client.changeDelay("player1", -1)}
            this.grp.addWidget(this.btn_p1_delay_dn)

            this.btn_p1_delay_up = new ArrowButtonWidget(Direction.RIGHT)
            this.btn_p1_delay_up.rect = new Rect(
                view1.x + view1.width - btn_width - 8,
                view1.y+64,
                btn_width,
                btn_height)
            this.btn_p1_delay_up.clicked = () => {this.client.changeDelay("player1", 1)}
            this.grp.addWidget(this.btn_p1_delay_up)
        }

        // player 2
        this.btn_p2_latency_dn = new ArrowButtonWidget(Direction.LEFT)
        this.btn_p2_latency_dn.rect = new Rect(
            view2.x+8,
            view2.y+32,
            btn_width,
            btn_height)
        this.btn_p2_latency_dn.clicked = () => {
            const latency = this.client.changeLatency("player2", -1)
            this.map_player2.world_step -= Math.floor(latency*60) + 1
            if (this.map_player2.world_step < this.map_player2.map.local_step) {
                this.map_player2.world_step = this.map_player2.map.local_step
            }
        }
        this.grp.addWidget(this.btn_p2_latency_dn)

        this.btn_p2_latency_up = new ArrowButtonWidget(Direction.RIGHT)
        this.btn_p2_latency_up.rect = new Rect(
            view2.x + view2.width - btn_width - 8,
            view2.y+32,
            btn_width,
            btn_height)
        this.btn_p2_latency_up.clicked = () => {
            const latency = this.client.changeLatency("player2", 1)
            this.map_player2.world_step -= Math.floor(latency*60) + 1
            if (this.map_player2.world_step < this.map_player2.map.local_step) {
                this.map_player2.world_step = this.map_player2.map.local_step
            }
        }
        this.grp.addWidget(this.btn_p2_latency_up)

        if (enable_delta) {
            this.btn_p2_delay_dn = new ArrowButtonWidget(Direction.LEFT)
            this.btn_p2_delay_dn.rect = new Rect(
                view2.x + 8,
                view2.y+64,
                btn_width,
                btn_height)
            this.btn_p2_delay_dn.clicked = () => {this.client.changeDelay("player2", -1)}
            this.grp.addWidget(this.btn_p2_delay_dn)

            this.btn_p2_delay_up = new ArrowButtonWidget(Direction.RIGHT)
            this.btn_p2_delay_up.rect = new Rect(
                view2.x + view2.width - btn_width - 8,
                view2.y+64,
                btn_width,
                btn_height)
            this.btn_p2_delay_up.clicked = () => {this.client.changeDelay("player2", 1)}
            this.grp.addWidget(this.btn_p2_delay_up)
        }
    }

    arrowTo(ctx, fromx, fromy, tox, toy, r=5, dashed=false) {


        let angle;
        let x;
        let y;

        ctx.beginPath()
        if (dashed) {
            ctx.setLineDash([5, 15]);
        }
        ctx.moveTo(fromx,fromy)
        ctx.lineTo(tox,toy)
        ctx.closePath();
        ctx.stroke()


        // shirnk the line by the radius so that the arrow touches
        // the thing it is pointing at
        angle = Math.atan2(toy-fromy,tox-fromx)
        let distance = Math.sqrt(Math.pow(toy-fromy, 2) + Math.pow(tox-fromx, 2)) - r
        tox = fromx + distance * Math.cos(angle)
        toy = fromy + distance * Math.sin(angle)
        //if (fromx < tox) {
        //    tox -= r
        //} else {
        //    tox += r
        //}
//
        //if (fromy < toy) {
        //    toy -= r
        //} else {
        //    toy += r
        //}
//
        let x_center = tox;
        let y_center = toy;

        ctx.beginPath();

        angle = Math.atan2(toy-fromy,tox-fromx)
        x = r*Math.cos(angle) + x_center;
        y = r*Math.sin(angle) + y_center;

        ctx.moveTo(x, y);

        angle += (1/3)*(2*Math.PI)
        x = r*Math.cos(angle) + x_center;
        y = r*Math.sin(angle) + y_center;

        ctx.lineTo(x, y);

        angle += (1/3)*(2*Math.PI)
        x = r*Math.cos(angle) + x_center;
        y = r*Math.sin(angle) + y_center;

        ctx.lineTo(x, y);

        ctx.closePath();

        ctx.fill();
    }

    paint_graph(ctx) {
        let width = 512
        let step_size = 24
        let header = 48
        let footer = 64
        let height = 10*step_size+header+footer

        ctx.save()

        //ctx.translate(-width,0)
        ctx.beginPath()
        ctx.strokeStyle = "blue";
        ctx.fillStyle = "#c3c3c3";
        ctx.rect(0,0, width, height)
        ctx.fill()
        ctx.stroke()

        ctx.strokeStyle="black"
        ctx.fillStyle="black"
        let lineTo = (x1,y1,x2,y2, n) => {

            ctx.font = "12px bold";
            ctx.fillStyle = "black"
            ctx.textAlign = "right"
            ctx.textBaseline = "middle"

            ctx.beginPath()
            ctx.moveTo(x1,y1)
            ctx.lineTo(x2,y2)
            ctx.stroke()
            const radius = 3
            for (let y=y1+step_size; y<y2; n+=1, y+=step_size) {
                ctx.beginPath()
                ctx.arc(x1, y, radius, 0, 2 * Math.PI);

                if (n >= 0) {
                    ctx.fillText(n, x1 - radius*2, y)
                }

                ctx.fill()
            }
        }

        let x0 = 1*width/8
        let x1 = 2*width/8
        let x2 = 4*width/8
        let x3 = 6*width/8
        let x4 = 7*width/8
        let step_delay = 3
        lineTo(x0, header, x0, height, -2 - step_delay)
        lineTo(x1, header, x1, height, -2)
        lineTo(x2, header, x2, height, 0)
        lineTo(x3, header, x3, height, -3)
        lineTo(x4, header, x4, height, -3 - step_delay)

        this.arrowTo(ctx, x2, header + 1 * step_size,x1,header + 3 * step_size, 7)
        this.arrowTo(ctx, x2, header + 1 * step_size,x3,header + 4 * step_size, 7)


        this.arrowTo(ctx, x1, header + 7 * step_size,x2,header + 9 * step_size, 7)
        this.arrowTo(ctx, x2, header + 9 * step_size,x1,header + 11 * step_size, 7)
        this.arrowTo(ctx, x2, header + 9 * step_size,x3,header + 12 * step_size, 7)

        this.arrowTo(ctx, x2, header + 7 * step_size,x3,header + 9 * step_size, 7, true)
        this.arrowTo(ctx, x2, header + 9 * step_size,x3,header + 8 * step_size, 7, true)



        ctx.font = "12px bold";
        ctx.fillStyle = "black"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("Player 1", (x0+x1)/2, 16)
        ctx.fillText("Server", x2, 16)
        ctx.fillText("Player 2", (x3+x4)/2, 16)

        ctx.font = "10px bold";
        ctx.fillText("Local Step", x0, 32)
        ctx.fillText("World Step", x1, 32)
        ctx.fillText("World Step", x2, 32)
        ctx.fillText("World Step", x3, 32)
        ctx.fillText("Local Step", x4, 32)

        ctx.restore()
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
            const delta1 = map.world_step - this.map_server.map.local_step
            ctx.fillText(`DELAY: ${delta1} `, view.width, 0);

            if (i==0 || i==2) {

                let q1,q2;
                if (i==0) {
                    q1 = this.client.queues[0]
                    q2 = this.client.queues[1]
                }

                if (i==2) {
                    q1 = this.client.queues[2]
                    q2 = this.client.queues[3]
                }

                ctx.font = "8px mono";
                ctx.fillStyle = "yellow"
                ctx.textAlign = "right"
                ctx.textBaseline = "bottom"

                const count_in = q1.history.reduce((a, x) => a + x.count, 0);
                const size_in = q1.history.reduce((a, x) => a + x.size, 0);
                ctx.fillText(`SENT: N:${count_in} ${(count_in>0?size_in/count_in:0).toFixed(0)}B`, view.width, view.height - 16);

                const count_out = q2.history.reduce((a, x) => a + x.count, 0);
                const size_out = q2.history.reduce((a, x) => a + x.size, 0);
                ctx.fillText(`RECV: N:${count_out} ${(count_out>0?size_out/count_out:0).toFixed(0)}B`, view.width, view.height - 0);
            }

            ctx.font = "16px mono";
            ctx.fillStyle = "yellow"
            ctx.textAlign = "center"
            ctx.textBaseline = "top"

            if (i==1) {
                ctx.fillText(view.name, view.width/2, 2);
            } else {
                ctx.fillText(view.name, view.width/2, 2);
            }


            if (i==0) {
                ctx.font = "12px mono";
                ctx.textBaseline = "middle"

                let latency = (this.client.queues[0].latency*1000).toFixed(0)
                ctx.fillText(`Latency: ${latency} ms`, view.width/2, 2+32+12);

                if (this.demo_mode&DEMO_MODE_CLOCK) {
                    let delay = this.map_player1.step_delay
                    ctx.fillText(`Step Delay: ${delay} `, view.width/2, 2+64+12);
                }
            }

            if (i==2) {
                ctx.font = "12px mono";
                ctx.textBaseline = "middle"

                let latency = (this.client.queues[2].latency*1000).toFixed(0)
                ctx.fillText(`Latency: ${latency} ms`, view.width/2, 2+32+12);

                if (this.demo_mode&DEMO_MODE_CLOCK) {
                    let delay = this.map_player2.step_delay
                    ctx.fillText(`Step Delay: ${delay} `, view.width/2, 2+64+12);
                }
            }

            if (this.demo_mode&DEMO_MODE_CLOCK) {
                ctx.textBaseline = "top"
                ctx.font = "24px mono";
                ctx.textAlign = "center"
                ctx.fillText(`${fmtTime(map.map.local_step/60)}`, view.width/2, 180);
                

                if (i==0||i==2) {
                    const delta = map.map.local_step - this.maps[1].map.local_step
                    ctx.fillText(`${(delta/60).toFixed(3)}`, view.width/2, 180+32);
                }
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

        if (this.enable_documentation) {
            this.paint_graph(ctx);
        }
    }

}

class DemoScene extends AxeSimulatorScene {


    constructor(demo_mode) {

        let map_ctor;

        if (demo_mode==DEMO_MODE_CLOCK) {
            map_ctor = ClockMap
        } else if (demo_mode==DEMO_MODE_MOVEMENT) {
            map_ctor = MovementMap
        } else {
            map_ctor = (demo_mode&DEMO_MODE_PLATFORM)?PlatformMap:FireworksMap
        }

        super(map_ctor)
        this.demo_mode = demo_mode

        this.initWidgets(this.demo_mode&DEMO_MODE_CLOCK)

        this.controller = new CspController(this.map_player1, this.map_player2);

        this.touch = new TouchInput(this.controller)
        this.keyboard = new KeyboardInput(this.controller)

        const map_width = Math.floor(gEngine.view.width/3) - 2 // see resize()
        const map_height = 360 // see resize()
        //set the map size for physics
        // TODO: copy to resize()
        Physics2dPlatform.maprect = new Rect(0, 0, map_width, Math.floor(map_height*2/3 - 16))
        Physics2dPlatformV2.maprect = new Rect(0, 0, map_width, Math.floor(map_height*2/3 - 16))

        map_ctor.maprect = new Rect(0, 0, map_width, map_height)

        this.event_player1_clicked = !(this.demo_mode&DEMO_MODE_FIREWORKS)
        this.event_player2_clicked = !(this.demo_mode&DEMO_MODE_FIREWORKS)

        if (this.demo_mode&DEMO_MODE_PLATFORM || this.demo_mode&DEMO_MODE_MOVEMENT) {

            this.touch.addWheel(64, -64, 48, {
                align: Alignment.LEFT|Alignment.BOTTOM,
                symbols: ["W", "D", "S", "A"],
            })
            this.touch.addWheel(64, -64, 48, {align: Alignment.RIGHT|Alignment.BOTTOM})

            this.keyboard.addWheel_WASD()
            this.keyboard.addWheel_ArrowKeys()

            const x1 = Physics2dPlatform.maprect.left() + 8
            const x2 = Physics2dPlatform.maprect.right() - 40

            if ((this.demo_mode&DEMO_MODE_PLATFORM2)==DEMO_MODE_PLATFORM2) {
                this.map_player1.map.sendObjectCreateEvent("PlayerV2",
                    {
                        x: Physics2dPlatform.maprect.w/4,
                        y: Physics2dPlatform.maprect.h/2,
                        playerId: "player1"
                    })
            } else {
                console.log("create movement players")
                this.map_player1.map.sendObjectCreateEvent("Player", {x: 9, y:128, playerId: "player1"})
                this.map_player2.map.sendObjectCreateEvent("Player", {x: 170, y:128, playerId: "player2"})
            }

            //TODO: set player ownership
            // this.map_player1.map.setOwned("player1")
            // this.map_player2.map.setOwned("player2")
        }

        if ((this.demo_mode&DEMO_MODE_PLATFORM2)==DEMO_MODE_PLATFORM2) {
            const x = Physics2dPlatform.maprect.x
            const yb = Physics2dPlatform.maprect.bottom()
            const w = Physics2dPlatform.maprect.w
            const h = Physics2dPlatform.maprect.h
            const d = 8

            this.map_server.map.sendObjectCreateEvent("Wall", {x:x, y:yb-d, w:w, h:d})
            this.map_server.map.sendObjectCreateEvent("Wall", {x:x, y:0, w:d, h:h})
            this.map_server.map.sendObjectCreateEvent("Wall", {x:w-d, y:0, w:d, h:h})
            this.map_server.map.sendObjectCreateEvent("Wall", {x:x, y:64, w:w, h:d})
            this.map_server.map.sendObjectCreateEvent("Wall", {x:w/2-16, y:64+(h-64)/2-16, w:32, h:32})

            this.map_server.map.sendObjectCreateEvent("Wall", {x:w/2-16, y:yb-d-6, w:32, h:6})
        } else if (this.demo_mode&DEMO_MODE_PLATFORM) {
            const y = Physics2dPlatform.maprect.bottom() - 64
            const x = Physics2dPlatform.maprect.cx() - 24
            this.map_server.map.sendObjectCreateEvent("Wall", {x:x, y:y, w:48, h:12})

            const y2 = Physics2dPlatform.maprect.bottom() - 16
            const x2 = Physics2dPlatform.maprect.right() - 16
            this.map_server.map.sendObjectCreateEvent("Slope", {
                x:x2, y:y2, w:16, h:16, direction:Direction.UPLEFT})
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
                        //debug(`world_step: ${this.map_player1.world_step} local_step: ${this.map_player1.map.local_step}` + " client create event");
                        this.map_player1.map.sendObjectCreateEvent("Firework", touch)
                        this.event_player1_clicked = true
                    }

                    else if (touch.x > (this.views[2].x)) {
                        touch.x -= this.views[2].x
                        this.map_player2.map.sendObjectCreateEvent("Firework", touch)
                        this.event_player2_clicked = true

                    }
                }
            }
        }
    }

    handleKeyPress(keyevent) {
        this.keyboard.handleKeyPress(keyevent)
    }

    handleKeyRelease(keyevent) {

        this.keyboard.handleKeyRelease(keyevent)

        const url = `${location.origin}${location.pathname}`

        if (keyevent.text=="1") {
            window.location.href = url + "?mode=clock";
        }

        if (keyevent.text=="2") {
            window.location.href = url + "?mode=fireworks";
        }

        if (keyevent.text=="3") {
            window.location.href = url + "?mode=movement";
        }

        if (keyevent.text=="4") {
            window.location.href = url + "?mode=platform";
        }

        if (keyevent.text=="5") {
            window.location.href = url + "?mode=platform2";
        }

        if (false && keyevent.text=="1") {
            this.enable_documentation = !this.enable_documentation
        }

        if (false && keyevent.text=="2" && this.enable_documentation) {
            const width = 512
            const height = 352
            const hidden_canvas = document.createElement('canvas');
            hidden_canvas.width = width;
            hidden_canvas.height = height;

            const hidden_ctx = hidden_canvas.getContext('2d');

            hidden_ctx.drawImage(
                gEngine.getDomNode(),
                gEngine.view.x,
                gEngine.view.y,
                width,
                height,
                0,
                0,
                width,
                height
            );

            const hidden_data = hidden_canvas.toDataURL("image/png")

            const link = document.createElement("a");
            link.href = hidden_data;
            link.download = "documentation.png";
            link.target="_blank"
            link.click();

        }

    }

    paint(ctx) {

        super.paint(ctx);

        if (!this.event_player1_clicked) {
            const view = this.views[0]
            ctx.font = "12px bold";
            ctx.fillStyle = "white"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText("Touch Here!", view.x+view.width/2, view.y+view.height/2)
        }

        if (!this.event_player2_clicked) {
            const view = this.views[2]
            ctx.font = "12px bold";
            ctx.fillStyle = "white"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText("Touch Here!", view.x+view.width/2, view.y+view.height/2)

        }
    }
}

export default class Application extends ApplicationBase {
    constructor() {

        const query = daedalus.util.parseParameters()
        let demo_mode;
        let mode_name=query?.mode?.[0]
        switch (mode_name) {
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
            case "platform2":
                demo_mode = DEMO_MODE_PLATFORM2;
                break
            case "bullet":
                demo_mode = DEMO_MODE_BULLET;
                break
            default:
                //demo_mode = DEMO_MODE_FIREWORKS|DEMO_MODE_MOVEMENT
                demo_mode = DEMO_MODE_PLATFORM
                break
        }
        console.log(`mode_name=${mode_name} demo_mode=${demo_mode}`)

        super({
            portrait: 0,
            fullscreen: 0
        }, () => {
            return new DemoScene(demo_mode)
        })
    }
}
