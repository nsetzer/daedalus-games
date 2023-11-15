 

$import("daedalus", {})
$import("api.requests", {})

export const env = {
    //`http://${window.location.hostname}:4100`
    // baseUrl is empty when running in production
    // for development set to the full qualified url of the backend
    baseUrl: (daedalus?.env?.baseUrl)??window.location.origin
}
console.log(env)

function get_map_world_manifest() {

    const url = env.baseUrl + "/api/map/world/manifest"
    return api.requests.get_json(url, {})
}

function get_map_world_level_manifest(world) {
    const url = env.baseUrl + daedalus.util.joinpath('/api/map/world', world, 'level/manifest');
    //const params = daedalus.util.serializeParameters({
    //    'token': getAuthToken(),
    //})
    return api.requests.get_json(url, {})
}

get_map_world_manifest().then(json => console.log(json))
get_map_world_level_manifest("zone1").then(json => console.log(json))
get_map_world_level_manifest("zone3").then(json => console.log(json))
