/**
 * What a configurable 3D model's parts can be dressed in.
 *
 * Slots: the configurable parts of a model (upholstery, wood frame, metal
 * frame / base, table top), each fed by a catalog table.
 *
 * Kinds: the material families a catalog option renders as (fabric, vinyl,
 * wood, chrome, woodgrain laminate, ...). Each kind has a default material
 * (a built-in one below, or one uploaded to the material library), and a
 * single catalog option can be assigned its own material ("laminate:12" →
 * a scanned Wilsonart pattern).
 */

export const SLOTS = {
  upholstery: { label: 'Upholstery', source: 'upholstery', hint: /uphol|fabric|vinyl|leather|seat|cushion|pad|back_?panel/i },
  top: { label: 'Table Top', source: 'laminate', hint: /table_?top|laminate|(^|_)top($|_)/i },
  metal: { label: 'Metal', source: 'finish', hint: /metal|chrome|steel|alumin|glide|(^|_)base($|_)/i },
  frame: { label: 'Wood / Frame', source: 'finish', hint: /frame|wood|finish|leg/i },
};
export const SLOT_KEYS = ['upholstery', 'frame', 'metal', 'top'];

/** Catalog tables, and the option key prefix used by material assignments. */
export const SOURCES = {
  upholstery: { label: 'Upholstery', plural: 'upholsteries' },
  finish: { label: 'Finish', plural: 'finishes' },
  laminate: { label: 'Laminate', plural: 'laminates' },
};

export const KINDS = {
  fabric: { label: 'Fabric', group: 'Upholstery' },
  vinyl: { label: 'Vinyl', group: 'Upholstery' },
  leather: { label: 'Leather', group: 'Upholstery' },
  wood: { label: 'Wood stain', group: 'Wood' },
  paint: { label: 'Painted', group: 'Wood' },
  metal: { label: 'Metal', group: 'Metal' },
  chrome: { label: 'Chrome', group: 'Metal' },
  brushed: { label: 'Brushed metal', group: 'Metal' },
  powder: { label: 'Powder coat', group: 'Metal' },
  laminate: { label: 'Laminate (solid)', group: 'Laminate' },
  laminate_wood: { label: 'Laminate (woodgrain)', group: 'Laminate' },
  other: { label: 'Other', group: 'Other' },
};
export const KIND_KEYS = Object.keys(KINDS);
const METAL_KINDS = new Set(['metal', 'chrome', 'brushed', 'powder']);
export const isMetalKind = (kind) => METAL_KINDS.has(kind);

/** Which configurable slot a material belongs to, or null. `overrides` maps material names to slots. */
export function materialSlot(material, overrides = {}) {
  const name = material?.name || '';
  if (name && Object.prototype.hasOwnProperty.call(overrides, name)) {
    return SLOTS[overrides[name]] ? overrides[name] : null;
  }
  const tagged = material?.userData?.ec_slot;
  if (SLOTS[tagged]) return tagged;
  return Object.keys(SLOTS).find((slot) => SLOTS[slot].hint.test(name)) || null;
}

/** The material kind a catalog option renders as. */
export function optionKind(source, item) {
  if (!item) return null;
  if (source === 'upholstery') {
    const text = `${item.material_type || ''} ${item.name || ''}`;
    if (/leather/i.test(item.material_type || '')) return 'leather';
    return /vinyl|naugahyde|poly|faux|leather/i.test(text) ? 'vinyl' : 'fabric';
  }
  if (source === 'laminate') {
    return /wood|grain|oak|walnut|maple|cherry/i.test(`${item.color_family || ''} ${item.pattern_name || ''}`)
      ? 'laminate_wood' : 'laminate';
  }
  const text = `${item.finish_type || ''} ${item.name || ''}`;
  if (/chrome|polished/i.test(text)) return 'chrome';
  if (/brushed|stainless|satin nickel/i.test(text)) return 'brushed';
  if (/powder/i.test(text)) return 'powder';
  if (/metal|alumin|steel|bronze|brass|nickel|iron/i.test(text)) return 'metal';
  if (/paint|lacquer|enamel/i.test(text)) return 'paint';
  return 'wood';
}

/** Key a material assignment is stored under. */
export const optionKey = (source, item) => `${source}:${item.id}`;

export const optionLabel = (source, item) => (source === 'laminate'
  ? [item.brand, item.pattern_name, item.pattern_code].filter(Boolean).join(' ')
  : item.name);

export const optionImage = (item) => item?.swatch_image_url || item?.image_url || item?.full_image_url || null;

/** Search text for a catalog option. */
export const optionText = (item) => [
  item.name, item.grade, item.material_type, item.finish_type, item.color, item.finish_code, item.material_code,
  item.brand, item.pattern_name, item.pattern_code, item.color_family,
].filter(Boolean).join(' ').toLowerCase();

// Built-in materials: neutral, tileable CC0 maps from ambientCG (see
// public/materials3d/CREDITS.md), tinted with the catalog colour. albedoMean
// is how bright a map averages, so a tint comes out at the swatch's own
// brightness; mapSet names the set a model may already embed (glTF ec_kind),
// so a model keeps its own UV-scaled copy of it.
const T = '/materials3d';
const fullSet = (set) => ({ map: `${T}/${set}_albedo.jpg`, normalMap: `${T}/${set}_normal.jpg`, roughnessMap: `${T}/${set}_rough.jpg` });

export const BUILTIN_MATERIALS = [
  { id: 'builtin:fabric', name: 'Woven fabric', kind: 'fabric', tint: true, mapSet: 'fabric', albedoMean: 0.86,
    maps: fullSet('fabric'), settings: { sheen: 1, sheenRoughness: 0.8 } },
  { id: 'builtin:vinyl', name: 'Vinyl', kind: 'vinyl', tint: true, mapSet: 'leather', albedoMean: 0.86,
    maps: fullSet('leather'), settings: { roughness: 0.8, scale: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.45 } },
  { id: 'builtin:leather', name: 'Leather', kind: 'leather', tint: true, mapSet: 'leather', albedoMean: 0.86,
    maps: fullSet('leather'), settings: {} },
  { id: 'builtin:wood', name: 'Stained wood', kind: 'wood', tint: true, mapSet: 'wood', albedoMean: 0.8,
    maps: fullSet('wood'), settings: {} },
  { id: 'builtin:paint', name: 'Painted wood', kind: 'paint', tint: true,
    maps: { normalMap: `${T}/wood_normal.jpg` }, settings: { roughness: 0.45, normalScale: 0.3 } },
  { id: 'builtin:metal', name: 'Satin metal', kind: 'metal', tint: true, maps: {}, settings: { metalness: 1, roughness: 0.32 } },
  { id: 'builtin:chrome', name: 'Chrome', kind: 'chrome', tint: true, maps: {}, settings: { metalness: 1, roughness: 0.05 } },
  { id: 'builtin:brushed', name: 'Brushed metal', kind: 'brushed', tint: true, maps: {},
    settings: { metalness: 1, roughness: 0.3, anisotropy: 0.8 } },
  { id: 'builtin:powder', name: 'Powder coat', kind: 'powder', tint: true,
    maps: { normalMap: `${T}/leather_normal.jpg` }, settings: { roughness: 0.55, normalScale: 0.08, scale: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.5 } },
  { id: 'builtin:laminate', name: 'Solid laminate', kind: 'laminate', tint: true, maps: {}, settings: { roughness: 0.42 } },
  { id: 'builtin:laminate_wood', name: 'Woodgrain laminate', kind: 'laminate_wood', tint: true, albedoMean: 0.8,
    maps: { map: `${T}/wood_albedo.jpg`, normalMap: `${T}/wood_normal.jpg` }, settings: { roughness: 0.38, normalScale: 0.25 } },
  // The option's own swatch image tiled as its texture: for flat scans
  // (laminate and finish samples), never for styled upholstery photos
  { id: 'builtin:swatch', name: 'Swatch image as texture', kind: 'other', tint: false, swatch: true, maps: {},
    settings: { roughness: 0.42, scale: 1 } },
  { id: 'builtin:other', name: 'Plain', kind: 'other', tint: true, maps: {}, settings: { roughness: 0.6 } },
].map((m) => ({ ...m, builtin: true }));

const BUILTIN_BY_ID = Object.fromEntries(BUILTIN_MATERIALS.map((m) => [m.id, m]));

/** All materials by id: built-ins (with saved look tweaks) plus the uploaded library. */
export function materialIndex(uploaded = [], overrides = {}) {
  const builtins = Object.fromEntries(BUILTIN_MATERIALS.map((m) => [
    m.id, overrides[m.id] ? { ...m, settings: { ...m.settings, ...overrides[m.id] } } : m,
  ]));
  return { ...builtins, ...Object.fromEntries(uploaded.map((m) => [m.id, m])) };
}

/** The built-in material's shipped settings (for "reset"). */
export const builtinDefaults = (id) => BUILTIN_BY_ID[id]?.settings || {};

const SCAN_KINDS = new Set(['laminate', 'laminate_wood']);

/**
 * The material a catalog option is shown in: its own assignment, else its
 * kind's default, else the built-in for its kind. Laminate swatches are flat
 * manufacturer scans, so with no default set a laminate that has one tiles
 * its own scan (`hasSwatch`).
 */
export function resolveMaterial(key, kind, config, index, { hasSwatch = false } = {}) {
  const pick = (id) => (id && index[id]) || null;
  return pick(config?.assignments?.[key])
    || pick(config?.defaults?.[kind])
    || (hasSwatch && SCAN_KINDS.has(kind) ? index['builtin:swatch'] : null)
    || pick(`builtin:${kind}`)
    || BUILTIN_BY_ID['builtin:other'];
}
