
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

export function test1() {


    const map = new CspMap()

    const playerId = "0400"
    map.playerId = playerId
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

export function test() {

    const playerId = "0400"
    const entid = "0400-1"

    const map = new CspMap()
    map.playerId = playerId
    map.registerClass("TestEntity", TestEntity)

    console.log("step", map.local_step)

    map.update(1/60)
    map.update(1/60)
    map.update(1/60)

    map.sendCreateObjectEvent("TestEntity", {})

    map.update(1/60)
    map.update(1/60)
    map.update(1/60)

    map.update(1/60)
    map.update(1/60)
    map.update(1/60)

    console.log("step", map.local_step)

    assert(entid in map.objects, "no object")

    map.destroyObject(entid)

    map.update(1/60)
    map.update(1/60)
    map.update(1/60)
    console.log("step", map.local_step)
    assert(!(entid in map.objects), "object exists")

    map.dirty_step = 2
    map.reconcile()
    map.update(1/60)
    //assert(false, "failed this assert")
}


test()