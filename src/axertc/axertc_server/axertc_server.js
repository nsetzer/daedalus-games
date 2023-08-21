
/*
client

components:
    scene
    lobby
    engine
    map
    sync-strategy
    webrtc-client

messages
    use a container message

    MapSync
        fullUpdate: bool
        stepIndex: int
        events: list

    player-create
    player-input
    player-destroy

    object-create
    object-input
    object-destroy

<<<<---->>>>
if the character is lagging, run an extra update
if the character is leading, skip an update
    extra/skipped capped at 6 fps
remoteWorldStep
localWorldStep

synchronize may set a flag to skip the next update

GameEngine
    constructor
    receiveMessage
        save until next update
    update
        step
        package and transmit all outgoing events

ClientGameEngine
    constructor
    receiveMessage
        GameEngine.receiveMessage
    update
        GameEngine.update
    paint

ServerGameEngine

    constructor
    receiveMessage
        GameEngine.receiveMessage
    update
        GameEngine.update


step
    handle inbound messages
        synchronize
        check for reset
        check drift per message
    check drift per update
    step the game engine
        step objects
        bend objects
    if client connected:
        handle outbound messages

synchronize
    require a full update before proceeding


*/

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

    join(playerId) {

    }

    leave(playerId) {

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
        console.log(message)
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


    addPlayerToLobby(playerId, lobbyId) {
        this.playerId2lobbyId[playerId] = lobbyId

        this.lobbies[lobbyId].join(playerId)
    }

    init() {

    }

    connect(playerId) {
        return 0;
    }

    disconnect(playerId) {
        return 0;
    }

    onMessage(playerId, message) {
        return 0;
    }

    update(dt) {
        //console.log("update")
        return 0;
    }
}