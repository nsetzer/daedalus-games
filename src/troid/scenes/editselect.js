 $import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("store", {MapInfo, gAssets})

$import("tiles", {TileShape, TileProperty, updateTile, paintTile})
import {defaultEntities, editorEntities} from "@troid/entities/sys"
$import("maps", {PlatformMap})

$import("api", {get_map_world_manifest, get_map_world_level_manifest})

$include("./editor.js")
$include("./resource.js")

class ScrollItem {

    constructor() {
        this.rect = new Rect(0,0,0,16)
        this.selected = false
        this.index = -1

    }

    paint(ctx) {
        ctx.beginPath()
        ctx.strokeStyle = "#00aa00"
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 2)
        ctx.closePath()
        ctx.stroke()
    }

    handleTouches(touches) {
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }
}

class TextItem extends ScrollItem {

    constructor(text, callback) {
        super()
        this.rect = new Rect(0,0,0,0)
        this.text = text
        this.callback = callback
        this.index = -1
        this.selected = false

        this.actions = [
            {
                rect: new Rect(0,0,0,0),
                action: () => {
                    this.callback(this.index)
                }
            }
        ]
    }

    layout(x,y,w,h) {
        this.rect.x = x
        this.rect.y = y
        this.rect.w = w
        this.rect.h = 20

        this.actions[0].rect.x = this.rect.x + this.rect.w - 18
        this.actions[0].rect.y = this.rect.y + 2
        this.actions[0].rect.w = 16
        this.actions[0].rect.h = 16
    }

    paint(ctx) {
        ctx.beginPath()
        ctx.strokeStyle = this.selected?"#FFFF00":"#009900"
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 2)
        ctx.closePath()
        ctx.stroke()

        this.actions.forEach(act => {
            let rect = act.rect
            ctx.beginPath()
            ctx.strokeStyle = "#00aa00"
            ctx.rect(rect.x, rect.y, rect.w, rect.h)
            ctx.closePath()
            ctx.stroke()
        })


        ctx.font = "bold 16px";
        ctx.fillStyle = "#00aa00"
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        ctx.fillText(this.text, this.rect.x + 2, this.rect.cy())

    }

    handleTouches(touches) {

        if (touches.length > 0) {
            let t = touches[0]
            this.actions.forEach(act => {
                if (act.rect.collidePoint(t.x, t.y)) {
                    if (!t.pressed) {
                        console.log(this)
                        act.action()
                    }
                }
            })
        }
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }

}

class ScrollArea {
    constructor(rect) {
        this.rect = rect
        this.title = ""
        this.selected_index = -1

        this.actions = []

        this.actions.push({
            rect: new Rect(rect.cx()-8, rect.top() + 4, 16, 16),
            icon: gAssets.sheets.editor.tile(6),
            action: () => {
                if (this.index > 0) {
                    this.index -= 1
                }
                this.updateLayout()
                console.log("up")
            }
        })
        this.actions.push({
            rect: new Rect(rect.cx()-8, rect.bottom() - 4 - 16, 16, 16),
            icon: gAssets.sheets.editor.tile(7),
            action: () => {
                if (this.index < this.children.length - 1) {
                    this.index += 1
                }
                this.updateLayout()
                console.log("down")
            }
        })

        this.children = []

        this.index = 0
        this.count = 0


    }

    paint(ctx) {

        ctx.beginPath()
        ctx.strokeStyle = "#00aa00"
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 4)
        ctx.closePath()
        ctx.stroke()

        for (let i =0; i < this.actions.length; i++) {
            let rect = this.actions[i].rect
            ctx.beginPath()
            ctx.strokeStyle = "#00aa00"
            ctx.rect(rect.x, rect.y, rect.w, rect.h)
            ctx.closePath()
            ctx.stroke()

            if (!!this.actions[i].icon) {
                this.actions[i].icon.draw(ctx, rect.x, rect.y)
            }
        }

        for (let i = this.index; i < this.index + this.count; i ++) {
            this.children[i].selected = (i == this.selected_index)
            this.children[i].paint(ctx)
        }

        if (!!this.title) {
            ctx.font = "bold 16px";
            ctx.fillStyle = "#00aa00"
            ctx.textAlign = "left"
            ctx.textBaseline = "middle"
            ctx.fillText(this.title, this.rect.x + 4, this.rect.top() + 4 + 8)
        }

    }

    handleTouches(touches) {

        this.actions.forEach(act => {
            let t = touches.filter(t => act.rect.collidePoint(t.x, t.y))
            if (t.length > 0 && !t[0].pressed) {
                act.action()
            }
        })

        for (let i = this.index; i < this.index + this.count; i ++) {
            let t = touches.filter(t => this.children[i].rect.collidePoint(t.x, t.y))
            if (t.length > 0 && !t[0].pressed) {
                this.children[i].handleTouches(t)
            }
        }

    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }

    setSelected(index) {
        console.log("set selected", index, this.children.length)
        this.selected_index = index
    }

    clearChildren() {
        this.children = []
        this.index = 0
        this.count = 0
        this.selected_index = -1
    }

    addChild(child) {
        child.index = this.children.length
        this.children.push(child)

        this.updateLayout()
    }

    updateLayout() {
        const ysep = 6 // separation between items

        let y1 = this.rect.top() + 4 + 4 + 16
        let y2 = this.rect.bottom() - 4 - 4 - 16

        let y = y1
        this.count = 0
        for (let i = this.index; i < this.children.length; i++) {

            let child = this.children[i]

            // resize the child
            child.layout(this.rect.x + 4, y, this.rect.w - 8, y2 - y1)
            // let the child determine how much height it needs
            y += child.rect.h + ysep
            // if the child does not fit, break and do not render it
            if (y + child.rect.h > y2) {
                break
            }

            this.count += 1
        }
    }

}

class Button {
    constructor(rect, icon, callback) {
        this.rect = rect
        this.icon = icon
        this.callback = callback
    }

    paint(ctx) {
        ctx.beginPath()
        ctx.strokeStyle = "#00aa00"
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 2)
        ctx.closePath()
        ctx.stroke()

        if (!!this.icon) {
            this.icon.draw(ctx, this.rect.x, this.rect.y)
        }
    }

    handleTouches(touches) {

        if (touches.length > 0) {
            let t = touches[0]
            if (this.rect.collidePoint(t.x, t.y)) {
                if (!t.pressed) {
                    this.callback()
                }
            }
        }
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }
}

export class LevelEditSelectScene extends GameScene {

    // TODO: optimize: only do a full paint if something changed
    //       change the engine to not clear on every frame
    //       scene is still 60fps. but there are no animations

    constructor() {
        super()

        this.currentWorld = null

        this.widgets = []

        let bh = 24
        let w1 = gEngine.view.width/3
        let w2 = gEngine.view.width - w1
        let h = gEngine.view.height - 24

        this.area_worlds = new ScrollArea(new Rect(8, bh + 4, w1 - 8 - 2, h - 8))
        this.area_levels = new ScrollArea(new Rect(w1 + 2, bh + 4, w2 - 8 - 2, h - 8))
        this.widgets.push(this.area_worlds)
        this.widgets.push(this.area_levels)
        console.log("area", h-8, (h - 8) / 24)

        get_map_world_manifest().then(json => {
            let worlds = json.worlds.sort()
            worlds.forEach(name => {
                this.area_worlds.addChild(new TextItem(name, (index)=>{this.onSelectWorld(index,name)}))
            })
            this.onSelectWorld(0, worlds[0])
        })

        this.btn_exit = new Button(new Rect(4, 4, 16, 16), gAssets.sheets.editor.tile(2*8+3), () => {
            console.log("exit")
        })

        let r = this.area_levels.rect
        this.btn_new_level = new Button(new Rect(r.x+r.w-20, r.y+r.h - 20, 16, 16), gAssets.sheets.editor.tile(2*8+4), () => {
            this.onCreateLevel()
        })
        this.widgets.push(this.btn_exit)
        this.widgets.push(this.btn_new_level)

    }

    onSelectWorld(index, world) {
        this.area_worlds.setSelected(index)
        this.currentWorld = world
        this.area_levels.title = world
        this.area_levels.clearChildren()
        this.currentLevels = []
        get_map_world_level_manifest(world).then(json => {
            this.currentLevels = json.levels.sort()
            this.currentLevels.forEach(level => {
                this.area_levels.addChild(new TextItem(level.name, (index) => {this.onSelectLevel(index,level)}))
            })
        })
    }

    onSelectLevel(index, level) {
        console.log(level)

        gEngine.scene = new LevelLoaderScene(level.url, true, () => {
            gEngine.scene = new LevelLoaderScene.scenes.edit()
        })

    }

    onCreateLevel() {

        const id2level = this.currentLevels.reduce((a,b)=> ({...a, [b.id]: b.name}), {})
        let new_level_id = -1
        for (let i=1; i <= 99; i++) {
            if (!id2level[i]) {
                new_level_id = i
                break
            }
        }


        new_level_id = "level_" + ((new_level_id < 10)?"0":"") + new_level_id
        const mapurl = `maps/${this.currentWorld}/${new_level_id}.json`

        gAssets.mapinfo = new MapInfo()
        gAssets.mapinfo.mapurl = mapurl
        gAssets.mapinfo.theme = "plains"
        gAssets.mapinfo.width = 24*16
        gAssets.mapinfo.height = 14*16
        gAssets.mapinfo.layers = [{}]
        gAssets.mapinfo.objects = []


        gEngine.scene = new LevelLoaderScene(mapurl, true, () => {
            gEngine.scene = new LevelEditScene()
        })
    }

    _paint_header(ctx) {
        const barHeight = 24

        ctx.beginPath()
        ctx.fillStyle = "black";
        ctx.rect(0,0, gEngine.view.width, barHeight)
        ctx.fill()
    }

    paint(ctx) {
        ctx.lineWidth = 1
        this._paint_header(ctx)

        for (let i=0; i < this.widgets.length; i++) {
            this.widgets[i].paint(ctx)
        }
    }

    update(dt) {
    }

    handleTouches(touches) {

        this.widgets.forEach(wgt => {
            let t = touches.filter(t => wgt.rect.collidePoint(t.x, t.y))
            if (t.length > 0) {
                wgt.handleTouches(t)
            }
        })

    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }

}