 
$import("store", {gCharacterInfo})

$include("./resource.js")

const mapdata = {
    ["zone1"]: [
        null,
        "level1",
        "level2"
    ]
}

export function transitionToLevel(world_id, level_id, door_id, edit=false) {

    console.log({world_id, level_id, door_id})
    gCharacterInfo.current_map = {world_id, level_id, door_id}
    gCharacterInfo.current_map_spawn = {world_id, level_id, door_id}

    const mapid = mapdata[world_id][level_id]

    gEngine.scene = new LevelLoaderScene(mapid, edit, () => {

        if (edit) {
            gEngine.scene = new LevelLoaderScene.scenes.edit()
        } else {
            gEngine.scene = new LevelLoaderScene.scenes.main()
        }

    })
}
