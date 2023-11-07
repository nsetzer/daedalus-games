 
 $import("axertc_client", {
    GameScene,
    ResourceLoader, ResourceStatus

})

$import("tiles", {TileShape, TileProperty, updateTile, paintTile})

$import("axertc_common", {
    Direction, Rect, CspMap, ClientCspMap
})

const RES_ROOT = "static"

$import("store", {MapInfo, gAssets})
$import("maps", {PlatformMap})
$import("entities", {registerEntities, editorEntities})

$import("axertc_physics", {
    Physics2dPlatform
})

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
        this.timeout = 0; // how long to show the loading bar after it finished loading
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
                let t0 = performance.now()
                loader.update()
                let elapsed = performance.now() - t0
                this.stats.elapsed[this.stats.elapsed.length - 1] += elapsed
                this.stats.nupdates[this.stats.nupdates.length - 1] += 1
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

        //ctx.beginPath();
        //ctx.strokeStyle = 'red';
        //ctx.rect(-1, -1, gEngine.view.width+2, gEngine.view.height+2);
        //ctx.stroke();
        let color = 'yellow'
        if (this.pipeline_index < this.pipeline.length) {
            if (this.pipeline[this.pipeline_index].status == ResourceStatus.ERROR) {
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
            gAssets.music = {... gAssets.music, ... this.loader.music}
            gAssets.sounds = {... gAssets.sounds, ... this.loader.sounds}
            gAssets.sheets = {... gAssets.sheets, ... this.loader.sheets}
            gAssets.font = {... gAssets.font, ... this.loader.font}

            registerEntities()






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
            .path(RES_ROOT + "/sprites/player.png")
            .dimensions(32, 32)
            .layout(6, 17)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("beams16")
            .path(RES_ROOT + "/sprites/beams16_export.png")
            .dimensions(16, 16)
            .layout(11, 7)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("pipes32")
            .path(RES_ROOT + "/sprites/pipes32.png")
            .dimensions(32, 32)
            .layout(1, 4)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("brick")
            .path(RES_ROOT + "/sprites/brick.png")
            .dimensions(16, 16)
            .layout(1, 1)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("coin")
            .path(RES_ROOT + "/sprites/coin.png")
            .dimensions(16, 16)
            .layout(1, 7)
            .offset(0, 0)
            .spacing(0, 0)

        this.loader.addSpriteSheet("editor")
            .path(RES_ROOT + "/sprites/editor.png")
            .dimensions(16, 16)
            .layout(2, 8)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("pause_suit")
            .path(RES_ROOT + "/sprites/pause_suit.png")
            .dimensions(80, 128)
            .layout(1, 1)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("pause_items")
            .path(RES_ROOT + "/sprites/pause_items.png")
            .dimensions(16, 16)
            .layout(9, 6)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSpriteSheet("creeper")
            .path(RES_ROOT + "/sprites/creeper.png")
            .dimensions(24, 16)
            .layout(3, 3)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("shredder")
            .path(RES_ROOT + "/sprites/shredder.png")
            .dimensions(24, 16)
            .layout(3, 3)
            .offset(1, 18)
            .spacing(1, 1)

        this.loader.addSpriteSheet("zone_01_sheet_01")
            .path(RES_ROOT + "/sprites/tile_ground_01.png")
            .dimensions(16, 16)
            .layout(4, 11)
            .offset(1, 1)
            .spacing(1, 1)

        this.loader.addSoundEffect("click1").path(RES_ROOT + "/sfx/gui/clicksound1.wav")
        this.loader.addSoundEffect("click2").path(RES_ROOT + "/sfx/gui/clicksound2.wav")
        this.loader.addSoundEffect("click3").path(RES_ROOT + "/sfx/gui/clicksound3.wav")


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

        // TODO: parse the map data to figure out theme info

        this.theme_sheets = [null, gAssets.sheets.zone_01_sheet_01]

        this.work_queue = Object.entries(this.map.layers[0])
        this.num_jobs = this.work_queue.length
        this.num_jobs_completed = 0
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
            if (this.num_jobs_submitted < this.work_queue.length) {
                for (let i =0; i < 24; i++) {
                    this._build_one()
                }
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
                this.map.chunks[chunkid] = {x:x*chunk_width, y:y*chunk_height, tiles:{}}
            }

            this.theme_sheets = [null, gAssets.sheets.zone_01_sheet_01]

            this.map.chunks[chunkid].tiles[tid] = tile
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
        return .2
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
        Physics2dPlatform.maprect = new Rect(0, 0, gAssets.mapinfo.width, gAssets.mapinfo.height)
        console.log(gAssets.mapinfo.width, gAssets.mapinfo.height,Physics2dPlatform.maprect)

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

            if (tile.shape==TileShape.FULL) {
                objname = "Wall"
                objprops = {x:x, y:y, w:16, h:16}
            } else if (tile.shape==TileShape.HALF) {
                objname = "Slope"
                objprops = {x:x, y:y, w:16, h:16, direction:tile.direction}
            } else if (tile.shape==TileShape.ONETHIRD) {
                if (tile.direction&Direction.UP) {
                    y += 8
                }
                objname = "Slope"
                objprops = {x:x, y:y, w:16, h:8, direction:tile.direction}
            } else if (tile.shape==TileShape.TWOTHIRD) {
                if (tile.direction&TileShape.DOWN) {
                    y += 8
                }
                objname = "Slope"
                objprops = {x:x, y:y, w:16, h:8, direction:tile.direction}
            } else {
                console.log(tile)
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
                    console.log("ONEWAY", objname, objprops)
                    this.createObject(objname, objprops)
                }

                //else if (tile.property == TileProperty.ONEWAY) {
                //    objprops.visible = false
                //    this.createObject(objname, objprops)
                //}
            }
        })

        // spawn map objects
        mapinfo.objects.forEach(obj => {
            let y = 16*(Math.floor(obj.oid/512 - 4))
            let x = 16*(obj.oid%512)
            let objname = obj.name
            let objprops = {x:x, y:y}
            this.createObject(objname, objprops)
        })

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

    constructor(mapid, edit, success_cbk) {

        super(success_cbk);

        this.mapid = mapid
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

        if (this.mapid == gAssets.mapinfo.mapid) {
            console.log("load current level")
        } else if (!!this.mapid) {

            gAssets.mapinfo = new MapInfo()
            gAssets.mapinfo.mapid = this.mapid

            const info_loader = new ResourceLoader()

            info_loader.addJson("map")
                .path(RES_ROOT + "/maps/" + this.mapid + ".json")
                .transform(json => {

                    json.layers[0] = Object.fromEntries(json.layers[0].map(x => {

                        x = x&0x7FFFFFFF

                        const tid = (x >> 13)&0x3ffff
                        const shape = (x >> 10) & 0x07
                        const property = (x >> 7) & 0x07
                        const sheet = (x >> 4) & 0x07
                        const direction = x & 0x0F
                        const tile = {shape, property, sheet, direction}

                        return [tid, tile]
                    }))

                    console.log("json loaded")

                    let w = Math.min(json.width, 16*12*32)
                    let h = Math.min(json.height, 16*7*32)

                    // TODO: limit maps to maximum of 16 screens

                    gAssets.mapinfo.width = w
                    gAssets.mapinfo.height = h
                    gAssets.mapinfo.theme = json?.theme??0
                    gAssets.mapinfo.layers = json?.layers??[{}]
                    gAssets.mapinfo.objects = json?.objects??[]

                    // filter objects which do not exist
                    const objects = Object.fromEntries(editorEntities.map(x=>[x.name,x.ctor]))
                    gAssets.mapinfo.objects = gAssets.mapinfo.objects.filter(x => !!objects[x.name])

                    return json
                })

            this.pipeline.push(info_loader)
        } else if (!this.task_edit) {
            throw {"error": "mapid is null", "mapid": this.mapid, "edit":this.task_edit}
        } else {
            console.log("create new map")
            gAssets.mapinfo = new MapInfo()
            gAssets.mapinfo.mapid = "map"
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