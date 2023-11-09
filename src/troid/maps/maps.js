 

$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("entities", {
    Player, Coin, Brick,
    Creeper, Shredder, Spawn,
    Bullet, BubbleBullet, BounceBullet, WaterBeam, FireBeam
})

export class PlatformMap extends CspMap {

    constructor() {
        super()

        // misc / non-editor entities
        this.registerClass("Player", Player)
        this.registerClass("Bullet", Bullet)
        this.registerClass("BubbleBullet", BubbleBullet)
        this.registerClass("BounceBullet", BounceBullet)
        this.registerClass("WaterBeam", WaterBeam)
        this.registerClass("FireBeam", FireBeam)

        // tiles
        this.registerClass("Wall", Wall)
        this.registerClass("OneWayWall", OneWayWall)
        this.registerClass("Slope", Slope)

        // objects
        this.registerClass("Coin", Coin)
        this.registerClass("Brick", Brick)
        this.registerClass("Creeper", Creeper)
        this.registerClass("Shredder", Shredder)
        this.registerClass("Spawn", Spawn)
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

