
import { Rect } from "@axertc/axertc_common"

export function serialize_tile(tid, info) {
    let x = 0;
    // tid is 18 bits (two 512 bit numbers)
    // hex((14*16+4-1)*512+511) = 0x1C7FF < 0x1FFFF
    // shape, property, and sheet are each 3 bits
    // allowing 8 different values. zero is reserved
    // direction is 4 bits and optional (square tiles do not use it)
    x |= tid << 13 // position
    x |= info.shape << 10
    x |= info.property << 7
    x |= info.sheet << 4
    x |= info?.direction??0
    return x
}

export function deserialize_tile(x) {
    x = x&0x7FFFFFFF

    const tid = (x >> 13)&0x3ffff
    const shape = (x >> 10) & 0x07
    const property = (x >> 7) & 0x07
    const sheet = (x >> 4) & 0x07
    const direction = x & 0x0F
    const tile = {shape, property, sheet, direction}
    
    return [tid, tile]
}

/**
 * 
 * @param {*} sid 
 * @param {*} info 
 * 
 * serialize a stamp into 2 32-bit integers
 * 
 * @returns 
 */
export function serialize_stamp(sid, info) {
    let rect = info.rect
    let encoded1 = (info.props&0xFF)<<24|(rect.x&0xFF)<<16|(rect.y&0xFF)<<8|(rect.w&0xF)<<4|(rect.h&0xF)
    let encoded0 = ((info.sheet&0xFF) << 18) | ((info.layer&0x03) << 26) | (+sid)
    return [encoded0, encoded1] 
}

export function deserialize_stamp(stamp) {
    try {
        let [encoded0, encoded1] = stamp
    } catch (e) {
        return
    }
    let [encoded0, encoded1] = stamp

    let sid = encoded0 & 0x3FFFF
    let sheet = (encoded0 >> 18) & 0xFF
    let layer = (encoded0 >> 26) & 0x03
    let props = (encoded1 >> 24) & 0xFF
    let rect = new Rect((encoded1>>16)&0xFF, (encoded1>>8)&0xFF, (encoded1>>4)&0xF, (encoded1)&0xF)
    console.log(sid, rect, sheet, layer, props)
    return {sid, rect, sheet, layer, props}
}