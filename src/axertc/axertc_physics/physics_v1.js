
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
        this.speed = {x:0, y:0}
        this.accum = {x:0, y:0}
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
                        //console.log("no x bonk")
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
                        //console.log("bonk t", ent.entid, this.speed.y, xmoved, dy, this.target.rect.top(), ent.rect.bottom())
                        ndy = Math.max(dy, ent.rect.bottom() - 1 - this.target.rect.top())
                    } else {
                        //console.log("no y bonk")
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

    is_rising() {
        // return true if the velocity suggests moving away from the floor
        let rising = this.speed.y < 0
        return rising
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
                if (this.speed.x > -this.xmaxspeed1) {
                    if (this.speed.x > -this.xmaxspeed1a) {
                        this.speed.x -= this.xacceleration * dt
                    } else {
                        this.speed.x -= this.xacceleration2 * dt
                    }

                    //console.log(this.facing, this.speed.x)
                }
            } else if ((this.direction & Direction.RIGHT) > 0) {
                this.facing = Direction.RIGHT
                if (this.speed.x < this.xmaxspeed1) {
                    if (this.speed.x < this.xmaxspeed1a) {
                        this.speed.x += this.xacceleration * dt
                    } else {
                        this.speed.x += this.xacceleration2 * dt
                    }
                    //console.log(this.facing, this.speed.x)
                }
            } else /*if (this.standing)*/ {
                // apply friction while standing
                if (Math.abs(this.speed.x) < this.xfriction * dt) {
                    this.speed.x = 0
                } else {
                    this.speed.x -= Math.sign(this.speed.x) * this.xfriction * dt
                }
            }

            // bounds check x velocity
            if (this.speed.x > this.xmaxspeed2) {
                this.speed.x = this.xmaxspeed2
            }
            if (this.speed.x < -this.xmaxspeed2) {
                this.speed.x = -this.xmaxspeed2
            }

            /////////////////////////////////////////////////////////////
            // apply y acceleration
            //console.log(this.gravity, this.speed.y, dt, this.gravityboost)

            this.speed.y += this.gravity * dt

            // increase gravity when not pressing a jump button
            if (this.gravityboost && this.speed.y < 0) {
                this.speed.y += this.gravity * dt
            }

            // check for terminal velocity
            if (this.speed.y > this.ymaxspeed) {
                this.speed.y = this.ymaxspeed
            }

            // reduce speed when pressed on a wall?
            if (this.pressing && this.speed.y > 0) {
                if (this.speed.y > this.ymaxspeed*this.wallfriction) {
                    this.speed.y = this.ymaxspeed*this.wallfriction
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
            // rect.translate(8*Math.sign(this.speed.x), 8*Math.sign(this.speed.y))
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
        this.accum.x += dt*this.speed.x
        dx = Math.trunc(this.accum.x)
        this.accum.x -= dx
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
                //    this.speed.x = 0
                //    this.accum.x= 0
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

        if (this.standing && this.speed.y >= 0) {
            const dd = this._move_y(solids, 6)
            if (dd != null && dd.dy >= 0 && dd.dy <= 8) {
                this.target.rect.y += dd.dy
                //if (this.target.playerId=="player1") {console.error("set standing yspeed sticky");}
                standing = true
            }
        }

        /////////////////////////////////////////////////////////////
        // move y
        this.accum.y += dt*this.speed.y
        //console.log(this.target.entid, dt, this.speed.y, this.accum.y)
        dy = Math.trunc(this.accum.y)
        this.accum.y -= dy

        // if traveling at maximum speed, add an extra sensor infront
        // this sensor will prevent falling when there is a gap of 1
        if (this.enable_oneblock_walk) {
            let sensor_floorc = {x: this.target.rect.left() + 17, y: this.target.rect.bottom() + 1}
            let xpt = (this.xmaxspeed1 + this.xmaxspeed1a)/2
            if (dy > 0 && this.xcollisions.length == 0 && Math.abs(this.speed.x) > xpt) {
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

                if (this.speed.y < 0) {
                    this.speed.y = 0
                    this.accum.y = 0
                }

                if (this.speed.y > 0) {
                    //if (this.target.playerId=="player1") {console.error("set standing yspeed");}
                    standing = true
                    this.speed.y = 0
                    this.accum.y = 0
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
            //    if (this.speed.y < 0) {
            //        this.speed.y = 0
            //        this.accum.y = 0
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
                this.speed.x = 0
                this.xcollide = true
            }

            let maxx = Physics2dPlatform.maprect.w - this.target.rect.w
            if (this.target.rect.x > maxx) {
                this.target.rect.x = maxx
                this.speed.x = 0
                this.xcollide = true
            }

            // TODO: troid gutter
            if (this.target.rect.y < Physics2dPlatform.maprect.y - 96) {
                this.target.rect.y = Physics2dPlatform.maprect.y - 96
                this.speed.y = 0
                this.ycollide = true
            }

            let maxy = Physics2dPlatform.maprect.h - this.target.rect.h
            if (this.target.rect.y + 1 > maxy) {

                //if (this.target.playerId=="player1") {console.error("set standing bounds");}
                standing = true
                this.target.rect.y = maxy
                this.speed.y = 0
                this.ycollide = true
            }
        }

        this.collide = this.xcollide || this.ycollide

        //if (this.xcollide) {
        //    this.speed.x = 0
        //    this.accum.x = 0
        //}
        //if (this.ycollide) {
        //    this.speed.y = 0
        //    this.accum.y = 0
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

        let not_moving = this.direction == 0 && Math.abs(this.speed.x) < 30
        let falling = !this.standing && this.speed.y > 0
        let rising = this.speed.y < 0
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
            this.speed.x,
            this.speed.y,
            this.accum.x,
            this.accum.y,
            this.gravityboost,
            this.doublejump,
            this.doublejump_position,
            this.doublejump_timer,
            this.pressing,
            this.standing,
            this.facing,
        ]

        return state
    }

    setState(state) {

        [
            this.target.rect.x,
            this.target.rect.y,
            this.direction,
            this.speed.x,
            this.speed.y,
            this.accum.x,
            this.accum.y,
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