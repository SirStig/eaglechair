"""Render a chair model from each reference photo's viewpoint and pair them.

blender -b -P scripts/models3d/compare.py -- model.glb out_dir photo.webp:AZ:EL [photo.webp:AZ:EL ...]

AZ is the camera's direction around the chair in degrees (-90 = straight on
from the front, 90 = from behind, 0 = from the chair's +x side), EL its
height in degrees. Each render uses a long lens like a product shot, on white,
in the model's own (as-photographed) colours. Writes out_dir/compare.jpg with
photo | render pairs, both cropped to the chair and scaled to the same height.
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
glb, out_dir, views = args[0], Path(args[1]), args[2:]
out_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(p[i] for p in pts) for i in range(3)])
hi = Vector([max(p[i] for p in pts) for i in range(3)])
centre, size = (lo + hi) / 2, (hi - lo).length

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 64
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 700, 900
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
# a grey world: product studios are dark around the set, and metal
# mirrors its surroundings (a white world turns steel white)
world.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.35, 0.36, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
for loc, energy in [((1.5, -3, 3), 500), ((-3, -2, 2), 250), ((0, 3, 3), 200)]:
    light = bpy.data.objects.new("l", bpy.data.lights.new("l", "AREA"))
    light.data.energy, light.data.size = energy, 3
    light.location = loc
    light.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(light)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 85
sc.collection.objects.link(cam)
sc.camera = cam


def crop_to_content(img, alpha=None):
    """img: HxWx3 uint8 (white background) or with an alpha mask."""
    if alpha is None:
        mask = (255 - img.min(axis=2)) > 18
    else:
        mask = alpha > 20
    ys, xs = np.nonzero(mask)
    return img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def load_rgb(path):
    im = bpy.data.images.load(str(path))
    w, h = im.size
    px = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[::-1]
    rgb, a = px[:, :, :3], px[:, :, 3]
    rgb = rgb * a[:, :, None] + (1 - a[:, :, None])           # onto white
    if im.colorspace_settings.name != "sRGB":
        pass
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8), (a * 255).astype(np.uint8)


def save_rgb(arr, path):
    h, w, _ = arr.shape
    im = bpy.data.images.new("out", w, h)
    rgba = np.dstack([arr.astype(np.float32) / 255, np.ones((h, w), np.float32)])[::-1]
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = str(path)
    im.file_format = "JPEG"
    im.save()


pairs = []
for i, view in enumerate(views):
    photo, az, el = view.rsplit(":", 2)
    t, e = math.radians(float(az)), math.radians(float(el))
    cam.location = centre + Vector((math.cos(t) * math.cos(e), math.sin(t) * math.cos(e), math.sin(e))) * size * 3.2
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    render_path = out_dir / f"render_{i}.png"
    sc.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    rgb, a = load_rgb(render_path)
    rend = crop_to_content(rgb, a)
    ph, _ = load_rgb(photo)
    ph = crop_to_content(ph)
    pairs.append((ph, rend))

# Lay out: each pair side by side at a common height, pairs left to right
H = 520


def scale(img, h):
    ys = (np.arange(h) * img.shape[0] / h).astype(int)
    w = max(1, int(img.shape[1] * h / img.shape[0]))
    xs = (np.arange(w) * img.shape[1] / w).astype(int)
    return img[ys][:, xs]


cols = []
for ph, rend in pairs:
    a, b = scale(ph, H), scale(rend, H)
    gap = np.full((H, 12, 3), 255, np.uint8)
    cols += [a, gap, b, np.full((H, 40, 3), 200, np.uint8)]
sheet = np.concatenate(cols[:-1], axis=1)
pad = np.full((20, sheet.shape[1], 3), 255, np.uint8)
save_rgb(np.concatenate([pad, sheet, pad]), out_dir / "compare.jpg")
print("WROTE", out_dir / "compare.jpg")
