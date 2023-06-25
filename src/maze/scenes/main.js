 
from module engine import {
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SpriteSheetBuilder, SpriteSheet,
    ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene
}


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
        let aidd_atk = target.animation.register(sheet, [ 2, 2, 2, 2,], .1, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})
        let aidu_atk = target.animation.register(sheet, [ 6, 6, 6, 6,], .1, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})
        let aidl_atk = target.animation.register(sheet, [10,10,10,10,], .1, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})
        let aidr_atk = target.animation.register(sheet, [14,14,14,14,], .1, {xoffset:-8, yoffset:-16, loop: false, onend: target.handleAttackEnd.bind(target)})

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
        this.attacking_frame = -1
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

    _check_damage() {
        for (let i=0; i < this.mobs.length; i++) {
            if (this.attacking_info.rect.collideRect(this.mobs[i].rect)) {
                this.mobs[i].character.hit(1, this.facing)
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

            this.attacking_frame = -1

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
        } else {
            // on every attacking frame check for a collision
            // TODO: make a callback in the animation
            if (this.attacking_frame != this.animation.frame_index) {
                this._check_damage()

                this.attacking_frame = this.animation.frame_index
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


        //if (this.attacking_info) {
        //    ctx.save()
        //    ctx.beginPath();
        //    ctx.fillStyle = "#000000FF";
        //    let r = this.attacking_info.rect
        //    ctx.rect(r.x, r.y, r.w, r.h);
        //    ctx.fill()
        //    ctx.fillStyle = "#FFFFFF";
        //    ctx.fillText(`${this.animation.frame_index}`, r.x+ r.w/2, r.y + r.h/2)
        //    ctx.restore()
        //}


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

    constructor() {
        super();

        this.mapdata = global.mapdata
        this.loader = global.loader

        this.map = {ready: false}

        this.build_map()
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
        this.touch.addWheel(72, -72, 72)
        this.touch.addButton(-40, -120, 40)
        this.touch.addButton(-120, -40, 40)

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

        this.death_timer = 0
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

        if (this.map.ready) {
            this.controller.update(dt)

            if (this.ent_hero.character.health > 0) {
                this.ent_hero.update(dt)
            } else {
                console.log(this.death_timer)
                this.death_timer += dt
                if (this.death_timer > 4) {
                    gEngine.scene = new TitleScene()
                    return
                }
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

    handleKeyPress(keyevent) {
        if (this.map.ready && this.ent_hero.character.health > 0) {
            this.keyboard.handleKeyPress(keyevent);
        }
    }

    handleKeyRelease(keyevent) {
        if (this.map.ready && this.ent_hero.character.health > 0) {
            this.keyboard.handleKeyRelease(keyevent);
        }
    }
}