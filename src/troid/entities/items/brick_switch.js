
/**
 * 
 * using hit and onPress to allow bullets to hit a solid mob
 * shooting the switch is the same as bumping it
 * 
 */
import {
    Rect,
} from "@axertc/axertc_common"

import {gAssets} from "@troid/store"

import {registerEditorEntity, EntityCategory, ProjectileBase, AbstractMobBase} from "@troid/entities/sys"
import {
    PlatformerEntity, AnimationComponent
} from "@axertc/axertc_physics"
import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"
//import {Player} from "@troid/entities/player"

/**
 * red switches active red platforms
 * and deactivate blue platforms
 * by default red platforms are always solid
 */
export class RedSwitch extends AbstractMobBase {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.breakable = 0
        this.solid = 1
        this.visible = 1

        this.animation = {}

        this.bump_timer = 0

    }

    isSolid(other) {
        // allow projectiles to collide with this object
        if (other instanceof ProjectileBase) {
            return false
        }
        return true
    } 


    hit(projectile, props) {
        this.onBreak();
        return true
    }

    onPress(other, vector) {
        if (other._classname == "Player" && vector.y < 0) {
            this.onBreak()
        }
    }

    paint(ctx) {
        let yoffset = 0
        if (this.bump_timer > 0) {
            yoffset = -2
        }
        gAssets.sheets.brick.tile(1).draw(ctx, this.rect.x, this.rect.y + yoffset)
    }

    update(dt) {
        if (this.bump_timer > 0) {
            this.bump_timer -= dt
        }
    }
    
    onBreak() {
        this._kill()
    }

    _kill() {

        this._x_debug_map.queryObjects({"className": "RedPlatform"}).forEach(obj => {
            obj.solid = true;
        })

        this._x_debug_map.queryObjects({"className": "BluePlatform"}).forEach(obj => {
            obj.solid = false;
        })

        this.bump_timer = .2

    }
}

registerEditorEntity("RedSwitch", RedSwitch, [16,16], EntityCategory.switches, null, (entry)=> {
    RedSwitch.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(1)
    entry.editorIcon = null
    entry.editorSchema = []
})

/**
 * blue switches active blue platforms
 * and deactivate red platforms
 * by default blue platforms are always not solid
 */
export class BlueSwitch extends AbstractMobBase {

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)

        this.breakable = 0
        this.alive = 1
        this.solid = 1
        this.visible = 1

        this.animation = {}

        this.bump_timer = 0
    }

    paint(ctx) {
        let yoffset = 0
        if (this.bump_timer > 0) {
            yoffset = -2
        }
        gAssets.sheets.brick.tile(5).draw(ctx, this.rect.x, this.rect.y + yoffset)
    }

    update(dt) {
        if (this.bump_timer > 0) {
            this.bump_timer -= dt
        }
    }

    isSolid(other) {
        // allow projectiles to collide with this object
        if (other instanceof ProjectileBase) {
            return false
        }
        return true
    } 


    hit(projectile, props) {
        this.onBreak();
        return true
    }

    onPress(other, vector) {
        if (other._classname == "Player" && vector.y < 0) {
            this.onBreak()
        }
    }

    onBreak() {
        this._kill()
    }

    _kill() {

        this._x_debug_map.queryObjects({"className": "RedPlatform"}).forEach(obj => {
            obj.solid = false;
        })

        this._x_debug_map.queryObjects({"className": "BluePlatform"}).forEach(obj => {
            obj.solid = true;
        })

        this.bump_timer = .2

    }

}

registerEditorEntity("BlueSwitch", BlueSwitch, [16,16], EntityCategory.switches, null, (entry)=> {
    BlueSwitch.sheet = gAssets.sheets.brick
    entry.icon = gAssets.sheets.brick.tile(5)
    entry.editorIcon = null
    entry.editorSchema = []
})
