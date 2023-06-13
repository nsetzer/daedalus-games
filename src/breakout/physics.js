
// equation forms:
//     x = v              || [v]       || a vertical line
//     y = v              || [0, v]    || a line
//     y = mx + b         || [m, b]    || a line
//     y = axx + bx + c   || [a, b, c] || a curve
//     yy = sqrt(rr - xx) || c, r      || a circle

export function distance(p1, p2) {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx*dx + dy*dy)
}

function solve_linear(p1, p2) {

    const d = (p2.x - p1.x);
    if (d == 0) {
        throw `y = ${p1.x}`
    }
    const m = (p2.y - p1.y) / d
    const b = p1.y - m * p1.x
    return [m, b]
}

export function compute_vector(p1, p2) {
    return [(p2.x - p1.x), (p2.y - p1.y)]
}

export function quadform(a, b, c) {
    const discriminant = b*b - 4 * a *c;
    const denominator = 2 * a;
    //const rhs = - c / a

    //console.log(a,b,c, ":", -b, "+/-", discriminant, "/", denominator)
    if (a == 0) {
        // linear equation
        return [- c / b]
    //} else if (b == 0 && rhs > 0) {
    //    const root = Math.sqrt(rhs)
    //    return [-root, root]
    } else if (discriminant > 0) {
        return [
            (-b + Math.sqrt(discriminant)) / denominator,
            (-b - Math.sqrt(discriminant)) / denominator
        ]
    } else if (discriminant == 0) {
        return [
            -b / denominator,
        ]
    } else {
        return []
    }
}

export function intercept_line(p1, p2, p3, p4) {

    let eq1;
    if (p1.x == p2.x) {
        // a vertical line
        eq1 = [p1.x]
    } else {
        eq1 = solve_linear(p1, p2)
    }

    let eq2;
    if (p3.x == p4.x) {
        // a vertical line
        eq2 = [p3.x]
    } else {
        eq2 = solve_linear(p3, p4)
    }

    if (eq1.length == 1 && eq2.length == 1) {

        // two vertical lines must be at the same x position
        if (eq1[0] != eq2[0]) {
            return null
        }

        // check that the line segments overlap
        const [a, b] = [p1.y, p2.y].sort((a,b)=>a-b);
        if ((p3.y < a || p3.y > b) &&
            (p4.y < a || p4.y > b)) {
            return null
        }

        const d1 = distance(p1, p3)
        const d2 = distance(p1, p4)

        if (d1 < d2) {
            return {point: p3, tangent: [0, p3.y]}
        } else {
            return {point: p4, tangent: [0, p4.y]}
        }

    } else if (eq1.length == 1) {
        // the first line is a vertical line
        // check that the line segments overlap
        const [xa, xb] = [p3.x, p4.x].sort((a,b)=>a-b);
        if (p1.x < xa || p1.x > xb) {
            return null
        }

        const y = eq2[0] * p1.x + eq2[1]
        const [ya, yb] = [p1.y, p2.y].sort((a,b)=>a-b);
        if (y < ya || y > yb) {
            return null
        }

        return {point: {x: p1.x, y}, tangent: eq2}

    } else if (eq2.length == 1) {
        // the second line is a vertical line
        // check that the line segments overlap
        const [xa, xb] = [p1.x, p2.x].sort((a,b)=>a-b);
        //console.log("eq2x", xa, p3.x, xb)
        if (p3.x < xa || p3.x > xb) {
            return null
        }

        const y = eq1[0] * p3.x + eq1[1]
        const [ya, yb] = [p3.y, p4.y].sort((a,b)=>a-b);

        //console.log("eq2y", ya, y, yb)
        if (y < ya || y > yb) {
            return null
        }

        return {point: {x: p3.x, y}, tangent: eq2}

    } else {

        const denominator = (eq1[0] - eq2[0])
        const numerator = (eq2[1] - eq1[1])
        if (denominator == 0) {
            // lines are parellel
            return null
        }
        const x = numerator / denominator
        const y = eq1[0] * x + eq1[1]
        const [a, b] = [p1.x, p2.x].sort((a,b)=>a-b);

        if (x < a || x > b) {
            return null
        }

        return {point: {x, y}, tangent: eq2}
    }
}

// p1 is the current (or previous) position of a point sized object
// p2 is the next (or current) position of the same object
// a line is y = ax^2 + b stored as [a, b]
// a curve is y = ax^2 + bx + c stored as [a, b, c]
// interval is the x range that is valid [x1, x2] for the given curve
export function intercept_curve(p1, p2, curve_eq, interval) {

    let collision_points = [];
    let x1, y1;
    if (p1.x === p2.x) {

        if (p1.x < interval[0] || p1.x > interval[1]) {
            return null
        }

        x1 = p1.x
        y1 = curve_eq[0] * x1 * x1 + curve_eq[1] * x1 + curve_eq[2]

        const [a, b] = [p1.y, p2.y].sort((a,b)=>a-b);
        if (y1 < a || y1 > b) {
            return null
        }

    } else {

        const line_eq = solve_linear(p1, p2)

        // solve for when y1 == y2
        const ap = curve_eq[0],
              bp = curve_eq[1] - line_eq[0],
              cp = curve_eq[2] - line_eq[1];

        // find the x coordinate, if any where the lines collide
        // todo: if ap != 0
        // check that the lines exist within the bound
        const intercept_roots = quadform(ap, bp, cp).filter((x) =>{
            return x >= interval[0] && x <= interval[1]
        })

        if (intercept_roots.length == 0) {
            return null;
        }

        const cmp = (a, b) => distance(p1, a.point) - distance(p1, b.point);
        root = intercept_roots.sort(cmp)[0]

        // find the collision point.
        x1 = root;
        y1 = line_eq[0]*x1 + line_eq[1];
    }

    // find the tangent line to the curve
    // first derivative of the curve equation
    const mt = 2 * curve_eq[0] * x1 + curve_eq[1];
    const bt = - mt * x1 + y1;

    // compute the normal vector by finding a vector of magnitude 1
    // pointing back in the direction of the source point of the object

    //return {point: {x: x1, y:y1}, tangent: {m:mt, b: bt}}
    return {point: {x: x1, y:y1}, tangent: [mt, bt]}
}

export function intercept_circle(p1, p2, center, radius) {

    let intercept_points = [];

    // equations beyond this point were solved assuming the center
    // of the circle is at the origin. this makes the math easier
    p1 = {x: p1.x - center.x, y: p1.y - center.y}
    p2 = {x: p2.x - center.x, y: p2.y - center.y}

    if (p1.x == p2.x) {
        // special case: vertical line
        const delta = radius * radius - p1.x * p1.x
        if (delta >= 0) {
            const ya = + Math.sqrt(radius * radius - p1.x * p1.x)
            const yb = - Math.sqrt(radius * radius - p1.x * p1.x)

            // TODO: validate interval of line segment
            intercept_points = [{x: p1.x, y: ya}, {x: p1.x, y: yb}]
        }
    } else {
        const line_eq = solve_linear(p1, p2)

        // mx + b = sqrt(r*r - x*x)
        const ap = line_eq[0] * line_eq[0] + 1
        const bp = 2 * line_eq[1] * line_eq[0]
        const cp = line_eq[1] * line_eq[1] - radius * radius

        const intercept_roots = quadform(ap, bp, cp)

        if (intercept_roots.length == 0) {
            return null;
        }

        intercept_roots[0]
        // TODO: validate interval of line segment
        intercept_points = intercept_roots.map(
            // TODO: this is a bug in the daedalus compiler
            // workaround is to wrap the object in parens
            r => ({x: r, y: line_eq[0] * r + line_eq[1]})
        )
    }

    if (intercept_points.length == 0) {
        return null;
    }

    // find the point closest to p1
    let point;
    if (intercept_points.length == 2) {
        const d1 = distance(p1, intercept_points[0])
        const d2 = distance(p1, intercept_points[1])
        point = (d1 < d2)?intercept_points[0]:intercept_points[1]
    } else {
        point = intercept_points[0]
    }

    // translate back to the original coordinate system
    point = {x: point.x + center.x, y: point.y + center.y}


    let tangent
    if (center.y == point.y) {
        tangent = [point.x]
    } else if (center.x == point.x) {
        tangent = [0, point.y + center.y]
    } else {
        // get the equation of a line perpendicular to the tangent at point
        const perp_eq = solve_linear(center, point)
        const mt = - 1 / perp_eq[0]
        const bt = point.y - mt * point.x
        tangent = [mt, bt]
    }


    return {point, tangent}
}

// a shape is a sequence of {type, ...}
export function intercept_shape(p1, p2, shape) {

    const collisions = shape.map((segment, index) => {
        let x = null;
        switch (segment.type) {
            case "line":
                x = intercept_line(p1, p2, segment.p1, segment.p2);
                //console.log("shape-line", index, x)
                break;
            case "curve":
                x = intercept_curve(p1, p2, segment.curve, segment.interval);
                //console.log("shape-curve", index, x)
                break;
            case "circle":
                x = intercept_circle(p1, p2, segment.center, segment.radius);
                //console.log("shape-circle", index, x)
                break;
            default:
                break;
        }

        if (x != null) {
            x.type = segment.type
        }
        return x;

    }).filter(x => x !== null)

    if (collisions.length === 0) {
        return null
    }

    const cmp = (a, b) => distance(p1, a.point) - distance(p1, b.point)
    const result = collisions.sort(cmp)[0]
    console.log("final", result)
    return result

}

function dot2(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1]
}

// v: a vector
// n: a normal vector (perpendicular to an intercept)
// v' = 2(v*n)n - v
export function reflect(v, n) {
    const scale = 2 * dot2(v, n)
    return [v[0] - scale * n[0], v[1] - scale * n[1]]
}


export function compute_normal(p, x1, y1, tanget_eq) {
    // find a perpendicular line to the tangent

    const mt = tanget_eq[0];
    const bt = tanget_eq[1];

    // line perpendicular to the tangent
    if (tanget_eq.length == 1) {
        // a vertical line
        const hdir = compute_vector(p, {x: x1, y: y1})
        return (hdir[0] >= 0)?[-1, 0]:[1, 0]
    } else if (tanget_eq[0] == 0) {
        // a horizontal line
        const vdir = compute_vector(p, {x: x1, y: y1})
        return (vdir[1] >= 0)?[0, -1]:[0, 1]
    }

    // some other line
    const mp = - 1 / tanget_eq[0];
    const bp = y1 - mp * x1;

    const xa = (x1 - 1)
    const xb = (x1 + 1)

    const ya = mp * xa + bp
    const yb = mp * xb + bp

    const dx = 2 // xb - xa
    const dy = yb - ya

    // find the point closes to p

    const d1 = distance(p, {x: x1 + dx, y: y1 + dy})
    const d2 = distance(p, {x: x1 - dx, y: y1 - dy})

    // compute the normal vector

    let n;

    if (d1 < d2) {
        n = [dx, dy]
    } else {
        n = [-dx, -dy]
    }

    // scale to a magnitude of 1
    const nm = Math.sqrt(n[0] * n[0] + n[1] * n[1]);
    n = [n[0] / nm, n[1] / nm];


    return n
}


// a degenerate curve with a=0 is a line, but quadform cannot be used

// on  a flat wall
// traveling up and to the right is (-2, 2)
// the normal would be (0, 1)
// the new direction would be (2, 2)