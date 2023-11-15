 

$import("daedalus", {})
$include("./requests.js")

export const env = {
    //`http://${window.location.hostname}:4100`
    // baseUrl is empty when running in production
    // for development set to the full qualified url of the backend
    baseUrl: (daedalus?.env?.baseUrl)??window.location.origin,
    release: !daedalus.env.debug
}

export function get_map_world_manifest() {

    let url
    if (env.release) {
        url = "static/maps/manifest.json"
    } else {
        url = env.baseUrl + "/api/map/world/manifest"
    }
    return get_json(url, {})
}

export function get_map_world_level_manifest(world) {

    let url
    if (env.release) {
        url = "static/maps/" + world + "/manifest.json"
    } else {
        url = env.baseUrl + daedalus.util.joinpath('/api/map/world', world, 'level/manifest');
    }

    //const params = daedalus.util.serializeParameters({
    //    'token': getAuthToken(),
    //})
    return get_json(url, {})
}

get_map_world_manifest().then(json => console.log(json))
get_map_world_level_manifest("zone1").then(json => console.log(json))
get_map_world_level_manifest("zone3").then(json => console.log(json))
