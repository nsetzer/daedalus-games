

$import("axertc_server", {ServerLobby, ServerEngine})


export const server = {}

const _server = new ServerEngine();

server.connect = _server.connect.bind(server);
server.disconnect = _server.disconnect.bind(server);
server.onMessage = _server.onMessage.bind(server);
server.update = _server.update.bind(server);

