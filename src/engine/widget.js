 

include "primitives.js"

// https://gist.github.com/mjackson/5311256
// https://github.com/goldfire/CanvasInput

function hex2rgb(s) {

    const r = parseInt(s.slice(1,3), 16)
    const g = parseInt(s.slice(3,5), 16)
    const b = parseInt(s.slice(5,7), 16)

    return {r,g,b}
}

function _hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

function hsl2rgb(h, s, l) {
    let r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;

        r = _hue2rgb(p, q, h + 1/3);
        g = _hue2rgb(p, q, h);
        b = _hue2rgb(p, q, h - 1/3);
    }

    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    return {r,g,b};
}

function rgb2hsl(r, g, b) {
  r /= 255, g /= 255, b /= 255;

  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return {h,s,l};
}

function _tohex(i) {
    let s = i.toString(16)
    if (s.length == 1) {
        s = "0" + s
    }
    return s
}

function lighter(s) {
    let c = hex2rgb(s)
    let hsl = rgb2hsl(c.r, c.g, c.b)
    hsl.l += 0.5 * (1 - hsl.l)

    let rgb = hsl2rgb(hsl.h, hsl.s, hsl.l)
    return "#" + _tohex(rgb.r) + _tohex(rgb.g) + _tohex(rgb.b)
}

function darker(s) {
    let c = hex2rgb(s)
    let hsl = rgb2hsl(c.r, c.g, c.b)
    hsl.l = 0.5 * hsl.l
    let rgb = hsl2rgb(hsl.h, hsl.s, hsl.l)
    return "#" + _tohex(rgb.r) + _tohex(rgb.g) + _tohex(rgb.b)
}

export class WidgetStyle {

    constructor(ctx) {

        this.ctx = ctx

        this.buildStyles()
    }

    buildStyles() {

        this.colors = {

            base: {
                primary: "#0d6efd",
                secondary: "#198754",
                success: "#218838",
                warning: "#fd7e14",
                danger: "#dc3545",
            },
            lighter: {},
            darker: {}
        }

        for (const k in this.colors.base) {
            this.colors.lighter[k] = lighter(this.colors.base[k])
            this.colors.darker[k] = darker(this.colors.base[k])
        }
        console.log(this.colors)

        this.button = {

            primary: {
                focused: lighter("#0d6efd"),
                normal:  "#0d6efd",
            },
            secondary: {
                focused: lighter("#198754"),
                normal:  "#198754",
            },
            success: {
                focused: "#218838;",
                normal:  "#218838",
            },
            warning: {
                focused: "#fd7e14",
                normal:  "#fd7e14",
            },
            danger: {
                focused: "#dc3545",
                normal:  "#dc3545",
            },

        }
    }
}

WidgetStyle.init = (ctx) => {
    WidgetStyle.instance = new WidgetStyle(ctx)
}


/*
layout api
    set layout
    set position
    set dimensions
    resize

    x,y,w,h

    add spacer
        fixed height / width
        relative height widths

focus api

    keyboard
        arrow keys move between focus widgets
        text input devices use tab key for focus next event
        properties
            focus_next
            focus_back
        if props not set go to next focusable widget in the list

        key handlers can return truthy to prevent default events
    touch
        focus on touch down
        no focus index
        cancel keyboard focus if set





*/
export class Widget {

    constructor() {
        this.focusable = false
        this.rect = new Rect(0,0,0,0)
        this._widget_style = null
        this._keyboard_focus = false

        this._touch_id = null
    }

    setStyle(style) {
        this._widget_style = style
    }

    style() {
        return this._widget_style??WidgetStyle.instance
    }

    hasFocus() {
        return this._keyboard_focus || this._touch_id !== null
    }

    handleTouches(touches) {

        let match = false;
        for (const touch of touches) {
            if (this.rect.collidePoint(touch.x, touch.y)) {
                if (this._touch_id === touch.id && !touch.pressed) {
                    this.handleTouchRelease()
                    this._touch_id = null
                } else {
                    if (this._touch_id === null) {
                        this.handleTouchPress()
                    }

                    this._touch_id = touch.id
                }
                match = true
                break;
            }
        }
        if (!match) {
            this._touch_id = null
        }
    }

    handleTouchRelease() {
    }

    handleTouchPress() {
    }

    handleKeyPress(keyevent) {

    }

    handleKeyRelease(keyevent) {

    }

    update(dt) {

    }

    paint(ctx) {

    }
}

const Keys = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    ENTER: 13,
}

export class WidgetGroup {

    constructor() {
        this.widgets = []
        this.focus_index = -1
        this._widget_style = null
    }

    addWidget(w) {
        this.widgets.push(w)
        return w
    }

    removeWidget(w) {

        const i = this.widgets.indexOf(w)
        if (i >= 0) {
            this.widgets.splice(i, 1)
        }
    }

    setStyle(style) {
        this._widget_style = style
        this.widgets.forEach(w => {
            w.setStyle(style)
        })
    }

    style() {
        return this._widget_style
    }

    update(dt) {
        this.widgets.forEach(w => {
            w.update(dt)
        })
    }

    paint(ctx) {

        //ctx.save()
        //ctx.fillStyle = "red"
        //ctx.font = "400 12pt sans-serif"
        //ctx.textAlign = "left"
        //ctx.textBaseline = "top"
        //ctx.fillText(`${this.focus_index}/${this.widgets.length}`, 0, 0)
        //ctx.fillRect(0,0,16,16)
        //ctx.restore()

        this.widgets.forEach(w => {
            w.paint(ctx)
        })
    }

    // deprecate?
    setFocusWidget(w) {
        this.focus_index = this.widgets.indexOf(w)
        for (let i=0; i < this.widgets.length; i++) {
            this.widgets[i]._keyboard_focus = false
        }
        w._keyboard_focus = true

    }

    focusWidget() {
        if (this.focus_index < 0 ||
            this.focus_index >= this.widgets.length ||
            !this.widgets[this.focus_index].focusable) {

            let focus_index = -1
            for (let i=0; i < this.widgets.length; i++) {
                if (this.widgets[i].focusable) {
                    focus_index = i
                    break;
                }
            }

            if (focus_index >= 0) {

                if (focus_index != this.focus_index) {
                    for (let i=0; i < this.widgets.length; i++) {
                        this.widgets[i]._keyboard_focus = false
                    }
                }

                this.widgets[focus_index]._keyboard_focus = true

                console.log("set focus index", this.focus_index, focus_index)
                this.focus_index = focus_index

            }



        }

        if (this.focus_index < this.widgets.length) {
            return this.widgets[this.focus_index]
        }

        return null
    }

    handleTouches(touches) {
        this.widgets.forEach(w => {
            w.handleTouches(touches)
        })
    }

    handleKeyPress(keyevent) {

        let target = this.focusWidget()
        if (!!target) {
            if (!!target.handleKeyPress(keyevent)) {
                return
            }
        }



    }

    handleKeyRelease(keyevent) {
        let target = this.focusWidget()
        if (!!target) {
            if (!!target.handleKeyRelease(keyevent)) {
                return
            }
        }

        if (keyevent.keyCode == Keys.RIGHT || keyevent.keyCode == Keys.DOWN) {
            this.handleFocusNext()
        }

        if (keyevent.keyCode == Keys.LEFT || keyevent.keyCode == Keys.UP) {
            this.handleFocusPrev()
        }

    }

    handleFocusNext() {

        let focus_index = this.focus_index

        for (let j=1; j < this.widgets.length; j++) {
            let i = (focus_index + j) % this.widgets.length
            if (this.widgets[i].focusable) {
                focus_index = i
                break
            }

        }

        if (this.focus_index != focus_index) {
            for (let i=0; i < this.widgets.length; i++) {
                this.widgets[i]._keyboard_focus = false
            }
            this.widgets[focus_index]._keyboard_focus = true
            this.focus_index = focus_index
        }

        console.log("focus next", this.focus_index, this.widgets.length)

        //this.changeFocus()
    }

    handleFocusPrev() {
        let focus_index = this.focus_index

        for (let j=1; j < this.widgets.length; j++) {
            let i = (focus_index - j + this.widgets.length) % this.widgets.length
            if (this.widgets[i].focusable) {
                focus_index = i
                break
            }

        }

        if (this.focus_index != focus_index) {
            for (let i=0; i < this.widgets.length; i++) {
                this.widgets[i]._keyboard_focus = false
            }
            this.widgets[focus_index]._keyboard_focus = true
            this.focus_index = focus_index
        }

        console.log("focus prev", this.focus_index, this.widgets.length)

    }
}

export const Alignment = {

    TOP:     1,
    BOTTOM:  2,
    VCENTER: 3,

    LEFT:    4,
    RIGHT:   8,
    HCENTER: 12,

    CENTER: 15,

    XMASK: 12,
    YMASK: 3,

    XWORDS: ["", "left", "right", "center"], // textAlign
    YWORDS: ["", "top", "bottom", "middle"], // textBaseline

}


export class TextWidget extends Widget {

    constructor() {
        super();

        this._text = ""
        this._font = "400 16pt"
        this._style = "yellow"
        this._alignment = Alignment.CENTER
    }

    setText(text) {
        this._text = text
    }

    paint(ctx) {

        // textAlign = left|center|right
        // textBaseline = top|middle|alphabetic|ideographic|bottom

        ctx.save()

        ctx.textAlign = Alignment.XWORDS[(this._alignment&Alignment.XMASK)>>2]
        ctx.textBaseline = Alignment.YWORDS[(this._alignment&Alignment.YMASK)]
        ctx.fillStyle = this._style;
        ctx.font = this._font;

        //ctx.strokeStyle = "blue"
        //ctx.beginPath()
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        ////ctx.clip()
        //ctx.stroke()


        let dx;
        let dy;


        if ((this._alignment & Alignment.VCENTER) === Alignment.VCENTER) {
            dy = this.rect.cy()
        }
        else if ((this._alignment & Alignment.TOP) === Alignment.TOP) {
            dy = this.rect.top()
        }
        else if ((this._alignment & Alignment.BOTTOM) === Alignment.BOTTOM) {
            dy = this.rect.bottom()
        }

        if ((this._alignment & Alignment.HCENTER) === Alignment.HCENTER) {
            dx = this.rect.cx()
        }
        else if ((this._alignment & Alignment.LEFT) === Alignment.LEFT) {
            dx = this.rect.left()
        }
        else if ((this._alignment & Alignment.RIGHT) === Alignment.RIGHT) {
            dx = this.rect.right()
        }
        //ctx.fillText(ctx.textAlign + ":" + ctx.textBaseline + ":" + this._alignment, dx, dy)
        ctx.fillText(this._text, dx, dy)

        ctx.restore()

        //ctx.strokeStyle = "red"
        //ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)
        //ctx.stroke()
    }
}

export class ButtonWidget extends TextWidget {

    constructor() {
        super();
        this.focusable = true
        this.rect = new Rect(64,64,64,64)
        this.radius = 8

        this._text = "click me"
        this._sound = null
        this.clicked = null

        // this.c1 = this.style().ctx.createLinearGradient(
        //     this.rect.cx(),
        //     this.rect.top(),
        //     this.rect.cx()
        //     this.rect.bottom(),
        // );
        // console.log(this.style().colors.darker.primary)
        // this.c1.addColorStop(0, this.style().colors.base.primary);
        // this.c1.addColorStop(0.25, this.style().colors.lighter.primary);
        // this.c1.addColorStop(1, this.style().colors.darker.primary);

    }

    paint(ctx) {

        let style = this.style().button['primary']

        ctx.fillStyle = this.hasFocus()?style.focused:style.normal
        ctx.strokeStyle = '#000000'
        ctx.beginPath()
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, this.radius)
        ctx.fill()
        ctx.stroke()

        super.paint(ctx)
    }

    handleKeyRelease(keyevent) {

        if (keyevent.keyCode === Keys.ENTER || keyevent.keyCode === Keys.SPACE) {
            if (this._sound) {
                this._sound.play()
            }
            this.clicked?.()
        }
    }

    handleTouchRelease() {

        if (this._sound) {
            this._sound.play()
        }
        this.clicked?.()
    }

}
