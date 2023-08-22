
$import("axertc_common", {CspMap, ClientCspMap})

class TestEntity {

    constructor(entId, props) {

    }
}

function assert(result, message) {

    if (!result) {
        console.log(message)
        throw new Error(message)
    }
}

export function test() {


    const map = new CspMap()

    const playerId = "0400"
    map.setPlayerId(playerId)
    map.registerClass("TestEntity", TestEntity)

    map.sendCreateObjectEvent("TestEntity", {})

    console.log(map.outgoing_messages)

    const msg = map.outgoing_messages[0].message

    map.createObject(
        msg.entid,
        msg.payload.className,
        msg.payload.props)

    assert(msg.entid in map.objects, "no object")

    map.destroyObject(msg.entid)

    assert(!(msg.entid in map.objects), "object exists")

    //assert(false, "failed this assert")
}


test()