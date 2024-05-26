

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
WeaponElementType.POWER  = 1
WeaponElementType.FIRE   = 2
WeaponElementType.WATER  = 3
WeaponElementType.ICE    = 4
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

export class CharacterInventoryEnum {
    static BEAM_ELEMENT_FIRE = "beam_element_fire"
    static BEAM_ELEMENT_WATER = "beam_element_water"
    static BEAM_ELEMENT_ICE = "beam_element_ice"
    static BEAM_ELEMENT_BUBBLE = "beam_element_bubble"
    static BEAM_TYPE_WAVE = "beam_type_wave"
    static BEAM_TYPE_BOUNCE = "beam_type_bounce"
    static BEAM_LEVEL_2 = "beam_level_2"
    static BEAM_LEVEL_3 = "beam_level_3"
    static BEAM_MOD_CHARGE = "beam_mod_charge"
    static BEAM_MOD_RAPID = "beam_mod_rapid"

    static SKILL_MORPH_BALL = "skill_morph_ball"
    static SKILL_DOUBLE_JUMP = "skill_double_jump"
    static SKILL_SPIKE_BALL = "skill_spike_ball"
}
export class CharacterInfo {

    constructor() {
        this.element = WeaponType.ELEMENT.FIRE
        this.beam = WeaponType.BEAM.NORMAL
        this.level = WeaponType.LEVEL.LEVEL3
        this.modifier = WeaponType.MODIFIER.NORMAL
        this.coins = 0
        this.current_health = 3
        this.max_health = 12

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

export class SoundEffectPalette {

    //BEAM_SHOOT = {}
    //BEAM_CHARGE = {}
    //BEAM_CHARGE_LOOP = {}
    //BEAM_FLAMETHROWER_CHARGE: any = null
    //BEAM_FLAMETHROWER_STEADY: any = null
    //BEAM_SQUIRT_CHARGE: any = null
    //BEAM_SQUIRT_STEADY: any = null
    //BEAM_SPLASH: any = null
    //BEAM_SPREAD: any = null
    //BEAM_BUBBLE_POP: any = null
    //MISSILE_SHOOT: any = null
    //MISSILE_IMPACT: any = null
    //PLAYER_JUMP: any = null
    //PLAYER_DOUBLE_JUMP: any = null
    //PLAYER_BOUNCE: any = null
    //PLAYER_MORPH: any = null
    //PLAYER_UNMORPH: any = null
    //PLAYER_HURT: any = null
    //PLAYER_PIPE_ENTER: any = null
    //PLAYER_PIPE_EXIT: any = null
    //PLAYER_DOOR_ENTER: any = null
    //PLAYER_DOOR_EXIT: any = null
    //MOB_HURT_1: any = null
    //MOB_HURT_2: any = null
    //MOB_HURT_3: any = null

    //ITEM_COLLECT: any = null
    //ITEM_COLLECT_COIN: any = null
    //GUI_CLICK_1: any = null
    //GUI_CLICK_2: any = null
    //GUI_CLICK_3: any = null

    constructor() {
        // map loaded audio assets to how they should be used

        const nullsound = {play: ()=>{}, loop: ()=>{}, stop: ()=>{}}

        // 17 beam sounds
        this.BEAM_SHOOT = {}
        this.BEAM_SHOOT[WeaponElementType.POWER ] = gAssets.sounds.fireBeam
        this.BEAM_SHOOT[WeaponElementType.FIRE  ] = gAssets.sounds.fireBeam
        this.BEAM_SHOOT[WeaponElementType.WATER ] = gAssets.sounds.fireBeam
        this.BEAM_SHOOT[WeaponElementType.ICE   ] = gAssets.sounds.fireBeam
        this.BEAM_SHOOT[WeaponElementType.BUBBLE] = gAssets.sounds.fireBeam

        this.BEAM_CHARGE = {}
        this.BEAM_CHARGE[WeaponElementType.POWER ] = gAssets.sounds.fireBeamCharge
        this.BEAM_CHARGE[WeaponElementType.FIRE  ] = gAssets.sounds.fireBeamCharge
        this.BEAM_CHARGE[WeaponElementType.WATER ] = gAssets.sounds.fireBeamCharge
        this.BEAM_CHARGE[WeaponElementType.ICE   ] = gAssets.sounds.fireBeamCharge
        this.BEAM_CHARGE[WeaponElementType.BUBBLE] = gAssets.sounds.fireBeamCharge

        this.BEAM_CHARGE_LOOP = {}
        this.BEAM_CHARGE_LOOP[WeaponElementType.POWER ] = gAssets.sounds.fireBeamChargeLoop
        this.BEAM_CHARGE_LOOP[WeaponElementType.FIRE  ] = gAssets.sounds.fireBeamChargeLoop
        this.BEAM_CHARGE_LOOP[WeaponElementType.WATER ] = gAssets.sounds.fireBeamChargeLoop
        this.BEAM_CHARGE_LOOP[WeaponElementType.ICE   ] = gAssets.sounds.fireBeamChargeLoop
        this.BEAM_CHARGE_LOOP[WeaponElementType.BUBBLE] = gAssets.sounds.fireBeamChargeLoop

        this.BEAM_FLAMETHROWER_CHARGE = gAssets.sounds.fireBeamFlameStart
        this.BEAM_FLAMETHROWER_STEADY = gAssets.sounds.fireBeamFlameLoop

        this.BEAM_SQUIRT_CHARGE = gAssets.sounds.fireBeamFlameStart
        this.BEAM_SQUIRT_STEADY = gAssets.sounds.fireBeamFlameLoop

        this.BEAM_SPLASH = nullsound
        this.BEAM_SPREAD = gAssets.sounds.fireBeam

        this.BEAM_BUBBLE_POP = gAssets.sounds.bubble_pop

        // 2 missile sounds
        this.MISSILE_SHOOT = gAssets.sounds.fireBeam
        this.MISSILE_IMPACT = nullsound

        // 9 player sounds
        this.PLAYER_JUMP = gAssets.sounds.jump
        this.PLAYER_DOUBLE_JUMP = gAssets.sounds.jump
        this.PLAYER_BOUNCE = gAssets.sounds.jump
        this.PLAYER_MORPH = gAssets.sounds.curl
        this.PLAYER_UNMORPH = gAssets.sounds.uncurl
        this.PLAYER_HURT = nullsound
        this.PLAYER_PIPE_ENTER = nullsound
        this.PLAYER_PIPE_EXIT = nullsound
        this.PLAYER_DOOR_ENTER = nullsound
        this.PLAYER_DOOR_EXIT = nullsound

        // 3 mob sounds
        this.MOB_HURT_1 = nullsound
        this.MOB_HURT_2 = nullsound
        this.MOB_HURT_3 = nullsound

        // 2 item sounds
        this.ITEM_COLLECT = gAssets.sounds.coin_collect
        this.ITEM_COLLECT_COIN = gAssets.sounds.coin_collect
        this.ITEM_BREAK_BRICK = gAssets.sounds.break_brick
        this.ITEM_POWERUP = gAssets.sounds.powerup

        // 3 gui sounds
        this.GUI_CLICK_1 = gAssets.sounds.click1
        this.GUI_CLICK_2 = gAssets.sounds.click2
        this.GUI_CLICK_3 = gAssets.sounds.click3

        // 17 + 2 + 9 + 3 + 2 + 3 =
        // 36 total sounds

    }
}


export const EditorControl = {}
// Choice
// parameters: {name: str, default: value, choices: list-or-map}
// allows picking an item out of a set of choices.
// adds a property by name to the target object
// if choices is a map: then the key is the display name.
// if choices is a list: then the list must be a list of strings or numbers
EditorControl.CHOICE = 1

//EditorControl.CHOOSE_ENTITY = x  // like CHOICE but shows icons from a list of named entities

// Door Target
// parameters: {}
// adds "target_world_id", "target_level_id", "target_door_id" as dynamic properties
// these properties can be edited to set where the door should open up
EditorControl.DOOR_TARGET = 2

// Door ID
// parameters: {}
// automatically adds a unique door identifier to this object
EditorControl.DOOR_ID = 3

// 4-Way Direction
// parameters: {default: value}
// allows picking one of 4 directions: Up, Down, Left, Right
// adds a property "direction" to an object
EditorControl.DIRECTION_4WAY = 4

// Text
// parameters: {property: value, default: value}
// allow editing a text property
// adds a property with a given name to the object
EditorControl.TEXT = 8

// Resize
// parameters: {min_width, max_width, min_height, max_height}
// adds properties to an object "width" and "height"
// the map editor can resize instead of moving
// the property dialog uses spin boxes to edit width and height
EditorControl.RESIZE = 9

// Range
EditorControl.RANGE = 10
// parameters: {name: str, min, max, step:1}

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
    "themes": {},
    "sfx": null // instance of SoundEffectPalette
}
