"""Eagle Chair 6430 "Empire State" side chair.

blender -b -P scripts/models3d/build_6430.py -- /abs/out.glb [/abs/out.blend]

Inches, estimated from the product photos (overall height 38"). The chair
faces -y; z is up. Built with chairkit:
  frame (wood):        tapered front legs; rear legs that sweep back at the
                       floor and run on as raked back posts with stepped Art
                       Deco shoulders; top and bottom back rails; seat apron;
                       side and double cross stretchers
  upholstery (fabric): crowned, roll-edged seat cushion; welted front and
                       rear back panels between the posts
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chairkit as ck  # noqa: E402
from mathutils import Vector  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else str(Path.cwd() / "6430.glb")
BLEND = argv[1] if len(argv) > 1 else None

# ---- measurements (inches) -------------------------------------------------
H = 38.0                 # overall height
W = 17.8                 # overall width (outer faces of legs / posts)
A = 16.4                 # top of the seat apron
LEG = 1.5                # leg section at the seat
LEG_FOOT = 1.3           # front legs taper to this at the floor
POST_W, POST_D = 2.0, 1.5   # back post section above the seat (width x, depth y)
EDGE_R = 0.32            # rounded-over corners on all frame parts
Y_FRONT = -9.6           # front face of the front legs
Y_BACK_FLOOR = 11.6      # back face of the rear legs at the floor
Y_BACK_SEAT = 8.4        # back face of the rear legs at the seat
RAKE = 4.5               # top of the back sits this far behind its base
# Art Deco shoulders: (z of the step, outer inset above it)
STEPS = [(33.6, 0.6), (35.9, 1.4)]
STEP_R = 0.3
TOP_RAIL_H = 0.75
APRON_H, APRON_T = 3.0, 0.8
STRETCH_Z = 5.0
SEAT = dict(tuck=0.12, bulge_h=0.8, edge_t=2.0, round_r=1.0, crown=0.7, corner_r=1.6)


def back_offset(z):
    """Rake: how far behind the seat-level line the back is at height z."""
    if z <= A:
        return 0.0
    return RAKE * ((z - A) / (H - A)) ** 1.6


def rear_y(z):
    """Centre (y) of the rear leg / back post section at height z. Below the
    seat the leg sweeps back toward the floor and meets the seat vertically,
    so it flows on into the raked post without a kink."""
    ys = Y_BACK_SEAT - POST_D / 2
    if z <= A:
        yb = Y_BACK_FLOOR - POST_D / 2
        s = z / A
        return yb + (ys - yb) * (1 - (1 - s) ** 2)
    return ys + back_offset(z)


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---- frame ------------------------------------------------------------------
def rear_post(sx):
    """Rear leg and back post in one piece. Outer face steps in at the
    shoulders (rounded); inner face is straight, widening from leg to post."""
    zs = [i * 0.5 for i in range(int(H / 0.5) + 1)]
    edge = []                                   # (z, outer inset)
    for z in zs:
        if any(zs_ - STEP_R - 0.05 < z <= zs_ + 0.2 for zs_, _ in STEPS):
            continue
        inset = 0.0
        for zs_, ins in STEPS:
            if z > zs_:
                inset = ins
        edge.append((z, inset))
    prev = 0.0
    for zs_, ins in STEPS:
        edge += ck.fillet(zs_ - STEP_R, zs_, prev, prev + STEP_R)   # rounded shoulder
        edge.append((zs_ + 0.002, ins))                           # the ledge
        prev = ins
    edge.sort()
    stations = []
    for z, inset in edge:
        width = LEG + (POST_W - LEG) * smoothstep(A - 1.5, A + 0.5, z)
        x_out, x_in = W / 2 - inset, W / 2 - width
        stations.append((z, sx * (x_out + x_in) / 2, rear_y(z), x_out - x_in, POST_D, EDGE_R))
    return ck.round_ends(stations, r_start=0.12, r_end=0.35)


def frame_parts():
    parts = []
    # front legs, slightly tapered
    for sx in (-1, 1):
        st = []
        for k in range(9):
            z = A * k / 8
            s = LEG_FOOT + (LEG - LEG_FOOT) * z / A
            st.append((z, sx * (W / 2 - s / 2), Y_FRONT + s / 2, s, s, EDGE_R))
        p = ck.Part("leg_front", "frame")
        ck.loft(p, ck.round_ends(st, r_start=0.15), "z")
        parts.append(p)
    for sx in (-1, 1):
        p = ck.Part("rear_post", "frame")
        ck.loft(p, rear_post(sx), "z")
        parts.append(p)

    # top rail between the posts, under the crest
    zc = H - TOP_RAIL_H / 2
    inner_top = W / 2 - STEPS[-1][1] - 0.3
    p = ck.Part("top_rail", "frame")
    ck.loft(p, [(t, rear_y(zc), zc, POST_D, TOP_RAIL_H, EDGE_R) for t in (-inner_top, 0, inner_top)], "x")
    parts.append(p)
    # bottom back rail (shows below the rear panel)
    zc = A + 0.45
    inner = W / 2 - POST_W + 0.3
    p = ck.Part("back_rail", "frame")
    ck.loft(p, [(t, rear_y(zc) + 0.15, zc, 1.0, 0.9, 0.3) for t in (-inner, 0, inner)], "x")
    parts.append(p)
    # panel board between the posts (hidden behind the panels)
    p = ck.Part("back_board", "frame")
    ck.loft(p, [(z, 0.0, rear_y(z), W - 2 * POST_W + 0.4, 0.5, 0.1)
                for z in [A + 1.5 + (H - TOP_RAIL_H - A - 1.4) * k / 12 for k in range(13)]], "z")
    parts.append(p)

    # seat apron, set in a little from the leg faces
    zc = A - APRON_H / 2
    y_back_out = rear_y(A) + POST_D / 2
    ins = 0.15
    for name, axis, t0, t1, ca, cb, sa, sb in [
        ("apron_front", "x", -(W / 2 - LEG + 0.2), W / 2 - LEG + 0.2, Y_FRONT + ins + APRON_T / 2, zc, APRON_T, APRON_H),
        ("apron_back", "x", -(W / 2 - LEG + 0.2), W / 2 - LEG + 0.2, y_back_out - ins - APRON_T / 2, zc, APRON_T, APRON_H),
        ("apron_left", "y", Y_FRONT + LEG - 0.2, y_back_out - POST_D + 0.2, -(W / 2 - ins - APRON_T / 2), zc, APRON_T, APRON_H),
        ("apron_right", "y", Y_FRONT + LEG - 0.2, y_back_out - POST_D + 0.2, W / 2 - ins - APRON_T / 2, zc, APRON_T, APRON_H),
    ]:
        p = ck.Part(name, "frame")
        ck.loft(p, [(t0, ca, cb, sa, sb, 0.25), (t1, ca, cb, sa, sb, 0.25)], axis)
        parts.append(p)

    # stretchers: one per side, two cross bars between them
    zc = STRETCH_Z + 0.5
    for sx in (-1, 1):
        p = ck.Part("stretcher_side", "frame")
        y0, y1 = Y_FRONT + LEG / 2, rear_y(zc)
        ck.loft(p, [(y0 + (y1 - y0) * k / 4, sx * (W / 2 - LEG / 2), zc, 0.75, 1.0, 0.3) for k in range(5)], "y")
        parts.append(p)
    for yc in (-0.6, 2.4):
        p = ck.Part("stretcher_cross", "frame")
        x = W / 2 - LEG / 2
        ck.loft(p, [(t, yc, zc + 0.12, 0.75, 0.75, 0.3) for t in (-x, 0, x)], "x")
        parts.append(p)
    return parts


# ---- upholstery ----------------------------------------------------------------
def upholstery_parts(mat):
    """Seat cushion and the two back panels (subdivision-surface pads), plus
    the panels' piping. Returns finished objects."""
    objs = []
    # seat cushion: tucked bottom, bulging side, rolled edge, crowned top
    y0 = Y_FRONT - 0.3
    y1 = rear_y(A) - POST_D / 2 - 0.05
    cy, z0 = (y0 + y1) / 2, A - 0.1
    objs.append(ck.subd_pad("cushion", "upholstery", mat, W + 0.2, y1 - y0, SEAT["edge_t"],
                            lambda a, b, h: Vector((a, cy + b, z0 + h)),
                            edge_r=SEAT["round_r"], tuck=SEAT["tuck"], bulge=0.15, crown=SEAT["crown"]))

    # back panels between the posts: front from behind the cushion to the
    # top rail, rear stopping above the bottom rail
    pw = W - 2 * POST_W - 0.1
    welts = ck.Part("welts", "upholstery")
    for name, z0, z1, side, t in [("panel_front", A + 1.0, H - TOP_RAIL_H - 0.05, -1, 0.75),
                                  ("panel_rear", A + 0.95, H - TOP_RAIL_H - 0.05, 1, 0.55)]:
        ph, cz = z1 - z0, (z0 + z1) / 2

        def to_world(a, b, h, cz=cz, side=side):
            z = cz + b
            return Vector((a, rear_y(z) + side * (0.25 + h), z))
        objs.append(ck.subd_pad(name, "upholstery", mat, pw, ph, t, to_world,
                                edge_r=0.45, bottom_r=0.1, crown=0.2))
        ck.welt(welts, pw - 0.1, ph - 0.1, 0.5, 0.1, 0.13, to_world)
    objs.append(welts.to_object(mat))
    return objs


def main():
    ck.reset_scene()
    frame_mat = ck.pbr_material("EC_Frame", "frame", "wood", (0.008, 0.007, 0.006), normal_strength=0.2)          # black, as photographed
    uph_mat = ck.pbr_material("EC_Upholstery", "upholstery", "fabric", (0.42, 0.075, 0.012), normal_strength=1.3)   # orange suede
    frame = [p.to_object(frame_mat) for p in frame_parts()]
    uph = upholstery_parts(uph_mat)
    ck.finish({"frame": frame, "upholstery": uph}, OUT, BLEND)


main()
