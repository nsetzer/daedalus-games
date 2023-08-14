 
/*

https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

https://github.com/batiste/sprite.js/blob/master/sprite.js

https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing
https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter

https://konvajs.org/docs/filters/Brighten.html

retro CRT overlay
https://dev.to/ekeijl/retro-crt-terminal-screen-in-css-js-4afh
https://codepen.io/Mobius1/pen/zZpoXj

anti-aliasing tricks
    translate the canvas by .5 .5
    disable anti aliasing
    ensure drawing images is done with integers
    https://gamedev.stackexchange.com/questions/152383/drawimage-problem-adjacent-sprite

draw smooth scaling:
    ctx.save()
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(img, 10, 30, img.width * xscale, img.height * yscale);
    ctx.restore()

draw rotated
    ctx.save()
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 180 * (this.angle + 90));
    ctx.translate(-this.x, -this.y);
    ctx.restore()

draw with alpha
    ctx.save()
    ctx.globalAlpha = .5
    ctx.drawImage(this.sprite.image, this.rect.x, this.rect.y);
    ctx.restore()

draw with a color transform
    ctx.save()
    ctx.filter = "brightness(200%)";
    ctx.drawImage(this.sprite.image, this.rect.x, this.rect.y);
    ctx.restore()

image transform

    let canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    let ctx = canvas.getContext("2d");
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // cache image with a red background
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(0, 0, 32, 32);
    ctx.drawImage(this.image, 0, 0)

    // make a new image
    this.image = new Image();
    this.image.onload = () => {}
    this.image.src = canvas.toDataURL()

stable diffusion art sample
https://dimensionhopper.com/?map_name=maps%2F2db5a0adb268f3e53b8defb143dc08a6a449312e4daf3a96c8c152b10f89d872%2Fbackground_image_90529e42-0592-11ee-b773-0a49edcc4dad.png

create a clip region where drawing is allowed
        //var cx = this.view.width / 2;
        //var cy = this.view.height / 2;
        //var r = Math.min(cx, cy);
        //ctx.beginPath();
        //ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        //ctx.rect(cx-128, cy-128, 256, 256);
        //ctx.clip();

the facing direction should only update
if the new direction does not overlap with the
current direction
*/


$include("./primitives.js")
//$include("./resource.js")
//$include("./entity.js")
$include("./input.js")
$include("./widget.js")
//$include("./websocket.js")
$include("./webrtc.js")
$include("./canvas.js")
$include("./application.js")
