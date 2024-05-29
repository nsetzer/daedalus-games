
import {
    Rect,
} from "@axertc/axertc_common"

import {gAssets, CharacterInventoryEnum, EditorControl} from "@troid/store"

import {registerEditorEntity, EntityCategory, TextTyper} from "@troid/entities/sys"
import {
    PlatformerEntity, AnimationComponent
} from "@axertc/axertc_physics"
import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"
import {Player} from "@troid/entities/player"
import {MobBase} from "@troid/entities/mobs"

import { Coin, CoinBlue, CoinRed } from "./coin.js"


export class BrickBase extends PlatformerEntity {
    constructor(entid, props, tid) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.breakable = 0
        this.alive = 1
        this.solid = 1

        this.particles = []
        this.timer = 0
        this.timeout = 2 // enough time for particles to fall off the screen

        this.tid = tid
    }

    onPress(other, vector) {
        if (other instanceof Player && vector.y < 0) {
            this.onBreak()
        }
    }

    paint(ctx) {

        if (this.alive) {
            gAssets.sheets.brick.drawTile(ctx, this.tid, this.rect.x, this.rect.y)
        } else {
            // draw a quarter of the brick
            let x = (this.tid%gAssets.sheets.brick.cols) * 17 + 1
            let y = Math.floor(this.tid/gAssets.sheets.brick.cols) * 17 + 1
            console.log(this.tid, gAssets.sheets.brick.cols, x, y)
            this.particles.forEach((p,i) => {
                ctx.drawImage(gAssets.sheets.brick.image, 
                    x+8*(i&1), y+8*(i&2?1:0), 
                    8, 8, p.x, p.y, 8, 8)
            })
        }
    }

    update(dt) {

        if (!this.alive) {

            this.particles.forEach(p => {
                p.x += p.dx*dt
                p.y += p.dy*dt
                p.dy += 500 * dt
            })

            this.timer += dt
            if (this.timer >= this.timeout) {
                this.destroy()
            }
        }
    }

    onBreak() {
        this._kill()
    }

    _kill() {
        gAssets.sfx.ITEM_BREAK_BRICK.play()

        this.alive = 0
        this.solid = 0

        this.particles = []

        let dx;
        dx = ((Math.random() * 4) + 2)*10
        this.particles.push({x:this.rect.x, y: this.rect.y, dx: dx, dy: -100})
        this.particles.push({x:this.rect.x+8, y: this.rect.y, dx: -dx, dy: -100})
        dx = ((Math.random() * 4) + 2)*10
        this.particles.push({x:this.rect.x, y: this.rect.y+8, dx: dx, dy: 0})
        this.particles.push({x:this.rect.x+8, y: this.rect.y+8, dx: -dx, dy: 0})
    }
}

export class Brick extends BrickBase {
    constructor(entid, props) {
        super(entid, props, 0)
    }
}

registerEditorEntity("Brick", Brick, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.brick.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class FakeBrick extends PlatformerEntity {
    // a brick that disappears when stepped on
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.rect2 = new Rect(this.rect.x, this.rect.y-1, this.rect.w, 2)

        this.breakable = 0
        this.alive = 1
        this.solid = 1
        this.visible = 1

        this.animation = new AnimationComponent(this)

        this.particles = []
        this.timer = 0
        this.timeout = 2 // enough time for particles to fall off the screen


        this.buildAnimations()
    }

    buildAnimations() {

        let spf = 1/8
        let xoffset = 0
        let yoffset = 0

        const sheet = gAssets.sheets.brick
        this.animations = {}

        this.animations.idle = this.animation.register(sheet, [0], spf, {xoffset, yoffset})
        this.animations.kill = this.animation.register(sheet, [8,9,10,11], spf, {xoffset, yoffset, onend:this.onKillAnimationEnd.bind(this)})
        this.animations.restore = this.animation.register(sheet, [11,10,9,8], spf, {xoffset, yoffset, onend:this.onRestoreAnimationEnd.bind(this)})

        this.animation.setAnimationById(this.animations.idle)

    }

    onKillAnimationEnd() {
        this.alive = 0
        this.solid = 0
    }

    onRestoreAnimationEnd() {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            const player = objs[0]
            if (this.rect.collideRect(player.rect)) {
                this._kill()
                return
            }
        }

        this.alive = 1
        this.solid = 1
        this.animation.setAnimationById(this.animations.idle)

    }

    paint(ctx) {

        //ctx.beginPath();
        //ctx.rect( this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        //ctx.fillStyle = '#FF00007f';
        //ctx.fill();

        if (this.alive) {
            this.animation.paint(ctx)
        }

        //FakeBrick.sheet.drawTile(ctx, 0, this.rect.x, this.rect.y)
    }

    update(dt) {

        this.animation.update(dt)

        if (this.alive) {
            let objs = this._x_debug_map.queryObjects({"className": "Player"})
            if (objs.length > 0) {
                const player = objs[0]
                if (this.rect2.collideRect(player.rect)) {
                    // TODO: with the new physics, this should check if the primary
                    //       sensor for standing has collided with the object
                    let xp = player.rect.cx();
                    let x1 = this.rect.x
                    let x2 = this.rect.right() 
                    if (x1 <= xp && xp < x2) {
                        this._kill()
                    }
                }
            }
        } else {

            this.timer -= dt

            if (this.timer < 0) {
                this._restore()
            }
            
        }
    }

    _kill() {
        this.alive = 1
        this.solid = 0
        this.timer = 1.0
        this.animation.setAnimationById(this.animations.kill)
    }

    _restore() {
        this.alive = 1
        this.solid = 0
        this.animation.setAnimationById(this.animations.restore)
    }

}

registerEditorEntity("FakeBrick", FakeBrick, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.brick.tile(4)
    entry.editorIcon = null
    entry.editorSchema = []
})

export class ExplodingBrick extends MobBase {
    // a brick which can be destroyed with the charge beam
    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.character.health = 1

        this.animation = new AnimationComponent(this)
        this.visible = true

        this.breakable = 0
        this.character.alive = true
        this.solid = 1
        this.alive = 1

        //this.physics = new Physics2dPlatform(this,{
        //    xmaxspeed1: 35,
        //    xmaxspeed2: 35, // 35 seems right
        //})

        //this.physics.direction = Direction.LEFT

        //this.physics.group = () => {
        //    return Object.values(this._x_debug_map.objects).filter(ent=>{return ent?.solid})
        //}


        //this.buildAnimations()

        this.particles = []
        this.timer = 0
        this.timeout = 2 // enough time for particles to fall off the screen
    
    }

    _x_collide(other, dx, dy) {

        if (!this.alive) {
            return null
        }

        if (other instanceof ProjectileBase) {
            return null
        }

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
            update.set_top(this.rect.bottom())
            return update
        }

        return null
    }

    hit(projectile, props) {
        if (props.power >= 0.8) {
            this.character.hit(props)
        }
        return true
    }

    paint(ctx) {

        if (this.character.alive) {
            gAssets.sheets.brick.tile(12).draw(ctx, this.rect.x, this.rect.y)
        } else {
            // draw a quarter of the brick
            this.particles.forEach(p => {
                ctx.drawImage(this.constructor.sheet.image, 0, 0, 8, 8, p.x, p.y, 8, 8)
            })
        }
    }

    update(dt) {

        if (!this.character.alive) {

            this.particles.forEach(p => {
                p.x += p.dx*dt
                p.y += p.dy*dt
                p.dy += 500 * dt
            })

            this.timer += dt
            if (this.timer >= this.timeout) {
                this.destroy()
            }
        } else {
            if (this.kill_timer > 0) {
                this.kill_timer -= dt
                if (this.kill_timer < 0.0) {
                    this._kill()
                }
            }
        }
    }

    _delay_kill() {
        this.kill_timer = 0.25
    }

    _kill() {
        if (!this.character.alive) {
            return
        }

        this.character.alive = false
        this.solid = 0

        this.particles = []
        
        let dx;
        dx = ((Math.random() * 4) + 2)*10
        this.particles.push({x:this.rect.x, y: this.rect.y, dx: dx, dy: -100})
        this.particles.push({x:this.rect.x+8, y: this.rect.y, dx: -dx, dy: -100})
        dx = ((Math.random() * 4) + 2)*10
        this.particles.push({x:this.rect.x, y: this.rect.y+8, dx: dx, dy: 0})
        this.particles.push({x:this.rect.x+8, y: this.rect.y+8, dx: -dx, dy: 0})

        let cx = this.rect.cx()
        let cy = this.rect.cy()

        // TODO: query things that are breakable
        this._x_debug_map.queryObjects({"className": "Brick"}).forEach(obj => {
            let ox = obj.rect.cx()
            let oy = obj.rect.cy()
            let distance_squared = Math.pow(ox-cx,2) + Math.pow(oy-cy, 2)
            if (distance_squared <= 32*32+1) {
                obj._kill()
            }
        })

        this._x_debug_map.queryObjects({"className": "ExplodingBrick"}).forEach(obj => {
            let ox = obj.rect.cx()
            let oy = obj.rect.cy()
            let distance_squared = Math.pow(ox-cx,2) + Math.pow(oy-cy, 2)
            if (distance_squared <= 32*32+1) {
                console.log("delay brick", Math.sqrt(distance_squared))
                obj._delay_kill()
            }
        })

    }
}

registerEditorEntity("ExplodingBrick", ExplodingBrick, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.brick.tile(12)
    entry.editorIcon = null
    entry.editorSchema = []
})


export class BrickUpgrade extends BrickBase {
    constructor(entid, props) {
        super(entid, props, 13)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.skill = props.skill??CharacterInventoryEnum.SKILL_MORPH_BALL
    }


    paint(ctx) {

        if (this.alive) {
            gAssets.sheets.brick.drawTile(ctx, 13, this.rect.x, this.rect.y)
        } else {
            // draw a quarter of the brick
            this.particles.forEach((p,i) => {
                0,1,2,3
                ctx.drawImage(this.constructor.sheet.image, 
                    18+8*(i&1), 52+8*(i&2?1:0), 
                    8, 8, p.x, p.y, 8, 8)
            })
        }
    }

    onBreak() {
        gEngine.scene.dialog = new TextTyper("you found the" + this.skill)
        gEngine.scene.dialog.setModal(1)
        gEngine.scene.dialog.setExitCallback(() => {gEngine.scene.dialog.dismiss(); gEngine.scene.dialog=null})
        this._kill()
        gAssets.sfx.ITEM_POWERUP.play()
    }

}

registerEditorEntity("BrickUpgrade", BrickUpgrade, [16,16], EntityCategory.item, null, (entry)=> {
    BrickUpgrade.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(13)
    entry.editorIcon = null
    entry.editorSchema = [
        {
            control: EditorControl.CHOICE,
            name: "skill",
            "default": CharacterInventoryEnum.SKILL_MORPH_BALL,
            choices: [
                CharacterInventoryEnum.BEAM_ELEMENT_FIRE,
                CharacterInventoryEnum.BEAM_ELEMENT_WATER,
                CharacterInventoryEnum.BEAM_ELEMENT_ICE,
                CharacterInventoryEnum.BEAM_ELEMENT_BUBBLE,
                CharacterInventoryEnum.BEAM_TYPE_WAVE,
                CharacterInventoryEnum.BEAM_TYPE_BOUNCE,
                CharacterInventoryEnum.BEAM_LEVEL_2,
                CharacterInventoryEnum.BEAM_LEVEL_3,
                CharacterInventoryEnum.BEAM_MOD_CHARGE,
                CharacterInventoryEnum.BEAM_MOD_RAPID,
                CharacterInventoryEnum.SKILL_MORPH_BALL,
                CharacterInventoryEnum.SKILL_DOUBLE_JUMP,
                CharacterInventoryEnum.SKILL_SPIKE_BALL,
            ]
        },
    ]

})

export class BrickCoin extends BrickBase {
    constructor(entid, props) {
        super(entid, props, 14)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.skill = props.skill??CharacterInventoryEnum.SKILL_MORPH_BALL

        this.child = null
        this.item_offset_y = 0
        this.item_timer = Coin.sheet.cols * 6

        this.color = props.item??0
        this.value = [1,10,25][this.color]
    }

    update(dt) {

        super.update(dt);

        if (!this.alive) {
            this.item_offset_y -= gEngine.frameIndex%2
            this.item_timer += 1
        }
    }

    paint(ctx) {

        super.paint(ctx)

            if (!this.alive && this.item_timer < this.item_timer_timeout) {
                let i = this.color * Coin.sheet.cols + Math.floor(this.item_timer / 6) % Coin.sheet.cols
                Coin.sheet.drawTile(ctx, i, this.rect.x, this.rect.y + this.item_offset_y)
            }

    }

    onBreak() {
        this._kill()
        // number of frames * # frames to show each frame
        // coin animation is 7 frames
        // showing 11 frames will do one full rotation + 1 half rotation
        // before the coin disappears
        this.item_timer_timeout = 11 * 6 
        this.item_timer = 0
        
        gAssets.sfx.ITEM_COLLECT_COIN.play()
        gCharacterInfo.coins += this.value
    }

}

registerEditorEntity("BrickCoin", BrickCoin, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.brick.tile(14)
    entry.editorIcon = null
    entry.editorSchema = [
        {
            control: EditorControl.CHOICE,
            name: "item",
            "default": 0,
            choices: {
                "Coin": 0,
                "Blue Coin": 2,
                "Red Coin": 1,
            }
        },
    ]

})

