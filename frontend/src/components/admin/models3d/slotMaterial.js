/**
 * Configurable 3D product materials.
 *
 * A model marks its parts through glTF material extras (three.js puts them in
 * material.userData): ec_slot = 'upholstery' | 'frame', and ec_kind = the
 * material its maps show ('wood', 'fabric', 'leather'). Models without extras
 * fall back to matching the material name.
 *
 * Parts carry neutral, tileable PBR maps (grain, normal, roughness), so an
 * option is applied by setting the material colour (the option's hex, or its
 * swatch's average colour) and, when the option is a different material type
 * (vinyl on a fabric seat, metal on a wood frame), swapping the map set from
 * /materials3d (CC0 textures from ambientCG).
 */
import * as THREE from 'three';

export const SLOTS = ['upholstery', 'frame'];

const NAME_HINTS = {
  upholstery: /uphol|fabric|vinyl|leather|seat|cushion|pad|back_?panel/i,
  frame: /frame|wood|finish|leg|metal|base/i,
};

/** Which configurable slot a material belongs to, or null. */
export function materialSlot(material) {
  const tagged = material?.userData?.ec_slot;
  if (SLOTS.includes(tagged)) return tagged;
  const name = material?.name || '';
  return SLOTS.find((slot) => NAME_HINTS[slot].test(name)) || null;
}

/** Map set for a catalog option: upholstery material_type / finish finish_type. */
export function optionKind(slot, item) {
  if (!item) return null;
  if (slot === 'upholstery') {
    return /vinyl|leather|naugahyde|poly/i.test(`${item.material_type || ''} ${item.name || ''}`) ? 'leather' : 'fabric';
  }
  return /metal|chrome|powder|aluminum|steel/i.test(item.finish_type || '') ? 'metal' : 'wood';
}

// The neutral grain maps average about this bright; colours are scaled up to
// match so a swatch's colour comes out at its own brightness.
const ALBEDO_MEAN = { wood: 0.8, fabric: 0.86, leather: 0.86 };
const ROUGHNESS = { wood: 0.55, fabric: 1, leather: 0.75, metal: 0.3 };

const textureCache = new Map();
const loader = new THREE.TextureLoader();

function loadMap(url, srgb) {
  if (!textureCache.has(url)) {
    textureCache.set(url, loader.loadAsync(url).then((tex) => {
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.flipY = false;   // glTF UV convention, like the model's own maps
      tex.anisotropy = 8;
      return tex;
    }).catch((err) => {
      textureCache.delete(url);
      throw err;
    }));
  }
  return textureCache.get(url);
}

async function mapSet(kind, base) {
  if (kind === 'metal') return null;
  const [map, normalMap, roughnessMap] = await Promise.all([
    loadMap(`${base}/${kind}_albedo.jpg`, true),
    loadMap(`${base}/${kind}_normal.jpg`, false),
    loadMap(`${base}/${kind}_rough.jpg`, false),
  ]);
  return { map, normalMap, roughnessMap };
}

/** Remember what the model shipped with, so "Original" can restore it. */
function original(material) {
  if (!material.userData.ecOriginal) {
    material.userData.ecOriginal = {
      color: material.color.clone(),
      map: material.map,
      normalMap: material.normalMap,
      roughnessMap: material.roughnessMap,
      roughness: material.roughness,
      metalness: material.metalness,
      repeat: material.map?.repeat.clone() ?? new THREE.Vector2(1, 1),
    };
  }
  return material.userData.ecOriginal;
}

function setMaps(material, maps, grain, baseRepeat) {
  for (const key of ['map', 'normalMap', 'roughnessMap']) {
    const tex = maps?.[key] ?? null;
    if (tex) {
      // Textures are shared between materials; clone so grain scale is per part
      const own = tex.clone();
      own.repeat.copy(baseRepeat).multiplyScalar(1 / grain);
      own.needsUpdate = true;
      if (material[key] && material[key] !== material.userData.ecOriginal?.[key]) material[key].dispose();
      material[key] = own;
    } else {
      material[key] = null;
    }
  }
}

/**
 * Apply an option to a slot's materials. `option`: null for the model's own
 * look, or { colorHex, kind }. `settings`: { grain } (texture scale, 1 = as
 * modelled).
 */
export async function applySlotOption(materials, option, settings = {}, { base = '/materials3d' } = {}) {
  const grain = settings.grain || 1;
  const maps = option && option.kind !== materials[0]?.userData?.ec_kind ? await mapSet(option.kind, base) : undefined;
  for (const material of materials) {
    const orig = original(material);
    if (!option) {
      for (const key of ['map', 'normalMap', 'roughnessMap']) {
        if (material[key] && material[key] !== orig[key]) material[key].dispose();
        material[key] = orig[key];
      }
      material.color.copy(orig.color);
      material.roughness = orig.roughness;
      material.metalness = orig.metalness;
      for (const key of ['map', 'normalMap', 'roughnessMap']) {
        material[key]?.repeat.copy(orig.repeat).multiplyScalar(1 / grain);
      }
    } else {
      const kind = option.kind;
      // Same material type as modelled: keep the model's maps, else swap the set
      setMaps(material, maps === undefined ? orig : maps, grain, orig.repeat);
      const color = new THREE.Color(option.colorHex || '#888888');
      if (ALBEDO_MEAN[kind]) color.multiplyScalar(1 / ALBEDO_MEAN[kind]);
      material.color.copy(color);
      material.metalness = kind === 'metal' ? 1 : 0;
      // A roughness map scales material.roughness, so leave it at 1 when there is one
      material.roughness = material.roughnessMap ? 1 : ROUGHNESS[kind];
    }
    material.needsUpdate = true;
  }
}

/** Average colour of an image, as '#rrggbb' (used when a swatch has no hex). */
export async function averageColor(url) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  // Centre crop: swatch photos often have labels or borders at the edges
  const w = img.naturalWidth, h = img.naturalHeight;
  ctx.drawImage(img, w * 0.2, h * 0.2, w * 0.6, h * 0.6, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  const n = data.length / 4;
  return `#${[r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('')}`;
}
