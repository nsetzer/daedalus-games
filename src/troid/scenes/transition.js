 
$import("store", {gCharacterInfo})
$import("api", {get_map_world_manifest, get_map_world_level_manifest})

$include("./resource.js")

const worlddata = {}

function _transition(world_id, level_id, door_id, edit) {

    const info = worlddata[world_id].filter(x => x.id == level_id)

    if (info.length == 0) {
        throw {"error": "level not found", world_id, level_id, door_id}
    }

    gEngine.scene = new LevelLoaderScene(info[0].url, edit, () => {

        if (edit) {
            gEngine.scene = new LevelLoaderScene.scenes.edit()
        } else {
            gEngine.scene = new LevelLoaderScene.scenes.main()
        }

    })
}

export function transitionToLevel(world_id, level_id, door_id, edit=false) {

    console.log({world_id, level_id, door_id})
    gCharacterInfo.current_map = {world_id, level_id, door_id}
    gCharacterInfo.current_map_spawn = {world_id, level_id, door_id}

    if (!worlddata[world_id]) {
        get_map_world_level_manifest(world_id).then(info => {
            worlddata[world_id] = info.levels
            console.log(info)
            _transition(world_id, level_id, door_id, edit)
        })

    } else {
        _transition(world_id, level_id, door_id, edit)
    }

}
