
$import("axertc_common", {
    Direction, Rect
})
 
export const TileShape = {}
TileShape.RESERVED = 0
TileShape.FULL = 1
TileShape.HALF = 2
TileShape.ONETHIRD = 3
TileShape.TWOTHIRD = 4

export const TileProperty = {}
TileShape.RESERVED = 0
TileProperty.SOLID = 1
TileProperty.NOTSOLID = 2
TileProperty.ONEWAY = 3
TileProperty.ICE = 4
TileProperty.WATER = 5
TileProperty.LAVA = 6

// a tile is a {shape, property, sheet}
// it may have a `tile` property which is the image to draw

let TT_0_04 = 0*11 +  4

let TT_1_00 = 1*11 +  0 // invalid
let TT_1_01 = 1*11 +  1
let TT_1_02 = 1*11 +  2
let TT_1_04 = 1*11 +  4

let TT_2_00 = 2*11 +  0
let TT_2_07 = 2*11 +  7
let TT_2_08 = 2*11 +  8

let TT_3_07 = 3*11 +  7
let TT_3_08 = 3*11 +  9
let TT_3_09 = 3*11 +  9
let TT_3_10 = 3*11 + 10

let TT_0_05 = 0*11 +  5 // half
let TT_0_06 = 0*11 +  6 // half
let TT_2_05 = 2*11 +  5 // half
let TT_2_06 = 2*11 +  6 // half
let TT_3_05 = 3*11 +  5 // half
let TT_3_06 = 3*11 +  6 // half

let TT_0_07 = 0*11 +  7 // onethird
let TT_0_08 = 0*11 +  8 // onethird
let TT_0_09 = 0*11 +  9 // onethird
let TT_0_10 = 0*11 + 10 // onethird

let TT_1_07 = 1*11 +  7 // twothird
let TT_1_08 = 1*11 +  8 // twothird
let TT_1_09 = 1*11 +  9 // twothird
let TT_1_10 = 1*11 + 10 // twothird


export function updateTile(layer, map_width, map_height, sheets, x, y, tile) {
    // TODO: one more optimization for tile sheets
    //       extract a Tile once for each used index in the tile sheet

    // TODO: determine which positions actually get used in a tile sheet
    //       16 primary tiles should be re-organized to be in their
    //       actually positions

    // return true if the tile was updated.
    // update neighbors
    // loop until no more tiles are changed

    const tile_before = tile.tile

    const solid = (p) => p == TileProperty.SOLID

    if (tile.sheet == 0) {
        tile.sheet = 1
    }

    if (tile.shape == TileShape.FULL) {

        const ntid = ((y + 4)*512 + x)
        const ntid_u = ((y + 4-1)*512 + x)
        const ntid_d = ((y + 4+1)*512 + x)
        const ntid_l = ((y + 4)*512 + (x - 1))
        const ntid_r = ((y + 4)*512 + (x + 1))

        let eu = !!layer[ntid_u] && solid(layer[ntid_u].property) == solid(layer[ntid].property)
        let ed = !!layer[ntid_d] && solid(layer[ntid_d].property) == solid(layer[ntid].property)
        let el = !!layer[ntid_l] && solid(layer[ntid_l].property) == solid(layer[ntid].property)
        let er = !!layer[ntid_r] && solid(layer[ntid_r].property) == solid(layer[ntid].property)

        if (layer[ntid].property == TileProperty.ONEWAY) {
            // this allows having a step to stand on inside of a cliff.
            // by having a layer of tiles that are passthrough and sections that are one way
            eu = !!layer[ntid_u] && layer[ntid_u].property == layer[ntid].property
        }

        // tiles on the bottom edge of the map should act like there is a tile below them
        if ((y + 1)*16 >= map_height) {
            ed = true
        }
        if ((x + 1)*16 >= map_width) {
            er = true
        }
        if ((x - 1)*16 <= 0) {
            el = true
        }

        let tid = -1
        // count the number of neighbors
        let n = (eu+ed+el+er)
        // map the neighbors to a grid index
        let q = (er<<3)|(el<<2)|(ed<<1)|(eu)

        // the top right and bottom left correspond to
        // three in a row
        // the group in the middle handle the cases
        // for the 4 rotations of an 'L' shape
        // other cases (like eu and eu) are not possible
        // only entries with exactly 2 bits set are given
        // (" ".join([bin(i) for i in range(16)])).replace("0b","")
        //                   3         5    6              9   10        11
        // 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111

        // if 1 bit is set. that bit indicates the direction of the neighbor
        // if 3 bits are set. the free bit indicates the direction of a free cell

        let tt = [
             0*11 + 0, 1*11 + 4, 0*11 + 3, 2*11 + 0,
             1*11 + 4, 1*11 + 2, 0*11 + 2, 1*11 + 4,
             0*11 + 4, 1*11 + 1, 0*11 + 1, 0*11 + 4,
             2*11 + 0, 1*11 + 3, 0*11 + 3, 2*11 + 0,
        ]

        tid = tt[q]

        if (n==2) {
            // non solid walls should join with the solid floor
            if (!solid(layer[ntid].property) && solid(layer[ntid_d]?.property)) {
                if (tid == TT_1_01) { tid = TT_0_04}
                if (tid == TT_1_02) { tid = TT_1_04}
            }

        }

        if (n==3) {
            // non solid walls should join with the solid floor
            if (!solid(layer[ntid].property) && solid(layer[ntid_d]?.property)) {
                tid = TT_2_00
            }
        }

        if (layer[ntid].property == TileProperty.SOLID) {

            // fix stair case / zig zags
            // check bounds to create the illusion the map tile extends past the visible are
            if (n==4 && x > 0 && ((x+1)*16) < map_width) {
                const tiddl = ((y + 4 - 1)*512 + (x-1))
                const tiddr = ((y + 4 - 1)*512 + (x+1))
                const dl = !layer[tiddl]
                const dr = !layer[tiddr]
                if (dl && !dr) {tid = TT_3_07}
                if (dr && !dr) {tid = TT_3_08}
            }

            // fill the corners when there are neighbor diagonal slopes
            if (n >= 2) {
                const du = !!layer[ntid_u] && solid(layer[ntid_u].property) == solid(layer[ntid].property) && layer[ntid_u].shape == TileShape.HALF
                const dl = !!layer[ntid_l] && solid(layer[ntid_l].property) == solid(layer[ntid].property) && (layer[ntid_l].shape == TileShape.HALF || layer[ntid_l].shape == TileShape.FULL)
                const dr = !!layer[ntid_r] && solid(layer[ntid_r].property) == solid(layer[ntid].property) && (layer[ntid_r].shape == TileShape.HALF || layer[ntid_r].shape == TileShape.FULL)
                if (du && dl) { tid = TT_3_10 }
                if (du && dr) { tid = TT_3_09 }
            }

            // fill the corners when there are neighbor diagonal slopes
            if (n >= 2) {

                const du = !!layer[ntid_u] && solid(layer[ntid_u].property) == solid(layer[ntid].property) && layer[ntid_u].shape == TileShape.ONETHIRD
                const dl = !!layer[ntid_l] && solid(layer[ntid_l].property) == solid(layer[ntid].property) && (layer[ntid_l].shape == TileShape.TWOTHIRD || layer[ntid_l].shape == TileShape.FULL)
                const dr = !!layer[ntid_r] && solid(layer[ntid_r].property) == solid(layer[ntid].property) && (layer[ntid_r].shape == TileShape.TWOTHIRD || layer[ntid_r].shape == TileShape.FULL)
                if (du && dl) { tid = TT_2_08 }
                if (du && dr) { tid = TT_2_07 }
            }
        }

        // fix for diagonal oneway platforms
        if (layer[ntid].property == TileProperty.NOTSOLID) {
            if (n >= 2) {
                const du = !!layer[ntid_u] && layer[ntid_u].shape == TileShape.HALF && layer[ntid_u].property != TileProperty.NOTSOLID
                const dl = !!layer[ntid_l] && layer[ntid_l].shape == TileShape.HALF && layer[ntid_l].property != TileProperty.NOTSOLID
                const dr = !!layer[ntid_r] && layer[ntid_r].shape == TileShape.HALF && layer[ntid_r].property != TileProperty.NOTSOLID
                if (du && dl) { tid = TT_3_10 }
                if (du && dr) { tid = TT_3_09 }
            }
        }

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else if (tile.shape == TileShape.HALF) {
        let tid = -1



        if (tile.property == TileProperty.NOTSOLID) {
            if (tile.direction == Direction.UPRIGHT) { tid = TT_2_06}
            if (tile.direction == Direction.UPLEFT)  { tid = TT_2_05}
        } else {
            if (tile.direction == Direction.UPRIGHT) { tid = TT_0_06}
            if (tile.direction == Direction.UPLEFT)  { tid = TT_0_05}
        }

        if (tile.direction == Direction.DOWNRIGHT) { tid = TT_3_06}
        if (tile.direction == Direction.DOWNLEFT)  { tid = TT_3_05}

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else if (tile.shape == TileShape.ONETHIRD) {

        let tid = -1

        if (tile.property == TileProperty.NOTSOLID) {
            if (tile.direction == Direction.UPRIGHT) { tid = TT_1_00} // invalid, no tile
            if (tile.direction == Direction.UPLEFT)  { tid = TT_1_00} // invalid, no tile
        } else {
            if (tile.direction == Direction.UPRIGHT) { tid = TT_0_08}
            if (tile.direction == Direction.UPLEFT)  { tid = TT_0_07}
        }

        if (tile.direction == Direction.DOWNRIGHT) { tid = TT_0_10}
        if (tile.direction == Direction.DOWNLEFT)  { tid = TT_0_09}

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else if (tile.shape == TileShape.TWOTHIRD) {

        let tid = -1

        if (tile.property == TileProperty.NOTSOLID) {
            if (tile.direction == Direction.UPRIGHT) { tid = TT_1_00} // invalid, no tile
            if (tile.direction == Direction.UPLEFT)  { tid = TT_1_00} // invalid, no tile
        } else {
            if (tile.direction == Direction.UPRIGHT) { tid = TT_1_08}
            if (tile.direction == Direction.UPLEFT)  { tid = TT_1_07}
        }

        if (tile.direction == Direction.DOWNRIGHT) { tid = TT_1_10}
        if (tile.direction == Direction.DOWNLEFT)  { tid = TT_1_09}

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else {
        console.log("error shape", tile.shape)
    }

    // check to see if any changes were made
    if (!!tile_before && !!tile.tile) {
        return tile_before.sheet != tile.tile.sheet || tile_before.tid != tile.tile.tid
    }

    return (!!tile_before) !== (!!tile.tile)
}

export function paintTile(ctx, x, y, tile) {

    switch(tile.property) {
        case 1:
            ctx.fillStyle = "#000000";
            break;
        case 2:
            ctx.fillStyle = "#7f7f7f";
            break;
        case 3:
            ctx.fillStyle = "#d66d47";
            break;
        case 4:
            ctx.fillStyle = "#36c6e3";
            break;
        case 5:
            ctx.fillStyle = "#364de3";
            break;
        case 6:
            ctx.fillStyle = "#e33c36";
            break;
    }

    if (!!tile.tile) {
        ctx.save()
        if (tile.property == TileProperty.NOTSOLID) {
            ctx.filter = "brightness(50%) hue-rotate(-90deg)";
        }
        if (tile.property == TileProperty.ONEWAY) {
            ctx.filter = "brightness(50%) hue-rotate(90deg)";
        }
        tile.tile.draw(ctx,x,y)
        ctx.restore()
    } else if (tile.points) {

        ctx.beginPath();
        ctx.moveTo(x + tile.points[0].x, y + tile.points[0].y);
        tile.points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
        ctx.closePath()
        ctx.fill();

    } else {
        ctx.beginPath()
        ctx.rect(x,y,16,16)
        ctx.closePath()
        ctx.fill()
    }


}