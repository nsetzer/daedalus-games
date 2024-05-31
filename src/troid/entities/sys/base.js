

import {
    Direction, Rect,
} from "@axertc/axertc_common"

import {
    PlatformerEntity,
    Physics2dPlatformV2,
    AnimationComponent
} from "@axertc/axertc_physics"


export class ProjectileBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
    }
}

export class PlayerBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)
    }

    onInput(payload) {
        console.log("PlayerBase.onInput", payload)
    }
}

// the abstract base class for anything that can be 'hurt' by a projectile
// the MobBase implements a character component used for health and animation

export class AbstractMobBase extends PlatformerEntity {
    constructor(entid, props) {
        super(entid, props)

        this.character = {alive: 1}

    }

    hit(projectile, props) {
        // return true if the projectile collides
        return true
    }

    _kill() {
    }
}
