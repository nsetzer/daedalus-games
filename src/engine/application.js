
from module daedalus import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
}

const style = {
    "body": StyleSheet({
        "background": "#333333",
        "overflow": "scroll",
        "margin": 0,
        "padding":0
    }),

    "main": StyleSheet({
        "display": "flex",
        "flex-direction": "row",
        "justify-content": "center"
    })
}

export class ApplicationBase extends DomElement {
    constructor(settings, initialScene) {

        super("div", {className: style.main}, [])

        this.settings = settings
        this.initialScene = initialScene

        const body = document.getElementsByTagName("BODY")[0];
        body.className = style.body

        console.log("build app")

    }

    elementMounted() {

        this.canvas = this.appendChild(new CanvasEngine(
            window.innerWidth, window.innerHeight, this.settings))

        window.gEngine = this.canvas

        this.canvas.onReady = () => {
            this.canvas.scene = this.initialScene();
            console.log("scene created")
        }

        window.addEventListener("keydown", this.canvas.handleKeyPress.bind(this.canvas))
        window.addEventListener("keyup", this.canvas.handleKeyRelease.bind(this.canvas))
        window.addEventListener("resize", this.handleResize.bind(this))

    }

    handleResize() {
        const canvas = this.canvas.getDomNode()
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        this.canvas.handleResize(window.innerWidth, window.innerHeight)
    }
}
