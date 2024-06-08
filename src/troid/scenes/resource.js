
// Note on world editor
// 1 screen is 24 x 14 pixels.
//  a screen can be converted to a 24x16 tile by mapping all solid
//  tiles to a single pixel.
//  padding the top and bottom with one row of pixels and truncating
//  one column of pixels on the left and right
//  use one color for the background - based on the theme. e.g. blue sky
//  use one color for the solid terrain, black green, brown
//  these tiles can be used to visualize all maps in a given world.
//  a visual editor can display all map tiles. which can be dragged
//  around like objects in the level editor.
//  adjacent rooms can automatically be linked together by
//  updating the door ids
//  even without implementing linking, it can be used to visualize
//  and verify that all maps are properly wired together
//  the world editor should overlay the level id in each level tile
//  when placing a level in the world visualizer.
//  level 1 is placed at 0,0
//  discover neighbors and place them
//  iterate until all levels have been placed
//  place unpositioned levels along the bottom in way that
//  that does not overlap
//

import { Physics2dPlatformV2 } from "@axertc/axertc_physics"

import {
    Direction, Rect, CspMap, ClientCspMap
} from "@axertc/axertc_common"

import {
    GameScene,
    ResourceLoader, ResourceStatus

} from "@axertc/axertc_client"

import {TileShape, TileProperty, updateTile, paintTile} from "@troid/tiles"

import {MapInfo, gAssets, SoundEffectPalette} from "@troid/store"
import {PlatformMap, deserialize_stamp, deserialize_tile} from "@troid/maps"
import {defaultEntities, editorEntities, registerEntityAssets} from "@troid/entities/sys"

const RES_ROOT = "static"

//https://gist.github.com/nektro/84654b5183ddd1ccb7489607239c982d
if (!('createImageBitmap' in window)) {
    window.createImageBitmap = async function(blob) {
        return new Promise((resolve,reject) => {
            let img = document.createElement('img');
            img.addEventListener('load', function() {
                resolve(this);
            });
            img.src = URL.createObjectURL(blob);
        });
    }
}

export class ResourceLoaderScene extends GameScene {

    constructor(success_cbk) {
        super();

        this.success_cbk = success_cbk

        //this.build_loader()

        this.timer = 0;
        this.timeout = .1; // how long to show the loading bar after it finished loading
        this.finished = false

        // total elapsed time spent loading (wall clock time)
        // elapsed: time spent calling the update function for each pipeline stage
        // nupates: the number of calls to update for each pipeline stage
        this.stats = {total_elapsed: 0, elapsed:[0], nupdates: [0]}
    }

    update(dt) {

        if (this.pipeline_index < this.pipeline.length) {
            this.stats.total_elapsed += dt
            const loader = this.pipeline[this.pipeline_index]
            if (!loader.ready) {
                if (loader.status != ResourceStatus.ERROR) {
                    let t0 = performance.now()
                    loader.update()
                    let elapsed = performance.now() - t0
                    this.stats.elapsed[this.stats.elapsed.length - 1] += elapsed
                    this.stats.nupdates[this.stats.nupdates.length - 1] += 1
                }
            } else {
                this.pipeline_index += 1
                this.stats.elapsed.push(0)
                this.stats.nupdates.push(0)
            }

        } else if (!this.finished) {
            this.stats.total_elapsed += dt

            this.timer += dt
            if (this.timer > this.timeout) {
                this.success_cbk(this.pipeline[this.pipeline.length-1])
                this.finished = true

                // log the total time spent loading
                // with the time spent in each pipeline stage
                console.log("load complete",
                    Math.floor(this.stats.total_elapsed*1000), "ms",
                    this.stats.elapsed,
                    this.stats.nupdates)
            }
        }


    }

    paint(ctx) {
        //ctx.fillStyle = "yellow";
        //ctx.fillText(`${this.gen.ux} ${this.gen.uy}: ${JSON.stringify(gEngine.view)}`, 0, -8)
        ctx.fillStyle = "yellow";
        ctx.fillText(`${this.pipeline_index}/${this.pipeline.length}`, 16, 16)

        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.closePath()
        ctx.fill();

        let color = 'yellow'
        let error = false
        if (this.pipeline_index < this.pipeline.length) {
            if (this.pipeline[this.pipeline_index].status == ResourceStatus.ERROR) {
                error = true
                color = 'red'
            }
        }


        let w = Math.floor(gEngine.view.width*.75)
        let h = Math.floor(gEngine.view.height*.1)
        let x = Math.floor(gEngine.view.width/2 - w/2)
        let y = Math.floor(gEngine.view.height/2 - h/2)

        ctx.strokeStyle = color;
        let p = 0
        if (this.pipeline_index < this.pipeline.length) {
            p = this.pipeline[this.pipeline_index].progress()
        }
        p = (this.pipeline_index + p) / this.pipeline.length

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.rect(x,y,Math.floor(w*p),h);
        ctx.fill();
        

        if (this.pipeline.length > 1) {
            for (let i=0; i<this.pipeline.length;i++) {
                ctx.strokeStyle = "black";
                ctx.beginPath();
                ctx.moveTo(x + w*i/this.pipeline.length, y)
                ctx.lineTo(x + w*i/this.pipeline.length, y + h)
                ctx.closePath()
                ctx.stroke();
            }
        }
     
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.rect(x-2,y-2,w+4,h+4);
        ctx.stroke();

        if (error) {

            // draw text Error centered below the rect
            // set base line and align to center
            ctx.fillStyle = "red";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText("Error", x + w/2, y + h + 16)

        } 

        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.rect(x,y,w,h);
        ctx.closePath()
        ctx.stroke();
        


    }

    handleTouches(touches) {
    }

    resize() {

    }
}

class AssetLoader {

    constructor() {
        this.status = ResourceStatus.LOADING
        this.ready = false

        this.loader = null

    }

    progress() {
        if (!!this.loader) {
            return this.loader.progress()
        }
        return 0
    }

    update(dt) {

        if (this.ready) {
            return
        }

        if (this.loader === null) {
            this._init()
            return
        }

        if (!this.loader.ready) {
            this.loader.update()
        }

        if (this.loader.ready) {
            this._finalize()

        }

        this.status = this.loader.status
        this.ready = this.loader.ready

    }

    _init() {

        // parse the info_loader map data
        // determine which assets still need to be loaded
        // add those to the loader
        // when finished update the global store

        // the content changes based on the task
        // the game will need to load audio
        // the level editor must load all themes

        this.loader = new ResourceLoader()

        this.loader.addSpriteSheet("player")
            .path(RES_ROOT + "/sprites/player/player.png")
            .dimensions(32, 32)
            .layout(6, 17)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("player2")
            .path(RES_ROOT + "/sprites/player/player2.png")
            .dimensions(32, 32)
            .layout(4, 10)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("beams16")
            .path(RES_ROOT + "/sprites/player/beams16.png")
            .dimensions(16, 16)
            .layout(11, 7)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("beams32")
            .path(RES_ROOT + "/sprites/player/beams32.png")
            .dimensions(32, 32)
            .layout(2, 6)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("pipes32")
            .path(RES_ROOT + "/sprites/pipes32.png")
            .dimensions(32, 32)
            .layout(1, 4)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("brick")
            .path(RES_ROOT + "/sprites/items/brick.png")
            .dimensions(16, 16)
            .layout(4, 4)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("coin")
            .path(RES_ROOT + "/sprites/items/coin.png")
            .dimensions(16, 16)
            .layout(6, 7)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("editor")
            .path(RES_ROOT + "/sprites/editor.png")
            .dimensions(16, 16)
            .layout(3, 8)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("pause_suit")
            .path(RES_ROOT + "/sprites/pause_suit2.png")
            .dimensions(80, 128)
            .layout(1, 1)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("pause_items")
            .path(RES_ROOT + "/sprites/pause_items2.png")
            .dimensions(20, 18)
            .layout(9, 6)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("spikes")
            .path(RES_ROOT + "/sprites/hazards/spikes.png")
            .dimensions(16, 16)
            .layout(2, 4)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("flipper")
            .path(RES_ROOT + "/sprites/hazards/flipper.png")
            .dimensions(48, 48)
            .layout(2, 4)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("countplatform")
            .path(RES_ROOT + "/sprites/hazards/countplatform.png")
            .dimensions(32, 18)
            .layout(1, 2)
            .offset(1, 18)
            .spacing(1, 1)
        
        this.loader.addSpriteSheet("platformud")
            .path(RES_ROOT + "/sprites/hazards/platformud.png")
            .dimensions(16, 22)
            .layout(1, 7)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("battery_gate")
            .path(RES_ROOT + "/sprites/switches/battery_gate.png")
            .dimensions(32, 16)
            .layout(2, 5)
            .offset(1, 16*4+5)
            .spacing(1, 1)
        

        this.loader.addSpriteSheet("bumper")
            .path(RES_ROOT + "/sprites/hazards/bumper.png")
            .dimensions(32, 16)
            .layout(3, 1)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("hazard_icons")
            .path(RES_ROOT + "/sprites/hazards/editor_icons.png")
            .dimensions(16, 16)
            .layout(1, 1)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("ruler")
            .path(RES_ROOT + "/sprites/ruler.png")
            .dimensions(16, 16)
            .layout(1, 1)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("creeper")
            .path(RES_ROOT + "/sprites/mobs/creeper2.png")
            .dimensions(20, 20)
            .layout(4, 5)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("flyer")
            .path(RES_ROOT + "/sprites/mobs/flyer.png")
            .dimensions(32, 32)
            .layout(2,5)
            .offset(1, 18)
            .spacing(1, 1)
            
        this.loader.addSpriteSheet("shredder")
            .path(RES_ROOT + "/sprites/mobs/shredder.png")
            .dimensions(24, 16)
            .layout(3, 3)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("help_flower")
            .path(RES_ROOT + "/sprites/mobs/flower.png")
            .dimensions(32, 32)
            .layout(4, 4)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("tomato")
            .path(RES_ROOT + "/sprites/mobs/tomato.png")
            .dimensions(48, 48)
            .layout(2, 4)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("windfan")
            .path(RES_ROOT + "/sprites/hazards/windfan.png")
            .dimensions(32, 16)
            .layout(1, 2)
            .offset(1, 18)
            .spacing(1, 1)

            this.loader.addSpriteSheet("crate")
            .path(RES_ROOT + "/sprites/hazards/crate.png")
            .dimensions(32, 32)
            .layout(1, 1)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("firesprite")
            .path(RES_ROOT + "/sprites/mobs/firesprite.png")
            .dimensions(16, 16)
            .layout(3, 7)
            .offset(1, 1)
            .spacing(1, 1)
    
        this.loader.addSpriteSheet("cannon")
            .path(RES_ROOT + "/sprites/mobs/cannon.png")
            .dimensions(16, 16)
            .layout(1, 4)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("zone_01_sheet_01")
            .path(RES_ROOT + "/themes/plains/tile_ground_01.png")
            .dimensions(16, 16)
            .layout(4, 11)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("zone_01_sheet_02")
            .path(RES_ROOT + "/themes/underground/tile_ground_02.png")
            .dimensions(16, 16)
            .layout(4, 11)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("zone_01_pipes_01")
            .path(RES_ROOT + "/themes/plains/tile_pipes_01.png")
            .dimensions(16, 16)
            .layout(4, 11)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("theme_bg_0")
            .path(RES_ROOT + "/themes/plains/bg0.png")
            .dimensions(352, 352)
            .layout(1, 1)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("theme_bg_1")
            .path(RES_ROOT + "/themes/plains/bg1.png")
            .dimensions(352, 352)
            .layout(1, 1)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("stamp_plains_00")
            .path(RES_ROOT + "/themes/plains/stamp_00.png")

        this.loader.addSoundEffect("click1").path(RES_ROOT + "/sfx/gui/clicksound1.wav")
        this.loader.addSoundEffect("click2").path(RES_ROOT + "/sfx/gui/clicksound2.wav")
        this.loader.addSoundEffect("click3").path(RES_ROOT + "/sfx/gui/clicksound3.wav")

        this.loader.addSoundEffect("hit")
            .path(RES_ROOT + "/sfx/misc/hit.ogg")
            .volume(.025)
            .allowMissing()

        this.loader.addSoundEffect("death")
            .path(RES_ROOT + "/sfx/misc/death.ogg")
            .volume(.025)
            .allowMissing()

        this.loader.addSoundEffect("jump")
            .path(RES_ROOT + "/sfx/misc/jump.ogg")
            .volume(.025)
            .allowMissing()

        this.loader.addSoundEffect("curl")
            .path(RES_ROOT + "/sfx/misc/curl.ogg")
            .volume(.3)
            .allowMissing()

        this.loader.addSoundEffect("uncurl")
            .path(RES_ROOT + "/sfx/misc/uncurl.ogg")
            .volume(.3)
            .allowMissing()

        this.loader.addSoundEffect("coin_collect")
            .path(RES_ROOT + "/sfx/misc/coin.wav")
            .volume(.3)
            .allowMissing()
        
        this.loader.addSoundEffect("break_brick")
            .path(RES_ROOT + "/sfx/misc/break.wav")
            .volume(.3)
            .allowMissing()
        
        this.loader.addSoundEffect("powerup")
            .path(RES_ROOT + "/sfx/misc/powerup3.wav")
            .volume(.3)
            .allowMissing()

        this.loader.addSoundEffect("bubble_pop")
            .path(RES_ROOT + "/sfx/misc/bubble_pop.wav")
            .volume(.3)
            .allowMissing()

        this.loader.addSoundEffect("fireBeam")
            .path(RES_ROOT + "/sfx/beam/fireBeam.ogg")
            .volume(.3)
            .allowMissing()

        this.loader.addSoundEffect("fireBeamCharge")
            .path(RES_ROOT + "/sfx/beam/fireBeamCharge.ogg")
            .volume(0.7)
            .allowMissing()

        this.loader.addSoundEffect("fireBeamChargeLoop")
            .path(RES_ROOT + "/sfx/beam/fireBeamChargeLoop.ogg")
            .volume(0.7)
            .allowMissing()

        this.loader.addSoundEffect("fireBeamFlameStart")
            .path(RES_ROOT + "/sfx/beam/fireBeamFlameStartFast.ogg")
            .volume(.4)
            .allowMissing()

        this.loader.addSoundEffect("fireBeamFlameLoop")
            .path(RES_ROOT + "/sfx/beam/fireBeamFlameLoop.ogg")
            .volume(.4)
            .allowMissing()
    }

    _finalize() {
        gAssets.music = {... gAssets.music, ... this.loader.music}
        gAssets.sounds = {... gAssets.sounds, ... this.loader.sounds}
        gAssets.sheets = {... gAssets.sheets, ... this.loader.sheets}
        gAssets.font = {... gAssets.font, ... this.loader.font}
        
        gAssets.themes.plains = [
            null,
            gAssets.sheets.zone_01_sheet_01,
            gAssets.sheets.zone_01_pipes_01,
        ]

        gAssets.themes.underground = [
            null,
            gAssets.sheets.zone_01_sheet_02,
            gAssets.sheets.zone_01_pipes_01,
        ]

        registerEntityAssets()

        gAssets.sfx = new SoundEffectPalette()
    }
}

class LevelTileBuilder {

    constructor() {
        this.status = ResourceStatus.LOADING
        this.ready = false

        this.work_queue = null
        this.num_jobs = 0
        this.num_jobs_completed = 0

    }

    progress() {
        if (this.num_jobs > 0) {
            return this.num_jobs_completed / this.num_jobs
        }
        return 0
    }

    update(dt) {

        if (this.work_queue === null) {
            this._init()
            return
        }

        if (this.work_queue.length == 0) {
            this.ready = true;
            return
        }

        // maximum 16 screens with 12*7==84 tiles
        // plus an additional gutter with maximum 16*4*12==768
        // for a total of 16*84 + 768==2112 tiles per layer
        // picking a small work factor so the progress bar updates

        for (let i=0; i < 256; i++) {

            if (this.work_queue.length == 0) {
                break
            }

            const [tid, tile] = this.work_queue.shift()
            let y = Math.floor(tid/512 - 4)
            let x = (tid%512)

            updateTile(this.map.layers[0], this.map.width, this.map.height, this.theme_sheets, x, y, tile)

            this.num_jobs_completed += 1
        }
    }

    _init() {
        this.map = gAssets.mapinfo

        if (!gAssets.themes[this.map.theme]) {
            console.error("undefined map theme " + this.map.theme)
            this.status = ResourceStatus.ERROR
            return
        }

        this.work_queue = Object.entries(this.map.layers[0])
        this.num_jobs = this.work_queue.length
        this.num_jobs_completed = 0

        this.theme_sheets = gAssets.themes[this.map.theme]
    }
}

class LevelChunkBuilder {
    constructor(loader) {

        this.status = ResourceStatus.LOADING
        this.ready = false

        this.work_queue = null
        this.num_jobs = 0
        this.num_jobs_submitted = 0
        this.num_jobs_completed = 0

    }


    update(dt) {
        if (this.ready) {
            return
        }

        if (this.work_queue === null) {
            this._init()
        } else {
            // for 4x7 chunks, there are 12 per screen
            // for a 16 screen map (192 chunks)
            // it would take 3200 ms to build chunks 1 per frame

            // calculate the duration this function takes
            let n_jobs = 48
            let t_start = performance.now()
            if (this.num_jobs_submitted < this.work_queue.length) {
                for (let i =0; i < n_jobs; i++) {
                    this._build_one()
                }
            }
            let t_end = performance.now()
            let t_elapsed = t_end - t_start
            if (t_elapsed > 1000/60) {
                console.log("chunk build time", t_end - t_start, "ms")
            }

            if (this.num_jobs_completed == this.num_jobs) {
                this.ready = true
                return
            }
        }

    }

    progress() {
        if (this.num_jobs > 0) {
            return this.num_jobs_completed / this.num_jobs
        } else {
            return 0;
        }
    }

    _init() {

        this.map = gAssets.mapinfo

        if (!gAssets.themes[this.map.theme]) {
            console.error("undefined map theme " + this.map.theme)
            this.status = ResourceStatus.ERROR
            return
        }


        this.map.chunks = {}

        const chunk_width = 4
        const chunk_height = 7

        // assign all visible tiles to chunks
        Object.entries(this.map.layers[0]).forEach(t => {
            let [tid, tile] = t
            let y = Math.floor(tid/512 - 4)
            let x = (tid%512)

            // don't need to build chunks for tiles that can't be drawn
            if (y < 0) {
                return
            }

            x = Math.floor(x/chunk_width)
            y = Math.floor(y/chunk_height)

            let chunkid = y * 128 + x

            if (!this.map.chunks[chunkid]) {
                this.map.chunks[chunkid] = {x:x*chunk_width, y:y*chunk_height, tiles:{}, stamps:[]}
            }

            this.theme_sheets = gAssets.themes[this.map.theme]

            this.map.chunks[chunkid].tiles[tid] = tile
        })

        console.log("update stamps", this.map.stamps.length)
        this.map.stamps.forEach(info => {
            // ignore 0 width/height stamps
            let stamp = deserialize_stamp(info)
            
            if (stamp.rect.w > 0 && stamp.rect.h > 0) {
                
                let sy = Math.floor(stamp.sid/512 - 4)
                let sx = (stamp.sid%512)
                //console.log("found stamp at", stamp.sid, {x:sx, y:sy, w:rect.w, h:rect.h})

                // determine which chunks the rect potentially overlaps
                let x0 = Math.floor(sx/chunk_width)
                let y0 = Math.floor(sy/chunk_height)
                let x1 = Math.floor((sx+stamp.rect.w)/chunk_width)
                let y1 = Math.floor((sy+stamp.rect.h)/chunk_height)

                for (let y=y0; y<=y1; y++) {
                    for (let x=x0; x<=x1; x++) {
                        let chunkid = y * 128 + x
                        // get the intersection of this chunk and the rect
                        // everything is in units of 16x16 tiles

                        let scx = Math.max(x*chunk_width, sx) - sx
                        let scy = Math.max(y*chunk_height, sy) - sy
                        let scw = (Math.min((x+1)*chunk_width, (sx + stamp.rect.w)) - sx) - scx
                        let sch = (Math.min((y+1)*chunk_height, (sy + stamp.rect.h)) - sy) - scy

                        if (y >= 0 && scw > 0 && sch > 0) {

                            if (!this.map.chunks[chunkid]) {
                                this.map.chunks[chunkid] = {x:x*chunk_width, y:y*chunk_height, tiles:{}, stamps:[]}
                            }

                            let chunk_stamp = { 
                                ...stamp,
                                // x,y is the sid of the new stamp
                                x: sx + scx,
                                y: sy + scy,
                                // rect is the region in the sheet which intersects with this chunk
                                rect: {x: stamp.rect.x+scx, y: stamp.rect.y+scy, w: scw, h: sch}
                            }

                            this.map.chunks[chunkid].stamps.push(chunk_stamp)

                            //console.log("intersection", x,y,chunkid, chunk_stamp.rect)
                        }
                    }
                }
                        //if (!this.map.chunks[chunkid]) {
                        //    this.map.chunks[chunkid] = {x:x*chunk_width, y:y*chunk_height, tiles:{}}
                        //}


            }
        })

        this.work_queue = Object.values(this.map.chunks)

        this.num_jobs = this.work_queue.length
        this.num_jobs_submitted = 0
        this.num_jobs_completed = 0

        this.canvas = document.createElement('canvas');
        this.canvas.width = chunk_width * 16;
        this.canvas.height = chunk_height * 16;
        this.ctx = this.canvas.getContext("2d");
    }

    _build_one() {
        if (this.num_jobs_submitted >= this.work_queue.length) {
            return
        }

        const chunk = this.work_queue[this.num_jobs_submitted]

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        Object.entries(chunk.tiles).forEach(t => {
            let [tid, tile] = t
            let y = Math.floor(tid/512 - 4)
            let x = (tid%512)

            x -= chunk.x
            y -= chunk.y

            //paintTile(this.ctx, x, y, tile)
            //tile.tile.draw(this.ctx, x*16, y*16)
            this.theme_sheets[tile.sheet].drawTile(this.ctx, tile.tile, x*16, y*16)
        })

        // paint each stamp to the chunk

        chunk.stamps.forEach(stamp => {

            let x = stamp.x - chunk.x
            let y = stamp.y - chunk.y

            /*
            this.ctx.beginPath()
            this.ctx.rect(x*16, y*16, stamp.rect.w*16, stamp.rect.h*16)
            this.ctx.fillStyle = (x+y)%2 == 0 ? "blue" : "red"
            this.ctx.strokeStyle = "black"
            this.ctx.fill()
            this.ctx.stroke()
            */

            // rect1 is the region of the sheet to paint
            // rect2 is where in the CHUNK to paint the rect1 region
            let rect1 = stamp.rect
            this.ctx.drawImage(gAssets.sheets.stamp_plains_00.image, 
                rect1.x*16, rect1.y*16, rect1.w*16, rect1.h*16,
                x*16, y*16, stamp.rect.w*16, stamp.rect.h*16)

            //console.log("paint chunk", x,y,stamp.rect.w, stamp.rect.h)
        })

        let chunk_image = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)

        createImageBitmap(chunk_image)
            .then(image => {
                chunk.image = image;
                this.num_jobs_completed += 1
            })
            .catch(err => {
                this.status = ResourceStatus.ERROR
                console.error(err)
            })

        this.num_jobs_submitted += 1
    }
}

class MapBuilder {
    constructor(loader) {
        this.status = ResourceStatus.LOADING
        this.ready = false

        this.map = null
    }

    progress() {
        return 1.0
    }

    update(dt) {

       if (this.ready) {
            return
        }

        if (this.map === null) {
            this._init()
        }

        this._build_step()

    }

    _init() {

        this.map = new PlatformMap()

        gAssets.map = this.map

        // TODO 4 tile gutter in the -y direction
        Physics2dPlatformV2.maprect = new Rect(0, -64, gAssets.mapinfo.width, gAssets.mapinfo.height+64)

        this.createObject = (t, p) => {return this.map.createObject(this.map._x_nextEntId(), t, p)}

        this.map._x_player = this.createObject("Player", {x: 200-64, y:128, playerId: "player"})
    }

    _build_step() {

        const mapinfo = gAssets.mapinfo

        Object.entries(mapinfo.layers[0]).forEach(t => {
            let [tid, tile] = t
            let y = 16*(Math.floor(tid/512 - 4))
            let x = 16*(tid%512)
            let objname = null
            let objprops = null

            if (tile.shape==TileShape.FULL || tile.shape==TileShape.ALT_FULL) {
                objname = "Wall"
                objprops = {x:x, y:y, w:16, h:16}
            } else if (tile.shape==TileShape.HALF) {
                objname = "Slope"
                objprops = {x:x, y:y, w:16, h:16, direction:tile.direction, kind:"half"}
            } else if (tile.shape==TileShape.ONETHIRD) {
                if (tile.direction&Direction.UP) {
                    y += 8
                }
                objname = "Slope"
                objprops = {x:x, y:y, w:16, h:8, direction:tile.direction, kind:"onethird"}
            } else if (tile.shape==TileShape.TWOTHIRD) {
                //if (tile.direction&TileShape.DOWN) {
                //    y += 8
                //}
                objname = "Slope"
                objprops = {x:x, y:y, w:16, h:16, halfheight:true, direction:tile.direction, kind:"twothird"}
            } else {
                console.error("error", tile)
            }

            if (objname !== null) {
                if (tile.property == TileProperty.SOLID) {
                    objprops.visible = false
                    this.createObject(objname, objprops)
                }

                else if (tile.property == TileProperty.ONEWAY) {
                    objprops.visible = false
                    if (objname == 'Slope') {
                        objprops.oneway = true
                    } else {
                        objname = "OneWayWall"
                        objprops.h = 8
                    }
                    this.createObject(objname, objprops)
                }

                //else if (tile.property == TileProperty.ONEWAY) {
                //    objprops.visible = false
                //    this.createObject(objname, objprops)
                //}
            }
        })

        // spawn map objects
        let doors = {}

        mapinfo.objects.forEach(obj => {
            let y = 16*(Math.floor(obj.oid/512 - 4))
            let x = 16*(obj.oid%512)
            let objname = obj.name
            let objprops = {x:x, y:y, ...obj.props}
            let ent = this.createObject(objname, objprops)
            // deactivate objects until it is in the camera view
            ent.active = false

            if (objprops.door_id !== undefined) {
                doors[objprops.door_id] = ent
            }
        })

        if (Object.keys(doors).length == 0) {
            console.error("no door specified")
            console.warn(gAssets.mapinfo)
        } else {
            // either spawn in in the lowest door
            // or use the transition target door if available

            let door = Object.entries(doors).reduce((a,b) => a[0] < b[0] ? a : b)[1]

            if (doors[gCharacterInfo.current_map.door_id] != undefined) {
                door = doors[gCharacterInfo.current_map.door_id]
            } else {
                console.error("door id error", gCharacterInfo.current_map)
            }

            door.spawnEntity(this.map._x_player)

        }


        this.ready = true
    }

}

export class LevelLoaderScene extends ResourceLoaderScene {

    // iterative loader for building a csp map
    // load the json (skip if global mapinfo present)
    // build tile chunks
    // create objects
    // add the mapinfo and map to the global namespace

    // tile chunks are 4 * 7 tiles

    constructor(mapurl, edit, success_cbk) {

        super(success_cbk);
        console.log("load: " + mapurl)

        //this.mapurl = "maps/" + this.mapid + ".json"
        this.mapurl = mapurl
        this.task_edit = edit

        this.index = 0

        this.build_loader()
    }

    paint(ctx) {
        super.paint(ctx)
    }

    update(dt) {
        super.update(dt)
    }

    build_loader() {

        this.pipeline = []

        if (this.mapurl == gAssets.mapinfo.mapurl && this.mapurl !== null) {
            console.log("load current level")
        } else if (this.mapurl == null) {
            console.log("load new level")
            gAssets.mapinfo = new MapInfo()
            gAssets.mapinfo.mapurl = this.mapurl
            gAssets.mapinfo.theme = "plains"
            gAssets.mapinfo.width = 24*16
            gAssets.mapinfo.height = 14*16
            gAssets.mapinfo.layers = [{}]
            gAssets.mapinfo.objects = []
            gAssets.mapinfo.stamps = []
        } else if (!!this.mapurl) {
            console.log("load level:", RES_ROOT + "/" + this.mapurl)

            gAssets.mapinfo = new MapInfo()
            gAssets.mapinfo.mapurl = this.mapurl
            gAssets.mapinfo.theme = "plains"
            gAssets.mapinfo.width = 24*16
            gAssets.mapinfo.height = 14*16
            gAssets.mapinfo.layers = [{}]
            gAssets.mapinfo.objects = []
            gAssets.mapinfo.stamps = []

            const info_loader = new ResourceLoader()

            info_loader.addJson("map")
                .path(RES_ROOT + "/" + this.mapurl)
                .transform(json => {

                    json.layers[0] = Object.fromEntries(json.layers[0].map(deserialize_tile))

                    console.log("json loaded")

                    let w = Math.min(json.width, 16*12*32)
                    let h = Math.min(json.height, 16*7*32)

                    // TODO: limit maps to maximum of 16 screens

                    gAssets.mapinfo.width = w
                    gAssets.mapinfo.height = h
                    gAssets.mapinfo.theme = json?.theme??"plains"
                    gAssets.mapinfo.layers = json?.layers??[{}]
                    gAssets.mapinfo.objects = json?.objects??[]
                    gAssets.mapinfo.stamps = json?.stamps??[]
                    console.log("json loaded stamps", gAssets.mapinfo.stamps.length)
                    console.log("current theme", gAssets.mapinfo.theme)

                    // filter objects which do not exist
                    const objects = Object.fromEntries(editorEntities.map(x=>[x.name,x.ctor]))
                    gAssets.mapinfo.objects = gAssets.mapinfo.objects.filter(x => !!objects[x.name])

                    return json
                })

            this.pipeline.push(info_loader)
        } else if (!this.task_edit) {
            throw {"error": "mapid is null", "mapurl": this.mapurl, "edit":this.task_edit}
        } else {
            throw {"error": "unknown task", "mapurl": this.mapurl, "edit":this.task_edit}
        }

        this.pipeline.push(new AssetLoader())
        this.pipeline.push(new LevelTileBuilder())

        if (!this.task_edit) {
            this.pipeline.push(new LevelChunkBuilder())
            this.pipeline.push(new MapBuilder())
        }

        this.pipeline_index = 0
    }
}