 
// todo: implement stamps as objects
//       stamps are special tiles that can be any size or shape
//       during chunking, they are painted on top of layer zero
//       after all other tiles are painted.

// todo: keyboad controls
//       activate a fake cursor object which simulates touch events
//       arrow keys move the cursor. primary fire button clicks
//       hide when there is a real mouse event

$import("daedalus", {})

$import("axertc_client", {
    ApplicationBase, GameScene, RealTimeClient,
    WidgetGroup, ButtonWidget,
    ArrowButtonWidget, TouchInput, KeyboardInput

})
$import("axertc_common", {
    CspMap, ClientCspMap, ServerCspMap, fmtTime
    Direction, Alignment, Rect,
})

$import("axertc_physics", {
    Physics2dPlatform, PlatformerEntity, Wall, Slope, OneWayWall,
    AnimationComponent
})

$import("store", {MapInfo, gAssets})

$import("tiles", {TileShape, TileProperty, updateTile, paintTile})
$import("entities", {editorEntities, EditorControl})
$import("maps", {PlatformMap})
$import("api", {post_map_level})


function random_choice(choices) {
  let index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

const EditorTool = {}
EditorTool.PLACE_TILE = 1
EditorTool.ERASE_TILE = 2
EditorTool.PAINT_TILE = 3
EditorTool.SELECT_TILE = 4
EditorTool.PLACE_OBJECT = 5
EditorTool.ERASE_OBJECT = 6
EditorTool.SELECT_OBJECT = 7
EditorTool.EDIT_OBJECT = 8


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
                if (tx < 6) {
                    this.parent.tile_property = 1 + tx
                    console.log("set prop", 1 + tx)
                    if (this.parent.tile_property > 4) {
                        this.parent.tile_shape = 1
                    }
                    if (this.parent.tile_property > 4) {
                        this.parent.tile_sheet = 1
                    }

                }

            }
            else if (ty == 2) {
                if (tx < 4) {
                    if (this.parent.tile_property <= 4) {
                        this.parent.tile_shape = 1 + tx
                        console.log("set shape", 1 + tx)
                    }
                    this.parent.active_tool = EditorTool.PLACE_TILE
                    this.parent.active_menu = null
                } else if (tx  == 4) {
                    this.parent.tile_shape = 7 // alt full

                }
                console.log(tx)



            }
            else if (ty == 3) {

                if (tx == 0) {
                    this.parent.active_tool = EditorTool.PAINT_TILE
                    this.parent.active_menu = null
                }

                if (tx == 1) {
                    this.parent.active_tool = EditorTool.ERASE_TILE
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

        // ---------------------------------------------------------------
        // Row 4 Shape
        ctx.fillStyle = "#000000"
        x = 8
        y = 32 + 24 + 24 + 24

        this.parent.editor_icons.brush.draw(ctx, x, y)

        x += 24
        this.parent.editor_icons.erase.draw(ctx, x, y)
        //points = this.parent.slopes_twothird[Direction.UPRIGHT]
        //ctx.beginPath();
        //ctx.moveTo(x + points[0].x, y + points[0].y);
        //points.slice(1).forEach(p => ctx.lineTo(x+p.x,y+p.y))
        //ctx.fill()



    }
}

class SettingsMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 5, 8 + 24 * 3)
        this.parent = parent

        this.actions = []

        let x = this.rect.x + 8
        let y = this.rect.y + 8

        this.themes = Object.keys(gAssets.themes)
        this.theme_index =  this.themes.indexOf(this.parent.current_theme)

        this.actions.push({x:x+2*24,y,icon:this.parent.editor_icons.arrow_left, action: ()=>{
            this.changeMapSize(-1, 0)
        }})
        this.actions.push({x:x+3*24,y,render: (ctx,x,y)=>{ctx.fillText(`${Math.floor(this.parent.map.width / 16 / 24)}`, x+8,y+8)}})
        this.actions.push({x:x+4*24,y,icon:this.parent.editor_icons.arrow_right, action: ()=>{
            this.changeMapSize(1, 0)
        }})

        y += 24
        this.actions.push({x:x+2*24,y,icon:this.parent.editor_icons.arrow_left, action: ()=>{
            this.changeMapSize(0, -1)
        }})
        this.actions.push({x:x+3*24,y,render: (ctx,x,y)=>{ctx.fillText(`${Math.floor(this.parent.map.height / 16 / 14)}`, x+8,y+8)}})
        this.actions.push({x:x+4*24,y,icon:this.parent.editor_icons.arrow_right, action: ()=>{
            this.changeMapSize(0, 1)
        }})

        y += 24
        this.actions.push({x:x+2*24,y,icon:this.parent.editor_icons.arrow_left, action: ()=>{
            this.changeTheme(-1)
        }})
        this.actions.push({x:x+3*24,y,render: (ctx,x,y)=>{ctx.fillText(this.themes[this.theme_index], x+8,y+8)}})
        this.actions.push({x:x+4*24,y,icon:this.parent.editor_icons.arrow_right, action: ()=>{
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

class ObjectMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 6, 8 + 24 * 5)
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

            if (tx > 0) {
                tx -= 1
                let n = ty * 4 + tx

                if (n < this.parent.object_pages[this.parent.objmenu_current_page].objects.length) {
                    this.parent.objmenu_current_object = n
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

        ctx.beginPath();
        ctx.moveTo(8+18+2,this.rect.y)
        ctx.lineTo(8+18+2,this.rect.y + this.rect.h)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        let x = 8
        let y = 32



        ctx.fillStyle = "#0000FF"

        // headers
        x = 8
        y = 32
        for (let j=0; j < 3; j++) {

            if (this.parent.objmenu_current_page == j) {
                ctx.beginPath()
                ctx.strokeStyle = "gold"
                ctx.roundRect(x-2,y-2,16+4,16+4, 4)
                ctx.closePath()
                ctx.stroke()
            }

            ctx.beginPath()
            ctx.rect(x,y,16,16)
            ctx.closePath()
            ctx.fill()
            y += 24
        }

        // header scroll
        x = 8
        y = 32 + 24*3
        this.parent.editor_icons.arrow_up.draw(ctx, x,y)
        y += 24
        this.parent.editor_icons.arrow_down.draw(ctx, x,y)

        // object info
        x = 8
        y = 32

        const page = this.parent.object_pages[this.parent.objmenu_current_page]

        let n = 0;
        for (let j=0; j < 5; j++) {

            x = 8 + 24

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

                if (page.objects[n]?.ctor?.icon) {
                    let icon = page.objects[n]?.ctor?.icon
                    icon.draw(ctx, x, y)
                }

                x += 24
                n += 1
            }

            y += 24
        }

        // object scroll
        x = 8 + 24*5
        y = 32
        this.parent.editor_icons.arrow_up.draw(ctx, x,y)

        y += 24 * 4
        this.parent.editor_icons.arrow_down.draw(ctx, x,y)


    }

}

class ObjectEditMenu {
    constructor(parent) {

        this.rect = new Rect(0,24,8 + 24 * 1, 8 + 24 * 3)
        this.parent = parent

        this.actions = []

        let x = this.rect.x + 8
        let y = this.rect.y + 8

        this.actions.push({x,y,icon:this.parent.editor_icons.hand, action: ()=>{
            this.parent.active_tool = EditorTool.SELECT_OBJECT
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({x,y,icon:this.parent.editor_icons.erase, action: ()=>{
            this.parent.active_tool = EditorTool.ERASE_OBJECT
            this.parent.active_menu = null
        }})

        y += 24

        this.actions.push({x,y,icon:this.parent.editor_icons.pencil, action: ()=>{
            this.parent.active_tool = EditorTool.EDIT_OBJECT
            this.parent.active_menu = null
        }})


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

        //let k = (this.parent.tile_property - 1)
        //ctx.beginPath();
        //ctx.strokeStyle = "gold"
        //ctx.roundRect(x + k*24 - 2,y - 2,16+4,16+4, 4)
        //ctx.stroke()
        //ctx.fillStyle = "#0000FF"
        //for (let j=0; j < 3; j++) {
        //    x = 8 + 24*2
        //    for (let i=0; i < 3; i++) {
        //        ctx.beginPath()
        //        ctx.rect(x,y,16,16)
        //        ctx.closePath()
        //        ctx.fill()
        //        x += 24
        //    }
        //    y += 24
        //}

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
        let ctor = this.parent.editor_objects[obj.name]
        this.schemaList = (ctor?.editorSchema??[])

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

                if (schema.control == EditorControl.DIRECTION_4WAY) {
                    this.addChoiceWidget({
                        "name": "direction",
                        "default": schema['default'],
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

    addChoiceWidget(schema) {

        // title case the name
        let name = schema.name.replaceAll("_", " ")
            .split(" ") \
            .map(s => s.charAt(0).toUpperCase() + s.slice(1)) \
            .join(" ")

        let options = null
        let option_index = 0
        console.log("!!", schema.choices)
        if (!Array.isArray(schema.choices)) {
            options = Object.entries(schema.choices)
            option_index = 0
        } else {
            options = Object.entries(schema.choices)
            option_index = 1
        }
        console.log("!!", options)
        console.log("!!", option_index)

        let obj = this.parent.map.objects[this.oid]

        // TODO: fix objects when loading? delete malformed object when loading?
        if (!Object.hasOwn(obj, 'props')) {
            obj.props = {}
            obj.props[schema.name] = schema['default']
        }

        // determine the initial index
        // use the current object property, or set form the schema
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

export class LevelEditScene extends GameScene {

    // TODO: optimize: only do a full paint if something changed
    //       change the engine to not clear on every frame
    //       scene is still 60fps. but there are no animations

    constructor() {
        super()

        this.history = []
        this.history_index = 0

        this.camera = {x:-48, y:-48, scale:2}
        this.map = {
            width: 15*32,
            height: 9*32,
            layers: [{}],
            objects: {}
        }

        gAssets.mapinfo.objects.forEach(obj => {
            if (!this.map.objects[obj.oid]) {
                this.map.objects[obj.oid] = obj
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
            "brush": gAssets.sheets.editor.tile(5),
            "arrow_up": gAssets.sheets.editor.tile(6),
            "arrow_down": gAssets.sheets.editor.tile(7),
            "arrow_left": gAssets.sheets.editor.tile(1*8+6),
            "arrow_right": gAssets.sheets.editor.tile(1*8+7),

            "save": gAssets.sheets.editor.tile(1*8+0),
            "load": gAssets.sheets.editor.tile(1*8+1),
            "trash": gAssets.sheets.editor.tile(1*8+2),
            "gear": gAssets.sheets.editor.tile(1*8+3),
            "hand": gAssets.sheets.editor.tile(1*8+5),
            "pointer": gAssets.sheets.editor.tile(2*8+1),
            "play": gAssets.sheets.editor.tile(2*8+0),
            "undo": gAssets.sheets.editor.tile(2*8+6),
            "redo": gAssets.sheets.editor.tile(2*8+7),
            "exit": gAssets.sheets.editor.tile(2*8+3),
        }

        this.editor_objects = Object.fromEntries(editorEntities.map(x=>[x.name,x.ctor]))

        this.object_pages = [

            {
                icon: gAssets.sheets.editor.tile(1),
                objects: [...editorEntities]
            },
        ]
        this.objmenu_current_page = 0
        this.objmenu_current_object = 0
        this.objmenu_page_scroll_index = 0
        this.objmenu_object_scroll_index = 0

        this.actions = [
            {
                name: "file",
                icon: this.editor_icons.save,
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_menu = new FileMenu(this)
                },
                selected: null,
            },
            {
                name: "settings",
                icon: this.editor_icons.gear,
                action: () => {
                    gAssets.sounds.click1.play()
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
                name: "object-place",
                icon: this.editor_icons.hand,
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_tool = EditorTool.PLACE_OBJECT;
                    this.active_menu = new ObjectMenu(this)
                },
                selected: () => this.active_tool == EditorTool.PLACE_OBJECT,
            },
            {
                name: "object-move",
                icon2: ()=> {return (this.active_tool == EditorTool.ERASE_OBJECT)?this.editor_icons.erase:this.editor_icons.hand},
                action: () => {
                    gAssets.sounds.click1.play()
                    //this.active_tool = EditorTool.SELECT_OBJECT;
                    //this.active_menu = new ObjectMenu(this)
                    this.active_menu = new ObjectEditMenu(this)
                },
                selected: () => this.active_tool == EditorTool.SELECT_OBJECT || this.active_tool == EditorTool.ERASE_OBJECT || this.active_tool == EditorTool.EDIT_OBJECT,
            },
            {
                name: "tile-place",
                icon: this.editor_icons.hand,
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_tool = EditorTool.PLACE_TILE;
                    this.active_menu = new TileMenu(this)
                },
                selected: () => {
                    return [EditorTool.PLACE_TILE,EditorTool.ERASE_TILE,EditorTool.PAINT_TILE].indexOf(this.active_tool) >= 0
                }
            },
            {
                name: "tile-select",
                icon: this.editor_icons.pointer,
                action: () => {
                    gAssets.sounds.click1.play()
                    this.active_tool = EditorTool.SELECT_TILE;
                    //this.active_menu = new TileMenu(this)
                },
                selected: () => this.active_tool == EditorTool.SELECT_TILE,
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
                action: () => {

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
                },
                selected: null,
            },
            {
                name: "zoom-in",
                icon: this.editor_icons.zoom_in,
                action: () => {
                    if (this.camera.scale > 1.0) {
                        gAssets.sounds.click1.play()
                        // comput the transform to zoom in/out at a point px,py
                        let px = gEngine.view.width/2
                        let py = gEngine.view.height/2
                        let cx = (this.camera.x + px) * this.camera.scale
                        let cy = (this.camera.y + py) * this.camera.scale

                        this.camera.scale = Math.max(1.0, this.camera.scale - 0.5)

                        this.camera.x = (cx / this.camera.scale) - px
                        this.camera.y = (cy / this.camera.scale) - py

                        this.camera.x = Math.max(-(gEngine.view.width - 64/this.camera.scale), this.camera.x)
                        this.camera.x = Math.min((this.map.width - 64)/this.camera.scale, this.camera.x)
                        this.camera.y = Math.max(-(gEngine.view.height-24 ), this.camera.y)
                        this.camera.y = Math.min((this.map.height - 64)/this.camera.scale, this.camera.y)
                    } else {
                        gAssets.sounds.click2.play()
                    }
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

        this.ygutter = 64

        // init history to the current state
        this.historyPush(true, true)
    }

    setTileTheme(theme) {
        this.current_theme = theme
        this.theme_sheets = gAssets.themes[theme]
        this.theme_sheets_icon = this.theme_sheets.map(s => s===null?null:s.tile(2*11+1))
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

                if (action.name == "tile-place") {

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

                    if (this.active_tool == EditorTool.ERASE_TILE) {

                        this.editor_icons.erase.draw(ctx, x+1, y+1)

                    } else if (this.active_tool == EditorTool.PAINT_TILE) {

                        this.editor_icons.brush.draw(ctx, x+1, y+1)
                    } else {
                        const tile = {
                            shape: this.tile_shape,
                            property: this.tile_property,
                            sheet: this.tile_sheet,
                            direction: Direction.UPRIGHT,
                            points: points,
                        }
                        paintTile(ctx, x+1, y+1, tile)
                    }
                }
                else if (action.name == "object-place") {

                    let page = this.object_pages[this.objmenu_current_page]
                    let obj = page.objects[this.objmenu_current_object]
                    let icon = obj?.ctor?.icon
                    if (!!icon) {
                        icon.draw(ctx, x+1, y+1)
                    }
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
        ctx.fillStyle = "#477ed6";
        ctx.strokeStyle = "#000000";
        //const rw = Math.min(this.camera.x + gEngine.view.width, this.map.width) - this.camera.x
        //const rh = Math.min(this.camera.y + gEngine.view.height, this.map.height) - this.camera.y

        const sw = gEngine.view.width * this.camera.scale
        const sh = gEngine.view.height * this.camera.scale
        let x1 = Math.max(0, this.camera.x)
        let y1 = Math.max(0, this.camera.y)
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
        x1 = Math.max(0, this.camera.x)
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
    }

    _paint_objects(ctx) {
        ctx.save()
        ctx.setLineDash([3]);
        for (const [oid, obj] of Object.entries(this.map.objects)) {

            let y = 16*Math.floor(oid/512 - 4)
            let x = 16*(oid%512)


            //let objinfo = this.object_registry[obj.name]
            let ctor = this.editor_objects[obj.name]

            // icon2 is a temporary hack
            // require a function (editor props) => icon
            // or default to icon
            if (!!ctor?.editorIcon) {
                ctor.editorIcon(obj.props).draw(ctx, x, y)
            } else if (!!ctor?.icon) {
                ctor.icon.draw(ctx, x, y)
            }

            ctx.beginPath()
            ctx.strokeStyle = "blue"
            ctx.rect(x,y,ctor.size[0],ctor.size[1])
            ctx.closePath()
            ctx.stroke()

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

        this._paint_objects(ctx)

        this._paint_grid(ctx)

        ctx.restore()

        this._paint_header(ctx)

        if (!!this.active_menu) {
            this.active_menu.paint(ctx)
        }


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

    _updateTile(x, y, tile) {
        // return true if the tile was updated.
        // update neighbors
        // loop until no more tiles are changed

        let queue = [[x,y]]

        while (queue.length > 0) {
            let [qx,qy] = queue.shift()
            const tid = (qy + 4)*512+qx

            let delta = false
            if (!!this.map.layers[0][tid]) {
                delta = updateTile(this.map.layers[0], this.map.width, this.map.height, this.theme_sheets, qx, qy, this.map.layers[0][tid])
            }

            if (delta) {
                queue.push([x-1, y])
                queue.push([x+1, y])
                queue.push([x, y-1])
                queue.push([x, y+1])

                queue.push([x-1, y-1])
                queue.push([x+1, y+1])
                queue.push([x+1, y-1])
                queue.push([x+1, y+1])

                queue.push([x-2, y])
                queue.push([x+2, y])
                queue.push([x, y-2])
                queue.push([x, y+2])

            }

        }

    }

    eraseObject(x, y, onpress) {
        const oid = (y + 4)*512+x

        if (!!this.map.objects[oid]) {
            delete this.map.objects[oid]
            return true
        }
        return false
    }

    moveObject(x, y, onpress) {
        const oid = (y + 4)*512+x
        if (onpress) {

            if (!!this.map.objects[oid]) {
                this.selected_object = this.map.objects[oid]
                this.selected_object.oid = oid
            } else {
                this.selected_object = null
            }
        } else {

            // check to see if there is a selected object
            // and the current mouse position does not match the object position
            if (!!this.selected_object && this.selected_object.oid != oid) {
                // check that the new mouse position is empty
                if (!this.map.objects[oid]) {
                    // move the object
                    delete this.map.objects[this.selected_object.oid]
                    this.selected_object.oid = oid
                    this.map.objects[oid] = this.selected_object

                    return true
                }
            }
        }

        return false
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

    placeObject(x, y, pressed) {

        const oid = (y + 4)*512+x
        if (oid === this.previous_oid) {
            return false
        }
        this.previous_oid = oid

        if (!this.map.objects[oid]) {

            let obj = this.object_pages[this.objmenu_current_page].objects[this.objmenu_current_object]
            let ctor = this.editor_objects[obj.name]
            let schemaList = (ctor?.editorSchema??[])

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

                this._updateTile(x,y,this.map.layers[0][tid])
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
        } else if (this.tile_shape == 7) {

            this.map.layers[0][tid] = {
                shape: this.tile_shape,
                property: this.tile_property,
                sheet: this.tile_sheet,
            }

        }

        this._updateTile(x,y,this.map.layers[0][tid])
        return true
    }

    playTest() {

        //gAssets.mapinfo.mapurl = "editor-playtest"

        gAssets.mapinfo.width = this.map.width
        gAssets.mapinfo.height = this.map.height
        gAssets.mapinfo.theme = this.current_theme

        gAssets.mapinfo.layers = this.map.layers

        const objects0 = Object.entries(this.map.objects)
            .filter( t => !!t[1].name )
            .map(t => {
                let obj = {oid: t[0], name: t[1].name}
                if (Object.hasOwn(t[1], 'props') && Object.keys(t[1].props).length > 0) {
                    obj.props = t[1].props
                }
                return obj
            })

        gAssets.mapinfo.objects = objects0

        const edit = false
        console.log("playtest", gAssets.mapinfo.mapurl)
        gEngine.scene = new LevelLoaderScene(gAssets.mapinfo.mapurl, edit, ()=>{
            gEngine.scene = new LevelLoaderScene.scenes.main()
        })

    }

    saveAs() {

        // compress each tile into a 32bit integer
        // 1 bit, the sign bit, is unused
        const tiles0 = Object.entries(this.map.layers[0]).map((t) => {
            const [tid, tile] = t
            let x = 0;
            // tid is 18 bits (two 512 bit numbers)
            // shape, property, and sheet are each 3 bits
            // allowing 8 different values. zero is reserved for each
            // direction is 4 bits and optional (square tiles do not use it)
            x |= tid << 13 // position
            x |= tile.shape << 10
            x |= tile.property << 7
            x |= tile.sheet << 4
            x |= tile?.direction??0
            return x
        })

        // use objects with empty names as placeholders, to prevent dragging
        // or creating new objects ontop of other objects. filter these out
        // when saving
        const objects0 = Object.entries(this.map.objects)
            .filter( t => !!t[1].name )
            .map(t => {
                let obj = {oid: t[0], name: t[1].name}
                if (Object.hasOwn(t[1], 'props') && Object.keys(t[1].props).length > 0) {
                    obj.props = t[1].props
                }
                return obj
            })

        const map = {
            version: 0,
            width: this.map.width,
            height: this.map.height,
            theme: this.current_theme,
            layers: [tiles0],
            objects: objects0
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



    historyPush(change_tile, change_object) {

        // remove old entries that were discarded by the user
        while (this.history_index > 0) {
            console.log("remove events")
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
        if (change_tile || change_object) {
            event.layer_id = 0
            event.layer = JSON.stringify(this.map.layers[0])
            event.objects = JSON.stringify(this.map.objects)
        }

        this.history.push(event)

        // enforce maximum number of entries
        while (this.history.length > 10) {
            this.history.shift()
        }

        // log the size
        let history_size = this.history.map(h => (h?.layer??"").length + (h?.objects??"").length).reduce((a,b)=>a+b,0)
        console.log(`history index=${this.history_index} num_entries=${this.history.length} size=${(history_size/1024).toFixed(1)}kb`)

    }

    historyPop() {
        // history_index always points at the most recent event
        // a pop should apply the previous state
        // an unpop should reapply the most recently popped state

        if (this.history_index < this.history.length-1) {
            this.history_index += 1
            let idx = (this.history.length - 1) - this.history_index
            console.log("pop", idx, this.history.length, this.history_index)
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
            console.log("unpop", idx, this.history.length, this.history_index)
            this._historyApplyIndex(idx)
            gAssets.sounds.click1.play()
        } else {
            gAssets.sounds.click2.play()
        }
    }

    _historyApplyIndex(idx) {
        if (idx >= 0 && idx < this.history.length) {
            console.log("apply event ", idx, this.history.length)
            let event = this.history[idx]

            if (Object.hasOwn(event, 'layer_id')) {
                console.log("history apply tiles")
                this.map.layers[event.layer_id] = JSON.parse(event.layer)
            }

            if (Object.hasOwn(event, 'objects')) {
                console.log("history apply object")
                this.map.objects = JSON.parse(event.objects)
            }
        }
    }

    handleTouches(touches) {
        if (touches.length > 0) {
            // transform the touch into a tile index
            if (touches[0].y < 24) {
                let t = touches[0]

                // buttons are 18x18 pixels.
                // with 6 pixels between buttons
                //
                let ix = Math.floor((t.x - 3) / 24)
                let iclicked = ((t.x - 3) % 24) < 18

                console.log("menu clicked", ix, iclicked)

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

                // right click or two touches to scroll the screen
                if (touches[0].buttons&2 || touches.length==2) {

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

                        this.camera.x = this.mouse_down.camerax + dx
                        this.camera.y = this.mouse_down.cameray + dy

                        // this is arbitrary
                        // restrict the field of view to always display at least 4 tiles
                        this.camera.x = Math.max(-(gEngine.view.width - 64/this.camera.scale), this.camera.x)
                        this.camera.x = Math.min((this.map.width - 64)/this.camera.scale, this.camera.x)


                        this.camera.y = Math.max(-(gEngine.view.height-24 ), this.camera.y)
                        this.camera.y = Math.min((this.map.height - 64)/this.camera.scale, this.camera.y)
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
                    if (t.y >= -this.ygutter/16 && t.x >= 0 && t.x < this.map.width/16 && t.y < this.map.height/16) {

                        if (this.active_tool === EditorTool.SELECT_OBJECT) {
                            // first touch required to select the object to drag
                            change_object = this.moveObject(t.x, t.y, t.first)
                        }

                        else if (this.active_tool === EditorTool.ERASE_OBJECT) {
                            if (!t.first) {
                                change_object = this.eraseObject(t.x, t.y)
                            }

                        }

                        else if (this.active_tool === EditorTool.EDIT_OBJECT) {
                            if (!t.first) {
                                const oid = (t.y + 4)*512+t.x
                                if (!!this.map.objects[oid]) {
                                    this.active_menu = new ObjectPropertyEditMenu(this, oid)
                                }
                            }

                        }

                        else if (this.active_tool === EditorTool.PLACE_OBJECT) {
                            if (!t.first) {
                                change_object = this.placeObject(t.x, t.y,t.pressed)
                            }

                        }
                        else if (this.active_tool === EditorTool.ERASE_TILE) {
                            if (!t.first) {
                                change_tile = this.eraseTile(t.x, t.y)
                            }

                        }
                        else if (this.active_tool === EditorTool.PLACE_TILE || this.active_tool === EditorTool.PAINT_TILE) {
                            if (!t.first) {
                                change_tile = this.placeTile(t.x, t.y)
                            }

                        }
                    }

                    if (!t.pressed) {
                        this.previous_tid = -1
                        this.previous_oid = -1
                    }

                    this.change_tile = this.change_tile||change_tile
                    this.change_object = this.change_object||change_object

                    // push a history state on touch release
                    if (!t.pressed) {

                        this.historyPush(this.change_tile, this.change_object)

                        // TODO: do something with this.map.layers[0] and this.map.objects
                        // if there was a change to either, push a history state
                        this.change_tile = false //reset
                        this.change_object = false //reset
                    }
                }
            }
        }
    }

    handleKeyPress(keyevent) {
    }

    handleKeyRelease(keyevent) {

        if (keyevent.text == 'q') {
            this.camera.scale = (this.camera.scale==1)?2:1
        } else if (keyevent.keyCode == 38) {
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
            this.tile_shape = TileShape.FULL
        } else if (keyevent.text == '2') {
            this.tile_shape = TileShape.HALF
        } else if (keyevent.text == '3') {
            this.tile_shape = TileShape.ONETHIRD
        } else if (keyevent.text == '4') {
            this.tile_shape = TileShape.TWOTHIRD
        } else if (keyevent.text == '5') {
            this.tile_shape = -1
        } else if (keyevent.text == 's') {
            this.tile_property = TileProperty.SOLID
        } else {
            console.log(keyevent)
        }

    }

}