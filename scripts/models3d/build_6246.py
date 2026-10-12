"""Eagle Chair 6246 "Abruzzo" side chair (wood back).

blender -b -P scripts/models3d/build_6246.py -- /abs/out.glb [/abs/out.blend]

Inches, estimated from the product photos (catalog width 18"). The chair
faces -y; z is up. Built with chairkit:
  frame (wood):        bent plywood back shell with a hand slot, wrapping
                       the back half of the seat; round seat ring; four
                       splayed, tapered round legs; round footring
  upholstery (fabric): round, crowned seat pad
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chairkit as ck  # noqa: E402
from mathutils import Vector  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else str(Path.cwd() / "6246.glb")
BLEND = argv[1] if len(argv) > 1 else None

# ---- measurements (inches) -------------------------------------------------
H = 32.5                 # overall height (top of the back)
SEAT_RX, SEAT_RY = 8.7, 8.4      # seat ring, half width / half depth
SEAT_CY = -0.6           # seat centre (y)
RING_Z0, RING_H, RING_T = 15.3, 2.1, 0.8     # seat ring: bottom, height, thickness
PAD_T, PAD_CROWN = 1.5, 0.75
SHELL_T = 0.45           # plywood thickness
SHELL_Z0 = 15.2          # bottom of the shell (wraps the seat ring)
R_SEAT, R_TOP = 9.15, 12.0   # plan radius of the shell at the seat / at the top
RAKE = 2.2               # how far the top of the back leans behind its base
SLOT = dict(z0=19.0, z1=21.7, half_w=5.9, r=1.2)
# Shell outline in its own (s = inches around the back, z) coordinates,
# right half, bottom front corner up to the top corner
SHELL_SIDE = [(14.3, SHELL_Z0), (13.6, 18.0), (12.6, 20.5), (11.3, 23.6), (10.5, 26.9),
              (9.9, 29.8), (9.5, 31.7), (9.3, H)]
LEG_TOP_D, LEG_FOOT_D = 1.5, 1.1
LEG_TOP_Z = RING_Z0 + 0.3
LEGS = {   # (x, y) at the top (under the seat ring) and at the floor
    "front": ((6.2, SEAT_CY - 5.3), (8.3, SEAT_CY - 8.8)),
    "back": ((5.9, SEAT_CY + 5.5), (8.0, SEAT_CY + 10.0)),
}
FOOTRINGS = [(5.8, 0.8)]   # (height, tube diameter) per footring
PAD_SHAPE = dict(edge_r=0.7, bottom_r=0.45, tuck=0.35, bulge=0.18, round_front=1.0, round_back=1.0)
FRAME_TINT = (0.075, 0.028, 0.012)   # walnut, as photographed
UPH_TINT = (0.2, 0.19, 0.175)        # grey tweed, as photographed


def rake(z):
    zs = RING_Z0 + RING_H + PAD_T
    if z <= zs:
        return 0.0
    return RAKE * ((z - zs) / (H - zs)) ** 1.3


def shell_world(s, z, d):
    """Plan radius grows with height (the back flattens toward the top),
    the back leans by rake(z); d runs inward through the plywood."""
    t = min(1.0, max(0.0, (z - SHELL_Z0) / (H - SHELL_Z0)))
    R = R_SEAT + (R_TOP - R_SEAT) * t ** 1.5
    th = s / R
    ry = R * (SEAT_RY / SEAT_RX)
    x = R * math.sin(th)
    y = SEAT_CY + ry * math.cos(th) + rake(z) + (R - R_SEAT) * 0.15
    nx, ny = -math.sin(th), -math.cos(th) * (SEAT_RY / SEAT_RX)
    L = math.hypot(nx, ny)
    return Vector((x + nx / L * d, y + ny / L * d, z))


def leg_at(top, foot, z):
    t = z / LEG_TOP_Z
    return (foot[0] + (top[0] - foot[0]) * t, foot[1] + (top[1] - foot[1]) * t)


def frame_parts():
    parts = []
    # back shell
    # counter-clockwise: up the right side, across the top, down the left
    outline = list(SHELL_SIDE) + [(-s, z) for s, z in reversed(SHELL_SIDE)]
    outline = ck.rounded_poly(outline, 2.6)
    slot = ck.rounded_poly([(SLOT["half_w"], SLOT["z0"]), (SLOT["half_w"], SLOT["z1"]),
                            (-SLOT["half_w"], SLOT["z1"]), (-SLOT["half_w"], SLOT["z0"])], SLOT["r"])
    p = ck.Part("shell", "frame")
    ck.shell(p, outline, [slot], SHELL_T, shell_world, step=0.25)
    parts.append(p)

    # seat ring
    p = ck.Part("seat_ring", "frame")
    ck.sweep(p, ck.ellipse_path(0, SEAT_CY, RING_Z0 + RING_H / 2, SEAT_RX - RING_T / 2, SEAT_RY - RING_T / 2, 72),
             RING_T, RING_H, 0.25, closed=True)
    parts.append(p)

    # legs: tapered, splayed both ways
    feet = []
    for key, (top, foot) in LEGS.items():
        for sx in (-1, 1):
            tp, ft = (sx * top[0], top[1]), (sx * foot[0], foot[1])
            st = []
            for k in range(9):
                z = LEG_TOP_Z * k / 8
                cx, cy = leg_at(tp, ft, z)
                d = LEG_FOOT_D + (LEG_TOP_D - LEG_FOOT_D) * z / LEG_TOP_Z
                st.append((z, cx, cy, d, d, d / 2))
            p = ck.Part("leg_" + key, "frame")
            ck.loft(p, ck.round_ends(st, r_start=0.12), "z", n=6)
            parts.append(p)
            feet.append((tp, ft))

    for ring_z, ring_d in FOOTRINGS:
        parts.append(footring([leg_at(tp, ft, ring_z) for tp, ft in feet], ring_z, ring_d))
    return parts


def footring(legs_xy, ring_z, ring_d):
    """Footring through the inner faces of the legs at height ring_z: a
    squircle, rounder than the leg square but without the bulge outside the
    legs that a circle through them would have."""
    leg_r = (LEG_FOOT_D + (LEG_TOP_D - LEG_FOOT_D) * ring_z / LEG_TOP_Z) / 2
    cyr = sum(f[1] for f in legs_xy) / 4
    pts = [(abs(f[0]), abs(f[1] - cyr)) for f in legs_xy]
    pts = [(x * (1 - leg_r / math.hypot(x, y)), y * (1 - leg_r / math.hypot(x, y))) for x, y in pts]
    ax = sum(x for x, _ in pts) / 4
    ay = sum(y for _, y in pts) / 4
    P = 3.0
    rx, ry = ax * 2 ** (1 / P), ay * 2 ** (1 / P)
    p = ck.Part("footring", "frame")
    ck.sweep(p, ck.squircle_path(0, cyr, ring_z, rx, ry, P, 80), ring_d, ring_d, ring_d / 2, closed=True)
    return p


def main(extra_frame=None, extra_hardware=None):
    """extra_frame / extra_hardware let a family member (e.g. the 5246
    barstool) add parts: each receives the Part list to extend."""
    ck.reset_scene()
    frame_mat = ck.pbr_material("EC_Frame", "frame", "wood", FRAME_TINT, normal_strength=0.2)
    uph_mat = ck.pbr_material("EC_Upholstery", "upholstery", "fabric", UPH_TINT, normal_strength=1.3)
    fparts = frame_parts()
    if extra_frame:
        extra_frame(fparts)
    frame = [p.to_object(frame_mat) for p in fparts]
    # chrome bolts fixing the shell to the seat ring
    chrome = ck.plain_material("Chrome", (0.8, 0.8, 0.8), metallic=1.0, roughness=0.18)
    bolts = ck.Part("bolts", "hardware")
    for sx in (-1, 1):
        s_bolt = 13.6
        p_out = shell_world(sx * s_bolt, RING_Z0 + RING_H / 2, 0.0)
        p_in = shell_world(sx * s_bolt, RING_Z0 + RING_H / 2, 1.0)
        ck.dome(bolts, p_out, p_out - p_in, 0.32, 0.16)
    hparts = [bolts]
    if extra_hardware:
        extra_hardware(hparts)
    hardware = [p.to_object(chrome) for p in hparts]
    z0 = RING_Z0 + RING_H - 0.15
    pad = ck.subd_pad("seat", "upholstery", uph_mat, 2 * SEAT_RX - 0.2, 2 * SEAT_RY - 0.2, PAD_T,
                      lambda a, b, h: Vector((a, SEAT_CY + b, z0 + h)), crown=PAD_CROWN, **PAD_SHAPE)
    ck.finish({"frame": frame, "upholstery": [pad], "hardware": hardware}, OUT, BLEND)


if __name__ == "__main__":
    main()
