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


export class LevelEditSelectScene extends GameScene {

    // TODO: optimize: only do a full paint if something changed
    //       change the engine to not clear on every frame
    //       scene is still 60fps. but there are no animations

    constructor() {
        super()

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
    }

    update(dt) {
    }

    handleTouches(touches) {
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
    }

}