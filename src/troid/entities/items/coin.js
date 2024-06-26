
import {
    Rect,
} from "@axertc/axertc_common"

import {gAssets} from "@troid/store"

import {registerEditorEntity, EntityCategory} from "@troid/entities/sys"
import {
    PlatformerEntity
} from "@axertc/axertc_physics"
import {gAssets, gCharacterInfo, WeaponType} from "@troid/store"

class CoinBase extends PlatformerEntity {
    constructor(entid, props, color, value) {
        super(entid, props)
        this.rect = new Rect(props?.x??0, props?.y??0, 16, 16)
        this.value = value
        this.color = color

        this.tiles = gAssets.sheets.coin.tiles().slice(color*gAssets.sheets.coin.cols, (color+1)*gAssets.sheets.coin.cols)
        // duplicate the dirst tile in tiles
        //this.tiles.unshift(this.tiles[0])
    }

    paint(ctx) {
        let i = Math.floor(gEngine.frameIndex / 6) % this.tiles.length
        gAssets.sheets.coin.drawTile(ctx, this.tiles[i], this.rect.x, this.rect.y)
    }

    update(dt) {

        let objs = this._x_debug_map.queryObjects({"className": "Player"})
        if (objs.length > 0) {
            let player = objs[0]

            let x1 = player.rect.cx()
            let x2 = this.rect.cx()

            let y1 = player.rect.cy()
            let y2 = this.rect.cy()

            let d = Math.sqrt(Math.pow(x1 - x2,2) + Math.pow(y1 - y2, 2))

            if (d < 16 * 7) {
                if (this.rect.collideRect(player.rect)) {
                    gAssets.sfx.ITEM_COLLECT_COIN.play()
                    gCharacterInfo.coins += this.value

                    if (gCharacterInfo.coins >= 100) { 
                        gCharacterInfo.coins -= 100
                        if (gCharacterInfo.current_health < gCharacterInfo.max_health) {
                            gCharacterInfo.current_health += 1
                        }
                        gAssets.sfx.ITEM_COINUP.play()
                    }
                    this.destroy()
                }

                const p = player.charge_duration / player.charge_timeout

                let c1 = (gCharacterInfo.current.element == WeaponType.ELEMENT.WATER && gCharacterInfo.current.beam != WeaponType.BEAM.BOUNCE)
                let c2 = (gCharacterInfo.current.element == WeaponType.ELEMENT.FIRE && gCharacterInfo.current.beam != WeaponType.BEAM.BOUNCE)

                if (p > .9 && !c1 && !c2) {

                    let dx = x1 - x2
                    let dy = y1 - y2
                    let dm = Math.max(Math.abs(dx), Math.abs(dy))

                    let sx = Math.sign(dx) * (Math.abs(dx) / dm)
                    let sy = Math.sign(dy) * (Math.abs(dy) / dm)

                    this.rect.x += sx
                    this.rect.y += sy

                }

            }
        }
    }
}

export class Coin extends CoinBase {
    constructor(entid, props) {
        super(entid, props, 0, 1);
    }
}

export class CoinRed extends CoinBase {
    constructor(entid, props) {
        super(entid, props, 1, 10);
    }
}

export class CoinBlue extends CoinBase {
    constructor(entid, props) {
        super(entid, props, 2, 25);
    }
}

/*
export class CoinStar extends CoinBase {
    constructor(entid, props) {
        super(entid, props, 4, 100);
    }
}
*/

export class CoinHeart extends CoinBase {
    constructor(entid, props) {
        super(entid, props, 5, 25);
    }
}

registerEditorEntity("Coin", Coin, [16,16], EntityCategory.item, null, (entry)=> {

    entry.icon = gAssets.sheets.coin.tile(0)
    entry.editorIcon = null
    entry.editorSchema = []
})

registerEditorEntity("CoinRed", CoinRed, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.coin.tile(1*gAssets.sheets.coin.cols)
    entry.editorIcon = null
    entry.editorSchema = []
})

registerEditorEntity("CoinBlue", CoinBlue, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.coin.tile(2*gAssets.sheets.coin.cols)
    entry.editorIcon = null
    entry.editorSchema = []
})

/*
registerEditorEntity("CoinStar", CoinStar, [16,16], EntityCategory.item, null, (entry)=> {
 
    entry.icon = gAssets.sheets.coin.tile(4*gAssets.sheets.coin.cols)
    entry.editorIcon = null
    entry.editorSchema = []
})
*/

registerEditorEntity("CoinHeart", CoinHeart, [16,16], EntityCategory.item, null, (entry)=> {
    entry.icon = gAssets.sheets.coin.tile(5*gAssets.sheets.coin.cols)
    entry.editorIcon = null
    entry.editorSchema = []
})