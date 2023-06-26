

// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
// https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
const wsenv = {}

wsenv.websocket_protocol = (window.location.protocol==='http:')?'ws:':'wss:'
wsenv.websocket_base_url = window.location.origin.replace(window.location.protocol, wsenv.websocket_protocol)


export class SocketClient {

    constructor() {

        this.sock = null
        this.keepalive_timer = 0
    }

    send(obj) {
        this.sock.send(JSON.stringify(obj))
    }

    connect(url, cbk) {

        this.sock = new WebSocket(wsenv.websocket_base_url + url)
        //this.sock.setNoDelay(true);

        this.sock.onopen = (event) => {
            console.log("socket opened")
            this.keepalive_timer = setInterval(()=>{
                this.sock.send(JSON.stringify({'type': 'keepalive'}))
            }, 5000)
        }

        this.sock.onmessage = (event) => {
            cbk(JSON.parse(event.data))
        }

        this.sock.onclose = (event) => {
            clearInterval(this.keepalive_timer)
            if (event.wasClean) {
                console.log("connection closed cleanly", event.code, event.reason)
            } else {
                console.log("connection lost", event.code, event.reason)
            }
        }

        this.sock.onerror = (event) => {
            clearInterval(this.keepalive_timer)
            console.log("connection lost", event)
        }


    }
}