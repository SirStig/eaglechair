"""Eagle Chair 3550 "Normandie" steel chair (Tolix style).

blender -b -P scripts/models3d/build_3550.py -- /abs/out.glb [/abs/out.blend]

Inches, estimated from the product photos (seat height 18"). The chair
faces -y; z is up. All steel is one configurable metal part (ec_slot=metal):
  stamped seat plate with drain holes; skirt panels with arched lower
  edges; four folded-channel legs that form the rounded skirt corners and
  taper to the floor; bent-tube hoop back, raked; curved back splat;
  X-rods under the seat. Black glides on the feet (not configurable).
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chairkit as ck  # noqa: E402
from mathutils import Vector  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else str(Path.cwd() / "3550.glb")
BLEND = argv[1] if len(argv) > 1 else None

# ---- measurements (inches) -------------------------------------------------
SEAT_Z = 18.0            # top of the seat plate
SEAT_HALF = 7.6          # seat plate half width (square)
CORNER_R = 1.6           # skirt corner radius (= leg channel radius at the top)
SHEET = 0.08             # steel thickness
SKIRT_MID_Z = 15.6       # skirt bottom edge at the middle of each side
ARCH_LOW_Z = 12.6        # where the arch meets the legs
LEG_FOOT = 9.3           # leg (corner centre) position at the floor, each axis
FOOT_R = 0.65            # channel radius at the floor
H = 33.6                 # top of the hoop
HOOP_D = 0.55
HOOP_FOOT_Y = 2.8        # where the hoop meets the seat sides
HOOP_TOP_Y = 13.0        # how far back the top of the hoop sits
HOOP_CORNER = 4.2
SPLAT_W0, SPLAT_W1 = 5.8, 4.9   # splat width at the seat / at the top
ROD_Z, ROD_D = 12.2, 0.32

C = SEAT_HALF - CORNER_R          # corner centres at (±C, ±C)


def leg_centre(z):
    """Corner-channel centre: straight down the skirt, then splayed out."""
    if z >= ARCH_LOW_Z:
        return C
    t = z / ARCH_LOW_Z
    return LEG_FOOT + (C - LEG_FOOT) * t


def leg_shape(z):
    """(radius, span in degrees) of the channel arc at height z."""
    if z >= ARCH_LOW_Z:
        return CORNER_R, 92.0
    t = (z / ARCH_LOW_Z) ** 0.8
    return FOOT_R + (CORNER_R - FOOT_R) * t, 120 + (92 - 120) * t


def legs(part):
    for sx in (-1, 1):
        for sy in (-1, 1):
            th = math.atan2(sy, sx)
            rings, vs = [], []
            zs = [0.0, 0.4] + [ARCH_LOW_Z * k / 10 for k in range(1, 11)] + [14.5, 16.5, SEAT_Z]
            for z in sorted(set(zs)):
                c = leg_centre(z)
                r, span = leg_shape(z)
                n = 14
                outer, inner = [], []
                for k in range(n + 1):
                    a = th + math.radians(span) * (k / n - 0.5)
                    outer.append(Vector((sx * c + r * math.cos(a), sy * c + r * math.sin(a), z)))
                    inner.append(Vector((sx * c + (r - SHEET) * math.cos(a), sy * c + (r - SHEET) * math.sin(a), z)))
                rings.append(outer + inner[::-1])
                vs.append(z)
            part.rings(rings, vs, 16, cap_start=True, cap_end=False)


def skirt(part):
    """Four flat side panels between the corner channels, arched below."""
    half = C

    def bottom(s):
        u = min(1.0, abs(s) / half)
        return ARCH_LOW_Z + (SKIRT_MID_Z - ARCH_LOW_Z) * math.sqrt(max(0.0, 1 - u ** 2.4))   # rounded arch

    pts = [(half * (k / 12 * 2 - 1), 0) for k in range(13)]
    outline = [(s, bottom(s)) for s, _ in pts] + [(half, SEAT_Z - 0.05), (-half, SEAT_Z - 0.05)]
    for ang in range(4):
        th = math.radians(90 * ang)
        nx, ny = math.cos(th), math.sin(th)     # outward normal of this side
        tx, ty = -ny, nx

        def to_world(s, z, d, nx=nx, ny=ny, tx=tx, ty=ty):
            return Vector((nx * (SEAT_HALF - d) + tx * s, ny * (SEAT_HALF - d) + ty * s, z))
        ck.shell(part, outline, [], SHEET, to_world, step=0.2, rim_steps=3)


def seat_plate(part):
    """Square seat plate with rounded corners, slightly dished, drain holes."""
    sq = ck.rounded_poly([(SEAT_HALF, -SEAT_HALF), (SEAT_HALF, SEAT_HALF),
                          (-SEAT_HALF, SEAT_HALF), (-SEAT_HALF, -SEAT_HALF)], CORNER_R, 8)
    holes = []
    for hx, hy in [(-2.2, 1.2), (0, 1.2), (2.2, 1.2), (-1.1, -0.8), (1.1, -0.8), (0, -2.6)]:
        holes.append([(hx + 0.22 * math.cos(2 * math.pi * k / 10), hy + 0.22 * math.sin(2 * math.pi * k / 10))
                      for k in range(10)])

    def to_world(x, y, d):
        u, v = x / SEAT_HALF, y / SEAT_HALF
        dish = 0.35 * max(0.0, 1 - u * u) * max(0.0, 1 - v * v)
        return Vector((x, y, SEAT_Z - dish - d))
    ck.shell(part, sq, holes, SHEET * 1.5, to_world, step=0.2, rim_steps=4)


def hoop_y(z):
    t = max(0.0, (z - SEAT_Z + 0.5) / (H - SEAT_Z + 0.5))
    return HOOP_FOOT_Y + (HOOP_TOP_Y - HOOP_FOOT_Y) * t ** 1.25


def hoop(part):
    """Bent tube: up one side (raked, flaring a little), over, down."""
    def side_x(z):
        t = max(0.0, (z - SEAT_Z) / (H - SEAT_Z))
        return SEAT_HALF + HOOP_D / 2 + 0.7 * t

    left = []
    z_corner = H - HOOP_CORNER
    for k in range(24):
        z = SEAT_Z - 1.2 + (z_corner - (SEAT_Z - 1.2)) * k / 23
        left.append(Vector((-side_x(z), hoop_y(z), z)))
    top = []
    cx = side_x(z_corner) - HOOP_CORNER
    for k in range(1, 12):
        a = math.radians(180 - 90 * k / 12)
        z = z_corner + HOOP_CORNER * math.sin(a)
        top.append(Vector((cx * -1 + HOOP_CORNER * math.cos(a) + 0 * cx, hoop_y(z), z)))
    top += [Vector((x, hoop_y(H), H)) for x in [(-cx + 2 * cx * k / 10) for k in range(11)]]
    for k in range(1, 12):
        a = math.radians(90 - 90 * k / 12)
        z = z_corner + HOOP_CORNER * math.sin(a)
        top.append(Vector((cx + HOOP_CORNER * math.cos(a), hoop_y(z), z)))
    right = [Vector((-p.x, p.y, p.z)) for p in reversed(left)]
    ck.sweep(part, left + top + right, HOOP_D, HOOP_D, HOOP_D / 2, up=(0, 1, 0))


def splat_y(z):
    t = max(0.0, (z - SEAT_Z) / (H - 0.6 - SEAT_Z))
    return SEAT_HALF - 0.1 + (HOOP_TOP_Y - HOOP_D / 2 - (SEAT_HALF - 0.1)) * t ** 1.35


def splat(part):
    z0, z1 = SEAT_Z - 0.6, H - 0.35
    outline = ck.rounded_poly([(SPLAT_W0 / 2, z0), (SPLAT_W1 / 2, z1), (-SPLAT_W1 / 2, z1), (-SPLAT_W0 / 2, z0)], 0.4, 4)

    def to_world(s, z, d):
        return Vector((s, splat_y(z) + s * s / 30 + d, z))
    ck.shell(part, outline, [], SHEET * 1.5, to_world, step=0.2, rim_steps=4)


def seat_bead(part):
    """Rolled edge along the top of the seat, where plate meets skirt."""
    path = ck.rounded_poly([(SEAT_HALF, -SEAT_HALF), (SEAT_HALF, SEAT_HALF),
                            (-SEAT_HALF, SEAT_HALF), (-SEAT_HALF, -SEAT_HALF)], CORNER_R, 10)
    ck.sweep(part, [Vector((x, y, SEAT_Z - 0.22)) for x, y in path], 0.5, 0.5, 0.25, closed=True)


def rods(part):
    for sy in (-1, 1):
        # run through to the inside of the channel wall (the channel is open
        # toward the chair, its steel on the outer diagonal at radius r)
        r, _ = leg_shape(ROD_Z)
        c = leg_centre(ROD_Z) + (r - SHEET * 2) / math.sqrt(2)
        z = ROD_Z + (0.35 if sy > 0 else 0)
        ck.sweep(part, [Vector((-c, -sy * c, z)), Vector((0, 0, z)), Vector((c, sy * c, z))],
                 ROD_D, ROD_D, ROD_D / 2)


def main():
    ck.reset_scene()
    steel = ck.metal_material("EC_Metal", "metal", "metal", (0.56, 0.57, 0.6), roughness=0.3)  # galvanized
    p = ck.Part("steel", "metal")
    legs(p)
    skirt(p)
    seat_plate(p)
    hoop(p)
    splat(p)
    seat_bead(p)
    rods(p)
    glides = ck.Part("glides", "hardware")
    for sx in (-1, 1):
        for sy in (-1, 1):
            ck.dome(glides, (sx * (LEG_FOOT + 0.2), sy * (LEG_FOOT + 0.2), 0.02), (0, 0, 1), 0.55, 0.25)
    black = ck.plain_material("Glide", (0.02, 0.02, 0.02), roughness=0.6)
    ck.finish({"metal": [p.to_object(steel)], "glides": [glides.to_object(black)]}, OUT, BLEND)


if __name__ == "__main__":
    main()
