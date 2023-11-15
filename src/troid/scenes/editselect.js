 $import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("store", {MapInfo, gAssets})

$import("tiles", {TileShape, TileProperty, updateTile, paintTile})
$import("entities", {editorEntities})
$import("maps", {PlatformMap})

$import("api", {get_map_world_manifest, get_map_world_level_manifest})

$include("./editor.js")
$include("./resource.js")

class ScrollItem {

    constructor() {
        this.rect = new Rect(0,0,0,16)

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

        this.actions = [
            {
                rect: new Rect(0,0,0,0),
                action: () => {
                    this.callback()
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
        ctx.strokeStyle = "#00aa00"
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

        this.actions = []

        this.actions.push({
            rect: new Rect(rect.cx()-8, rect.top() + 4, 16, 16),
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
        }

        for (let i = this.index; i < this.index + this.count; i ++) {
            this.children[i].paint(ctx)
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

    clearChildren() {
        this.children = []
        this.index = 0
        this.count = 0
    }
    addChild(child) {
        this.children.push(child)

        this.updateLayout()
    }

    updateLayout() {

        let y1 = this.rect.top() + 4 + 4 + 16
        let y2 = this.rect.bottom() - 4 - 4 - 16

        let y = y1
        this.count = 0
        for (let i = this.index; i < this.children.length; i++) {

            let child = this.children[i]

            // resize the child
            child.layout(this.rect.x + 4, y, this.rect.w - 8, y2 - y1)
            // let the child determine how much height it needs
            y += child.rect.h + 4
            // if the child does not fit, break and do not render it
            if (y + child.rect.h > y2) {
                break
            }

            this.count += 1
        }
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

        let w1 = gEngine.view.width/3
        let w2 = gEngine.view.width - w1
        let h = gEngine.view.height - 24

        this.area_worlds = new ScrollArea(new Rect(8, 32, w1 - 8 - 2, h - 16))
        this.area_levels = new ScrollArea(new Rect(w1 + 2, 32, w2 - 8 - 2, h - 16))
        this.widgets.push(this.area_worlds)
        this.widgets.push(this.area_levels)

        get_map_world_manifest().then(json => {
            let worlds = json.worlds.sort()
            worlds.forEach(name => {
                this.area_worlds.addChild(new TextItem(name, ()=>{this.onSelectWorld(name)}))
            })
            this.onSelectWorld(worlds[0])
        })

    }

    onSelectWorld(world) {
        this.currentWorld = world
        this.area_levels.clearChildren()
        get_map_world_level_manifest(world).then(json => {
            json.levels.sort().forEach(level => {
                this.area_levels.addChild(new TextItem(level.name, () => {this.onSelectLevel(level)}))
            })
        })
    }

    onSelectLevel(level) {
        console.log(level)

        gEngine.scene = new LevelLoaderScene(level.url, true, () => {
            gEngine.scene = new LevelLoaderScene.scenes.edit()
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