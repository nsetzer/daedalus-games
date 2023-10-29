
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

export function updateTile(layer, sheets, x, y, tile) {
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

        const eu = !!layer[ntid_u] && solid(layer[ntid_u].property) == solid(layer[ntid].property)
        const ed = !!layer[ntid_d] && solid(layer[ntid_d].property) == solid(layer[ntid].property)
        const el = !!layer[ntid_l] && solid(layer[ntid_l].property) == solid(layer[ntid].property)
        const er = !!layer[ntid_r] && solid(layer[ntid_r].property) == solid(layer[ntid].property)

        let tid = -1
        let n = (eu+ed+el+er)

        if (n == 0) {
            tid = 0
        }

        if (n==1) {
            if (eu) { tid = 1*11 + 3 }
            if (ed) { tid = 0*11 + 3 }
            if (el) { tid = 1*11 + 4 }
            if (er) { tid = 0*11 + 4 }
        }

        if (n==2) {

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
            let t = [
                       -1,       -1,       -1, 2*11 + 0,
                       -1, 1*11 + 2, 0*11 + 2,       -1,
                       -1, 1*11 + 1, 0*11 + 1,       -1,
                 2*11 + 0,       -1,       -1,       -1,
            ]
            if (t < 0) {
                console.log("!! n==2 not set", q)
            }
            tid = t[q]

            // non solid walls should join with the solid floor
            if (!solid(layer[ntid].property) && solid(layer[ntid_d]?.property)) {
                if (tid == 1*11 + 1) { tid = 0*11 + 4}
                if (tid == 1*11 + 2) { tid = 1*11 + 4}
            }

        }

        if (n==3) {
            if (!eu) { tid = 0*11 + 3 }
            if (!ed) { tid = 1*11 + 3 }
            if (!el) { tid = 0*11 + 4 }
            if (!er) { tid = 1*11 + 4 }

            // non solid walls should join with the solid floor
            if (!solid(layer[ntid].property) && solid(layer[ntid_d]?.property)) {
                tid = 2*11 + 0
            }

        }

        //check for air on the diagonal up,  left and right
        //change this tile to close off the grass
        if (n==4) {
            tid = 2*11 + 0


        }

        if (layer[ntid].property == TileProperty.SOLID) {

            if (n==4) {
                const tiddl = ((y + 4 - 1)*512 + (x-1))
                const tiddr = ((y + 4 - 1)*512 + (x+1))
                const dl = !layer[tiddl]
                const dr = !layer[tiddr]
                if (dl) {tid = 3*11 + 7}
                if (dr) {tid = 3*11 + 8}
            }

            // fill the corners when there are neighbor diagonal slopes
            if (n >= 2) {
                const du = !!layer[ntid_u] && solid(layer[ntid_u].property) == solid(layer[ntid].property) && layer[ntid_u].shape == TileShape.HALF
                const dl = !!layer[ntid_l] && solid(layer[ntid_l].property) == solid(layer[ntid].property) && (layer[ntid_l].shape == TileShape.HALF || layer[ntid_l].shape == TileShape.FULL)
                const dr = !!layer[ntid_r] && solid(layer[ntid_r].property) == solid(layer[ntid].property) && (layer[ntid_r].shape == TileShape.HALF || layer[ntid_r].shape == TileShape.FULL)
                if (du && dl) { tid = 3*11 + 10 }
                if (du && dr) { tid = 3*11 + 9 }
            }

            // fill the corners when there are neighbor diagonal slopes
            if (n >= 2) {

                const du = !!layer[ntid_u] && solid(layer[ntid_u].property) == solid(layer[ntid].property) && layer[ntid_u].shape == TileShape.ONETHIRD
                const dl = !!layer[ntid_l] && solid(layer[ntid_l].property) == solid(layer[ntid].property) && (layer[ntid_l].shape == TileShape.TWOTHIRD || layer[ntid_l].shape == TileShape.FULL)
                const dr = !!layer[ntid_r] && solid(layer[ntid_r].property) == solid(layer[ntid].property) && (layer[ntid_r].shape == TileShape.TWOTHIRD || layer[ntid_r].shape == TileShape.FULL)
                if (du && dl) { tid = 2*11 + 8 }
                if (du && dr) { tid = 2*11 + 7 }
            }
        }

        // fix for diagonal oneway platforms (smw style)
        if (layer[ntid].property == TileProperty.NOTSOLID) {
            if (n >= 2) {
                const du = !!layer[ntid_u] && layer[ntid_u].shape == TileShape.HALF && layer[ntid_u].property != TileProperty.NOTSOLID
                const dl = !!layer[ntid_l] && layer[ntid_l].shape == TileShape.HALF && layer[ntid_l].property != TileProperty.NOTSOLID
                const dr = !!layer[ntid_r] && layer[ntid_r].shape == TileShape.HALF && layer[ntid_r].property != TileProperty.NOTSOLID
                if (du && dl) { tid = 3*11 +10 }
                if (du && dr) { tid = 3*11 + 9 }
            }
        }

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else if (tile.shape == TileShape.HALF) {
        let tid = -1

        if (tile.property == TileProperty.NOTSOLID) {
            if (tile.direction == Direction.UPRIGHT) { tid = 2*11 + 6}
            if (tile.direction == Direction.UPLEFT)  { tid = 2*11 + 5}
        } else {
            if (tile.direction == Direction.UPRIGHT) { tid = 0*11 + 6}
            if (tile.direction == Direction.UPLEFT)  { tid = 0*11 + 5}
        }

        if (tile.direction == Direction.DOWNRIGHT) { tid = 3*11 + 6}
        if (tile.direction == Direction.DOWNLEFT)  { tid = 3*11 + 5}

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else if (tile.shape == TileShape.ONETHIRD) {

        let tid = -1

        if (tile.property == TileProperty.NOTSOLID) {
            if (tile.direction == Direction.UPRIGHT) { tid = 1*11 + 0} // invalid, no tile
            if (tile.direction == Direction.UPLEFT)  { tid = 1*11 + 0} // invalid, no tile
        } else {
            if (tile.direction == Direction.UPRIGHT) { tid = 0*11 + 8}
            if (tile.direction == Direction.UPLEFT)  { tid = 0*11 + 7}
        }

        if (tile.direction == Direction.DOWNRIGHT) { tid = 0*11 + 10}
        if (tile.direction == Direction.DOWNLEFT)  { tid = 0*11 + 9}

        if (tid >= 0) {
            tile.tile = sheets[tile.sheet].tile(tid)
        }

    } else if (tile.shape == TileShape.TWOTHIRD) {

        let tid = -1

        if (tile.property == TileProperty.NOTSOLID) {
            if (tile.direction == Direction.UPRIGHT) { tid = 1*11 + 0} // invalid, no tile
            if (tile.direction == Direction.UPLEFT)  { tid = 1*11 + 0} // invalid, no tile
        } else {
            if (tile.direction == Direction.UPRIGHT) { tid = 1*11 + 8}
            if (tile.direction == Direction.UPLEFT)  { tid = 1*11 + 7}
        }

        if (tile.direction == Direction.DOWNRIGHT) { tid = 1*11 + 10}
        if (tile.direction == Direction.DOWNLEFT)  { tid = 1*11 + 9}

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
    } else if (tile.shape > TileShape.FULL) {
        /*
        let points;
        switch (tile.shape) {
        case TileShape.HALF:
            points = this.slopes_half[tile.direction]
            break
        case TileShape.ONETHIRD:
            points = this.slopes_onethird[tile.direction]
            break
        case TileShape.TWOTHIRD:
            points = this.slopes_twothird[tile.direction]
            break
        default:
            break
        }
        ctx.beginPath();
        ctx.moveTo(x + points[0].x, y + points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
        ctx.closePath()
        ctx.fill();
        */
        ctx.beginPath()
        ctx.rect(x,y,16,16)
        ctx.closePath()
        ctx.fill()
        console.error("fix me")
    } else {
        ctx.beginPath()
        ctx.rect(x,y,16,16)
        ctx.closePath()
        ctx.fill()
    }


}