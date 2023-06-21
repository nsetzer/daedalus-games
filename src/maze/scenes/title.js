 
from module engine import {
    randomRange, randomNumber, randomChoice, shuffle,
    SoundEffect, SoundEffectBuilder,
    SpriteSheetBuilder, SpriteSheet,
    Font, FontBuilder,
    ResourceStatus, ResourceLoader, CameraBase
    Direction, TouchInput, KeyboardInput
    Rect, Entity, CharacterComponent, GameScene,
    ButtonWidget, TextWidget, WidgetGroup
}

include './common.js'
include './mazegen.js'
include './main.js'

/*
https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createRadialGradient

const grd = ctx.createRadialGradient(x,y,r,x1,y1,r1);
const grd = ctx.createLinearGradient(x,y,x1,y1);
grd.addColorStop(0, "red");
grd.addColorStop(1, "white");
*/

class TouchText extends TextWidget {

    constructor() {
        super()
        this.focusable = true
        this.clicked = null

    }

    handleKeyRelease(keyevent) {
        this.clicked?.()
    }

    handleTouchRelease() {
        this.clicked?.()
    }
}


export class TitleScene extends GameScene {

    constructor() {
        super();

        this.font = new FontBuilder()
            .family("comic-mono")
            .path("/static/font/ComicMono.ttf")
            .build()

        this.sound_click = new SoundEffectBuilder()
            .path("/static/sound/clicksound1.wav")
            .build()

        this.gen = new MazeGenerator(33, 33)
        this.gen.steps = [
            this.gen.do_step_init.bind(this.gen),
            this.gen.do_step_carve_init.bind(this.gen),
            this.gen.do_step_carve.bind(this.gen),
        ]
        this.gen.show = true
        this.gen.alpha = .25
        this.gen.stretch = true

        this.wgtgrp = new WidgetGroup()

        let w;
        w = this.wgtgrp.addWidget(new TextWidget())
        w.rect.x = 0
        w.rect.y = 0
        w.rect.w = gEngine.view.width
        w.rect.h = gEngine.view.height/3
        w._text = "Maze Game"
        w._font = "200 24pt comic-mono"
        this.title = w

        // the decoy text forces user interaction to enable sound
        this.decoy_text = new TouchText()
        w = this.wgtgrp.addWidget(this.decoy_text)
        w.rect.h = gEngine.view.height
        w.rect.x = gEngine.view.height/2 - w.rect.h/2
        w.rect.w = gEngine.view.width
        w.rect.y = gEngine.view.width/2 - w.rect.w/2
        w._text = "Touch to Start"
        w._font = "200 24pt comic-mono"
        w.clicked = this.handleTouchStart.bind(this)

        //console.log(gEngine)
        //this.input = new CanvasInput({
        //    canvas: gEngine._canvas,
        //    fontSize: 18,
        //    width: 300,
        //    padding: 8,
        //    borderWidth:4,
        //    broderRadius: 8,
        //})

        this.msg = "<>"

    }

    resize() {

    }

    handleTouchStart() {
        this.wgtgrp.removeWidget(this.decoy_text)
        this.decoy_text = null

        let w;
        let h = Math.floor(gEngine.view.height/6 * .8)

        w = this.wgtgrp.addWidget(new ButtonWidget())
        w.rect.w = gEngine.view.width/3
        w.rect.x = gEngine.view.width/2 - w.rect.w/2
        w.rect.y = gEngine.view.height/2 + h/4
        w.rect.h = h
        w._font = "200 16pt comic-mono"
        w._text = "Start Game"
        w._sound = this.sound_click
        // this.wgtgrp.setFocusWidget(w)

        w.clicked = this.handleGameStart.bind(this)
        w = this.wgtgrp.addWidget(new ButtonWidget())
        w.rect.w = gEngine.view.width/3
        w.rect.x = gEngine.view.width/2 - w.rect.w/2
        w.rect.y = gEngine.view.height/2 + h + h/2 + h/4
        w.rect.h = h
        w._text = "..."
        w._font = "200 16pt comic-mono"
        w._sound = this.sound_click

        if (daedalus.platform.isMobile) {
            const body = document.getElementsByTagName("BODY")[0];
            body.requestFullscreen()
            // screen lock does not work, request user to rotate phone
            // screen.orientation.lock('landscape');
        }


    }

    handleGameStart() {
        gEngine.scene = new MazeScene()
    }

    update(dt) {

        this.gen.update(dt)

        // this.title.setText(`${gEngine.view.rotate} ${window.orientation} ${this.msg}`)
    }

    paint(ctx) {

        this.gen.paint(ctx)

        this.wgtgrp.paint(ctx)

        //ctx.resetTransform()
        //this.input.render()

    }

    handleTouches(touches) {
        this.wgtgrp.handleTouches(touches)
    }

    handleKeyPress(keyevent) {

        this.wgtgrp.handleKeyPress(keyevent)
    }

    handleKeyRelease(keyevent) {

        this.wgtgrp.handleKeyRelease(keyevent)
    }

}