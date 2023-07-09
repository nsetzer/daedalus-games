 
$import("daedalus", {})

$import("engine", {
    GameScene,  ResourceLoader, ResourceStatus
})

$include('./common.js')

export class ResourceLoaderScene extends GameScene {

    constructor( success_cbk ) {
        super();

        this.build_loader()

        this.timer = 0;
        // console.log(daedalus.env.debug)
        this.timeout = 0

        this.success_cbk = success_cbk
    }


    build_loader() {

        this.loader = new ResourceLoader()

        this.loader.addSoundEffect("dead").path(RES_ROOT + "/sounds/dead.wav")
        this.loader.addSoundEffect("spawn").path(RES_ROOT + "/sounds/enter.wav")
        this.loader.addSoundEffect("jump").path(RES_ROOT + "/sounds/jump.wav")

        const sprite_info1 = [
            ["default_l_appear",    1,  7, "/sprites/chars/default/left/Appearing (96x96).png"],
            ["default_l_disappear", 1,  7, "/sprites/chars/default/left/Disappearing (96x96).png"],

            ["default_r_appear",    1,  7, "/sprites/chars/default/right/Appearing (96x96).png"],
            ["default_r_disappear", 1,  7, "/sprites/chars/default/right/Disappearing (96x96).png"],
        ]

        const nameinfo = [
            ["frog", "Ninja Frog"],
            ["mask", "Mask Dude"],
            ["pink", "Pink Man"],
            ["blue", "Virtual Guy"],
        ]

        const sprite_info2 = [

            ["$SHORTNAME_0_l_double_jump", 1,  6, "/sprites/chars/$LONGNAME/0/left/Double Jump (32x32).png"],
            ["$SHORTNAME_0_l_fall"       , 1,  1, "/sprites/chars/$LONGNAME/0/left/Fall (32x32).png"],
            ["$SHORTNAME_0_l_hit"        , 1,  7, "/sprites/chars/$LONGNAME/0/left/Hit (32x32).png"],
            ["$SHORTNAME_0_l_idle"       , 1, 11, "/sprites/chars/$LONGNAME/0/left/Idle (32x32).png"],
            ["$SHORTNAME_0_l_jump"       , 1,  1, "/sprites/chars/$LONGNAME/0/left/Jump (32x32).png"],
            ["$SHORTNAME_0_l_run"        , 1, 12, "/sprites/chars/$LONGNAME/0/left/Run (32x32).png"],
            ["$SHORTNAME_0_l_wall_slide" , 1,  5, "/sprites/chars/$LONGNAME/0/left/Wall Jump (32x32).png"]

            ["$SHORTNAME_0_r_double_jump", 1,  6, "/sprites/chars/$LONGNAME/0/right/Double Jump (32x32).png"],
            ["$SHORTNAME_0_r_fall"       , 1,  1, "/sprites/chars/$LONGNAME/0/right/Fall (32x32).png"],
            ["$SHORTNAME_0_r_hit"        , 1,  7, "/sprites/chars/$LONGNAME/0/right/Hit (32x32).png"],
            ["$SHORTNAME_0_r_idle"       , 1, 11, "/sprites/chars/$LONGNAME/0/right/Idle (32x32).png"],
            ["$SHORTNAME_0_r_jump"       , 1,  1, "/sprites/chars/$LONGNAME/0/right/Jump (32x32).png"],
            ["$SHORTNAME_0_r_run"        , 1, 12, "/sprites/chars/$LONGNAME/0/right/Run (32x32).png"],
            ["$SHORTNAME_0_r_wall_slide" , 1,  5, "/sprites/chars/$LONGNAME/0/right/Wall Jump (32x32).png"]

        ]
        // ["frog_head", "sprites/chars/Ninja Frog/0/Head (31x28).png"],

        for (const info of sprite_info1) {
            let [name, rows, cols, url] = info

            this.loader.addSpriteSheet(name)
                .path(RES_ROOT + url)
                .dimensions(96, 96)
                .layout(rows, cols)
        }



        for (const names of nameinfo) {
            const [short, long] = names;
            for (const info of sprite_info2) {
                let [name, rows, cols, url] = info

                name = name.replace("$SHORTNAME", short)
                url = url.replace("$LONGNAME", long)

                this.loader.addSpriteSheet(name)
                    .path(RES_ROOT + url)
                    .dimensions(32, 32)
                    .layout(rows, cols)
            }
        }



    }


    update(dt) {

        if (!this.loader.ready) {
            this.loader.update()
        } else {
            this.timer += dt
            if (this.timer > this.timeout) {
                global.loader = this.loader
                this.success_cbk()
            }
        }

    }

    paint(ctx) {

        let color = (this.loader.status==ResourceStatus.ERROR)?'red':'yellow'
        ctx.beginPath();
        ctx.strokeStyle = color;
        let w = Math.floor(gEngine.view.width*.75)
        let h = Math.floor(gEngine.view.height*.1)
        let x = Math.floor(gEngine.view.width/2 - w/2)
        let y = Math.floor(gEngine.view.height/2 - h/2)
        ctx.rect(x,y,w,h);
        ctx.stroke();

        let p = this.loader.progress()
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.rect(x,y,Math.floor(w*p),h);
        ctx.fill();

    }

    handleTouches(touches) {
    }

    resize() {

    }
}