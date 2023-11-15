
export function get_text(url, parameters) {

    if (parameters === undefined) {
        parameters = {}
    }

    parameters.method = "GET"

    return fetch(url, parameters).then((response) => {return response.text()})
}

export function get_json(url, parameters) {

    if (parameters === undefined) {
        parameters = {}
    }

    parameters.method = "GET"

    return fetch(url, parameters).then((response) => {
        if (!response.ok) {
            throw response;
        }
        return response.json()

        // for debugging json response, this dumps the text before parsing
        //return new Promise((accept, reject)=> {
        //    response.text().then((text) => {
        //        console.error(text)
        //        accept(JSON.parse(text))
        //    }).catch((error) => {reject(error)})
        //})
    })
}

export function post(url, payload, parameters) {

    if (parameters === undefined) {
        parameters = {}
    }

    if (parameters.headers === undefined) {
        parameters.headers = {}
    }

    parameters.method = "POST"
    parameters.body = payload

    return fetch(url, parameters).then((response) => {return response.json()})
}

export function post_json(url, payload, parameters) {

    if (parameters === undefined) {
        parameters = {}
    }

    if (parameters.headers === undefined) {
        parameters.headers = {}
    }

    if (parameters.timeout !== undefined) {
        console.log(`setting timeout ${parameters.timeout}`)
        let controller = new AbortController();
        setTimeout(() => controller.abort(), parameters.timeout);
        delete parameters.timeout;
        parameters.signal = controller.signal
    }

    parameters.method = "POST"
    parameters.headers['Content-Type'] = "application/json"
    parameters.body = JSON.stringify(payload)

    return fetch(url, parameters).then((response) => {return response.json()})
}

export function put_json(url, payload, parameters) {

    if (parameters === undefined) {
        parameters = {}
    }

    if (parameters.headers === undefined) {
        parameters.headers = {}
    }

    parameters.method = "PUT"
    parameters.headers['Content-Type'] = "application/json"
    parameters.body = JSON.stringify(payload)

    return fetch(url, parameters).then((response) => {return response.json()})
}

