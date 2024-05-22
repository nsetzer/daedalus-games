import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatformV2,
    AnimationComponent, PlatformerEntity
} from "@axertc/axertc_physics"

import {gAssets, EditorControl, WeaponType} from "@troid/store"

import {registerEditorEntity, EntityCategory, makeEditorIcon} from "@troid/entities/sys"

export class BubbleCannon extends PlatformerEntity {
    // todo: add a synchonization property
    //       'A' cannnons fire on a set interval
    //       'B' cannons fire on the same interval, offset by 1/2

    constructor(entid, props) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.solid = 1

        let tid = 0
        this.direction = props?.direction??Direction.RIGHT
        switch(this.direction) {
            case Direction.LEFT:
                tid = 3
                this.spawn_dx = -8
                this.spawn_dy = 8
                break;
            case Direction.DOWN:
                tid = 2
                this.spawn_dx = 8
                this.spawn_dy = this.rect.h + 8
                break;
            case Direction.RIGHT:
                tid = 1
                this.spawn_dx = this.rect.w+8
                this.spawn_dy = 8
                break;
            case Direction.UP:
            default:
                tid = 0
                this.spawn_dx = 8
                this.spawn_dy = -8
                break;
        }
        this.tid = tid

        this.spawn_timer = 0
        this.spawn_timeout = 2.5;

    }

    paint(ctx) {
        BubbleCannon.sheet.drawTile(ctx, this.tid, this.rect.x, this.rect.y)
    }

    collide(other, dx, dy) {

        // TODO: can default collision functions be removed?
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

    update(dt) {

        this.spawn_timer += dt;
        if (this.spawn_timer > this.spawn_timeout) {
            this.spawn_timer -= this.spawn_timeout


            const projectile = {
                name: "BubbleBullet", 
                props: {
                    x: this.rect.x + this.spawn_dx, 
                    y: this.rect.y + this.spawn_dy,
                    direction: this.direction,
                    color: 4,
                    element: WeaponType.ELEMENT.BUBBLE,
                    wave: 0,
                    bounce: 1,
                    level: WeaponType.LEVEL.LEVEL1,
                    power:1.0,
                    split:3,
                    variance: 1
                }
            }
            this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), projectile.name, projectile.props)

        }


        /*
            if (this.spawn_check()) {
                const props = {
                    x: this.rect.x + this.spawn_dx, 
                    y: this.rect.y + this.spawn_dy
                }
                this._x_debug_map.createObject(this._x_debug_map._x_nextEntId(), "Creeper", props)
            }
        */        
    }
}

registerEditorEntity("BubbleCannon", BubbleCannon, [16,16], EntityCategory.hazard, null, (entry)=> {
    BubbleCannon.sheet = gAssets.sheets.cannon
    entry.icon = makeEditorIcon(BubbleCannon.sheet)

    // dynamic icon in editor
    entry.editorIcon = (props) => {
        let tid = 0
        switch(props?.direction) {
            case Direction.LEFT:
                tid = 3;
                break;
            case Direction.DOWN:
                tid = 2;
                break;
            case Direction.RIGHT:
                tid = 1;
                break;
            case Direction.UP:
            default:
                tid = 0;
                break;
        }
    
        return BubbleCannon.sheet.tile(tid)
    }

    entry.editorSchema = [
        {control: EditorControl.DIRECTION_4WAY, "default": Direction.RIGHT},
    ]

})