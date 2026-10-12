/**
 * Shared three.js loaders for the 3D studio. One GLTFLoader understands every
 * compressed glTF flavour (Draco and meshopt geometry, KTX2 / Basis
 * textures), so optimised exports (gltf-transform, Blender's Draco option)
 * load as well as plain ones. Decoders are served from /libs and only fetched
 * when a file uses them.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let gltfLoader = null;
let ktx2Ready = false;

/** The shared GLTFLoader. Pass the renderer once so KTX2 can pick a GPU format. */
export function getGltfLoader(renderer) {
  if (!gltfLoader) {
    const draco = new DRACOLoader().setDecoderPath('/libs/draco/');
    gltfLoader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  }
  if (renderer && !ktx2Ready) {
    gltfLoader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/libs/basis/').detectSupport(renderer));
    ktx2Ready = true;
  }
  return gltfLoader;
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

/** A tileable texture, loaded once per URL. */
export function loadTexture(url, { srgb = false } = {}) {
  const key = `${url}|${srgb}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, textureLoader.loadAsync(url).then((tex) => {
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.flipY = false; // glTF UV convention, like a model's own maps
      tex.anisotropy = 8;
      return tex;
    }).catch((err) => {
      textureCache.delete(key);
      throw err;
    }));
  }
  return textureCache.get(key);
}

const meanCache = new WeakMap();

/**
 * Mean linear brightness of a colour texture (0-1), so a tint lands at the
 * swatch's own brightness. 1 when the image can't be read (jsdom, tainted).
 */
export function textureMean(texture) {
  const image = texture?.image;
  if (!image) return 1;
  if (meanCache.has(image)) return meanCache.get(image);
  let mean = 1;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += THREE.SRGBToLinear(lum / 255);
    }
    mean = Math.max(0.05, sum / (data.length / 4));
  } catch {
    mean = 1;
  }
  meanCache.set(image, mean);
  return mean;
}

/** Average colour of an image URL, as '#rrggbb' (used when a swatch has no hex). */
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
