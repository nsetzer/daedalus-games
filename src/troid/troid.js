 
// stages should be 15 screens wide (15*12*32 = 5760 pixels)
// at 150 pixels per second, a flat run would clear a stage in 5760/150 ~ 38.4 seconds

// as for objects
// every map needs a spawn point and an exit point
// spawn:
//   warp pipe (player jumps out of it)
//   secret entrance (from some other maps secret exit)
// exit point
//   flag pole
//   secret exit (goes to a target maps secret entrance or default spawn)
// doors
//   up to N doors each named A,B,C
//   like a secret exit/entrance pair. doors warp to the corresponding named
//   door of another map.
// when using the map editor: all exits kick you back to the editor
$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})

$import("scenes", {MainScene, LevelLoaderScene, LevelEditScene, LevelEditSelectScene, transitionToLevel})
$import("store", {MapInfo, gAssets, gCharacterInfo, WeaponType})

$import("api", {})
window.print = console.log

export default class Application extends ApplicationBase {
    constructor() {

        const query = daedalus.util.parseParameters()

        // hack to avoid importing the main scene in the editor
        LevelLoaderScene.scenes = {
            main: MainScene,
            edit: LevelEditScene,
            select: LevelEditSelectScene,

        }
        // hack to avoid circular import
        gCharacterInfo.transitionToLevel = transitionToLevel


        const world_id = "zone1"
        const level_id = 1
        const door_id = 1
        gCharacterInfo.current_map = {world_id, level_id, door_id}
        gCharacterInfo.current_map_spawn = {world_id, level_id, door_id}


        super({
            portrait: 0,
            fullscreen: 0,
            screen_width: 12*32,
            screen_height: 7*32
        }, () => {

            const edit = true
            // mapid can be null or a filename
            const mapurl = null // "map-2x1-20231112-120815"

            return new LevelLoaderScene(mapurl, edit, ()=>{

                if (edit) {
                    if (mapurl === null) {
                        gEngine.scene = new LevelEditSelectScene()
                    } else {
                        gEngine.scene = new LevelEditScene()
                    }
                } else {
                    gEngine.scene = new MainScene()
                }

                console.log("done!")
            })
        })
    }
}