import { Pencil, Plus, Trash2 } from 'lucide-react';

/** Change kinds (backend history_service OP_*): icon, colours, wording */
export const OPS = {
  updated: { icon: Pencil, verb: 'edited', tone: 'text-amber-300 bg-amber-500/10 ring-amber-500/20', label: 'Edited' },
  deleted: { icon: Trash2, verb: 'deleted', tone: 'text-red-300 bg-red-500/10 ring-red-500/20', label: 'Deleted' },
  created: { icon: Plus, verb: 'added', tone: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20', label: 'Added' },
};

// What a restore does to each kind of change (history_restore step kinds)
export const STEP_VERBS = {
  restore: 'Bring back',
  revert: 'Put back old values of',
  remove: 'Remove',
};

const FIELD_WORDS = { id: 'ID', url: 'URL', sku: 'SKU', seo: 'SEO', moq: 'MOQ', pdf: 'PDF', faq: 'FAQ' };

/** full_description -> "Full description", category_id -> "Category ID" */
export function humanizeField(name) {
  const words = String(name || '').split('_').filter(Boolean);
  return words
    .map((w, i) => FIELD_WORDS[w] || (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export const isLongText = (value) => typeof value === 'string' && (value.length > 80 || value.includes('\n'));

/** A stored value as text; objects and lists pretty-print */
export function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export const absoluteTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const clockTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

export function relativeTime(iso) {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** "Today", "Yesterday", "Monday, Oct 3" */
export function dayLabel(iso) {
  const date = new Date(iso);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "Product “Lobo Side”" or "Product #12" */
export function recordName(entry) {
  if (!entry) return '';
  if (entry.is_link) return entry.label || `${entry.type_label} ${entry.row_key}`;
  return entry.label ? `${entry.type_label} “${entry.label}”` : `${entry.type_label} #${entry.row_key}`;
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
