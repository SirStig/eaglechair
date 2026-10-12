# Configurable 3D product models

Models for the admin **3D Studio** (`/admin/3d-viewer`) are binary glTF
(`.glb`) files built in Blender from a per-chair spec. The studio dresses any
model whose materials carry glTF extras (Blender custom properties, exported
with "Include > Custom Properties"):

- `ec_slot`: the part a catalog option applies to: `upholstery`, `frame`
  (wood finishes), `metal` (metal finishes) or `top` (table-top laminates)
- `ec_kind`: the maps the model ships with (`fabric`, `leather`, `wood`, ...)

Untagged models fall back to material names (`seat`, `frame`, `chrome_base`,
`table_top`, ...), and any part can be reassigned in the studio's Part tab
(saved per model).

Each catalog option renders as a material **kind** (fabric, vinyl, leather,
wood stain, painted, metal, chrome, brushed, powder coat, solid / woodgrain
laminate). Each kind has a default material: a built-in one (neutral CC0 maps
in `frontend/public/materials3d/`, tinted with the option's colour) or one
uploaded to the studio's Materials library: a glTF material (`.glb`), loose
PBR maps, or an ambientCG / Poly Haven `.zip` (maps are recognised by name:
`Color`, `NormalGL` / `NormalDX`, `Roughness`, `Metalness`, `AO`, `arm`).
Single options can be assigned their own material, and laminates with a
swatch scan tile the scan by default.

Uploaded models and materials have their embedded textures downscaled to
2048 px and re-encoded on upload. The viewer also reads Draco / meshopt /
KTX2 compressed files (decoders in `frontend/public/libs/`, copied from
`three/examples/jsm/libs`), so `gltf-transform optimize` output works as is.

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
  - `sweep`: a section swept along a path, open or closed: footrings,
    bent-tube frames, seat bands, rods; `channel_profile` for folded
    sheet-metal legs. `squircle_path` / `ellipse_path` for rings.
  - `shell`: a bent sheet (plywood back, stamped steel seat or skirt) with
    an exact outline, cut-outs (hand slots, drain holes) and a rolled edge
  - `subd_pad(..., round_front, round_back)`: round or horseshoe seats
  - `metal_material`, `plain_material`, `dome`: steel frames; hardware
    (bolts, glides, brass kick plates) that stays as modelled
  - `pbr_material`, `finish`: materials with the viewer's extras (fabric
    gets cloth sheen tinted by its colour), join per slot, export
- `build_<model>.py`: one per chair: measurements (inches) and parts.
  A family member can import another spec and override it
  (`build_5246.py` is the 6246 chair raised to bar height).
  Built so far: 6430 Empire State, 6246 Abruzzo, 5246 Abruzzo Barstool,
  3550 Normandie.
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

4. Check it in the admin 3D Studio with several upholsteries and finishes,
   then upload the `.glb` there.

AI image-to-3D (TRELLIS.2) was tried first and rejected: it produces one
fused, lighting-baked shell, so parts can't be separated cleanly or re-textured.
