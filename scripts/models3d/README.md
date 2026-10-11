# Configurable 3D product models

Models for the admin **3D Viewer** (`/admin/3d-viewer`) are binary glTF
(`.glb`) files built in Blender from a per-chair spec. The viewer swaps
upholstery and finishes on any model whose materials carry glTF extras:

- `ec_slot`: `upholstery` or `frame` (the part an option applies to)
- `ec_kind`: `fabric`, `leather` or `wood` (the maps the model ships with)

Each part uses neutral, tileable PBR maps (grain, normal, roughness) tinted
through its base colour, so an option only supplies a colour and, when needed,
a different map set from `frontend/public/materials3d/`.

## The kit

- `chairkit.py`: shared building blocks
  - `loft`: rounded-rectangle sections stacked along an axis (legs, posts,
    rails, stretchers). Centre, size and corner radius change per station, so
    one loft makes a sabre leg that runs on into a raked, stepped back post.
    Wood grain follows the part's length.
  - `round_ends`, `fillet`: eased ends; rounded Art Deco shoulders
  - `subd_pad`: upholstered pads (seats, back panels): a box cage with
    support loops, Catmull-Clark subdivided. Clean quad top, rolled edges,
    tuck, bulge and crown. (Concentric-ring pads crease along the corner
    diagonals, which shows as an X in the viewer's reflections.)
  - `welt`: piping around a panel
  - `pbr_material`, `finish`: materials with the viewer's extras (fabric
    gets cloth sheen tinted by its colour), join per slot, export
- `build_<model>.py`: one per chair: measurements (inches) and parts
- `compare.py`: renders the model from each product photo's viewpoint and
  pairs photo | render, the check that a model matches the real chair
- `render_views.py`: quick turntable renders
- `make_fabric.py`: generates the tintable upholstery weave maps

## Workflow for a chair

1. Gather the product photos (several angles; same configuration).
2. Copy the closest `build_*.py` and set its measurements and parts.
3. Build, then compare against the photos and adjust until they match:

```bash
blender -b -P scripts/models3d/build_6430.py -- "$PWD/6430.glb"
blender -b -P scripts/models3d/compare.py -- "$PWD/6430.glb" "$PWD/cmp" \
  front.webp:-90:6 front34.webp:-125:10 rear34.webp:55:8 back.webp:90:4
```

`AZ:EL` per photo: camera direction around the chair (-90 front, 90 back,
0 = the chair's +x side) and height, in degrees.

4. Check it in the admin 3D Viewer with several upholsteries and finishes,
   then upload the `.glb` there.

AI image-to-3D (TRELLIS.2) was tried first and rejected: it produces one
fused, lighting-baked shell, so parts can't be separated cleanly or re-textured.
