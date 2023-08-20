

$import("axertc_server", {ServerLobby, ServerEngine})

class DemoLobby extends ServerLobby {


    constructor() {
        super();

        this.world_timer = 0;
    }

    join(playerId) {
        this.send_sync();
        this.players[playerId] = true
    }

    leave(playerId) {
        console.log("leave lobby", playerId)

        if (this.players[playerId]) {
            delete this.players[playerId]
        }
    }

    onMessage(playerId, message) {

    }

    update(dt) {
        super.update();

        this.world_timer -= dt
        if (this.world_timer < 0) {
            this.send_sync()
            this.world_timer += 0.1
        }

    }

    send_sync() {
        for (const playerId of Object.keys(this.players)) {
            webrtc.xsend(playerId, {type: "map-sync", step: this.world_step})
        }
    }


}

class DemoServerEngine extends ServerEngine {

    constructor() {
        super();

        this.players = {}

        this.default_lobby_id = 0
        console.log("constructor this",this, this.send_sync)
    }

    init() {
        console.log("server start")
        console.log("start this",this, this.send_sync)

    }


    connect(playerId) {
        console.log("connect", playerId)

        if (!this.lobbies[this.default_lobby_id]) {
            this.lobbies[this.default_lobby_id] = new DemoLobby();
        }

        this.players[playerId] = true
        this.addPlayerToLobby(playerId, this.default_lobby_id)

        return 0;
    }

    disconnect(playerId) {

        if (playerId in this.playerId2lobbyId) {
            const lobbyId = this.playerId2lobbyId[playerId]
            console.log("disconnect: remove player from lobby", lobbyId)
            this.lobbies[lobbyId].leave(playerId)
        } else {
            console.log("disconnect: player not in any lobby")
        }

        if (this.players[playerId]) {
            delete this.players[playerId]
        }

        console.log("disconnect", playerId)

        return 0;
    }

    onMessage(playerId, message) {

        if (playerId in this.playerId2lobbyId) {

            const lobbyId = this.playerId2lobbyId[playerId]
            this.lobbies[lobbyId].onMessage(playerId, message)
        }

        if (message.type == "keepalive") {
            webrtc.xsend(playerId, message)
        }

        return 0;
    }

    update(dt) {

        for (const [lobbyId, lobby] of Object.entries(this.lobbies)) {
            lobby.update(dt)
        }

        return 0;
    }



}

// ---------------------------

console.log("---------------")
console.log("construct demo engine")
const _instance = new DemoServerEngine();
export const server = {}
server.init = () => {_instance.init()}
server.connect = _instance.connect.bind(_instance);
server.disconnect = _instance.disconnect.bind(_instance);
server.onMessage = _instance.onMessage.bind(_instance);
server.update = (dt) => {_instance.update(dt)};
console.log("---------------")

