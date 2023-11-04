 

// __________
// | Normal |_________________________________
// |--------| NORMAL   | WAVE     | BOUNCE   |
// | POWER  |          |          |          |
// | FIRE   |          | spread   | fireball |
// | WATER  |          |          |          |
// | ICE    |          |          | iceball  |
// | BUBBLE | small    | small    | small    |
//--------------------------------------------

// __________
// | CHARGE |_________________________________
// |--------| NORMAL   | WAVE     | BOUNCE   |
// | POWER  |          |          |          |
// | FIRE   |          |          |          |
// | WATER  |          |          |          |
// | ICE    |          |          |          |
// | BUBBLE | big      | big      | big      |
//--------------------------------------------

// __________
// | RAPID  |_________________________________
// |--------| NORMAL   | WAVE     | BOUNCE   |
// | POWER  |          |          |          |
// | FIRE   |          | flame    |          |
// | WATER  | squirt   | squirt   | squirt   |
// | ICE    |          |          |          |
// | BUBBLE | many     | many     | many     |
//--------------------------------------------

const WeaponElementType = {}
WeaponElementType.POWER = 1
WeaponElementType.FIRE = 2
WeaponElementType.WATER = 3
WeaponElementType.ICE = 4
WeaponElementType.BUBBLE = 5

const WeaponBeamType = {}
WeaponBeamType.NORMAL = 1
WeaponBeamType.WAVE = 2
WeaponBeamType.BOUNCE = 3

const WeaponLevelType = {}
WeaponLevelType.LEVEL1 = 1
WeaponLevelType.LEVEL2 = 2
WeaponLevelType.LEVEL3 = 3

const WeaponModifierType = {}
WeaponModifierType.NORMAL = 1
WeaponModifierType.CHARGE = 2
WeaponModifierType.RAPID = 3

export const WeaponType = {}
WeaponType.ELEMENT = WeaponElementType
WeaponType.BEAM = WeaponBeamType
WeaponType.LEVEL = WeaponLevelType
WeaponType.MODIFIER = WeaponModifierType

export class CharacterInfo {

    constructor() {
        this.element = WeaponType.ELEMENT.ICE
        this.beam = WeaponType.BEAM.WAVE
        this.level = WeaponType.LEVEL.LEVEL3
        this.modifier = WeaponType.MODIFIER.RAPID
    }
}

export const gCharacterInfo = new CharacterInfo()

export class MapInfo {
    constructor() {
        this.mapid = null
        this.width = 0
        this.height = 0
        this.layers = [{}]
        this.chunks = {}
        this.objects = {}
    }
}



export const gAssets = {
    // all of the assets currently loaded
    "music": {},
    "sounds": {},
    "sheets": {},
    "font": {},
    // meta data for the current map
    "mapinfo": new MapInfo(),
    // the current map
    "map": null
}
