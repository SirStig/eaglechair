import { ChevronUp, ChevronDown } from 'lucide-react';

export function compareValues(a, b, dir) {
  const va = a == null ? '' : a;
  const vb = b == null ? '' : b;
  const mult = dir === 'asc' ? 1 : -1;
  if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb);
  const sa = String(va);
  const sb = String(vb);
  return mult * (sa.localeCompare(sb, undefined, { numeric: true }) || 0);
}

export default function TableSortHead({ label, sortKey, activeSortBy, sortDir, onSort, className = '' }) {
  if (sortKey == null) return <th className={className}>{label}</th>;
  const isActive = activeSortBy === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-left font-medium text-dark-300 hover:text-dark-100 transition-colors"
      >
        {label}
        {isActive ? (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronUp className="w-4 h-4 opacity-40" />}
      </button>
    </th>
  );
}
