
$import("axertc_common", {Entity, Direction, Rect})

$include("./physics.js")

export class PlatformerEntity extends Entity {

    constructor(entid, props) {
        super(entid, props)
    }

    collidePoint(x, y) {
        return this.rect.collidePoint(x, y)
    }
}

export class Wall extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.solid = 1
        this.rect = new Rect(props?.x??0, props?.y??0, props?.w??0, props?.h??0)
        this.direction = 1

        this.group = () => {
            return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.playerId})
        }
    }

    update(dt) {

        if (false) {
            this.rect.x += this.direction

            const rect = new Rect(this.rect.x,this.rect.y-2,this.rect.w,2)
            for (const ent of this.group()) {

                let c1 = ent.rect.collideRect(rect)
                let c2 = (!!ent._shadow)?ent._shadow.rect.collideRect(rect):false
                let c3 = (!!ent._server_shadow)?ent._server_shadow.rect.collideRect(rect):false

                if (c1) {
                    ent.rect.x += this.direction
                }

                if (c2) {
                    ent._shadow.rect.x += this.direction
                }

                if (c3) {
                    ent._server_shadow.rect.x += this.direction
                }

            }

            if (this.rect.right() >= Physics2dPlatform.maprect.right()) {
                this.rect.x = Physics2dPlatform.maprect.right() - this.rect.w
                this.direction = -1
            }

            if (this.rect.left() <= Physics2dPlatform.maprect.left()) {
                this.rect.x = Physics2dPlatform.maprect.left()
                this.direction = 1
            }
        }
    }

    getState() {
        return {
            x: this.rect.x,
            y: this.rect.y,
            direction: this.direction,
        }
    }

    setState(state) {

        this.rect.x = state.x
        this.rect.y = state.y
        this.direction = state.direction

    }

    onBend(progress, shadow) {
        this.rect.x += (shadow.rect.x - this.rect.x) * progress
        this.rect.y += (shadow.rect.y - this.rect.y) * progress
        this.direction = (progress >= 0.5)?shadow.direction:this.direction

        if (progress >= 1) {
            this.setState(shadow.getState())
        }

    }

    paint(ctx) {
        ctx.beginPath();
        ctx.fillStyle = "#c3c3c3";
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();
    }
}

function applyfnull(f, a,b) {
    // constraint logic for checking intersection

    // apply f(a,b) if a and b are not null
    // other wise return the first non-null value a or b
    // return null if a and b is null
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

export class Slope extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(0,0,0,0)

        if (!!props.direction) {
            this.rect = new Rect(props.x, props.y, props.w, props.h)
            this.direction = props.direction
            this.init()
        } else {
            this.rect = new Rect(0,0,0,0)
            this.direction = Direction.NONE
        }

        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    init() {

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
        switch (this.direction) {

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
                throw {message: "invalid direction", direction: this.direction}
        }

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

        //console.log(`y=${m}*x+${b}`)

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

    getState() {
        return {rect: this.rect, direction: this.direction}
    }

    setState(state) {
        this.rect = state.rect
        this.direction = state.direction
        this.init()
    }
}
