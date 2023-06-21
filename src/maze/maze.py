

"""

https://www.astrolog.org/labyrnth/algrithm.htm

rooms:
corners are always walls
middle regions of each wall may be a door
one door per wall
1-4 walls get to keep a door.

    cc???cc
    c     c
    ?     ?
    c     c
    cc???cc

prims algorithm
randomly place rooms
fix room walls
uncarve dead ends
    amount of uncarving can be a function of location in the maze
    to have sparse or dense areas in the map


Growing Tree Algorithm

    Let C be a list of cells, initially empty. Add one cell to C, at random.
    Choose a cell from C, and carve a passage to any unvisited neighbor of that cell,
        adding that neighbor to C as well.
        If there are no unvisited neighbors, remove the cell from C.
    Repeat #2 until C is empty.


"""
import random

class MazeGenerator:


    def __init__(self, width, height):

        self.width = width
        self.height = height
        self.rooms = []

        if width%2==0 or height%2==0:
            raise ValueError("shape must be odd (%d,%d)" % (width, height))

    def init(self):

        self.cells = [[1 for i in range(self.width)] for j in range(self.height)]
        self.visited = [[0 for i in range(self.width)] for j in range(self.height)]

        # fill in all edges as walls,
        # provide spaces to carve corridors
        for j in range(self.height):
            for i in range(self.width):
                if i%2==1 and j%2==1:
                    self.cells[j][i] = 2

    def generate(self):



        # randomly choose an odd pair from 1 .. self.width -1
        # randomly choose an odd pair from 1 .. self.height -1
        x = self.width-2#random.randrange(self.width)
        y = self.height-2#random.randrange(self.height)
        self.visited[y][x] = 1

        C = [(x,y)]

        while True:
            if not C:
                break
            i = random.randrange(len(C))
            #i = len(C) - 1
            #i = 0
            cx, cy = C[i]

            n = list(self.neighbors2(cx, cy))
            random.shuffle(n)

            carved = False
            for x, y, bx, by in n:
                if self.visited[y][x]==0:
                    self.cells[by][bx] = 2
                    self.visited[y][x] = 1
                    C.append((x, y))
                    carved = True
                    break

            if not carved:
                del C[i]

    def uncarve(self):

        for j in range(self.height):
            for i in range(self.width):
                if self.cells[j][i] == 2:
                    neighbors = self.neighbors1(i, j)
                    n = sum(self.cells[y][x]==1 for x, y in neighbors)
                    if n == 3:
                        self._uncarve(i, j)

    def _uncarve(self, x, y):

        # TODO: decide random chance to uncarve
        # always completely uncarve when decided
        # three disttributions
        # uniform (high medium low)
        # triangle x or y
        # inverted triangle x or y
        if random.random() > .25:
            return

        for k in range(3):
            print("uncarve", " "*k, x, y)
            self.cells[y][x] = 1

            found = False
            for i, j in self.neighbors1(x, y):
                if self.cells[j][i] == 2:
                    n = sum(self.cells[ny][nx]==1 for nx, ny in self.neighbors1(i, j))
                    if n == 3:
                        x, y = i,j
                        found = True
                    break
            if not found:
                break

    def connect(self):
        # connect dead ends by breaking the wall

        for j in range(self.height):
            for i in range(self.width):
                if self.cells[j][i] == 2:
                    neighbors = self.neighbors1(i, j)
                    n = sum(self.cells[y][x]==1 for x, y in neighbors)
                    if n == 3:
                        self._connect(i, j)

    def _connect(self, x, y):

        if random.random() > .25:
            return

        for ax, ay, bx, by in self.neighbors2(x, y):
            if self.cells[ay][ax] == 2 and self.cells[by][bx] == 1:
                print("connect")
                self.cells[by][bx] = 2

    def neighbors1(self, x, y):

        x1 = x - 1
        x2 = x + 1
        y1 = y - 1
        y2 = y + 1

        if x1 >= 0:
            yield (x1, y)

        if y1 >= 0:
            yield (x, y1)

        if x2 < self.width:
            yield (x2, y)

        if y2 < self.height:
            yield (x, y2)

    def neighbors2(self, x, y):

        x1 = x - 2
        x2 = x + 2
        y1 = y - 2
        y2 = y + 2

        if x1 >= 0:
            yield (x1, y, x-1, y)

        if y1 >= 0:
            yield (x, y1, x, y-1)

        if x2 < self.width:
            yield (x2, y, x+1, y)

        if y2 < self.height:
            yield (x, y2, x, y+1)

    def addroom(self):

        # minimum room size is 4x5 or 5x4
        #
        w = random.randrange(5, 9, 2)
        h = random.randrange(5, 9, 2)

        w1 = w//2
        w2 = w - w1
        h1 = h//2
        h2 = h - h1

        cx = random.randrange(2 + w1, self.width - w2, 2)
        cy = random.randrange(2 + h1, self.height - h2, 2)

        #cx = 1 + w1
        #cy = 1 + h1

        #cx = self.width - w2 - 1
        #cy = self.height - h2 - 1

        rt = cy - h1
        rb = cy + h2
        rl = cx - w1
        rr = cx + w2

        candidates = {k:[] for k in "ltrb"}

        for j in range(rt+1, rb-1):

            x1 = rl - 1
            x2 = rr

            if x1 > 1 and self.cells[j][x1] == 2:
                candidates['l'].append((rl, j))

            if x2 < self.width - 1 and self.cells[j][x2] == 2:
                candidates['r'].append((rr-1, j))

        for i in range(rl+1, rr-1):

            y1 = rt - 1
            y2 = rb

            if y1 > 1 and self.cells[y1][i] == 2:
                candidates['t'].append((i, rt))

            if y2 < self.height - 1 and self.cells[y2][i] == 2:
                candidates['b'].append((i, rb-1))

        # room cannot be placed because there are no doors
        if all(len(seq)==0 for seq in candidates.values()):
            print("failed to place room")
            return

        for j in range(rt, rb):
            for i in range(rl, rr):
                self.cells[j][i] = 2
                self.visited[j][i] = 1

        #  this can be relaxed...
        # four corners are required for a room.
        # at least 1 door in one wall must be kept open
        #
        # no more than 1 door within 5 cells... ???
        #
        self.cells[rt  ][rl  ] = 4
        self.cells[rt  ][rr-1] = 4
        self.cells[rb-1][rl  ] = 4
        self.cells[rb-1][rr-1] = 4

        for j in range(rt+1, rb-1):
            self.cells[j][rl] = 4
            self.cells[j][rr-1] = 4
        for i in range(rl+1, rr-1):
            self.cells[rt][i] = 4
            self.cells[rb-1][i] = 4

        # randomly place a door
        for p, seq in candidates.items():
            if seq:
                px, py = random.choice(seq)
                self.cells[py][px] = 2

        self.rooms.append((rl,rt, rr-rl, rb-rt))
        print("added room", self.rooms[-1])


        #self.cells[cy-2][cx+2] = 3
        #self.cells[cy-2][cx+1] = 3
        #self.cells[cy-1][cx+2] = 3
        #self.cells[cy+2][cx-2] = 3
        #self.cells[cy+2][cx-1] = 3
        #self.cells[cy+1][cx-2] = 3
        #self.cells[cy+2][cx+2] = 3
        #self.cells[cy+2][cx+1] = 3
        #self.cells[cy+1][cx+2] = 3


    def print(self):
        for row in self.cells:

            print("|" + "".join([".# $+d"[c] for c in row]) + "|")
        print()


def main():

    g = MazeGenerator(21, 21)
    g.init()
    g.addroom()
    g.print()
    g.generate()
    g.uncarve()
    g.connect()
    g.print()

if __name__ == '__main__':
    main()