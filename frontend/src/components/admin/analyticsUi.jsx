import { clsx } from 'clsx';
import { ArrowDownRight, ArrowUpRight, ExternalLink, FileDown } from 'lucide-react';
import { downloadCsv, formatNumber } from './analyticsFormat';

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

/**
 * Ranked rows with a thin magnitude bar under each label (single hue).
 * A row with `href` links its label to that public page (new tab).
 */
export function RankedList({ rows, empty, valueLabel, formatValue = formatNumber }) {
  if (!rows.length) return <EmptyRow>{empty}</EmptyRow>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="divide-y divide-white/[0.04]">
      {rows.map((row) => (
        <li key={row.key} className="group px-5 py-2.5" title={`${row.label}: ${formatValue(row.value)} ${valueLabel}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-sm text-dark-50 hover:text-primary-400"
                >
                  <span className="truncate">{row.label}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden="true" />
                </a>
              ) : (
                <p className="truncate text-sm text-dark-50">{row.label}</p>
              )}
              {row.sublabel && <p className="truncate text-xs text-dark-200">{row.sublabel}</p>}
            </div>
            <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-dark-50">{formatValue(row.value)}</span>
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

/** Card with a titled header row; `action` sits on the right of the header. */
export function Panel({ title, icon: Icon, subtitle, action, children, className }) {
  return (
    <section className={clsx('ec-card flex min-w-0 flex-col rounded-xl border', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-dark-50">
            {Icon && <Icon className="h-4 w-4 text-primary-500" aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-dark-200">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-shrink-0 items-center gap-1.5">{action}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

/** Small icon button that downloads `rows` as CSV. */
export function CsvButton({ filename, columns, rows, label = 'Export CSV' }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, columns, rows || [])}
      disabled={!rows?.length}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-dark-200 transition-colors hover:bg-white/[0.06] hover:text-dark-50 disabled:pointer-events-none disabled:opacity-30"
    >
      <FileDown className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** Compact segmented control for switching a panel between views. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-white/[0.04] p-0.5 ring-1 ring-inset ring-white/10" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx(
            'rounded px-2 py-1 text-[11px] font-semibold transition-colors',
            value === o.value ? 'bg-white/10 text-dark-50' : 'text-dark-200 hover:text-dark-50'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Step-by-step drop-off as horizontal bars, each scaled to the first step.
 * Shows each step's share of all visits and of the step before it.
 */
export function Funnel({ steps }) {
  const top = steps[0]?.sessions || 0;
  if (!top) return <EmptyRow>No sessions in this period.</EmptyRow>;
  return (
    <ol className="space-y-3 px-5 py-4">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].sessions : null;
        const ofTop = (step.sessions / top) * 100;
        return (
          <li key={step.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-dark-50">{step.label}</span>
              <span className="flex flex-shrink-0 items-baseline gap-2 tabular-nums">
                <span className="font-semibold text-dark-50">{formatNumber(step.sessions)}</span>
                <span className="w-12 text-right text-xs text-dark-200">{ofTop.toFixed(ofTop > 0 && ofTop < 10 ? 1 : 0)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
              <div className="h-full rounded-full bg-primary-500/80" style={{ width: `${step.sessions ? Math.max(ofTop, 1.5) : 0}%` }} />
            </div>
            {prev !== null && (
              <p className="mt-1 text-[11px] text-dark-300">
                {prev ? `${((step.sessions / prev) * 100).toFixed(0)}% of the step before` : 'No one reached the step before'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
