/**
 * Compact, editor-style controls for the 3D studio panels.
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';

/** A titled, collapsible inspector section. */
export function Section({ title, aside, children, defaultOpen = true, className }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={clsx('border-b border-white/[0.06]', className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-dark-100 hover:text-dark-50"
        >
          <ChevronRight className={clsx('h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150', open && 'rotate-90')} />
          <span className="truncate">{title}</span>
        </button>
        {aside}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

/** Icon button for toolbars; `active` shows a toggled-on state. */
export function ToolButton({ icon: Icon, label, active, onClick, disabled, className, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:opacity-40',
        active ? 'bg-primary-500/20 text-primary-400' : 'text-dark-100 hover:bg-white/[0.08] hover:text-dark-50',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Floating glass bar over the viewport. */
export function Toolbar({ className, children }) {
  return (
    <div className={clsx('pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-dark-900/80 p-1 shadow-lg backdrop-blur-md', className)}>
      {children}
    </div>
  );
}

export const Divider = () => <span className="mx-1 h-5 w-px bg-white/[0.1]" />;

/** Labelled slider with its value; double-click the label to reset. */
export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format = (v) => v.toFixed(2), defaultValue }) {
  return (
    <label className="block py-1">
      <span className="flex items-center justify-between text-xs text-dark-100">
        <span
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
          title={defaultValue !== undefined ? 'Double-click to reset' : undefined}
        >
          {label}
        </span>
        <span className="font-mono tabular-nums text-dark-50">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-1 w-full cursor-pointer accent-primary-500"
      />
    </label>
  );
}

/** Segmented control. options: [{ value, label, icon }] */
export function Segmented({ value, onChange, options, className, size = 'sm' }) {
  return (
    <div className={clsx('inline-flex rounded-md bg-dark-950/60 p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title || o.label}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex items-center gap-1 rounded px-2 font-medium transition-colors',
            size === 'sm' ? 'h-6 text-[11px]' : 'h-7 text-xs',
            value === o.value ? 'bg-dark-500 text-dark-50 shadow-sm' : 'text-dark-200 hover:text-dark-50',
          )}
        >
          {o.icon && <o.icon className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-dark-100">
        {label}
        {hint && <span className="mt-0.5 block text-[11px] text-dark-200">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 h-4 w-7 flex-shrink-0 rounded-full transition-colors', checked ? 'bg-primary-500' : 'bg-dark-500')}
      >
        <span className={clsx('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform', checked ? 'translate-x-3.5' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded-md border border-white/[0.08] bg-dark-950/50 px-2.5 text-xs text-dark-50 placeholder:text-dark-200 outline-none focus:border-primary-500/60"
    />
  );
}

export function Field({ label, children }) {
  return (
    <label className="block py-1">
      <span className="mb-1 block text-[11px] text-dark-200">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'h-8 w-full rounded-md border border-white/[0.08] bg-dark-950/50 px-2.5 text-xs text-dark-50 outline-none focus:border-primary-500/60';

/** Small key/value rows for file and scene info. */
export function InfoRows({ rows }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-dark-200">{k}</dt>
          <dd className="truncate text-right font-mono tabular-nums text-dark-50">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
