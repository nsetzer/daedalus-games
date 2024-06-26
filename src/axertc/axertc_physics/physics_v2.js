
import {Direction, Rect} from "@axertc/axertc_common"
/*

the new physics changes the api for collisions
instead of entities implementing "collide" which
was required to return an updated bounding box,
entities now must implement collidePoint(x,y)
this allows for complex shapes to be collided with.

an entity implementing physics must set the property `solid`
to true for collisions to take place

entities may also implement isSolid(other) which should
return true if the two entities should collide.
for example, one way platforms can be implemented
by testing the location of one entity compared to the other.

entities may implement onPress(other, vector) allowing
for an object to handle touching interations.
for example, breaking bricks, jumping on an entity
or pushing a block



https://medium.com/@brazmogu/physics-for-game-dev-a-platformer-physics-cheatsheet-f34b09064558

g = negative
position = 0.5*g*t*t + v'*t
speed = g*t + v'

initial velocity = sqrt(2*H*g)
283.3400783510868

gravity = H/(2t*t)
jumpspeed = - sqrt(2*H*g)

*/

// TODO: v3: no gravity, 2 sensors for x and y direction
export class Physics2dPlatformV2 {

    static maprect = new Rect(0,0,0,0);

    static BOUNDARY_NOCHECK = 0
    static BOUNDARY_COLLIDE = 1
    static BOUNDARY_DESTROY = 2

    constructor(target, config=null) {
        this.target = target

        this.standing_direction = Direction.NONE
        this.moving_direction = Direction.NONE
        this.moving_speed = 90 // temporary FIXME
        this.next_rect = null

        this.frame_index = 0;
        this.standing_frame = -1;
        this.pressing_frame = -1;

        this.bounds_check = config.bounds_check??Physics2dPlatformV2.BOUNDARY_COLLIDE

        this.oneblock_walk = config.oneblock_walk??0
        this._x_oneblock_walk_solid = false

        this.gravityboost = false // more gravity when button not pressed
        this.doublejump = false
        this.doublejump_position = {x:0, y: 0} // animation center
        this.doublejump_timer = 0 // for the animation duration

        this.vaccum = 0 // velocity accumulator

        this.group = () => []

        // step_vector the direction considered up
        this._step_vector = {x: 0, y:0}
        this._init_gravity(config)
        this._init_lut()



        this.sensor_info = null

        this.speed = {x:0, y:0}
        this.accum = {x:0, y:0}

        this._x_prev_summary = {standing: false}
        this._x_step_collisions = {fn:false}

        this._x_stuck_counter = 0
    }

    _init_gravity(config) {
        /*
        config:
            wallwalk: false
            wallslide: false
            xmaxspeed1: 7*32
            xmaxspeed2: 14*32
            jumpheight: 64 + 8
            jumpduration: .22
            gravity: 0 // if not given, or non-zero, gravity is calculated
            terminal_velocity: if not given, calculated
        */

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

        this.can_wallwalk = config?.wallwalk??false
        this.can_wallslide = config?.wallslide??false

        // two xaccelerations and two max speeds (1 and 1a)
        // quickly ramp up to the first max speed
        // slowly accelerate to the second max speed
        // allow for higher jumps and running over gaps at the second speed
        this.xmaxspeed1 = config?.xmaxspeed1??(7*32)  // from pressing buttons
        this.xmaxspeed1a = this.xmaxspeed1*(2/3)
        this.xmaxspeed2 = config?.xmaxspeed2??(14*32) // from other sources ?
        this.xacceleration_t = config?.xacceleration_t??0.2

        // speed profiles allow for different acceleration rates
        // acclerate to 2/3 of max speed in .2 seconds
        // then slowly accelerate to max speed over 1 second
        this.speed_profiles = [
            {speed: this.xmaxspeed1a, accel: (this.xmaxspeed1a) / this.xacceleration_t},
            {speed: this.xmaxspeed1, accel: (this.xmaxspeed1 - this.xmaxspeed1a) / 1},
        ]

        this.speed_profile_current = 0

        this.xfriction = this.xmaxspeed1 / .5 // stop moving in .1 seconds
        //this.xacceleration2 = (this.xmaxspeed1 - this.xmaxspeed1a) / 1


        // horizontal direction in a wall jump
        // TODO: after a wall jump friction does not apply to reduce the speed from xmaxspeed2 to xmaxspeed1
        let xaccel = this.speed_profiles[0].accel
        this.xjumpspeed = Math.sqrt(3*32*xaccel) // sqrt(2*distance*acceleration)
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

        // calculate the speed the mob is moving at the end of a full jump
        // set that speed as the terminal velocity
        let _g = this.gravity * 1 / 60
        let _t1 = - this.jumpspeed / _g
        let _t2 = 2 * _t1
        let _v_end = Math.min(this.jumpspeed + _g * _t2, 8*60)

        // when terminal veloctity / 60 > 8 pixels the object moves too fast
        this.terminal_velocity = config?.terminal_velocity??_v_end

    }

    _update_neighborhood() {
        let rect = this.target.rect
        // todo: neighborhood size must be bigger for oneblock_walk
        // was an 8px border
        // needs to be at least 16px for oneblock walk
        this._neighborhood = new Rect(rect.x - 24, rect.y - 24, rect.w + 48, rect.h + 48);
        // TODO: its easy to softlock with red/blue switches and other dynamic entities
        // just ignoring solid objects already being collided with is problematic
        // maybe use a sensor?
        // maybe use stuck detection?
        this._neighbors = this.group().filter(ent => ent.rect.collideRect(this._neighborhood))

        if (this._x_stuck_counter > 1) {
            this._neighbors = this._neighbors.filter(ent => !ent.rect.collideRect(rect))
        }

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
            if (ent.entid == this.target.entid) { return }
            if (ent.isSolid) { if (!ent.isSolid(this.target)) { return }}

            if (ent.collidePoint(sensor_u.x, sensor_u.y)) { collide_u = true }
            if (ent.collidePoint(sensor_d.x, sensor_d.y)) { collide_d = true }
            if (ent.collidePoint(sensor_l.x, sensor_l.y)) { collide_l = true }
            if (ent.collidePoint(sensor_r.x, sensor_r.y)) { collide_r = true }
        })

        if (this.can_wallwalk) {
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
        } else {
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

        let cx = this.target.rect.cx()
        let cy = this.target.rect.cy()

        // TODO: this is a hack to allow square objects to walk up a 45 degree slope
        //if (!this.can_wallwalk) {
        if (this.target.rect.w == this.target.rect.h) {
            if (this.standing_direction == Direction.RIGHT) {cx -= 1}
            if (this.standing_direction == Direction.LEFT ) {cx += 1}
            if (this.standing_direction == Direction.UP   ) {cy += 1}
            if (this.standing_direction == Direction.DOWN ) {cy -= 1}
        }


        let sensor_u = {x: cx,       y: this.target.rect.top()}
        let sensor_d = {x: cx,       y: this.target.rect.bottom()}
        let sensor_l = {x: this.target.rect.left(),     y: cy}
        let sensor_r = {x: this.target.rect.right(),    y: cy}

        

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
            f: false,       // facing direction, within the body
            t: false,       // head within body
            b: false,       // feet within body
            fn: false,      // f + one step 'forward'
            tn: false,      // t + one step 'forward'
            bn: false,      // b + one step 'forward'
            s1: false,      // slope, one step 'up' from the ground
            s2: false,      // slope, one step 'up' from s1
            g1: false,      // ground level
        }

        this._neighbors.forEach(ent => {
            if (ent.entid == this.target.entid) { return }
            if (ent.isSolid) { if (!ent.isSolid(this.target)) { return }}

            // TODO: a potential optimization is to store the collision data in the class
            // if a sensor has collided, there is no reason to run that test again

            if (ent.collidePoint(sensors.f.x, sensors.f.y)) { 
                collisions.f = true 
            }
            if (ent.collidePoint(sensors.t.x, sensors.t.y)) { collisions.t = true }
            if (ent.collidePoint(sensors.b.x, sensors.b.y)) { collisions.b = true }

            if (ent.collidePoint(sensors.fn.x, sensors.fn.y)) { 
                collisions.fn = true; 
                if (this.target._classname =='Bullet' && !!ent._fx) {
                    // TODO: the bug here with bullets and one way slopes is that 
                    // the shape of the bullet is a rectangle, not a point
                    // if can collide with the floor while being above the floor

                    // this will be fixed if a new physics is written for point entities

                    // position where 'is solid' is determined
                    let _sx = Math.floor(ent.rect.cx())
                    let _sy = Math.floor(ent.rect.bottom())
                    let _syp = ent._fx(_sx,_sy)

                    // position where 'collision' is determined
                    let _tx = sensors.fn.x
                    let _ty = sensors.fn.y
                    let _typ = ent._fx(_tx, _ty)

                    console.log("hit fn 1", {_sx,_sy,_syp}, {_tx,_ty,_typ})
                }
                //console.log("press f", ent._classname)
                if (ent.onPress) {
                    ent.onPress(this.target, {x:dx, y:dy})
                    // this helps with pushing crates
                    //collisions.fn = ent.collidePoint(sensors.fn.x, sensors.fn.y)
                }
            }
            if (ent.collidePoint(sensors.tn.x, sensors.tn.y)) { collisions.tn = true }
            if (ent.collidePoint(sensors.bn.x, sensors.bn.y)) { collisions.bn = true }

            // todo: investigate speed profiles and one block walk.
            // set a requirement of being max speed, or 90% max speed,
            // todo: investigate one block walk for all directions, not just horizontal
            this._x_oneblock_walk_solid = false

            if (this._enable_oneblock_walk && Math.abs(this.speed.x) > this.speed_profiles[0].speed && !collisions.b) {
                if (ent.collidePoint(sensors.b.x+Math.sign(this.speed.x)*16, sensors.b.y)) { 
                    this._x_oneblock_walk_solid = true
                    collisions.b1 = collisions.b
                    collisions.b = true 
                    collisions.b2 = true 
                } else {
                    collisions.b1 = false
                }
            }

            // todo: investigate speed profiles and one block walk.
            // set a requirement of being max speed, or 90% max speed,
            // todo: investigate one block walk for all directions, not just horizontal
            if (this._enable_oneblock_walk && Math.abs(this.speed.x) > this.speed_profiles[0].speed && !collisions.bn) {
                if (ent.collidePoint(sensors.bn.x+Math.sign(this.speed.x)*16, sensors.bn.y)) { 
                    this._x_oneblock_walk_solid = true
                    collisions.bn1 = collisions.b
                    collisions.bn = true 
                    collisions.bn2 = true 
                } else {
                    collisions.bn1 = false
                }
            }


            if (ent.collidePoint(sensors.s1.x, sensors.s1.y)) { collisions.s1 = true }
            if (ent.collidePoint(sensors.s2.x, sensors.s2.y)) { collisions.s2 = true }
            if (ent.collidePoint(sensors.g1.x, sensors.g1.y)) { collisions.g1 = true }

        })

        this._x_step_collisions = collisions; //fixme _step/collisions

        let step = this._lut_step[this.standing_direction]

        this.sensor_info = {sensors, collisions} // for painting

        //this._collisions = collisions

        //this.trails[0].push({...d_sensor[this.standing_direction], c:d_collide_next[this.standing_direction]})
        //this.trails[1].push({...sensor_s1, c:collide_next_s1})
        //this.trails[2].push({...sensor_s2, c:collide_next_s2})

        //while (this.trails[0].length > 48) { this.trails[0].shift() }
        //while (this.trails[1].length > 48) { this.trails[1].shift() }
        //while (this.trails[2].length > 48) { this.trails[2].shift() }

        // TODO: revist including s2 in the bonk. it does prevent walking through solid walls
        let bonk =  collisions.t || collisions.fn || collisions.tn || collisions.s2
        let standing = collisions.b

        //if (this.target._classname == 'Player') {
        //    console.log({wallwalk: this.can_wallwalk, standing, bonk, collisions})
        //}

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

        // when walking
        if ((standing && !bonk && collisions.bn)) {
            // step in the forward direction
            //console.log("step fd")
            // !b covers the walking case, and walking with oneblock walk active
            if (!collisions.b && collisions.s1 && collisions.s2) {
                return 1
            }
            this.target.rect.x += dx
            this.target.rect.y += dy
            return 1
        }

        // when rising or falling
        if (!standing && !bonk) {
            // step in the forward direction
            //console.log("step fd")
            //console.log(__LINE__, "falling step", collisions)
            if (collisions.s1 && collisions.s2) {
                return 1
            }
            // this seems to prevent crashing into slopes
            if (!collisions.bn) {
                this.target.rect.x += dx
                this.target.rect.y += dy
            }
            
            return 1
        }


        //move to walk off the 'cliff'
        // TODO: check if next rect is valid
        // TODO: add a "heel" sensor on the bottom side of the entity opposite the direction of movement
        //       allow the entity to walk off the cliff as long as the heel is still connected to the floor
        //       this will result in less of a jump when moving to the next rect
        if (this.can_wallwalk && standing && !collisions.bn && !collisions.t) {
            //console.log("rotate 2")
            // it's a cliff from the perspective of the current downwards direction

            
            let current_moving_direction = Direction.fromVector(dx, dy)
            
            if (current_moving_direction != this.moving_direction) {
                console.warn("fixme: wallwalk moving direction")
                return 1;
            }


            //let ta, tmp
            //for (let i=0; i < lut2.length; i++) {
            //    [ta,tmp] = lut2[i]
            //    if (ta.standing == this.standing_direction && ta.moving == this.moving_direction) {
            //        break
            //    }
            //}
            let tmp = this._lut_rotate_2[this.standing_direction][current_moving_direction]

            if (!tmp) {
                console.warn(`unexpected undefined reference <cliff> standing=${this.standing_direction} moving=${current_moving_direction} not found in rotation look up table`)
                return 1;
            }

            /*
            if (this.target._classname == 'Player') {
                console.log("set next rect", {
                    ...tmp,
                    w: this.target.rect.w,
                    h: this.target.rect.h,
                    standing: Direction.name[this.standing_direction],
                    moving: Direction.name[current_moving_direction],  
                }) 
            }
            */

            /*
            if (this.target._classname == 'Player') {
                this._x_rotate_position = {...this.target.rect}
                this._x_rotate_sensors = {...sensors}
                console.log("rotate cliff",
                        "standing", Direction.name[this.standing_direction], "to", Direction.name[tmp.standing],
                        "moving", Direction.name[current_moving_direction], "to", Direction.name[tmp.moving]
                )
            }
            */

            let next_rect = new Rect(
                Math.round(this.target.rect.x + tmp.x), 
                Math.round(this.target.rect.y + tmp.y), 
                this.target.rect.w,
                this.target.rect.h
            )

            if (
                next_rect.left() < Physics2dPlatformV2.maprect.left() ||
                next_rect.right() > Physics2dPlatformV2.maprect.right() ||
                next_rect.top() < Physics2dPlatformV2.maprect.top() ||
                next_rect.bottom() > Physics2dPlatformV2.maprect.bottom() 
            ) {
                // cancel momentum and flip the direction
                this.moving_direction = Direction.flip[this.moving_direction]
                this.speed.x = 0
                this.speed.y = 0
                this.accum.x = 0
                this.accum.y = 0
                return 1
            }

            // filter/map reduce neighbors to see if there is a collision
            let collide = this._neighbors.reduce((acc, ent) => { return acc || ent.rect.collideRect(next_rect) }, false)

            this._x_rotate_position = {...next_rect}

            if (collide) {
                
                // this serves to debug errors
                this._neighbors.forEach(ent => { 
                    if (ent.rect.collideRect(next_rect)) {
                        console.log("collide with", ent.rect, this.target.rect, tmp.x, tmp.y, next_rect)
                    }
                })

                console.log("wall walk is invalid", next_rect, collide)
                return 1
            }

            //console.log("standing", Direction.name[this.standing_direction], "to", Direction.name[tmp.standing])
            //console.log("moving", Direction.name[current_moving_direction], "to", Direction.name[tmp.moving])
            this.moving_direction = tmp.moving
            this.standing_direction = tmp.standing
            // todo round the edge cooresponding the the standing direction
            // in order to support objects that are not square and 16x16

            // TODO: sometimes the target position is x.9999 instead of being an int
            // and it only happens when in a production build

            //console.log(Math.round(performance.now()/(1000/60)), gEngine.frameIndex, "set next rect")

            // probably need to do 4 tests
            //neighbors.forEach(ent => {
            //    if (ent.entid == this.target.entid) { return }
            //
            //    if (ent.collidePoint(p.x, p.y)) { collide = true}
            //}

            // next rect was a hack, but the jump isnt visually as jarring as expected
            // TODO: FIXME validate the next rect does not collide with anything

            this.target.rect = next_rect

            //this.next_rect = next_rect
            //this.prev_rect = new Rect(this.target.rect.x, this.target.rect.y, this.target.rect.w, this.target.rect.h)

            //this.rect.x += dx
            //this.rect.y += dy
            //v = Direction.vector(this.moving_direction)
            //dx = v.x;
            //dy = v.y;
            //this.rect.x += dx
            //this.rect.y += dy

            //this.rect.x = nextrect.x
            //this.rect.y = nextrect.y

            return 1
        }

        // move to walk up a 'wall'
        // todo check if next rect is valid
        if (this.can_wallwalk && standing && collisions.bn && !collisions.t && collisions.fn) {
            

            // it's a wall from the perspective of the current downwards direction

            let current_moving_direction = Direction.fromVector(dx, dy)

            if (current_moving_direction != this.moving_direction) {
                console.warn("fixme: wallwalk moving direction")
                return 1;
            }
        
            let tmp = this._lut_rotate_3[this.standing_direction][current_moving_direction]

            if (!tmp) {
                console.warn(`unexpected undefined reference <wall> standing=${this.standing_direction} moving=${current_moving_direction} not found in rotation look up table`)
                return 1;
            }

            /*
            console.log("wallwalk", 
                "moving direction", Direction.name[current_moving_direction],
                "standing direction", Direction.name[this.standing_direction],
                collisions
            )
            */

            let next_rect = new Rect(
                // again floating point errors only in production
                Math.round(this.target.rect.x + tmp.x), 
                Math.round(this.target.rect.y + tmp.y), 
                this.target.rect.w,
                this.target.rect.h
            )

            if (
                next_rect.left() < Physics2dPlatformV2.maprect.left() ||
                next_rect.right() > Physics2dPlatformV2.maprect.right() ||
                next_rect.top() < Physics2dPlatformV2.maprect.top() ||
                next_rect.bottom() > Physics2dPlatformV2.maprect.bottom() 
            ) {
                return 1
            }

            this.target.rect.x = next_rect.x
            this.target.rect.y = next_rect.y

            this.moving_direction = tmp.moving 
            this.standing_direction = tmp.standing 

            return 1
        }

        // walk off the ledge
        if (!this.can_wallwalk) {
            if (!bonk) {
                this.target.rect.x += dx
                this.target.rect.y += dy
            }
            return 1
        } else {
            // TODO: prevents a crash when wallwalking, but points towards a bug
            // if bonk, then maybe it should be changing the wall
            if (bonk) {
                console.warn("fix wallwalk collisions")
                return 1;
            }
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

        console.error({
            "error": "movement not handled",
            dx, dy, next: this.next_rect, standing, bonk,
            standing_direction: Direction.name[this.standing_direction],
            moving_direction: Direction.name[this.moving_direction],
            sensors,
            collisions})
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
            //console.log(Math.round(performance.now()/(1000/60)), gEngine.frameIndex, {v,dx,dy})
            return v==2?1.4:1
        }

        if (dx == 0 && dy ==0) {
            this.next_rect = null
        }

        return 0
    }

    is_rising() {
        // return true if the velocity suggests moving away from the floor
        let rising = false
        if (this.standing_direction == Direction.DOWN ) { rising = this.speed.y < 0 }
        if (this.standing_direction == Direction.UP   ) { rising = this.speed.y > 0 }
        if (this.standing_direction == Direction.RIGHT) { rising = this.speed.x < 0 }
        if (this.standing_direction == Direction.LEFT ) { rising = this.speed.x > 0 }
        return rising
    }

    step(dx, dy) {
        const sensors = this._step_get_sensors(dx, dy)
        let rv = this._step(sensors, dx, dy)
    }

    update(dt) {

        this.frame_index += 1

        this._enable_oneblock_walk = this.oneblock_walk && !this.can_wallwalk && this._x_prev_summary.standing

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

        let sym = (this.standing_direction&Direction.UPDOWN)?{h:"x", v:"y"}:{h:"y", v:"x"}

        // unconditional step to the target rect,
        // use the existing horizontal speed with a minimum value
        // this works around an acceleration bug when used down below
        // Maybe that can be fixed instead?
        if (this.next_rect !== null) {
            this.accum[sym.h] += Math.min(dt * this.speed[sym.h], 1*Math.sign(this.accum[sym.h]))
            while (Math.abs(this.accum[sym.h]) > 1 && this.next_rect !== null) {
                let k = this._step_target()
                this.accum[sym.h] -= Math.sign(this.accum[sym.h]) * k
            }
            return
        }

        let step_v = Direction.vector(this.moving_direction)
        let sensors = this._step_get_sensors(step_v.x, step_v.y)
        let collisions = {b:false,t:false,f:false, fn: false}

        this._neighbors.forEach(ent => {
            if (ent.entid == this.target.entid) { return }
            if (ent.isSolid) { if (!ent.isSolid(this.target)) { return; }}

            if (ent.collidePoint(sensors.b.x, sensors.b.y)) { collisions.b = true }

            // todo: investigate speed profiles and one block walk.
            // set a requirement of being max speed, or 90% max speed,
            // todo: investigate one block walk for all directions, not just horizontal
            if (this._enable_oneblock_walk && Math.abs(this.speed.x) > this.speed_profiles[0].speed && !collisions.b) {
                
                if (ent.collidePoint(sensors.b.x+Math.sign(this.speed.x)*16, sensors.b.y)) { 
                    collisions.b1 = collisions.b
                    collisions.b = true 
                    collisions.b2 = true 
                } else {
                    collisions.b1 = false
                }
            }

            //if (ent.collidePoint(sensors.bn.x, sensors.bn.y)) { collisions.bn = true }
            if (ent.collidePoint(sensors.t.x, sensors.t.y)) { collisions.t = true }

            if (!!sensors.fn && ent.collidePoint(sensors.fn.x, sensors.fn.y)) { collisions.fn = true }
        })

        //---------------------------------------
        // Gravity
        // check if not standing and apply gravity
        if (!collisions.b && this.next_rect === null) {

            //console.log(this.moving_direction, collisions.fn, this.speed)

            // fall / jump
            /*
            console.log("falling", 
                Math.floor(this.target.rect.x)%16, 
                Math.floor(this.target.rect.y)%16, 
                collisions, Object.keys(this._neighbors).length)
            */

            let step = this._lut_step[this.standing_direction]
            let gforce = this.gravity * dt
            this.speed[sym.v] += -step[sym.v]*gforce

            // wall slide
            if (this.can_wallslide && this.standing_direction == Direction.DOWN  && this.speed.y > 50 && collisions.fn) { 
                this.speed.y = 50
            }
            
            //this.speed.y += -step.y*gforce

            if (this.gravityboost) {

                let rising = this.is_rising()
                if (rising) {
                    this.speed[sym.v] += -step[sym.v]*gforce
                    //this.speed.y += -step.y*gforce
                }
            }

            // TODO: terminal velocity applies in both movement directions?
            if (Math.abs(this.speed[sym.v]) > this.terminal_velocity) {
                this.speed[sym.v] = Math.sign(this.speed[sym.v]) * this.terminal_velocity
            }
            /*
            let tv = Math.sign(-step[sym.v]) * this.terminal_velocity * (1 + -0.5*this._fluid_factor)
            console.log((1 + -0.5*this._fluid_factor), this.speed[sym.v], tv)
            if (Math.sign(-step[sym.v])==Math.sign(this.speed[sym.v]) &&
                Math.abs(this.speed[sym.v]) > tv) {

                this.speed[sym.v] = Math.sign(this.speed[sym.v])*tv
            }
            */

        } else {
            // not falling, cancel gravity ???

            //let step = this._lut_step[this.standing_direction]
            //this.speed.x *= (1-Math.abs(step.x))
            //this.speed.y *= (1-Math.abs(step.y))
            if (this.standing_direction == Direction.DOWN  && this.speed.y > 0) { this.speed.y = 0 }
            if (this.standing_direction == Direction.UP    && this.speed.y < 0) { this.speed.y = 0 }
            if (this.standing_direction == Direction.LEFT  && this.speed.x < 0) { this.speed.x = 0 }
            if (this.standing_direction == Direction.RIGHT && this.speed.x > 0) { this.speed.x = 0 }

        }

        this._x_prev_summary = {
            standing: collisions.b
        }

        //---------------------------------------
        // Movement Speed and Friction

        if (this._mask_movement[this.standing_direction]&this.moving_direction) {
            // profiles for {speed, accel}
            this.speed_profile_current = -1
            let sign = Direction.vector(this.moving_direction)[sym.h]

            for (let i=0; i < this.speed_profiles.length; i++) {
                const profile = this.speed_profiles[i]
                this.speed_profile_current = i
                let ts = sign * profile.speed
                if (ts < 0) {
                    if (this.speed[sym.h] > ts) {
                        this.speed[sym.h] += sign * profile.accel * dt
                        break
                    }
                } else {
                    if (this.speed[sym.h] < ts) {
                        this.speed[sym.h] += sign * profile.accel * dt
                        break
                    }
                }
            }

            if (Math.abs(this.speed[sym.h]) > this.xmaxspeed2) {
                this.speed[sym.h] = sign * this.xmaxspeed2
            }

            //if (Math.abs(this.speed[sym.h]) > this.speed_profiles[this.speed_profiles.length-1].speed) {
            //    this.speed[sym.h] -= Math.sign(this.speed[sym.h]) * this.xfriction * dt
            //}

        } else {
            // friction when not moving
            if (Math.abs(this.speed[sym.h]) < this.xfriction * dt) {
                this.speed[sym.h] = 0
            } else {
                this.speed[sym.h] -= Math.sign(this.speed[sym.h]) * this.xfriction * dt
            }
        }

        // finally update accumulators based on current speed
        this.accum[sym.h] += dt * this.speed[sym.h]
        this.accum[sym.v] += dt * this.speed[sym.v]

        //---------------------------------------
        // horizontal step

        if (true) {

            let start_pos = {x: this.target.rect.x, y: this.target.rect.y};
            let start_dir = this.standing_direction

            let dx = Math.trunc(this.accum[sym.h])
            let n = Math.abs(dx)
            let s = Math.sign(dx)

            if (isNaN(dx)) {
                throw {"error": "nan", accum:this.accum, speed: this.speed}
            }
            
            let v = {}
            let sdir = this.standing_direction
            v.x = (this.standing_direction&Direction.UPDOWN)?s:0;
            v.y = (this.standing_direction&Direction.UPDOWN)?0:s;
            let k

            let i=0;
            while (n > 0) {
                i+=1;

                if (this.next_rect !== null) {
                    k = this._step_target()
                    //console.log(Math.round(performance.now()/(1000/60)), gEngine.frameIndex, this.accum[sym.h], s, k, n)
                    this.accum[sym.h] -= s*k
                    n -= k
                } else {
                    let sensors = this._step_get_sensors(v.x, v.y)

                    if (!sensors.f) {
                        console.error(Direction.name[this.moving_direction])
                        console.error(sensors, v.x, v.y)
                        throw 0
                    }

                    // TODO: cancel momentum on a collision
                    // TODO: report if pressing in to an object
                    k = this._step(sensors, v.x, v.y)
                    //console.log(this._x_step_collisions)
                    

                    this.accum[sym.h] -= s*k
                    n -= k

                    if (sdir != this.standing_direction) {
                        sdir = this.standing_direction
                        sym = (this.standing_direction&Direction.UPDOWN)?{h:"x", v:"y"}:{h:"y", v:"x"}

                        //if (this.target._classname == "Player") {
                        //    console.log("move break 2")
                        //    //gEngine.paused=true
                        //}
                        //if (this.target._classname == "CreeperV2") {
                        //    console.log("move break 2", this.speed, this.accum, Direction.name[this.moving_direction])
                        //}
                        // preserve forward momentum
                        // Note: this cancels vertical momentum
                        let sy=0, sx=0;
                        if (this.moving_direction == Direction.UP   ) {sy = -1}
                        if (this.moving_direction == Direction.DOWN ) {sy =  1}
                        if (this.moving_direction == Direction.RIGHT) {sx =  1}
                        if (this.moving_direction == Direction.LEFT ) {sx = -1}

                        // swap x and y and apply the correct sign to continue traveling
                        // in the new direction at the same speed
                        // preserve momentum
                        //console.log("preserve momentum 0", Direction.name[this.standing_direction], this.speed, this.accum)
                        [this.speed.x,this.speed.y] = [sx*Math.abs(this.speed.y),sy*Math.abs(this.speed.x)]
                        [this.accum.x,this.accum.y] = [sx*Math.abs(this.accum.y),sy*Math.abs(this.accum.x)]
                        //console.log("preserve momentum 1", Direction.name[this.standing_direction], this.speed, this.accum)

                        // TODO: loop physics : maybe this break is causing the issue
                        // I think the bug is on a loop, when swithing walls
                        // we need one extra step to actually get on the wall correctly
                        // stepping 'down' instead of letting gravity do the work
                         
                        //break;
                    }
                }


            }

            if (i > 0 && start_pos.x == this.target.rect.x && start_pos.y == this.target.rect.y) {
                
                //console.log("stuck!!", this._x_step_collisions, this._x_stuck_counter)
                // this isnt perfect, but seems to be working
                if (this._x_step_collisions.b && this._x_step_collisions.t) {
                    this._x_stuck_counter += 1
                }

                //if (this._x_step_collisions.s1 && this._x_step_collisions.s2) {
                //    this._x_stuck_counter += 1
                //}

                if (this._x_stuck_counter == 0 && start_dir == this.standing_direction && this._x_step_collisions.fn) {
                    //console.log("no movement this frame!!!", start_dir, this.standing_direction, this._x_step_collisions)
                    this.speed[sym.h] = 0
                    this.accum[sym.h] = 0
                    
                }
            } else {
                if (i > 0) {
                    this._x_stuck_counter = 0
                }
            }
        }

        //---------------------------------------
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
                this._x_step_collisions.b = false
                this._x_step_collisions.t = false
                this._neighbors.forEach(ent => {
                    if (ent.entid == this.target.entid) { return }
                    if (ent.isSolid) { if (!ent.isSolid(this.target)) { return }}

                    if (ent.collidePoint(sensors.b.x, sensors.b.y)) { 
                        collisions.b = true; 
                        this._x_step_collisions.b = true
                        //console.log("press d", ent._classname, s)
                        if (ent.onPress) {ent.onPress(this.target, {[sym.v]:s, [sym.h]:0})}
                    }
                    //if (ent.collidePoint(sensors.bn.x, sensors.bn.y)) { collisions.bn = true }
                    if (ent.collidePoint(sensors.t.x, sensors.t.y)) { 
                        collisions.t = true; 
                        this._x_step_collisions.t = true
                        //console.log("press u", ent._classname) 
                        if (ent.onPress) {ent.onPress(this.target, {[sym.v]:s, [sym.h]:0})}
                    }
                })


            }

            if (collisions.b) {
                this.standing_frame = this.frame_index
            }

        }

        //---------------------------------------
        // bounds check
        if (Physics2dPlatformV2.maprect.w) {
            if (this.bounds_check == 1) {

                if (this.target.rect.x < Physics2dPlatformV2.maprect.x) {
                    this.target.rect.x = Physics2dPlatformV2.maprect.x
                }
                if (this.target.rect.y < Physics2dPlatformV2.maprect.y) {
                    this.target.rect.y = Physics2dPlatformV2.maprect.y
                }
                if (this.target.rect.x > Physics2dPlatformV2.maprect.w-this.target.rect.w) {
                    this.target.rect.x = Physics2dPlatformV2.maprect.w-this.target.rect.w
                }
                if (this.target.rect.y > Physics2dPlatformV2.maprect.h-this.target.rect.h) {
                    this.target.rect.y = Physics2dPlatformV2.maprect.h-this.target.rect.h
                }
            } else {
                if (this.target.rect.x < Physics2dPlatformV2.maprect.x - this.target.rect.w ||
                    this.target.rect.y < Physics2dPlatformV2.maprect.y - this.target.rect.h ||
                    this.target.rect.x > Physics2dPlatformV2.maprect.w + this.target.rect.w ||
                    this.target.rect.y > Physics2dPlatformV2.maprect.h + this.target.rect.h) {
                    this.target.destroy()
                    console.log("destroy target", this.target._classname)
                }
            }
        }
        


        //---------------------------------------
        // summarize state
        let v = Direction.vector(this.moving_direction)
        sensors = this._step_get_sensors(v.x, v.y)
        collisions.b = false
        collisions.fn = false
        this._neighbors.forEach(ent => {
            if (ent.entid == this.target.entid) { return }
            if (ent.isSolid) { if (!ent.isSolid(this.target)) { return }}

            if (ent.collidePoint(sensors.b.x, sensors.b.y)) { collisions.b = true }
            if (!!sensors.fn && ent.collidePoint(sensors.fn.x, sensors.fn.y)) { 
                collisions.fn = true 
                if (this.target._classname =='Bullet') {
                    console.log("hit fn 2")
                }
            }
        })

        if (collisions.fn) {
            this.pressing_frame = this.frame_index

            if (this.moving_direction == Direction.LEFT ) {this.pressing_direction =  1}
            if (this.moving_direction == Direction.RIGHT) {this.pressing_direction = -1}
            if (this.moving_direction == Direction.UP   ) {this.pressing_direction = -1}
            if (this.moving_direction == Direction.DOWN ) {this.pressing_direction =  1}
        }

        let not_moving = this.moving_direction == 0 && Math.abs(this.speed.x) < 30
        let rising = this.is_rising()
        let falling = !collisions.b && !rising
        let pressing = collisions.fn
        let standing = collisions.b
        // TODO: using _x_oneblock_walk_solid is still not 100% correct
        // when running over one block, the animation should be "run" not "fall"
        // with this hack, there are 4 frames per cycle that still register as fall
        // the introduction of _x_oneblock_walk_solid does make it look much better
        if (this.oneblock_walk) {
            standing = standing || this._x_oneblock_walk_solid
            if (standing) {
                falling = false
            }
        }

        this._x_is_standing = standing;

        // gravity boost should only apply to the rising action
        // after the player releases the button
        if (standing || falling) {
            this.gravityboost =  false
        }

        if (falling) {
            if (pressing && this.can_wallslide) {
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
        
        //console.log("standing", standing, "falling", falling, "soft", this._x_oneblock_walk_solid, this.action)

    }

    paint(ctx) {

        if (true) {
            ctx.beginPath()
            ctx.fillStyle = "#FFFFFF64"
            let {x,y,w,h} = this.target.rect
            ctx.rect(x,y,w,h)
            ctx.fill();
        }
        
        if (!!this.next_rect) {
            ctx.beginPath()
            ctx.fillStyle = "#0000FF64"
            let {x,y,w,h} = this.next_rect
            ctx.rect(x,y,w,h)
            ctx.fill();
        }

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

        if(!!this._x_rotate_position) {
            ctx.beginPath()
            ctx.strokeStyle = "#FF00FF"
            let {x,y,w,h} = this._x_rotate_position
            ctx.rect(x,y,w,h)
            ctx.stroke();

            /*let sensors = this._x_rotate_sensors

            ctx.beginPath()
            ctx.fillStyle = "#FF0000"
            ctx.lineWidth = 1
            ctx.rect(sensors.f.x, sensors.f.y, 1, 1)
            ctx.rect(sensors.t.x, sensors.t.y, 1, 1)
            ctx.rect(sensors.b.x, sensors.b.y, 1, 1)
            //ctx.rect(sensors.bn.x, sensors.bn.y, 1, 1)
            //ctx.rect(sensors.g1.x, sensors.g1.y, 1, 1)
            ctx.fill();*/

        }


    }

    static polygonInside(point, polygon) {
        // ray-casting algorithm based on
        // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html
        
        let x = point.x, y = point.y;
        
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            
            let xi = polygon[i].x, yi = polygon[i].y;
            let xj = polygon[j].x, yj = polygon[j].y;
            
            let intersect = ((yi > y) != (yj > y)) && 
                             (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

            if (intersect) { 
                inside = !inside
            };

        }
        console.log(point, inside, polygon)
        
        return inside;
    };

}

//Physics2dPlatform.maprect = new Rect(0,0,0,0)
