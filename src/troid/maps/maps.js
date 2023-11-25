 

$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("entities", {
    defaultEntities, editorEntities
})

export class PlatformMap extends CspMap {

    constructor() {
        super()

        this.registerClass("Wall", Wall)
        this.registerClass("OneWayWall", OneWayWall)
        this.registerClass("Slope", Slope)

        // misc / non-editor entities
        defaultEntities.forEach(obj => {
            this.registerClass(obj.name, obj.ctor)
        })

        editorEntities.forEach(obj => {
            this.registerClass(obj.name, obj.ctor)
        })
    }

    paint(ctx) {

        //ctx.beginPath();
        //ctx.strokeStyle = "blue"
        //ctx.moveTo( Physics2dPlatform.maprect.left(), Physics2dPlatform.maprect.top());
        //ctx.lineTo( Physics2dPlatform.maprect.cx(), Physics2dPlatform.maprect.bottom());
        //ctx.lineTo( Physics2dPlatform.maprect.right(), Physics2dPlatform.maprect.top());
        //ctx.stroke()

        for (const obj of Object.values(this.objects)) {

            if (obj.visible !== false) { // explicit check for false, allow undefined
                obj.paint(ctx)
            }
        }

    }
}

