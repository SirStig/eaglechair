import { clsx } from 'clsx';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatNumber } from './analyticsFormat';

/** Shared pieces for the admin Analytics page and the dashboard overview. */

function changeOf(current, previous) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

/** Percent change vs the previous period; `invert` when lower is better. */
export function Delta({ current, previous, invert = false, suffix = 'vs prev.' }) {
  const change = changeOf(current, previous);
  if (change === null) {
    return <span className="text-[11px] font-medium text-dark-200">New this period</span>;
  }
  if (Math.abs(change) < 0.5) {
    return <span className="text-[11px] font-medium text-dark-200">No change</span>;
  }
  const up = change > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-[11px] font-medium', good ? 'text-emerald-300' : 'text-secondary-300')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(change) >= 1000 ? '999+' : Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%
      <span className="sr-only">{up ? 'increase' : 'decrease'}</span>
      {suffix && <span className="ml-1 font-normal text-dark-200">{suffix}</span>}
    </span>
  );
}

export function EmptyRow({ children }) {
  return <p className="px-5 py-8 text-center text-sm text-dark-200">{children}</p>;
}

/** Ranked rows with a thin magnitude bar under each label (single hue). */
export function RankedList({ rows, empty, valueLabel }) {
  if (!rows.length) return <EmptyRow>{empty}</EmptyRow>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="divide-y divide-white/[0.04]">
      {rows.map((row) => (
        <li key={row.key} className="group px-5 py-2.5" title={`${row.label}: ${formatNumber(row.value)} ${valueLabel}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-dark-50">{row.label}</p>
              {row.sublabel && <p className="truncate text-xs text-dark-200">{row.sublabel}</p>}
            </div>
            <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-dark-50">{formatNumber(row.value)}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-primary-500/70 transition-colors group-hover:bg-primary-500"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Tiny trend line for stat tiles; decorative (the tile states the number). */
export function Sparkline({ values, className }) {
  if (!values || values.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${(h - 2 - (v / max) * (h - 4)).toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={clsx('h-7 w-full', className)} aria-hidden="true">
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="rgba(244,165,45,0.10)" />
      <polyline
        points={points}
        fill="none"
        stroke="#f4a52d"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
