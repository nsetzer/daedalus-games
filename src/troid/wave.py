import matplotlib.pyplot as plt
import numpy as np
import math

def rotate(point, angle):
    """
    Rotate a point counterclockwise by a given angle around a given origin.

    The angle should be given in radians.
    """
    px, py = point
    qx = math.cos(angle) * (px) - math.sin(angle) * (py)
    qy = math.sin(angle) * (px) + math.cos(angle) * (py)
    return qx, qy

def rotate_points(points, angle):
    return [rotate(point, angle) for point in points]

def get_velocity(points, p):
    x,y = zip(*points)
    x0 = 0
    y0 = 0
    vx = []
    vy = []
    for i,(px, py) in enumerate(zip(x[1:p+1], y[1:p+1])):
        vx.append(px - x0)
        vy.append(py - y0)
        x0 = px
        y0 = py
    return list(zip(vx, vy))

N = 50
p = 24
t = [x for x in range(60)]
x = [240/60*i for i in t]
y1 = [8*math.sin(i/p * math.pi * 2) for i in t]
y2 = [8*-math.sin(i/p * math.pi * 2) for i in t]
y3 = [0 for i in t]

plt.scatter(x, y1, color='blue', alpha=0.5)
plt.scatter(x, y2, color='cyan', alpha=0.5)
plt.scatter(x, y3, color='grey', alpha=0.5)

v1 = get_velocity(zip(x, y1), p)
v2 = get_velocity(zip(x, y2), p)
v3 = get_velocity(zip(x, y3), p)

tax, tay = 0,0
for (ax,ay), (bx,by), (cx,cy) in zip(v3,v1,v2):
    print(f"[[{ax:9.6f},{ay:9.6f}], [{bx:9.6f},{by:9.6f}], [{cx:9.6f},{cy:9.6f}]],")
    tax += ax
    tay += ay
print("n=",len(v1))
print(tax, tay)
print((tax**2 + tay**2)**0.5)
print("--")

points1 = rotate_points(zip(x, y1), 45*math.pi/180)
points2 = rotate_points(zip(x, y2), 45*math.pi/180)
points3 = rotate_points(zip(x, y3), 45*math.pi/180)

plt.scatter(*zip(*points1), color='red', alpha=0.5)
plt.scatter(*zip(*points2), color='pink', alpha=0.5)
plt.scatter(*zip(*points3), color='grey', alpha=0.5)

v1 = get_velocity(points1, p)
v2 = get_velocity(points2, p)
v3 = get_velocity(points3, p)

tax, tay = 0,0
for (ax,ay), (bx,by), (cx,cy) in zip(v3,v1,v2):
    print(f"[[{ax:9.6f},{ay:9.6f}], [{bx:9.6f},{by:9.6f}], [{cx:9.6f},{cy:9.6f}]],")
    tax += ax
    tay += ay
print(tax, tay)
print((tax**2 + tay**2)**0.5)
print("--")

plt.xlim([-120,120])
plt.ylim([-120,120])
plt.axvline(x = 0, color = 'black')
plt.axhline(y = 0, color = 'black')
plt.show()