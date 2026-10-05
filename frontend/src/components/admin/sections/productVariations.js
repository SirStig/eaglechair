import { useMemo } from 'react';

// Shared by the product editor and its Variations tab

export const STOCK_STATUS_OPTIONS = ['Made to Order', 'Available', 'Low Stock', 'Out of Stock', 'Discontinued'];

export const OPTION_GROUP_SWITCHES = [
  { field: 'upholstery_enabled', label: 'Upholstery' },
  { field: 'colors_enabled', label: 'Colors' },
  { field: 'laminates_enabled', label: 'Laminates' },
];

// Saved variations key by id; new ones get a client-only _key when added
export const variationKey = (variation, index) => variation.id ?? variation._key ?? `new-${index}`;
export const variationAnchor = (key) => `variation-${key}`;

const nameById = (rows) => Object.fromEntries((rows || []).map((r) => [r.id, r.name]));

/**
 * Variations in display order with their keys, narrowed by the filter text
 * (SKU, name or material). The editor builds its selection from these rows so
 * "select all" means "select the matching ones".
 */
export function useVariationRows(variations, filter, { finishes, upholsteries, colors }) {
  const names = useMemo(
    () => ({ finishes: nameById(finishes), upholsteries: nameById(upholsteries), colors: nameById(colors) }),
    [finishes, upholsteries, colors]
  );
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return variations
      .map((variation, index) => ({ variation, index, key: variationKey(variation, index) }))
      .filter(({ variation }) => {
        if (!q) return true;
        return [
          variation.sku,
          variation.name,
          names.finishes[variation.finish_id],
          names.upholsteries[variation.upholstery_id],
          names.colors[variation.color_id],
        ]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(q));
      });
  }, [variations, filter, names]);
  return { rows, names };
}
