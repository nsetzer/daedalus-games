 

import {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
} from "@axertc/axertc_physics"

import {defaultEntities, editorEntities} from "@troid/entities/sys"

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

        // sort this.objects by layer prop
        const objs = Object.values(this.objects)
        objs.sort((a, b) => {
            return a.layer - b.layer
        })

        for (const obj of objs) {

            if (obj.visible !== false) { // explicit check for false, allow undefined
                obj.paint(ctx)
            }
        }

    }
}

