
import module daedalus

from module engine import {
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SpriteSheetBuilder, SpriteSheet,
    ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene
}

include './common.js'
include './resource.js'

const CELL_WALL       = 0x10
const CELL_BREAKABLE  = 0x11
const CELL_FLOOR      = 0x00
const CELL_START      = 0x20
const CELL_MONSTER    = 0x21
const CELL_BOSS       = 0x22
const CELL_BOSS_DOOR  = 0x50
const CELL_BOSS_LOCK  = 0x51
const CELL_BOSS_CHEST = 0x52
const CELL_DOOR       = 0x53
const CELL_LOCK       = 0x54
const CELL_CHEST      = 0x54

export class MazeGenerator {

    constructor(width, height) {

        this.width = width
        this.height = height
        this.ready = false

        this.show = daedalus.env.debug?false:true
        this.start_room = 0

        this.current_step = 0

        this._step_counter = 0

        this.alpha = 1.0
        this.stretch = false

        // controls the maze-iness
        // 0: rooms directly connect, no breakable walls
        // 1: every dead end is a breakable wall
        this.prob_breakable = 0.5

        this.rooms = []

        this.steps = [
            this.do_step_init.bind(this),

            // randomly place rooms into the maze
            this.do_step_add_room_init.bind(this),
            this.do_step_add_room.bind(this),

            // carve a perfect maze connecting all of the rooms
            this.do_step_carve_init.bind(this),
            this.do_step_carve.bind(this),

            // randomly replace dead ends with breakable walls
            this.do_step_uncarve_breakable_init.bind(this),
            this.do_step_uncarve_breakable.bind(this),

            // fill in all remaining dead ends
            this.do_step_uncarve_init.bind(this),
            this.do_step_uncarve.bind(this),

            // add monsters
            this.do_step_addnpcs_init.bind(this),
            this.do_step_addnpcs.bind(this),

            this.do_transition_init.bind(this),
            this.do_transition.bind(this),
        ]
    }

    update(dt) {

        if (this.show) {
            this.timer += dt
            if (this.timer < this.delay) {
                return
            }
            this.timer -= this.delay
        }

        if (this.current_step < this.steps.length) {
            let step = this.steps[this.current_step]
            this._step_counter += 1
            if (step()) {
                console.log("step", this.current_step, this._step_counter)
                this.current_step += 1
            }
        }

    }

    paint(ctx) {


        let cw = 8
        let ch = 8
        let mw = this.width * cw
        let mh = this.height * ch
        let mx = Math.floor(gEngine.view.width/2 - mw/2)
        let my = Math.floor(gEngine.view.height/2 - mh/2)

        if (!!this.stretch) {
            cw = Math.floor(gEngine.view.width/this.width)
            ch = Math.floor(gEngine.view.height/this.height)
            mw = this.width * cw
            mh = this.height * ch
            mx = Math.floor(gEngine.view.width/2 - mw/2)
            my = Math.floor(gEngine.view.height/2 - mh/2)
        }

        ctx.save()
        if (this.alpha < 1.0) {
            ctx.globalAlpha = this.alpha
        }

        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.rect(mx-2, my-2, mw+4, mh+4);
        ctx.stroke()

        if (this.current_step == 0) {
            return
        }

        // paint the maze


        for (let j=0;j<this.height;j++) {
            for (let i=0;i<this.width;i++) {
                if (this.cells[j][i]==CELL_WALL) {
                    ctx.beginPath();
                    ctx.fillStyle = '#338822';
                    ctx.rect(mx+cw*i, my+ch*j, cw, ch);
                    ctx.fill()
                }

                if (this.cells[j][i]==CELL_BREAKABLE) {
                    ctx.beginPath();
                    ctx.fillStyle = '#666666';
                    ctx.rect(mx+cw*i, my+ch*j, cw, ch);
                    ctx.fill()
                }

                if (this.cells[j][i]==CELL_MONSTER) {
                    ctx.beginPath();
                    ctx.fillStyle = '#DD4400';
                    ctx.rect(mx+cw*i, my+ch*j, cw, ch);
                    ctx.fill()
                }

                if (this.cells[j][i]==CELL_START) {
                    ctx.beginPath();
                    ctx.fillStyle = '#FFD700';
                    ctx.rect(mx+cw*i, my+ch*j, cw, ch);
                    ctx.fill()
                }

                if (this.cells[j][i]==CELL_BOSS) {
                    ctx.beginPath();
                    ctx.fillStyle = '#FF00FF';
                    ctx.rect(mx+cw*i, my+ch*j, cw, ch);
                    ctx.fill()
                }

                if (this.cells[j][i]==CELL_BOSS_DOOR ||
                    this.cells[j][i]==CELL_DOOR ||
                    this.cells[j][i]==CELL_BOSS_CHEST ||
                    this.cells[j][i]==CELL_CHEST
                   ) {
                    ctx.beginPath();
                    ctx.fillStyle = '#964B00';
                    ctx.rect(mx+cw*i, my+ch*j, cw, ch);
                    ctx.fill()
                }


            }
        }

        ctx.restore()

    }

    do_step_init() {

        this._step_counter = 0

        this.cells = []
        for (let j=0;j<this.height;j++) {
            this.cells.push(new Array(this.width).fill(CELL_WALL))
        }

        // visited: 0: unvisited, 1: visited, 2: a room cell
        this.visited = []
        for (let j=0;j<this.height;j++) {
            this.visited.push(new Array(this.width).fill(0))
        }

        for (let j=0;j<this.height;j++) {
            for (let i=0;i<this.width;i++) {
                if (i%2==1 && j%2==1) {
                    this.cells[j][i] = CELL_FLOOR;
                }
            }
        }

        this.max_iter_steps = this.show?Math.floor(this.width*this.height / 50):1000 // maximum steps per iteration
        this.timer = 0
        this.delay = 0.05

        return true;
    }

    do_step_add_room_init() {
        this.rooms = []
        this.room_fails = 0
        this.max_room_fails = 12

        return true
    }

    do_step_add_room() {

        // width of 11 is about the biggest that fits in the
        // allowed camera region
        // rooms must have odd length to fit on the grid
        let rw = randomRange(5, 12)|1 // Math.floor(this.width/4)
        let rh = randomRange(5, 12)|1 // Math.floor(this.width/4)

        if (this.rooms.length==0) {
            rw = 7
            rh = 7
        }

        if (this.rooms.length==1) {
            rw = 15
            rh = 9
        }

        if (this.rooms.length==2) {
            rw = 7
            rh = 7
        }

        let rt = randomRange(0, (this.height - rh) & (~1)) & (~1)
        let rl = randomRange(0, (this.width - rw) & (~1)) & (~1)

        // TODO: test two same sized rooms exactly next to each other

        // rw = Math.max(5, 11)|1 // Math.floor(this.width/4)
        // rh = Math.max(5, 11)|1 // Math.floor(this.width/4)
        // rt = Math.min(2, (this.height - rh) & (~1)) & (~1)
        // rl = Math.min(2, (this.width - rw) & (~1)) & (~1)

        let rr = rl + rw
        let rb = rt + rh

        //console.log((this.width - rw) & (~1))
        //console.log((this.height - rh) & (~1))
        //console.log("maze", 0, 0, this.width, this.height)
        //console.log("room", rl, rt, rw, rh)

        let room = new Rect(rl, rt, rw, rh)

        for (let i=0; i < this.rooms.length; i++) {
            if (this.rooms[i].collideRect(room)) {
                console.log(this.room_fails, "failed to add room (overlap)")
                this.room_fails += 1
                return this.rooms.length > 3 && this.room_fails > this.max_room_fails
            }
        }

        // determine where there can be doors for this room
        let candidates = {t:[], r:[], b:[], l:[]}

        for (let j=rt; j < rb; j++) {
            if (rl-1 > 0 this.cells[j][rl-1] == CELL_FLOOR) {
                candidates.l.push({x:rl,y:j})
            }

            if (rr < this.width && this.cells[j][rr] == CELL_FLOOR) {
                candidates.r.push({x:rr-1,y:j})
            }
        }

        for (let i=rl; i < rr; i++) {
            if (rt-1 > 0 && this.cells[rt-1][i] == CELL_FLOOR) {
                candidates.t.push({x:i,y:rt})
            }

            if (rb < this.height && this.cells[rb][i] == CELL_FLOOR) {
                candidates.b.push({x:i,y:rb-1})
            }
        }

        if (this.rooms.length==1) {
            candidates.t = []
            candidates.b = []
            candidates.r = []
        }

        let ndoors = 0;
        ndoors += candidates.t.length;
        ndoors += candidates.r.length;
        ndoors += candidates.b.length;
        ndoors += candidates.l.length;

        // room cannot be placed. there are no doors possible
        if (ndoors == 0) {
            console.log(this.room_fails, "failed to add room (no door)")
            this.room_fails += 1
            return this.rooms.length > 3 && this.room_fails > this.max_room_fails
        }

        for (let j=rt; j < rb; j++) {
            for (let i=rl; i < rr; i++) {
                this.cells[j][i] = CELL_FLOOR
            }
        }

        for (let j=rt; j < rb; j++) {
            for (let i=rl; i < rr; i++) {
                this.visited[j][i] = 2
            }
        }

        for (let j=rt; j < rb; j++) {
            this.cells[j][rl] = CELL_WALL
            this.cells[j][rr-1] = CELL_WALL
        }

        for (let i=rl; i < rr; i++) {
            this.cells[rt][i] = CELL_WALL
            this.cells[rb-1][i] = CELL_WALL
        }

        // FINALLY add doors
        let choices = []
        if (candidates.t.length > 0) {choices.push(randomChoice(candidates.t))}
        if (candidates.r.length > 0) {choices.push(randomChoice(candidates.r))}
        if (candidates.b.length > 0) {choices.push(randomChoice(candidates.b))}
        if (candidates.l.length > 0) {choices.push(randomChoice(candidates.l))}
        shuffle(choices)

        let numdoors = randomRange(1, choices.length)
        if (numdoors < 1) {
            console.error("random door error")
            numdoors = 1
        }

        for (let i=0; i < numdoors; i++) {
            let p = choices[i]
            this.cells[p.y][p.x] = CELL_FLOOR
        }


        if (this.rooms.length==this.start_room) {

            if (this.start_room == 0) {
                this.cells[rt + 3][rl + 3] = CELL_START
            }
            else if (this.start_room == 1) {
                let p = choices[0]
                this.cells[p.y][p.x-1] = CELL_START
            } else {
                this.cells[rt + 1][rl + 1] = CELL_START
            }
        }

        if (this.rooms.length==2) {
            this.cells[rt + 3][rl + 3] = CELL_BOSS_CHEST
        }

        if (this.rooms.length==1) {

            let p = choices[0]
            this.cells[p.y][p.x] = CELL_BOSS_DOOR
            this.cells[p.y][p.x+1] = CELL_BOSS_LOCK

            // build the boss chamber
            this.cells[rt+1][rr-2] = CELL_WALL
            this.cells[rt+2][rr-2] = CELL_WALL
            this.cells[rt+3][rr-2] = CELL_WALL
            this.cells[rt+1][rr-3] = CELL_WALL
            this.cells[rt+2][rr-3] = CELL_WALL
            this.cells[rt+3][rr-3] = CELL_WALL
            this.cells[rt+1][rr-4] = CELL_WALL
            this.cells[rt+2][rr-4] = CELL_WALL
            this.cells[rt+1][rr-5] = CELL_WALL

            this.cells[rb - 2][rr-2] = CELL_WALL
            this.cells[rb - 3][rr-2] = CELL_WALL
            this.cells[rb - 4][rr-2] = CELL_WALL
            this.cells[rb - 2][rr-3] = CELL_WALL
            this.cells[rb - 3][rr-3] = CELL_WALL
            this.cells[rb - 4][rr-3] = CELL_WALL
            this.cells[rb - 3][rr-4] = CELL_WALL
            this.cells[rb - 2][rr-4] = CELL_WALL
            this.cells[rb - 2][rr-5] = CELL_WALL

            this.cells[rb - 5][rr-6] = CELL_BOSS
        }


        this.rooms.push(room)

        this.room_fails = 0
        console.log(this.room_fails, "added room")

        return this.rooms.length >= 20
    }

    do_step_carve_init() {

        // pick a random odd cell
        let x = randomNumber(1, this.width-2)|1
        let y = randomNumber(1, this.height-2)|1

        for (let i=0; i < this.rooms.length; i++) {
            if (this.rooms[i].collidePoint(x, y)) {
                return false;
            }
        }

        this.visited[y][x] = 1
        this.C = [{x,y}]

        return true;
    }

    do_step_carve() {

        var t0 = performance.now()

        let z=0
        for (; z < this.max_iter_steps && this.C.length > 0; z++) {

            let i = randomNumber(0, this.C.length-1)
            let c = this.C[i]
            let n = this.neighbors2(c)
            shuffle(n);

            let carved = false
            for (let k=0;k<n.length;k++) {
                let a = n[k][0]
                let b = n[k][1]
                if (this.visited[a.y][a.x]===0) {
                    this.cells[b.y][b.x] = CELL_FLOOR
                    this.visited[a.y][a.x] = 1
                    this.C.push(a)
                    carved = true
                    break;
                }
            }

            if (carved === false) {
                this.C.splice(i, 1);
            }
        }
        var t1 = performance.now()
        //console.log("t", (t1 - t0)/ 1000.0, z)

        return this.C.length == 0;
    }

    _uncarve_count(p) {
        let n = this.neighbors1(p)
        let q = null
        let total=0; // count of solid neighbors
        for (let i=0; i<n.length; i++) {
            let p = n[i]
            //  || this.cells[p.y][p.x]==CELL_BREAKABLE
            if (this.cells[p.y][p.x]==CELL_WALL) {
                total += 1;
            } else if (this.cells[p.y][p.x]==CELL_FLOOR) {
                q = p
            }
        }

        if (total == 3) {
            return q
        }

        return null
    }

    do_step_uncarve_breakable_init() {
        this.ux=1
        this.uy=1

        this.max_iter_steps = this.show ? (this.width) : (this.width*this.height) // maximum steps per iteration
        console.log("max steps now", this.max_iter_steps)

        return true
    }

    do_step_uncarve_breakable() {

        let z=0
        for (; z < this.max_iter_steps && this.uy < this.height - 1; z++) {

            let n = this.neighbors1({x:this.ux, y:this.uy})

            let skip = (this.cells[this.uy][this.ux] != CELL_FLOOR) || (this.visited[this.uy][this.ux]===2)
            //for (let i=0; !skip && i < this.rooms.length; i++) {
            //    if (this.rooms[i].collidePoint(this.ux, this.uy)) {
            //        skip = 1
            //    }
            //}

            if (skip == 0) {

                let total=0; // count of solid neighbors
                for (let i=0; i<n.length; i++) {
                    let p = n[i]
                    if (this.cells[p.y][p.x]==CELL_WALL) {
                        total += 1;
                    }
                }

                // if a dead end was found
                if (total == 3) {

                    if (Math.random() < this.prob_breakable) {
                        shuffle(n);
                        // find first non-edge, non-room wall
                        for (let i=0; i<n.length; i++) {
                            let p = n[i]
                            if (p.x > 1 &&
                                p.y > 1 &&
                                p.x < this.width - 1 &&
                                p.y < this.height - 1 &&
                                this.visited[p.y][p.y]===2 &&
                                this.cells[p.y][p.x]==CELL_WALL) {
                                this.cells[p.y][p.x] = CELL_BREAKABLE
                                break;
                            }
                        }
                    }
                }

            }

            // unwrapped double for-loop
            // that ignores the walls around the edges of the maze
            this.ux += 1
            if (this.ux >= this.width - 1) {
                this.ux = 1
                this.uy += 1
            }

        }

        return this.uy >= this.height - 1
    }

    do_step_uncarve_init() {
        this.ux=1
        this.uy=1

        this.max_iter_steps = this.show ? (this.width) : (this.width*this.height) // maximum steps per iteration
        console.log("max steps now", this.max_iter_steps)

        return true
    }

    do_step_uncarve() {

        let z=0
        for (; z < this.max_iter_steps && this.uy < this.height - 1; z++) {

            let n = this.neighbors1({x:this.ux, y:this.uy})

            // todo: skip non-floors
            let skip = (this.cells[this.uy][this.ux] != CELL_FLOOR) || (this.visited[this.uy][this.ux]===2)
            //for (let i=0; !skip && i < this.rooms.length; i++) {
            //    if (this.rooms[i].collidePoint(this.ux, this.uy)) {
            //        skip = 1
            //    }
            //}

            if (skip == 0) {
                let p = {x:this.ux, y:this.uy}
                while (p !== null) {
                    let q = this._uncarve_count(p)
                    if (q !== null) {
                        this.cells[p.y][p.x] = CELL_WALL
                    }
                    p = q
                }
            }

            // unwrapped double for-loop
            // that ignores the walls around the edges of the maze
            this.ux += 1
            if (this.ux >= this.width - 1) {
                this.ux = 1
                this.uy += 1
            }

        }

        return this.uy >= this.height - 1
    }

    do_step_addnpcs_init() {
        this.ux=1
        this.uy=1

        this.max_iter_steps = this.show ? (this.width) : (this.width*this.height) // maximum steps per iteration
        console.log("max steps now", this.max_iter_steps)

        this.histogram = [0, 0,0,0,0,]
        return true
    }

    do_step_addnpcs() {

        let z=0
        for (; z < this.max_iter_steps && this.uy < this.height - 1; z++) {


            // todo: skip non-floors
            let skip = (this.cells[this.uy][this.ux] != CELL_FLOOR) || (this.visited[this.uy][this.ux]===2)
            //for (let i=0; !skip && i < this.rooms.length; i++) {
            //    if (this.rooms[i].collidePoint(this.ux, this.uy)) {
            //        skip = 1
            //    }
            //}

            if (!skip) {

                let n = this.neighbors1({x:this.ux, y:this.uy})

                let total=0; // count of solid neighbors
                for (let i=0; i<n.length; i++) {
                    let p = n[i]
                    if (this.cells[p.y][p.x]!=CELL_WALL) {
                        total += 1;
                    }
                }

                this.histogram[total] += 1
                // if a dead end was found
                if (total == 3) {
                    let prob2 = 0.25
                    if (Math.random() < prob2) {
                        this.cells[this.uy][this.ux] = CELL_MONSTER
                    }
                }

            }

            // unwrapped double for-loop
            // that ignores the walls around the edges of the maze
            this.ux += 1
            if (this.ux >= this.width - 1) {
                this.ux = 1
                this.uy += 1
            }

        }

        if (this.uy >= this.height - 1) {
            console.log("hist", this.histogram)
        }
        return this.uy >= this.height - 1
    }

    do_transition_init() {
        this.timer = 0
        this.delay = 2.0
        return true
    }

    do_transition() {

        let data = {
            walls: [],
            breakable_walls: [],
            npcs: [],
            chests: [],
            doors: [],
            start: {x:1, y:1},
            width: this.width,
            height: this.height

        }

        for (let j=0;j<this.height;j++) {
            for (let i=0;i<this.width;i++) {

                if (this.cells[j][i] == CELL_WALL) {
                    data.walls.push({x:i,y:j,w:1,h:1});
                }

                if (this.cells[j][i] == CELL_BREAKABLE) {
                    data.breakable_walls.push({x:i,y:j,w:1,h:1});
                }

                if (this.cells[j][i] == CELL_MONSTER) {
                    data.npcs.push({x:i,y:j, type:0});
                }

                if (this.cells[j][i] == CELL_START) {
                    data.start = {x:i,y:j};
                }

                if (this.cells[j][i] == CELL_BOSS) {
                    data.npcs.push({x:i,y:j, type:1});
                }

                if (this.cells[j][i] == CELL_CHEST) {
                    data.chests.push({x:i, y:j, type:1});
                }

                if (this.cells[j][i] == CELL_BOSS_CHEST) {
                    data.chests.push({x:i, y:j, type:2});
                }

                if (this.cells[j][i] == CELL_DOOR) {
                    data.doors.push({x:i, y:j, type:1});
                }

                if (this.cells[j][i] == CELL_BOSS_DOOR) {
                    data.doors.push({x:i, y:j, type:2});
                }

                if (this.cells[j][i] == CELL_BOSS_LOCK) {
                    data.doors.push({x:i, y:j, type:3});
                }


            }
        }

        global.mapdata = data

        gEngine.scene = new ResourceLoaderScene()
    }

    neighbors1(c) {

        let n = []

        if (c.x-1 >= 0) {
            n.push({x:c.x-1,y:c.y})
        }

        if (c.x+1 < this.width) {
            n.push({x:c.x+1,y:c.y})
        }

        if (c.y-1 >= 0) {
            n.push({x:c.x,y:c.y-1})
        }

        if (c.y+1 < this.height) {
            n.push({x:c.x,y:c.y+1})
        }

        return n
    }

    neighbors2(c) {

        let n = []

        if (c.x-2 >= 0) {
            n.push([{x:c.x-2,y:c.y}, {x:c.x-1,y:c.y}])
        }

        if (c.x+2 < this.width) {
            n.push([{x:c.x+2,y:c.y}, {x:c.x+1,y:c.y}])
        }

        if (c.y-2 >= 0) {
            n.push([{x:c.x,y:c.y-2}, {x:c.x,y:c.y-1}])
        }

        if (c.y+2 < this.height) {
            n.push([{x:c.x,y:c.y+2}, {x:c.x,y:c.y+1}])
        }

        return n
    }

    reset() {
        this.current_step = 0
    }
}

export class MazeScene extends GameScene {

    constructor() {
        super();

        // 360/8 = 45.0
        // 640/8 = 80.0
        // maximum maze size for now is 79 x 45
        // in order to fit in the viewport on mobile
        this.gen = new MazeGenerator(71,41);

        this.touch = new TouchInput(null)

    }

    update(dt) {

        this.gen.update(dt)

    }

    paint(ctx) {
        //ctx.fillStyle = "yellow";
        //ctx.fillText(`${this.gen.ux} ${this.gen.uy}: ${JSON.stringify(gEngine.view)}`, 0, -8)

        ctx.beginPath();
        ctx.strokeStyle = 'red';
        ctx.rect(-1, -1, gEngine.view.width+2, gEngine.view.height+2);
        //ctx.moveTo(0,0)
        //ctx.lineTo(gEngine.view.width,gEngine.view.height)
        //ctx.moveTo(gEngine.view.width,0)
        //ctx.lineTo(0,gEngine.view.height)
        ctx.stroke();

        this.gen.paint(ctx)

    }

    handleTouches(touches) {
        console.log("!", touches)
        if (touches.length == 0) {
            this.gen.reset()
        }
    }

    resize() {

    }
}