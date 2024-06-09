 
import os
from PIL import Image
import subprocess
import argparse
import json

def hstack(images, xspacing=0, xoffset=0, fillcolor=(0,0,0,0)):
    w = sum([img.width for img in images]) + ((len(images) - 1) * xspacing) + xoffset*2
    h = max([img.height for img in images])
    dst = Image.new('RGBA', (w, h))
    dst.paste(fillcolor, (0, 0, w, h)) # fill
    x = xoffset
    for img in images:
        dst.paste(img, (x, 0))
        x += img.width + xspacing
    return dst

def vstack(images, yspacing=0, yoffset=0, fillcolor=(0,0,0,0)):
    w = max([img.width for img in images])
    h = sum([img.height for img in images]) + ((len(images) - 1) * yspacing) + yoffset*2
    dst = Image.new('RGBA', (w, h))
    dst.paste(fillcolor, (0, 0, w, h)) # fill
    y = yoffset
    for img in images:
        dst.paste(img, (0, y))
        y += img.height + yspacing
    return dst

def mirror(image):
    return image.transpose(method=Image.Transpose.FLIP_LEFT_RIGHT)

def image2tiles(image, size, spacing=None, offset=None):

    if spacing is None:
        spacing = (0, 0)

    if offset is None:
        offset = (0, 0)

    xspacing, yspacing = spacing
    xoffset, yoffset = offset
    xsize, ysize = size

    tiles = []
    for y in range(yoffset, image.height-yoffset, ysize+yspacing):
        tiles.append([image.crop((x,y,x+xsize,y+ysize)) for x in range(xoffset, image.width-xoffset, xsize+xspacing)])

    return tiles

def tiles2image(tiles, spacing=None, offset=None, fillcolor=(0,0,0,0)):

    if spacing is None:
        spacing = (0, 0)

    if offset is None:
        offset = (0, 0)

    xspacing, yspacing = spacing
    xoffset, yoffset = offset

    sheet = vstack([hstack(row, xspacing, xoffset, fillcolor) for row in tiles], yspacing, yoffset, fillcolor)

    return sheet

def list_layers(sprite_path):

    args = [
    "aseprite",
    "-b",
    "--all-layers",
    "--list-layers",
    sprite_path
    ]

    proc = subprocess.run(args, stdout=subprocess.PIPE)
    proc.check_returncode()

    return proc.stdout.decode("utf-8").splitlines()

def export_layer(sprite_path, layer_name, export_path):

    args = [
        "aseprite",
        "-b",
        "--layer", layer_name,
        sprite_path,
        "--sheet", export_path
    ]

    proc = subprocess.run(args, stdout=subprocess.DEVNULL)
    proc.check_returncode()

def isnewer(path1, path2):
    a = os.stat(path1).st_mtime
    b = os.stat(path2).st_mtime
    return b > a

def export_aseprite(json_path, outpath):

    with open(json_path) as rf:
        sprite_sheet = json.load(rf)

    outparent = os.path.split(outpath)[0]

    crop_info = None
    tiles = []
    for idx, info in enumerate(sprite_sheet):

        if 'crop' in info:
            crop_info = info
            continue
    
        sprite_path = info['path']

        # export all image from the aseprite container
        layers = {}
        for layer in list_layers(sprite_path):
            export_path = os.path.join(outparent, f"layer-{idx}-{layer}.png")
            if not os.path.exists(export_path) or isnewer(export_path, sprite_path) or isnewer(export_path, json_path):
                export_layer(sprite_path, layer, export_path)
            layers[layer] = Image.open(export_path)

        for config in info['config']:

            layer_config = config['layers']

            out = layers[layer_config[-1]].copy()
            out = image2tiles(out, info['size'])[0]

            frames = config.get("frames", [])
            if len(frames) > 0:
                out = [out[index] for index in frames]

            if config['flip']:
                out = [mirror(x) for x in out]
            
            #if config['offset']:
            #    print("TODO: offset")
            #    # pad each image with a transparent border of 4px on the left
            #    # then crop each image by 4px on the right
            #    #out = [x.crop((4,0,x.width-4,x.height)) for x in out]

            for layer in reversed(layer_config[:-1]):
                img = layers[layer]
                img = image2tiles(img, info['size'])[0]
                if len(frames) > 0:
                    img = [img[index] for index in frames]
                if config['flip']:
                    img = [mirror(x) for x in img]
                for a,b in zip(out, img):
                    a.paste(b, (0,0), b)

            tiles.append(out)

    # create the editor icon and insert it into the first row
    if crop_info is not None:
        i, j = crop_info['crop'].get('frame', (0,0))
        x, y = crop_info['crop'].get('offset', (0,0))
        w, h = crop_info['crop'].get('size', (16,16))
        print("crop icon", tiles[j][i].size, (i,j), (x,y,w,h))
        icon = tiles[j][i].crop((x,y,x+w,y+h))
        # scale to size
        if w > 16 or h > 16:
            icon = icon.resize((16, 16))
        # pad to size
        if w < 16 or h < 16:
            new_image = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
            new_image.paste(icon, (0, 0))
            icon = new_image
        tiles.insert(0, [icon])

    sheet = tiles2image(tiles, spacing=(1,1), offset=(1,1), fillcolor=(0,0,0,0))
    for row in tiles:
        print(len(row))
    print(outpath)
    sheet.save(outpath)

def export_tilesheets(path, outpath, size, spacing, offset):

    img = Image.open(path)
    tiles = image2tiles(img, size=size, spacing=spacing, offset=offset)

    img = tiles2image(tiles, spacing=spacing, offset=offset)
    img.save(outpath)

def main():

    #resource =
    #with open("./sprites/flower.json", "w") as wf:
    #    json.dump(resource, wf, indent=2)
    #exit(1)

    parser = argparse.ArgumentParser(description='export aseprites')
    parser.add_argument('filename')
    parser.add_argument('--size', default=16, type=int)
    args = parser.parse_args()

    if args.filename.endswith(".png"):
        outpath = os.path.join("./export", os.path.split(args.filename)[1])
        export_tilesheets(args.filename, outpath, size=(args.size,args.size), spacing=(1,1), offset=(1,1))

    else:
        # export an aseprite using a json config

        
        name = os.path.splitext(os.path.split(args.filename)[1])[0]
        outpath = os.path.join("./export", name, name + ".png")

        #export_tilesheets()
        export_aseprite(args.filename, outpath)

if __name__ == '__main__':
    main()