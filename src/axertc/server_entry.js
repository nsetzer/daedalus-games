

$import("axertc_server", {ServerLobby, ServerEngine})



export const server = new ServerEngine();
export const connect = server.connect.bind(server);
export const disconnect = server.disconnect.bind(server);
export const onMessage = server.onMessage.bind(server);
export const update = server.update.bind(server);

