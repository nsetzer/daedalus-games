 

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
