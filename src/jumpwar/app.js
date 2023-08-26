
/**
 * jump war
 *
 * - send input to the server
 *   server reconciles the input with a time step
 *   server replies with the time the input got aplied
 *   game replays the state with the correct time input
 *   need to get to a point where the server has a single time step for all players
 *   ** there is no offset on the server side, only the time at which the input is received
 *       +/- effects due to lag on that connection
 *
 *
 * - level data should be compressed and split into chunks
 *   have a scene specifically for collecting the login message and map info
 *
 * - one way platforms are an extension of slopes
 *   https://www.emanueleferonato.com/2012/05/24/the-guide-to-implementing-2d-platformers/
 *
 * - pass through floors
 *    press down and check if standing on a one way platform
 *    if so. move to 1 pixel below the floor, which will trigger dropping through it/
 *
 * - update offset on every "update"
 *   update offset on every message received with an origin / map tag?
 *
 * - input should be somehow queued until if can be applied
 *   if I press right while the player is spawning, the player
 *   should begin moving as soon as spawning ends
 *
 * - client send:
 *   uid should be set by the webrtc client class
 *   client should keep track of acked messages
 *   client should resend messages that have not been acked
 *   - maybe every other update
 *   - maybe look at latency, 1/2 rtt send again
 * - server receive:
 *   - for each peer, keep track of received uids
 * - server send:
 *   - same idea as client send
 * - csp: consitent frame rate
 *        send frame deltas along with inputs?
 *        separate tick rate and frame rate? this would allow a constant tick
 * - webrtc: disconnect events from page refresh
 *           disconnect from missing keep alives
 * - pressing into a wall should require a button press
 * -
 * - send periodic update
 *    - send delta relative to last update
 *    - place updates at input_clock + 6 frames
 *      -
 *
 * - what if player inputs only send the delta (in ticks) since the last input
 *   and not the raw frame number.
 *   for any ent id - that exists - the last input frame can be recorded
 *
 * - create a counter per entity as part of the state
 *   count the number of inputs applied to the character
 *   ensure the same count for the ghost and player
 * - delay ghost by an additional 6 ms
 * - login message
 *    the login message indicates which frame to spawn on
 *    which is also the first frame to start the simulation
 *    login can return 40 and indicate to spawn on 70
 *    giving half a second before the player is spawned and controllable
 *
 * - color: green for accepted inputs
 *          red for non accepted inputs
 *          yellow for resynced inputs
 * - implement snap on error
 *      detect error from real position and simulated position
 * - adjust frequency of sending duplicate input packets
 *      with snap on error, this can be dropped to 2 assuming 10% packet loss
 * - speed up / slow down simulation
 *      detect when the simulation is falling behind real time
 *      process extra frames
 *      **  if an input comes in more than 6 frames in the future of 'now'
 *          speed up the simulation
 *      ** if every input comes in in the past, slow down the simulation
 *
 * World state
 *      receiveMessages
 *          process all received messages
 *      reconcile
 *          if there are any errors rewind the simulation and update all entities in lock step
 *      update
 *          run a single normal update for registered entities

 */
$import("daedalus", {})

$import("engine", {
    ApplicationBase, Rect, Entity,
    GameScene, CameraBase,
    TextWidget, TextInputWidget,
    Alignment, Direction,
    AnimationComponent, CharacterComponent,
    TouchInput, KeyboardInput,
    RealTimeClient, RealTimeEchoClient
    CspRingBuffer, mean, stddev,
    ArrowButtonWidget, ButtonWidget, SoundEffect
})

$import("scenes", {global, ResourceLoaderScene})

$import("entity", {CspController, CspReceiver, CspEntity, CspWorld, Physics2d})


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

class DemoReceiver extends CspReceiver {

    _create(message, cbk) {

        if (message.$state !== undefined) {
            const ent = this._getEntity(message.$entid)
            ent.setState(message.$state)
        } else {
            const ent = cbk()
            this.map.addEntity(ent)
            message.$state = ent.getState()
            message.$entid = ent.entid
        }
    }

    handleMessage(clock, entid, message, reconcile) {

        //console.log(reconcile?"reconcile":"update", "clock=", clock, message.type, "entid=",message.entid)

        //console.log("apply input idx=", "message=", message)
        if (message.type === "respawn") {
            const ent = this._getEntity(message.entid)

            ent.spawn(304, 128)

            console.log(message)
        }
        else if (message.type === "spawn_player") {
            if (message.$state !== undefined) {
                const ent = this._getEntity(message.$entid)
                ent.setState(message.$state)
            } else {

                const ent = new Character(message.chara)
                ent.physics.group = this.map.ecs.solid
                ent.entid = message.entid
                ent.sendEvent = (event) => {
                    this.map.sendEvent(event)
                }

                ent.group_charas = this.map.ecs.players
                ent.spawn(304, 128)

                this.map.addNetworkEntity(ent, message.entid)

                if (!message.remote) {
                    ent.layer = 10
                    if (this.map.player !== null) {
                        throw "player already exists"
                    }

                    this.map.player = ent
                    this.map.controller.setTarget(ent)
                    this.map.camera.setTarget(ent)
                } else {

                    if (!this.map.ghost) {
                        this.map.ghost = ent
                    }
                    ent.filter = `hue-rotate(+180deg)`
                }

                message.$state = ent.getState()
                message.$entid = ent.entid
            }

        }
        else if (message.type === "input") {
            const ent = this._getEntity(message.entid)
            if (!ent) {
                //console.log("no ent ", message.entid, message)
            } else {
                apply_character_input(this.map, message, ent.physics)

                //console.log("input delta", message.entid, message.frame)
            }

            if (reconcile && !message.applied) {
                console.log("!! applying input for the first time", message.entid, message)
            }



            //if (entid == 223) {
            //    ent.rect.x += 4 // TODO: FIXME for testing snap
            //}
            message.applied = true
            //
        }
        else if (message.type === "update") {

            //console.log("update delta", message.entid, message.frame - this.input_clock)

            const ent = this._getEntity(message.entid)
            if (!ent) {

                if (message.$state !== undefined) {
                    const ent = this._getEntity(message.entid)
                    ent.setState(message.state)
                } else {


                    const ent = new Character(message.state.chara)
                    ent.physics.group = this.map.ecs.solid
                    ent.group_charas = this.map.ecs.players
                    ent.sendEvent = (event) => {
                        this.map.sendEvent(event)
                    }
                    ent.entid = message.entid

                    this.map.addNetworkEntity(ent, message.entid)

                    if (!this.map.ghost) {
                        this.map.ghost = ent
                    }
                    ent.filter = `hue-rotate(+180deg)`
                    ent.setState(message.state)

                }


            } else {
                // const gendiff = (state1, state2) => {
                //     const diff = {}
                //     for (const prop of Object.keys(state1)) {
                //         if (prop === "doublejump_position") {
                //             continue
                //         }
                //         const d = state1[prop] - state2[prop]
                //         if (d != 0) {
                //             diff[prop] = d
                //         }
                //     }
                //     return diff
                // }

                //const current_state = ent.getState()
                //const cached1_state = this.statequeue[this._frameIndex(this.input_clock-1)]?.[message.entid]
                //const cached2_state = this.statequeue[this._frameIndex(this.input_clock)]?.[this.map.player.entid]
                //const player_state = this.map.player.getState()
                //const message_state = message.state
                //console.log("update offset", message.$offset)

                ent.setState(message.state)
            }

        }
        else if (message.type === "hit") {

            const ent = this._getEntity(message.entid)
            if (!!ent) {

                // gEngine.paused = true

                ent.kill()
            }

        }
        else if (message.type === "create") {

            this._create(message, () => {
                const src = this._getEntity(message.entid)
                const ent = new Shuriken()
                ent.physics.group = this.map.ecs.solid
                ent.physics.xspeed *= (src.physics.facing == Direction.LEFT)?-1:1
                ent.rect.x = src.rect.cx() - ent.rect.w/2
                ent.rect.y = src.rect.y - ent.rect.h/2
                console.log(ent.rect)
                return ent
            })

         }
        else if (message.type == "snap") {
            // TODO: I think there is a bug here
            // snap at the beginning of an update
            // but message is saved at the end
            // TODO: trying to brute force the offset to compare
            //for (let o = -7; o <= 7; o++){
            //    const st = this.statequeue[this._frameIndex(this.input_clock + o)]?.[message.entid]
            //    if (!!st) {
            //        const ent = this._getEntity(message.entid)
            //        //let a = {x: ent.physics.target.rect.x, y: ent.physics.target.rect.y}
            //        let a = {x: st.x, y: st.y}
            //        let b = {x: message.x, y: message.y}
            //        let e = ((a.x - b.x)**2 + (a.y - b.y) ** 2)**0.5
            //        console.log("snap", o, e, a, b)
            //    } else {
            //        console.error("no state")
            //    }
            //}
            //ent.rect.x = message.x
            //ent.rect.y = message.y

        }
    }
}


class Camera extends CameraBase {
    constructor(map) {
        super()
        this.map = map
        this.target = null

        this.x = 0;
        this.y = 0;
        this.width = gEngine.view.width
        this.height = gEngine.view.height

        this.active_border = new Rect(0,0,0,0)
        this.active_region = new Rect(0,0,0,0)

        this.tile_position = {x:-1024, y:-1024}
        this.dirty = true

        //margin of 4 tiles in the direction the target is facing
        //and 2 tiles in all other directions
    }

    setTarget(target) {
        this.target = target
    }

    resize() {
        this.width = gEngine.view.width
        this.height = gEngine.view.height
    }

    update(dt) {

        if (!this.target) {
            return
        }

        //let wnd = new Rect(
        //    Math.floor(this.target.rect.x-32-8),
        //    Math.floor(this.target.rect.y-32-16),
        //    3*32,
        //    3*32)
        //let v = Direction.vector(this.target.facing)
        //if (v.x < 0) { wnd.x -= 32; wnd.w += 32 }
        //if (v.x > 0) { wnd.w += 32 }
        //if (v.y < 0) { wnd.y -= 32; wnd.h += 32 }
        //if (v.y > 0) { wnd.h += 32 }
        let xborder1 = Math.floor(gEngine.view.width/4)
        let xborder2 = Math.floor(gEngine.view.width/4)
        let yborder1 = Math.floor(gEngine.view.height/4)
        let yborder2 = Math.floor(gEngine.view.height/4)
        let wnd = new Rect(
            this.x + xborder1,
            this.y + yborder1,
            this.width - xborder1 - xborder2,
            this.height - yborder1 - yborder2)
        //console.log(wnd, this.width, this.height)
        this.active_border = wnd

        let x,y;

        let tcx = this.target.rect.cx()
        let tcy = this.target.rect.cy()

        if (tcx < wnd.left()) {
            x = tcx - xborder1
        }
        else if (tcx > wnd.right()) {
            x = tcx + xborder2 - this.width
        } else {
            x = this.x
        }

        if (tcy < wnd.top()) {
            y = tcy - yborder1
        }
        else if (tcy > wnd.bottom()) {
            y = tcy + yborder2 - this.height
        } else {
            y = this.y
        }
        // force camera to center player
        //x = Math.floor(this.target.rect.cx() - gEngine.view.width/2)
        //y = Math.floor(this.target.rect.cy() - gEngine.view.height/2)
        // allow the camera to display outside of the map
        // so that the character is never under the inputs
        let input_border = 192
        if (x < -input_border) { x = -input_border}
        //if (y < -32) { y = -32 }
        let mx = this.map.width - gEngine.view.width + input_border
        let my = this.map.height - gEngine.view.height
        if (x > mx) { x = mx }
        if (y > my) { y = my }

        this.x = Math.floor(x)
        this.y = Math.floor(y)

        let tx = Math.floor((this.x-32)/32)
        let ty = Math.floor((this.y-32)/32)

        this.active_region = new Rect(
            tx*32,
            ty*32,
            this.width + 64,
            this.height + 64)

        this.dirty = this.dirty || (this.tile_position.x != tx || this.tile_position.y != ty)

        this.tile_position = {x:tx, y:ty}

    }

    activeRegion() {
        return this.active_region
    }
}

function apply_character_input(map, input, physics) {

    if (physics.target.iskill || physics.target.spawning) {
        return
    }

    if (input.btnid !== undefined) {
        //console.log("apply_input clock=", CspReceiver.instance.input_clock, physics.target.entid, "button", input.btnid, input.pressed)
        physics.ninputs += 1
        if (input.pressed) {

            // coyote time
            let standing = physics.standing_frame >= (physics.frame_index - 6)
            let pressing = physics.pressing_frame >= (physics.frame_index - 6)

            if (standing) {

                physics.yspeed = physics.jumpspeed
                physics.yaccum = 0
                physics.gravityboost = false
                physics.doublejump = true
                global.loader.sounds.jump.play(.3)

            } else if (pressing && !standing) {
                //let v = Direction.vector(physics.direction)
                //physics.xspeed = - v.x * physics.xjumpspeed
                physics.xspeed = physics.pressing_direction * physics.xjumpspeed
                physics.xaccum = 0
                physics.yspeed = physics.jumpspeed / Math.sqrt(2)
                physics.yaccum = 0
                physics.gravityboost = false
                //console.log("wall jump", physics.xspeed)

                // TODO: this causes a stutter when trying to wall jump  on the same wall
                //       if the direction of travel is the same as the current direction button
                //       the facing direction will need to be fixed, without a new input
                //physics.facing = (physics.facing == Direction.LEFT)?Direction.RIGHT:Direction.LEFT
                global.loader.sounds.jump.play(.3)

            } else if (!standing && physics.doublejump && physics.yspeed > 0) {
                //console.log("double jump")
                // double jump at half the height of a normal jump
                physics.yspeed = physics.jumpspeed / Math.sqrt(2)
                physics.yaccum = 0
                physics.gravityboost = false
                physics.doublejump = false
                physics.doublejump_position = {x:physics.target.rect.cx(), y: physics.target.rect.bottom()}
                physics.doublejump_timer = .4
                global.loader.sounds.jump.play(.3)
            }
            else {
                console.log(`jump standing=${standing} pressing=${pressing}`)
            }
        } else {
            physics.gravityboost = true
        }
    }
    else if (input.whlid !== undefined) {
        //console.log("apply_input clock=", CspReceiver.instance.input_clock, physics.target.entid, "wheel", input.whlid, input.direction)
        physics.ninputs += 1
        physics.direction = input.direction
        // TODO: maybe facing should only change when physics.update is run?
        if (physics.direction != 0) {
            physics.facing = physics.direction
        }

    }
}

class Wall extends CspEntity {
    constructor() {
        super()
        //this.sheet = sheet
        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    paint(ctx) {

        let l = this.rect.x
        let t = this.rect.y
        let r = this.rect.x+this.rect.w
        let b = this.rect.y+this.rect.h

        ctx.beginPath();
        ctx.fillStyle = "#c3c3c3";
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        //for (let x=l; x<r; x+=32) {
        //    for (let y=t; y<b; y+=32) {
        //        this.sheet.drawTile(ctx, this.breakable?2:1, x, y)
        //    }
        //}
    }
}

function applyfnull(f, a,b) {
    let r = null
    if (a != null && b != null) {
        r = f(a, b)
    } else if (a != null) {
        r = a
    } else if (b != null) {
        r = b
    }
    return r
}

class Slope extends CspEntity {
    constructor(x, y, direction) {
        super()

        this.rect.x = x
        this.rect.y = y
        this.rect.w = 32
        this.rect.h = 32

        /*
     +======================+
    ||   upleft | upright   ||
    ||         /o\          ||
    ||        / | \         ||
    ||       o--o--o        ||
    ||        \ | /         ||
    ||         \o/          ||
    || downleft | downright ||
     +======================+
        */
        this.points = []

        // points are organized such that:
        // origin is always first
        // left most non-origin point is second
        // right most non-origin point is third
        switch (direction) {

            case Direction.UPRIGHT:
                this.points.push({x: this.rect.left(), y: this.rect.bottom()})
                this.points.push({x: this.rect.right(), y: this.rect.bottom()})
                this.points.push({x: this.rect.left(), y: this.rect.top()})
                break
            case Direction.UPLEFT:
                this.points.push({x: this.rect.right(), y: this.rect.bottom()})
                this.points.push({x: this.rect.left(), y: this.rect.bottom()})
                this.points.push({x: this.rect.right(), y: this.rect.top()})
                break
            case Direction.DOWNRIGHT:
                this.points.push({x: this.rect.left(), y: this.rect.top()})
                this.points.push({x: this.rect.right(), y: this.rect.top()})
                this.points.push({x: this.rect.left(), y: this.rect.bottom()})
                break
            case Direction.DOWNLEFT:
                this.points.push({x: this.rect.right(), y: this.rect.top()})
                this.points.push({x: this.rect.left(), y: this.rect.top()})
                this.points.push({x: this.rect.right(), y: this.rect.bottom()})
                break
            default:
                throw {message: "invalid direction", direction}
        }

        this.direction = direction

        const p1 = this.points[1]
        const p2 = this.points[2]


        const m = (p2.y - p1.y) / (p2.x-p1.x)
        const b = p1.y - m *p1.x

        this.f = (x) => {
            if (x >= this.rect.left() && x <= this.rect.right()) {
                return m*x + b
            }
            return null;
        }

        this.g = (y) => {
            if (y >= this.rect.top() && y <= this.rect.bottom()) {
                return (y - b) / m
            }
            return null;
        }


        if (this.direction&Direction.DOWN) {
            // ceiling
            this._fx = (x,y) => {
                if (x >= this.rect.left() && x <= this.rect.right()) {
                    const yp = m*x + b
                    return Math.max(yp)
                }
                return null;
            }
        } else {
            // floor
            this._fx = (x,y) => {
                if (x >= this.rect.left() && x <= this.rect.right()) {
                    const yp = m*x + b
                    return Math.floor(yp)
                }
                return null;
            }
        }

        console.log(`y=${m}*x+${b}`)

        //this.sheet = sheet
        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    collide(other, dx, dy) {
        // TODO: the api could return up to two two options
        // {dx, 0} or {0, dy}
        // {dx, dy}

        let rect = other.rect

        const original_rect = rect
        rect = rect.copy()
        rect.translate(dx, dy)


        if (this.direction&Direction.LEFT && original_rect.left() >= this.rect.right()) {
            let update = original_rect.copy()
            update.set_left(this.rect.right())
            update.z = 1
            return update
        }

        if (this.direction&Direction.RIGHT && original_rect.right() <= this.rect.left()) {

            let update = original_rect.copy()
            update.set_right(this.rect.left())
            update.z = 2
            return update
        }

        let tmp = rect.intersect(this.rect)
        if (tmp.w == 0) {
            // likely unreachable unless a prior this.rect  other.rect test was not done
            return null
        }

        const x1 = tmp.x
        const x2 = tmp.x + tmp.w
        //console.log(">",{x1,x2}, this.rect, this.f(x1), this.f(x2))
        const y1 = rect.top()
        const y2 = rect.bottom()

        if (this.direction&Direction.DOWN) {

            if (original_rect.bottom() <= this.rect.top()) {
                if (dy > 0) {
                    let update = original_rect.copy()
                    update.set_bottom(this.rect.top())
                    update.z = 3
                    return update
                }
            } else {

                const yp = applyfnull(Math.max, this._fx(x1, y1), this._fx(x2, y1))
                //console.log("!!", yp, y1, y2, (yp != null && (y2 >= yp || y1 >= yp)))

                // TODO: consider returning two candidates then picking the best one


                const xp = this.g(y1)
                if (!!xp && this.direction&Direction.RIGHT && dx < 0 && rect.left() <= xp) {
                    // candidate position without adjusting the y direction
                    // when walking left
                    let update = rect.copy()
                    update.set_left(Math.ceil(xp)+1)
                    update.z = 4
                    update.xp = xp
                    return update
                } else if (!!xp && this.direction&Direction.LEFT && dx > 0  && rect.right() >= xp) {
                    // candidate position without adjusting the y direction
                    // when walking right
                    let update = rect.copy()
                    update.set_right(Math.floor(xp)-1)
                    update.z = 5
                    update.xp = xp
                    return update
                }


                if (yp != null && y1 <= yp) {
                    // candidate position with adjusting the y direction

                    // return a rectangle that does not collide
                    let update = rect.copy()
                    update.set_top(yp)
                    update.z = 6
                    return update
                }
            }
        } else {

            if (original_rect.top() >= this.rect.bottom()) {
                if (dy < 0) {
                    let update = original_rect.copy()
                    update.set_top(this.rect.bottom())
                    update.z = 7
                    return update
                }
            } else {
                const yp = applyfnull(Math.min, this._fx(x1, y2), this._fx(x2, y2))

                //if (yp != null && (y2 >= yp || y1 >= yp)) {
                if (yp != null && y2 >= yp) {
                    // return a rectangle that does not collide
                    let update = rect.copy()
                    update.set_bottom(yp)
                    update.z = 8
                    return update
                }
            }


        }
        return null

    }

    collidePoint(x, y) {
        let yp = this._fx(x, y)

        if (!super.collidePoint(x, y)) {
            return false
        }

        if (yp == null) {
            return false
        }
        if (this.direction&Direction.DOWN) {
            return yp >= y
        } else {
            return yp <= y
        }
    }

    paint(ctx) {

        let l = this.rect.x
        let t = this.rect.y
        let r = this.rect.x+this.rect.w
        let b = this.rect.y+this.rect.h

        ctx.fillStyle = "#c3a3a3";
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.fill();

    }
}

class OneWayPlatform extends CspEntity {

    constructor(rect) {
        super()

        this.rect = rect

        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    collide(other, dx, dy) {

        let rect = other.rect

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            // return a rectangle that does not collide
            let update = rect.copy()
            update.set_bottom(this.rect.top())
            return update
        }

        return null
    }

    paint(ctx) {

        ctx.fillStyle = "#c05f10";
        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

    }
}

class MovingPlatform extends CspEntity {
    /*

    Movinging platforms work by

     - capture a reference to any entity that lands on top of the platform
     - references are cleared if there is no more collision with that object
     - setting the order to be lower than other entities
       the platform update is run first, any captured entities are moved by the same amount

    TODO: a pushable platform is a moving platform where:
        - it doesnt start moving until it captures an entity
        - if there are entities on both sides it stops moving
        - every time it moves it drags the player along

    TODO: moving platforms need to run movement tests in the x and y direction
          for now placing platforms where there is no possible obstruction is the solution
          crunching a player in the y direction should cause damage and have the player fall through the floor

    TODO: movement can be complicated, such as a 4 platform windmill, or following a track

    it may be useful to have bricks and platforms know if the
    entity is the player controlled entity.
    entities can have a property for control state
        local player
        network synced
        non-networked synced
    this is more or less easy to determine from the ent id
        the local player entid can be made global
    */

    constructor(rect) {
        super()

        this.rect = rect

        this.targets = {}

        this.breakable = 0
        this.alive = 1
        this.solid = 1
        this.order = 10

        this.xspeed = 20
        this.xaccum = 0
        this.yspeed = -20
        this.yaccum = 0
    }

    collide(other, dx, dy) {

        let rect = other.rect

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            // return a rectangle that does not collide
            this.targets[other.entid] = other
            let update = rect.copy()
            update.set_bottom(this.rect.top())
            return update
        }

        return null
        /*
        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.cy()) {
            this.targets[other.entid] = other
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            update.set_top(this.rect.bottom())
            return update
        }*/

        return null
    }

    paint(ctx) {

        ctx.fillStyle = "#10c05f";
        ctx.beginPath();
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 4);
        ctx.fill();

    }

    update(dt) {


        this.xaccum += dt * this.xspeed
        this.yaccum += dt * this.yspeed

        const dx = Math.trunc(this.xaccum)
        const dy = Math.trunc(this.yaccum)
        this.xaccum -= dx
        this.yaccum -= dy

        this.rect.x += dx
        this.rect.y += dy
        if (this.rect.x > 256) {
            this.xspeed = -20
            this.yspeed = 0
        }

        if (this.rect.x < 128) {
            this.xspeed = 20
            this.yspeed = 0
        }


        const keys = Object.keys(this.targets)
        if (keys.length > 0) {
            for (const entid of keys) {
                const ent = this.targets[entid]
                if (ent.rect.collideRect(new Rect(this.rect.x, this.rect.y-2, this.rect.w, 4))) {
                    // ent.rect.set_bottom(this.rect.top())
                    ent.rect.x += dx
                    ent.rect.set_bottom(this.rect.top())
                    const after = {ent: ent.rect.copy(), rect: this.rect.copy()}
                } else {
                    delete this.targets[entid]
                }
            }
        }
    }

    setState(state) {
        console.log("received platform state", state)
    }
}

class Brick extends CspEntity {

    constructor(x, y, w=16, h=16) {
        super()

        this.rect.x = x
        this.rect.y = y
        this.rect.w = w
        this.rect.h = h

        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    collide(other, dx, dy) {

        let rect = other.rect
        let update = rect.copy()

        if (dx > 0 && rect.right() <= this.rect.left()) {
            update.set_right(this.rect.left())
            return update
        }

        if (dx < 0 && rect.left() >= this.rect.right()) {
            update.set_left(this.rect.right())
            return update
        }

        if (dy > 0 && rect.bottom() <= this.rect.top()) {
            update.set_bottom(this.rect.top())
            return update
        }

        if (dy < 0 && rect.top() >= this.rect.top()) {
            this.destroy()
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    paint(ctx) {

        ctx.fillStyle = "#c05f10";
        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

    }
}

class Character extends CspEntity {

    constructor(chara) {
        super()
        this.chara = chara
        this.current_action = "idle"
        this.current_facing = Direction.RIGHT

        this.solid = false

        this.filter = null

        this.rect.w = 16
        this.rect.h = 16

        this.physics = new Physics2d(this)
        this.animation = new AnimationComponent(this)
        this.character = new CharacterComponent(this)

        this.buildAnimations()

        this.spawning = true

        this.kill_timer_1 = 0
        this.iskill = false

        this.group_charas = ()=>[]

    }

    buildAnimations() {

        this.animations = {
            "double_jump": {},
            "fall": {},
            "hit": {},
            "idle": {},
            "jump": {},
            "run": {},
            "wall_slide": {},
            "appear": {},
            "disappear": {},
        }

        let chara = this.chara ?? "frog"
        let idx = "0"
        let spf = 0.06
        let xoffset = - 8
        let yoffset = - 16

        let defines1 = [
            ["double_jump",Direction.LEFT,  `${chara}_${idx}_l_double_jump`],
            ["fall",       Direction.LEFT,  `${chara}_${idx}_l_fall`],
            ["hit",        Direction.LEFT,  `${chara}_${idx}_l_hit`],
            ["idle",       Direction.LEFT,  `${chara}_${idx}_l_idle`],
            ["jump",       Direction.LEFT,  `${chara}_${idx}_l_jump`],
            ["run",        Direction.LEFT,  `${chara}_${idx}_l_run`],
            ["wall_slide", Direction.LEFT,  `${chara}_${idx}_l_wall_slide`],
            ["double_jump",Direction.RIGHT, `${chara}_${idx}_r_double_jump`],
            ["fall",       Direction.RIGHT, `${chara}_${idx}_r_fall`],
            ["hit",        Direction.RIGHT, `${chara}_${idx}_r_hit`],
            ["idle",       Direction.RIGHT, `${chara}_${idx}_r_idle`],
            ["jump",       Direction.RIGHT, `${chara}_${idx}_r_jump`],
            ["run",        Direction.RIGHT, `${chara}_${idx}_r_run`],
            ["wall_slide", Direction.RIGHT, `${chara}_${idx}_r_wall_slide`],
        ]

        for (const info of defines1) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(sheet, sheet.tiles(), spf, {xoffset, yoffset})
            this.animations[animation_name][direction] = aid
        }


        // appearing / disappearing

        spf = 1/14
        xoffset = -40
        yoffset = -48
        let onend;

        let defines2 = [
            ["appear",    Direction.LEFT,  `default_l_appear`],
            ["appear",    Direction.RIGHT, `default_r_appear`],
        ]

        onend = this.onSpawnAnimationEnd.bind(this)

        for (const info of defines2) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(
                sheet, sheet.tiles(), spf, {xoffset, yoffset, loop: false, onend}
            )
            this.animations[animation_name][direction] = aid
        }

        let defines3 = [
            ["disappear",    Direction.LEFT,  `default_l_disappear`],
            ["disappear",    Direction.RIGHT, `default_r_disappear`],
        ]

        onend = this.onDeathAnimationEnd.bind(this)

        for (const info of defines3) {
            let [animation_name, direction, sheet_name] = info;
            let sheet = global.loader.sheets[sheet_name]
            let aid = this.animation.register(
                sheet, sheet.tiles(), spf, {xoffset, yoffset, loop: false, onend}
            )
            this.animations[animation_name][direction] = aid
        }

        this.animation.setAnimationById(this.animations.appear[this.physics.facing])
    }

    //setDirection(direction) {

        //this.physics.direction = direction&Direction.LEFTRIGHT

        //if (direction&Direction.LEFTRIGHT) {
        //    this.physics.facing = direction&Direction.LEFTRIGHT
        //    this.animation.setAnimationById(this.animations[this.current_action][this.physics.facing])
        //}
    //}

    onSpawnAnimationEnd() {
        let aid = this.animations[this.current_action][this.current_facing]
        if (!aid) {
            throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
        }
        this.animation.setAnimationById(aid)
        this.spawning = false
    }

    onDeathAnimationEnd() {
        this.visible = false
    }

    update(dt) {

        if (!this.spawning) {
            this.physics.update(dt)
        }

        if (!this.spawning && !this.iskill) {
            if (this.physics.facing != this.current_facing) {
                this.current_facing = this.physics.facing
                let aid = this.animations[this.current_action][this.current_facing]
                if (!aid) {
                    console.error(this.physics)
                    throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
                }
                this.animation.setAnimationById(aid)
            }

            if (this.physics.action != this.current_action) {
                this.current_action = this.physics.action
                let aid = this.animations[this.current_action][this.current_facing]
                if (!aid) {
                    console.error(this.physics)
                    throw {message: "invalid aid", aid, action:this.current_action, facing: this.current_facing}
                }
                this.animation.setAnimationById(aid)
            }
        }

        if (this.iskill) {
            if (this.kill_timer_1 > 0) {

                if (this.physics.facing != this.current_facing) {
                    this.current_facing = this.physics.facing
                    let aid = this.animations[this.current_action][this.current_facing]
                    this.animation.setAnimationById(aid)
                }

                if (this.physics.action != this.current_action) {
                    this.current_action = this.physics.action
                    let aid = this.animations[this.current_action][this.current_facing]
                    this.animation.setAnimationById(aid)
                }

                this.kill_timer_1 -= dt

                if (this.kill_timer_1 <= 0) {
                    this.animation.setAnimationById(this.animations.disappear[this.physics.facing])

                    this.physics.xspeed = 0
                    this.physics.yspeed = 0
                    this.physics.xaccum = 0
                    this.physics.yaccum = 0

                    this.kill_timer_1 = 0
                }
            }
        } else if (this.physics.yspeed > 0) {
            for (const other of this.group_charas()) {
                if (other.entid != this.entid) {
                    if (this.rect.collideRect(other.rect)) {
                        if (this.rect.cy() < other.rect.cy()) {
                            this.sendEvent?.({
                                type: "hit",
                                frame: CspReceiver.instance.input_clock,
                                entid: this.entid,
                                target: other.entid
                            })
                        }
                    }
                }
            }
        }

        this.animation.update(dt)
        this.character.update(dt)

    }

    paint(ctx) {



        ctx.save()
        //if (!!this.filter) {
        //    ctx.filter = this.filter + "  blur(5px)"
        //} else {
        //    ctx.filter = "hue-rotate(180deg) brightness(2)"
        //}

        if (!!this.filter) {
            if (this.iskill) {
                ctx.filter = this.filter + ` brightness(${1 + (1-this.kill_timer_1/.6)})`
            } else {
                ctx.filter = this.filter
            }
        } else {
            if (this.iskill) {
                ctx.filter = `brightness(${1 + (1-this.kill_timer_1)})`
            }
        }

        this.animation.paint(ctx)
        ctx.restore()

        if (this.physics.doublejump_timer > 0) {
            const p = this.physics.doublejump_position

            ctx.strokeStyle = "#CCCC004f"
            ctx.beginPath()
            ctx.roundRect(p.x-9, p.y, 18, 4, 4)
            ctx.stroke()
        }

        //ctx.fillStyle = this.physics.standing?"#ff0000":this.physics.pressing?"#007f00":"#7f0000";
        //ctx.beginPath()
        //ctx.rect(this.rect.x,this.rect.y,this.rect.w,this.rect.h)
        //ctx.fill()
    }

    getState() {
        let state = [this.visible, this.spawning, this.iskill, this.kill_timer_1]
        return {chara: this.chara, rest:[state, this.physics.getState(), this.animation.getState()]}
    }

    setState(state) {
        try {
            const [state1, state2, state3] = state.rest
            [this.visible, this.spawning, this.iskill, this.kill_timer_1] = state1
            this.physics.setState(state2)
            this.animation.setState(state3)
        } catch (e) {
            console.log(state)
            console.log(e)
            console.error(e)
        }
    }

    spawn(x, y) {
        this.rect.x = x
        this.rect.y = y
        this.spawning = true
        this.physics.facing = Direction.RIGHT
        this.animation.setAnimationById(this.animations.appear[this.physics.facing])
        this.iskill = false
        this.visible = true
        global.loader.sounds.spawn.play(.6)
    }

    kill() {

        this.kill_timer_1 = 0.6
        this.iskill = true

        this.physics.xspeed = 0
        this.physics.yspeed = 0
        this.physics.xaccum = 0
        this.physics.yaccum = 0
        this.physics.direction = 0

        let d = this.physics.facing==Direction.LEFT?1:-1
        this.physics.xspeed = d * Math.sqrt( 32*this.physics.xacceleration)
        this.physics.yspeed = - Math.sqrt(2*48*this.physics.gravity)
        this.physics.doublejump = false
        global.loader.sounds.dead.play(.6)
    }
}

class Shuriken extends CspEntity {

    constructor() {
        super()

        this.solid = false

        this.rect.w = 8
        this.rect.h = 8

        this.physics = new Physics2d(this)
        this.physics.xspeed = 128 * 2.5
        this.physics.gravity = 0
    }

    update(dt) {


        this.physics.update(dt)

        if (this.physics.xcollide) {
            this.destroy()
        }



    }

    paint(ctx) {

        ctx.fillStyle = "#665533";
        ctx.beginPath()
        ctx.arc(this.rect.cx(),this.rect.cy(),8,8, 0, 2*Math.PI)
        ctx.fill()

    }

    getState() {
        return this.physics.getState()
    }

    setState(state) {
        this.physics.setState(state)
    }
}


class World extends CspWorld {

    constructor(client) {
        super()

        this.client = client

        let mapw = 640 * 2
        let maph = 360

        this.messages = []

        this.map = {width: mapw, height: maph}

        this.login_sent = false
        this.login_received = false
        this.map_info_received = false

        this.game_ready = false

        // statistics on received information
        this.latencies = []
        this.latency_max = 0
        this.latency_min = 0
        this.latency_mean = 0
        this.latency_stddev = 0
        this.message_count = 0

        this.player = null
        this.ghost = null

        this.ecs.addGroup("players", (ent) => {return ent instanceof Character})

        this.controller = new CspController(this.client)
        this.controller.map = this

        this.receiver = new DemoReceiver(this)

        this.controller.receiver = this.receiver
        CspReceiver.instance = this.receiver

        this.camera = new Camera(this.map)

        this.walls = [] // TODO: deprecate
        //this.entities = []

    }

    buildMap(objects) {



        Physics2d.maprect = new Rect(0,-128, this.map.width, this.map.height+64)

        console.log(gEngine.view, this.map)

        let w;
        w = new Wall()
        w.rect.x = 0
        w.rect.y = this.map.height - 32
        w.rect.w = this.map.width
        w.rect.h = 32
        this.addEntity(w)

        w = new Wall()
        w.rect.x = 0
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height
        this.addEntity(w)

        w = new Wall()
        w.rect.x = this.map.width - 32
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height
        this.addEntity(w)

        w = new Wall()
        w.rect.x = this.map.width/4 - 32
        w.rect.y = this.map.height - 64
        w.rect.w = 64
        w.rect.h = 32

        this.addEntity(w)

        w = new Slope(this.map.width/4 - 32 - 32, this.map.height - 64, Direction.UPLEFT)
        this.addEntity(w)

        w = new Slope(this.map.width/4 - 32 + 64, this.map.height - 64, Direction.UPRIGHT)
        this.addEntity(w)

        //w = new Slope(32, this.map.height - 64, Direction.UPLEFT)
        w = new Slope(32, this.map.height - 64, Direction.DOWNRIGHT)
        this.addEntity(w)

        w = new Slope(128, this.map.height - 64, Direction.UPRIGHT)
        this.addEntity(w)

        w = new Slope(192, this.map.height - 64, Direction.UPLEFT)
        this.addEntity(w)

        w = new Slope(224, this.map.height - 64, Direction.UPRIGHT)
        this.addEntity(w)


        w = new Wall()
        w.rect.x = 128
        w.rect.y = this.map.height - 128
        w.rect.w = 64
        w.rect.h = 32
        this.addEntity(w)

        w = new Slope(96, this.map.height - 128, Direction.DOWNLEFT)
        this.addEntity(w)

        w = new Slope(192, this.map.height - 128, Direction.DOWNRIGHT)
        this.addEntity(w)

        w = new Slope(96, this.map.height - 160, Direction.DOWNLEFT)
        this.addEntity(w)

        w = new Slope(192, this.map.height - 160, Direction.DOWNRIGHT)
        this.addEntity(w)

        w = new OneWayPlatform(new Rect(256-32, this.map.height - 128, 48, 12))
        this.addEntity(w)

        //w = new MovingPlatform(new Rect(128, this.map.height - 128 - 48, 48, 12))
        //this.addEntity(w)


        w = new Brick(400, this.map.height - 96)
        this.addEntity(w)
        w = new Brick(400+32, this.map.height - 96)
        this.addEntity(w)
        w = new Brick(400+64, this.map.height - 96)
        this.addEntity(w)
        w = new Brick(400+16, this.map.height - 112)
        this.addEntity(w)
        w = new Brick(400+48, this.map.height - 112)
        this.addEntity(w)
        w = new Brick(400+32, this.map.height - 128)
        this.addEntity(w)

        w = new Wall()
        w.rect.x = this.map.width/2 - 128 - 32
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height - 96
        this.addEntity(w)

        w = new Wall()
        w.rect.x = this.map.width/2 - 128 - 32 + 96
        w.rect.y = 0
        w.rect.w = 32
        w.rect.h = this.map.height - 96
        this.addEntity(w)

        for (const obj of objects) {
            if (obj.className == "MovingPlatform") {
                w = new MovingPlatform(new Rect(obj.state.position[0], obj.state.position[1], 48, 12))
                //w.setState(obj.state)
                w.xspeed = obj.state.speed[0]
                w.yspeed = obj.state.speed[1]
                this.addEntity(w, obj.entid)
            }



        }

        this.player = null
        this.ghost = null




    }

    handleMockMessage(message) {

        // pretend to be the server

        if (message.type == "hit"){
            return
        }

        if (message.type == "login"){
            this.handleMessage({
                type: "login",
                //"clock": 123456,
                "entid": 123,
                "uid": 1
            })

            this.handleMessage({
                type: "map_info",
                "uid": 1,
                "objects": [],
            })

            this.handleMessage({
                type: "player_join",
                //"clock": 123456,
                "entid": 223,
                "uid": 2
            })

            return
        }

        else if (message.type == "keepalive"){
            message.clock = CspReceiver.instance.input_clock
        }
        else if (message.type == "create"){
            console.log("server create")
            return
        }

        if (message.type == "inputs") {
            for (const input of message.inputs) {
                input.entid += 100
            }
        }
        if (message.entid !== undefined) {
            message.entid += 100
        }

        this.handleMessage(message)
    }

    handleMessage(message) {
        // TODO: handle Messages should be part of the client
        this.messages.push(message)
    }

    update(dt) {

        // this.use_network
        const NOGHOST = false

        if (this.messages.length > 0) {
            this.message_count = this.messages.length
            for (let message of this.messages) {
                if (message.type == "logout") {
                    if (message.entid in this.entities) {
                        this.entities[message.entid].destroy()
                    }
                    //this.receiver._receive(message)
                } else if (message.type == "login") {
                    console.log("login received")

                    //this.receiver.input_clock = message.clock
                    this.receiver._receive({
                        type: "spawn_player",
                        remote: false,
                        chara: message.chara,
                        frame: this.receiver.input_clock + 6,
                        entid: message.entid,
                        uid: message.uid

                    })
                    this.login_received = true

                } else if (message.type == "map_info") {
                    console.log("map_info received")

                    this.buildMap(message.objects)

                    this.map_info_received = true

                }
                else if (message.type == "keepalive") {
                    this.latencies.push(Math.floor(performance.now() - message.t0))
                    while (this.latencies.length > 15) {
                        this.latencies.shift()
                    }
                    this.latency_min = Math.min(...this.latencies)
                    this.latency_max = Math.max(...this.latencies)
                    this.latency_mean = mean(this.latencies)
                    this.latency_stddev = stddev(this.latencies)

                    //console.log("frame delta", message.clock, CspReceiver.instance.input_clock, message.clock - CspReceiver.instance.input_clock)
                }
                else if (message.type == "inputs") {
                    for (const msg of message.inputs) {
                        this.receiver._receive(msg)
                    }
                }
                else if (message.type == "input") {

                    if (!NOGHOST) {
                        this.receiver._receive(message)
                    }
                }
                else if (message.type == "update") {

                    //if (!!this.entities[message.entid]) {
                    //    this.receiver._receive({
                    //        type: "spawn_player",
                    //        remote: true,
                    //        frame: message.frame,
                    //        entid: message.entid,
                    //        uid: message.uid
                    //    })
                    //}

                    if (!NOGHOST) {
                        this.receiver._receive(message)
                    }
                }
                else if (message.type == "player_join") {
                    if (!NOGHOST) {
                        this.receiver._receive({
                            type: "spawn_player",
                            remote: true,
                            chara: message.chara,
                            frame: this.receiver.input_clock + 6,
                            entid: message.entid,
                            uid: message.uid
                        })
                    }
                }
                else if (message.type == "respawn") {
                    this.receiver._receive({
                        type: "respawn",
                        frame: this.receiver.input_clock,
                        entid: message.entid,
                        uid: message.uid
                    })
                }
                else if (message.type == "hit") {
                    this.receiver._receive(message)


                }
                else {
                    console.log("unexpected message type", message)
                }
            }
            this.messages = []

            this.receiver._reconcile()

        }


        if (!this.login_sent) {
            console.log("sending login")
            this.client.send({type: "login", chara: global.chara})
            this.login_sent = true
            return
        }

        if (!this.login_received) {
            return
        }

        if (!this.map_info_received) {
            return
        }

        this.camera.update(dt)
        this.controller.update(dt)
        // receiver update before controller?
        this.receiver.update_before()
        this.update_entities(dt)
        this.receiver.update_after()

    }

    update_entities(dt) {

        const now = CspReceiver.instance.input_clock
        const delete_delay = 120

        const todelete = []
        for (const ent of this.ecs.updatable()) {
            if (ent.$csp_destroyed_at < 0 || now <= ent.$csp_destroyed_at) {
                ent.update(dt)
            } else if (ent.$csp_destroyed_at>=0 && now > (ent.$csp_destroyed_at + delete_delay)) {
                todelete.push(ent)
            }
        }

        for (const ent of todelete) {
            console.log("delete", ent.entid, ent.$csp_destroyed_at, now)
            delete this.entities[ent.entid]
        }
        //for (let i = this.entities.length - 1; i >= 0; i--) {
        //    let ent = this.entities[i]
        //    ent.update(dt)
        //}
    }

    paint(ctx) {

        if (!this.login_received) {
            return
        }

        if (!this.map_info_received) {
            return
        }

        ctx.save()

        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -this.camera.y)

        ctx.fillStyle = "#69698c"
        let buildings = [300, 100, 250, 300]
        let bo = 200*5
        for (let i = 0; i < buildings.length; i++) {
            let bh = buildings[i]
            let bw = 168
            ctx.fillRect(  (this.camera.x + bo*(i+1))/5 , this.map.height - bh, bw, bh)
        }

        ctx.strokeStyle = "#FFFFFF1f"
        ctx.beginPath()
        ctx.rect(0,0,this.map.width,  this.map.height)
        ctx.stroke()

        for (let y=this.map.height; y > 0; y-=32) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(this.map.width, y)
            ctx.stroke()
        }

        for (let i = this.walls.length - 1; i >= 0; i--) {
            let ent = this.walls[i]
            ent.paint(ctx)
        }

        if (!this.game_ready) {
            return
        }

        const now = CspReceiver.instance.input_clock

        for (const ent of this.ecs.visible()) {
            if (ent.$csp_destroyed_at < 0 || now <= ent.$csp_destroyed_at) {
                ent.paint(ctx)
            }
        }

        //for (let i = this.entities.length - 1; i >= 0; i--) {
        //    let ent = this.entities[i]
        //    ent.paint(ctx)
        //}

        ctx.restore()

        // boxes to make text easier to read
        ctx.fillStyle = "#333344af"
        if (!this.use_network) {
            ctx.fillRect(gEngine.view.width - 165, 0, 165, 155)
        }
        ctx.fillRect(0, 0, 320, 100)

        ctx.font = "bold 12pt Courier";
        ctx.fillStyle = "yellow"
        // ${this.latency_min.toFixed(2)} ${this.latency_max.toFixed(2)}
        ctx.fillText(`${(gEngine.spt).toFixed(3)} : ${(gEngine.fps).toFixed(2)} latency: mean=${this.latency_mean.toFixed(0)}ms sd=${this.latency_stddev.toFixed(0)}ms`, 32, 40)
        //ctx.fillText(`${gEngine.timings}`, 32, 56)
        //ctx.fillText(`${Direction.name[this.player.current_facing]} action=${this.player.physics.action}`, 32, 56)
        const stats = this.client.stats()
        ctx.fillText(`bytes: sent=${Math.floor(stats.sent/3)} received=${Math.floor(stats.received/3)}`, 32, 72)
        ctx.fillStyle = "#00FF00"
        //ctx.fillText(`error = (${Math.floor(this.ghost2.error.x)}, ${Math.floor(this.ghost2.error.y)}) ${this.ghost2.received_offset }`, 32, 88)
        //ctx.fillText(`pos = (${this.player.rect.x}, ${this.player.rect.y})`, 32, 104)
        //if (!!this.player && !!this.ghost) {
        //    ctx.fillText(`player=${this.player.physics.ninputs} ghost=${this.ghost.physics.ninputs} offset=${CspReceiver.instance.offsets[this.ghost.entid]}`, 32, 104)
        //}
        this.receiver.paintOverlay(ctx)

    }
}

class DemoScene extends GameScene {

    constructor() {
        super()


        this.widgets = []

        this.profiles = [
            {name: "Excellent", mean: 25, stddev: 0, droprate: 0},
            {name: "good", mean: 50, stddev: 10, droprate: 0},
            {name: "bad", mean: 200, stddev: 100, droprate: 0},
            {name: "poor", mean: 250, stddev: 150, droprate: 0},
            {name: "mobile-ok", mean: 100, stddev: 100, droprate: 0},
            {name: "mobile-poor", mean: 400, stddev: 200, droprate: 0},
        ]
        const query = daedalus.util.parseParameters()
        this.profile_index = parseInt(query.quality)||0
        if (this.profile_index < 0 || this.profile_index > this.profiles.length - 1) {
            this.profile_index = 0
        }

        const valid = ['frog', 'pink', 'blue', 'mask']
        global.chara = (query?.chara??["frog"])[0]
        if (!valid.includes(global.chara)){
            global.chara = 'frog'
        }

        let use_network = false
        if (daedalus.env.backend=="webrtc") {
            // backend is a multi player webrtc server
            this.client = new DemoRealTimeClient()
            this.client.connect("/rtc/offer", {})
            this.buildRtcWidgets()
            use_network = true

        } else if (daedalus.env.backend == "echo") {
            // backend is an echo server
            this.client = new DemoRealTimeClient()
            this.client.connect("/rtc/offer", {})
            use_network = true
            SoundEffect.global_volume = 0

        } else {
            this.client = new RealTimeEchoClient()
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            this.buildLatencyWidgets()
            use_network = false
            SoundEffect.global_volume = 0
        }

        this.map = new World(this.client)
        if (daedalus.env.backend=="webrtc") {
            this.client.setCallback(this.map.handleMessage.bind(this.map))
        } else {
            this.client.setCallback(this.map.handleMockMessage.bind(this.map))
        }
        this.map.use_network = use_network
        this.map.client = this.client


        this.touch = new TouchInput(this.map.controller)
        this.touch.addWheel(72, -72, 72)
        //this.touch.addButton(-60, -60, 40)
        this.touch.addButton(-40, -120, 40)
        this.touch.addButton(-120, -40, 40)

        this.keyboard = new KeyboardInput(this.map.controller);
        this.keyboard.addWheel_ArrowKeys()
        this.keyboard.addButton(KeyboardInput.Keys.SPACE)
        this.keyboard.addButton(KeyboardInput.Keys.CTRL)



    }

    buildRtcWidgets() {

        let wgtx = gEngine.view.width - 32
        let wgto = 128
        let wgty = 8
        let wgth = 24

        let wgt1 = new ButtonWidget(Direction.LEFT)
        wgt1.rect = new Rect(wgtx - wgto,wgty,96+16,24)
        wgt1.setText("Disconnect")
        this.widgets.push(wgt1)

        wgt1.clicked = () => {
            this.client.disconnect()
        }

        let wgt2 = new ButtonWidget(Direction.LEFT)
        wgt2.rect = new Rect(wgtx - wgto,wgty + 32,96+16,24)
        wgt2.setText("Bot")
        this.widgets.push(wgt2)

        wgt2.clicked = (() => {

            let timer = null
            let direction = Direction.RIGHT

            return () => {

                if (timer == null) {

                    timer = setInterval(()=>{
                        this.map.controller.setInputDirection(0, Direction.vector(direction))
                        direction = Direction.flip[direction]
                    }, 1500)
                } else {
                    clearInterval(timer)
                    timer = null
                }


            }

        })()


    }

    buildLatencyWidgets() {

        let wgtx = gEngine.view.width - 32
        let wgto = 128
        let wgty = 8
        let wgth = 24

        let wgt1, wgt2, txt1, txt2;
        wgt1 = new ArrowButtonWidget(Direction.LEFT)
        wgt1.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt1)
        wgt2 = new ArrowButtonWidget(Direction.RIGHT)
        wgt2.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt2)
        txt1 = new TextWidget()
        txt1.rect = new Rect(
            wgt1.rect.right() + 8,
            wgt1.rect.y - 2,
            wgt2.rect.left() - wgt1.rect.right() - 16,
            wgt1.rect.h + 4
        )
        txt1._text = "lat mean"
        txt1._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt1)
        txt2 = new TextWidget()
        txt2.rect = new Rect(
            wgt1.rect.right() + 8,
            wgt1.rect.y - 8,
            wgt2.rect.left() - wgt1.rect.right() - 16,
            wgt1.rect.h + 16
        )
        txt2._text = this.client.latency_mean
        txt2._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt2)


        let wgt3, wgt4, txt3, txt4;
        wgty += wgth + 12
        wgt3 = new ArrowButtonWidget(Direction.LEFT)
        wgt3.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt3)
        wgt4 = new ArrowButtonWidget(Direction.RIGHT)
        wgt4.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt4)
        txt3 = new TextWidget()
        txt3.rect = new Rect(
            wgt3.rect.right() + 8,
            wgt3.rect.y - 2,
            wgt4.rect.left() - wgt3.rect.right() - 16,
            wgt3.rect.h + 4
        )
        txt3._text = "lat stddev"
        txt3._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt3)
        txt4 = new TextWidget()
        txt4.rect = new Rect(
            wgt3.rect.right() + 8,
            wgt3.rect.y - 8,
            wgt4.rect.left() - wgt3.rect.right() - 16,
            wgt3.rect.h + 16
        )
        txt4._text = this.client.latency_stddev
        txt4._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt4)



        let wgt5, wgt6, txt5, txt6;
        wgty += wgth + 12
        wgt5 = new ArrowButtonWidget(Direction.LEFT)
        wgt5.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt5)
        wgt6 = new ArrowButtonWidget(Direction.RIGHT)
        wgt6.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt6)
        txt5 = new TextWidget()
        txt5.rect = new Rect(
            wgt5.rect.right() + 8,
            wgt5.rect.y - 2,
            wgt6.rect.left() - wgt5.rect.right() - 16,
            wgt5.rect.h + 4
        )
        txt5._text = "droprate"
        txt5._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt5)
        txt6 = new TextWidget()
        txt6.rect = new Rect(
            wgt5.rect.right() + 8,
            wgt5.rect.y - 8,
            wgt6.rect.left() - wgt5.rect.right() - 16,
            wgt5.rect.h + 16
        )
        txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
        txt6._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt6)

        let wgt7, wgt8, txt7, txt8;
        wgty += wgth + 12
        wgt7 = new ArrowButtonWidget(Direction.LEFT)
        wgt7.rect = new Rect(wgtx - wgto,wgty,24,24)
        this.widgets.push(wgt7)
        wgt8 = new ArrowButtonWidget(Direction.RIGHT)
        wgt8.rect = new Rect(wgtx,wgty,24,24)
        this.widgets.push(wgt8)
        txt7 = new TextWidget()
        txt7.rect = new Rect(
            wgt7.rect.right() + 8,
            wgt7.rect.y - 2,
            wgt8.rect.left() - wgt7.rect.right() - 16,
            wgt7.rect.h + 4
        )
        txt7._text = "quality"
        txt7._alignment = Alignment.HCENTER|Alignment.TOP
        this.widgets.push(txt7)
        txt8 = new TextWidget()
        txt8.rect = new Rect(
            wgt7.rect.right() + 8,
            wgt7.rect.y - 8,
            wgt8.rect.left() - wgt7.rect.right() - 16,
            wgt7.rect.h + 16
        )
        txt8._text = this.profiles[this.profile_index].name
        txt8._alignment = Alignment.HCENTER|Alignment.BOTTOM
        this.widgets.push(txt8)

        wgt1.clicked = () => {
            this.client.latency_mean -= 5
            this.client.latency_mean = Math.max(25, Math.min(1000,this.client.latency_mean))
            this.client.latency_stddev = Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean)
            )
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt2.clicked = () => {
            this.client.latency_mean += 5
            this.client.latency_mean = Math.max(25, Math.min(1000,this.client.latency_mean))
            this.client.latency_stddev = Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean)
            )
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt3.clicked = () => {
            this.client.latency_stddev -= 5
            this.client.latency_stddev = Math.max(0, Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean)
            ))
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt4.clicked = () => {
            this.client.latency_stddev += 5
            this.client.latency_stddev = Math.max(0, Math.min(
                this.client.latency_stddev,
                Math.floor(this.client.latency_mean)
            ))
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt5.clicked = () => {
            this.client.packet_lossrate -= 0.01
            this.client.packet_lossrate = Math.max(0, Math.min(.20,
                this.client.packet_lossrate
            ))
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt6.clicked = () => {
            this.client.packet_lossrate += 0.01
            this.client.packet_lossrate = Math.max(0, Math.min(.20,
                this.client.packet_lossrate
            ))
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = "custom"
            this.profile_index = -1
        }
        wgt7.clicked = () => {
            this.profile_index -= 1
            if (this.profile_index < 0) {
                this.profile_index = this.profiles.length - 1
            }
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = profile.name
        }
        wgt8.clicked = () => {
            this.profile_index += 1
            if (this.profile_index >= this.profiles.length) {
                this.profile_index = 0
            }
            const profile = this.profiles[this.profile_index]
            this.client.latency_mean = profile.mean
            this.client.latency_stddev = profile.stddev
            this.client.packet_lossrate = profile.droprate
            txt2._text = this.client.latency_mean
            txt4._text = this.client.latency_stddev
            txt6._text = "" + Math.round(this.client.packet_lossrate*100) + "%"
            txt8._text = profile.name
        }


    }

    handleTouches(touches) {
        this.touch.handleTouches(touches)

        for (const wgt of this.widgets) {
            wgt.handleTouches(touches)
        }

    }

    handleKeyPress(keyevent) {
        this.keyboard.handleKeyPress(keyevent);
    }

    handleKeyRelease(keyevent) {
        this.keyboard.handleKeyRelease(keyevent);
    }

    resize() {

    }

    update(dt) {

        this.client.update(dt)

        if (!this.map.game_ready) {
            if (this.client.connected()) {

                this.map.game_ready = true
            }
            return
        }

        this.map.update(dt)

        for (const wgt of this.widgets) {
            wgt.update(dt)
        }


    }

    paint(ctx) {

        ctx.strokeStyle = "blue";
        ctx.beginPath()
        ctx.rect(0,0,gEngine.view.width, gEngine.view.height)
        ctx.stroke()

        this.map.paint(ctx)

        this.touch.paint(ctx)

        for (const wgt of this.widgets) {
            wgt.paint(ctx)
        }

    }
}


export default class Application extends ApplicationBase {
    constructor() {
        super({
            portrait: 0,
            fullscreen: 0
        }, () => {
            return new ResourceLoaderScene(() => {
                gEngine.scene = new DemoScene()
            })
        })


    }
}