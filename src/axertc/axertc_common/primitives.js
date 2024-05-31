 

//deprecate???
export function randomNumber(min, max) {
    // returns a number from min to max, including min or max
    return Math.round(Math.random() * (max - min) + min);
}

export function randomRange(min, max) {
    return randomNumber(min, max-1)
}

export function randomChoice(lst) {
    if (lst.length==0) {
        return null
    }

    let i = randomRange(0, lst.length)

    return lst[i]
}

export function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

export const Alignment = {

    TOP:     1,
    BOTTOM:  2,
    VCENTER: 3,

    LEFT:    4,
    RIGHT:   8,
    HCENTER: 12,

    CENTER: 15,

    XMASK: 12,
    YMASK: 3,

    // for context fill text
    // (alignment & XMASK >> 2)
    // (alignment & YMASK)
    XWORDS: ["", "left", "right", "center"], // textAlign
    YWORDS: ["", "top", "bottom", "middle"], // textBaseline

}

export const Direction = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    UP: 4,
    DOWN: 8,
    UPLEFT: 4|1,
    UPRIGHT: 4|2,
    DOWNLEFT: 8|1,
    DOWNRIGHT: 8|2,

    UPDOWN: 4|8,
    LEFTRIGHT: 1|2,

    ALL: 1|2|4|8,
}

Direction.name = Object.fromEntries(
            Object.entries(Direction).map(([key, value]) => [value, key]));

Direction.order = [
    Direction.RIGHT,
    Direction.UPRIGHT,
    Direction.UP,
    Direction.UPLEFT,
    Direction.LEFT,
    Direction.DOWNLEFT,
    Direction.DOWN,
    Direction.DOWNRIGHT,
]

Direction.flip = {
    [Direction.UP]: Direction.DOWN,
    [Direction.UPRIGHT]: Direction.DOWNLEFT,
    [Direction.RIGHT]: Direction.LEFT,
    [Direction.DOWNRIGHT]: Direction.UPLEFT,
    [Direction.DOWN]: Direction.UP,
    [Direction.DOWNLEFT]: Direction.UPRIGHT,
    [Direction.LEFT]: Direction.RIGHT,
    [Direction.UPLEFT]: Direction.DOWNRIGHT,
}

Direction.fromVector = function (x, y) {

    if (x == 0 && y == 0) {
        return 0
    }

    const theta = Math.atan2(y, -x) * 180/Math.PI
    let index = 4 + Math.round(theta/45)
    if (index == 8) {
        index = 0
    }

    return Direction.order[index]
}

Direction.vector = function(d) {
    let xspeed = 0;
    let yspeed = 0;
    if (d&Direction.LEFT) {
        xspeed = -1;
    }
    if (d&Direction.RIGHT) {
        xspeed = 1;
    }
    if (d&Direction.UP) {
        yspeed = -1;
    }
    if (d&Direction.DOWN) {
        yspeed = 1;
    }
    return {x:xspeed, y:yspeed}
}

export class Rect {

    constructor(x, y, w, h) {
        this.x = x
        this.y = y
        this.w = w
        this.h = h
    }

    cx() {
        return Math.floor(this.x + this.w/2)
    }

    cy() {
        return Math.floor(this.y + this.h/2)
    }

    top() {
        return this.y
    }

    right() {
        return this.x + this.w
    }

    bottom() {
        return this.y + this.h
    }

    left() {
        return this.x
    }

    set_top(y) {
        this.y = y
    }

    set_right(x) {
        this.x = x - this.w
    }

    set_bottom(y) {
        this.y = y - this.h
    }

    set_left(x) {
        this.x = x
    }

    copy() {
        return new Rect(this.x, this.y, this.w, this.h)
    }

    translate(dx, dy) {
        this.x += dx
        this.y += dy
    }

    xintersect(other) {
        let l1 = this.x
        let l2 = other.x
        let r1 = this.x + this.w
        let r2 = other.x + other.w

        let l3 = Math.max(l1, l2)
        let r3 = Math.min(r1, r2)

        if (r3 > l3) {
            return [l3, r3]
        } else {
            return null
        }

    }

    intersect(other) {
        let l1 = this.x
        let l2 = other.x
        let r1 = this.x + this.w
        let r2 = other.x + other.w

        let t1 = this.y
        let t2 = other.y
        let b1 = this.y + this.h
        let b2 = other.y + other.h

        let l3 = Math.max(l1, l2)
        let r3 = Math.min(r1, r2)
        let t3 = Math.max(t1, t2)
        let b3 = Math.min(b1, b2)

        if (r3 > l3 && b3 > t3) {
            return new Rect(l3, t3, r3 - l3, b3 - t3)
        } else {
            return new Rect(0,0,0,0)
        }

    }

    collideRect(other) {

        let l1 = this.x
        let l2 = other.x
        let r1 = this.x + this.w
        let r2 = other.x + other.w

        let t1 = this.y
        let t2 = other.y
        let b1 = this.y + this.h
        let b2 = other.y + other.h

        //console.log(Math.max(l1, l2), Math.min(r1, r2), Math.max(t1, t2), Math.min(b1, b2));

        return Math.max(l1, l2) < Math.min(r1, r2) &&
          Math.max(t1, t2) < Math.min(b1, b2);
    }

    collidePoint(x, y) {

        let l1 = this.x
        let r1 = this.x + this.w

        let t1 = this.y
        let b1 = this.y + this.h

        return l1 <= x && x < r1 && t1 <= y && y < b1;
    }

    collideLine(x1, y1, x2, y2) {
        let { x, y, w, h } = this;

        let bx1 = x 
        let by1 = y 
        let bx2 = x + w
        let by2 = y + h

        let t;

        //console.log("line", x1, y1, x2, y2);
        //console.log("rect", bx1, by1, bx2, by2);

        //  If the start or end of the line is inside the rect then we assume
        //  collision, as rects are solid for our use-case.

        if ((x1 >= bx1 && x1 <= bx2 && y1 >= by1 && y1 <= by2) ||
            (x2 >= bx1 && x2 <= bx2 && y2 >= by1 && y2 <= by2)) {
            return true;
        }

        if (x1 < bx1 && x2 >= bx1) { //  Left edge
            t = y1 + (y2 - y1) * (bx1 - x1) / (x2 - x1);
            if (t > by1 && t <= by2) {
                return true;
            }
        }
        else if (x1 > bx2 && x2 <= bx2) { //  Right edge
            t = y1 + (y2 - y1) * (bx2 - x1) / (x2 - x1);
            if (t >= by1 && t <= by2) {
                return true;
            }
        }
        if (y1 < by1 && y2 >= by1) { //  Top edge
            t = x1 + (x2 - x1) * (by1 - y1) / (y2 - y1);
            if (t >= bx1 && t <= bx2) {
                return true;
            }
        } else if (y1 > by2 && y2 <= by2) {  //  Bottom edge
            t = x1 + (x2 - x1) * (by2 - y1) / (y2 - y1);
            if (t >= bx1 && t <= bx2) {
                return true;
            }
        }
        return false;

    }
}