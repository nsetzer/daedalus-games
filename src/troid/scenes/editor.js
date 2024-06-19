 
// todo: implement stamps as objects
//       stamps are special tiles that can be any size or shape
//       during chunking, they are painted on top of layer zero
//       after all other tiles are painted.

import { Alignment, Direction } from "@axertc/axertc_common"
import { TileShape } from "@troid/tiles"

// todo: keyboad controls
//       activate a fake cursor object which simulates touch events
//       arrow keys move the cursor. primary fire button clicks
//       hide when there is a real mouse event

import {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput
} from "@axertc/axertc_client"

import  {
    CspMap, ClientCspMap, ServerCspMap, fmtTime,
    Direction, Alignment, Rect,
} from "@axertc/axertc_common"

import {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
} from "@axertc/axertc_physics"


import {MapInfo, EditorControl, gAssets} from "@troid/store"

import {TileShape, TileProperty, updateTile, paintTile} from "@troid/tiles"

import {defaultEntities, editorEntities, EntityCategory} from "@troid/entities/sys"
import {PlatformMap, serialize_tile, deserialize_stamp, serialize_stamp} from "@troid/maps"
import {post_map_level} from "@troid/api"


function random_choice(choices) {
  let index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

const EditorTool = {}
EditorTool.PLACE_TILE    = 0x11
EditorTool.ERASE_TILE    = 0x12
EditorTool.SELECT_TILE   = 0x14 
EditorTool.PAINT_TILE    = 0x18

EditorTool.PLACE_OBJECT  = 0x21
EditorTool.ERASE_OBJECT  = 0x22
EditorTool.SELECT_OBJECT = 0x24
EditorTool.EDIT_OBJECT   = 0x28

EditorTool.PLACE_STAMP   = 0x41
EditorTool.ERASE_STAMP   = 0x42
EditorTool.SELECT_STAMP  = 0x44

EditorTool.TILE_MASK     = 0x10
EditorTool.OBJECT_MASK   = 0x20
EditorTool.STAMP_MASK    = 0x40


class FileMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 1, 8 + 24 * 3)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            let tx = Math.floor((t.x -  8) / 24)
            let ty = Math.floor((t.y - 32) / 24)

            if (tx < 0) {
                return
            }

            if (tx == 0 && ty == 0) {

                this.parent.saveAs()
                this.parent.active_menu = null
            }

            if (tx == 0 && ty == 2) {
                gEngine.scene = new LevelLoaderScene.scenes.select()
            }

        }
    }

    paint(ctx) {
        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h,8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        let x = 8
        let y = 32

        this.parent.editor_icons.save.draw(ctx, x, y)

        y += 24
        this.parent.editor_icons.load.draw(ctx, x, y)

        y += 24
        this.parent.editor_icons.exit.draw(ctx, x, y)
    }
}

class TileMenu {

    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 6, 8 + 24 * 4)
        this.parent = parent

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            let tx = Math.floor((t.x -  8) / 24)
            let ty = Math.floor((t.y - 32) / 24)

            if (tx < 0) {
                return
            }

            if (ty == 0) {
                if (tx < this.parent.theme_sheets.length - 1) {
                    if (this.parent.tile_property <= 4) {
                        this.parent.tile_sheet = 1 + tx
                        console.log("set sheet", 1 + tx)
                    }
                }
            }
            else if (ty == 1) {
                if (tx < 4) {
                    this.parent.tile_property = 1 + tx
                    console.log("set prop", 1 + tx)
                    /*
                    if (this.parent.tile_property > 4) {
                        this.parent.tile_shape = 1
                    }
                    if (this.parent.tile_property > 4) {
                        this.parent.tile_sheet = 1
                    }
                    */

                }

            }
            else if (ty == 2) {
                if (tx < 4) {
                    if (this.parent.tile_property <= 4) {
                        this.parent.tile_shape = 1 + tx
                        console.log("set shape", 1 + tx)
                    }
                    //this.parent.active_tool = EditorTool.PLACE_TILE
                    //this.parent.active_menu = null
                } else if (tx  == 4) {
                    this.parent.tile_shape = 7 // alt full
                    //this.parent.active_tool = EditorTool.PLACE_TILE
                    //this.parent.active_menu = null

                }
                console.log(tx)



            }
            else if (ty == 3) {

                if (tx == 0) {
                    this.parent.active_tool = EditorTool.PLACE_TILE
                    this.parent.active_menu = null
                }

                if (tx == 1) {
                    this.parent.active_tool = EditorTool.PAINT_TILE
                    this.parent.active_menu = null
                }

                if (tx == 2) {
                    this.parent.active_tool = EditorTool.ERASE_TILE
                    this.parent.active_menu = null
                }

                if (tx == 3) {
                    this.parent.active_tool = EditorTool.SELECT_TILE
                    this.parent.active_menu = null
                }

            }

        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h,8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        let points,x,y,k;
        ctx.fillStyle = "#000000"
        ctx.strokeStyle = "#000000"


        // ---------------------------------------------------------------
        // Row 3 Tile Set

        x = 8
        y = 32


        k = (this.parent.tile_sheet - 1)
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()

        this.parent.theme_sheets_icon.slice(1).forEach(t => {
            t.draw(ctx, x,y)
            x += 24
        })

        // ---------------------------------------------------------------
        // Row 1 Style
        x = 8
        y = 32 + 24

        k = (this.parent.tile_property - 1)
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()

        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // not solid
        x += 24
        ctx.save()
        ctx.strokeStyle = "#000000"
        ctx.fillStyle = "#7f7f7f"
        ctx.beginPath();
        ctx.setLineDash([4]);
        ctx.rect(x,y,16,16)
        ctx.strokeRect(x,y,16,16)
        ctx.fill()
        ctx.restore()

        // one way
        x += 24
        ctx.save()
        ctx.strokeStyle = "#000000"
        ctx.fillStyle = "#d66d47"
        ctx.beginPath();
        ctx.setLineDash([4]);
        ctx.rect(x,y,16,16)
        ctx.strokeRect(x,y,16,16)
        ctx.fill()
        ctx.restore()

        // ice
        x += 24
        ctx.fillStyle = "#36c6e3"
        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // water
        /*
        x += 24
        ctx.fillStyle = "#364de3"
        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()

        // lava
        x += 24
        ctx.fillStyle = "#e33c36"
        ctx.beginPath();
        ctx.rect(x,y,16,16)
        ctx.fill()
        */

        // ---------------------------------------------------------------
        // Row 2 Shape
        ctx.fillStyle = "#000000"
        x = 8
        y = 32 + 24 + 24

        if (this.parent.active_tool == EditorTool.PAINT_TILE) {
            k = 4
        } else {
            if (this.parent.tile_shape == 7) {
                // alt full
                k = 4
            } else {
                k = (this.parent.tile_shape - 1)
            }
        }
        ctx.beginPath();
        ctx.strokeStyle = "gold"
        ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        ctx.stroke()

        if (false) {
            // render the true icon in the third row

            let shapes = [TileShape.FULL, TileShape.HALF, TileShape.ONETHIRD, TileShape.TWOTHIRD, TileShape.ALT_FULL]
            let tiles = []

            for (let i=0; i < shapes.length; i++) {
                let tile = {
                    shape: shapes[i],
                    property: TileProperty.SOLID, // this.parent.tile_property,
                    sheet: this.parent.tile_sheet,
                    direction: Direction.UPRIGHT,
                }
                updateTile({[4*512]:tile}, 0, 0, this.parent.theme_sheets, 0, 0, tile)
                tile.x = x + 24*i
                tile.y = y
                tiles.push(tile)
            }

            tiles.forEach(tile => {
                paintTile(ctx, tile.x, tile.y, tile, this.parent.theme_sheets)
            })

        } else {
            // render a shape in the third row

            ctx.beginPath();
            ctx.rect(x,y,16,16)
            ctx.fill()

            if (this.parent.tile_property <= 4) {
                x += 24
                points = this.parent.slopes_half[Direction.UPRIGHT]

                

                ctx.beginPath();
                ctx.moveTo(x + points[0].x, y + points[0].y);
                points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
                ctx.fill()

                x += 24
                points = this.parent.slopes_onethird[Direction.UPRIGHT]
                ctx.beginPath();
                ctx.moveTo(x + points[0].x, y + points[0].y);
                points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
                ctx.fill()

                x += 24
                points = this.parent.slopes_twothird[Direction.UPRIGHT]
                ctx.beginPath();
                ctx.moveTo(x + points[0].x, y + points[0].y);
                points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
                ctx.fill()
            }

            x += 24
            ctx.beginPath();
            ctx.rect(x,y,16,16)
            ctx.fill()
        }

        // ---------------------------------------------------------------
        // Row 4 Shape
        ctx.fillStyle = "#000000"
        x = 8
        y = 32 + 24 + 24 + 24
        this.parent.editor_icons.new.draw(ctx, x, y)

        x += 24
        this.parent.editor_icons.brush.draw(ctx, x, y)

        x += 24
        this.parent.editor_icons.erase.draw(ctx, x, y)

        x += 24
        this.parent.editor_icons.pointer.draw(ctx, x, y)
        //points = this.parent.slopes_twothird[Direction.UPRIGHT]
        //ctx.beginPath();
        //ctx.moveTo(x + points[0].x, y + points[0].y);
        //points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
        //ctx.fill()



    }
}

// a palette is a menu which remains open while editing the map
class TilePalette {

    constructor(parent) {

        
        let t = 16
        let p = 6
        let s = t+p
        let w = 3*p + 2*t
        let h = 8*p + 7*t
        let y = Math.floor(gEngine.view.height/2 - h/2)
        let x = 4

        console.log(x,y,w,h)
        this.rect = new Rect(x,y,w,h)
        this.parent = parent

        this.actions = []

        /*
        points = this.parent.slopes_half[Direction.UPRIGHT]
        ctx.beginPath();
        ctx.moveTo(x + points[0].x, y + points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
        ctx.fill()
        */

        /*
        this.actions.push({
            shortcut: "q",
            x: x + p + 0*s,
            y: y + p + 0*s, 
            icon:this.parent.editor_icons.new, 
            action: ()=>{  }
        })
        */

        this.actions.push({
            shortcut: "w",
            x: x + p + 1*s,
            y: y + p + 0*s, 
            icon:this.parent.editor_icons.brush, 
            active: () => { return this.parent.active_tool == EditorTool.PAINT_TILE },
            action: ()=>{ this.parent.active_tool = EditorTool.PAINT_TILE }
        })

        this.actions.push({
            shortcut: "e",
            x: x + p + 0*s,
            y: y + p + 1*s, 
            icon:this.parent.editor_icons.erase, 
            active: () => { return this.parent.active_tool == EditorTool.ERASE_TILE },
            action: ()=>{ this.parent.active_tool = EditorTool.ERASE_TILE }
        })

        this.actions.push({
            shortcut: "r",
            x: x + p + 1*s,
            y: y + p + 1*s, 
            icon:this.parent.editor_icons.pointer, 
            active: () => { return this.parent.active_tool == EditorTool.SELECT_TILE },
            action: ()=>{ this.parent.active_tool = EditorTool.SELECT_TILE }
        })

        // tiles

        this.tiles = [
            gAssets.themes["plains"].sheets[1].tile(0*11+0),
            gAssets.themes["plains"].sheets[1].tile(0*11+5),
            gAssets.themes["plains"].sheets[1].tile(0*11+7),
            gAssets.themes["plains"].sheets[1].tile(1*11+7),
            gAssets.themes["plains"].sheets[1].tile(3*11+0),
            gAssets.themes["plains"].sheets[1].tile(4*11+10)
        ]

        this.actions.push({
            shortcut: "1",
            x: x + p + 0*s,
            y: y + p + 2*s, 
            icon: this.tiles[0], 
            active: () => { 
                return this.parent.active_tool == EditorTool.PLACE_TILE && 
                       this.parent.tile_shape == TileShape.FULL },
            action: ()=>{ 
                this.parent.active_tool = EditorTool.PLACE_TILE;
                this.parent.tile_shape = TileShape.FULL; 
            }
        })

        this.actions.push({
            shortcut: "2",
            x: x + p + 1*s,
            y: y + p + 2*s, 
            icon: this.tiles[1], 
            active: () => { 
                return this.parent.active_tool == EditorTool.PLACE_TILE && 
                       this.parent.tile_shape == TileShape.HALF },
            action: ()=>{ 
                this.parent.active_tool = EditorTool.PLACE_TILE;
                this.parent.tile_shape = TileShape.HALF; 
            }
        })


        this.actions.push({
            shortcut: "3",
            x: x + p + 0*s,
            y: y + p + 3*s, 
            icon: this.tiles[2], 
            active: () => { 
                return this.parent.active_tool == EditorTool.PLACE_TILE && 
                       this.parent.tile_shape == TileShape.ONETHIRD },
            action: ()=>{ 
                this.parent.active_tool = EditorTool.PLACE_TILE;
                this.parent.tile_shape = TileShape.ONETHIRD; 
            }
        })

        this.actions.push({
            shortcut: "4",
            x: x + p + 1*s,
            y: y + p + 3*s, 
            icon: this.tiles[3], 
            active: () => { 
                return this.parent.active_tool == EditorTool.PLACE_TILE && 
                       this.parent.tile_shape == TileShape.TWOTHIRD },
            action: ()=>{ 
                this.parent.active_tool = EditorTool.PLACE_TILE;
                this.parent.tile_shape = TileShape.TWOTHIRD; 
            }
        })

        this.actions.push({
            shortcut: "5",
            x: x + p + 0*s,
            y: y + p + 4*s, 
            icon: this.tiles[4], 
            active: () => { 
                return this.parent.active_tool == EditorTool.PLACE_TILE && 
                       this.parent.tile_shape == TileShape.ALT_FULL },
            action: ()=>{ 
                this.parent.active_tool = EditorTool.PLACE_TILE;
                this.parent.tile_shape = TileShape.ALT_FULL; 
            }
        })

        this.actions.push({
            shortcut: "6",
            x: x + p + 1*s,
            y: y + p + 4*s, 
            icon: this.tiles[5], 
            active: () => { 
                return this.parent.active_tool == EditorTool.PLACE_TILE && 
                       this.parent.tile_shape == TileShape.PIPE },
            action: ()=>{ 
                this.parent.active_tool = EditorTool.PLACE_TILE;
                this.parent.tile_shape = TileShape.PIPE; 
            }
        })


        // properties

        this.actions.push({
            shortcut: "s",
            x: x + p + 0*s,
            y: y + p + 5*s, 
            icon:this.parent.editor_icons.pencil, 
            render: (ctx, x, y)=>{ 

                ctx.save()

                ctx.beginPath();
                ctx.rect(x+1,y+1,14,14)
                ctx.closePath

                ctx.strokeStyle = "#000000"

                if (this.parent.tile_property == TileProperty.SOLID) {
                    ctx.fillStyle = "#000000"
                } else if (this.parent.tile_property == TileProperty.NOTSOLID) {
                    ctx.fillStyle = "#7f7f7f"
                    ctx.setLineDash([4]);
                } else if (this.parent.tile_property == TileProperty.ONEWAY) {
                    ctx.fillStyle = "#d66d47"
                } else if (this.parent.tile_property == TileProperty.ICE) {
                    ctx.fillStyle = "#36c6e3"
                }

                ctx.fill()
                ctx.stroke()

                ctx.restore()

                // draw the propert name next to the rect
                ctx.font = "6px Verdana";
                ctx.fillStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "middle"
                ctx.fillText(TileProperty.name[this.parent.tile_property], x+16+4, y+8)

            },
            action: () => {
                this.parent.tile_property += 1
                if (this.parent.tile_property > TileProperty.ICE) {
                    this.parent.tile_property = TileProperty.SOLID
                }
                console.log("change property", this.parent.tile_property)
            }
            
        })

        this.actions.push({
            shortcut: "d",
            x: x + p + 0*s,
            y: y + p + 6*s, 
            icon:this.parent.editor_icons.pencil, 
            render: (ctx, x, y)=>{

                this.parent.theme_sheets_icon[this.parent.tile_sheet].draw(ctx, x, y)
            },
            action: ()=>{ 
                this.parent.tile_sheet += 1
                if (this.parent.tile_sheet >= this.parent.theme_sheets.length) {
                    this.parent.tile_sheet = 1
                }
            }
        })



    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (!this.rect.collidePoint(t.x, t.y)) {

                return false
            }

            // only handle click release
            if (t.pressed) {
                return true
            }

            for (let i=0; i < this.actions.length; i++) {
                let action = this.actions[i]
                if (!!action.action) {
                    let rect = new Rect(action.x, action.y, 16, 16)
                    if (rect.collidePoint(t.x, t.y)) {
                        action.action()
                        return true
                    }
                }
            }

            return true;
        }

        return false
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 3)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        this.actions.forEach(action => {

            ctx.beginPath();
            ctx.fillStyle = (!!action.active && action.active())?"#FFD700":"#888888";
            ctx.roundRect(action.x-1, action.y-1, 18, 18, 3)
            ctx.fill()

            if (!!action.render) {
                action.render(ctx, action.x, action.y)
            } else {
                
                action.icon.draw(ctx, action.x, action.y)
            }

            if (!!action.shortcut) {
                ctx.beginPath();
                ctx.fillStyle = "#aaaaaa"
                ctx.roundRect(action.x+13, action.y+13, 6, 6, 2)
                ctx.fill()
                // draw a letter centerd in the rect
                ctx.font = "5px Verdana";
                ctx.fillStyle = "black"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.fillText(action.shortcut, action.x+16, action.y+16)

            }
        })

    }
}

class SettingsMenu {
    constructor(parent) {


        this.rect = new Rect(0,24,8 + 24 * 7, 8 + 24 * 3)
        this.parent = parent

        this.actions = []

        let x = this.rect.x + 8
        let y = this.rect.y + 8

        this.themes = Object.keys(gAssets.themes)
        this.theme_index =  this.themes.indexOf(this.parent.current_theme)

        this.actions.push({x:x+1*24,y,render: (ctx,x,y)=>{ctx.fillText(`Map Width:`, x+8,y+8)}})
        this.actions.push({x:x+3*24,y,icon:this.parent.editor_icons.arrow_left, action: ()=>{
            this.changeMapSize(-1, 0)
        }})
        this.actions.push({x:x+4*24,y,render: (ctx,x,y)=>{ctx.fillText(`${Math.floor(this.parent.map.width / 16 / 24)}`, x+24,y+8)}})
        this.actions.push({x:x+6*24,y,icon:this.parent.editor_icons.arrow_right, action: ()=>{
            this.changeMapSize(1, 0)
        }})

        y += 24

        this.actions.push({x:x+1*24,y,render: (ctx,x,y)=>{ctx.fillText(`Map Height:`, x+8,y+8)}})
        this.actions.push({x:x+3*24,y,icon:this.parent.editor_icons.arrow_left, action: ()=>{
            this.changeMapSize(0, -1)
        }})
        this.actions.push({x:x+4*24,y,render: (ctx,x,y)=>{ctx.fillText(`${Math.floor(this.parent.map.height / 16 / 14)}`, x+24,y+8)}})
        this.actions.push({x:x+6*24,y,icon:this.parent.editor_icons.arrow_right, action: ()=>{
            this.changeMapSize(0, 1)
        }})

        y += 24
        this.actions.push({x:x+1*24,y,render: (ctx,x,y)=>{ctx.fillText(`Map Theme:`, x+8,y+8)}})
        this.actions.push({x:x+3*24,y,icon:this.parent.editor_icons.arrow_left, action: ()=>{
            this.changeTheme(-1)
        }})
        this.actions.push({x:x+4*24,y,render: (ctx,x,y)=>{ctx.fillText(this.themes[this.theme_index], x+24,y+8)}})
        this.actions.push({x:x+6*24,y,icon:this.parent.editor_icons.arrow_right, action: ()=>{
            this.changeTheme(1)
        }})

    }

    changeTheme(dx) {

        this.theme_index += dx

        if (this.theme_index < 0) {
            this.theme_index = this.themes.length - 1
        }

        if (this.theme_index >= this.themes.length) {
            this.theme_index = 0
        }

        this.parent.setTileTheme(this.themes[this.theme_index])
    }

    changeMapSize(dx, dy) {

        let w = Math.floor(this.parent.map.width / 16 / 24)
        let h = Math.floor(this.parent.map.height / 16 / 14)
        console.log(this.parent.map.width,this.parent.map.height)
        console.log(w,h)

        w += dx
        h += dy

        if (w < 1 || h < 1 || w*h > 16) {
            return
        }

        this.parent.map.width = w * 16 * 24
        this.parent.map.height = h * 16 * 14

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            this.actions.forEach(action => {
                if (!!action.action) {
                    let rect = new Rect(action.x, action.y, 16, 16)
                    if (rect.collidePoint(t.x, t.y)) {
                        action.action()
                    }
                }
            })
        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h,8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()


        let x = 8
        let y = 32

        ctx.font = "bold 16px";
        ctx.fillStyle = "black"
        ctx.strokeStyle = "black"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        this.actions.forEach(action => {
            if (!!action.render) {
                action.render(ctx,action.x, action.y)
            } else {
                action.icon.draw(ctx, action.x, action.y)
            }
        })

    }

}

// a menu for selecting an object to place
class ObjectMenu {
    constructor(parent) {

        this.objects_per_row = 4
        this.number_of_rows = 5
        this.margin1 = 8
        this.margin2 = 8 + 16 + 8 + 8
        this.margin3 = 4

        this.rect = new Rect(0,24,this.margin3 + this.margin2 + 24 * (this.objects_per_row+2), this.margin1 + 24 * (this.number_of_rows+1))
        this.parent = parent

        this.actions = []

        // header scroll up
        this.actions.push({
            x: this.margin1,
            y: 32 + 24*4, 
            icon:this.parent.editor_icons.arrow_up, 
            action: ()=>{ this._header_scroll_up() }
        })
        // header scroll down
        this.actions.push({
            x: this.margin1,
            y: 32 + 24*5, 
            icon:this.parent.editor_icons.arrow_down,
            action: ()=>{ this._header_scroll_down() }
        })

        // object page scroll up
        this.actions.push({
            x: this.margin2 + 24*(this.objects_per_row),
            y: 32 + 24*1, 
            icon:this.parent.editor_icons.arrow_up, 
            action: ()=>{ this._body_scroll_up() }
        })

        // object page scroll down
        this.actions.push({
            x: this.margin2 + 24*(this.objects_per_row),
            y: 32 + 24 * (this.number_of_rows), 
            icon:this.parent.editor_icons.arrow_down, 
            action: ()=>{ this._body_scroll_down() }
        })

        let x,y;
        x = this.margin2 + this.margin3 + 24*(this.objects_per_row+1)
        y = 32 
        this.actions.push({
            x,y,icon:this.parent.editor_icons.new, 
            action: ()=>{
            this.parent.active_tool = EditorTool.PLACE_OBJECT
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({
            x,y,icon:this.parent.editor_icons.hand, 
            action: ()=>{
            this.parent.active_tool = EditorTool.SELECT_OBJECT
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({
            x,y,icon:this.parent.editor_icons.erase, 
            action: ()=>{
            this.parent.active_tool = EditorTool.ERASE_OBJECT
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({
            x,y,icon:this.parent.editor_icons.pencil, 
            action: ()=>{
            this.parent.active_tool = EditorTool.EDIT_OBJECT
            this.parent.active_menu = null
        }})

        

    }

    _header_scroll_up() {
        if (this.parent.objmenu_page_scroll_index > 0) {
            this.parent.objmenu_page_scroll_index -= 1;
        }
    }

    _header_scroll_down() {
        let n = this.parent.object_pages.length
        if (this.parent.objmenu_page_scroll_index < n-1) {
            this.parent.objmenu_page_scroll_index += 1;
        }
    }

    _body_scroll_up() {
        if (this.parent.objmenu_object_scroll_index > 0) {
            this.parent.objmenu_object_scroll_index -= 4
        }
        let n = this.parent.object_pages[this.parent.objmenu_current_page].objects.length;
        let i = this.parent.objmenu_object_scroll_index;
    }

    _body_scroll_down() {
        let n = this.parent.object_pages[this.parent.objmenu_current_page].objects.length;
        if (this.parent.objmenu_object_scroll_index < n-4) {
            this.parent.objmenu_object_scroll_index += 4
        }
        let i = this.parent.objmenu_object_scroll_index;
    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.buttons&4) {
                if (t.x < this.margin2) {
                    // scroll head
                    if (t.deltaY < 0) {
                        this._header_scroll_down()
                    } else {
                        this._header_scroll_up()
                    }

                } else {
                    // scroll body
                    if (t.deltaY < 0) {
                        this._body_scroll_down()
                    } else {
                        this._body_scroll_up()
                    }
                }
                
                return
            }

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            this.actions.forEach(action => {
                if (!!action.action) {
                    let rect = new Rect(action.x, action.y, 16, 16)
                    if (rect.collidePoint(t.x, t.y)) {
                        action.action()
                    }
                }
            })

            if (t.x <= this.margin1 + 24) {

                let tx = Math.floor((t.x - this.rect.x - this.margin1 - 24) / 24)
                let ty = Math.floor((t.y - this.margin1 - this.rect.y) / 24)

                if (ty >= 0 && ty < this.number_of_rows - 1) {
                    
                    let n = this.parent.objmenu_page_scroll_index + ty;
                    if (n >= 0 && n < this.parent.object_pages.length) {
                        this.parent.objmenu_current_page = n;
                        this.parent.objmenu_current_object = 0;
                        this.parent.objmenu_object_scroll_index = 0;
                    } else {
                        console.warn("object menu invalid index", n)
                    }
                }
                

            } else if (t.x <= this.margin2 + this.objects_per_row*24) {
                let tx = Math.floor((t.x - this.rect.x - this.margin2) / 24)
                let ty = Math.floor((t.y - this.rect.y - 24) / 24)
                
                let n = this.parent.objmenu_object_scroll_index + ty * this.objects_per_row + tx
                if (n < this.parent.object_pages[this.parent.objmenu_current_page].objects.length) {
                    this.parent.objmenu_current_object = n
                    this.parent.active_tool = EditorTool.PLACE_OBJECT
                }
                
            }
            


        }
    }

    _paint_body_scrollbar(ctx) {
        // background for object list scroll bar
        ctx.beginPath();
        ctx.fillStyle = "#888888"
        ctx.strokeStyle = "#888888"
        ctx.lineWidth = 2
        ctx.roundRect(this.margin2 + 24*(this.objects_per_row) + 1, 32 + 24*1+2, 14, 24*5-12, 3)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        let groove_x = this.margin2 + 24*(this.objects_per_row) + 1 + 2
        let groove_y = 32 + 24*1+2 + 12 + 4
        let groove_width = 10
        let groove_height = 24*5-12 - 24 - 8

        let nobj = Math.max(1, Math.ceil(this.parent.object_pages[this.parent.objmenu_current_page].objects.length/4));
        let iobj = Math.floor(this.parent.objmenu_object_scroll_index/4);
        let pobj = (nobj > 1)?(iobj/(nobj - 1)):0
        let handle_size = Math.max(8, groove_height / nobj)

        // groove
        ctx.beginPath();
        ctx.fillStyle = "#555555"
        ctx.strokeStyle = "#555555"
        ctx.lineWidth = 2
        ctx.rect(
            groove_x, 
            groove_y, 
            groove_width, 
            groove_height)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // handle
        ctx.beginPath();
        ctx.fillStyle = "#aaaaaa"
        ctx.strokeStyle = "#aaaaaa"
        ctx.lineWidth = 2
        ctx.rect(
            groove_x, 
            groove_y + Math.round((groove_height-handle_size) * pobj), 
            groove_width, 
            handle_size)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // line separating first and second panel
        ctx.beginPath();
        ctx.moveTo(this.margin2-this.margin1,this.rect.y)
        ctx.lineTo(this.margin2-this.margin1,this.rect.y + this.rect.h)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        
        // line separating second and third panel
        ctx.beginPath();
        ctx.moveTo(this.margin2 + ((this.objects_per_row)*24) + 18+2,this.rect.y)
        ctx.lineTo(this.margin2 + ((this.objects_per_row)*24) + 18+2,this.rect.y + this.rect.h)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
        
        // background for object menu scroll bar
        ctx.beginPath();
        ctx.fillStyle = "#888888"
        ctx.strokeStyle = "#888888"
        ctx.lineWidth = 2
        ctx.roundRect(this.margin1+1, 32 + 24*4+2, 14, 24*2-12, 3)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        this._paint_body_scrollbar(ctx);

        // background for edit tools
        for (let i=0; i < 4; i++) {
            ctx.beginPath();
            ctx.fillStyle = "#888888"
            ctx.strokeStyle = "#888888"
            ctx.lineWidth = 2
            
            ctx.roundRect(this.margin2 + 24*(this.objects_per_row+1) + this.margin3, 32 + 24*i, 16, 16, 3)
            ctx.closePath()
            ctx.stroke()
            ctx.fill()
        }

        let x = this.margin1
        let y = 32
        let n;

        ctx.fillStyle = "#0000FF"

        const page = this.parent.object_pages[this.parent.objmenu_current_page]
        const obj = page.objects[this.parent.objmenu_current_object]

        // headers

        ctx.fillStyle = "black"
        ctx.strokeStyle = "black"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        if (!!page) {
            ctx.font = "bold 10px serif"
            ctx.fillText(`${page.title}`, this.rect.x + this.margin2, this.rect.y + this.margin1 - 4);
        }
        if (!!obj) {
            ctx.font = "8px serif"
            ctx.fillText(`${obj.name}`, this.rect.x + this.margin2, this.rect.y + this.margin1 - 4 + 12);
        }


        // headers
        x = this.margin1
        y = this.margin1 + 24 
        n = this.parent.objmenu_page_scroll_index
        for (let j=0; j < 4; j++) {

            if (n+j >= this.parent.object_pages.length) {
                break
            }

            if (this.parent.objmenu_current_page == n+j) {
                ctx.beginPath()
                ctx.strokeStyle = "gold"
                ctx.roundRect(x-2,y-2,16+4,16+4, 4)
                ctx.closePath()
                ctx.stroke()
            }

            let icon = this.parent.object_pages[n+j]?.icon
            if (!!icon) {
                icon.draw(ctx, x+1, y+1)
            } else {
                ctx.beginPath()
                ctx.rect(x,y,16,16)
                ctx.closePath()
                ctx.fill()
            }

            
            y += 24
        }



        // object info
        x = this.margin2
        y = this.margin1 + 24 + 24

        

        n = this.parent.objmenu_object_scroll_index;
        for (let j=0; j < 5; j++) {

            x = this.margin2

            for (let i=0; i < 4; i++) {


                if (n >= page.objects.length) {
                    break
                }

                if (n == this.parent.objmenu_current_object) {
                    ctx.beginPath()
                    ctx.strokeStyle = "gold"
                    ctx.roundRect(x-2,y-2,16+4,16+4, 4)
                    ctx.closePath()
                    ctx.stroke()
                }

                //ctx.beginPath()
                //ctx.rect(x,y,16,16)
                //ctx.closePath()
                //ctx.fill()

                if (page.objects[n]?.icon) {
                    let icon = page.objects[n]?.icon
                    icon.draw(ctx, x, y)
                }

                x += 24
                n += 1
            }

            y += 24
        }

        this.actions.forEach(action => {
            if (!!action.render) {
                action.render(ctx,action.x, action.y)
            } else {
                action.icon.draw(ctx, action.x, action.y)
            }
        })

        let idx = [
            EditorTool.PLACE_OBJECT,
            EditorTool.SELECT_OBJECT,
            EditorTool.ERASE_OBJECT,
            EditorTool.EDIT_OBJECT
        ].indexOf(this.parent.active_tool)

        if (idx >= 0) {
            let x,y;
            x = this.margin3 + this.margin2 + 24*(this.objects_per_row+1)
            y = 32 + 24 * idx

            ctx.beginPath()
            ctx.strokeStyle = "gold"
            ctx.roundRect(x-2,y-2,16+4,16+4, 4)
            ctx.closePath()
            ctx.stroke()
        }


    }

}

// a menu for editing the properties of an object
class ObjectPropertyEditMenu {
    // TODO: when this menu opens
    // scroll the camera over .5 seconds to put the object in the center?
    // maybe only if the menu would cover the object

    constructor(parent, oid) {

        this.parent = parent
        this.oid = oid
        // this.map.objects


        this.rect = new Rect(0,24,7*16, 8 + 24 * 2)
        this.actions = []

        let obj = this.parent.map.objects[oid]
        let entry = this.parent.editor_objects[obj.name]
        this.schemaList = (entry?.editorSchema??[])

        this._y = this.rect.y + 8

        this.addNameWidget()

        if (this.schemaList.length > 0) {
            for (let i=0; i < this.schemaList.length; i++) {

                let schema = this.schemaList[i]

                if (schema.control == EditorControl.CHOICE) {
                    this.addChoiceWidget(schema)
                }

                if (schema.control == EditorControl.DOOR_TARGET) {

                    // worlds have names, levels have numbers
                    // a world editor could allow for a manifest
                    // that gives levels names in addition to the number
                    this.addChoiceWidget({"name": "target_world_id", "choices":["<none>", "<current>", "world_01",], "default":"<current>"})
                    this.addChoiceWidget({"name": "target_level_id", "choices":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], "default": 1})
                    this.addChoiceWidget({"name": "target_door_id", "choices":[1,2,3,4,5,6,7,8], "default": 1})
                }

                if (schema.control == EditorControl.DOOR_ID) {
                    this.addDoorIdWidget(schema)
                }

                if (schema.control == EditorControl.RESIZE) {
                    this.addSpinBoxWidget({
                        "name": "width", 
                        "step": 16, 
                        "min": schema.min_width??0,
                        "max": schema.max_width??0xFFFF,
                    })
                    this.addSpinBoxWidget({
                        "name": "height", 
                        "step": 16, 
                        "min": schema.min_height??0,
                        "max": schema.max_height??0xFFFF,
                    })
                }

                if (schema.control == EditorControl.RANGE) {
                    this.addSpinBoxWidget({
                        "name": schema.name, 
                        "display_name": schema.display_name??schema.name,
                        "step": schema.step??1, 
                        "min": schema.min??0,
                        "default": schema['default']??(schema.min??0),
                        "max": schema.max??0xFFFF_FFFF,
                    })
                }

                if (schema.control == EditorControl.DIRECTION_4WAY) {
                    this.addChoiceWidget({
                        "name": "direction",
                        "default": schema['default']??Direction.UP,
                        "choices": {
                        "UP": Direction.UP,
                        "RIGHT": Direction.RIGHT,
                        "DOWN": Direction.DOWN,
                        "LEFT": Direction.LEFT,
                    }})
                }

                if (schema.control == EditorControl.TEXT) {
                    this.addTextWidget(schema)
                }
            }
        }

        this.rect.h = this._y - (this.rect.y + 8) + 8

    }

    addNameWidget() {
        // title case the name

        let obj = this.parent.map.objects[this.oid]
        const name = obj.name + " (" + this.oid + ")"
        const y = this._y
        const root = {
            render: (ctx) => {

                ctx.strokeStyle = "black"
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(8,y-2)
                ctx.lineTo(8+6*16, y-2)
                ctx.closePath()
                ctx.stroke()

                ctx.beginPath()
                ctx.font = "8px serif"
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "top"
                ctx.fillText(name, 8, y+2);

            },
        }

        this.actions.push(root)
        this._y += 16
    }

    addTextWidget(schema) {

        let obj = this.parent.map.objects[this.oid]
        const property_name = schema.property
        const y = this._y
        const label = {
            render: (ctx) => {

                ctx.strokeStyle = "black"
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(8,y-2)
                ctx.lineTo(8+6*16, y-2)
                ctx.closePath()
                ctx.stroke()

                ctx.beginPath()
                ctx.font = "8px serif"
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "top"
                ctx.fillText(property_name, 8, y+2);

            },
        }
        const edit = {
            x: 8,
            y: y+16-2,
            w: 6*16,
            h: 16,
            action: ()=>{
                gEngine.requestKeyboardFocus({
                    "type": "text",
                    "placeholder": "",
                    "text": obj.props[property_name]
                }, null, (text)=> {
                    obj.props[property_name] = text
                })

            },
            render: (ctx) => {

                ctx.save()
                ctx.fillStyle = "#00000020"
                ctx.strokeStyle = "black"
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.rect(8,y+16-2, 6*16, 16)
                ctx.closePath()
                ctx.stroke()
                ctx.fill()
                ctx.clip()

                ctx.beginPath()
                ctx.font = "8px serif"
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "bottom"
                ctx.fillText(obj.props[property_name], 8+2, y+16+2 + 12);

                ctx.restore()

            },
        }

        this.actions.push(label)
        this.actions.push(edit)
        this._y += 16 + 16
    }

    addDoorIdWidget(schema) {
        // title case the name

        // TODO: fix objects when loading? delete malformed object when loading?
        let obj = this.parent.map.objects[this.oid]
        if (!Object.hasOwn(obj, 'props')) {
            obj.props = {}
        }
        if (obj.props["door_id"]==undefined) {
            obj.props["door_id"] = 0
        }

        const y = this._y
        const root = {
            render: (ctx) => {

                ctx.strokeStyle = "black"
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(8,y-2)
                ctx.lineTo(8+6*16, y-2)
                ctx.closePath()
                ctx.stroke()

                ctx.font = "8px serif";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "top"
                ctx.fillText("Door ID: ", 8, y+2);

                ctx.font = "8px serif";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "right"
                ctx.textBaseline = "top"

                let obj = this.parent.map.objects[this.oid]

                ctx.fillText(obj.props?.door_id??"error", 8+6*16, y+2);
            },
        }

        this.actions.push(root)
        this._y += 16
    }

    addSpinBoxWidget(schema) {

        // title case the name
        let display_name

        if (!!schema.display_name) {
            display_name = schema.display_name
        } else {
            display_name = schema.name.replaceAll("_", " ")
                .split(" ") 
                .map(s => s.charAt(0).toUpperCase() + s.slice(1)) 
                .join(" ")
        }
        

        let obj = this.parent.map.objects[this.oid]

        // TODO: fix objects when loading? delete malformed object when loading?
        if (!Object.hasOwn(obj, 'props')) {
            obj.props = {}
        }
        if (obj.props[schema.name]==undefined) {
            obj.props[schema.name] = schema['min']
        }

        const y = this._y
        const root = {
            render: (ctx) => {

                ctx.strokeStyle = "black"
                ctx.lineWidth = 2
                ctx.moveTo(8,y-2)
                ctx.lineTo(8+6*16, y-2)
                ctx.stroke()

                ctx.font = "8px serif";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "top"
                ctx.fillText(display_name, 8, y);
            },

            // default index from schema
            //index: root_index
        }

        this.actions.push(root)

        this.actions.push({
            render: (ctx) => {

                ctx.font = "8px serif";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                let option_name = "" + obj.props[schema.name]
                ctx.fillText(option_name, 8+16+32, y+12 + 8);
            }
        })

        this.actions.push({
            x:8,
            y:y+10,
            icon:this.parent.editor_icons.arrow_left,
            action: ()=>{
                if (obj.props[schema.name] > schema.min) {
                    obj.props[schema.name] -= schema.step
                }
        }})

        this.actions.push({
            x:8+5*16,
            y:y+10,
            icon:this.parent.editor_icons.arrow_right,
            action: ()=>{

                if (obj.props[schema.name] < schema.max) {
                    obj.props[schema.name] += schema.step
                }
        }})

        this._y += 16 + 16

    }

    addChoiceWidget(schema) {

        // title case the name
        let name = schema.name.replaceAll("_", " ")
            .split(" ") \
            .map(s => s.charAt(0).toUpperCase() + s.slice(1)) \
            .join(" ")

        let options = null
        let option_index = 0
        if (!Array.isArray(schema.choices)) {
            options = Object.entries(schema.choices)
            option_index = 0
        } else {
            options = Object.entries(schema.choices)
            option_index = 1
        }

        let obj = this.parent.map.objects[this.oid]

        // TODO: fix objects when loading? delete malformed object when loading?
        if (!Object.hasOwn(obj, 'props')) {
            obj.props = {}
        }
        if (obj.props[schema.name]==undefined) {
            obj.props[schema.name] = schema['default']
        }

        // determine the initial index
        // use the current object property, or set from the schema
        let root_index;
        if (Object.hasOwn(obj.props, schema.name)) {
            root_index = options.map(x=>x[1]).indexOf(obj.props[schema.name])
        } else {
            root_index = options.map(x=>x[1]).indexOf(schema['default'])
        }

        if (root_index === undefined || root_index < 0) {
            root_index = 0
            console.error("no option set for " + schema.name)
        }

        const y = this._y
        const root = {
            render: (ctx) => {

                ctx.strokeStyle = "black"
                ctx.lineWidth = 2
                ctx.moveTo(8,y-2)
                ctx.lineTo(8+6*16, y-2)
                ctx.stroke()

                ctx.font = "8px serif";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "left"
                ctx.textBaseline = "top"
                ctx.fillText(name, 8, y);
            },

            // default index from schema
            index: root_index
        }

        this.actions.push(root)

        this.actions.push({
            render: (ctx) => {

                ctx.font = "8px serif";
                ctx.fillStyle = "black"
                ctx.strokeStyle = "black"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                let option_name = options[root.index][option_index]
                ctx.fillText(option_name, 8+16+32, y+12 + 8);
            }
        })

        this.actions.push({
            x:8,
            y:y+10,
            icon:this.parent.editor_icons.arrow_left,
            action: ()=>{
            root.index -= 1
            if (root.index < 0) {
                root.index = options.length - 1
            }
            obj.props[schema.name] = options[root.index][1]
        }})

        this.actions.push({
            x:8+5*16,
            y:y+10,
            icon:this.parent.editor_icons.arrow_right,
            action: ()=>{
            root.index += 1
            if (root.index >= options.length) {
                root.index = 0
            }
            obj.props[schema.name] = options[root.index][1]
        }})

        this._y += 16 + 16

    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.pressed) { // prevent drag firing multiple times
                return
            }

            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            this.actions.forEach(action => {
                if (!!action.action) {
                    let rect = new Rect(action.x, action.y, action.w??16, action.h??16)
                    if (rect.collidePoint(t.x, t.y)) {
                        action.action()
                    }
                }
            })
        }
    }

    paint(ctx) {

        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h,8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()


        let x = 8
        let y = 32

        ctx.font = "bold 16px";
        ctx.fillStyle = "black"
        ctx.strokeStyle = "black"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        this.actions.forEach(action => {
            if (!!action.render) {
                action.render(ctx,action.x, action.y)
            } else {
                action.icon.draw(ctx, action.x, action.y)
            }
        })

    }

}

class StampMenu {
    constructor(parent) {

        this.parent = parent

        this.tiles_per_row = 8
        this.number_of_rows = 7
        this.margin1 = 8
        this.margin2 = 8 + 16 + 8 + 8
        this.margin3 = 4

        this.body_y = 64

        let w = this.margin3 + this.margin2 + 16 * (this.tiles_per_row+2) + 24
        let h = this.body_y + (16*this.number_of_rows) + this.margin1 - 24

        this.rect = new Rect(0,24,w,h)
        this.rect2 = new Rect(this.margin2, this.body_y, (this.tiles_per_row)*16, 16*this.number_of_rows)
        //this.select_region = new Rect(0,0,1,1)

        this.actions = []

        this.highlight_colors = [
            "#e6ac00", "#ffbf00", "#ffcc33", 
            "#ffd966", "#ffe699", "#ffd966", 
            "#ffcc33", "#ffbf00"
        ]

        // header scroll up
        this.actions.push({
            x: this.margin1,
            y: 32 + 24*4, 
            icon:this.parent.editor_icons.arrow_up, 
            action: ()=>{ this._header_scroll_up() }
        })
        // header scroll down
        this.actions.push({
            x: this.margin1,
            y: 32 + 24*5, 
            icon:this.parent.editor_icons.arrow_down,
            action: ()=>{ this._header_scroll_down() }
        })

        // object page scroll up
        this.actions.push({
            x: this.margin2 + this.margin1 + 16*(this.tiles_per_row) - 1,
            y: this.body_y, 
            icon:this.parent.editor_icons.arrow_up, 
            action: ()=>{ this._body_scroll_up() }
        })

        // object page scroll down
        this.actions.push({
            x: this.margin2 + this.margin1 + 16*(this.tiles_per_row) - 1,
            y: this.body_y + 16 * (this.number_of_rows) - 16, 
            icon:this.parent.editor_icons.arrow_down, 
            action: ()=>{ this._body_scroll_down() }
        })

        let x,y;
        x = this.margin2 + 2*this.margin1 + this.margin3 + 16*(this.tiles_per_row+1)
        y = 32 
        this.actions.push({
            x,y,icon:this.parent.editor_icons.new, 
            action: ()=>{
            this.parent.active_tool = EditorTool.PLACE_STAMP
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({
            x,y,icon:this.parent.editor_icons.hand, 
            action: ()=>{
            this.parent.active_tool = EditorTool.SELECT_STAMP
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({
            x,y,icon:this.parent.editor_icons.erase, 
            action: ()=>{
            this.parent.active_tool = EditorTool.ERASE_STAMP
            this.parent.active_menu = null
        }})

        // TODO: maximum size constraints
        // 256 tiles : 8 * 32
        let stamp_sheet = gAssets.themes["plains"].stamps[1]
        this.parent.stampmenu_stamp.image_width = Math.min(8*16, stamp_sheet.image.width)
        this.parent.stampmenu_stamp.image_height = Math.min(32*16, stamp_sheet.image.height)


    }


    _header_scroll_up() {
        //if (this.parent.objmenu_page_scroll_index > 0) {
        //     this.parent.objmenu_page_scroll_index -= 1;
        //}
    }

    _header_scroll_down() {
        //let n = this.parent.object_pages.length
        //if (this.parent.objmenu_page_scroll_index < n-1) {
        //    this.parent.objmenu_page_scroll_index += 1;
        //}
    }

    _body_scroll_up() {
        //if (this.parent.objmenu_object_scroll_index > 0) {
        //    this.parent.objmenu_object_scroll_index -= 4
        //}
        //let n = this.parent.object_pages[this.parent.objmenu_current_page].objects.length;
        //let i = this.parent.objmenu_object_scroll_index;
        if (this.parent.stampmenu_stamp.yoffset > 0) {
            this.parent.stampmenu_stamp.yoffset -= 16
        }
        
    }

    _body_scroll_down() {
        //let n = this.parent.object_pages[this.parent.objmenu_current_page].objects.length;
        //if (this.parent.objmenu_object_scroll_index < n-4) {
        //    this.parent.objmenu_object_scroll_index += 4
        //}
        //let i = this.parent.objmenu_object_scroll_index;

        if (this.parent.stampmenu_stamp.yoffset < this.parent.stampmenu_stamp.image_height - 32) {
            this.parent.stampmenu_stamp.yoffset += 16
        }
    }

    handleTouches(touches) {

        if (touches.length > 0) {

            let t = touches[0]

            if (t.buttons&4) {
                if (t.x < this.margin2) {
                    // scroll head
                    if (t.deltaY < 0) {
                        this._header_scroll_down()
                    } else {
                        this._header_scroll_up()
                    }

                } else {
                    // scroll body
                    if (t.deltaY < 0) {
                        this._body_scroll_down()
                    } else {
                        this._body_scroll_up()
                    }
                }
                
                return
            }


            if (this.rect2.collidePoint(t.x, t.y)) {
                
                
                let yoff = Math.floor(this.parent.stampmenu_stamp.yoffset/16)
                let xoff = Math.floor(this.parent.stampmenu_stamp.xoffset/16)

                let cell_x = xoff + Math.floor((t.x - this.rect2.x)/16)
                let cell_y = yoff + Math.floor((t.y - this.rect2.y)/16)
                
                if (cell_x*16 >= this.parent.stampmenu_stamp.image_width || 
                    cell_y*16 >= this.parent.stampmenu_stamp.image_height) {
                    
                    console.log("oob")
                } else {

                    if (t.first) {
                        this.parent.stampmenu_stamp.rect = new Rect(cell_x, cell_y, 1, 1)    

                    } else {
                        let w = cell_x - this.parent.stampmenu_stamp.rect.x + 1
                        let h = cell_y - this.parent.stampmenu_stamp.rect.y + 1

                        this.parent.stampmenu_stamp.rect.w = Math.max(1, w)
                        this.parent.stampmenu_stamp.rect.h = Math.max(1, h)

                    }
                }
            }

            // prevent drag firing multiple times
            if (t.pressed) { 
                return
            }

            // click outside menu closes it
            if (!this.rect.collidePoint(t.x, t.y)) {
                this.parent.active_menu = null
                return
            }

            // process actions
            this.actions.forEach(action => {
                if (!!action.action) {
                    let rect = new Rect(action.x, action.y, 16, 16)
                    if (rect.collidePoint(t.x, t.y)) {
                        action.action()
                    }
                }
            })

            

        }
    }

    _paint_body_scrollbar(ctx) {

        let bar_w = 14
        let groove_x = this.margin2 + 16*(this.tiles_per_row) + this.margin1 + 2
        let groove_y = this.body_y + 12 + 4
        let groove_width = 10
        let groove_height = 24*5-12 - 24 - 8
        //let handle_size = 8

        let nobj = Math.max(0, this.parent.stampmenu_stamp.image_height - 32);
        let iobj = this.parent.stampmenu_stamp.yoffset;
        let pobj = (nobj>=32)?Math.min(1, iobj/nobj):0;

        let handle_size = Math.max(8, groove_height / (nobj/16))
        //console.log(nobj, iobj, pobj, nobj/16)

        // background for object list scroll bar
        ctx.beginPath();
        ctx.fillStyle = "#888888"
        ctx.strokeStyle = "#888888"
        ctx.lineWidth = 2
        ctx.roundRect(
            this.margin2 + 16*(this.tiles_per_row) + this.margin1, 
            this.body_y, 
            bar_w, 
            16*this.number_of_rows, 
            3)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        //groove
        ctx.beginPath();
        ctx.fillStyle = "#555555"
        ctx.strokeStyle = "#555555"
        ctx.lineWidth = 2
        ctx.rect(
            groove_x, 
            groove_y, 
            groove_width, 
            groove_height)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // handle
        ctx.beginPath();
        ctx.fillStyle = "#aaaaaa"
        ctx.strokeStyle = "#aaaaaa"
        ctx.lineWidth = 2
        ctx.rect(
            groove_x, 
            groove_y + Math.round((groove_height-handle_size) * pobj), 
            groove_width, 
            handle_size)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
    }

    _paint_sheet(ctx) {

        // draw a border around the sheet
        ctx.beginPath();
        ctx.fillStyle = "#888888"
        ctx.strokeStyle = "#888888"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect2.x-2, this.rect2.y-2, this.rect2.w+4, this.rect2.h+4, 3)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // draw a checkerboard with 16x16 tiles in black and white over rect2
        for (let i=0; i < this.number_of_rows; i++) {
            for (let j=0; j < this.tiles_per_row; j++) {

                let x = this.rect2.x + j*16
                let y = this.rect2.y + i*16

                if (this.parent.stampmenu_stamp.yoffset + i*16 >= this.parent.stampmenu_stamp.image_height) {
                    continue
                }

                if (this.parent.stampmenu_stamp.xoffset + j*16 >= this.parent.stampmenu_stamp.image_width) {
                    continue
                }

                if ((i+j)%2 == 0) {
                    ctx.fillStyle = "#9090FF"
                } else {
                    ctx.fillStyle = "#8080FF"
                }
                ctx.fillRect(x, y, 16, 16)
            }
        }

        ctx.save()
        ctx.rect(this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h);
        ctx.clip()

        let stamp_sheet = gAssets.themes["plains"].stamps[1]
        ctx.drawImage(stamp_sheet.image, 
            this.parent.stampmenu_stamp.xoffset, this.parent.stampmenu_stamp.yoffset, this.rect2.w, this.rect2.h, 
            this.rect2.x, this.rect2.y, this.rect2.w, this.rect2.h)

        // highlight the current selection
        ctx.beginPath();
        
        ctx.strokeStyle = this.highlight_colors[Math.floor(gEngine.frameIndex/10)%this.highlight_colors.length]
        ctx.rect(
            this.rect2.x + this.parent.stampmenu_stamp.rect.x*16 - this.parent.stampmenu_stamp.xoffset,
            this.rect2.y + this.parent.stampmenu_stamp.rect.y*16 - this.parent.stampmenu_stamp.yoffset,
            this.parent.stampmenu_stamp.rect.w*16,
            this.parent.stampmenu_stamp.rect.h*16)
        ctx.stroke()

        ctx.restore()

    }

    paint(ctx) {


        ctx.beginPath();
        ctx.fillStyle = "#a2baa2"
        ctx.strokeStyle = "#526a52"
        ctx.lineWidth = 2
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 8)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // line separating first and second panel
        ctx.beginPath();
        ctx.moveTo(this.margin2-this.margin1,this.rect.y)
        ctx.lineTo(this.margin2-this.margin1,this.rect.y + this.rect.h)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        
        // line separating second and third panel
        ctx.beginPath();
        ctx.moveTo(this.margin2 + this.margin1 + 4 + ((this.tiles_per_row)*16) + 18+2,this.rect.y)
        ctx.lineTo(this.margin2 + this.margin1 + 4 + ((this.tiles_per_row)*16) + 18+2,this.rect.y + this.rect.h)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // background for header scroll bar
        ctx.beginPath();
        ctx.fillStyle = "#888888"
        ctx.strokeStyle = "#888888"
        ctx.lineWidth = 2
        ctx.roundRect(this.margin1+1, 32 + 24*4+2, 14, 24*2-12, 3)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        this._paint_body_scrollbar(ctx)

        this._paint_sheet(ctx)

        // background for edit tools
        for (let i=0; i < 3; i++) {
            ctx.beginPath();
            ctx.fillStyle = "#888888"
            ctx.strokeStyle = "#888888"
            ctx.lineWidth = 2
            
            ctx.roundRect(this.margin2 + this.margin1 + 2*this.margin3 + ((this.tiles_per_row)*16) + 18+2, 32 + 24*i, 16, 16, 3)
            ctx.closePath()
            ctx.stroke()
            ctx.fill()
        }


        this.actions.forEach(action => {
            if (!!action.render) {
                action.render(ctx,action.x, action.y)
            } else {
                action.icon.draw(ctx, action.x, action.y)
            }
        })

    }
}

export class LevelEditScene extends GameScene {

    // TODO: optimize: only do a full paint if something changed
    //       change the engine to not clear on every frame
    //       scene is still 60fps. but there are no animations

    constructor() {
        super()

        let [wid, lid] = gAssets.mapinfo.mapurl.match(/\d+/g)
        //let wid = gCharacterInfo.current_map.world_id.slice(-2)
        //let lid = gCharacterInfo.current_map.level_id
        gCharacterInfo.current_map.world_id = `world_${wid}`
        gCharacterInfo.current_map.level_id = parseInt(lid, 10)
        gCharacterInfo.current_map.door_id = 1


        gCharacterInfo.current_map_spawn = gCharacterInfo.current_map

        let map_id = `${wid}-${lid}`
        this.current_map_id = map_id
        // push the new url to the history
        history.pushState({}, "edit map", `?mapid=${map_id}&edit=true`);

        this._touches = []

        this.history = []
        this.history_index = 0
        this.history_max_entries = 20

        this.camera = {x:-48, y:-48, scale:2}
        this.map = {
            width: 15*32,
            height: 9*32,
            layers: [{}],
            objects: {},
            stamps: {} // stamps are like non-solid tile-objects, allow, 'bg' and 'fg' as an attribute
        }

        gAssets.mapinfo.objects.forEach(obj => {
            if (!this.map.objects[obj.oid]) {
                this.map.objects[obj.oid] = obj
            }
        })

        gAssets.mapinfo.stamps.forEach(stamp_data => {
            let stamp = deserialize_stamp(stamp_data)
            if (stamp.rect.w > 0 && stamp.rect.h > 0) {
                let sid = stamp.sid
                delete stamp.sid
                this.map.stamps[sid] = stamp
            }
        })

        if (gAssets.themes[gAssets.mapinfo.theme] !== undefined) {
            this.setTileTheme(gAssets.mapinfo.theme)
        } else {
            this.setTileTheme("plains")
        }

        this.editor_icons = {
            "pencil": gAssets.sheets.editor.tile(0),
            "erase": gAssets.sheets.editor.tile(1),
            "zoom_in": gAssets.sheets.editor.tile(2),
            "zoom_out": gAssets.sheets.editor.tile(3),
            "dropper": gAssets.sheets.editor.tile(4),
            "brush": gAssets.sheets.editor.tile(5),
            "arrow_up": gAssets.sheets.editor.tile(6),
            "arrow_down": gAssets.sheets.editor.tile(7),

            
            "save": gAssets.sheets.editor.tile(1*8+0),
            "load": gAssets.sheets.editor.tile(1*8+1),
            "trash": gAssets.sheets.editor.tile(1*8+2),
            "gear": gAssets.sheets.editor.tile(1*8+3),
            "x": gAssets.sheets.editor.tile(1*8+4),
            "hand": gAssets.sheets.editor.tile(1*8+5),
            "arrow_left": gAssets.sheets.editor.tile(1*8+6),
            "arrow_right": gAssets.sheets.editor.tile(1*8+7),

            "play": gAssets.sheets.editor.tile(2*8+0),
            "pointer": gAssets.sheets.editor.tile(2*8+1),
            "hamburger": gAssets.sheets.editor.tile(2*8+2),
            "exit": gAssets.sheets.editor.tile(2*8+3),
            "new": gAssets.sheets.editor.tile(2*8+4),
            "stamp": gAssets.sheets.editor.tile(2*8+5),
            "undo": gAssets.sheets.editor.tile(2*8+6),
            "redo": gAssets.sheets.editor.tile(2*8+7),

            "visible": gAssets.sheets.editor.tile(3*8+0),
            "not_visible": gAssets.sheets.editor.tile(3*8+1),
        }

        this.editor_objects = Object.fromEntries(editorEntities.map(entry=>[entry.name,entry]))

        this._init_objectMenu()

        this._init_menu()

        this._init_slopes()

        const mapinfo = gAssets.mapinfo

        this.map.width = mapinfo.width
        this.map.height = mapinfo.height
        this.map.layers = mapinfo.layers

        //this.map.layers[0] = Object.fromEntries(mapinfo.layers[0].map(x => {
        //    const tid = (x >> 13)&0x3ffff
        //    const shape = (x >> 10) & 0x07
        //    const property = (x >> 7) & 0x07
        //    const sheet = (x >> 4) & 0x07
        //    const direction = x & 0x0F
        //    const tile = {shape, property, sheet, direction}
        //    return [tid, tile]
        //}))

        this.tile_shape = TileShape.FULL // full, half, one third, two third
        this.tile_property = 1 // 1: solid, 2: not solid, 3: ice (solid), 4: water (not solid), 5: lava (not solid)
        this.tile_sheet = 1 // 1: ground, 2: pipes, 3: omake

        this.active_menu = null
        this.active_tool = EditorTool.PLACE_TILE

        this.ygutter = 64 // allow 4 tiles to be place out of bounds at the top of the map

        // init history to the current state
        this.historyPush(true, true, true)

        this.tile_selection = null

        this._x_visited_tiles = {} // debug tile update issues

        this.active_palette = new TilePalette(this)

    }

    setTileTheme(theme) {
        if (!gAssets.themes[theme]) {
            console.error("invalid theme name", theme)
        }
        gAssets.mapinfo.theme = theme
        this.current_theme = theme
        
        this.theme_sheets = gAssets.themes[theme].sheets
        this.theme_sheets_icon = this.theme_sheets.map(s => s===null?null:s.tile(2*11+1))
    }

    _init_menu() {
        this.actions = [
            {
                name: "file",
                icon: this.editor_icons.save,
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_palette = null
                    this.active_menu = new FileMenu(this)
                },
                selected: null,
            },
            {
                name: "settings",
                icon: this.editor_icons.gear,
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_palette = null
                    this.active_menu = new SettingsMenu(this)
                },
                selected: null,
            },
            {
                name: null,
                icon: null,
                action: null,
                selected: null,
            },
            {
                name: "objects",
                //icon: this.editor_icons.hand,
                icon2: ()=> {
                    if (this.active_tool == EditorTool.PLACE_OBJECT) {
                        console.warn("no default icon for place object")
                    }
                    if (this.active_tool == EditorTool.SELECT_OBJECT) {
                        return this.editor_icons.hand
                    }
                    if (this.active_tool == EditorTool.EDIT_OBJECT) {
                        return this.editor_icons.pencil
                    }
                    if (this.active_tool == EditorTool.ERASE_OBJECT) {
                        return this.editor_icons.erase
                    }
                    return this.editor_icons.hand
                },
                action: () => {
                    gAssets.sounds.click1.play()
                    //this.active_tool = EditorTool.PLACE_OBJECT;
                    this.active_palette = null
                    this.active_menu = new ObjectMenu(this)
                },
                selected: () => this.active_tool & EditorTool.OBJECT_MASK
            },

            {
                name: "tiles",
                //icon: this.editor_icons.hand,
                icon2: ()=> {
                    if (this.active_tool == EditorTool.PLACE_TILE) {
                        return this.editor_icons.new
                    }
                    if (this.active_tool == EditorTool.SELECT_TILE) {
                        return this.editor_icons.pointer
                    }
                    if (this.active_tool == EditorTool.PAINT_TILE) {
                        return this.editor_icons.brush
                    }
                    if (this.active_tool == EditorTool.ERASE_TILE) {
                        return this.editor_icons.erase
                    }
                    return this.editor_icons.hand
                },
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_palette = new TilePalette(this)
                    this.active_tool = EditorTool.PLACE_TILE;
                    //this.active_menu = new TileMenu(this)
                },
                selected: () => {
                    return this.active_tool & EditorTool.TILE_MASK
                }
            },
            {
                name: "stamps",
                icon2: ()=> {
                    if (this.active_tool == EditorTool.SELECT_STAMP) {
                        return this.editor_icons.hand
                    }
                    if (this.active_tool == EditorTool.ERASE_STAMP) {
                        return this.editor_icons.erase
                    }
                    return this.editor_icons.stamp
                },
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_palette = null
                    this.active_tool = EditorTool.PLACE_STAMP;
                    this.active_menu = new StampMenu(this)
                },
                selected: () => {
                    return this.active_tool & EditorTool.STAMP_MASK
                }
            },
            {
                name: null,
                icon: null,
                action: null,
                selected: null,
            },
            {
                name: null,
                icon: null,
                action: null,
                selected: null,
            },
            {
                name: "undo",
                icon: this.editor_icons.undo,
                action: () => {

                    this.historyPop()
                },
                selected: null,
            },
            {
                name: "redo",
                icon: this.editor_icons.redo,
                action: () => {
                    this.historyUnPop()
                },
                selected: null,
            },
            {
                name: null,
                icon: null,
                action: null,
                selected: null,
            },
            {
                name: "zoom-out",
                icon: this.editor_icons.zoom_out,
                action: () => { this._zoom_out() },
                selected: null,
            },
            {
                name: "zoom-in",
                icon: this.editor_icons.zoom_in,
                action: () => { this._zoom_in() },
                selected: null,
            },
            {
                name: null,
                icon: null,
                action: null,
                selected: null,
            },
            {
                name: null,
                icon: null,
                action: null,
                selected: null,
            },
            {
                name: "test",
                icon: this.editor_icons.play,
                action: () => {
                    this.playTest()
                },
                selected: null,
            },
        ]
    }

    _init_objectMenu() {
        this.object_pages = [

            {
                title: "All Objects",
                icon: gAssets.sheets.coin.tile(0),
                objects: [...editorEntities]
            },
            {
                title: "Items",
                icon: gAssets.sheets.brick.tile(0),
                objects: editorEntities.filter(ent => ent.category == EntityCategory.item)
            },
            {
                title: "Small Mobs",
                icon: this.editor_objects['Creeper'].icon,
                objects: editorEntities.filter(ent => ent.category == EntityCategory.small_mob)
            },
            {
                title: "Switches",
                icon: gAssets.sheets.brick.tile(1),
                objects: editorEntities.filter(ent => ent.category == EntityCategory.switches)
            },
            {
                title: "Doors",
                icon: this.editor_objects['Door'].icon,
                objects: editorEntities.filter(ent => ent.category == EntityCategory.door)
            },
            {
                title: "Hazards",
                icon: this.editor_objects['Spikes'].icon,
                objects: editorEntities.filter(ent => ent.category == EntityCategory.hazard)
            },
        ]

        this.object_pages.forEach(page => {
            page.objects.sort((a,b) => {
                if (a.category < b.category) { return -1 };
                if (a.category > b.category) {return 1 };
                
                if (a.name < b.name) {return -1};
                if (a.name > b.name) {return 1};
                
                return 0; // Objects are considered equal
            })
        })

        this.objmenu_current_page = 0
        this.objmenu_current_object = 0
        this.objmenu_page_scroll_index = 0
        this.objmenu_object_scroll_index = 0
        this.selected_object = null

        this.stampmenu_stamp = {
            // menu properties
            image_width: 0,
            image_height: 0,
            xoffset: 0,
            yoffset: 0,
            // stamp properties
            sheet: 0, 
            rect: new Rect(0,0,1,1),
            layer: 0
        }
        this.selected_stamp = null
    }

    _init_slopes() {

        const rect = new Rect(0,0,16,16)

        this.slopes_half = {
            [Direction.UPRIGHT]: [
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.right(), y: rect.bottom()},
                {x: rect.left(),  y: rect.top()},
            ],
            [Direction.UPLEFT]: [
                {x: rect.right(), y: rect.bottom()},
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.right(), y: rect.top()},
            ],
            [Direction.DOWNRIGHT]: [
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.bottom()},
            ],
            [Direction.DOWNLEFT]: [
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.bottom()},
            ]
        }

        this.slopes_onethird = {
            [Direction.UPRIGHT]: [
                {x: rect.left(),  y: rect.bottom()}, // origin
                {x: rect.right(), y: rect.bottom()}, //
                {x: rect.left(),  y: rect.cy()},
            ],
            [Direction.UPLEFT]: [
                {x: rect.right(), y: rect.bottom()}, // origin
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.right(), y: rect.cy()},
            ],
            [Direction.DOWNRIGHT]: [
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.cy()},
            ],
            [Direction.DOWNLEFT]: [
                {x: rect.right(), y: rect.top()},
                {x: rect.left(),  y: rect.top()},
                {x: rect.right(), y: rect.cy()},
            ]
        }

        this.slopes_twothird = {
            [Direction.UPRIGHT]: [
                {x: rect.left(),  y: rect.bottom()}, // origin
                {x: rect.right(),  y: rect.bottom()},
                {x: rect.right(),  y: rect.cy()},
                {x: rect.left(), y: rect.top()},
            ],
            [Direction.UPLEFT]: [
                {x: rect.right(), y: rect.bottom()}, // origin
                {x: rect.left(),  y: rect.bottom()},
                {x: rect.left(),  y: rect.cy()},
                {x: rect.right(), y: rect.top()},
            ],
            [Direction.DOWNRIGHT]: [
                {x: rect.left(),  y: rect.top()}, // origin
                {x: rect.right(), y: rect.top()},
                {x: rect.right(), y: rect.cy()},
                {x: rect.left(),  y: rect.bottom()},
            ],
            [Direction.DOWNLEFT]: [
                {x: rect.right(), y: rect.top()}, // origin
                {x: rect.left(),  y: rect.top()},
                {x: rect.left(), y: rect.cy()},
                {x: rect.right(), y: rect.bottom()},
            ]
        }

    }

    pause(paused) {

    }

    update(dt) {

    }

    _paint_header(ctx) {
        const barHeight = 24

        ctx.beginPath()
        ctx.fillStyle = "black";
        ctx.rect(0,0, gEngine.view.width, barHeight)
        ctx.fill()

        // tile editor / object editor switch

        // tile picker / object picker
        //      how to pick solid? ice? lava? water?
        //      dialog pick
        //          (solid, ice, lava, water)
        //      which constrains the set of tiles to select
        //          (full, half, onethird, twothird)
        // erase


        this.actions.forEach((action, index) => {

            if (!!action.selected) {
                if (action.selected()) {
                    ctx.beginPath();
                    ctx.fillStyle = "gold"
                    const x = 3 + 24*index
                    const y = barHeight/2 - 9
                    ctx.rect(x-2, y-2, 18+4, 18+4);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            if (!!action.action) {

                ctx.beginPath();
                ctx.fillStyle = "#00FF00"
                const x = 3 + 24*index
                const y = barHeight/2 - 9
                ctx.rect(x, y, 18, 18);
                ctx.closePath();
                ctx.fill();

                if (action.name == "tiles") {

                    // draw the current tool or the tile template
                    if (this.active_tool == EditorTool.ERASE_TILE) {

                        this.editor_icons.erase.draw(ctx, x+1, y+1)

                    } else if (this.active_tool == EditorTool.PAINT_TILE) {

                        this.editor_icons.brush.draw(ctx, x+1, y+1)

                    } else if (this.active_tool == EditorTool.SELECT_TILE) {

                        this.editor_icons.pointer.draw(ctx, x+1, y+1)
                    } else {
                        // TODO: cache the template tile as part of the tile menu
                        let points;
                        switch (this.tile_shape) {
                            case TileShape.HALF:
                                points = this.slopes_half[Direction.UPRIGHT]
                                break
                            case TileShape.ONETHIRD:
                                points = this.slopes_onethird[Direction.UPRIGHT]
                                break
                            case TileShape.TWOTHIRD:
                                points = this.slopes_twothird[Direction.UPRIGHT]
                                break
                            default:
                                break
                        }

                        const tile = {
                            shape: this.tile_shape,
                            property: this.tile_property,
                            sheet: this.tile_sheet,
                            direction: Direction.UPRIGHT,
                            points: points,
                        }

                        paintTile(ctx, x+1, y+1, tile, this.theme_sheets)
                    }
                }
                else if (action.name == "objects") {

                    // drwa the current object icon, or the tool icon
                    if (this.active_tool == EditorTool.PLACE_OBJECT) {
                        let page = this.object_pages[this.objmenu_current_page]
                        let obj = page.objects[this.objmenu_current_object]
                        let icon = obj?.icon
                        if (!!icon) {
                            icon.draw(ctx, x+1, y+1)
                        }
                    } else {
                        action.icon2().draw(ctx, x+1, y+1)
                    }
                    
                }
                else if (action.name == "stamps") {

                    action.icon2().draw(ctx, x+1, y+1)
                    
                }
                else if (!!action.icon2) {
                    action.icon2().draw(ctx, x+1, y+1)
                }
                else if (!!action.icon) {
                    action.icon.draw(ctx, x+1, y+1)
                }
            }
        })

        ctx.font = "bold 16px";
        ctx.fillStyle = "yellow"
        ctx.strokeStyle = "yellow"
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        //let text = `${-this.ygutter}, ${-Math.ceil(this.camera.y/16)*16}`
        //  ${Math.floor(this.camera.x)}, ${Math.floor(this.camera.y)
        let text = `${this.camera.scale}x`
        //let text = `n=${this?.num_touches??0}`
        ctx.fillText(text, 3+13*24, 12);
    }

    _paint_background(ctx) {
        ctx.beginPath()
        let bgcolor = gAssets.themes[gAssets.mapinfo.theme].background_color
        ctx.fillStyle = bgcolor
        ctx.strokeStyle = "#000000";
        //const rw = Math.min(this.camera.x + gEngine.view.width, this.map.width) - this.camera.x
        //const rh = Math.min(this.camera.y + gEngine.view.height, this.map.height) - this.camera.y

        const sw = gEngine.view.width * this.camera.scale
        const sh = gEngine.view.height * this.camera.scale
        let x1 = Math.max(0, this.camera.x* this.camera.scale)
        let y1 = Math.max(0, this.camera.y* this.camera.scale)
        let x2 = Math.min((this.camera.x + gEngine.view.width) * this.camera.scale, this.map.width)
        let y2 = Math.min((this.camera.y + gEngine.view.height) * this.camera.scale, this.map.height)
        ctx.rect(
            x1,
            y1,
            x2 - x1,
            y2 - y1)
        ctx.fill()
        ctx.stroke()

        // draw orange for the -y gutter
        ctx.beginPath()
        x1 = Math.max(0, this.camera.x* this.camera.scale)
        y1 = -this.ygutter//Math.max(-this.ygutter, this.camera.y)
        x2 = Math.min((this.camera.x + gEngine.view.width) * this.camera.scale, this.map.width)
        y2 = Math.min((this.camera.y + gEngine.view.height) * this.camera.scale, 0)
        ctx.fillStyle = "#d66d47";
        if (y1 < y2) {
            ctx.rect(
                x1,
                y1,
                x2 - x1,
                y2 - y1)
            ctx.fill()
            ctx.stroke()
        }
    }

    _paint_grid(ctx) {
        ctx.strokeStyle = "#22222233";
        ctx.lineWidth = 1;

        let gs = 16
        const sw = gEngine.view.width * this.camera.scale
        const sh = gEngine.view.height * this.camera.scale

        // correct scaling to start drawing at first pixel in display
        let x1 = Math.floor((this.camera.x*this.camera.scale)/gs)*gs
        x1 = Math.max(0, x1)
        let y1 = Math.floor((this.camera.y*this.camera.scale)/gs)*gs
        y1 = Math.max(-this.ygutter, y1)

        //let x2 = Math.min(x1 + sw, this.map.width)
        //let y2 = Math.min(y1 + sh, this.map.height)
        let x2 = Math.min((this.camera.x + gEngine.view.width) * this.camera.scale, this.map.width)
        let y2 = Math.min((this.camera.y + gEngine.view.height) * this.camera.scale, this.map.height)

        let p = []
        for (let gx = x1; gx < x2 + gs; gx += gs) {
            if (gx%gEngine.view.width==0) {
                ctx.strokeStyle = "#222222aa";
            } else {
                ctx.strokeStyle = "#22222233";
            }
            p.push(gx)
            ctx.beginPath()
            ctx.moveTo(gx, y1)
            ctx.lineTo(gx, y2)
            ctx.stroke()
        }

        for (let gy = y1; gy < y2; gy += gs) {
            if (gy%gEngine.view.height==0) {
                ctx.strokeStyle = "#222222aa";
            } else {
                ctx.strokeStyle = "#22222233";
            }
            ctx.beginPath()
            ctx.moveTo(x1, gy)
            ctx.lineTo(x2, gy)
            ctx.stroke()
        }
    }

    _paint_tiles(ctx) {
        // TODO: only draw visible tiles
        for (const [tid, tile] of Object.entries(this.map.layers[0])) {

            let y = 16*Math.floor(tid/512 - 4)
            let x = 16*(tid%512)

            paintTile(ctx, x, y, tile, this.theme_sheets)

        
        }

        if (!!this.tile_selection && !!this.tile_selection.rect) {
            ctx.beginPath()
            let {x,y,w,h} = this.tile_selection.rect
            ctx.rect(x*16,y*16,w*16,h*16)
            ctx.closePath()
            ctx.strokeStyle = "#1212127F"
            ctx.setLineDash([]);
            ctx.stroke()
            ctx.strokeStyle = "#AAAAAA"
            ctx.setLineDash([2]);
            ctx.stroke()
            if (!!this.tile_selection.p3) { 
                ctx.beginPath()
                let {x, y} = this.tile_selection.p3;
                ctx.rect(x*16,y*16,16,16)
                ctx.fillStyle = "#7f0000"
                ctx.fill()
            }
            
        }

        // paint which tiles changed after placing the last tile
        // useful for debugging
        /*
        Object.entries(this._x_visited_tiles).forEach(([tid, value]) => {
            ctx.beginPath()
            let [x, y] = value;
            ctx.rect(x*16,y*16,16,16)
            ctx.fillStyle = "#ff000033"
            ctx.fill()
        })
        */
    }

    _paint_stamps(ctx) {

        ctx.save()

        if (!(this.active_tool&EditorTool.STAMP_MASK)) {
            ctx.globalAlpha = 0.40
        }
        ctx.strokeStyle = "blue";
        ctx.setLineDash([3]);

        for (const [sid, stamp] of Object.entries(this.map.stamps)) {

            let rect1 = stamp.rect
            let rect2 = this._getStampShape(sid, stamp)

            let stamp_sheet = gAssets.themes["plains"].stamps[1]
            ctx.drawImage(stamp_sheet.image, 
                rect1.x*16, rect1.y*16, rect1.w*16, rect1.h*16,
                rect2.x, rect2.y, rect2.w, rect2.h)

            if (this.active_tool&EditorTool.STAMP_MASK) {
                ctx.beginPath()
                ctx.rect(rect2.x,rect2.y,rect2.w,rect2.h)
                ctx.stroke()
            }
        
        }
        ctx.restore()
    }

    _paint_objects(ctx) {
        ctx.save()

        if (!(this.active_tool&EditorTool.OBJECT_MASK)) {
            ctx.globalAlpha = 0.66
        }
        
        for (const [oid, obj] of Object.entries(this.map.objects)) {

            let y = 16*Math.floor(oid/512 - 4)
            let x = 16*(oid%512)


            //let objinfo = this.object_registry[obj.name]
            let entry = this.editor_objects[obj.name]

            // icon2 is a temporary hack
            // require a function (editor props) => icon
            // or default to icon

            if (!!entry?.editorRender) {
                entry.editorRender(ctx, x, y, obj.props)
            } else if (!!entry?.editorIcon) {
                entry.editorIcon(obj.props).draw(ctx, x, y)
            } else if (!!entry?.icon) {
                entry.icon.draw(ctx, x, y)
            }

            let w = entry.size[0]
            let h = entry.size[1]

            if (!!entry?.editorSchema) {
                let resizeable = entry.editorSchema && entry.editorSchema.some(schema => schema.control == EditorControl.RESIZE)

                if (resizeable) {
                    w = obj.props.width
                    h = obj.props.height
                }

                if (resizeable && this.active_tool === EditorTool.SELECT_OBJECT) {

                    //console.log(obj)
                    let r = 4;
                    ctx.fillStyle = "blue"
                    //ctx.setLineDash([]);
                    ctx.beginPath()
                    ctx.arc(x+8,y+8,r,0,2*Math.PI);
                    ctx.fill()
                    ctx.closePath()
                    ctx.beginPath()
                    ctx.arc(x+w-8,y+8,r,0,2*Math.PI);
                    ctx.fill()
                    ctx.closePath()
                    ctx.beginPath()
                    ctx.arc(x+8,y+h-8,r,0,2*Math.PI);
                    ctx.fill()
                    ctx.closePath()
                    ctx.beginPath()
                    ctx.arc(x+w-8,y+h-8,r,0,2*Math.PI);
                    ctx.fill()
                    ctx.closePath()

                }
            }

            if (this.active_tool&EditorTool.OBJECT_MASK) {
                ctx.beginPath()
                ctx.strokeStyle = "blue"
                ctx.setLineDash([3]);
                ctx.rect(x,y,w,h)
                ctx.closePath()
                ctx.stroke()
            }

        }
        ctx.restore()
    }

    paint(ctx) {

        const barHeight = 24

        ctx.strokeStyle = "#FF00FF";
        ctx.beginPath()
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.stroke()

        ctx.save()
        ctx.beginPath();
        ctx.rect(0, 0, gEngine.view.width, gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x, -(this.camera.y-barHeight))
        ctx.scale(1/this.camera.scale,1/this.camera.scale);

        this._paint_background(ctx)

        this._paint_tiles(ctx)

        this._paint_stamps(ctx)

        this._paint_objects(ctx)

        this._paint_grid(ctx)

        ctx.restore()

        this._paint_header(ctx)

        if (!!this.active_menu) {
            this.active_menu.paint(ctx)
        }

        if (!!this.active_palette) {
            this.active_palette.paint(ctx)
        }

        let r = 2
        ctx.fillStyle = "#aaaaaa77"
        this._touches.forEach(t => {

            ctx.beginPath()
            ctx.arc(t.x,t.y,r,0,2*Math.PI);
            ctx.closePath()
            ctx.fill()

        })


    }

    resize() {
    }

    _getTileDirection(x,y) {
        const tid = (y + 4)*512+x
        const ntid_u = ((y + 4-1)*512 + x)
        const ntid_d = ((y + 4+1)*512 + x)
        const ntid_l = ((y + 4)*512 + (x - 1))
        const ntid_r = ((y + 4)*512 + (x + 1))

        const exists_u = !!this.map.layers[0][ntid_u] && this.map.layers[0][ntid_u].property == this.tile_property
        const exists_d = !!this.map.layers[0][ntid_d] && this.map.layers[0][ntid_d].property == this.tile_property
        const exists_l = !!this.map.layers[0][ntid_l] && this.map.layers[0][ntid_l].property == this.tile_property
        const exists_r = !!this.map.layers[0][ntid_r] && this.map.layers[0][ntid_r].property == this.tile_property

        let d1 = Direction.NONE
        if (exists_d && !exists_u) {
            d1 = Direction.UP
        } else if (!exists_d && exists_u) {
            d1 = Direction.DOWN
        } else {
            d1 = random_choice([Direction.UP, Direction.DOWN])
        }

        // if the neighbor that exists is a onethird or twothird
        // and the current shape is of the opposite shape.
        // then this logic below should be inverted

        let d2 = Direction.NONE
        if (exists_l && !exists_r) {
            d2 = Direction.RIGHT
        } else if (!exists_l && exists_r) {
            d2 = Direction.LEFT
        } else {
            d2 = random_choice([Direction.LEFT, Direction.RIGHT])
        }

        let direction = d1|d2

        return direction
    }

    _updateTile(x, y) {
        // return true if the tile was updated.
        // update neighbors
        // loop until no more tiles are changed

        let queue = [[x,y]]

        let visited = {}
        while (queue.length > 0) {
            let [qx,qy] = queue.shift()
            const tid = (qy + 4)*512+qx

            if (!!visited[tid]) {
                continue
            }

            let delta = false
            if (!!this.map.layers[0][tid]) {
                visited[tid] = [qx,qy]
                delta = updateTile(this.map.layers[0], this.map.width, this.map.height, this.theme_sheets, qx, qy, this.map.layers[0][tid])
            } else {
                // special case, when deleting there is no tile, so update the neighbors
                if (qx==x && qy==y) {
                    delta = 1
                }   
            }

            if (delta) {
                queue.push([x-1, y])
                queue.push([x+1, y])
                queue.push([x, y-1])
                queue.push([x, y+1])

                queue.push([x-1, y-1])
                queue.push([x-1, y+1])
                queue.push([x+1, y-1])
                queue.push([x+1, y+1])

                queue.push([x-2, y])
                queue.push([x+2, y])
                queue.push([x, y-2])
                queue.push([x, y+2])

            }

        }
        this._x_visited_tiles = visited

    }

    _objectShape(oid, obj) {
        let entry = this.editor_objects[obj.name]
        let ox = 16*(oid%512)
        let oy = 16*Math.floor(oid/512 - 4)
        let ow = entry.size[0]
        let oh = entry.size[1]

        if (!!entry?.editorSchema) {
            if (entry.editorSchema.some(schema => schema.control == EditorControl.RESIZE)) {
                ow = obj.props.width
                oh = obj.props.height
            }
        }

        return new Rect(ox,oy,ow,oh)

    }

    _getObjectId(mx, my) {
        let oid = (my + 4)*512+mx

        // if there is no object directly under the mouse click
        // scan to find any objects which have a size greater than 1 tile.
        // and test to see if that object overlaps.
        if (!this.map.objects[oid]) {
            for (const [obj_oid, obj] of Object.entries(this.map.objects)) {
                
                let rect = this._objectShape(obj_oid, obj)

                if (rect.collidePoint(mx*16, my*16)) {
                    oid = obj_oid
                    break;
                    //}
                }
            }
        }

        return oid
    }

    _hydrateObject(oid, name, schemaList) {
        let props = {}
        let is_door = false
        for (let i=0; i < schemaList.length; i++) {
            if (schemaList[i].control == EditorControl.DOOR_ID) {
                is_door = true;
                break
            }
        }

        for (let i=0; i < schemaList.length; i++) {
            let schema = schemaList[i]

            if (schema.control == EditorControl.CHOICE) {
                props[schema.name] = schema['default']
            }

            if (schema.control == EditorControl.DOOR_TARGET) {
                props["target_world_id"] = "world_01"
                props["target_level_id"] = 1
                props["target_door_id"] = 1
            }

            // door id handled below

            if (schema.control == EditorControl.DIRECTION_4WAY) {
                props["direction"] = schema['default']
            }

            if (schema.control == EditorControl.TEXT) {
                props[schema['property']??"text"] = schema['default']??"default text"
            }

            if (schema.control == EditorControl.RESIZE) {
                props["width"] = schema['min_width'] ?? 1
                props["height"] = schema['min_height'] ?? 1
            }

            if (schema.control == EditorControl.RANGE) {
                props[schema.name] = schema['default']??(schema.min??0)
            }
        }

        if (is_door) {
            // determine the next available door id
            let door_id = -1
            let positions = {}

            Object.values(this.map.objects).forEach(ent => {
                positions[ent?.props?.door_id??0] = true
            })

            for (let i=1; i <= 8; i++) {
                if (!positions[i]) {
                    door_id = i
                    break
                }
            }

            if (door_id < 1) {
                console.log("two many doors")
                return false
            }

            if (is_door) {
                props.door_id = door_id
            }
        }

        const obj = {
            name: name,
        }

        if (schemaList.length > 0) {
            obj.props = props
        }

        console.log("place", obj)
        return obj
    }

    _getStampShape(stamp_oid, stamp) {
        let ox = 16*(stamp_oid%512)
        let oy = 16*Math.floor(stamp_oid/512 - 4)
        let rect = new Rect(ox,oy,stamp.rect.w*16, stamp.rect.h*16)
        return rect
    }

    _getStampId(mx, my) {
        let oid = (my + 4)*512+mx

        // if there is no object directly under the mouse click
        // scan to find any objects which have a size greater than 1 tile.
        // and test to see if that object overlaps.
        if (!this.map.stamps[oid]) {
            for (const [stamp_oid, stamp] of Object.entries(this.map.stamps)) {
                
                let rect = this._getStampShape(stamp_oid, stamp)

                if (rect.collidePoint(mx*16, my*16)) {
                    oid = stamp_oid
                    break;
                }
            }
        }

        return oid
    }

    moveObject(mx, my, pressed) {
        
        if (pressed) {
            // if there is no object directly under the mouse click
            // scan to find any objects which have a size greater than 1 tile.
            // and test to see if that object overlaps.
            let oid = this._getObjectId(mx, my)

            if (!!this.map.objects[oid]) {
                this.selected_object = this.map.objects[oid]
                this.selected_object.oid = oid

                let entry = this.editor_objects[this.selected_object.name]
                let resizeable = entry.editorSchema && entry.editorSchema.some(schema => schema.control == EditorControl.RESIZE)
                if (resizeable) {
                    let rect = this._objectShape(oid, this.selected_object)
                    let px = mx * 16;
                    let py = my * 16;


                    if (px < rect.left() + 16 && py < rect.top() + 16) {
                        this.selected_object_corner = Direction.UPLEFT
                    }
                    else if (px >= rect.right() - 16 && py < rect.top() + 16) {
                        this.selected_object_corner = Direction.UPRIGHT
                    }
                    else if (px < rect.left() + 16 && py >= rect.bottom() - 16) {
                        this.selected_object_corner = Direction.DOWNLEFT
                    }
                    else if (px >= rect.right() - 16 && py >= rect.bottom() - 16) {
                        this.selected_object_corner = Direction.DOWNRIGHT
                    } else {
                        this.selected_object_corner = Direction.NONE
                    }
                }
            } else {
                this.selected_object = null
            }
        } else {
            let oid = (my + 4)*512+mx

            // check to see if there is a selected object
            // and the current mouse position does not match the object position
            if (!!this.selected_object && this.selected_object.oid != oid) {

                let entry = this.editor_objects[this.selected_object.name]
                // select the resize schema
                let resizeable = entry.editorSchema && entry.editorSchema.filter(schema => schema.control == EditorControl.RESIZE)

                if (resizeable.length==1) {
                    let schema = resizeable[0]

                    let ox = 16*(oid%512)
                    let oy = 16*Math.floor(oid/512 - 4)

                    let rect = this._objectShape(this.selected_object.oid, this.selected_object)
                    let min_width = schema?.min_width??32;
                    let min_height = schema?.min_height??32;
                    if (this.selected_object_corner == Direction.UPLEFT) {
                        // else case on UPLEFT gives the special property 
                        // of moving the object without reszing when grabing
                        // only that corner
                        if (ox <= rect.right() - min_width) {
                            let r = rect.right()
                            let l = ox
                            rect.x = l
                            rect.w = Math.max(min_width, r - l)
                        } else { rect.x = ox }
                        if (oy <= rect.bottom() - min_height) {
                            let b = rect.bottom()
                            let t = oy
                            rect.y = t
                            console.log("!!", min_height, b - t)
                            rect.h = Math.max(min_height, b - t)
                        } else { rect.y = oy }
                    } else if (this.selected_object_corner == Direction.UPRIGHT) {
                        if ((ox+16) >= rect.left() + min_width) {
                            rect.w = Math.max(min_width, (ox+16) - rect.x)
                        } else { rect.x = ox }
                        if (oy <= rect.bottom() - min_height) {
                            let b = rect.bottom()
                            let t = oy
                            rect.y = t
                            rect.h = Math.max(min_height, b - t)
                        } else { rect.y = oy }
                    } else if (this.selected_object_corner == Direction.DOWNLEFT) {
                        if (ox <= rect.right() - min_width) {
                            let r = rect.right()
                            let l = ox
                            rect.x = l
                            rect.w = Math.max(min_width, r - l)
                        }

                        if ((oy+16) >= rect.top() + min_height) {
                            rect.h = Math.max(min_height, (oy+16) - rect.y)
                        }
                    } else if (this.selected_object_corner == Direction.DOWNRIGHT) {
                        if ((ox+16) >= rect.left() + min_width) {
                            rect.w = Math.max(min_width, (ox+16) - rect.x)
                        }
                        if ((oy+16) >= rect.top() + min_height) {
                            rect.h = Math.max(min_height, (oy+16) - rect.y)
                        }
                    } else {
                        console.log("resize object: invalid corner selected")
                    }

                    let new_oid = (Math.floor(rect.y/16)+4)*512 + Math.floor(rect.x/16)

                    if (rect.w != this.selected_object.props.width || 
                        this.selected_object.props.height != rect.h || 
                        new_oid != this.selected_object.oid) {

                        // update props
                        this.selected_object.props.width = rect.w
                        this.selected_object.props.height = rect.h

                        // update oid
                        
                        delete this.map.objects[this.selected_object.oid]
                        this.selected_object.oid = new_oid
                        this.map.objects[new_oid] = this.selected_object

                        return true

                    }

                } else {
                    // check that the new mouse position is empty
                    if (!this.map.objects[oid]) {
                        // move the object
                        delete this.map.objects[this.selected_object.oid]
                        this.selected_object.oid = oid
                        this.map.objects[oid] = this.selected_object
                        console.log("moved", oid)

                        return true
                    }
                }
            }
        }

        return false
    
        
    }

    editObject(mx, my) {
        const oid = this._getObjectId(mx, my)
        
        if (!!this.map.objects[oid]) {

            // move the camera so the object is within the 
            // view on the right half of the screen
            let x = 16*(oid%512)
            //let y = 16*Math.floor(oid/512 - 4)
            if (x < this.camera.x + gEngine.view.width / 2) {
                this.camera.x = x - gEngine.view.width/2
            }
            
            this.active_menu = new ObjectPropertyEditMenu(this, oid)
        }

    }

    eraseObject(mx, my, pressed) {
        const oid = this._getObjectId(mx, my)

        if (!!this.map.objects[oid]) {
            delete this.map.objects[oid]
            return true
        }
        return false
    }

    placeObject(x, y, pressed) {

        const oid = (y + 4)*512+x
        if (oid === this.previous_oid) {
            return false
        }
        this.previous_oid = oid

        if (!this.map.objects[oid]) {

            let obj = this.object_pages[this.objmenu_current_page].objects[this.objmenu_current_object]
            let entry = this.editor_objects[obj.name]
            let schemaList = (entry?.editorSchema??[])

            if (schemaList.length > 0 && pressed) {
                return false
            }

            this.map.objects[oid] = this._hydrateObject(oid, obj.name, schemaList)

            if (schemaList.length > 0) {
                this.active_menu = new ObjectPropertyEditMenu(this, oid)
            }

            return true
        }

        return false

    }

    _moveTiles(rect, dx, dy) {

        let cached = {}
        for (let i=rect.left(); i < rect.right(); i++) {
            for (let j=rect.top(); j < rect.bottom(); j++) {
                
                let tid1 = ((j) + 4)*512+i
                let tid2 = ((j+dy) + 4)*512+(i+dx)
                if (!!this.map.layers[0][tid1]) {
                    cached[tid2] = this.map.layers[0][tid1]
                    delete this.map.layers[0][tid1];
                }
            }
        }
        this.map.layers[0] = {...this.map.layers[0], ...cached}
        console.log("moved", Object.keys(cached).length)
        return Object.keys(cached).length > 0;
    }

    moveTile(mx, my, pressed) {

        if (pressed) {

            if (!!this.tile_selection && 
                !!this.tile_selection.rect && 
                this.tile_selection.rect.collidePoint(mx, my)) {
                this.tile_selection.update = false
                this.tile_selection.p3 = {x:mx, y:my}
            } else {
                this.tile_selection = {p1: {x:mx, y:my}, update: true}
            }

        } else if (!!this.tile_selection) {

            if (this.tile_selection.update) {
                // update selection size
                this.tile_selection.p2 = {x:mx, y:my}
                let p1 = this.tile_selection.p1
                let p2 = this.tile_selection.p2

                let x = Math.min(p1.x, p2.x)
                let y = Math.min(p1.y, p2.y)
                let w = Math.max(Math.abs(p1.x - p2.x)+1, 1)
                let h = Math.max(Math.abs(p1.y - p2.y)+1, 1)
                this.tile_selection.rect = new Rect(x,y,w,h)
            } else {
                // move

                let dx = mx - this.tile_selection.p3.x
                let dy = my - this.tile_selection.p3.y
                
                if (dx != 0 || dy != 0) {
                    

                    let rv = this._moveTiles(this.tile_selection.rect, dx, dy)

                    this.tile_selection.p3.x += dx
                    this.tile_selection.p3.y += dy
                    this.tile_selection.rect.x += dx;
                    this.tile_selection.rect.y += dy;

                    return rv;
                }
            }
        }

        return false;
    }

    eraseTile(x, y) {
        const tid = (y + 4)*512+x
        if (tid === this.previous_tid) {
            return false
        }
        this.previous_tid = tid

        if (!!this.map.layers[0][tid]) {

            // erase the tile
            if (this.active_tool == EditorTool.ERASE_TILE) {
                delete this.map.layers[0][tid]

                this._updateTile(x,y)

                return true
            }

        }
        return false
    }

    placeTile(x, y) {

        const tid = (y + 4)*512+x
        if (tid === this.previous_tid) {
            return false
        }
        this.previous_tid = tid

        if (!!this.map.layers[0][tid]) {

            if (this.active_tool == EditorTool.PAINT_TILE) {
                this.map.layers[0][tid].property = this.tile_property
                this.map.layers[0][tid].sheet = this.tile_sheet
                return true
            }

            // rotate the tile or change the property
            if (this.map.layers[0][tid].shape == this.tile_shape) {

                // tool 3 changes props and sheet only
                const d = [Direction.UPRIGHT,Direction.DOWNRIGHT,Direction.DOWNLEFT,Direction.UPLEFT]
                if (this.tile_shape > 1) {
                    this.map.layers[0][tid].direction = d[(d.indexOf(this.map.layers[0][tid].direction) + 1) % 4]
                }

                this.map.layers[0][tid].property = this.tile_property
                this.map.layers[0][tid].sheet = this.tile_sheet

                this._updateTile(x,y)
                return true
            }
        }

        // if not placing exit
        if (this.active_tool != EditorTool.PLACE_TILE) {
            return false
        }

        if (this.tile_shape == 1) {
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 2) {
            let direction = this._getTileDirection(x, y)
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                direction: direction,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 3) {
            let direction = this._getTileDirection(x, y)
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                direction: direction,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 4) {
            let direction = this._getTileDirection(x, y)
            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                direction: direction,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }
        } else if (this.tile_shape == 5) {

            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }

        } else if (this.tile_shape == 7) {

            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }

        }

        this._updateTile(x,y)
        return true
    }

    placeStamp(mx, my, pressed) {
        const sid = (my + 4)*512+mx
        this.map.stamps[sid] = {...this.stampmenu_stamp}
        return true
    }

    eraseStamp(mx, my) {
        const sid = this._getStampId(mx, my)

        if (!!this.map.stamps[sid]) {
            delete this.map.stamps[sid]
            return true
        }
        return false
    }

    moveStamp(mx, my, pressed) {
    
        if (pressed) {
            // if there is no object directly under the mouse click
            // scan to find any objects which have a size greater than 1 tile.
            // and test to see if that object overlaps.
            let sid = this._getStampId(mx, my)

            if (!!this.map.stamps[sid]) {
                this.selected_stamp = sid
            } else {
                this.selected_stamp = null
            }
            console.log("moveStamp", this.selected_stamp)

        } else {
            let sid = (my + 4)*512+mx

            // check to see if there is a selected object
            // and the current mouse position does not match the object position
            if (this.selected_stamp != null && this.selected_stamp != sid) {

                // check that the new mouse position is empty
                if (!this.map.stamps[sid]) {
                    // move the stamp
                    let tmp = this.map.stamps[this.selected_stamp]
                    delete this.map.stamps[this.selected_stamp]
                    this.map.stamps[sid] = tmp
                    this.selected_stamp = sid
                    return true
                }
            }
        }

        return false
    
        
    }

    _scroll(dx, dy) {

        //this.camera.x = this.mouse_down.camerax + dx
        //this.camera.y = this.mouse_down.cameray + dy

        this.camera.x += dx
        this.camera.y += dy


        // this is arbitrary
        // restrict the field of view to always display at least 4 tiles
        this.camera.x = Math.max(-(gEngine.view.width - 64/this.camera.scale), this.camera.x)
        this.camera.x = Math.min((this.map.width - 64)/this.camera.scale, this.camera.x)


        this.camera.y = Math.max(-(gEngine.view.height-24 ), this.camera.y)
        this.camera.y = Math.min((this.map.height - 64)/this.camera.scale, this.camera.y)

    }

    _zoom_in() {
        if (this.camera.scale > 0.5) {
            gAssets.sounds.click1.play()
            // comput the transform to zoom in/out at a point px,py
            let px = gEngine.view.width/2
            let py = gEngine.view.height/2
            let cx = (this.camera.x + px) * this.camera.scale
            let cy = (this.camera.y + py) * this.camera.scale

            this.camera.scale = Math.max(0.5, this.camera.scale - 0.5)

            this.camera.x = (cx / this.camera.scale) - px
            this.camera.y = (cy / this.camera.scale) - py

            this.camera.x = Math.max(-(gEngine.view.width - 64/this.camera.scale), this.camera.x)
            this.camera.x = Math.min((this.map.width - 64)/this.camera.scale, this.camera.x)
            this.camera.y = Math.max(-(gEngine.view.height-24 ), this.camera.y)
            this.camera.y = Math.min((this.map.height - 64)/this.camera.scale, this.camera.y)
        } else {
            gAssets.sounds.click2.play()
        }
    }

    _zoom_out() {
        if (this.camera.scale < 4) {
            gAssets.sounds.click1.play()
            // comput the transform to zoom in/out at a point px,py
            let px = gEngine.view.width/2
            let py = gEngine.view.height/2
            let cx = (this.camera.x + px) * this.camera.scale
            let cy = (this.camera.y + py) * this.camera.scale

            this.camera.scale = Math.min(4.0, this.camera.scale + 0.5)

            this.camera.x = (cx / this.camera.scale) - px
            this.camera.y = (cy / this.camera.scale) - py

            this.camera.x = Math.max(-(gEngine.view.width - 64/this.camera.scale), this.camera.x)
            this.camera.x = Math.min((this.map.width - 64)/this.camera.scale, this.camera.x)
            this.camera.y = Math.max(-(gEngine.view.height-24 ), this.camera.y)
            this.camera.y = Math.min((this.map.height - 64)/this.camera.scale, this.camera.y)

            // max 0
            // min this.map.width
            // rhs: (this.camera.x + gEngine.view.width) * this.camera.scale
            // lhs: this.camera.x

            //this.camera.x -= (24 * 16)/this.camera.scale/2
        } else {
            gAssets.sounds.click2.play()
        }
    }

    _serialize_objects() {

        // use objects with empty names as placeholders, to prevent dragging
        // or creating new objects ontop of other objects. filter these out
        // when saving
      

        const objects = Object.entries(this.map.objects)
            .filter( t => !!t[1].name )
            .map(t => {
                let obj = {oid: +t[0], name: t[1].name}
                if (Object.hasOwn(t[1], 'props') && Object.keys(t[1].props).length > 0) {
                    obj.props = t[1].props
                }
                return obj
            })

        return objects
    }

    _serialize_stamps() {
        // "rect":{"x":255,"x":255,"x":255,"x":255}
        // "rect":0xFFFFFFFF
        // "rect":4294967295

        const stamps = Object.entries(this.map.stamps).map(t => serialize_stamp(+t[0], t[1]))
        return stamps
    }

    playTest() {

        //gAssets.mapinfo.mapurl = "editor-playtest"

        // push the new url to the history
        history.pushState({}, "test map", `?mapid=${this.current_map_id}&edit=false`);

        gAssets.mapinfo.width = this.map.width
        gAssets.mapinfo.height = this.map.height
        gAssets.mapinfo.theme = this.current_theme

        gAssets.mapinfo.layers = this.map.layers

        gAssets.mapinfo.objects = this._serialize_objects()

        gAssets.mapinfo.stamps = this._serialize_stamps()

        gCharacterInfo.current_health = gCharacterInfo.max_health
        
        const edit = false
        console.log("playtest", gAssets.mapinfo.mapurl)
        gEngine.scene = new LevelLoaderScene(gAssets.mapinfo.mapurl, edit, ()=>{
            gEngine.scene = new LevelLoaderScene.scenes.main()
        })

    }

    saveAs() {

        // compress each tile into a 32bit integer
        // 1 bit, the sign bit, is unused
        const tiles0 = Object.entries(this.map.layers[0]).map((t) => serialize_tile(t[0], t[1]))

        const map = {
            version: 0,
            width: this.map.width,
            height: this.map.height,
            theme: this.current_theme,
            layers: [tiles0],
            objects: this._serialize_objects(),
            stamps: this._serialize_stamps()
        }

        let date = new Date()
        let y = "" + date.getFullYear()
        let m = "" + (1 + date.getMonth())
        if (m.length < 2) { m = "0"+m; }
        let d = "" + date.getDate()
        if (d.length < 2) { d = "0"+d; }
        let H = "" + date.getHours()
        if (H.length < 2) { H = "0"+H; }
        let M = "" + date.getMinutes()
        if (M.length < 2) { M = "0"+M; }
        let S = "" + date.getSeconds()
        if (S.length < 2) { S = "0"+S; }

        let tw = Math.floor(this.map.width/24/16)
        let th = Math.floor(this.map.height/14/16)

        let fname = "map-" + tw + "x" + th + "-" + y+m+d+"-"+H+M+S + ".json"

        if (daedalus.env.debug) {
            // save the file using the webserver
            console.log("save: " + gAssets.mapinfo.mapurl)
            post_map_level(gAssets.mapinfo.mapurl, map)
        } else {
            // download the file in release mode
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(map));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href",     dataStr);
            downloadAnchorNode.setAttribute("download", fname);
            downloadAnchorNode.setAttribute("target", "_blank");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

    }

    historyPush(change_tile, change_object, change_stamp) {

        // remove old entries that were discarded by the user
        while (this.history_index > 0) {
            this.history.pop()
            this.history_index -= 1
        }

        // use json to easily create an immutable structure
        // only save the layer or set of objects that were changed
        let event = {}

        // for now both tiles and objects must be saved
        // in the future to save memory only save the thing that changed
        // and have a pointer to the last saved state for other layers or
        // unchanged objects
        // if the history is [tile, object, tile]
        // an undo should effectivley go back to the previous tile state
        // maybe it needs separate history streams?
        if (change_tile || change_object || change_stamp) {
            event.layer_id = 0
            event.layer = JSON.stringify(this.map.layers[0])
            event.objects = JSON.stringify(this.map.objects)
            event.stamps = JSON.stringify(this.map.stamps)
        }

        this.history.push(event)

        // enforce maximum number of entries
        while (this.history.length > this.history_max_entries) {
            this.history.shift()
        }

        // log the size
        let history_size = this.history.map(h => (h?.layer??"").length + (h?.objects??"").length).reduce((a,b)=>a+b,0)
        console.log(`history push index=${this.history_index} num_entries=${this.history.length} size=${(history_size/1024).toFixed(1)}kb`)

    }

    historyPop() {
        // history_index always points at the most recent event
        // a pop should apply the previous state
        // an unpop should reapply the most recently popped state

        if (this.history_index < this.history.length-1) {
            this.history_index += 1
            let idx = (this.history.length - 1) - this.history_index
            console.log("history pop", idx, this.history.length, this.history_index)
            this._historyApplyIndex(idx)
            gAssets.sounds.click1.play()
        } else {
            gAssets.sounds.click2.play()
        }
    }

    historyUnPop() {

        if (this.history_index > 0) {
            this.history_index -= 1
            let idx = (this.history.length - 1) - this.history_index
            console.log("history unpop", idx, this.history.length, this.history_index)
            this._historyApplyIndex(idx)
            gAssets.sounds.click1.play()
        } else {
            gAssets.sounds.click2.play()
        }
    }

    _historyApplyIndex(idx) {
        if (idx >= 0 && idx < this.history.length) {
            console.log("history apply event ", idx, this.history.length)
            let event = this.history[idx]

            if (Object.hasOwn(event, 'layer_id')) {
                console.log("history apply tiles")
                this.map.layers[event.layer_id] = JSON.parse(event.layer)
            }

            if (Object.hasOwn(event, 'objects')) {
                console.log("history apply object")
                this.map.objects = JSON.parse(event.objects)
            }

            if (Object.hasOwn(event, 'stamps')) {
                console.log("history apply stamps")
                this.map.stamps = JSON.parse(event.stamps)
            }

        } else {
            console.log("history index out of bounds")
        }
    }

    handleTouches(touches) {
        this._touches = touches

        if (touches.length > 0) {
            // transform the touch into a tile index

            // process the palette first
            // if not interacted with, continue with the rest of the logic
            if (!!this.active_palette) {
                if (this.active_palette.handleTouches(touches)) {
                    console.log("skip")
                    return
                }
            }
            // 

            if (touches[0].y < 24) {
                let t = touches[0]

                // buttons are 18x18 pixels.
                // with 6 pixels between buttons
                //
                let ix = Math.floor((t.x - 3) / 24)
                let iclicked = ((t.x - 3) % 24) < 18

                if (!t.pressed) {

                    if (!!this.active_menu) {
                        this.active_menu = null
                    } else {
                        if (ix >= 0 && ix < this.actions.length) {
                            if (!!this.actions[ix].action) {
                                this.actions[ix].action()
                            }
                        }
                    }
                }


            } else if (!!this.active_menu) {

                this.active_menu.handleTouches(touches)

            } else {

                

                // right click or two touches to pan
                // TODO: middle click to toggle zoom?
                // TODO: don't place tiles  on the first click, wait for two touches
                //       disable placing tiles if two touches occur

                // for devices that support multi touch, disable placing tiles when
                // there is more than one touch. wait for the next single touch
                // to re-enable placing tiles
                // this requires placing tiles on release or drag
                if (touches.length > 1) {
                    this.disable_place = true
                }
                if (this.disable_place && touches.length == 1) {
                    if (touches[0].first && touches[0].pressed) {
                        this.disable_place = false
                    }
                }
                //this.num_touches = this.disable_place + "|" +touches.map(t=> t.pressed).join()

                if (touches[0].buttons&4) {
                    // mouse  wheel
                    if (touches[0].ctrlKey) {
                        if (touches[0].deltaY > 0) {
                            this._zoom_in()
                        } else {    
                            this._zoom_out()
                        }
                    } else {

                        let m = 32 / this.camera.scale
                        
                        // snap to a 2x2 tile grid
                        this.camera.x = Math.round(this.camera.x / m) * m
                        this.camera.y = Math.round(this.camera.y / m) * m

                        // mouse wheel scrolls 2 tiles per tick
                        let dx = -Math.sign(touches[0].deltaX) * m
                        let dy = -Math.sign(touches[0].deltaY) * m

                        this._scroll(dx, dy)
                    }

                } else if (touches[0].buttons&2 || touches.length==2) {
                    // right click or two touches to scroll the screen

                    let t = touches[0]
                    if (touches.length == 2) {
                        t = {
                            x: (touches[0].x + touches[1].x)/2,
                            y: (touches[0].y + touches[1].y)/2,
                            pressed: t.pressed,
                            first: t.first,
                        }
                    }

                    if (t.pressed && t.first) {
                        this.mouse_down = {x:t.x, y:t.y, camerax:this.camera.x, cameray:this.camera.y}
                    } else if (t.pressed) {
                        let dx = (this.mouse_down.x - t.x) // this.camera.scale
                        let dy = (this.mouse_down.y - t.y) // this.camera.scale

                        dx = (this.mouse_down.camerax + dx) - this.camera.x
                        dy = (this.mouse_down.cameray + dy) - this.camera.y

                        this._scroll(dx, dy)
                    }


            } else if (!this.disable_place) {

                    //if (touches[0].first) {
                    //    return
                    //}

                    let gs = 16 / this.camera.scale
                    touches = touches.map(t => ({
                        x: Math.floor((t.x + this.camera.x) / gs),
                        y: Math.floor((t.y + this.camera.y - 24) / gs),
                        pressed: t.pressed,
                        first: t.first
                    }))


                    // TODO: if two touches pan. use the center between the two touches as the single point
                    //       pinch to zoom. if the distance between two touches shrinks or grows past a threshold
                    //       change the scale to either 1 or 2.
                    const t = touches[0]

                    let change_tile = false
                    let change_object = false
                    let change_stamp = false
                    if (t.y >= -this.ygutter/16 && t.x >= 0 && t.x < this.map.width/16 && t.y < this.map.height/16) {

                        

                        
                        if (this.active_tool === EditorTool.PLACE_OBJECT) {
                            if (!t.first) {
                                change_object = this.placeObject(t.x, t.y,t.pressed)
                            }

                        }

                        else if (this.active_tool === EditorTool.ERASE_OBJECT) {
                            if (!t.first) {
                                change_object = this.eraseObject(t.x, t.y)
                            }

                        }

                        else if (this.active_tool === EditorTool.SELECT_OBJECT) {
                            // first touch required to select the object to drag
                            change_object = this.moveObject(t.x, t.y, t.first)
                        }

                        else if (this.active_tool === EditorTool.EDIT_OBJECT) {
                            // TODO: change object event occurs when the menu is closed!
                            if (!t.first) {
                                this.editObject(t.x, t.y)
                                
                            }
                        }

                        else if (this.active_tool === EditorTool.PLACE_STAMP) {
                            if (!t.first) {
                                change_stamp = this.placeStamp(t.x, t.y,t.pressed)
                            }
                        }

                        else if (this.active_tool === EditorTool.ERASE_STAMP) {
                            if (!t.first) {
                                change_stamp = this.eraseStamp(t.x, t.y)
                            }
                        }

                        else if (this.active_tool === EditorTool.SELECT_STAMP) {
                            change_stamp = this.moveStamp(t.x, t.y, t.first)
                        }

                        else if (this.active_tool === EditorTool.PLACE_TILE || this.active_tool === EditorTool.PAINT_TILE) {
                            if (!t.first) {
                                change_tile = this.placeTile(t.x, t.y)
                            }

                        }
                        else if (this.active_tool === EditorTool.ERASE_TILE) {
                            if (!t.first) {
                                change_tile = this.eraseTile(t.x, t.y)
                            }

                        }
                        else if (this.active_tool === EditorTool.SELECT_TILE) {
                            // first touch required to select the object to drag
                            change_tile = this.moveTile(t.x, t.y, t.first)
                        }

                    }

                    if (!t.pressed) {
                        this.previous_tid = -1
                        this.previous_oid = -1
                    }

                    this.change_tile = this.change_tile||change_tile
                    this.change_object = this.change_object||change_object
                    this.change_stamp = this.change_stamp||change_stamp

                    // push a history state on touch release
                    if (!t.pressed && (this.change_tile || this.change_object || this.change_stamp)) {

                        this.historyPush(this.change_tile, this.change_object, this.change_stamp)

                        // TODO: do something with this.map.layers[0] and this.map.objects
                        // if there was a change to either, push a history state
                        this.change_tile = false //reset
                        this.change_object = false //reset
                        this.change_stamp = false //reset
                    }
                }
            }
        }
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {
        //this.camera.scale = (this.camera.scale==1)?2:1

        if (keyevent.keyCode == 38) {
            //up
            this.camera.y -= 8
        } else if (keyevent.keyCode == 40) {
            //down
            this.camera.y += 8
        } else if (keyevent.keyCode == 37) {
            //left
            this.camera.x -= 8
        } else if (keyevent.keyCode == 39) {
            //right
            this.camera.x += 8
        } else if (keyevent.text == '1') {
            this.active_tool = EditorTool.PLACE_TILE
            this.tile_shape = TileShape.FULL
        } else if (keyevent.text == '2') {
            this.active_tool = EditorTool.PLACE_TILE
            this.tile_shape = TileShape.HALF
        } else if (keyevent.text == '3') {
            this.active_tool = EditorTool.PLACE_TILE
            this.tile_shape = TileShape.ONETHIRD
        } else if (keyevent.text == '4') {
            this.active_tool = EditorTool.PLACE_TILE
            this.tile_shape = TileShape.TWOTHIRD
        } else if (keyevent.text == '5') {
            this.active_tool = EditorTool.PLACE_TILE
            this.tile_shape = TileShape.ALT_FULL
        } else if (keyevent.text == '6') {
            this.active_tool = EditorTool.PLACE_TILE
            this.tile_shape = TileShape.PIPE
        } else if (keyevent.text == 's') {
            this.tile_property += 1
            if (this.tile_property >= TileProperty.ICE) {
                this.tile_property = TileProperty.SOLID
            }
        } else if (keyevent.text == 'd') {
            this.parent.tile_sheet += 1
            if (this.parent.tile_sheet >= this.parent.theme_sheets.length) {
                this.parent.tile_sheet = 1
            }
        } else if (keyevent.text == 'q') {
            this.active_tool = EditorTool.PLACE_TILE
        } else if (keyevent.text == 'w') {
            this.active_tool = EditorTool.PAINT_TILE
        } else if (keyevent.text == 'e') {
            this.active_tool = EditorTool.ERASE_TILE
        } else if (keyevent.text == 'r') {
            this.active_tool = EditorTool.SELECT_TILE
        } else {
            console.log(keyevent)
        }

    }

}