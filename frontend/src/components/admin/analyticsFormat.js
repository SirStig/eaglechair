import { CATALOG_TYPE_LABELS } from '../../utils/catalogTypes';

/** Formatting shared by the admin Analytics page and the dashboard overview. */

export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n || 0);

export const RESOURCE_TYPE_LABELS = {
  ...CATALOG_TYPE_LABELS,
  catalog: 'Catalog',
  spec_sheet: 'Spec Sheet',
  line_drawing: 'Line Drawing',
  cad: 'CAD File',
  image: 'Product Image',
  guide: 'Guide',
  document: 'Document',
  other: 'Other',
};

export const humanizePath = (path) => (!path || path === '/' ? 'Home' : path);

/** A page row's display name: the backend title, else the path. */
export const pageTitle = (row) => row?.title || humanizePath(row?.path);

/** Seconds as "42s" / "3m 05s" / "5h 37m". */
export const formatDuration = (seconds) => {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

let regionNames = null;
export const countryName = (code) => {
  if (!code) return 'Unknown';
  try {
    regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
};

export const MATERIAL_TYPE_LABELS = {
  finish: 'Wood finish',
  upholstery: 'Upholstery',
  laminate: 'Laminate',
  hardware: 'Hardware',
};

export const INTERACTION_LABELS = {
  finish: 'Finish picked',
  upholstery: 'Upholstery picked',
  color: 'Color picked',
  variation: 'Variation picked',
  image: 'Photos',
  tab: 'Tab opened',
};

export const MISSING_FILE_LABELS = {
  spec_sheet: 'Spec sheet',
  cad: 'CAD file',
  line_drawing: 'Line drawing',
};

/** "spec sheet, CAD file" for "has no …" sentences. */
export const missingFilesPhrase = (keys) =>
  keys.map((k) => (k === 'cad' ? 'CAD file' : (MISSING_FILE_LABELS[k] || k).toLowerCase())).join(', ');

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Quote anything with separators, and neutralise spreadsheet formulas in
  // visitor-supplied text (search terms, labels)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Download rows as a CSV file.
 * @param {string} filename
 * @param {{key: string, label: string, value?: (row) => any}[]} columns
 * @param {object[]} rows
 */
export const downloadCsv = (filename, columns, rows) => {
  const lines = [
    columns.map((c) => csvCell(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(c.value ? c.value(row) : row[c.key])).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.dataset.trackIgnore = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
