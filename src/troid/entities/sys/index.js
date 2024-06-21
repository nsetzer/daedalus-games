import {SpriteSheet} from "@axertc/axertc_client"

export * from "./base.js"
export * from "./text.js"


// entities that can be created in a level,
// but cannot be created in the editor
export const defaultEntities = []
export function registerDefaultEntity(name, ctor, onLoad=null) {
    if (onLoad === null) {
        onLoad = ((entry) => {})
    }

    defaultEntities.push({
        name,
        ctor,
        onLoad,
        sheet: null,
    })
}

export const editorEntities = []
export function registerEditorEntity(name, ctor, size, category, schema=null, onLoad=null) {
    if (onLoad === null) {
        onLoad = ((entry) => {})
    }

    if (schema === null) {
        schema = []
    }

    editorEntities.push({
        name,
        ctor,
        size,
        category,
        onLoad,
        sheet: null,
        icon: null,
        editorSchema: schema,
        editorIcon: null,
    })
}


export function registerStamp(name, icon) {

}

export function registerEntityAssets() {

    defaultEntities.forEach(entry => {
        entry.onLoad(entry)
    })

    editorEntities.forEach(entry => {
        entry.onLoad(entry)
        if (entry.icon === null) {
            console.log("fix oldstyle entity", entry.name)
            entry.icon = entry.ctor.icon
            entry.editorIcon = entry.ctor.editorIcon
            entry.editorSchema = entry.ctor.editorSchema
        }
    })
}

export const EntityCategory = {
    item: 1,
    switches: 2,
    hazard: 3,
    door: 4,
    small_mob: 5,

    stamp: 9
}

// return a new 16x16 tile icon from an existing sheet
export function makeEditorIcon(sheet, tid=0) {
    let icon = new SpriteSheet()
    icon.tw = 16
    icon.th = 16
    icon.rows = 1
    icon.cols = tid+1
    icon.xspacing = 1
    icon.yspacing = 1
    icon.xoffset = 1
    icon.yoffset = 1
    icon.image = sheet.image
    return icon.tile(tid)
}