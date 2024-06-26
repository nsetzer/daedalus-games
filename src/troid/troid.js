 
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
import {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput
} from "@axertc/axertc_client"

import {
    MainScene, LevelLoaderScene, LevelEditScene, 
    LevelEditSelectScene, transitionToLevel
} from "@troid/scenes"

import {MapInfo, gAssets, gCharacterInfo, WeaponType} from "@troid/store"

import {} from "@troid/api"

window.print = console.log

function parseMapId(mapid) {
    let delimiter = mapid.includes('.') ? '.' : '-';
    let parts = mapid.split(delimiter);
    let values = parts.map(part => parseInt(part, 10));
    if (values.length == 2) {
        return {"world": values[0], "level": values[1]}
    }
    return null
}

function zeroPad(number) {
    return number < 10 ? '0' + number : '' + number;
}


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





        super({
            portrait: 0,
            fullscreen: 1,
            screen_width: 12*32,
            screen_height: 7*32
        }, () => {

            const edit = query.edit == "true"

            let mapid_string = daedalus.env.debug?"01-04":"01-11"
            let mapid = parseMapId(mapid_string)

            if (query.mapid) {
                let tmp = parseMapId(query.mapid[0])
                if (!!tmp) {

                }
                mapid = tmp
            }

            const world_id = `world_${zeroPad(mapid.world)}`
            const level_id = mapid.level
            const door_id = 1
            gCharacterInfo.current_map = {world_id, level_id, door_id}
            gCharacterInfo.current_map_spawn = {world_id, level_id, door_id}

            const mapurl = `maps/${world_id}/level_${zeroPad(mapid.level)}.json`
            //const mapurl = daedalus.env.debug?"maps/world_01/level_04.json":"maps/world_01/level_01.json"

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