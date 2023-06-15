
from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
}

from module engine import {CanvasEngine}

from module scenes import {MainScene, MazeScene}

const style = {
    "body": StyleSheet({
        "background": "#333333",
        "overflow": "scroll",
        "margin": 0,
        "padding":0
    }),

            //document.body.setAttribute( "style", "-moz-transform: rotate(90deg);");
            //document.body.setAttribute( "style", "-o-transform: rotate(90deg);");
            //document.body.setAttribute( "style", "-webkit-transform: rotate(90deg);");
            //document.body.setAttribute( "style", "transform: rotate(90deg);");

    "bodyRotate": StyleSheet({
        "background": "#333333",
        "overflow": "scroll",
        "margin": 0,
        "padding":0,
        "transform-origin": "top left",
        "transform": "translate(100vw, 30vh) rotate(90deg);"
    }),

    "main": StyleSheet({
        "display": "flex",
        "flex-direction": "row",
        "justify-content": "center"
    }),

    "item_hover": StyleSheet({"background": "#0000CC22"}),
    "item": StyleSheet({}),
    "item_file": StyleSheet({"color": "blue", "cursor": "pointer"}),

};
/*
StyleSheet("", "@media screen and (min-width: 320)", {
    "body": {
        "background": "#AAAAAA",
    },
    `.${style.canvas}`: {
        "border": "3px solid green",
    },
})

StyleSheet("", "@media screen and (min-width: 720)", {
    "body": {
        background: "#AAAAAA",
    },
    `.${style.canvas}`: {
        "border": "3px solid red",
    },
})
*/
export default class Application extends DomElement {
    constructor() {

        super("div", {className: style.main}, [])

        const body = document.getElementsByTagName("BODY")[0];
        body.className = style.body

        console.log("build app")

    }

    elementMounted() {

        this.canvas = this.appendChild(new CanvasEngine(
            window.innerWidth, window.innerHeight, {portrait: 0}))

        window.gEngine = this.canvas

        this.canvas.onReady = () => {
            this.canvas.scene = new MazeScene()
            console.log("scene created")
        }



        window.addEventListener("keydown", this.canvas.handleKeyPress.bind(this.canvas))
        window.addEventListener("keyup", this.canvas.handleKeyRelease.bind(this.canvas))
        window.addEventListener("resize", this.handleResize.bind(this))
        //canvas.width = screen.availWidth
        //canvas.height = screen.availHeight

        //canvas.width = window.innerWidth
        //canvas.height = window.innerHeight

    }

    handleResize() {
        const canvas = this.canvas.getDomNode()
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        this.canvas.handleResize(window.innerWidth, window.innerHeight)
    }
}