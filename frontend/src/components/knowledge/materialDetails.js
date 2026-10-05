import { safeHref } from '../../utils/safeUrl';

/**
 * Turn a finish / upholstery / laminate / hardware record into the shape
 * MaterialDetailOverlay renders:
 *   { id, materialType, kind, fit, eyebrow, title, code, images: [{ src, caption }],
 *     swatch, facts: [[label, value]], notes: [[heading, text]], badges, link }
 */

const facts = (...pairs) => pairs.filter((p) => p && p[1] != null && p[1] !== '');
const notes = (...pairs) => pairs.filter((p) => p && p[1]?.trim?.());
const badges = (...list) => list.filter(Boolean);

// Unique, non-empty image list; entries may be URLs or { url, caption } objects.
const images = (...entries) => {
  const seen = new Set();
  return entries.flat().reduce((out, e) => {
    const src = typeof e === 'string' ? e : e?.url;
    if (src && !seen.has(src)) {
      seen.add(src);
      out.push({ src, caption: typeof e === 'object' ? e.caption || null : null });
    }
    return out;
  }, []);
};

export const finishDetail = (f, { metal = false } = {}) => ({
  id: f.id,
  materialType: 'finish',
  kind: metal ? 'metal' : 'wood',
  fit: 'cover',
  eyebrow: metal ? f.finishType : `${f.grade || 'Standard'} finish`,
  title: f.name,
  code: f.finishCode,
  images: images(f.imageUrl, f.swatchImageUrl),
  swatch: f,
  facts: facts(
    ['Type', f.finishType],
    !metal && ['Grade', f.grade],
    ['Color family', f.colorFamily],
  ),
  notes: notes(['About this finish', f.description]),
  badges: badges(f.isPopular && 'Popular', f.isCustom && 'Custom', f.isToMatch && 'Match to sample'),
});

export const upholsteryDetail = (u) => ({
  id: u.id,
  materialType: 'upholstery',
  kind: 'fabric',
  fit: 'cover',
  eyebrow: [u.manufacturer, u.materialType].filter(Boolean).join(' · '),
  title: u.name,
  code: u.fabricCode,
  images: images(u.imageUrl, u.swatchImageUrl),
  swatch: u,
  facts: facts(
    // Brand and material type are already in the eyebrow
    ['Pattern', u.pattern],
    ['Color', u.color],
    ['Grade', u.grade],
    ['Content', u.content],
    ['Durability', u.durabilityRating],
    ['Flame rating', u.flameRating],
    ['Cleanability', u.cleanability],
  ),
  notes: notes(
    ['About this material', u.description],
    ['Texture', u.textureDescription],
    u.isCom && ['Customer-supplied material', u.comRequirements],
  ),
  badges: badges(u.isPopular && 'Popular', u.isCom && 'COM'),
});

export const laminateDetail = (l) => {
  const site = safeHref(l.supplierWebsite);
  return {
    id: l.id,
    materialType: 'laminate',
    kind: 'laminate',
    fit: 'cover',
    eyebrow: l.brand,
    title: l.patternName,
    code: l.patternCode,
    images: images(l.fullImageUrl, l.swatchImageUrl),
    swatch: l,
    facts: facts(
      // Brand is already in the eyebrow
      ['Color family', l.colorFamily],
      ['Finish', l.finishType],
      ['Thickness', l.thickness],
      ['Grade', l.grade],
      l.leadTimeDays && ['Lead time', `${l.leadTimeDays} days`],
      l.isInStock === false && ['Availability', 'Special order'],
    ),
    notes: notes(
      ['About this laminate', l.description],
      ['Recommended for', l.recommendedFor],
      ['Care', l.careInstructions],
    ),
    badges: badges(l.isPopular && 'Popular'),
    link: site ? { href: site, label: `See it on ${l.supplierName || l.brand || 'the supplier site'}` } : null,
  };
};

export const hardwareDetail = (h) => ({
  id: h.id,
  materialType: 'hardware',
  kind: 'metal',
  // Hardware photos are product shots; show the whole part, don't crop it
  fit: 'contain',
  eyebrow: h.category,
  title: h.name,
  code: h.modelNumber,
  images: images(h.imageUrl || h.thumbnailUrl, h.additionalImages || []),
  swatch: null,
  facts: facts(
    h.sku && h.sku !== h.modelNumber && ['SKU', h.sku],
    ['Material', h.material],
    ['Finish', h.finish],
    ['Size', h.dimensions],
    ['Capacity', h.weightCapacity],
    ['Fits', h.compatibleWith],
  ),
  notes: notes(
    ['About this part', h.description],
    ['Installation', h.installationNotes],
  ),
  badges: badges(h.isFeatured && 'Featured'),
});
