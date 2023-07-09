import os
import time
import pygame


class TileSheetBuilder(object):
    def __init__(self):
        super(TileSheetBuilder, self).__init__()

        self.colorkey_c = None
        self.colorkey_x = None
        self.colorkey_y = None
        self.offset_x = 0
        self.offset_y = 0
        self.spacing_x = 0
        self.spacing_y = 0
        self.rows = -1
        self.cols = -1
        self.width = 0
        self.height = 0

        self._images = []

    def colorkey(self, c_x, y=None):
        """
        colorkey(color) set the alpha color to alpha
        colorkey(x, y)  set the alpha color to the color of the pixel at (x,y)
        """

        if y is None:
            self.colorkey_c = c_x
        else:
            self.colorkey_x = c_x
            self.colorkey_y = y
            self.colorkey_c = None

        return self

    def offset(self, x, y):
        """
        starting position of the tile sheet in the image
        """
        self.offset_x = x;
        self.offset_y = y;
        return self

    def spacing(self, x, y):
        """
        space between each tile
        """
        self.spacing_x = x;
        self.spacing_y = y;
        return self

    def dimensions(self, w, h):
        """
        size of each tile
        """
        self.width = w;
        self.height = h;
        return self

    def layout(self, rows, cols):
        """
        number of rows and columns
        set to -1 to mean as many as possible
        """
        self.rows = rows;
        self.cols = cols;
        return self

    def build(self, path):
        """
        it is faster to load a png with an alpha layer already set
        than to load an image and use a color key
        """

        #t0 = time.time()
        if not os.path.exists(path):
            raise FileNotFoundError(path)
        if isinstance(path, str):
            sheet = pygame.image.load(path)
            if path.lower().endswith(".png"):
                sheet = sheet.convert_alpha()
        else:
            sheet = path

        if self.height == 0:
            raise ValueError("set height")

        if self.width == 0:
            raise ValueError("set width")

        cols = self.cols
        rows = self.rows

        if cols < 0:
            cols = (sheet.get_width() - self.offset_x) // (self.width + self.spacing_x)

        if rows < 0:
            rows = (sheet.get_height() - self.offset_y) // (self.height + self.spacing_y)

        images = []

        colorkey = None

        if self.colorkey_c is None:
            if self.colorkey_x is not None:
                colorkey = sheet.get_at((self.colorkey_x,self.colorkey_y))
        else:
            colorkey = self.colorkey_c

        if colorkey is not None:
            sheet.set_colorkey(self.colorkey_c, pygame.RLEACCEL)

        for i in range(rows):
            for j in range(cols):

                x = self.offset_x + (self.width + self.spacing_x) * j
                y = self.offset_y + (self.height + self.spacing_y) * i

                rect = pygame.Rect(x,y,self.width, self.height)
                image = pygame.Surface(rect.size).convert_alpha()
                image.fill((0,0,0,0))
                image.blit(sheet, (0, 0), rect)

                images.append(image)

        self.nrows = rows
        self.ncols = cols

        #print("elapsed: %.2f" % (time.time() - t0))

        return images


def palette_swap(surface, colormap):

    surface = surface.copy()
    for x in range(surface.get_width()):
        for y in range(surface.get_height()):
            p = (x,y)
            c = surface.get_at(p)
            c = (c.r, c.g, c.b)
            if c in colormap:
                surface.set_at(p, colormap[c])
    return surface

def load_image(path):
    surface = pygame.image.load(path)
    surface = surface.convert_alpha()
    return surface

def make_variations():

    characters = ["Ninja Frog", "Mask Dude", "Pink Man", "Virtual Guy"]

    frog_blue = {
        (204, 48, 72): (86, 96, 209),
        (228, 74, 74): (118, 125, 218),
        (156, 27, 77): (63, 72, 204),
    }

    frog_orange = {
        (204, 48, 72): (255, 128, 0),
        (228, 74, 74): (255, 168, 81),
        (156, 27, 77): (234, 117, 0),
    }

    frog_purple = {
        (204, 48, 72): (176, 70, 240),
        (228, 74, 74): (216, 163, 248),
        (156, 27, 77): (157, 26, 236),

        (  7,  96,  41): (39, 88, 58),
        ( 40, 134,  15): (58, 131, 87),
        (114, 161,  29): (72, 164, 108),
        (164, 204,  66): (122, 197, 152),
    }


    mask_green_head = {
        # blue leaf
        (47, 172, 218): (51, 145, 34),
        (108, 217, 241): (64, 181, 43),
        # pink leaf
        (234, 113, 189): (40, 162, 77),
        (248, 156, 192): (50, 201, 96),
        # body
        (251, 223, 177): (192, 244, 211),
        (242, 188, 126): ( 85, 186,  10),
        (230, 141,  65): ( 72, 157,   9),
    }

    mask_red_head = {
        # blue leaf
        (47, 172, 218): (234, 117, 0),
        (108, 217, 241): (255, 128, 0),
        # pink leaf
        (234, 113, 189): (156, 27, 77),
        (248, 156, 192): (204, 48, 72),
        # body
        (251, 223, 177): (251, 214, 176),
        (242, 188, 126): (242, 167, 125),
        (230, 141,  65): (230, 107,  66),
    }

    mask_blue_head = {
        # blue leaf
        (47, 172, 218): (234, 117, 0),
        (108, 217, 241): (255, 128, 0),
        # pink leaf
        (234, 113, 189): ( 47, 172, 218),
        (248, 156, 192): (108, 217, 241),
        # body
        (251, 223, 177): (251, 214, 176),
        (242, 188, 126): (242, 167, 125),
        (230, 141,  65): (230, 107,  66),
    }

    pink_orange = {
        (248, 156, 192):  (255, 128, 0),
        (234, 113, 189):  (234, 117, 0),
    }

    pink_blue = {
        (248, 156, 192): (108, 217, 241),
        (234, 113, 189): ( 47, 172, 218),
    }

    pink_purple = {
        (248, 156, 192): (176, 70, 240),
        (234, 113, 189): (157, 26, 236),
    }

    blue_red = {
        (172, 247, 250): (228, 74, 74),
        (108, 217, 241): (204, 48, 72),
        ( 47, 172, 218): (156, 27, 77),
    }

    blue_orange = {
        (172, 247, 250): (255, 168, 81),
        (108, 217, 241): (255, 128, 0),
        ( 47, 172, 218): (234, 117, 0),
    }

    blue_purple = {
        (172, 247, 250): (216, 163, 248),
        (108, 217, 241): (176, 70, 240),
        ( 47, 172, 218): (157, 26, 236),
    }

    variations = {
        "Ninja Frog": [frog_blue, frog_orange, frog_purple],
        "Mask Dude": [mask_green_head, mask_red_head, mask_blue_head],
        "Pink Man": [pink_orange, pink_blue, pink_purple],
        "Virtual Guy": [blue_red, blue_orange, blue_purple],
    }

def flip_one(path, outpath):

    print(outpath)

    if '32x32' in path:
        shape = (32,32)
    elif '96x96' in path:
        shape = (96,96)
    else:
        raise ValueError("size not in path name")

    images = TileSheetBuilder().dimensions(*shape).build(path)

    size = (shape[0]*len(images), shape[1])
    surface = pygame.Surface(size, pygame.SRCALPHA, 32).convert_alpha()

    for i, image in enumerate(images):
        x = i * shape[0]
        y = 0
        image = pygame.transform.flip(image, True, False)
        surface.blit(image, (x,y))

    dirpath = os.path.split(outpath)[0]
    if not os.path.exists(dirpath):
        os.makedirs(dirpath)

    pygame.image.save(surface, outpath)

def flip_sprites():

    characters = [
        # "Ninja Frog"
        "Mask Dude",
        "Pink Man",
        "Virtual Guy",
    ]

    sheets = [
        "Appearing (96x96).png",
        "Disappearing (96x96).png",
    ]

    for sheetname in sheets:
        path = f"./default/right/{sheetname}"
        outpath = f"./default/left/{sheetname}"
        flip_one(path, outpath)

    sheets = [
        "Double Jump (32x32).png",
        "Fall (32x32).png",
        "Hit (32x32).png",
        "Idle (32x32).png",
        "Jump (32x32).png",
        "Run (32x32).png",
        "Wall Jump (32x32).png",
    ]

    for charname in characters:
        for sheetname in sheets:
            path = f"./{charname}/0/right/{sheetname}"
            outpath = f"./{charname}/0/left/{sheetname}"
            flip_one(path, outpath)




def main():
    os.environ["SDL_VIDEODRIVER"] = "dummy"
    pygame.init()
    pygame.display.init()
    screen = pygame.display.set_mode((1, 1))

    flip_sprites()

if __name__ == '__main__':
    main()