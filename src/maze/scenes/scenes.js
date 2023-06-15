// TODO: center camera on hero at start
// TODO: boss door lock should also create a camera lock
//       lock keeps the camera centered on the arena
//       defeating the boss disables the lock
from module engine import {
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SpriteSheetBuilder, SpriteSheet,
    ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene
}

const RES_ROOT = "static"

class Camera extends CameraBase {
    constructor(map, target) {
        super()
        this.map = map
        this.target = target

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

    resize() {
        this.width = gEngine.view.width
        this.height = gEngine.view.height
    }

    update(dt) {

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
        let xborder1 = 160
        let xborder2 = 128
        let yborder1 = 96
        let yborder2 = 64
        let wnd = new Rect(
            this.x + xborder1,
            this.y + yborder1,
            this.width - xborder1 - xborder2,
            this.height - yborder1 - yborder2)
        //console.log(wnd, this.width, this.height)
        this.active_border = wnd

        let x,y;

        if (this.target.rect.cx() < wnd.left()) {
            x = this.target.rect.cx() - xborder1
        }
        else if (this.target.rect.cx() > wnd.right()) {
            x = this.target.rect.cx() + xborder2 - this.width
        } else {
            x = this.x
        }

        if (this.target.rect.cy() < wnd.top()) {
            y = this.target.rect.cy() - yborder1
        }
        else if (this.target.rect.cy() > wnd.bottom()) {
            y = this.target.rect.cy() + yborder2 - this.height
        } else {
            y = this.y
        }
        // force camera to center hero
        //x = Math.floor(this.target.rect.cx() - gEngine.view.width/2)
        //y = Math.floor(this.target.rect.cy() - gEngine.view.height/2)
        if (x < 0) { x = 0 }
        if (y < -32) { y = -32 }

        let mx = this.map.width - gEngine.view.width
        let my = this.map.height - gEngine.view.height/2
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

class Controller {
    constructor(scene, target) {
        this.scene = scene
        this.target = target
        this.direction = 0

    }

    setInputDirection(whlid, v) {
        this.direction = Direction.fromVector(v.x, v.y)
        this.target.setDirection(this.direction)
    }

    handleButtonPress(btnid) {
        if (btnid === 0) {

            if (this.scene.bombs.length < 3) {

                let bomb = new Bomb(this.scene.loader.sheets.bomb)
                bomb.sound_bomb_bang = this.scene.loader.sounds.explode
                bomb.physics.group = this.scene.walls
                bomb.rect.x = Math.floor(this.scene.ent_hero.rect.x/32)*32 + 8 // + 8
                bomb.rect.y = Math.floor(this.scene.ent_hero.rect.y/32)*32 + 8 // + 8
                bomb.rect.w = 16
                bomb.rect.h = 16
                bomb.targets = [this.scene.ent_hero, ...this.scene.npcs]
                this.scene.bombs.push(bomb)
                this.scene.loader.sounds.drop.play()
            }



        } else if (btnid === 1) {
            this.target.attack()
        }

    }

    handleButtonRelease(btnid) {

    }

    update(dt) {

        let speed = 128;
        let v = Direction.vector(this.direction)

        this.target.physics.xspeed = speed*v.x;
        this.target.physics.yspeed = speed*v.y;

    }
}

class Wall extends Entity {
    constructor(sheet) {
        super()
        this.sheet = sheet
        this.breakable = 0
        this.alive = 1
        this.solid = 1
    }

    paint(ctx) {

        let l = this.rect.x
        let t = this.rect.y
        let r = this.rect.x+this.rect.w
        let b = this.rect.y+this.rect.h

        //ctx.beginPath();
        //ctx.lineWidth = "6";
        //ctx.strokeStyle = "red";
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.stroke();

        for (let x=l; x<r; x+=32) {
            for (let y=t; y<b; y+=32) {
                this.sheet.drawTile(ctx, this.breakable?2:1, x, y)
            }
        }
    }
}

function setCharacterSpriteSheet(target, sheet, hero) {

    target.sheet = sheet
    let aidd = target.animation.register(sheet, [ 0, 1], .15, {xoffset:-8, yoffset:-16})
    let aidu = target.animation.register(sheet, [ 4, 5], .15, {xoffset:-8, yoffset:-16})
    let aidl = target.animation.register(sheet, [ 8, 9], .15, {xoffset:-8, yoffset:-16})
    let aidr = target.animation.register(sheet, [12,13], .15, {xoffset:-8, yoffset:-16})

    target.d2a = {
        [Direction.UP]: aidu,
        [Direction.RIGHT]: aidr,
        [Direction.DOWN]: aidd,
        [Direction.LEFT]: aidl,
    }

    if (hero) {
        let aidd_atk = target.animation.register(sheet, [ 2,], .4, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})
        let aidu_atk = target.animation.register(sheet, [ 6,], .4, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})
        let aidl_atk = target.animation.register(sheet, [10,], .4, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})
        let aidr_atk = target.animation.register(sheet, [14,], .4, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})

        target.d2a_atk = {
            [Direction.UP]: aidu_atk,
            [Direction.RIGHT]: aidr_atk,
            [Direction.DOWN]: aidd_atk,
            [Direction.LEFT]: aidl_atk,
        }

        let sw = 20
        let sh = 24
        let so = (32 - sh)/2
        target.d2a_atk_tid =  {
            [Direction.UP]:       {tid: 7,  x:-8 +  0,   y:-16 + -32 + 1, rx:-8 + so,   ry:-16 + -sw, w: sh, h: sw},
            [Direction.RIGHT]:    {tid: 15, x:-8 + 32 + 1,   y:-16 +   0, rx:-8 + 32,   ry:-16 +  so, w: sw, h: sh},
            [Direction.DOWN]:     {tid: 3,  x:-8 +  0,   y:-16 +  32, rx:-8 + so,   ry:-16 +  32, w: sh, h: sw},
            [Direction.LEFT]:     {tid: 11, x:-8 + -32,  y:-16 +   0, rx:-8 + -sw,  ry:-16 +  so, w: sw, h: sh},
        }

    }

    target.animation.setAnimationById(aidd)
    target.animation.pause()
    target.current_aid = aidd
}

class Hero extends Entity {

    constructor() {
        super()
        this.facing = Direction.DOWN

        this.attacking = 0
        this.attacking_tid = 0
        this.attacking_info = null
        this.mobs = []

        this.character = new CharacterComponent(this)

    }

    setDirection(d) {
        if (!this.attacking) {

            if (d > 0) {

                if ((this.facing & d) == 0) {
                    if (d&Direction.UPDOWN) {
                        this.facing = d&Direction.UPDOWN
                    } else {
                        this.facing = d&Direction.LEFTRIGHT
                    }
                    //console.log("now facing", Direction.name[this.facing])
                }
                this.animation.setAnimationById(this.d2a[this.facing])

            } else {
                this.animation.pause()
            }
        }

    }

    attack() {
        if (this.attacking == 0) {
            this.attacking = 1
            // determine which sword tile to draw
            this.attacking_info = this.d2a_atk_tid[this.facing]
            this.animation.setAnimationById(this.d2a_atk[this.facing])
            let rect = new Rect(
                this.rect.x+this.attacking_info.rx,
                this.rect.y+this.attacking_info.ry,
                this.attacking_info.w,
                this.attacking_info.h)
            this.attacking_info.rect = rect

            for (let i=0; i < this.mobs.length; i++) {
                if (rect.collideRect(this.mobs[i].rect)) {
                    this.mobs[i].character.hit(1, this.facing)
                }
            }

            this.sound_sword.play()
        }

    }

    handleAttackEnd() {
        this.attacking = 0
        this.animation.setAnimationById(this.d2a[this.facing])
        this.attacking_info = null
        // FIXME floating point compare (pause if facing is 0?)
        if (this.physics.xspeed === 0 && this.physics.yspeed === 0) {
            this.animation.pause()
        }
    }

    update(dt) {

        if (!this.attacking) {
            this.physics.update(dt)

            if (this.physics.collisions.size==1) {
                let ent = this.physics.collisions.values().next().value
                if (!!ent.pressable) {
                    ent.handlePress()
                }
            }
        }
        this.animation.update(dt)
        this.character.update(dt)


    }

    paint(ctx) {

        this.animation.paint(ctx)

        if (this.attacking) {
            let obj = this.attacking_info
            this.sheet.drawTile(ctx, obj.tid, this.rect.x + obj.x, this.rect.y + obj.y)
        }

        /*
        if (this.attacking_info) {
            ctx.save()
            ctx.beginPath();
            ctx.fillStyle = "#000000FF";
            let r = this.attacking_info.rect
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.fill()
            ctx.restore()
        }
        */

    }
}


const NPC_DIRECTIONS = [
    Direction.UP,
    Direction.RIGHT,
    Direction.DOWN,
    Direction.LEFT,
]

class MonsterController {

    constructor(target) {
        this.target = target
        this.timeout = 1.0
        this.timer = this.timeout - 0.5 // start half second after level starts ???
        this.direction = 0
    }
    update(dt) {

        this.timer += dt

        if (this.timer > this.timeout) {
            this.timer -= this.timeout

            // random chance to not change direction
            if (this.target.physics.xspeed != 0 && this.target.physics.yspeed != 0) {
                if (Math.random() < 0.5) {
                    return
                }
            }

            let options = []
            for (let i=0; i < NPC_DIRECTIONS.length; i++) {
                let v = Direction.vector(NPC_DIRECTIONS[i])
                if (!this.target.physics.collidePoint(
                        this.target.rect.x + v.x*24,
                        this.target.rect.y + v.y*24)
                   ) {
                    options.push(NPC_DIRECTIONS[i])
                }
            }

            // prevent monster from reversing direction
            if (options.length > 1) {
                var index = options.indexOf(Direction.flip[this.direction]);
                if (index >= 0) {
                    options.splice(index, 1);
                }
            }

            let i = randomRange(0,options.length)
            let d = options[i]
            let v = Direction.vector(options[i])

            this.direction = d
            this.target.physics.xspeed = 70 * v.x
            this.target.physics.yspeed = 70 * v.y
            this.target.animation.setAnimationById(this.target.d2a[d])

        }

    }
}

class Monster extends Entity {

    constructor() {
        super()

        this.character = new CharacterComponent(this)

        this.controller = new MonsterController(this)

        this.rect.w = 16
        this.rect.h = 16

    }

    update(dt) {

        this.controller.update(dt)

        this.physics.update(dt)

        if (this.physics.collide) {
            this.physics.xspeed = 0
            this.physics.yspeed = 0
            this.controller.timer = this.controller.timeout + 1
            this.animation.pause()
        }

        if (gEngine.scene.ent_hero.rect.collideRect(this.rect)) {
            gEngine.scene.ent_hero.character.hit(1, Direction.NONE)
        }

        this.character.update(dt)
        this.animation.update(dt)
    }

    paint(ctx) {

        this.animation.paint(ctx)

    }
}

class Fireball extends Entity {


    constructor(sheet, ydelta) {
        super()
        this.alive = 1
        this.ydelta = ydelta

        let aid = this.animation.register(sheet, [0], 0, {})
        this.animation.setAnimationById(aid)
        this.physics.xspeed = - 96
        this.physics.group = []
    }

    update(dt) {
        this.physics.update(dt)

        if (this.physics.collide) {
            this.alive = 0
        }

        if (this.ydelta < 0) {
            let d = dt*96
            this.rect.y -= d
            this.ydelta += d
            if (this.ydelta >= 0) {
                this.ydelta = 0
            }
        }

        if (this.ydelta > 0) {
            let d = dt*96
            this.rect.y += d
            this.ydelta -= d
            if (this.ydelta <= 0) {
                this.ydelta = 0
            }
        }

        for (const ent of this.targets) {
            if (ent.active && ent.rect.collideRect(this.rect)) {
                ent.character.hit(1, Direction.NONE)
            }
        }

        this.animation.update(dt)
    }

    paint(ctx) {
        this.animation.paint(ctx)

        ctx.fillStyle = "#000000"
        ctx.beginPath()
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ctx.fill
    }
}

class BossController {

    constructor(target) {
        this.target = target
        this.timer = 3

    }

    update(dt) {

        this.timer += dt

        if (this.timer > 4) {
            this.timer = 0
            this.create_fireball()
        }
    }

    create_fireball() {
        let scene = gEngine.scene
        for (const ydelta of [-48, 0, 48]) {
            let ball = new Fireball(scene.loader.sheets.fireball, ydelta)
            ball.sound_bomb_bang = scene.loader.sounds.explode
            ball.physics.group = scene.walls
            ball.rect.x = Math.floor(this.target.rect.x)
            ball.rect.y = Math.floor(this.target.rect.y)
            ball.rect.w = 16
            ball.rect.h = 16
            ball.targets = [scene.ent_hero]
            scene.fireballs.push(ball)
        }

    }
}

class Boss extends Entity {

    constructor() {
        super()

        this.character = new CharacterComponent(this)

        this.controller = new BossController(this)

        this.tile_fireball = null

        this.rect.w = 64
        this.rect.h = 64

    }

    setSpriteSheet(sheet) {
        let aidd = this.animation.register(sheet, [0, 1], .25, {xoffset:0, yoffset:0})
        this.animation.setAnimationById(aidd)
    }

    update(dt) {

        this.controller.update(dt)
        //this.physics.update(dt)
        this.character.update(dt)
        this.animation.update(dt)
    }

    paint(ctx) {

        this.animation.paint(ctx)

    }
}

class Bomb extends Entity {
    constructor(sheet) {
        super(null)
        this.sheet = sheet
        this.alive = 1
        this.timer_max = 4.0
        this.timer = this.timer_max
        this.bounds_check = true
        this.bounds = {l:0, r:0, t:0, b:0}
        this.target_blocks = null
        this.sound_played = false
        this.mob_checked = false
    }

    update(dt) {

        this.timer -= dt

        if (this.bounds_check && this.timer < 1.2) {

            this.bounds_check = false

            let cx = this.rect.x + this.rect.w/2
            let cy = this.rect.y + this.rect.h/2

            let blocks = new Set()

            let rng = 6

            for (let i=1; i<rng; i++) {
                let obj = this.physics.collidePoint(cx-i*16,cy)
                if (obj && obj.breakable) {
                    blocks.add(obj)
                } else if (obj) {
                    break
                }
                this.bounds.l = i
            }

            for (let i=1; i<rng; i++) {
                let obj = this.physics.collidePoint(cx,cy-i*16)
                if (obj && obj.breakable) {
                    blocks.add(obj)
                } else if (obj) {
                    break
                }
                this.bounds.t = i
            }

            for (let i=1; i<rng; i++) {
                let obj = this.physics.collidePoint(cx+i*16,cy)
                if (obj && obj.breakable) {
                    blocks.add(obj)
                } else if (obj) {
                    break
                }
                this.bounds.r = i
            }

            for (let i=1; i<rng; i++) {
                let obj = this.physics.collidePoint(cx,cy+i*16)
                if (obj && obj.breakable) {
                    blocks.add(obj)
                } else if (obj) {
                    break
                }
                this.bounds.b = i
            }

            this.target_blocks = blocks
        }

        if (this.timer < 1 && !this.sound_played) {
            this.sound_bomb_bang.play()
            this.sound_played = true
        }

        if (!this.mob_checked && this.timer < .6) {

            let cx = this.rect.x + this.rect.w/2
            let cy = this.rect.y + this.rect.h/2

            let rhl = 16 * this.bounds.l
            let rht = 16 * this.bounds.t
            let rhr = 16 * this.bounds.r
            let rhb = 16 * this.bounds.b
            let rw = 6;

            // determine the two collision rectangles
            let rect1 = new Rect(cx - rhl, cy - rw, (cx+rhr) - (cx - rhl), rw*2)
            let rect2 = new Rect(cx - rw, cy - rht, rw*2, (cy+rhb) - (cy - rht))

            //let chars = []
            for (let i=0; i<this.targets.length; i++) {
                let chara = this.targets[i];
                if (chara.rect.collideRect(rect1) || chara.rect.collideRect(rect2)) {
                    chara.character.hit(3, Direction.NONE)
                    //chars.push(char)
                }
            }

            this.mob_checked = true
        }

        if (this.target_blocks && this.timer < .6) {
            this.target_blocks.forEach(item => item.alive = 0)
            this.target_blocks = null
        }

        if (this.timer < 0) {
            this.alive = 0
        }
    }

    paint(ctx) {

        if (this.timer > 1.0) {

            // a number between 0 and 1
            let x = 1 - this.timer % 1
            // number of peaks per period
            let n = this.timer_max - Math.floor(this.timer)
            // duration of period in seconds
            let p = 1.0
            // magnitude at time x
            let m = 1.0 + .4*Math.sin(2*Math.PI*x*n/p)
            ctx.save()
            ctx.filter = `brightness(${Math.floor(m*100)}%)`;
            this.sheet.drawTile(ctx, 0, this.rect.x, this.rect.y)
            ctx.restore()
        } else if (this.timer > 0) {

            let x;
            let cx, cy, cr;
            let rw, rh;

            ctx.save()
            if (this.timer > 0.25) {
                x = (1 - this.timer) / .75
                cx = this.rect.x + this.rect.w/2
                cy = this.rect.y + this.rect.h/2
                cr = 14 * (0.5 + x/2)
                rw = 6 * x
                let rhl = 16 * this.bounds.l * x
                let rht = 16 * this.bounds.t * x
                let rhr = 16 * this.bounds.r * x
                let rhb = 16 * this.bounds.b * x

                ctx.fillStyle = `rgb(255, ${127+128*x}, ${255*x})`;
                ctx.beginPath();
                ctx.arc(cx, cy, cr, 0,2*Math.PI);
                ctx.roundRect(cx - rhl, cy - rw, rhl, 2*rw, rw)
                ctx.roundRect(cx - rw , cy - rht, 2*rw, rht, rw)
                ctx.roundRect(cx     , cy - rw, rhr, 2*rw, rw)
                ctx.roundRect(cx - rw , cy     , 2*rw, rhb, rw)
                ctx.fill();


                cr = 9 * (0.5 + x/2)
                rw = 3 * x


                ctx.fillStyle = `rgb(255, ${191+64*x}, ${255*x})`;
                ctx.beginPath();
                ctx.arc(cx, cy, cr, 0,2*Math.PI);
                ctx.roundRect(cx - rhl, cy - rw, rhl, 2*rw, rw)
                ctx.roundRect(cx - rw , cy - rht, 2*rw, rht, rw)
                ctx.roundRect(cx     , cy - rw, rhr, 2*rw, rw)
                ctx.roundRect(cx - rw , cy     , 2*rw, rhb, rw)
                ctx.fill();

            } else {
                x = .75 * (this.timer / .25)
                cx = this.rect.x + this.rect.w/2
                cy = this.rect.y + this.rect.h/2
                cr = 14 * (0.3 + 2*x/3)
                rw = 6 * x
                let rhl = 16 * this.bounds.l
                let rht = 16 * this.bounds.t
                let rhr = 16 * this.bounds.r
                let rhb = 16 * this.bounds.b

                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.arc(cx, cy, cr, 0,2*Math.PI);
                ctx.roundRect(cx - rhl, cy - rw, rhl, 2*rw, rw)
                ctx.roundRect(cx - rw , cy - rht, 2*rw, rht, rw)
                ctx.roundRect(cx     , cy - rw, rhr, 2*rw, rw)
                ctx.roundRect(cx - rw , cy     , 2*rw, rhb, rw)
                ctx.fill();

            }
            ctx.restore()

        }

        /*
        let cx = this.rect.x + this.rect.w/2
        let cy = this.rect.y + this.rect.h/2

        let rhl = 16 * this.bounds.l
        let rht = 16 * this.bounds.t
        let rhr = 16 * this.bounds.r
        let rhb = 16 * this.bounds.b
        let rw = 6;

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.roundRect(cx - rhl, cy - rw, (cx+rhr) - (cx - rhl), rw*2)
        ctx.roundRect(cx - rw, cy - rht, rw*2, (cy+rhb) - (cy - rht))
        //ctx.roundRect()
        ctx.fill();
        */


    }
}

// doors toggle the solid property to control locked/unlocked
// unlocked doors are not painted
// doors can be killed, and removed from the map
// or remain alive and not solid to be locked again later
class BossDoor extends Entity {

    constructor(tile) {
        super()
        this.tile = tile
        this.breakable = 0
        this.alive = 1
        this.solid = 1
        this.pressable = 1
    }

    handlePress() {

        if (this.solid && gEngine.scene.inventory.boss_key>0) {
            this.solid = 0
            gEngine.scene.inventory.boss_key = 0
            gEngine.scene.loader.sounds.door.play()
        }

    }

    update(dt) {

    }

    paint(ctx) {

        if (this.solid) {
            this.tile.draw(ctx, this.rect.x, this.rect.y)
        }
    }
}

class BossChest extends Entity {

    constructor(tile_open, tile_closed) {
        super()
        this.tile_open = tile_open
        this.tile_closed = tile_closed
        this.breakable = 0
        this.alive = 1
        this.solid = 1
        this.pressable = 1
        this.open = 0
    }

    handlePress() {
        if (!this.open) {
            this.open = 1
            gEngine.scene.inventory.boss_key = 1
            gEngine.scene.loader.sounds.item.play()
        }
    }

    update(dt) {

    }

    paint(ctx) {

        if (this.open) {
            this.tile_open.draw(ctx, this.rect.x, this.rect.y)
        } else {
            this.tile_closed.draw(ctx, this.rect.x, this.rect.y)
        }
    }
}

class BossDoorLock extends Entity {

    constructor(targetcbk) {
        super()
        this.breakable = 0
        this.solid = 0
        this.alive = 1
        this.targetcbk = targetcbk
    }

    update(dt) {

        let tgt = this.targetcbk()
        if (!!tgt) {
            let cx = tgt.rect.cx()
            let cy = tgt.rect.cy()
            // this lock only works if the hero is walking right
            if (tgt.rect.x > this.rect.x && !!this.rect.collidePoint(cx, cy)) {
                this.alive = 0
                for (let i=0; i < this.physics.group.length; i++) {
                    let ent = this.physics.group[i]
                    if (ent instanceof BossDoor) {
                        gEngine.scene.loader.sounds.door.play()
                        ent.solid = 1;
                        break
                    }
                }

            }
        }
    }

    paint(ctx) {
        //ctx.fillStyle = "#dd00dd44"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.fill()
    }
}


export class MainScene extends GameScene {

    constructor(mapdata) {
        super();

        this.mapdata = mapdata

        this.map = {ready: false}
        this.build_loader()

    }

    build_loader() {

        this.loader = new ResourceLoader()

        this.loader.addSoundEffect("hit").path(RES_ROOT + "/sound/LOZ_Enemy_Hit.wav")
        this.loader.addSoundEffect("death").path(RES_ROOT + "/sound/LOZ_Link_Die.wav")
        this.loader.addSoundEffect("hurt").path(RES_ROOT + "/sound/LOZ_Link_Hurt.wav")
        this.loader.addSoundEffect("slash").path(RES_ROOT + "/sound/LOZ_Sword_Slash.wav");
        this.loader.addSoundEffect("drop").path(RES_ROOT + "/sound/LOZ_Bomb_Drop.wav");
        this.loader.addSoundEffect("explode").path(RES_ROOT + "/sound/LOZ_Bomb_Blow.wav");
        this.loader.addSoundEffect("item").path(RES_ROOT + "/sound/LOZ_Get_Item.wav");
        this.loader.addSoundEffect("door").path(RES_ROOT + "/sound/LOZ_Door_Unlock.wav");

        this.loader.addSpriteSheet("bg")
            .path(RES_ROOT + "/tile2.png")
            .dimensions(32, 32)
            .layout(2, 6)
            .build()

        this.loader.addSpriteSheet("bomb")
            .path(RES_ROOT + "/bomb.png")
            .dimensions(16, 16)
            .layout(3, 1)
            .build()

        this.loader.addSpriteSheet("fireball")
            .path(RES_ROOT + "/fireball.png")
            .dimensions(32, 32)
            .layout(1, 1)
            .build()

        this.loader.addSpriteSheet("hero")
            .path(RES_ROOT + "/char32.png")
            .dimensions(32, 32)
            .layout(4, 4)
            .offset(1, 1)
            .spacing(1, 1)
            .build()

        this.loader.addSpriteSheet("boss")
            .path(RES_ROOT + "/boss.png")
            .dimensions(64, 64)
            .layout(1, 2)
            .offset(2, 2)
            .spacing(2, 2)
            .build()

        this.loader.addSpriteSheet("monster")
            .path(RES_ROOT + "/monster32.png")
            .dimensions(32, 32)
            .layout(4, 4)
            .offset(1, 1)
            .spacing(1, 1)
            .build()

    }

    build_map() {

        this.bombs = []
        this.fireballs = []

        this.map = {width: this.mapdata.width*32, height: this.mapdata.height*32, ready:true}

        this.walls = []
        this.mapdata.walls.forEach(item => {
            let wall = new Wall(this.loader.sheets.bg)
            wall.rect = new Rect(item.x*32, item.y*32, item.w*32, item.h*32)
            this.walls.push(wall)
        })

        this.mapdata.breakable_walls.forEach(item => {
            let wall = new Wall(this.loader.sheets.bg)
            wall.rect = new Rect(item.x*32, item.y*32, item.w*32, item.h*32)
            wall.breakable = 1
            this.walls.push(wall)
        })

        this.npcs = []
        this.mapdata.npcs.forEach(item => {
            if (item.type==0) {
                let ent = new Monster()
                setCharacterSpriteSheet(ent, this.loader.sheets.monster, false)
                ent.sound_hit = this.loader.sounds.hit
                ent.rect.x = item.x*32 + 8
                ent.rect.y = item.y*32 + 16
                ent.physics.group = this.walls
                this.npcs.push(ent)
            }
            if (item.type==1) {
                let ent = new Boss()
                ent.setSpriteSheet(this.loader.sheets.boss)
                ent.sound_hit = this.loader.sounds.hit
                ent.rect.x = item.x*32 - 16
                ent.rect.y = item.y*32 - 16
                ent.character.health = 9
                ent.physics.group = this.walls
                this.npcs.push(ent)
            }
        })

        this.mapdata.chests.forEach(item => {
            if (item.type == 2) {
                let wall = new BossChest(
                    this.loader.sheets.bg.tile(7),
                    this.loader.sheets.bg.tile(6))
                wall.rect = new Rect(item.x*32, item.y*32, 32, 32)
                wall.solid = 1
                this.walls.push(wall)
            }
        })
        this.mapdata.doors.forEach(item => {

            if (item.type == 2) {
                let wall = new BossDoor(this.loader.sheets.bg.tile(11))
                wall.rect = new Rect(item.x*32, item.y*32, 32, 32)
                wall.solid = 1
                wall.physics.group = this.walls
                this.walls.push(wall)
            }

            if (item.type == 3) {
                let wall = new BossDoorLock(()=>{return this.ent_hero})
                wall.rect = new Rect(item.x*32, item.y*32, 32, 32)
                wall.physics.group = this.walls
                this.walls.push(wall)
            }

        })

        this.ent_hero = new Hero()
        setCharacterSpriteSheet(this.ent_hero, this.loader.sheets.hero, true)
        this.ent_hero.sound_sword = this.loader.sounds.slash
        this.ent_hero.sound_death = this.loader.sounds.death
        this.ent_hero.sound_hit = this.loader.sounds.hurt

        this.controller = new Controller(this, this.ent_hero)
        this.touch = new TouchInput(this.controller)

        this.touch.button_icons = [
            this.loader.sheets.bomb.tile(0),
            this.loader.sheets.bomb.tile(1)
        ]

        this.keyboard = new KeyboardInput(this.controller);
        this.camera = new Camera(this.map, this.ent_hero)

        this.ent_hero.physics.group = this.walls
        this.ent_hero.mobs = this.npcs
        this.ent_hero.rect.x = this.mapdata.start.x*32 + 8
        this.ent_hero.rect.y = this.mapdata.start.y*32 + 16
        this.ent_hero.rect.w = 16
        this.ent_hero.rect.h = 16
        this.ent_hero.character.health = 5

        this.camera.x = this.ent_hero.rect.x - gEngine.view.width/2
        this.camera.y = this.ent_hero.rect.y - gEngine.view.height/2

        this.inventory = {
            boss_key: 0,
        }
    }

    moveMonster(npc) {

        //let x = 128
        //let y = 32
        let mx = Math.floor(this.map.width/32) - 1
        let my = Math.floor(this.map.width/32) - 1
        let x = Math.floor(randomNumber(1, mx)*32)
        let y = Math.floor(randomNumber(1, my)*32)
        while (npc.physics.collidePoint(x + 16, y + 16)) {
            x = Math.floor(randomNumber(1, mx)*32)
            y = Math.floor(randomNumber(1, my)*32)
        }
        npc.rect.x = x + 8
        npc.rect.y = y + 16

    }

    update_active(dt) {

        if (this.camera.dirty) {
            // deactive or cull entities outside of the active region
            // clear the dirty flag once updated.

            let region = this.camera.active_region
            for (let i=this.npcs.length-1; i >= 0; i--) {
                let ent = this.npcs[i]
                ent.active = region.collideRect(ent.rect);
            }

            for (let i=this.walls.length-1; i >= 0; i--) {
                let ent = this.walls[i]
                ent.active = region.collideRect(ent.rect);
            }

            this.camera.dirty = false
        }

    }

    update_map(dt) {
        let skipped = 0

        for (let i=this.npcs.length-1; i >= 0; i--) {
            let npc = this.npcs[i]
            if (!npc.active) {skipped+=1; continue}

            npc.update(dt)

            if (!npc.character.alive) {
                npc.character.health = 3
                npc.character.alive = true
                this.moveMonster(npc)
            }
        }

        for (let i=this.walls.length-1; i >= 0; i--) {
            let ent = this.walls[i]
            if (!ent.active) {skipped+=1; continue}

            ent.update(dt)

            if (!this.walls[i].alive) {
                this.walls.splice(i, 1);
            }
        }

        for (let i=this.bombs.length - 1; i >= 0; i--) {
            this.bombs[i].update(dt)
            if (!this.bombs[i].alive) {
                this.bombs.splice(i, 1);
            }
        }

        for (let i=this.fireballs.length - 1; i >= 0; i--) {
            this.fireballs[i].update(dt)
            if (!this.fireballs[i].alive) {
                this.fireballs.splice(i, 1);
            }
        }

        let n = this.npcs.length + this.walls.length
        //console.log(`update skipped ${skipped} / ${n} = ${skipped/n}`)

    }

    update(dt) {

        if (!this.loader.ready) {
            this.loader.update()
        } else if (this.loader.ready && !this.map.ready) {
            this.build_map()
        } else if (this.map.ready) {
            this.controller.update(dt)

            if (this.ent_hero.character.health > 0) {
                this.ent_hero.update(dt)
            }

            this.update_active(dt);

            this.update_map(dt);

            this.camera.update(dt)
        }



    }

    paint_map(ctx) {

        let skipped = 0
        // draw the map
        let ar = this.camera.active_region
        for (let x=ar.left(); x<ar.right(); x+=32) {
            for (let y=Math.max(0, ar.top()); y<Math.min(ar.bottom(),this.map.height); y+=32) {
                this.loader.sheets.bg.drawTile(ctx, 0, x, y)
            }
        }

        // draw entities

        for (let i=0; i < this.walls.length; i++) {
            let ent = this.walls[i]
            if (!ent.active) {skipped+=1; continue}
            if (ent.active) {
                ent.paint(ctx)
            }
        }

        for (let i=0; i < this.bombs.length; i++) {
            let ent = this.bombs[i]
            if (ent.active) {
                ent.paint(ctx)
            }
        }

        for (let i=0; i < this.fireballs.length; i++) {
            let ent = this.fireballs[i]
            if (ent.active) {
                ent.paint(ctx)
            }
        }

        for (let i=0; i < this.npcs.length; i++) {
            let ent = this.npcs[i]
            if (!ent.active) {skipped+=1; continue}
            if (ent.active) {
                ent.paint(ctx)
            }
        }

        if (this.ent_hero.character.health > 0) {
            this.ent_hero.paint(ctx)
        }

        let n = this.npcs.length + this.walls.length

        //ctx.fillStyle = "yellow";
        //ctx.font = "bold 12pt Courier";
        //ctx.fillText(`${(skipped/n).toFixed(2)} ... ${n - skipped}`, this.camera.x+16, this.camera.y+16)



    }

    paint_status(ctx) {

        let x = this.camera.x
        let y = this.camera.y
        ctx.beginPath()
        ctx.fillStyle = "#262626ee"
        ctx.rect(x, y, this.camera.width, 32)
        ctx.fill()

        let h = this.ent_hero.character.health
        ctx.fillStyle = "#dd0000"
        ctx.strokeStyle = "#000000"
        for(let i=0; i < h; i++) {
            ctx.beginPath()
            ctx.arc(Math.floor(x + 64 + (i)*32 + 16),Math.floor(y+16), 8, 0, 2*Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.arc(Math.floor(x + 64 + (i)*32 + 16),Math.floor(y+16), 8, 0, 2*Math.PI)
            ctx.stroke()
        }

        let b = 3 - this.bombs.length
        let off = this.camera.width - 96 - 64
        ctx.fillStyle = "#0000aa"
        ctx.strokeStyle = "#000000"
        for(let i=0; i < b; i++) {
            ctx.beginPath()
            ctx.arc(Math.floor(this.camera.x + off + i*32 + 16),Math.floor(y+16), 8, 0, 2*Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.arc(Math.floor(this.camera.x + off + i*32 + 16),Math.floor(y+16), 8, 0, 2*Math.PI)
            ctx.stroke()
        }

        if (this.inventory.boss_key > 0) {
            this.loader.sheets.bg.drawTile(ctx, 9,x + 64 + 7*32 + 16,  Math.floor(y))
        }

    }

    paint(ctx) {

        //ctx.fillStyle = "yellow";
        //ctx.fillText(`${gEngine.view.availHeight}x${gEngine.view.availWidth} direction = ${Direction.name[this.controller.direction]}`, 0, -8)

        if (this.map.ready) {

            ctx.save()

            ctx.beginPath();
            //ctx.strokeStyle = 'red';
            ctx.strokeStyle = 'black';
            ctx.rect(-1, -1, gEngine.view.width+2, gEngine.view.height+2);
            //ctx.moveTo(0,0)
            //ctx.lineTo(gEngine.view.width,gEngine.view.height)
            //ctx.moveTo(gEngine.view.width,0)
            //ctx.lineTo(0,gEngine.view.height)
            ctx.stroke();

            // configure the camera
            // set a clip region and translate
            ctx.beginPath();
            ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
            ctx.clip();
            ctx.translate(-this.camera.x, -this.camera.y)


            this.paint_map(ctx)
            this.paint_status(ctx)

            //ctx.strokeStyle = "#FF0000"
            //ctx.beginPath();
            //let r = this.camera.active_border
            //ctx.rect(r.x, r.y, r.w, r.h);
            //ctx.stroke();

            ctx.restore()
            this.touch.paint(ctx)

        }

    }

    resize() {
        if (this.map.ready) {
            this.touch.resize()
            this.camera.resize()
        }
    }

    handleTouches(touches) {
        if (this.map.ready && this.ent_hero.character.health > 0) {
            this.touch.handleTouches(touches)
        }
    }

    handleKeyPress(keyCode) {
        if (this.map.ready && this.ent_hero.character.health > 0) {
            this.keyboard.handlePress(keyCode);
        }
    }

    handleKeyRelease(keyCode) {
        if (this.map.ready && this.ent_hero.character.health > 0) {
            this.keyboard.handleRelease(keyCode);
        }
    }
}

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

class MazeGenerator {

    constructor(width, height) {

        this.width = width
        this.height = height
        this.ready = false

        this.show = true
        this.start_room = 0

        this.current_step = 0

        this._step_counter = 0

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

        gEngine.scene = new MainScene(data)
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