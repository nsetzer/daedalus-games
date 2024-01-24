
import {
    StyleSheet, DomElement,
    TextElement, ListItemElement, ListElement,
    HeaderElement, ButtonElement, LinkElement
} from "@daedalus/daedalus"

const style = {
    "body": StyleSheet({
        "background": "#333333",
        "overflow": "scroll",
        "margin": 0,
        "padding":0
    }),

    "main": StyleSheet({
        "display": "flex",
        "flex-direction": "column",
        "justify-content": "center"
    }),

    "input": StyleSheet({
        "background-color": "silver",
        "width": "100vw",
        "display": "flex",
        "flex-direction": "row",
        "padding": ".5em",
        position: "fixed",
        bottom: 0,
    }),

    "textinput": StyleSheet({
        "flex-grow": "1",
    }),

    "buttoninput": StyleSheet({
        "margin-left": "1em",
        "margin-right": "1em",
    }),

    "hidden": StyleSheet({
        "visibility": "collapse"
    })
}

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

class TextInput extends DomElement {
    constructor(parent) {
        super("input", {type: "text", className: style.textinput}, [])

        this.parent = parent
            /*autofocus: null,*/
            /*style: "visibility: hidden; width: 0px; height: 0px"*/

    }

    elementMounted() {
        // console.log("input height", this.getDomNode().clientHeight)
    }

    onChange(event) {
        console.log(event)
    }

    onInput(event) {
        console.log(event)
    }

    onFocusOut(event) {
        //console.log(event)
        //this.parent.addClassName(style.hidden)
    }

    focus() {
        this.getDomNode().focus()
    }
}

class ButtonInput extends DomElement {
    constructor(parent) {
        super("input", {type: "button", className: style.buttoninput}, [])
        this.parent = parent
    }

    onClick(event) {

        this.parent.submit()
    }

    onChange(event) {
        console.log(event)
    }


    onInput(event) {

        console.log("button input")

    }

    elementMounted() {
        this.getDomNode().value = ">>"
    }
}

class TextInputContainer extends DomElement {
    constructor() {
        super("div", {className: style.input}, [])

        this.text = this.appendChild(new TextInput(this))
        this.button = this.appendChild(new ButtonInput(this))

        this.addClassName(style.hidden)
        this.focus_widget = null
    }

    elementMounted() {

        //console.log("on touch mount", this.getDomNode().contains(this.text.getDomNode()))
    }
    submit() {
        this.addClassName(style.hidden)
        if (this.focus_widget) {
            this.focus_widget.handleMobileInput(true, this.text.getDomNode().value)
            this.focus_widget = null
        }
    }

    requestKeyboardFocus(settings, widget) {

        // TODO: add setting for 'submit':
        //   if submit is true, show the button
        // e.g. a registration page would have submit false
        //      and a final submit button not associated with the input
        this.text.props.type = settings.type ?? "text"
        this.text.props.placeholder = settings.placeholder ?? "text"
        this.text.getDomNode().value = settings.text ?? ""
        this.text.update()
        this.focus_widget = widget

        this.removeClassName(style.hidden)
        this.text.getDomNode().focus()
    }

    hasKeyboardFocus() {
        return !!this.focus_widget
    }

    clearKeyboardFocus() {
        this.addClassName(style.hidden)
        if (!!this.focus_widget) {
            this.focus_widget.handleMobileInput(false, this.text.getDomNode().value)
        }
        this.focus_widget = null

    }
}

export class ApplicationBase extends DomElement {
    constructor(settings, initialScene) {

        super("div", {className: style.main}, [])

        this.settings = settings
        this.initialScene = initialScene

        const body = document.getElementsByTagName("BODY")[0];
        body.className = style.body

        console.log("build app")

        this.resize_timer = null

    }

    elementMounted() {

        this.canvas = this.appendChild(new CanvasEngine(
            window.innerWidth, window.innerHeight, this.settings))

        window.gEngine = this.canvas
        window.hiddenInput = this.appendChild(new TextInputContainer())


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
        canvas.width = window.innerWidth>1920?1920:window.innerWidth
        canvas.height = window.innerHeight>1080?1080:window.innerHeight

        // debounce
        // wait for the size to stop changing then issue a resize event
        if (this.resize_timer !== null) {
            clearTimeout(this.resize_timer)
        }

        this.resize_timer = setTimeout(() => {
            this.canvas.handleResize(window.innerWidth, window.innerHeight)
        }, 100)


    }
}
