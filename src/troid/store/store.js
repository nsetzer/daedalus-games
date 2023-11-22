 

// about 135 combinations of guns
// essentially 8 primary gun modes

// power beam + element
// split beam + element
// wave beam + element
// bubble gun
// bounce + element
// squirt gun
// flame thrower
// spread gun

// __________
// | Normal |_________________________________
// |--------| NORMAL   | WAVE     | BOUNCE   |
// | POWER  |          |          |          |
// | FIRE   |          | spread   | fireball |
// | WATER  |          |          | splash   |
// | ICE    |          |          | iceball  |
// | BUBBLE | small    | small    | small    |
//--------------------------------------------

// __________
// | CHARGE |_________________________________
// |--------| NORMAL   | WAVE     | BOUNCE   |
// | POWER  |          |          |          |
// | FIRE   |          |          |          |
// | WATER  |          |          | splash   |
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
        this.element = WeaponType.ELEMENT.WATER
        this.beam = WeaponType.BEAM.WAVE
        this.level = WeaponType.LEVEL.LEVEL3
        this.modifier = WeaponType.MODIFIER.RAPID

        // where to spawn the player when they die
        this.current_map_spawn = {world_id:"",level_id:0,door_id:0}
        // where to spawn the player when loading the current map
        this.current_map = {world_id:"",level_id:0,door_id:0}
    }
}

export const gCharacterInfo = new CharacterInfo()

export class MapInfo {
    constructor() {
        this.mapurl = null
        this.theme = ""
        this.width = 24 * 16 // 1 screen is 24x14 tiles
        this.height = 14 * 16
        this.layers = [{}]
        this.chunks = {}
        this.objects = []
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
    "map": null,
    "themes": {}
}
