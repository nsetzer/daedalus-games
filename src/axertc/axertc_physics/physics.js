
import {Direction, Rect} from "@axertc/axertc_common"
/*

https://medium.com/@brazmogu/physics-for-game-dev-a-platformer-physics-cheatsheet-f34b09064558

g = negative
position = 0.5*g*t*t + v'*t
speed = g*t + v'

initial velocity = sqrt(2*H*g)
283.3400783510868

gravity = H/(2t*t)
jumpspeed = - sqrt(2*H*g)

*/

export class Physics2dPlatform {

    static maprect = new Rect(0,0,0,0);

    constructor(target, config=null) {
        this.target = target
        this.group = () => []

        // state
        this.ninputs = 0
        this.frame_index = 0 // candidate for 'world state'
        this.direction = 0
        this.xspeed = 0
        this.yspeed = 0
        this.xaccum = 0
        this.yaccum = 0
        this.gravityboost = false // more gravity when button not pressed
        this.doublejump = false
        this.doublejump_position = {x:0, y: 0} // animation center
        this.doublejump_timer = 0 // for the animation duration


        // computed states
        this.action = "idle"
        this.facing = Direction.RIGHT

        // properties that are updated on every update()
        this.xcollide = false
        this.ycollide = false
        this.xcollisions = []
        this.ycollisions = []
        this.collide = false
        this.collisions = new Set()

        this.standing = false       //
        this.standing_frame = 0     // last frame standing on the ground
        this.pressing = false       //
        this.pressing_frame = 0     // last frame pressing on a wall
        this.pressing_direction = 1 // multiplier to wall jump in the opposite direction

        // if set true, running at full speed can cover small gaps
        this.enable_oneblock_walk = config?.oneblock_walk??false
        // if set to false, walking on slopes is not allowed, collide instead
        this.enable_slope_walk = config?.slope_walk??true

        // the duration that gives some specified maximum velocity v'
        //      t = sqrt(H^2 / v'^2)
        // gravity for some specified height and duration
        //      g = H / (2*t^2)
        // jump speed for a given height and gravity
        //      v' = sqrt(2 * H * g)
        // height for a given initial velocity
        //      v'^2 = 2*H*g

        // selecting a maximum speed of 8 pixels per frame, at 60 frames per second
        //      max speed = 8 PPF * 60 FPS = 480
        //      h = 128
        //      t = .2666

        // jump cancel
        // instead of messing with initial velocity and duration
        //      apply a a curve to the max speed
        // when the user releases the button rapidly drop the speed to zero over multiple frames
        // this will ensure the maximum height is as calculated
        // and that when the user releases, they will go a little higher and drop normally

        // two xaccelerations and two max speeds (1 and 1a)
        // quickly ramp up to the first max speed
        // slowly accelerate to the second max speed
        // allow for higher jumps and running over gaps at the second speed
        this.xmaxspeed1 = config?.xmaxspeed1??(7*32)  // from pressing buttons
        this.xmaxspeed1a = this.xmaxspeed1*(2/3)

        this.xmaxspeed2 = config?.xmaxspeed2??(14*32) // from other sources ?
        this.xfriction = this.xmaxspeed1 / .5 // stop moving in .1 seconds
        this.xacceleration = (this.xmaxspeed1a) / .2 // get up to max speed in .2 seconds
        this.xacceleration2 = (this.xmaxspeed1 - this.xmaxspeed1a) / 1

        // horizontal direction in a wall jump
        // TODO: after a wall jump friction does not apply to reduce the speed from xmaxspeed2 to xmaxspeed1
        this.xjumpspeed = Math.sqrt(3*32*this.xacceleration) // sqrt(2*distance*acceleration)
         // console.log("xspeeds", this.xmaxspeed1, this.xmaxspeed2, this.xjumpspeed, this.xacceleration)

        this.jumpheight = config?.jumpheight??(64 + 8)
        //this.jumpduration = .1875 // total duration divided by 4?
        this.jumpduration =  config?.jumpduration??(.22) // total duration divided by 4?

        if (config?.gravity===0) {
            this.gravity = 0
        } else {
            this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        }

        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)

        //const dt = 1/16
        //console.log("xspeeds", Math.trunc(this.xjumpspeed*dt), Math.trunc(this.xmaxspeed1*dt), Math.trunc(this.xmaxspeed2*dt))
        //console.log("yspeeds", Math.trunc(this.jumpspeed*dt))

        this.wallfriction = .2

        this.ymaxspeed = - this.jumpspeed
        this.checkbounds = true

        // log velocity over time
        //let speeds = []
        //let times = [0, .25, .5, .75, 1.0]
        //for (const t of times) {
        //    speeds.push(this.jumpspeed + this.gravity * 4 * this.jumpduration * t)
        //}
        //console.log("velocities", speeds)
    }

    collidePoint(x, y) {
        for (const ent of this.group()) {
            if ((!!ent.solid) && ent.rect.collidePoint(x, y)) {
                return ent
            }
        }
        return null
    }

    _move_x(solids, dx) {


        let rect = new Rect(
            this.target.rect.x + dx,
            this.target.rect.y,
            this.target.rect.w,
            this.target.rect.h,
        )

        let solid = false;
        for (const ent of solids) {
            if (rect.collideRect(ent.rect)) {

                if (ent.collide) {

                    const update = ent.collide(this.target, dx, 0)
                    if (update != null) {
                        //console.log(update)

                        let ndx = update.x - this.target.rect.x
                        let ndy = update.y - this.target.rect.y
                        this.xcollisions.push({ent, dx:ndx, dy: ndy, update})
                    }

                } else {
                    let ndx = dx
                    if (dx > 0 && this.target.rect.right() <= ent.rect.left()) {
                        ndx = Math.min(dx, ent.rect.left() - this.target.rect.right())
                    } else if (dx < 0 && this.target.rect.left() >= ent.rect.right()) {
                        ndx = Math.max(dx, ent.rect.right() - this.target.rect.left())
                    } else {
                        console.log("no x bonk")
                       // throw {message: "no x bonk"}
                    }

                    //console.log(ent.constructor.name) // wall or slope
                    this.xcollisions.push({ent, dx:ndx, dy: 0})
                }

            }
        }

        if (this.xcollisions.length > 0) {
            this.xcollisions.sort((a,b) => Math.abs(a.dx) - Math.abs(b.dx))

            return {dx: this.xcollisions[0].dx, dy: this.xcollisions[0].dy}

        }

        return null

    }

    _move_y(solids, dy) {


        let rect = new Rect(
            this.target.rect.x,
            this.target.rect.y + dy,
            this.target.rect.w,
            this.target.rect.h,
        )

        for (const ent of solids) {
            if (rect.collideRect(ent.rect)) {
                //console.log("y colllide with", ent.entid, ent.rect)

                if (ent.collide) {

                    const update = ent.collide(this.target, 0, dy)
                    if (update != null) {

                        let ndx = update.x - this.target.rect.x
                        let ndy = update.y - this.target.rect.y

                        this.ycollisions.push({ent, dx:ndx, dy: ndy})
                    }

                } else {

                    let ndy = dy

                    if (dy > 0 && this.target.rect.bottom() <= ent.rect.top()) {
                        //console.log("bonk b", xmoved, dy, this.target.rect.bottom(), ent.rect.top())
                        ndy = Math.min(dy, ent.rect.top() - this.target.rect.bottom())
                    } else if (dy < 0 && this.target.rect.top() >= ent.rect.bottom()) {
                        //
                        //console.log("bonk t", ent.entid, this.yspeed, xmoved, dy, this.target.rect.top(), ent.rect.bottom())
                        ndy = Math.max(dy, ent.rect.bottom() - 1 - this.target.rect.top())
                    } else {
                        console.log("no y bonk")
                        //throw {message: "no bonk"}
                    }

                    this.ycollisions.push({ent, dx:0, dy: ndy})
                }
            }
        }

        if (this.ycollisions.length > 0) {
            this.ycollisions.sort((a,b) => Math.abs(a.dy) - Math.abs(b.dy))
            return {dx: this.ycollisions[0].dx, dy: this.ycollisions[0].dy}
        }

        return null

    }

    update(dt) {
        this.frame_index += 1


        //const r1 = new Rect(489, 260, 16, 16)
        //const r2 = new Rect(489, 255, 16, 16)
        //const w1 = new Rect(480, 0, 32, 264)

        //throw {"message": "collision", c1: w1.collideRect(r1), c2: w1.collideRect(r2)}


        //console.log("frame index", this.frame_index, "ytop", this.target.rect.top())

        if (true) {
            /////////////////////////////////////////////////////////////
            // apply x acceleration

            if ((this.direction & Direction.LEFT) > 0) {
                this.facing = Direction.LEFT
                if (this.xspeed > -this.xmaxspeed1) {
                    if (this.xspeed > -this.xmaxspeed1a) {
                        this.xspeed -= this.xacceleration * dt
                    } else {
                        this.xspeed -= this.xacceleration2 * dt
                    }

                    //console.log(this.facing, this.xspeed)
                }
            } else if ((this.direction & Direction.RIGHT) > 0) {
                this.facing = Direction.RIGHT
                if (this.xspeed < this.xmaxspeed1) {
                    if (this.xspeed < this.xmaxspeed1a) {
                        this.xspeed += this.xacceleration * dt
                    } else {
                        this.xspeed += this.xacceleration2 * dt
                    }
                    //console.log(this.facing, this.xspeed)
                }
            } else /*if (this.standing)*/ {
                // apply friction while standing
                if (Math.abs(this.xspeed) < this.xfriction * dt) {
                    this.xspeed = 0
                } else {
                    this.xspeed -= Math.sign(this.xspeed) * this.xfriction * dt
                }
            }

            // bounds check x velocity
            if (this.xspeed > this.xmaxspeed2) {
                this.xspeed = this.xmaxspeed2
            }
            if (this.xspeed < -this.xmaxspeed2) {
                this.xspeed = -this.xmaxspeed2
            }

            /////////////////////////////////////////////////////////////
            // apply y acceleration
            //console.log(this.gravity, this.yspeed, dt, this.gravityboost)

            this.yspeed += this.gravity * dt

            // increase gravity when not pressing a jump button
            if (this.gravityboost && this.yspeed < 0) {
                this.yspeed += this.gravity * dt
            }

            // check for terminal velocity
            if (this.yspeed > this.ymaxspeed) {
                this.yspeed = this.ymaxspeed
            }

            // reduce speed when pressed on a wall?
            if (this.pressing && this.yspeed > 0) {
                if (this.yspeed > this.ymaxspeed*this.wallfriction) {
                    this.yspeed = this.ymaxspeed*this.wallfriction
                }
            }
        }

        /////////////////////////////////////////////////////////////
        // find nearby solid objects
        const solids = []
        if (true) {
            const rect = new Rect(
                this.target.rect.x - 32,
                this.target.rect.y - 32,
                this.target.rect.w + 64,
                this.target.rect.h + 64,
            )
            // rect.translate(8*Math.sign(this.xspeed), 8*Math.sign(this.yspeed))
            for (const ent of this.group()) {
                if ((!!ent.solid) && rect.collideRect(ent.rect)) {
                    solids.push(ent)
                }
            }
        } else {

            solids.push(...this.group())

        }

        this.xcollisions = []
        this.ycollisions = []

        let dx, dy;

        /////////////////////////////////////////////////////////////
        // move x
        this.xaccum += dt*this.xspeed
        dx = Math.trunc(this.xaccum)
        this.xaccum -= dx
        if (dx != 0) {

            const dd = this._move_x(solids, dx)

            if (dd != null) {
                // TODO: if y component is not valid do not move at all

                //console.log(dd.dx, dd.dy, this.xcollisions)
                if (this.enable_slope_walk) {
                    this.target.rect.x += dd.dx
                    this.target.rect.y += dd.dy
                    if (dd.dx != 0 || dd.dy != 0) {
                        this.xcollisions = []
                    }
                } else {
                    this.target.rect.x += dd.dx
                }

                //if (dd.dx == 0) {
                //    this.xspeed = 0
                //    this.xaccum= 0
                //}
            } else {
                this.target.rect.x += dx
            }
        }

        /////////////////////////////////////////////////////////////
        // move y (if was standing , try to move at most 8 pixels)
        // if there is no collision then dont bother
        // validate that yspeed >= 0 and was standing
        let standing = false

        if (this.standing && this.yspeed >= 0) {
            const dd = this._move_y(solids, 6)
            if (dd != null && dd.dy >= 0 && dd.dy <= 8) {
                this.target.rect.y += dd.dy
                //if (this.target.playerId=="player1") {console.error("set standing yspeed sticky");}
                standing = true
            }
        }

        /////////////////////////////////////////////////////////////
        // move y
        this.yaccum += dt*this.yspeed
        //console.log(this.target.entid, dt, this.yspeed, this.yaccum)
        dy = Math.trunc(this.yaccum)
        this.yaccum -= dy

        // if traveling at maximum speed, add an extra sensor infront
        // this sensor will prevent falling when there is a gap of 1
        if (this.enable_oneblock_walk) {
            let sensor_floorc = {x: this.target.rect.left() + 17, y: this.target.rect.bottom() + 1}
            let xpt = (this.xmaxspeed1 + this.xmaxspeed1a)/2
            if (dy > 0 && this.xcollisions.length == 0 && Math.abs(this.xspeed) > xpt) {
                for (const ent of solids) {
                    if (!standing && (ent.collidePoint(sensor_floorc.x, sensor_floorc.y))) {
                        dy = 0
                    }
                }
            }
        }

        if (dy != 0) {

            const dd = this._move_y(solids, dy)

            if (dd != null) {

                // TODO: if x component is not valid do not move at all

                //TODO: if the player was standing, can it move at most 8 pixels down and still be standing?
                this.target.rect.x += dd.dx
                this.target.rect.y += dd.dy

                if (this.yspeed < 0) {
                    this.yspeed = 0
                    this.yaccum = 0
                }

                if (this.yspeed > 0) {
                    //if (this.target.playerId=="player1") {console.error("set standing yspeed");}
                    standing = true
                    this.yspeed = 0
                    this.yaccum = 0
                }

            } else {



                this.target.rect.y += dy
            }
        }


        let sensor_floora = {x: this.target.rect.left(), y: this.target.rect.bottom() + 1}
        let sensor_floorb = {x: this.target.rect.right()-1, y: this.target.rect.bottom() + 1}



        let sensor_ceiling = {x: this.target.rect.cx(), y: this.target.rect.top() - 1}
        let sensor_pressing;
        if (this.facing == Direction.RIGHT) {
            sensor_pressing = {x: this.target.rect.right()+1, y: this.target.rect.cy()}
        } else {
            sensor_pressing = {x: this.target.rect.left()-1, y: this.target.rect.cy()}
        }

        let pressing = false
        for (const ent of solids) {

            //if (ent.collidePoint(sensor_ceiling.x, sensor_ceiling.y)) {
            //    // bonk
            //    if (this.yspeed < 0) {
            //        this.yspeed = 0
            //        this.yaccum = 0
            //    }
            //}

            if (!standing &&
                (ent.collidePoint(sensor_floora.x, sensor_floora.y) ||
                ent.collidePoint(sensor_floorb.x, sensor_floorb.y))
            ) {
                //if (!this.standing) {
                //    console.log("standing", this.target.rect, sensor_floora, sensor_floorb, this.target.rect.bottom(),
                //        ent.collidePoint(sensor_floora.x, sensor_floora.y),
                //        ent.collidePoint(sensor_floorb.x, sensor_floorb.y)
                //    )
                //}

                //if (this.target.playerId=="player1") {console.error("set standing solids");}
                standing = true
            }

            if (this.direction&Direction.LEFTRIGHT && ent.collidePoint(sensor_pressing.x, sensor_pressing.y)) {

                pressing = true
            }
        }

        this.collisions = [...this.xcollisions, ...this.ycollisions]

        this.xcollide = this.xcollisions.length > 0
        this.ycollide = this.ycollisions.length > 0

        /////////////////////////////////////////////////////////////
        // bounds check
        if (this.checkbounds && Physics2dPlatform.maprect.w > 0) {
            if (this.target.rect.x < Physics2dPlatform.maprect.x) {
                this.target.rect.x = Physics2dPlatform.maprect.x
                this.xspeed = 0
                this.xcollide = true
            }

            let maxx = Physics2dPlatform.maprect.w - this.target.rect.w
            if (this.target.rect.x > maxx) {
                this.target.rect.x = maxx
                this.xspeed = 0
                this.xcollide = true
            }

            // TODO: troid gutter
            if (this.target.rect.y < Physics2dPlatform.maprect.y - 96) {
                this.target.rect.y = Physics2dPlatform.maprect.y - 96
                this.yspeed = 0
                this.ycollide = true
            }

            let maxy = Physics2dPlatform.maprect.h - this.target.rect.h
            if (this.target.rect.y + 1 > maxy) {

                //if (this.target.playerId=="player1") {console.error("set standing bounds");}
                standing = true
                this.target.rect.y = maxy
                this.yspeed = 0
                this.ycollide = true
            }
        }

        this.collide = this.xcollide || this.ycollide

        //if (this.xcollide) {
        //    this.xspeed = 0
        //    this.xaccum = 0
        //}
        //if (this.ycollide) {
        //    this.yspeed = 0
        //    this.yaccum = 0
        //}

        /////////////////////////////////////////////////////////////
        // update state

        if (standing != this.standing) {
            this.standing = !!standing
            //console.log(`set standing=${standing}`)
        }

        if (this.standing) {
            this.standing_frame = this.frame_index
        }

        if (pressing != this.pressing) {
            this.pressing_direction = (this.facing == Direction.LEFT)?1:-1;
            this.pressing = pressing
            //console.log(`set pressing=${pressing}`)
        }
        if (this.pressing) {
            this.pressing_frame = this.frame_index
        }

        if (this.doublejump_timer > 0) {
            this.doublejump_timer -= dt
        }

        /////////////////////////////////////////////////////////////
        // update current action

        // double_jump
        // fall
        // hit
        // idle
        // jump
        // run
        // wall_slide

        let not_moving = this.direction == 0 && Math.abs(this.xspeed) < 30
        let falling = !this.standing && this.yspeed > 0
        let rising = this.yspeed < 0
        if (falling) {
            if (this.pressing) {
                this.action = "wall_slide"
            } else {
                this.action = "fall"
            }
        } else if (rising) {
            if (!this.doublejump) {
                this.action = "double_jump"
            } else {
                this.action = "jump"
            }
        } else if (not_moving) {
            this.action = "idle"
        } else {
            this.action = "run"
        }

    }

    getState() {
        const state = [
            this.target.rect.x,
            this.target.rect.y,
            this.direction,
            this.xspeed,
            this.yspeed,
            this.xaccum,
            this.yaccum,
            this.gravityboost,
            this.doublejump,
            this.doublejump_position,
            this.doublejump_timer,
            this.pressing,
            this.standing,
            this.facing,
        ]

        //const state = {
        //    x: this.target.rect.x,
        //    y: this.target.rect.y,
        //    //frame_index: this.frame_index,
        //    //clock: CspReceiver.instance.input_clock,
        //    direction: this.direction,
        //    xspeed: this.xspeed,
        //    yspeed: this.yspeed,
        //    xaccum: this.xaccum,
        //    yaccum: this.yaccum,
        //    gravityboost: this.gravityboost,
        //    doublejump: this.doublejump,
        //    doublejump_position: this.doublejump_position,
        //    doublejump_timer: this.doublejump_timer,
        //    pressing: this.pressing,
        //    standing: this.standing,
        //    facing: this.facing,
        //    //ninputs: this.ninputs,
        //}
        return state
    }

    setState(state) {

        //this.target.rect.x = state.x
        //this.target.rect.y = state.y
        //this.direction = state.direction
        //this.xspeed = state.xspeed
        //this.yspeed = state.yspeed
        //this.xaccum = state.xaccum
        //this.yaccum = state.yaccum
        //this.gravityboost = state.gravityboost
        //this.doublejump = state.doublejump
        //this.doublejump_position = state.doublejump_position
        //this.doublejump_timer = state.doublejump_timer
        //this.pressing = state.pressing
        //this.standing = state.standing
        //this.facing = state.facing
        [
            this.target.rect.x,
            this.target.rect.y,
            this.direction,
            this.xspeed,
            this.yspeed,
            this.xaccum,
            this.yaccum,
            this.gravityboost,
            this.doublejump,
            this.doublejump_position,
            this.doublejump_timer,
            this.pressing,
            this.standing,
            this.facing,
        ] = state
    }
}


export class Physics2dPlatformV2 {

    static maprect = new Rect(0,0,0,0);

    constructor(target, config=null) {
        this.target = target

        this.standing_direction = Direction.NONE
        this.moving_direction = Direction.NONE
        this.moving_speed = 90 // temporary FIXME
        this.next_rect = null

        this.vaccum = 0 // velocity accumulator

        // step_vector the direction considered up
        this._step_vector = {x: 0, y:0}
        this._init_gravity(config)
        this._init_lut()

        this.can_wallwalk = config?.wallwalk??false

        this.sensor_info = null

        this.speed = {x:0, y:0}
        this.accum = {x:0, y:0}
    }

    _init_gravity(config) {
        // the duration that gives some specified maximum velocity v'
        //      t = sqrt(H^2 / v'^2)
        // gravity for some specified height and duration
        //      g = H / (2*t^2)
        // jump speed for a given height and gravity
        //      v' = sqrt(2 * H * g)
        // height for a given initial velocity
        //      v'^2 = 2*H*g

        // selecting a maximum speed of 8 pixels per frame, at 60 frames per second
        //      max speed = 8 PPF * 60 FPS = 480
        //      h = 128
        //      t = .2666

        // jump cancel
        // instead of messing with initial velocity and duration
        //      apply a a curve to the max speed
        // when the user releases the button rapidly drop the speed to zero over multiple frames
        // this will ensure the maximum height is as calculated
        // and that when the user releases, they will go a little higher and drop normally

        // two xaccelerations and two max speeds (1 and 1a)
        // quickly ramp up to the first max speed
        // slowly accelerate to the second max speed
        // allow for higher jumps and running over gaps at the second speed
        this.xmaxspeed1 = config?.xmaxspeed1??(7*32)  // from pressing buttons
        this.xmaxspeed1a = this.xmaxspeed1*(2/3)

        this.xmaxspeed2 = config?.xmaxspeed2??(14*32) // from other sources ?
        this.xfriction = this.xmaxspeed1 / .5 // stop moving in .1 seconds
        this.xacceleration = (this.xmaxspeed1a) / .2 // get up to max speed in .2 seconds
        this.xacceleration2 = (this.xmaxspeed1 - this.xmaxspeed1a) / 1

        // horizontal direction in a wall jump
        // TODO: after a wall jump friction does not apply to reduce the speed from xmaxspeed2 to xmaxspeed1
        this.xjumpspeed = Math.sqrt(3*32*this.xacceleration) // sqrt(2*distance*acceleration)
         // console.log("xspeeds", this.xmaxspeed1, this.xmaxspeed2, this.xjumpspeed, this.xacceleration)

        this.jumpheight = config?.jumpheight??(64 + 8)
        //this.jumpduration = .1875 // total duration divided by 4?
        this.jumpduration =  config?.jumpduration??(.22) // total duration divided by 4?

        if (config?.gravity===0) {
            this.gravity = 0
        } else {
            this.gravity = this.jumpheight / (2*this.jumpduration*this.jumpduration)
        }

        this.jumpspeed = - Math.sqrt(2*this.jumpheight*this.gravity)

        //const dt = 1/16
        //console.log("xspeeds", Math.trunc(this.xjumpspeed*dt), Math.trunc(this.xmaxspeed1*dt), Math.trunc(this.xmaxspeed2*dt))
        //console.log("yspeeds", Math.trunc(this.jumpspeed*dt))

        this.wallfriction = .2

        this.ymaxspeed = - this.jumpspeed
    }

    _update_neighborhood() {
        let rect = this.target.rect
        this._neighborhood = new Rect(rect.x - 8, rect.y - 8, rect.w + 16, rect.h + 16);
        this._neighbors = this.group().filter(ent => ent.rect.collideRect(this._neighborhood))
    }

    _init_step() {
        // run this test every couple frames when falling
        let rect = this.target.rect
        let sensor_u = {x: rect.cx(),       y: rect.top() - 1}
        let sensor_d = {x: rect.cx(),       y: rect.bottom()}
        let sensor_l = {x: rect.left() - 1, y: rect.cy()}
        let sensor_r = {x: rect.right(),    y: rect.cy()}

        let collide_u = false;
        let collide_d = false;
        let collide_l = false;
        let collide_r = false;

        this._neighbors.forEach(ent => {
            if (ent.collidePoint(sensor_u.x, sensor_u.y)) { collide_u = true }
            if (ent.collidePoint(sensor_d.x, sensor_d.y)) { collide_d = true }
            if (ent.collidePoint(sensor_l.x, sensor_l.y)) { collide_l = true }
            if (ent.collidePoint(sensor_r.x, sensor_r.y)) { collide_r = true }
        })

        if (collide_d) {
            this.standing_direction = Direction.DOWN
        } else if (collide_u) {
            this.standing_direction = Direction.UP
        } else if (collide_l) {
            this.standing_direction = Direction.LEFT
        } else if (collide_r) {
            this.standing_direction = Direction.RIGHT
        } else {
            // falling
            this.standing_direction = Direction.DOWN
        }
    }

    _init_lut() {
                // clockwise A or counterclockwise B
        // the next moving direction in a sequence
        // and the amount to add or subtract
        // A: RIGHT, DOWN, LEFT, UP
        //   xy: ++, -+, --, +-,
        // B: LEFT, DOWN, RIGHT, UP
        //   xy: -+, ++, +-, --

        // transition table for [standing][moving]
        // no overlap between the two
        // clockwise
        // dr : ld
        // ld : ul
        // ul : ru
        // ru : dr
        // counter clockwise
        // dl : rd
        // rd : ur
        // ur : lu
        // lu : dl
        let hw = Math.floor(this.target.rect.w/2)
        let hh = Math.floor(this.target.rect.h/2)

        // look up table for walking off a cliff, which changes the standing direction

        /*
        rotate 2 translation matrix

        [ cos() -sin()] :: [0 -1] :: [0 1]
        [ sin()  cos()] :: [1  0] :: [1 0]

        // clockwise
        // (-1,  0) -> ( 0, -1)
        // ( 0, -1) -> ( 1,  0)
        // ( 1,  0) -> ( 0,  1)
        // ( 0,  1) -> (-1,  0)

        // counter-clockwise
        // (-1,  0) -> ( 0,  1)
        // ( 0, -1) -> (-1,  0)
        // ( 1,  0) -> ( 0, -1)
        // ( 0,  1) -> ( 1,  0)
        */

        let lut2 = {}
        lut2[Direction.DOWN ] = {}
        lut2[Direction.LEFT ] = {}
        lut2[Direction.UP   ] = {}
        lut2[Direction.RIGHT] = {}

        // clockwise [standing][moving]

        lut2[Direction.UP   ][Direction.LEFT ] = {standing: Direction.RIGHT, moving: Direction.UP   ,x:-(hw+0),y:-(hh+2)}
        lut2[Direction.RIGHT][Direction.UP   ] = {standing: Direction.DOWN , moving: Direction.RIGHT,x:+(hw+2),y:-(hh+0)}
        lut2[Direction.DOWN ][Direction.RIGHT] = {standing: Direction.LEFT , moving: Direction.DOWN ,x:+(hw+1),y:+(hh+2)}
        lut2[Direction.LEFT ][Direction.DOWN ] = {standing: Direction.UP   , moving: Direction.LEFT ,x:-(hw+2),y:+(hh+1)}

        // counter-clockwise [standing][moving]
        lut2[Direction.UP   ][Direction.RIGHT] = {standing: Direction.LEFT , moving: Direction.UP   ,x:+(hw+1),y:-(hh+2)}
        lut2[Direction.RIGHT][Direction.DOWN ] = {standing: Direction.UP   , moving: Direction.RIGHT,x:+(hw+2),y:+(hh+1)}
        lut2[Direction.DOWN ][Direction.LEFT ] = {standing: Direction.RIGHT, moving: Direction.DOWN ,x:-(hw+0),y:+(hh+2)}
        lut2[Direction.LEFT ][Direction.UP   ] = {standing: Direction.DOWN , moving: Direction.LEFT ,x:-(hw+2),y:-(hh+0)}

        // look up table for walking up a wall, which changes the standing direction
        //let lut3 = [
        //    [{standing: Direction.UP   ,moving: Direction.LEFT }, {standing: Direction.LEFT  , moving: Direction.DOWN ,x:0,y:0}],
        //    [{standing: Direction.RIGHT,moving: Direction.UP   }, {standing: Direction.UP    , moving: Direction.LEFT ,x:0,y:0}],
        //    [{standing: Direction.DOWN ,moving: Direction.RIGHT}, {standing: Direction.RIGHT , moving: Direction.UP   ,x:0,y:0}],
        //    [{standing: Direction.LEFT ,moving: Direction.DOWN }, {standing: Direction.DOWN  , moving: Direction.RIGHT,x:0,y:0}],
        //    [{standing: Direction.UP   ,moving: Direction.RIGHT}, {standing: Direction.RIGHT , moving: Direction.DOWN ,x:0,y:0}],
        //    [{standing: Direction.RIGHT,moving: Direction.DOWN }, {standing: Direction.DOWN  , moving: Direction.LEFT ,x:0,y:0}],
        //    [{standing: Direction.DOWN ,moving: Direction.LEFT }, {standing: Direction.LEFT  , moving: Direction.UP   ,x:0,y:0}],
        //    [{standing: Direction.LEFT ,moving: Direction.UP   }, {standing: Direction.UP    , moving: Direction.RIGHT,x:0,y:0}],
        //]

        let lut3 = {}
        lut3[Direction.DOWN ] = {}
        lut3[Direction.LEFT ] = {}
        lut3[Direction.UP   ] = {}
        lut3[Direction.RIGHT] = {}

        // clockwise [standing][moving]
        lut3[Direction.UP   ][Direction.LEFT ] = {standing: Direction.LEFT  , moving: Direction.DOWN ,x:0,y:0}
        lut3[Direction.RIGHT][Direction.UP   ] = {standing: Direction.UP    , moving: Direction.LEFT ,x:0,y:0}
        lut3[Direction.DOWN ][Direction.RIGHT] = {standing: Direction.RIGHT , moving: Direction.UP   ,x:0,y:0}
        lut3[Direction.LEFT ][Direction.DOWN ] = {standing: Direction.DOWN  , moving: Direction.RIGHT,x:0,y:0}

        // counter-clockwise [standing][moving]
        lut3[Direction.UP   ][Direction.RIGHT] = {standing: Direction.RIGHT , moving: Direction.DOWN ,x:0,y:0}
        lut3[Direction.RIGHT][Direction.DOWN ] = {standing: Direction.DOWN  , moving: Direction.LEFT ,x:0,y:0}
        lut3[Direction.DOWN ][Direction.LEFT ] = {standing: Direction.LEFT  , moving: Direction.UP   ,x:0,y:0}
        lut3[Direction.LEFT ][Direction.UP   ] = {standing: Direction.UP    , moving: Direction.RIGHT,x:0,y:0}

        this._lut_rotate_2 = lut2
        this._lut_rotate_3 = lut3


        this._lut_step = {
            [Direction.UP   ]: {x: 0, y: 1},
            [Direction.DOWN ]: {x: 0, y:-1},
            [Direction.LEFT ]: {x: 1, y: 0},
            [Direction.RIGHT]: {x:-1, y: 0},
        }

        this._mask_movement = {
            [Direction.UP   ]: Direction.LEFTRIGHT,
            [Direction.DOWN ]: Direction.LEFTRIGHT,
            [Direction.LEFT ]: Direction.UPDOWN,
            [Direction.RIGHT]: Direction.UPDOWN,
        }
    }

    _step_get_sensors(dx, dy) {

        let sensor_u = {x: this.target.rect.cx(),       y: this.target.rect.top() - 1}
        let sensor_d = {x: this.target.rect.cx(),       y: this.target.rect.bottom()}
        let sensor_l = {x: this.target.rect.left() - 1, y: this.target.rect.cy()}
        let sensor_r = {x: this.target.rect.right(),    y: this.target.rect.cy()}

        //const mdir = this.moving_direction
        const mdir = Direction.fromVector(dx, dy)

        if (mdir == Direction.RIGHT) {sensor_r.x -= 1}
        if (mdir == Direction.LEFT ) {sensor_l.x += 1}
        if (mdir == Direction.UP   ) {sensor_u.y += 1}
        if (mdir == Direction.DOWN ) {sensor_d.y -= 1}

        let sensor_next_u = {x: sensor_u.x+dx, y: sensor_u.y+dy}
        let sensor_next_d = {x: sensor_d.x+dx, y: sensor_d.y+dy}
        let sensor_next_l = {x: sensor_l.x+dx, y: sensor_l.y+dy}
        let sensor_next_r = {x: sensor_r.x+dx, y: sensor_r.y+dy}

        let sns = null;
        if (this.standing_direction == Direction.UP)    { sns=sensor_u }
        if (this.standing_direction == Direction.DOWN)  { sns=sensor_d }
        if (this.standing_direction == Direction.LEFT)  { sns=sensor_l }
        if (this.standing_direction == Direction.RIGHT) { sns=sensor_r }

        // which direction to 'step up'
        let step = this._lut_step[this.standing_direction]

        // can step up to solid
        let sensor_s1 = {x: sns.x + dx + 1*step.x, y: sns.y + dy + 1*step.y};
        let sensor_s2 = {x: sns.x + dx + 2*step.x, y: sns.y + dy + 2*step.y};

        // can step down to solid
        let sensor_g1 = {x: sns.x + dx - 1*step.x, y: sns.y + dy - 1*step.y};

        let d_sensor = {
            [Direction.RIGHT]: sensor_r,
            [Direction.DOWN]:  sensor_d,
            [Direction.LEFT]:  sensor_l,
            [Direction.UP]:    sensor_u,
        }

        let d_sensor_next = {
            [Direction.RIGHT]: sensor_next_r,
            [Direction.DOWN]:  sensor_next_d,
            [Direction.LEFT]:  sensor_next_l,
            [Direction.UP]:    sensor_next_u,
        }

        // build a table for checking collisions on :
        // t: the top / head of the entity
        // f: the front / leading direction
        // b: the bottom / foot of the entity
        let lut = {}

        switch (mdir) {
            case Direction.RIGHT:
                lut.f = Direction.RIGHT
                break;
            case Direction.DOWN:
                lut.f = Direction.DOWN
                break;
            case Direction.LEFT:
                lut.f = Direction.LEFT
                break;
            case Direction.UP:
                lut.f = Direction.UP
                break;
        }

        switch (this.standing_direction) {
            case Direction.RIGHT:
                lut.t = Direction.LEFT
                lut.b = Direction.RIGHT
                break;
            case Direction.DOWN:
                lut.t = Direction.UP
                lut.b = Direction.DOWN
                break;
            case Direction.LEFT:
                lut.t = Direction.RIGHT
                lut.b = Direction.LEFT
                break;
            case Direction.UP:
                lut.t = Direction.DOWN
                lut.b = Direction.UP
                break;
        }

        return {
            "f": d_sensor[lut.f],
            "t": d_sensor[lut.t],
            "b": d_sensor[lut.b],

            "fn": d_sensor_next[lut.f],
            "tn": d_sensor_next[lut.t],
            "bn": d_sensor_next[lut.b],

            "s1": sensor_s1,
            "s2": sensor_s2,
            "g1": sensor_g1,
        }
    }

    _step(sensors, dx, dy) {
        // returns a number representing the amount of velocity units consumed
        // e.g. if a step was taken on an axis, this returns 1
        //      if a step was taken on a diagonal, this returns sqrt(2)
        // 45 degree slopes consume 1.4 on every step
        // while 30 degree slopes alternate between 1 and 1.4
        // meaning there is a speed reduction of 40 % on 45 degree slopes
        // and a speed reduction of 20 % on 30 degree slopes

        // Note: The code below assumes that a rectangle is (x, y, w, h)
        //       the right edge is x + w - 1
        //       the bottom edge is y + h - 1
        //       The current rectangle class returns right = x + w

        const collisions = {
            f: false,
            t: false,
            b: false,
            fn: false,
            tn: false,
            bn: false,
            s1: false,
            s2: false,
            g1: false,
        }

        this._neighbors.forEach(ent => {
            if (ent.entid == this.entid) { return }

            // TODO: a potentail optimization is to store the collision data in the class
            // if a sensor has collided, there is no reason to run that test again

            if (ent.collidePoint(sensors.f.x, sensors.f.y)) { collisions.f = true }
            if (ent.collidePoint(sensors.t.x, sensors.t.y)) { collisions.t = true }
            if (ent.collidePoint(sensors.b.x, sensors.b.y)) { collisions.b = true }

            if (ent.collidePoint(sensors.fn.x, sensors.fn.y)) { collisions.fn = true }
            if (ent.collidePoint(sensors.tn.x, sensors.tn.y)) { collisions.tn = true }
            if (ent.collidePoint(sensors.bn.x, sensors.bn.y)) { collisions.bn = true }

            if (ent.collidePoint(sensors.s1.x, sensors.s1.y)) { collisions.s1 = true }
            if (ent.collidePoint(sensors.s2.x, sensors.s2.y)) { collisions.s2 = true }
            if (ent.collidePoint(sensors.g1.x, sensors.g1.y)) { collisions.g1 = true }

        })

        let step = this._lut_step[this.standing_direction]

        this.sensor_info = {sensors, collisions} // for painting

        //this._collisions = collisions

        //this.trails[0].push({...d_sensor[this.standing_direction], c:d_collide_next[this.standing_direction]})
        //this.trails[1].push({...sensor_s1, c:collide_next_s1})
        //this.trails[2].push({...sensor_s2, c:collide_next_s2})

        //while (this.trails[0].length > 48) { this.trails[0].shift() }
        //while (this.trails[1].length > 48) { this.trails[1].shift() }
        //while (this.trails[2].length > 48) { this.trails[2].shift() }

        let bonk =  collisions.t || collisions.fn || collisions.tn
        let standing = collisions.b

        if (standing && !bonk && collisions.s1 && !collisions.s2) {
            // TODO: only step up on even frames otherwise don't move?
            //       to simulate slowly going up hill?
            //if (gEngine.frameIndex%2==1) {
            //    return
            //}
            //console.log("step up")
            this.target.rect.x += step.x + dx
            this.target.rect.y += step.y + dy
            return 1.4

        // if standing, front and head will not collide, step forward
        }

        if (standing && !bonk && !collisions.bn && collisions.g1) {
            //if ((gEngine.frameIndex%2)==1) {
            //    return
            //}
            //console.log("step dn", gEngine.frameIndex)
            this.target.rect.x += -step.x + dx
            this.target.rect.y += -step.y + dy
            return 1.4
        }

        if ((standing && !bonk && collisions.bn) || (!standing && !bonk)) {
            // step in the forward direction
            //console.log("step fd")
            this.target.rect.x += dx
            this.target.rect.y += dy
            return 1
        }

        // todo check if next rect is valid
        if (this.can_wallwalk && standing && !collisions.bn && !collisions.t) {
            //console.log("rotate 2")
            //move to walk off the 'cliff'
            // it's a cliff from the perspective of the current downwards direction

            //let ta, tmp
            //for (let i=0; i < lut2.length; i++) {
            //    [ta,tmp] = lut2[i]
            //    if (ta.standing == this.standing_direction && ta.moving == this.moving_direction) {
            //        break
            //    }
            //}
            let tmp = this._lut_rotate_2[this.standing_direction][this.moving_direction]

            //console.log("standing", Direction.name[this.standing_direction], "to", Direction.name[tmp.standing])
            //console.log("moving", Direction.name[this.moving_direction], "to", Direction.name[tmp.moving])
            this.moving_direction = tmp.moving
            this.standing_direction = tmp.standing
            // todo round the edge cooresponding the the standing direction
            // in order to support objects that are not square and 16x16
            //let x1 = this.target.rect.cx()
            //let y1 = this.target.rect.cy()
            let next_rect = new Rect(
                this.target.rect.x + tmp.x, // Math.round((this.rect.x + tmp.x)/8)*8,
                this.target.rect.y + tmp.y, // Math.round((this.rect.y + tmp.y)/8)*8,
                this.target.rect.w,
                this.target.rect.h
            )

            // probably need to do 4 tests
            //neighbors.forEach(ent => {
            //    if (ent.entid == this.entid) { return }
            //
            //    if (ent.collidePoint(p.x, p.y)) { collide = true}
            //}

            this.next_rect = next_rect

            //this.rect.x += dx
            //this.rect.y += dy
            //v = Direction.vector(this.moving_direction)
            //dx = v.x;
            //dy = v.y;
            //this.rect.x += dx
            //this.rect.y += dy

            //this.rect.x = nextrect.x
            //this.rect.y = nextrect.y

            let x2 = this.target.rect.cx()
            let y2 = this.target.rect.cy()
            //console.log("delta", tmp, Math.abs(x2-x1), Math.abs(y2-y2))

            return 0
        }

        // todo check if next rect is valid
        if (this.can_wallwalk && standing && collisions.bn && !collisions.t && collisions.fn) {

            // move to walk up a 'wall'
            // it's a wall from the perspective of the current downwards direction
            //let ta, tmp
            //for (let i=0; i < lut3.length; i++) {
            //    [ta,tmp] = lut3[i]
            //    if (ta.standing == this.standing_direction && ta.moving == this.moving_direction) {
            //        break
            //    }
            //}
            let tmp = this._lut_rotate_3[this.standing_direction][this.moving_direction]

            //console.log("rotate 3",
            //    "standing", Direction.name[this.standing_direction], "to", Direction.name[tmp.standing],
            //    "moving", Direction.name[this.moving_direction], "to", Direction.name[tmp.moving]
            //    )

            this.moving_direction = tmp.moving
            this.standing_direction = tmp.standing

            let next_rect = new Rect(
                this.target.rect.x + tmp.x, // Math.round((this.rect.x + tmp.x + dx)/8)*8,
                this.target.rect.y + tmp.y, // Math.round((this.rect.y + tmp.y + dy)/8)*8,
                this.target.rect.w,
                this.target.rect.h
            )

            this.target.rect.x = next_rect.x
            this.target.rect.y = next_rect.y

            // todo round the edge cooresponding the the standing direction
            // in order to support objects that are not square and 16x16

            return 1
        }

        if (!this.can_wallwalk) {
            return 1
        }

        //if (!d_collide[lut.b]) {
        //    this.rect.x += -step.x
        //    this.rect.y += -step.y
        //    return 1
        //}

        //this.sns_points = {
        //    "standing": d_sensor[this.standing_direction],
        //    "standing_next": d_sensor_next[this.standing_direction],
        //    "step_up": sensor_s1,
        //    "step_dn": sensor_g1,
        //}
        //this.sns_result = {
        //    "standing": d_collide[this.standing_direction],
        //    "standing_next": d_collide_next[this.standing_direction],
        //    "step_up": collide_next_s1,
        //    "step_dn": collide_next_g1,
        //}
        //let dbgs = ""
        //dbgs += `d=${Direction.name[this.standing_direction]}`
        //dbgs += ` st=${this.sns_points['standing'].x},${this.sns_points['standing'].y}=${this.sns_result['standing']}`
        //dbgs += ` stn=${this.sns_points['standing_next'].x},${this.sns_points['standing_next'].y}=${this.sns_result['standing_next']}`
        //dbgs += ` step_up=${this.sns_points['step_up'].x},${this.sns_points['step_up'].y}=${collide_next_s1}+${collide_next_s2}`
        //dbgs += ` step_dn=${this.sns_points['step_dn'].x},${this.sns_points['step_dn'].y}=${collide_next_g1}`
        //dbgs += ` t=${d_collide_next[lut.t]} f=${d_collide_next[lut.f]}`
        //console.log(dbgs)
        if (!standing) {
            return 1
        }

        throw {
            "error": "error",
            dx, dy, next: this.next_rect, standing, bonk,
            standing: Direction.name[this.standing_direction],
            moving: Direction.name[this.moving_direction],
            sensors,
            collisions}
    }

    _step_target() {
        // when walking off a cliff, change the standing direction
        // this handles translating from one wall to another

        let dx = this.target.rect.x - this.next_rect.x
        let dy = this.target.rect.y - this.next_rect.y

        let v = 0
        if (dx < 0) {
            this.target.rect.x += 1
            v += 1
        } else if (dx > 0) {
            this.target.rect.x -= 1
            v += 1
        }

        if (dy < 0) {
            this.target.rect.y += 1
            v += 1
        } else if (dy > 0) {
            this.target.rect.y -= 1
            v += 1
        }

        if (dx != 0 || dy != 0) {
            // consume 1.4 velocity units because it traveled on a diagonal
            return v==2?1.4:1
        }
        if (dx == 0 && dy ==0) {
            this.next_rect = null
        }

        return 0
    }

    update(dt) {

        this._update_neighborhood()

        // if standing and velocity is greater than zero, take a step
        // use velocity and direction separate values instead of
        // using a walking vector. this way a user can press 'forward'
        // but if the standing direction changes, 'forward' does not change
        // velocity desides how often step gets called

        // todo: refactor sensors
        //  function to build b,f,t,nb,nf,nt,s1,s2,g1 (maybe rename b,f,t,nb,nf,nt,u1,u2,d1)
        //  first pass: test if standing (only sensor b)
        //  maybe _step should accept a velocity dx,dy

        if (this.standing_direction === Direction.NONE) {
            this._init_step()
        }

        let sensors = this._step_get_sensors(0, 0)
        let collisions = {}

        this._neighbors.forEach(ent => {
        if (ent.entid == this.entid) { return }
            if (ent.collidePoint(sensors.b.x, sensors.b.y)) { collisions.b = true }
            //if (ent.collidePoint(sensors.bn.x, sensors.bn.y)) { collisions.bn = true }
            if (ent.collidePoint(sensors.t.x, sensors.t.y)) { collisions.t = true }
        })

        // check if not standing and apply gravity
        if (!collisions.b && this.next_rect === null) {
            // fall / jump

            let step = this._lut_step[this.standing_direction]

            let gforce = this.gravity * dt

            this.speed.x += -step.x*gforce
            this.speed.y += -step.y*gforce

        } else {
            //let step = this._lut_step[this.standing_direction]
            //this.speed.x *= (1-Math.abs(step.x))
            //this.speed.y *= (1-Math.abs(step.y))
            if (this.standing_direction == Direction.DOWN  && this.speed.y > 0) { this.speed.y = 0 }
            if (this.standing_direction == Direction.UP    && this.speed.y < 0) { this.speed.y = 0 }
            if (this.standing_direction == Direction.LEFT  && this.speed.x < 0) { this.speed.x = 0 }
            if (this.standing_direction == Direction.RIGHT && this.speed.x > 0) { this.speed.x = 0 }

        }
        this.accum.x += dt * this.speed.x
        this.accum.y += dt * this.speed.y

        if (this._mask_movement[this.standing_direction]&this.moving_direction) {
            let v = Direction.vector(this.moving_direction)
            this.accum.x += dt * this.moving_speed * v.x
            this.accum.y += dt * this.moving_speed * v.y
        }

        let sym = (this.standing_direction&Direction.UPDOWN)?{h:"x", v:"y"}:{h:"y", v:"x"}

        // horizontal step

        if (false && this.next_rect !== null) {
            // FIXME: take step towards target at fixed rate
            // can this be fixed to allow reversing direction while transitioning?
            // current fix is to disable jumping while transitioning
            // k = this._step_target()
        }

        if (true) {

            let dx = Math.trunc(this.accum[sym.h])
            let n = Math.abs(dx)
            let s = Math.sign(dx)

            let v = {}
            let sdir = this.standing_direction
            v.x = (this.standing_direction&Direction.UPDOWN)?s:0;
            v.y = (this.standing_direction&Direction.UPDOWN)?0:s;
            let k

            while (n > 0) {


                if (this.next_rect !== null) {
                    k = this._step_target()
                    this.accum[sym.h] -= s*k
                    n -= k
                } else {
                    let sensors = this._step_get_sensors(v.x, v.y)
                    if (!sensors.f) {
                        console.error(Direction.name[this.moving_direction])
                        console.error(sensors, v.x, v.y)
                        throw 0
                    }
                    k = this._step(sensors, v.x, v.y)
                    this.accum[sym.h] -= s*k
                    n -= k

                    if (sdir != this.standing_direction) {
                        this.accum.x = 0
                        this.accum.y = 0
                        this.speed.x = 0
                        this.speed.y = 0
                        // TODO: figure out the rotation to keep going
                        // e.g. standing up to standing left is a 90 degree rotation
                        //      the vector (-1, 0) becomes (0, 1)
                        // the question is: does the accumulation vector also rotate?
                        break;
                    }
                }


            }
        }

        // vertical step

        if (true  && this.next_rect === null) {
            let dy = Math.trunc(this.accum[sym.v])
            let n = Math.abs(dy)
            let s = Math.sign(dy)
            this.accum[sym.v] -= dy

            while (n > 0) {
                if (this.standing_direction == Direction.RIGHT && s > 0 && collisions.b) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }
                if (this.standing_direction == Direction.RIGHT && s < 0 && collisions.t) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }

                if (this.standing_direction == Direction.LEFT  && s < 0 && collisions.b) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }
                if (this.standing_direction == Direction.LEFT  && s > 0 && collisions.t) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }

                if (this.standing_direction == Direction.DOWN  && s > 0 && collisions.b) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }
                if (this.standing_direction == Direction.DOWN  && s < 0 && collisions.t) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }

                if (this.standing_direction == Direction.UP    && s < 0 && collisions.b) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }
                if (this.standing_direction == Direction.UP    && s > 0 && collisions.t) { this.accum[sym.v] = 0; this.speed[sym.v] = 0; break; }

                this.target.rect[sym.v] += s
                n -= 1
                let sensors = this._step_get_sensors(0, 0)
                // check if standing again
                this._neighbors.forEach(ent => {
                    if (ent.entid == this.entid) { return }
                    if (ent.collidePoint(sensors.b.x, sensors.b.y)) { collisions.b = true }
                    //if (ent.collidePoint(sensors.bn.x, sensors.bn.y)) { collisions.bn = true }
                    if (ent.collidePoint(sensors.t.x, sensors.t.y)) { collisions.t = true }
                })
            }
        }

    }

    paint(ctx) {

        if (!!this.sensor_info && !this.next_rect) {
            const sensors = this.sensor_info.sensors
            const collisions = this.sensor_info.collisions
            ctx.beginPath()
            ctx.fillStyle = "#FF0000"
            ctx.lineWidth = 1
            ctx.rect(sensors.f.x, sensors.f.y, 1, 1)
            ctx.rect(sensors.t.x, sensors.t.y, 1, 1)
            ctx.rect(sensors.b.x, sensors.b.y, 1, 1)
            //ctx.rect(sensors.bn.x, sensors.bn.y, 1, 1)
            //ctx.rect(sensors.g1.x, sensors.g1.y, 1, 1)
            ctx.closePath()
            ctx.fill();

            //ctx.beginPath()
            //ctx.fillStyle = "#FF00FF"
            //ctx.lineWidth = 1
            //ctx.rect(sensors.s1.x, sensors.s1.y, 1, 1)
            //ctx.rect(sensors.s2.x, sensors.s2.y, 1, 1)
            //ctx.rect(sensors.g1.x, sensors.g1.y, 1, 1)
            //ctx.closePath()
            //ctx.fill();

        }


    }
}

//Physics2dPlatform.maprect = new Rect(0,0,0,0)
