 

import {} from "@daedalus/daedalus"

import {} from "@troid/api/requests"

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
        // in release mode the manifest must be pre-generated
        url = "static/maps/manifest.json"
    } else {
        url = env.baseUrl + "/api/map/world/manifest"
    }
    return requests.get_json(url, {})
}

export function get_map_world_level_manifest(world) {

    let url
    if (env.release) {
        // in release mode the manifest must be pre-generated
        url = "static/maps/" + world + "/manifest.json"
    } else {
        url = env.baseUrl + daedalus.util.joinpath('/api/map/world', world, 'level/manifest');
    }

    //const params = daedalus.util.serializeParameters({
    //    'token': getAuthToken(),
    //})
    return requests.get_json(url, {})
}

export function post_map_level(path, body) {
    const url = env.baseUrl + '/api/map/level';
    const parameters = daedalus.util.serializeParameters({
        'path': path,
    })
    return requests.post_json(url + parameters, body, {})
}