 

import {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
} from "@axertc/axertc_physics"

import {
    defaultEntities, editorEntities
} from "entities"

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

        for (const obj of Object.values(this.objects)) {

            if (obj.visible !== false) { // explicit check for false, allow undefined
                obj.paint(ctx)
            }
        }

    }
}

