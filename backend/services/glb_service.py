"""
Binary glTF (.glb) helpers for the admin 3D library.

- read_glb / write_glb: split a .glb into its JSON and binary chunks and back.
- summarize: counts (meshes, materials, vertices, textures) and the
  configurable slots a model's materials are tagged with.
- optimize_textures: downscale and re-encode embedded textures. Textures are
  usually most of a product model's size, and 4K maps are wasted at viewer
  sizes, so this is the main load-time win for uploads.
- read_map_set: classify loose PBR texture files (ambientCG / Poly Haven
  downloads: Color, NormalGL, Roughness, ...) into a material's map set.
"""

import io
import json
import logging
import re
import struct
import zipfile
from pathlib import PurePosixPath

from PIL import Image

logger = logging.getLogger(__name__)

GLB_MAGIC = b"glTF"
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

MAX_TEXTURE_SIZE = 2048
JPEG_QUALITY = 88
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}
# Zip guards: a material download is a handful of maps
MAX_ZIP_ENTRIES = 64
MAX_ZIP_ENTRY_SIZE = 80 * 1024 * 1024


class GlbError(ValueError):
    """The file is not a usable binary glTF."""


def is_glb(content: bytes) -> bool:
    return len(content) >= 12 and content[:4] == GLB_MAGIC and struct.unpack_from("<I", content, 4)[0] == 2


def read_glb(content: bytes) -> tuple[dict, bytes]:
    """(json, binary chunk) of a .glb."""
    if not is_glb(content):
        raise GlbError("File is not a valid glTF 2.0 binary (.glb)")
    offset, gltf, binary = 12, None, b""
    while offset + 8 <= len(content):
        length, kind = struct.unpack_from("<II", content, offset)
        data = content[offset + 8: offset + 8 + length]
        if kind == CHUNK_JSON and gltf is None:
            try:
                gltf = json.loads(data)
            except ValueError as e:
                raise GlbError("The model's JSON chunk is unreadable") from e
        elif kind == CHUNK_BIN and not binary:
            binary = data
        offset += 8 + length
    if gltf is None:
        raise GlbError("The model has no JSON chunk")
    return gltf, binary


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * (-len(data) % 4)


def write_glb(gltf: dict, binary: bytes) -> bytes:
    json_chunk = _pad(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    out = struct.pack("<II", len(json_chunk), CHUNK_JSON) + json_chunk
    if binary:
        bin_chunk = _pad(binary, b"\0")
        out += struct.pack("<II", len(bin_chunk), CHUNK_BIN) + bin_chunk
    return GLB_MAGIC + struct.pack("<II", 2, 12 + len(out)) + out


def summarize(gltf: dict) -> dict:
    """Counts shown in the 3D library, and the slots its materials are tagged with."""
    accessors = gltf.get("accessors", [])
    vertices = triangles = 0
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            pos = prim.get("attributes", {}).get("POSITION")
            count = accessors[pos].get("count", 0) if pos is not None and pos < len(accessors) else 0
            vertices += count
            if prim.get("mode", 4) == 4:
                idx = prim.get("indices")
                n = accessors[idx].get("count", 0) if idx is not None and idx < len(accessors) else count
                triangles += n // 3
    slots = sorted({
        m["extras"]["ec_slot"] for m in gltf.get("materials", [])
        if isinstance(m.get("extras"), dict) and isinstance(m["extras"].get("ec_slot"), str)
    })
    return {
        "meshes": len(gltf.get("meshes", [])),
        "materials": len(gltf.get("materials", [])),
        "textures": len(gltf.get("images", [])),
        "vertices": vertices,
        "triangles": triangles,
        "slots": slots,
        "extensions": gltf.get("extensionsUsed", []),
    }


def _encode(img: Image.Image, keep_png: bool) -> tuple[bytes, str]:
    buf = io.BytesIO()
    if keep_png:
        img.save(buf, "PNG", optimize=True)
        return buf.getvalue(), "image/png"
    img.convert("RGB").save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return buf.getvalue(), "image/jpeg"


def _has_alpha(img: Image.Image) -> bool:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha = img.convert("RGBA").getchannel("A")
        return alpha.getextrema()[0] < 255
    return False


def shrink_image(data: bytes, max_size: int = MAX_TEXTURE_SIZE) -> tuple[bytes, str] | None:
    """Re-encoded (bytes, mime) when that is smaller, else None (keep the original)."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:  # noqa: BLE001 - an unreadable image stays as it is
        return None
    if img.mode in ("I;16", "I;16B", "I", "F"):
        # 16-bit maps (normals, displacement): 8 bits is plenty for display
        img = img.point(lambda v: v / 256).convert("L")
    keep_png = _has_alpha(img)
    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    out, mime = _encode(img, keep_png)
    return (out, mime) if len(out) < len(data) else None


def optimize_textures(content: bytes, max_size: int = MAX_TEXTURE_SIZE) -> tuple[bytes, dict]:
    """
    Downscale embedded textures to max_size and re-encode them (JPEG unless
    they use alpha). Returns (glb, report). Files that use extension-specific
    images (KTX2, WebP) or external buffers are returned unchanged.
    """
    gltf, binary = read_glb(content)
    report = {"before": len(content), "after": len(content), "images_changed": 0}
    images = gltf.get("images", [])
    views = gltf.get("bufferViews", [])
    if not images or not binary or len(gltf.get("buffers", [])) != 1:
        return content, report
    if any(i.get("mimeType") not in ("image/jpeg", "image/png") or "bufferView" not in i for i in images):
        return content, report

    replaced: dict[int, bytes] = {}
    for image in images:
        view = views[image["bufferView"]]
        start = view.get("byteOffset", 0)
        shrunk = shrink_image(binary[start: start + view["byteLength"]], max_size)
        if shrunk:
            replaced[image["bufferView"]], image["mimeType"] = shrunk
    if not replaced:
        return content, report

    # Rebuild the binary chunk with every view 4-byte aligned (accessor views
    # need their component alignment; 4 covers all glTF component types)
    out = bytearray()
    for index, view in enumerate(views):
        start = view.get("byteOffset", 0)
        data = replaced.get(index, binary[start: start + view["byteLength"]])
        out += b"\0" * (-len(out) % 4)
        view["byteOffset"] = len(out)
        view["byteLength"] = len(data)
        out += data
    gltf["buffers"][0]["byteLength"] = len(out)
    result = write_glb(gltf, bytes(out))
    if len(result) >= len(content):
        return content, report
    report.update(after=len(result), images_changed=len(replaced))
    return result, report


# Loose map files: which map a file is, from the last word(s) of its name
# ("Wood049_2K-JPG_NormalGL", "brushed_metal_nor_gl_2k"). Size / format
# tokens are dropped first. None = not a map we use (displacement, previews).
_MAP_WORDS = {
    "color": {"color", "colour", "col", "diff", "diffuse", "albedo", "basecolor", "base_color", "basecol"},
    "normal_gl": {"normalgl", "normal_gl", "nor_gl", "nrm_gl"},
    "normal_dx": {"normaldx", "normal_dx", "nor_dx", "nrm_dx"},
    "normal": {"normal", "nor", "nrm"},
    "roughness": {"roughness", "rough", "rgh"},
    "gloss": {"gloss", "glossiness"},
    "metalness": {"metalness", "metallic", "metal"},
    "ao": {"ao", "ambientocclusion", "ambient_occlusion", "occlusion"},
    # Packed occlusion / roughness / metalness (Poly Haven "arm", glTF "orm")
    "arm": {"arm", "orm"},
}
_WORD_KIND = {word: kind for kind, words in _MAP_WORDS.items() for word in words}
_NOISE = re.compile(r"^(\d+k|jpg|jpeg|png|tif|tiff|exr|webp|lq|hq|\d+)$")


def classify_map(filename: str) -> str | None:
    words = [w for w in re.split(r"[_\-\s.]+", PurePosixPath(filename).stem.lower()) if w and not _NOISE.match(w)]
    for n in (2, 1):
        if len(words) >= n and "_".join(words[-n:]) in _WORD_KIND:
            return _WORD_KIND["_".join(words[-n:])]
    return None


def _prepare_map(kind: str, data: bytes) -> bytes:
    """One map as a display-sized JPEG; DX normals flipped to GL, gloss inverted to roughness."""
    img = Image.open(io.BytesIO(data))
    img.load()
    if img.mode in ("I;16", "I;16B", "I", "F"):
        img = img.point(lambda v: v / 256).convert("L")
    img = img.convert("L" if kind in ("roughness", "gloss", "metalness", "ao") else "RGB")
    if kind == "normal_dx":
        r, g, b = img.split()
        img = Image.merge("RGB", (r, g.point(lambda v: 255 - v), b))
    elif kind == "gloss":
        img = img.point(lambda v: 255 - v)
    if max(img.size) > MAX_TEXTURE_SIZE:
        img.thumbnail((MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=JPEG_QUALITY if kind == "color" else 92, optimize=True)
    return buf.getvalue()


def _zip_files(content: bytes) -> list[tuple[str, bytes]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as e:
        raise GlbError("The zip file is unreadable") from e
    entries = [i for i in archive.infolist() if not i.is_dir() and not PurePosixPath(i.filename).name.startswith(".")]
    if len(entries) > MAX_ZIP_ENTRIES:
        raise GlbError("The zip has too many files for a material")
    files = []
    for info in entries:
        suffix = PurePosixPath(info.filename).suffix.lower()
        if suffix not in IMAGE_EXTENSIONS and suffix != ".glb":
            continue
        if info.file_size > MAX_ZIP_ENTRY_SIZE:
            raise GlbError(f"{info.filename} is too large")
        files.append((PurePosixPath(info.filename).name, archive.read(info)))
    return files


def unpack_upload(files: list[tuple[str, bytes]]) -> tuple[bytes | None, list[tuple[str, bytes]]]:
    """Split uploaded files (zips expanded) into (a .glb if any, loose images)."""
    expanded = []
    for name, data in files:
        if PurePosixPath(name).suffix.lower() == ".zip":
            expanded.extend(_zip_files(data))
        else:
            expanded.append((name, data))
    glb = next((data for name, data in expanded if PurePosixPath(name).suffix.lower() == ".glb"), None)
    images = [(n, d) for n, d in expanded if PurePosixPath(n).suffix.lower() in IMAGE_EXTENSIONS]
    return glb, images


def read_map_set(images: list[tuple[str, bytes]]) -> dict[str, bytes]:
    """
    {"map" | "normalMap" | "roughnessMap" | "metalnessMap" | "aoMap": jpeg}
    from loose texture files (one packed ARM map may fill the last three). A GL normal map wins over a DX one; roughness
    wins over gloss. Raises GlbError when no usable map is found.
    """
    found: dict[str, tuple[str, bytes]] = {}
    for name, data in images:
        kind = classify_map(name)
        # Prefer the highest-resolution file when a pack has several sizes
        if kind and (kind not in found or len(data) > len(found[kind][1])):
            found[kind] = (name, data)
    if not found and len(images) == 1:
        found["color"] = images[0]

    picks = {
        "map": "color",
        "normalMap": next((k for k in ("normal_gl", "normal", "normal_dx") if k in found), None),
        # three.js reads roughness from G, metalness from B and occlusion
        # from R, so a packed ARM map serves all three
        "roughnessMap": next((k for k in ("roughness", "gloss", "arm") if k in found), None),
        "metalnessMap": next((k for k in ("metalness", "arm") if k in found), None),
        "aoMap": next((k for k in ("ao", "arm") if k in found), None),
    }
    maps = {}
    prepared: dict[str, bytes] = {}
    for slot, kind in picks.items():
        if kind and kind in found:
            try:
                if kind not in prepared:
                    prepared[kind] = _prepare_map(kind, found[kind][1])
            except Exception as e:  # noqa: BLE001
                raise GlbError(f"{found[kind][0]} could not be read as an image") from e
            maps[slot] = prepared[kind]
    if not maps:
        raise GlbError("No texture maps found. Name files like Color, NormalGL, Roughness, Metalness, AO.")
    return maps
