 
$import("store", {gCharacterInfo})

$include("./resource.js")

const mapdata = [
    [],
    [
        "map-2x1-20231112-120815",
        "map-2x1-20231112-120815"
    ]
]

export function transitionToLevel(world_id, level_id, door_id, edit=false) {

    gCharacterInfo.current_map = {world_id, level_id, door_id}

    const mapid = "map-2x1-20231112-120815"

    gEngine.scene = new LevelLoaderScene(mapid, edit, () => {

        if (edit) {
            gEngine.scene = new LevelLoaderScene.scenes.edit()
        } else {
            gEngine.scene = new LevelLoaderScene.scenes.main()
        }

    })
}
