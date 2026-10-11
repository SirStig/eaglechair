# Configurable 3D product models

Models for the admin **3D Viewer** (`/admin/3d-viewer`) are binary glTF
(`.glb`) files built in Blender. The viewer swaps upholstery and finishes on
any model whose materials carry glTF extras:

- `ec_slot`: `upholstery` or `frame` (the part an option applies to)
- `ec_kind`: `fabric`, `leather` or `wood` (the maps the model ships with)

Each part uses neutral, tileable PBR maps (grain, normal, roughness) and is
tinted through its base colour, so an option only supplies a colour and, when
needed, a different map set from `frontend/public/materials3d/`.

## Building

```bash
blender -b -P scripts/models3d/build_6430.py -- "$PWD/6430.glb" "$PWD/6430.blend"
blender -b -P scripts/models3d/render_views.py -- "$PWD/6430.glb" "$PWD/views" -90:12 55:14 -125:15
```

`build_6430.py` is a parametric build of the 6430 Empire State chair; its
dimensions (inches, top of file) were estimated from the product photos. New
chairs start as a copy with their own parts and measurements. Upload the
`.glb` in the admin 3D Viewer.

AI image-to-3D (TRELLIS.2) was tried first and rejected: it produces one
fused, lighting-baked shell, so parts can't be separated cleanly or re-textured.
