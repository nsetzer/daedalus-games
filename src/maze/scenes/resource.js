 
from module engine import {
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SpriteSheetBuilder, SpriteSheet,
    ResourceStatus, ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene
}

include './common.js'
include './main.js'

export class ResourceLoaderScene extends GameScene {

    constructor() {
        super();

        this.build_loader()

        this.timer = 0;
    }


    build_loader() {

        this.loader = new ResourceLoader()

        this.loader.addSoundEffect("hit").path(RES_ROOT + "/sound/LOZ_Enemy_Hit.wav")
        this.loader.addSoundEffect("death").path(RES_ROOT + "/sound/LOZ_Link_Die.wav")
        this.loader.addSoundEffect("hurt").path(RES_ROOT + "/sound/LOZ_Link_Hurt.wav")
        this.loader.addSoundEffect("slash").path(RES_ROOT + "/sound/LOZ_Sword_Slash.wav");
        this.loader.addSoundEffect("drop").path(RES_ROOT + "/sound/LOZ_Bomb_Drop.wav");
        this.loader.addSoundEffect("explode").path(RES_ROOT + "/sound/LOZ_Bomb_Blow.wav");
        this.loader.addSoundEffect("item").path(RES_ROOT + "/sound/LOZ_Get_Item.wav");
        this.loader.addSoundEffect("door").path(RES_ROOT + "/sound/LOZ_Door_Unlock.wav");

        this.loader.addSpriteSheet("bg")
            .path(RES_ROOT + "/tile2.png")
            .dimensions(32, 32)
            .layout(2, 6)
            .build()

        this.loader.addSpriteSheet("bomb")
            .path(RES_ROOT + "/bomb.png")
            .dimensions(16, 16)
            .layout(3, 1)
            .build()

        this.loader.addSpriteSheet("fireball")
            .path(RES_ROOT + "/fireball.png")
            .dimensions(32, 32)
            .layout(1, 1)
            .build()

        this.loader.addSpriteSheet("hero")
            .path(RES_ROOT + "/char32.png")
            .dimensions(32, 32)
            .layout(4, 4)
            .offset(1, 1)
            .spacing(1, 1)
            .build()

        this.loader.addSpriteSheet("boss")
            .path(RES_ROOT + "/boss.png")
            .dimensions(64, 64)
            .layout(1, 2)
            .offset(2, 2)
            .spacing(2, 2)
            .build()

        this.loader.addSpriteSheet("monster")
            .path(RES_ROOT + "/monster32.png")
            .dimensions(32, 32)
            .layout(4, 4)
            .offset(1, 1)
            .spacing(1, 1)
            .build()

    }


    update(dt) {

        if (!this.loader.ready) {
            this.loader.update()
        } else {
            this.timer += dt
            if (this.timer > 1) {
                global.loader = this.loader
                gEngine.scene = new MainScene()
            }
        }

    }

    paint(ctx) {
        //ctx.fillStyle = "yellow";
        //ctx.fillText(`${this.gen.ux} ${this.gen.uy}: ${JSON.stringify(gEngine.view)}`, 0, -8)

        ctx.beginPath();
        ctx.strokeStyle = 'red';
        ctx.rect(-1, -1, gEngine.view.width+2, gEngine.view.height+2);
        ctx.stroke();

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
        console.log("!", touches)
        if (touches.length == 0) {
            this.gen.reset()
        }
    }

    resize() {

    }
}