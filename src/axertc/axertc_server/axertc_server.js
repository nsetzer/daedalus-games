

export class ServerLobby {

    constructor() {

        this.inputQueue = {} // playerId => (step => queue)
        this.objects = {} // objectId => object
        this.players = {} // playerId => player
        this.nextObjectId = 1;
    }

    getNewObjectId() {
        const oid = this.nextObjectId;
        this.nextObjectId += 1
        return oid
    }

    receiveInput(message) {

        const playerId = message.playerId
        const frameIndex = message.frameIndex

        if (!(playerId in this.inputQueue)) {
            this.inputQueue[playerId] = {}
        }

        const queue = this.inputQueue[playerId]
        if (!queue[frameIndex]) {
            queue[frameIndex] = []
        }

        queue[frameIndex].push(message)

    }

    update(dt) {

        // for input message in input queue
        // process input


        // on delete objects
        // have a history of objectId => exists
        // delete objects in this history not in the lobby

    }

    sendMessage(playerId, message) {
        // send a message to playerId
    }

    sendNeighbors(playerId, message) {
        // send a message to all players in the lobby except playerId

    }

    sendBroadcast(playerId, message) {
        // send a message to all players in the lobby
    }

}

export class ServerEngine {

    constructor() {

        this.playerId2lobbyId = {}
        this.lobbies = {}
        this.players = {}

    }

    connect(playerId) {
        console.log("connect")
        return 0;
    }

    disconnect(playerId) {
        console.log("disconnect")
        return 0;
    }

    onMessage(playerId, message) {
        console.log("onMessage")
        //xtransmit(playerId, message)
        return 0;
    }

    update(dt) {
        //console.log("update")
        return 0;
    }
}