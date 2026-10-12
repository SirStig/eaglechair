"""Eagle Chair 5246 "Abruzzo" barstool (wood back).

blender -b -P scripts/models3d/build_5246.py -- /abs/out.glb [/abs/out.blend]

The 6246 Abruzzo chair raised to bar height: same back shell, seat ring and
bolts (build_6246.py), with longer splayed legs, two footrings, a thicker,
squarer seat pad and a front footrest with a brass kick plate. Inches,
estimated from the product photos (seat height 30").
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_6246 as abruzzo  # noqa: E402
import chairkit as ck  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
abruzzo.OUT = argv[0] if argv else str(Path.cwd() / "5246.glb")
abruzzo.BLEND = argv[1] if len(argv) > 1 else None

# Everything from the seat up moves up by DZ
DZ = 11.0
abruzzo.H += DZ
abruzzo.RING_Z0 += DZ
abruzzo.SHELL_Z0 += DZ
# the barstool back is narrower at the top, with straighter sides
_z0, _z1 = abruzzo.SHELL_Z0 - DZ, abruzzo.H - DZ
abruzzo.SHELL_SIDE = [(s * (1 - 0.25 * ((z - _z0) / (_z1 - _z0)) ** 1.2), z + DZ) for s, z in abruzzo.SHELL_SIDE]
abruzzo.SLOT = dict(abruzzo.SLOT, z0=abruzzo.SLOT["z0"] + DZ + 0.4, z1=abruzzo.SLOT["z1"] + DZ + 0.4, half_w=5.6)
abruzzo.LEG_TOP_Z = abruzzo.RING_Z0 + 0.3

# Thicker, squarer pad (barstool seats are rounded squares, not round)
abruzzo.PAD_T, abruzzo.PAD_CROWN = 2.4, 0.6
abruzzo.PAD_SHAPE = dict(edge_r=1.0, bottom_r=0.5, tuck=0.3, bulge=0.2, round_front=0.45, round_back=0.2)
abruzzo.FRAME_TINT = (0.012, 0.010, 0.009)     # black, as photographed
abruzzo.UPH_TINT = (0.10, 0.10, 0.10)          # dark grey vinyl

# Longer legs splay further; two footrings
abruzzo.LEG_TOP_D, abruzzo.LEG_FOOT_D = 1.6, 1.15
cy = abruzzo.SEAT_CY
abruzzo.LEGS = {
    "front": ((6.2, cy - 5.3), (8.1, cy - 9.0)),
    "back": ((5.9, cy + 5.5), (7.9, cy + 10.4)),
}
abruzzo.FOOTRINGS = [(23.0, 0.75), (16.8, 0.75)]
FOOTREST_Z = 12.0


def footrest(parts):
    """Wood bar between the front legs, under the brass kick plate."""
    (tx, ty), (fx, fy) = abruzzo.LEGS["front"]
    x, y = abruzzo.leg_at((tx, ty), (fx, fy), FOOTREST_Z)
    p = ck.Part("footrest", "frame")
    ck.loft(p, [(t, y, FOOTREST_Z, 0.9, 1.1, 0.3) for t in (-x, 0, x)], "x")
    parts.append(p)


def kick_plate(parts):
    (tx, ty), (fx, fy) = abruzzo.LEGS["front"]
    x, y = abruzzo.leg_at((tx, ty), (fx, fy), FOOTREST_Z)
    brass = ck.plain_material("Brass", (0.78, 0.6, 0.3), metallic=1.0, roughness=0.3)
    p = ck.Part("kick_plate", "hardware")
    w = 2 * x - 1.4
    ck.loft(p, [(t, y - 0.1, FOOTREST_Z + 0.6, 1.0, 0.16, 0.06) for t in (-w / 2, 0, w / 2)], "x")
    parts.append((p, brass))


if __name__ == "__main__":
    abruzzo.main(extra_frame=footrest, extra_hardware=kick_plate)
