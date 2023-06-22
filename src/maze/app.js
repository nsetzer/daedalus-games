
//import {ApplicationBase} from './engine.js'
//import {TitleScene} from './scenes.js'
from module engine import {ApplicationBase}
from module scenes import {TitleScene}

export default class Application extends ApplicationBase {
    constructor() {
        super({portrait: 0, fullscreen: 1}, () => {
            return new TitleScene()
        })
    }
}