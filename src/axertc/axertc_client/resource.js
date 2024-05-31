 

export const ResourceStatus = {
    UNKNOWN: 0,
    ERROR:   1,
    WAITING: 2,
    LOADING: 3,
    READY:   4,
}

/**
 *  A Sound Effect
 *  sound effects are cloned internally 3 times allowing for
 *  the sound to be played overlapping up to three times.
 */
export class SoundEffectV1 {
    constructor(path, volume, allow_missing) {
        let sound = new Audio();

        this.default_volume = volume

        this.ready = false
        this.status = ResourceStatus.LOADING

        sound.onerror = () => {
            console.warn("error loading: " + path)
            if (allow_missing) {
                this.status = ResourceStatus.READY
                this.ready = true
                this.sounds = []
            } else {
                this.status = ResourceStatus.ERROR
            }
        }

        sound.onabort = () => {
            this.status = ResourceStatus.ERROR
        }

        this.sounds = [sound]

        sound.oncanplaythrough = () => {
            this.status = ResourceStatus.READY
            this.ready = true
            // clone the node to allow playing overlapping copies
            this.sounds.push(this.sounds[0].cloneNode())
            this.sounds.push(this.sounds[0].cloneNode())
        }

        this.playindex = 0
        sound.src = path


    }

    loop() {

        // start the next index at N milliseconds rounded down from now
        this.sounds.forEach(snd => {
            snd.addEventListener('ended', function() {
                this.currentTime = 0;
                this.play();
            }, false);
        })

        this.play()
    }

    stop() {
        this.sounds.forEach(snd => {
            snd.pause()
            snd.currentTime = 0
        })
    }

    play(volume=null) {
        if (SoundEffect.global_volume > 0 && this.sounds.length > 0) {
            const snd = this.sounds[this.playindex]
            let m = this.default_volume
            if (volume !== null) {
                m = volume
            }
            snd.volume = m * SoundEffect.global_volume
            snd.play().catch(error => {
              console.error("error playing audio: " + error)
            })
            this.playindex = (this.playindex+1) % this.sounds.length
            return snd
        }
        return null
    }
}

export class SoundEffectV2 {

    constructor(path, volume, allow_missing) {

        fetch(path, {mode: "cors"})
            .then((res) => {
                if (res.status !== 200) {
                    throw new Error(res.statusText)
                }
                return res.arrayBuffer()
            })
            .then(buffer => {return SoundEffectV2.ctxt.decodeAudioData(buffer)})
            .then(buffer => {
                this.buffer = buffer
                this.status = ResourceStatus.READY
                this.ready = true
            })
            .catch(error => {
                console.error(error)
                if (allow_missing) {
                    this.status = ResourceStatus.READY
                    this.ready = true
                } else {
                    this.status = ResourceStatus.ERROR
                }
            })

        this.url = path
        this.default_volume = volume
        this.buffer = null
        this.source = null
    }

    loop() {
        //console.log("loop source", this.url)

        if (!this.buffer) {
            return
        }

        if (!!this.source) {
            this.stop()
        }

        let volume = this.default_volume

        if (volume < 1e-5) {
            return
        }

        let source = SoundEffectV2.ctxt.createBufferSource();
        let gain = SoundEffectV2.ctxt.createGain();
        gain.gain.value = (volume !== null)?volume:this.default_volume;
        source.buffer = this.buffer
        source.connect(gain)
        gain.connect(SoundEffectV2.ctxt.destination)
        source.loop = true
        source.start()

        this.source = source
    }

    pause() {
        // stop playback if it was looping
    }

    resume() {
        // continue playback if it was looping
    }

    stop() {
        //console.log("stop source", this.url)
        if (!!this.source) {
            this.source.stop()
            this.source = null
        }
    }

    play(volume=null) {

        if (!this.buffer) {
            return
        }

        if (!!this.source) {
            this.stop()
        }

        volume = (volume !== null)?volume:this.default_volume

        if (volume < 1e-5) {
            return
        }

        let source = SoundEffectV2.ctxt.createBufferSource();
        let gain = SoundEffectV2.ctxt.createGain();
        gain.gain.value = volume;
        source.buffer = this.buffer
        source.connect(gain)
        gain.connect(SoundEffectV2.ctxt.destination)
        source.loop = false
        source.start()

        this.source = source

    }
}
SoundEffectV2.ctxt = new (AudioContext || webkitAudioContext)()

export const SoundEffect = SoundEffectV2

SoundEffect.global_volume = 1.0

export class SoundEffectBuilder {

    constructor() {
        this._path = ""
        this._volume = 1
        this._allow_missing = false

    }

    volume(volume) {
        // resource path
        if (volume >= 0 && volume <= 1) {
            this._volume = volume
        } else {
            throw {"error": "volume must be between 0 and 1"}
        }

        return this
    }

    path(path) {
        // resource path
        this._path = path
        return this
    }

    allowMissing() {
        this._allow_missing = true
        return this
    }

    build() {
        let se = new SoundEffect(this._path, this._volume, this._allow_missing)
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

        if (!!path) {
            this.image = new Image();
            this.ready = false;
            this.status = ResourceStatus.LOADING
            this.image.onload = () => {
                this.ready = true;
                this.status = ResourceStatus.READY
            }
            this.image.onerror = (event) => {
                console.warn("error loading: " + path, event)
                this.status = ResourceStatus.ERROR
            }
            this.image.src = path
        }

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
        // where tid is the tile index
        return new SpriteTile(this, tid)
    }

    tiles() {
        let tiles = []
        for (let i=0; i < this.rows*this.cols; i++) {
            tiles.push(i)
        }
        return tiles
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

export class Font {
    constructor(family, path, weight) {

        this.ready = false
        this.status = ResourceStatus.LOADING

        this.font = new FontFace(family, `url(${path})`, {
            style: "normal",
            weight: weight,
            stretch: "condensed",
        });

        this.font.load().then(() => {
            document.fonts.add(this.font);
            this.status = ResourceStatus.READY
            this.ready = true
        }).catch(error => {
            console.error(error)
            this.status = ResourceStatus.ERROR
            this.ready = false
        })

    }
}

export class FontBuilder {

    constructor() {
        this._path = ""
        this._family = ""
        this._weight = "400"
        this._style = "normal"
        this._stretch = "condensed"

    }

    family(family) {
        this._family = family
        return this
    }

    path(path) {
        // resource path
        this._path = path
        return this
    }

    build() {

        if (this._family === "") {
            throw "font family not set"
        }

        if (this._path === "") {
            throw "font path not set"
        }

        return new Font(this._family, this._path, this._weight)
    }
}


export class JsonDocument {
    constructor(path, transform=null) {

        this.ready = false
        this.status = ResourceStatus.LOADING
        this.data = null

        fetch(path)
            .then(res=> {
                if (res.status !== 200) {
                    throw new Error(res.statusText)
                }
                return res.json()
            })
            .then(json => {
                console.log(json)
                if (transform!==null) {
                    json = transform(json)
                }
                this.data = json
                this.status = ResourceStatus.READY
                this.ready = true
            })
            .catch(err => {
                console.log("error loading json document", path)
                console.log(err)
                this.status = ResourceStatus.ERROR
                this.ready = false
            })
    }


}

export class JsonBuilder {
    constructor() {
        this._path = ""
        this._transform = null
    }

    path(path) {
        // resource path
        this._path = path
        return this
    }

    transform(fn) {
        this._transform = fn
    }

    build() {

        if (this._family === "") {
            throw "font family not set"
        }

        if (this._path === "") {
            throw "font path not set"
        }

        return new JsonDocument(this._path, this._transform)
    }

}

export class ResourceLoader {

    constructor() {

        this.resources = []
        this.resource_count = 0
        this.ready = false

        this.status = ResourceStatus.LOADING

        this.music = {}
        this.sounds = {}
        this.sheets = {}
        this.font = {}
        this.json = {}

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

    addFont(resid) {
        let builder = new FontBuilder()
        this.resources.push({resid, builder, instance:null, kind: "font"})
        this.resource_count += 1
        return builder
    }

    addJson(resid) {
        let builder = new JsonBuilder()
        this.resources.push({resid, builder, instance:null, kind: "json"})
        this.resource_count += 1
        return builder
    }

    progress() {
        return (this.resource_count - this.resources.length)/this.resource_count
    }

    update(dt) {

        if (this.ready) {
            return
        }

        for (let i = this.resources.length - 1; i >= 0; i--) {

            let res = this.resources[i]
            if (res.instance === null) {
                res.instance = res.builder.build()
            } else if (this.status !== ResourceStatus.ERROR && res.instance.status == ResourceStatus.ERROR) {
                console.warn(res.instance)
                this.status = ResourceStatus.ERROR

            } else if (res.instance.ready) {
                this[res.kind][res.resid] = res.instance
                // remove this item
                this.resources.splice(i ,1)
            }

        }

        this.ready = this.resources.length == 0

    }
}

