// Legal document types; values match backend LegalDocumentType
export const LEGAL_DOCUMENT_TYPES = [
  { value: 'price_list', label: 'Price List' },
  { value: 'dimensions_sizes', label: 'Dimensions & Sizes' },
  { value: 'orders', label: 'Orders' },
  { value: 'com_col_orders', label: 'COM/COL Orders' },
  { value: 'minimum_order', label: 'Minimum Order' },
  { value: 'payments', label: 'Payments' },
  { value: 'terms', label: 'Terms' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'legal_costs', label: 'Legal Costs' },
  { value: 'quotations', label: 'Quotations' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'flammability', label: 'Flammability' },
  { value: 'custom_finishes', label: 'Custom Finishes' },
  { value: 'partial_shipments', label: 'Partial Shipments' },
  { value: 'storage', label: 'Storage' },
  { value: 'returns', label: 'Returns' },
  { value: 'cancellations', label: 'Cancellations' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'special_service', label: 'Special Service' },
  { value: 'shipments_damage', label: 'Shipments & Damage' },
  { value: 'freight_classification', label: 'Freight Classification' },
  { value: 'ip_disclaimer', label: 'IP Disclaimer' },
  { value: 'ip_assignment', label: 'IP Assignment' },
  { value: 'conditions_of_sale', label: 'Conditions of Sale' },
  { value: 'privacy_policy', label: 'Privacy Policy' },
  { value: 'other', label: 'Other' },
];

export const legalDocumentTypeLabel = (value) =>
  LEGAL_DOCUMENT_TYPES.find((t) => t.value === value)?.label || value;
