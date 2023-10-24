 
from module engine import {
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SpriteSheetBuilder, SpriteSheet,
    ResourceStatus, ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene
}

const RES_ROOT = "static"

export class ResourceLoaderScene extends GameScene {

    constructor(success_cbk) {
        super();

        this.success_cbk = success_cbk

        this.build_loader()

        this.timer = 0;
        this.timeout = 0; // how long to show the loading bar after it finished loading
    }


    build_loader() {

        this.loader = new ResourceLoader()

        //this.loader.addSoundEffect("hit").path(RES_ROOT + "/sound/LOZ_Enemy_Hit.wav")

        this.loader.addSpriteSheet("player")
            .path(RES_ROOT + "/sprites/player.png")
            .dimensions(32, 32)
            .layout(6, 17)
            .offset(1, 1)
            .spacing(1, 1)
            .build()
    }


    update(dt) {

        if (!this.loader.ready) {
            this.loader.update()
        } else {
            this.timer += dt
            if (this.timer > this.timeout) {
                this.success_cbk(this.loader)
                //global.loader = this.loader
                //gEngine.scene = new MainScene()
            }
        }

    }

    paint(ctx) {
        //ctx.fillStyle = "yellow";
        //ctx.fillText(`${this.gen.ux} ${this.gen.uy}: ${JSON.stringify(gEngine.view)}`, 0, -8)

        //ctx.beginPath();
        //ctx.strokeStyle = 'red';
        //ctx.rect(-1, -1, gEngine.view.width+2, gEngine.view.height+2);
        //ctx.stroke();

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

        //ctx.moveTo(0,0)
        //ctx.lineTo(gEngine.view.width,gEngine.view.height)
        //ctx.moveTo(gEngine.view.width,0)
        //ctx.lineTo(0,gEngine.view.height)

    }

    handleTouches(touches) {
    }

    resize() {

    }
}