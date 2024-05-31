


import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    PlatformerEntity,
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"

import {gAssets} from "@troid/store"

import {registerDefaultEntity} from "@troid/entities/sys"


export function random_choice(choices) {
    let index = Math.floor(Math.random() * choices.length);
    return choices[index];
}


export function init_velocity() {
    // generate the velocity profile for a bullet moving
    // forward at a constant velocity, even if traveling in
    // a sin pattern. generate three profiles for no wave
    // positive, and negative sin. generate an additional
    // three profiles that are rotate 45 degrees up.
    // the six profiles can be mirrored about the x axis.

    // rotate a point by angle in radians (positive numbers are clock wise)
    const rotate  = (p,a) => ({
        x: Math.cos(a) * p.x - Math.sin(a) * p.y,
        y: Math.sin(a) * p.x + Math.cos(a) * p.y,
    })
    // rotate a list of points
    const rotatelist = (seq, a) => seq.map(x => rotate(x, a))
    // get the difference for each point in the list
    const get_velocity = (seq) => seq.slice(1).map((p, i) => ({x: p.x - seq[i].x, y: p.y - seq[i].y}))
    // mirror x coordinate
    const flip = (seq) => seq.map(p=>({x:-p.x, y:p.y}))

    // the number of points to sample
    const period = 20
    // velocity is pixels per frame
    const velocity = 300/60 * 2
    // bullet will move perpendicular to the
    // direction by +/- half the amplitude
    const wave_amplitude = 12
    const spread_amplitude = 8

    // time (frame tick)
    const t = [...Array(period + 1).keys()]
    // position data. x and y position
    const x0 = t.map(i=> velocity*i)
    // no wave motion
    const y1 = t.map(i=> 0)
    // positive sin wave
    const y2w = t.map(i=> +wave_amplitude*Math.sin(i/period * Math.PI * 2))
    const y2s = t.map(i=> +spread_amplitude*Math.sin(i/period * Math.PI * 2))
    // negative sin wave
    const y3w = t.map(i=> -wave_amplitude*Math.sin(i/period * Math.PI * 2))
    const y3s = t.map(i=> -spread_amplitude*Math.sin(i/period * Math.PI * 2))

    const p1 = x0.map((v,i)=>({x:v,y:y1[i]})) //zip
    const p2w = x0.map((v,i)=>({x:v,y:y2w[i]})) //zip
    const p2s = x0.map((v,i)=>({x:v,y:y2s[i]})) //zip
    const p3w = x0.map((v,i)=>({x:v,y:y3w[i]})) //zip
    const p3s = x0.map((v,i)=>({x:v,y:y3s[i]})) //zip

    const v1 = get_velocity(p1)
    const v2w = get_velocity(p2w)
    const v2s = get_velocity(p2s)
    const v3w = get_velocity(p3w)
    const v3s = get_velocity(p3s)

    const p4 = rotatelist(p1, -45*Math.PI/180)
    const p5w = rotatelist(p2w, -45*Math.PI/180)
    const p5s = rotatelist(p2s, -45*Math.PI/180)
    const p6w = rotatelist(p3w, -45*Math.PI/180)
    const p6s = rotatelist(p3s, -45*Math.PI/180)

    const v4 = get_velocity(p4)
    const v5w = get_velocity(p5w)
    const v5s = get_velocity(p5s)
    const v6w = get_velocity(p6w)
    const v6s = get_velocity(p6s)

    const vspread2_h_00 = v1
    const vspread2_h_22a = get_velocity(rotatelist(p1, -15*Math.PI/180))
    const vspread2_h_22b = get_velocity(rotatelist(p1,  15*Math.PI/180))
    const vspread2_h_45a = get_velocity(rotatelist(p1, -30*Math.PI/180))
    const vspread2_h_45b = get_velocity(rotatelist(p1,  30*Math.PI/180))

    const vspread2_d_00 = v4
    const vspread2_d_22a = get_velocity(rotatelist(p4, -15*Math.PI/180))
    const vspread2_d_22b = get_velocity(rotatelist(p4,  15*Math.PI/180))
    const vspread2_d_45a = get_velocity(rotatelist(p4, -30*Math.PI/180))
    const vspread2_d_45b = get_velocity(rotatelist(p4,  30*Math.PI/180))

    // profiles have the pattern [straight, wave-up, wave-down]
    // each list is the velocity to apply in a looping fashion on each time step

    // when firing one projectile, any of the splits could be used
    // when firing two projectiles, each uses one of the second or third splits
    // when firing three projectiles, each uses one of the splits

    // this profile loops. creating a wave effect
    Bullet.velocity_profile_wave = {
        [Direction.RIGHT]: [v1.slice(0,1), v2w, v3w],
        [Direction.UPRIGHT]: [v4.slice(0,1), v5w ,v6w],
        [Direction.LEFT]: [flip(v1.slice(0,1)), flip(v2w), flip(v3w)],
        [Direction.UPLEFT]: [flip(v4.slice(0,1)), flip(v5w), flip(v6w)],
    }
    Bullet.velocity_profile_wave[Direction.LEFT] = Bullet.velocity_profile_wave[Direction.RIGHT].map(x => flip(x))
    Bullet.velocity_profile_wave[Direction.UPLEFT] = Bullet.velocity_profile_wave[Direction.UPRIGHT].map(x => flip(x))

    // this profile does not loop
    // bullets spread apart and then fly straight
    // spread takes the first 25% of a wave sequence (the part where the bullet
    // moves up or down). then concats the constant velocity from the first split
    const spread = (seq, p) => seq.slice(0, Math.floor(seq.length/4)).concat(p)
    Bullet.velocity_profile_spread = {
        [Direction.RIGHT]: [v1.slice(0,1), spread(v2s, v1[0]), spread(v3s, v1[0])],
        [Direction.UPRIGHT]: [v4.slice(0,1), spread(v5s, v4[0]), spread(v6s, v4[0])],
    }
    Bullet.velocity_profile_spread[Direction.LEFT] = Bullet.velocity_profile_spread[Direction.RIGHT].map(x => flip(x))
    Bullet.velocity_profile_spread[Direction.UPLEFT] = Bullet.velocity_profile_spread[Direction.UPRIGHT].map(x => flip(x))


    // up to 5 projectiles covering 60 degrees.
    Bullet.velocity_profile_spread2 = {
        [Direction.RIGHT]:   [vspread2_h_00.slice(0,1), vspread2_h_22a.slice(0,1), vspread2_h_22b.slice(0,1), vspread2_h_45a.slice(0,1), vspread2_h_45b.slice(0,1)],
        [Direction.UPRIGHT]: [vspread2_d_00.slice(0,1), vspread2_d_22a.slice(0,1), vspread2_d_22b.slice(0,1), vspread2_d_45a.slice(0,1), vspread2_d_45b.slice(0,1)],
    }
    Bullet.velocity_profile_spread2[Direction.LEFT] = Bullet.velocity_profile_spread2[Direction.RIGHT].map(x => flip(x))
    Bullet.velocity_profile_spread2[Direction.UPLEFT] = Bullet.velocity_profile_spread2[Direction.UPRIGHT].map(x => flip(x))

}


