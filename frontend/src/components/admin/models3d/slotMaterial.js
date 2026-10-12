/**
 * Dressing a model's configurable parts in library materials.
 *
 * A library material (materialKinds.js BUILTIN_MATERIALS, or an upload) is a
 * set of PBR maps plus look settings. Neutral maps are tinted with the
 * catalog option's colour (its hex, or its swatch's average colour); real
 * textures (a laminate scan, a glTF material) are shown as they are.
 *
 * Every map is cloned per part so texture scale can differ between parts;
 * clones share the image, so the GPU holds each texture once.
 */
import * as THREE from 'three';
import { getGltfLoader, loadTexture, textureMean } from './loaders';

export const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];

/**
 * Upgrade a glTF material to MeshPhysicalMaterial (in place on its meshes is
 * the caller's job) so sheen, clear coat and anisotropy are available.
 */
export function toPhysical(material) {
  if (material.isMeshPhysicalMaterial || !material.isMeshStandardMaterial) return material;
  const physical = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(physical, material);
  physical.name = material.name;
  return physical;
}

const lookCache = new Map();

function mapsFromMaterial(m) {
  const maps = {};
  for (const key of MAP_KEYS) {
    if (m[key]) {
      m[key].wrapS = m[key].wrapT = THREE.RepeatWrapping;
      m[key].needsUpdate = true;
      maps[key] = m[key];
    }
  }
  return maps;
}

function paramsFromMaterial(m) {
  const p = {
    color: `#${m.color.getHexString()}`,
    roughness: m.roughness,
    metalness: m.metalness,
    normalScale: Math.abs(m.normalScale?.x ?? 1),
  };
  if (m.isMeshPhysicalMaterial) {
    Object.assign(p, {
      sheen: m.sheen, sheenRoughness: m.sheenRoughness, clearcoat: m.clearcoat,
      clearcoatRoughness: m.clearcoatRoughness, anisotropy: m.anisotropy,
    });
  }
  return p;
}

async function loadGlbLook(url) {
  const gltf = await getGltfLoader().loadAsync(url);
  let found = null;
  gltf.scene.traverse((obj) => {
    if (!found && obj.isMesh) found = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  });
  if (!found) throw new Error('The material file has no mesh material');
  return { maps: mapsFromMaterial(found), params: paramsFromMaterial(found) };
}

async function loadMapUrls(urls) {
  const entries = await Promise.all(Object.entries(urls || {}).map(async ([key, url]) => (
    [key, await loadTexture(url, { srgb: key === 'map' })]
  )));
  return Object.fromEntries(entries);
}

/**
 * Loaded maps and base params for a library material. `swatchUrl` is used
 * by the "swatch image as texture" material.
 */
export function loadLook(libMaterial, { swatchUrl = null } = {}) {
  const key = `${libMaterial.id}|${libMaterial.url || ''}|${libMaterial.swatch ? swatchUrl : ''}`;
  if (!lookCache.has(key)) {
    let promise;
    if (libMaterial.url) promise = loadGlbLook(libMaterial.url);
    else if (libMaterial.swatch) {
      promise = swatchUrl
        ? loadMapUrls({ map: swatchUrl }).then((maps) => ({ maps, params: {} }))
        : Promise.resolve({ maps: {}, params: {} });
    } else promise = loadMapUrls(libMaterial.maps).then((maps) => ({ maps, params: {} }));
    lookCache.set(key, promise.catch((err) => {
      lookCache.delete(key);
      throw err;
    }));
  }
  return lookCache.get(key);
}

/** Remember what the model shipped with, so "Original" can restore it. */
function original(material) {
  if (!material.userData.ecOriginal) {
    const o = {
      color: material.color.clone(),
      roughness: material.roughness,
      metalness: material.metalness,
      normalScale: material.normalScale?.clone(),
      aoMapIntensity: material.aoMapIntensity,
      envMapIntensity: material.envMapIntensity,
      repeat: material.map?.repeat.clone() ?? material.normalMap?.repeat.clone() ?? new THREE.Vector2(1, 1),
    };
    for (const key of MAP_KEYS) o[key] = material[key];
    for (const key of ['sheen', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness', 'anisotropy']) {
      if (key in material) o[key] = material[key];
    }
    if (material.sheenColor) o.sheenColor = material.sheenColor.clone();
    material.userData.ecOriginal = o;
  }
  return material.userData.ecOriginal;
}

function setMaps(material, maps, repeat) {
  const orig = material.userData.ecOriginal;
  for (const key of MAP_KEYS) {
    const current = material[key];
    if (current && current !== orig[key]) current.dispose();
    const tex = maps[key];
    if (tex) {
      const own = tex.clone();
      own.repeat.copy(repeat);
      own.needsUpdate = true;
      material[key] = own;
    } else {
      material[key] = null;
    }
  }
}

function restore(material, grain) {
  const orig = original(material);
  setMaps(material, orig, orig.repeat.clone().divideScalar(grain));
  material.color.copy(orig.color);
  material.roughness = orig.roughness;
  material.metalness = orig.metalness;
  if (orig.normalScale) material.normalScale.copy(orig.normalScale);
  material.aoMapIntensity = orig.aoMapIntensity;
  material.envMapIntensity = orig.envMapIntensity;
  for (const key of ['sheen', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness', 'anisotropy']) {
    if (key in orig) material[key] = orig[key];
  }
  if (orig.sheenColor) material.sheenColor.copy(orig.sheenColor);
}

/**
 * Dress `materials` (one slot's parts) in a library material.
 *
 * libMaterial: null for the model's own look, else a library material.
 * color: the catalog option's colour ('#rrggbb') for tintable materials.
 * grain: the model's texture scale for this slot (1 = as modelled).
 * swatchUrl: the option's swatch image (for the swatch-texture material).
 */
export async function applyMaterial(materials, libMaterial, { color = null, grain = 1, swatchUrl = null } = {}) {
  if (!materials?.length) return;
  grain = grain || 1;
  if (!libMaterial) {
    for (const material of materials) {
      restore(material, grain);
      material.needsUpdate = true;
    }
    return;
  }

  const ownMaps = (m) => Boolean(libMaterial.mapSet) && libMaterial.mapSet === m.userData.ec_kind;
  const look = materials.every(ownMaps) && !libMaterial.url
    ? { maps: {}, params: {} }
    : await loadLook(libMaterial, { swatchUrl });
  const p = { ...look.params, ...(libMaterial.settings || {}) };

  for (const material of materials) {
    const orig = original(material);
    const own = ownMaps(material);
    // The model's embedded copy of the same map set keeps its UV scale
    const maps = own ? { map: orig.map, normalMap: orig.normalMap, roughnessMap: orig.roughnessMap } : look.maps;
    setMaps(material, maps, orig.repeat.clone().divideScalar((p.scale || 1) * grain));

    const tint = libMaterial.tint && color;
    const c = new THREE.Color(tint ? color : (p.color || '#ffffff'));
    if (tint && material.map) {
      const mean = libMaterial.albedoMean ?? textureMean(maps.map);
      c.multiplyScalar(1 / mean);
    }
    material.color.copy(c);
    material.metalness = p.metalness ?? (material.metalnessMap ? 1 : 0);
    // A roughness map scales material.roughness, so it defaults to 1 with one
    material.roughness = p.roughness ?? (material.roughnessMap ? 1 : 0.6);
    const n = p.normalScale ?? 1;
    if (material.normalScale) material.normalScale.set(n, n * Math.sign(orig.normalScale?.y || 1));
    material.aoMapIntensity = p.aoIntensity ?? 1;
    material.envMapIntensity = p.envIntensity ?? 1;
    if (material.isMeshPhysicalMaterial) {
      material.sheen = p.sheen ?? 0;
      material.sheenRoughness = p.sheenRoughness ?? 0.8;
      // Cloth sheen tinted by the fabric's own colour (white sheen washes colours out)
      material.sheenColor.copy(c).multiplyScalar(0.5);
      material.clearcoat = p.clearcoat ?? 0;
      material.clearcoatRoughness = p.clearcoatRoughness ?? 0.3;
      material.anisotropy = p.anisotropy ?? 0;
    }
    material.needsUpdate = true;
  }
}
