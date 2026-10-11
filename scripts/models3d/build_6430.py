"""Eagle Chair 6430 "Empire State" side chair, built clean and configurable.

blender -b -P scripts/models3d/build_6430.py -- /abs/path/out.glb [/abs/path/out.blend]

Measurements are inches (estimated from the product photos at ~23 px/in,
overall height 38"); the model is exported in metres. Parts:
  frame (ec_slot=frame, wood):    front legs, raked rear legs, seat apron,
                                  side + cross stretchers, stepped back board
  upholstery (ec_slot=upholstery): crowned seat cushion, welted front and
                                  rear back panels
"""
import bpy, bmesh, sys, math
from pathlib import Path
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "6430.glb"
BLEND = argv[1] if len(argv) > 1 else None
PBR = str(Path(__file__).resolve().parents[2] / "frontend" / "public" / "materials3d")
IN = 0.0254

# ---- dimensions (inches) -------------------------------------------------
H = 38.0            # overall height
W = 17.8            # outer width at the legs / back board
LEG = 1.5           # leg section
Y_FRONT = -9.6      # front face of front legs
Y_BACK_FLOOR = 10.6  # back face of rear legs at the floor
Y_BACK_SEAT = 8.4   # back face of rear legs at the seat (legs splay back)
APRON_TOP, APRON_H, APRON_T = 16.4, 3.0, 0.8
CUSH_T, CUSH_CROWN = 1.5, 1.0
BOARD_T = 1.3       # back board thickness
RAKE = 3.2          # how far the top of the back sits behind its base
STEPS = [(33.6, 0.0), (35.9, 0.6), (H, 1.4)]   # (top z of band, inset per side)
PANEL_SIDE, PANEL_TOP = 2.2, 1.0               # front panel border
PANEL_T, WELT_R = 0.55, 0.13
STRETCH_Z = 5.0


def back_offset(z):
    """Rake of the back above the seat: y offset (in) at height z."""
    if z <= APRON_TOP:
        return 0.0
    t = (z - APRON_TOP) / (H - APRON_TOP)
    return RAKE * t ** 1.6


# ---- mesh helpers ----------------------------------------------------------
def new_obj(name, bm, slot):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.transform(Matrix.Scale(IN, 4))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob["slot"] = slot
    return ob


def box_bm(bm, corners):
    """8 corners: bottom quad (ccw from above) then top quad."""
    vs = [bm.verts.new(c) for c in corners]
    for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
        bm.faces.new([vs[i] for i in f])


def aabb(x0, x1, y0, y1, z0, z1):
    return [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]


def bevel(ob, width_in, segments=2, limit="ANGLE"):
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width_in * IN
    m.segments = segments
    m.limit_method = limit
    m.harden_normals = False
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)


# ---- frame -----------------------------------------------------------------
def build_frame_parts():
    parts = []
    hx = W / 2
    # front legs
    for sx in (-1, 1):
        bm = bmesh.new()
        x0, x1 = (hx - LEG, hx) if sx > 0 else (-hx, -hx + LEG)
        box_bm(bm, aabb(x0, x1, Y_FRONT, Y_FRONT + LEG, 0, APRON_TOP))
        parts.append(("leg_front", bm, "z"))
    # rear legs, splayed back toward the floor
    for sx in (-1, 1):
        bm = bmesh.new()
        x0, x1 = (hx - LEG, hx) if sx > 0 else (-hx, -hx + LEG)
        yb0, yb1 = Y_BACK_FLOOR - LEG, Y_BACK_FLOOR
        yt0, yt1 = Y_BACK_SEAT - LEG, Y_BACK_SEAT
        box_bm(bm, [(x0, yb0, 0), (x1, yb0, 0), (x1, yb1, 0), (x0, yb1, 0),
                    (x0, yt0, APRON_TOP), (x1, yt0, APRON_TOP), (x1, yt1, APRON_TOP), (x0, yt1, APRON_TOP)])
        parts.append(("leg_rear", bm, "z"))
    # seat apron (inset a little from the leg faces)
    z0, inset = APRON_TOP - APRON_H, 0.15
    yf, yr = Y_FRONT + LEG, Y_BACK_SEAT - LEG
    for name, c, axis in [
        ("apron_front", aabb(-hx + LEG, hx - LEG, Y_FRONT + inset, Y_FRONT + inset + APRON_T, z0, APRON_TOP), "x"),
        ("apron_back", aabb(-hx + LEG, hx - LEG, yr + LEG - inset - APRON_T, yr + LEG - inset, z0, APRON_TOP), "x"),
        ("apron_left", aabb(-hx + inset, -hx + inset + APRON_T, yf, yr, z0, APRON_TOP), "y"),
        ("apron_right", aabb(hx - inset - APRON_T, hx - inset, yf, yr, z0, APRON_TOP), "y"),
    ]:
        bm = bmesh.new(); box_bm(bm, c); parts.append((name, bm, axis))
    # stretchers: one per side, two cross bars between them
    rear_y_at = lambda z: Y_BACK_FLOOR - LEG - (Y_BACK_FLOOR - Y_BACK_SEAT) * z / APRON_TOP
    st_h, st_t = 1.0, 0.75
    for sx in (-1, 1):
        xc = sx * (hx - LEG / 2)
        bm = bmesh.new()
        box_bm(bm, aabb(xc - st_t / 2, xc + st_t / 2, Y_FRONT + LEG, rear_y_at(STRETCH_Z), STRETCH_Z, STRETCH_Z + st_h))
        parts.append(("stretcher_side", bm, "y"))
    for yc in (-0.6, 2.4):
        bm = bmesh.new()
        box_bm(bm, aabb(-hx + LEG / 2 + st_t / 2, hx - LEG / 2 - st_t / 2, yc - 0.375, yc + 0.375,
                        STRETCH_Z + 0.12, STRETCH_Z + 0.12 + 0.75))
        parts.append(("stretcher_cross", bm, "x"))
    return parts


def build_back_board():
    """Stepped Art Deco back board: a 2D mask on an irregular grid, extruded,
    then bent back by back_offset(z)."""
    hx = W / 2
    z_base = APRON_TOP
    zs = sorted(set([z_base] + [s[0] for s in STEPS] + [z_base + i * 1.0 for i in range(int(H - z_base) + 1)]))
    zs = [z for z in zs if z <= H]
    xs = sorted(set(v for _, ins in STEPS for v in (-hx + ins, hx - ins)))

    def inside(xm, zm):
        for top, ins in STEPS:
            if zm <= top:
                return -hx + ins <= xm <= hx - ins
        return False

    y_back = Y_BACK_SEAT          # back face of the board lines up with the rear legs
    y_front = y_back - BOARD_T
    bm = bmesh.new()
    vcache = {}

    def v(x, z, front):
        key = (round(x, 4), round(z, 4), front)
        if key not in vcache:
            vcache[key] = bm.verts.new((x, y_front if front else y_back, z))
        return vcache[key]

    cells = {(i, j) for i in range(len(xs) - 1) for j in range(len(zs) - 1)
             if inside((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)}
    for i, j in cells:
        x0, x1, z0, z1 = xs[i], xs[i + 1], zs[j], zs[j + 1]
        bm.faces.new([v(x0, z0, True), v(x1, z0, True), v(x1, z1, True), v(x0, z1, True)])
        bm.faces.new([v(x0, z0, False), v(x0, z1, False), v(x1, z1, False), v(x1, z0, False)])
        # side walls where the neighbour cell is empty
        if (i - 1, j) not in cells:
            bm.faces.new([v(x0, z0, True), v(x0, z1, True), v(x0, z1, False), v(x0, z0, False)])
        if (i + 1, j) not in cells:
            bm.faces.new([v(x1, z0, True), v(x1, z0, False), v(x1, z1, False), v(x1, z1, True)])
        if (i, j - 1) not in cells:
            bm.faces.new([v(x0, z0, True), v(x0, z0, False), v(x1, z0, False), v(x1, z0, True)])
        if (i, j + 1) not in cells:
            bm.faces.new([v(x0, z1, True), v(x1, z1, True), v(x1, z1, False), v(x0, z1, False)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for vert in bm.verts:
        vert.co.y += back_offset(vert.co.z)
    return bm


# ---- upholstery --------------------------------------------------------------
def pillow_bm(x0, x1, z0, z1, y_base, thick, direction, nx=40, nz=56, edge=0.9):
    """Upholstered panel: flat back on the board, rounded crowned face."""
    bm = bmesh.new()
    grid = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            z = z0 + (z1 - z0) * j / nz
            d = min(x - x0, x1 - x, z - z0, z1 - z)          # distance to edge
            r = min(1.0, d / edge)
            prof = math.sqrt(max(0.0, 1 - (1 - r) ** 2))       # quarter-round edge
            u, w = (x - (x0 + x1) / 2) / ((x1 - x0) / 2), (z - (z0 + z1) / 2) / ((z1 - z0) / 2)
            crown = 0.18 * (1 - u * u) * (1 - w * w)
            row.append(bm.verts.new((x, y_base + direction * (thick * prof * 0.75 + thick * 0.25 + crown), z)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx):
            q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            bm.faces.new(q if direction < 0 else q[::-1])
    # thin side skirt down to the board so no gap shows
    ring = [grid[0][i] for i in range(nx + 1)] + [grid[j][nx] for j in range(1, nz + 1)] + \
           [grid[nz][i] for i in range(nx - 1, -1, -1)] + [grid[j][0] for j in range(nz - 1, 0, -1)]
    base = [bm.verts.new((p.co.x, y_base, p.co.z)) for p in ring]
    n = len(ring)
    for k in range(n):
        q = [ring[k], ring[(k + 1) % n], base[(k + 1) % n], base[k]]
        bm.faces.new(q if direction < 0 else q[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def welt_bm(x0, x1, z0, z1, y, radius, segs=10):
    """Piping cord around a panel edge."""
    bm = bmesh.new()
    pts = []
    corner_r = 0.35
    for (cx, cz, a0) in [(x1 - corner_r, z0 + corner_r, -90), (x1 - corner_r, z1 - corner_r, 0),
                         (x0 + corner_r, z1 - corner_r, 90), (x0 + corner_r, z0 + corner_r, 180)]:
        for k in range(5):
            a = math.radians(a0 + 90 * k / 4)
            pts.append(Vector((cx + corner_r * math.cos(a), cz + corner_r * math.sin(a))))
    # subdivide long edges so the bend follows smoothly
    dense = []
    for i, p in enumerate(pts):
        q = pts[(i + 1) % len(pts)]
        n = max(1, int((q - p).length / 0.8))
        dense += [p.lerp(q, t / n) for t in range(n)]
    rings = []
    for i, p in enumerate(dense):
        q, o = dense[(i + 1) % len(dense)], dense[i - 1]
        t = (q - o).normalized()
        nrm = Vector((t.y, -t.x))
        ring = []
        for s in range(segs):
            a = 2 * math.pi * s / segs
            off2 = nrm * math.cos(a) * radius
            ring.append(bm.verts.new((p.x + off2.x, y + math.sin(a) * radius, p.y + off2.y)))
        rings.append(ring)
    for i in range(len(rings)):
        a, b = rings[i], rings[(i + 1) % len(rings)]
        for s in range(segs):
            bm.faces.new([a[s], a[(s + 1) % segs], b[(s + 1) % segs], b[s]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bend_bm(bm):
    for vert in bm.verts:
        vert.co.y += back_offset(vert.co.z)


def build_upholstery():
    parts = []
    hx = W / 2
    y_front = Y_BACK_SEAT - BOARD_T
    # front back panel: from just above the cushion to under the top border
    top_ins = STEPS[-1][1]
    px0, px1 = -hx + PANEL_SIDE, hx - PANEL_SIDE
    pz0, pz1 = APRON_TOP + CUSH_T - 0.4, H - PANEL_TOP
    bm = pillow_bm(px0, px1, pz0, pz1, y_front, PANEL_T, -1)
    bend_bm(bm); parts.append(("panel_front", bm))
    bm = welt_bm(px0, px1, pz0, pz1, y_front - 0.08, WELT_R)
    bend_bm(bm); parts.append(("welt_front", bm))
    # rear panel (the black border shows below it)
    rz0 = APRON_TOP + 1.6
    bm = pillow_bm(px0, px1, rz0, pz1, Y_BACK_SEAT, PANEL_T * 0.6, 1)
    bend_bm(bm); parts.append(("panel_rear", bm))
    bm = welt_bm(px0, px1, rz0, pz1, Y_BACK_SEAT + 0.08, WELT_R)
    bend_bm(bm); parts.append(("welt_rear", bm))
    # seat cushion
    bm = bmesh.new()
    cy0, cy1 = Y_FRONT - 0.25, y_front - 0.05
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((v.co.x + 0.5) * (W + 0.3) - (W + 0.3) / 2,
                       cy0 + (v.co.y + 0.5) * (cy1 - cy0),
                       APRON_TOP + (v.co.z + 0.5) * CUSH_T))
    # resolution for the crown; the bevel only rounds the box edges
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=14, use_grid_fill=True)
    parts.append(("cushion", bm))
    return parts


# ---- UVs -----------------------------------------------------------------------
def box_uv(ob, grain_axis, tile_in):
    """Box projection in part space; grain (texture U) follows grain_axis."""
    me = ob.data
    uv = me.uv_layers.new(name="UVMap")
    ax = {"x": 0, "y": 1, "z": 2}
    g = ax.get(grain_axis, 2)
    tile = tile_in * IN
    for poly in me.polygons:
        n = poly.normal
        dom = max(range(3), key=lambda i: abs(n[i]))
        rest = [i for i in range(3) if i != dom]
        u_ax = g if g in rest else rest[0]
        v_ax = [i for i in rest if i != u_ax][0]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[u_ax] / tile, co[v_ax] / tile)


# ---- materials -------------------------------------------------------------------
def pbr_material(name, slot, kind, tint):
    m = bpy.data.materials.new(name)
    m["ec_slot"] = slot
    m["ec_kind"] = kind
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    def img(fname, colorspace):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(f"{PBR}/{fname}")
        n.image.colorspace_settings.name = colorspace
        return n
    alb = img(f"{kind}_albedo.jpg", "sRGB")
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (*tint, 1.0)
    nt.links.new(alb.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    rough = img(f"{kind}_rough.jpg", "Non-Color")
    nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    nrm = img(f"{kind}_normal.jpg", "Non-Color")
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.8
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    frame_mat = pbr_material("EC_Frame", "frame", "wood", (0.02, 0.018, 0.016))      # black lacquer, as photographed
    uph_mat = pbr_material("EC_Upholstery", "upholstery", "fabric", (0.75, 0.22, 0.05))  # orange suede, as photographed

    frame_objs, uph_objs = [], []
    for name, bm, axis in build_frame_parts():
        ob = new_obj(name, bm, "frame"); bevel(ob, 0.09, 2); box_uv(ob, axis, 24); frame_objs.append(ob)
    ob = new_obj("back_board", build_back_board(), "frame")
    bevel(ob, 0.12, 3); box_uv(ob, "z", 24); frame_objs.append(ob)

    for name, bm in build_upholstery():
        ob = new_obj(name, bm, "upholstery")
        if name == "cushion":
            bevel(ob, 1.0, 10)
            # soft pad: broad crown, bottom stays flat on the apron
            cy0, cy1 = (Y_FRONT - 0.25) * IN, (Y_BACK_SEAT - BOARD_T - 0.05) * IN
            yc, hy, hx = (cy0 + cy1) / 2, (cy1 - cy0) / 2, (W + 0.3) / 2 * IN
            for v in ob.data.vertices:
                h = (v.co.z / IN - APRON_TOP) / CUSH_T
                u, w = min(1, abs(v.co.x) / hx), min(1, abs(v.co.y - yc) / hy)
                v.co.z += CUSH_CROWN * IN * h * (1 - u * u) * (1 - w ** 4)
        box_uv(ob, "x", 9)
        uph_objs.append(ob)

    for ob in frame_objs:
        ob.data.materials.append(frame_mat)
    for ob in uph_objs:
        ob.data.materials.append(uph_mat)

    # Join per slot, smooth by angle
    def join(objs, name):
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = name
        bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
        return ob
    join(frame_objs, "frame")
    join(uph_objs, "upholstery")
    if BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True,
                              export_image_format="JPEG", export_jpeg_quality=90, export_apply=True)
    print("WROTE", OUT)


main()
