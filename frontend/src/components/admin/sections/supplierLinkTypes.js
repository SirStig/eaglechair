// Material types a supplier link can cover (backend MATERIAL_SOURCE_TYPES)
export const SUPPLIER_TYPE_OPTIONS = [
  { value: 'laminate', label: 'Laminate' },
  { value: 'upholstery', label: 'Upholstery' },
  { value: 'finish', label: 'Finish' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

export const supplierTypeLabel = (value) =>
  SUPPLIER_TYPE_OPTIONS.find((o) => o.value === value)?.label || value || '—';

/** "Wilsonart (laminate)" pick-list options for product bulk actions */
export const supplierLinkOptions = (sources) =>
  (sources || []).map((s) => ({ value: String(s.id), label: `${s.name} (${supplierTypeLabel(s.material_type).toLowerCase()})` }));

/** Active links grouped by type, in SUPPLIER_TYPE_OPTIONS order, empty groups dropped */
export const groupSupplierLinks = (sources) =>
  SUPPLIER_TYPE_OPTIONS.map(({ value, label }) => ({
    type: value,
    label,
    links: (sources || []).filter((s) => s.material_type === value),
  })).filter((g) => g.links.length > 0);
