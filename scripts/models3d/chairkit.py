"""chairkit: building blocks for configurable chair models in Blender.

A chair spec (e.g. build_6430.py) describes its parts in inches with these
helpers; the kit turns them into smooth, UV-mapped meshes and exports a glTF
the admin 3D Viewer can configure.

Shapes
  loft(...)       rounded-rectangle sections stacked along an axis: legs,
                  posts, rails, stretchers. Centre, size and corner radius can
                  change per station, so one call makes a sabre leg that runs
                  on into a raked, stepped back post. Grain follows the length.
  round_ends(...) quarter-round end stations for a loft
  fillet_step(...) stations for an outside step (Art Deco crest) with a
                  rounded corner
  pillow(...)     concentric rings from an outline to a crowned centre:
                  seat cushions, upholstered back panels
  welt(...)       piping cord around a rounded-rectangle outline

Every shape takes a `to_world(a, b, h)` mapping from its local frame, so the
same cushion code works for a seat (flat) or a raked back panel.

Materials carry glTF extras the viewer reads: ec_slot (upholstery | frame)
and ec_kind (wood | fabric | leather).
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

IN = 0.0254
SHEEN = 0.5   # cloth sheen strength (viewer: sheenColor = fabric colour x SHEEN)
PBR = str(Path(__file__).resolve().parents[2] / "frontend" / "public" / "materials3d")


# ---- 2D outlines --------------------------------------------------------------
def rrect(cx, cy, w, h, r, n=6):
    """Rounded rectangle, CCW from the +x side. Always 4 * (n + 1) points, so
    rings of different sizes line up vertex for vertex."""
    r = max(0.02, min(r, w / 2 - 1e-3, h / 2 - 1e-3))
    pts = []
    for ccx, ccy, a0 in [(cx + w / 2 - r, cy + h / 2 - r, 0), (cx - w / 2 + r, cy + h / 2 - r, 90),
                         (cx - w / 2 + r, cy - h / 2 + r, 180), (cx + w / 2 - r, cy - h / 2 + r, 270)]:
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    return pts


# ---- mesh assembly --------------------------------------------------------------
class Part:
    """One mesh part being built (inches), with UVs written as faces are made."""

    def __init__(self, name, slot):
        self.name, self.slot = name, slot
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")

    def face(self, verts, uvs=None):
        f = self.bm.faces.new(verts)
        if uvs:
            for loop, uv in zip(f.loops, uvs):
                loop[self.uv].uv = uv
        return f

    def rings(self, rings, vs, tile, cap_start=True, cap_end=True, length_on_u=False, uvs=None):
        """Join rings (lists of Vector, equal length) with quads. U runs around
        each ring by arc length, V along `vs`; both in tiles of `tile` inches.
        length_on_u swaps them (the wood maps' grain runs along U). `uvs`
        ([[(u, v)] per ring]) overrides both with an explicit layout."""
        bm = self.bm
        vrings = [[bm.verts.new(p) for p in ring] for ring in rings]
        n = len(rings[0])
        us = []
        for ring in rings:
            acc, u = 0.0, [0.0]
            for k in range(n):
                acc += (ring[(k + 1) % n] - ring[k]).length
                u.append(acc)
            us.append(u)
        uv = (lambda u, v: (v / tile, u / tile)) if length_on_u else (lambda u, v: (u / tile, v / tile))
        for j in range(len(rings) - 1):
            for k in range(n):
                k1 = (k + 1) % n
                if uvs:
                    face_uvs = [uvs[j][k], uvs[j][k1], uvs[j + 1][k1], uvs[j + 1][k]]
                else:
                    face_uvs = [uv(us[j][k], vs[j]), uv(us[j][k + 1], vs[j]),
                                uv(us[j + 1][k + 1], vs[j + 1]), uv(us[j + 1][k], vs[j + 1])]
                self.face([vrings[j][k], vrings[j][k1], vrings[j + 1][k1], vrings[j + 1][k]], face_uvs)
        def cap(ring_v, reverse):
            vs_ = ring_v[::-1] if reverse else ring_v
            c = sum((v.co for v in vs_), Vector()) / len(vs_)
            if max((v.co - c).length for v in vs_) < 1e-4:
                return
            if uvs:
                ring_uvs = uvs[0] if ring_v is vrings[0] else uvs[-1]
                face_uvs = ring_uvs[::-1] if reverse else ring_uvs
            else:
                face_uvs = [((v.co.x + v.co.y) / tile, (v.co.z + v.co.y) / tile) for v in vs_]
            self.face(vs_, face_uvs)
        if cap_start:
            cap(vrings[0], True)
        if cap_end:
            cap(vrings[-1], False)
        return vrings

    def to_object(self, material):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        me.transform(Matrix.Scale(IN, 4))
        me.materials.append(material)
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob["slot"] = self.slot
        return ob


# ---- lofts ---------------------------------------------------------------------
AXES = {
    # axis: (index of the length axis, indices of the section's (a, b) axes)
    "x": (0, (1, 2)),
    "y": (1, (0, 2)),
    "z": (2, (0, 1)),
}


def loft(part, stations, axis="z", tile=16, n=5, caps=(True, True)):
    """stations: [(t, ca, cb, sa, sb, r)] — position along `axis`, section
    centre (a, b), section size (a, b) and corner radius, all inches. Section
    axes: z → (x, y), x → (y, z), y → (x, z)."""
    li, (ai, bi) = AXES[axis]
    rings, vs = [], []
    for t, ca, cb, sa, sb, r in stations:
        ring = []
        for pa, pb in rrect(ca, cb, sa, sb, r, n):
            co = [0.0, 0.0, 0.0]
            co[li], co[ai], co[bi] = t, pa, pb
            ring.append(Vector(co))
        rings.append(ring)
        vs.append(t)
    # Wood grain runs along the part's length
    return part.rings(rings, vs, tile, *caps, length_on_u=True)


def round_ends(stations, r_start=0.0, r_end=0.0, steps=4):
    """Add quarter-round ends of radius r_* to a station list sorted by t:
    the section shrinks by up to 2r toward each end, like an eased end grain."""
    out = list(stations)

    def shrink(st, t, red):
        _, ca, cb, sa, sb, cr = st
        return (t, ca, cb, max(sa - red, 0.05), max(sb - red, 0.05), max(cr - red / 2, 0.02))

    if r_start > 0:
        first, t0 = out[0], out[0][0]
        ext = [shrink(first, t0 + r_start - r_start * math.cos(math.radians(90 * k / steps)),
                      2 * r_start * (1 - math.sin(math.radians(90 * k / steps)))) for k in range(steps)]
        out = ext + [(t0 + r_start,) + first[1:]] + [st for st in out if st[0] > t0 + r_start]
    if r_end > 0:
        last, t1 = out[-1], out[-1][0]
        ext = [shrink(last, t1 - r_end + r_end * math.cos(math.radians(90 * k / steps)),
                      2 * r_end * (1 - math.sin(math.radians(90 * k / steps)))) for k in range(steps - 1, -1, -1)]
        out = [st for st in out if st[0] < t1 - r_end] + [(t1 - r_end,) + last[1:]] + ext
    return out


def fillet(z0, z1, a, b, steps=5):
    """Values easing from a to b between z0 and z1 with a quarter-round
    (convex) shoulder: returns [(z, value)]."""
    out = []
    for k in range(steps + 1):
        phi = math.radians(90 * k / steps)
        out.append((z0 + (z1 - z0) * math.sin(phi), a + (b - a) * (1 - math.cos(phi))))
    return out


# ---- upholstery ------------------------------------------------------------------
def pillow(part, w, h, corner_r, edge, crown, to_world, tile=9, n=8, inner_rings=16, cap_base=True):
    """Upholstered pad: concentric rounded-rectangle rings from the outline in.

    edge: [(inset, height)] for the rolled edge, from the base outline up to
    the point where the top turns flat (see edge_profile). Inside that, the
    top rises by `crown` in a smooth dome that depends on position, not on
    distance to the edge — a distance-based dome would crease along the
    corner diagonals. to_world(a, b, height) -> Vector (inches)."""
    rings, vs = [], []
    top_in, top_h = edge[-1]
    ha, hb = w / 2 - top_in, h / 2 - top_in          # the flat-top area the dome covers
    deepest = min(w, h) / 2 - 0.3

    def dome(a, b):
        # Superellipse distance: contours are rounded rectangles, so the dome
        # has no ridges along the diagonals (a product of 1D bumps pinches
        # there and shows as an X in reflections).
        r = min(1.0, ((abs(a) / ha) ** 4 + (abs(b) / hb) ** 4) ** 0.25)
        return crown * (1 - 3 * r * r + 2 * r ** 3)   # zero slope at the centre and the edge

    insets = [(i, hgt, False) for i, hgt in edge]
    insets += [(top_in + (deepest - top_in) * k / inner_rings, top_h, True) for k in range(1, inner_rings + 1)]
    # UVs: the pad's face laid flat, with the rolled edge unfolded outward by
    # its length along the profile, so the fabric runs one way everywhere
    # (concentric UVs would turn the weave and its normal map per side).
    unfold = [0.0] * len(insets)
    for j in range(len(edge) - 2, -1, -1):
        unfold[j] = unfold[j + 1] + math.dist(edge[j], edge[j + 1])
    uvs = []
    for inset, hgt, domed in insets:
        wi, hi = w - 2 * inset, h - 2 * inset
        # The outline keeps its corner radius; inner rings round off toward an
        # ellipse so the mesh lines follow the dome.
        f = min(1.0, max(0.0, (inset / deepest - 0.35) / 0.65))
        f = f * f * (3 - 2 * f)
        r_edge = max(corner_r - inset * 0.6, 0.05)
        pts = rrect(0, 0, wi, hi, r_edge + (0.45 * min(wi, hi) - r_edge) * f, n)
        rings.append([to_world(a, b, hgt + (dome(a, b) if domed else 0.0)) for a, b in pts])
        vs.append(inset + hgt)
        out = unfold[len(uvs)]
        ring_uv = []
        for k, (a, b) in enumerate(pts):
            pa, pb = pts[k - 1], pts[(k + 1) % len(pts)]
            tx, ty = pb[0] - pa[0], pb[1] - pa[1]
            L = math.hypot(tx, ty) or 1.0
            ring_uv.append(((a + ty / L * out) / tile, (b - tx / L * out) / tile))
        uvs.append(ring_uv)
    return part.rings(rings, vs, tile, cap_start=cap_base, cap_end=True, uvs=uvs)


def subd_pad(name, slot, material, w, h, t, to_world, edge_r=1.0, bottom_r=0.3, tuck=0.0,
             bulge=0.0, crown=0.0, levels=3, tile=8, inner=6):
    """Upholstered pad modelled the furniture way: a box cage with support
    loops, Catmull-Clark subdivided. The top is a clean quad grid (no
    diagonal creases), edges and corners roll over with radius ~edge_r.

    w x h is the pad's footprint in its local (a, b) plane, t its thickness;
    tuck pulls the bottom edge in, bulge pushes the sides out, crown domes
    the top. to_world(a, b, height) -> Vector (inches). UVs lay the top flat
    and unfold the sides outward, so the weave runs one way everywhere."""
    def cuts(L, e):
        half = L / 2
        inner_pts = [-half + e + (L - 2 * e) * k / inner for k in range(1, inner)]
        return [-half + e] + inner_pts + [half - e]

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * h, (v.co.z + 0.5) * t))
    geom = lambda: bm.verts[:] + bm.edges[:] + bm.faces[:]
    for a in cuts(w, edge_r):
        bmesh.ops.bisect_plane(bm, geom=geom(), plane_co=(a, 0, 0), plane_no=(1, 0, 0))
    for b in cuts(h, edge_r):
        bmesh.ops.bisect_plane(bm, geom=geom(), plane_co=(0, b, 0), plane_no=(0, 1, 0))
    for z in (bottom_r, t * 0.5, t - edge_r):
        if 0 < z < t:
            bmesh.ops.bisect_plane(bm, geom=geom(), plane_co=(0, 0, z), plane_no=(0, 0, 1))

    ha, hb = w / 2 - edge_r, h / 2 - edge_r
    for v in bm.verts:
        a, b, z = v.co
        on_side = abs(abs(a) - w / 2) < 1e-4 or abs(abs(b) - h / 2) < 1e-4
        if z > t - 1e-4 and not on_side:
            r = min(1.0, ((abs(a) / ha) ** 4 + (abs(b) / hb) ** 4) ** 0.25)
            v.co.z += crown * (1 - 3 * r * r + 2 * r ** 3)
        if on_side:
            fa = math.copysign(1, a) if abs(abs(a) - w / 2) < 1e-4 else 0
            fb = math.copysign(1, b) if abs(abs(b) - h / 2) < 1e-4 else 0
            if z < 1e-4:
                v.co.x -= fa * tuck
                v.co.y -= fb * tuck
            elif abs(z - t * 0.5) < 1e-4:
                v.co.x += fa * bulge
                v.co.y += fb * bulge

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new("subd", "SUBSURF")
    mod.levels = mod.render_levels = levels
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)

    me = ob.data
    local = [v.co.copy() for v in me.vertices]
    normals = [v.normal.copy() for v in me.vertices]
    uv = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        co, n = local[loop.vertex_index], normals[loop.vertex_index]
        nh = Vector((n.x, n.y))
        out = max(0.0, t + crown - co.z) if nh.length > 1e-3 else 0.0
        if nh.length > 1e-3:
            nh.normalize()
        uv.data[loop.index].uv = ((co.x + nh.x * out) / tile, (co.y + nh.y * out) / tile)
    for v, co in zip(me.vertices, local):
        v.co = to_world(co.x, co.y, co.z) * IN
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    for poly in me.polygons:
        poly.use_smooth = True
    ob["slot"] = slot
    return ob


def edge_profile(tuck, bulge_h, edge_t, round_r):
    """Rolled upholstery edge: tucked bottom, bulging side, quarter-round
    over to a flat top at height edge_t, inset round_r from the outline."""
    prof = [(tuck, 0.0), (tuck * 0.35, bulge_h * 0.4), (0.0, bulge_h)]
    for k in range(1, 10):
        phi = math.radians(90 * k / 9)
        prof.append((round_r - round_r * math.cos(phi), edge_t - round_r + round_r * math.sin(phi)))
    return prof


def welt(part, w, h, corner_r, height, radius, to_world, segs=10, n=8):
    """Piping cord following a rounded-rectangle outline at `height`."""
    path = rrect(0, 0, w, h, corner_r, n)
    dense = []
    for i, p in enumerate(path):
        q = path[(i + 1) % len(path)]
        L = math.dist(p, q)
        m = max(1, int(L / 0.6))
        dense += [(p[0] + (q[0] - p[0]) * t / m, p[1] + (q[1] - p[1]) * t / m) for t in range(m)]
    bm = part.bm
    rings = []
    for i, p in enumerate(dense):
        q, o = dense[(i + 1) % len(dense)], dense[i - 1]
        tx, ty = q[0] - o[0], q[1] - o[1]
        L = math.hypot(tx, ty) or 1
        nx, ny = ty / L, -tx / L                       # outward in the outline plane
        ring = []
        for s in range(segs):
            a = 2 * math.pi * s / segs
            ring.append(bm.verts.new(to_world(p[0] + nx * math.cos(a) * radius,
                                              p[1] + ny * math.cos(a) * radius,
                                              height + math.sin(a) * radius)))
        rings.append(ring)
    for i in range(len(rings)):
        a, b = rings[i], rings[(i + 1) % len(rings)]
        for s in range(segs):
            s1 = (s + 1) % segs
            part.face([a[s], a[s1], b[s1], b[s]],
                      [(i / 4, s / segs), (i / 4, (s + 1) / segs), ((i + 1) / 4, (s + 1) / segs), ((i + 1) / 4, s / segs)])


# ---- materials --------------------------------------------------------------------
def pbr_material(name, slot, kind, tint, normal_strength=0.8):
    m = bpy.data.materials.new(name)
    m["ec_slot"] = slot
    m["ec_kind"] = kind
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    def img(fname, colorspace):
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(f"{PBR}/{fname}")
        node.image.colorspace_settings.name = colorspace
        return node
    alb = img(f"{kind}_albedo.jpg", "sRGB")
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (*tint, 1.0)
    nt.links.new(alb.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    rough = img(f"{kind}_rough.jpg", "Non-Color")
    nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    nrm = img(f"{kind}_normal.jpg", "Non-Color")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = normal_strength
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if kind == "fabric":
        # cloth's soft glow at grazing angles (exported as KHR_materials_sheen)
        # tinted by the fabric colour: white sheen would wash colours out
        bsdf.inputs["Sheen Weight"].default_value = SHEEN
        bsdf.inputs["Sheen Roughness"].default_value = 0.5
        bsdf.inputs["Sheen Tint"].default_value = (*tint, 1.0)
    return m


# ---- assembly / export --------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def finish(objects_by_slot, out_glb, out_blend=None, smooth_angle=50):
    """Join each slot's parts into one mesh, shade smooth by angle, export."""
    for name, objs in objects_by_slot.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = name
        bpy.ops.object.shade_auto_smooth(angle=math.radians(smooth_angle))
    if out_blend:
        bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", export_extras=True,
                              export_image_format="JPEG", export_jpeg_quality=90, export_apply=True)
    print("WROTE", out_glb)
