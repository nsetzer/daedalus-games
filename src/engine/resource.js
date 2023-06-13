 


/**
 *  A Sound Effect
 *  sound effects are cloned internally 3 times allowing for
 *  the sound to be played overlapping up to three times.
 */
export class SoundEffect {
    constructor(path) {
        let sound = new Audio();
        sound.src = path

        this.ready = true

        this.sounds = [sound, sound.cloneNode(), sound.cloneNode()]
        this.index = 0


    }

    play() {
        this.sounds[this.index].play().catch(error => {
          console.log(error)
        })
        this.index = (this.index+1) % this.sounds.length
    }
}

export class SoundEffectBuilder {

    constructor() {
        this._path = ""

    }

    path(path) {
        // resource path
        this._path = path
        return this
    }

    build() {
        let se = new SoundEffect(this._path)
        return se
    }
}

export class SpriteSheetBuilder {
    constructor() {
        this._path = ""
        this._tw = 32
        this._th = 32
        this._rows = 1
        this._cols = 1
        this._xspacing = 0
        this._yspacing = 0
        this._xoffset = 0
        this._yoffset = 0

    }

    path(path) {
        // resource path
        this._path = path
        return this
    }

    dimensions(tw, th) {
        // shape of each tile
        this._tw = tw
        this._th = th
        return this
    }

    layout(rows, cols) {
        // number of rows and columns
        this._rows = rows
        this._cols = cols
        return this
    }

    offset(x, y) {
        // offset from top left of the image where tiles begin
        this._xoffset = x
        this._yoffset = y
        return this
    }

    spacing(x, y) {
        // spacing between tiles
        this._xspacing = x
        this._yspacing = y
        return this
    }

    build() {

        let ss = new SpriteSheet(this._path)
        ss.tw = this._tw
        ss.th = this._th
        ss.rows = this._rows
        ss.cols = this._cols
        ss.xspacing = this._xspacing
        ss.yspacing = this._yspacing
        ss.xoffset = this._xoffset
        ss.yoffset = this._yoffset
        return ss
    }
}

export class SpriteSheet {

    constructor(path) {
        this.image = new Image();
        this.ready = false;
        this.image.onload = () => {
            this.ready = true;
        }
        this.image.src = path

        this.tw = 0
        this.th = 0
        this.rows = 0
        this.cols = 0
        this.xspacing = 0
        this.yspacing = 0
        this.xoffset = 0
        this.yoffset = 0

    }

    drawTile(ctx, tid, dx, dy) {

        dx = Math.floor(dx)
        dy = Math.floor(dy)

        let sx = Math.floor((tid % this.cols) * (this.tw + this.xspacing) + this.xoffset)
        let sy = Math.floor(Math.floor(tid / this.cols) * (this.th + this.yspacing) + this.yoffset)
        ctx.drawImage(this.image, sx, sy, this.tw, this.th, dx, dy, this.tw, this.th)

    }

    drawTileScaled(ctx, tid, dx, dy, dw, dh) {

        dx = Math.floor(dx)
        dy = Math.floor(dy)
        dw = Math.floor(dw)
        dh = Math.floor(dh)

        let sx = Math.floor((tid % this.cols) * (this.tw + this.xspacing) + this.xoffset)
        let sy = Math.floor(Math.floor(tid / this.cols) * (this.th + this.yspacing) + this.yoffset)
        ctx.drawImage(this.image, sx, sy, this.tw, this.th, dx, dy, dw, dh)

    }

    tile(tid) {
        return new SpriteTile(this, tid)
    }
}

export class SpriteTile {
    constructor(sheet, tid) {
        this.sheet = sheet
        this.tid = tid
    }

    draw(ctx, dx, dy) {
        this.sheet.drawTile(ctx, this.tid, dx, dy)
    }
}

export class ResourceLoader {

    constructor() {

        this.resources = []
        this.resource_count = 0
        this.ready = false

        this.music = {}
        this.sounds = {}
        this.sheets = {}

    }

    addSoundEffect(resid) {
        let builder = new SoundEffectBuilder()
        this.resources.push({resid, builder, instance:null, kind: "sounds"})
        this.resource_count += 1
        return builder
    }

    addMusic(resid) {
        return null
    }

    addSpriteSheet(resid) {
        let builder = new SpriteSheetBuilder()
        this.resources.push({resid, builder, instance:null, kind: "sheets"})
        this.resource_count += 1
        return builder
    }

    update(dt) {

        if (this.ready) {
            return
        }

        for (let i = this.resources.length - 1; i >= 0; i--) {

            let res = this.resources[i]
            if (res.instance === null) {
                res.instance = res.builder.build()
            } else if (res.instance.ready) {
                if (res.kind == "sheets") {
                    this.sheets[res.resid] = res.instance
                }
                if (res.kind == "sounds") {
                    this.sounds[res.resid] = res.instance
                }
                if (res.kind == "music") {
                    this.music[res.resid] = res.instance
                }
                // remove this item
                this.resources.splice(i ,1)
            }

        }

        this.ready = this.resources.length == 0

    }
}

