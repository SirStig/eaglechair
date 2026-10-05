import { ChevronDown, Search, Trash2, Layers, AlertTriangle } from 'lucide-react';
import { formatStockStatus } from '../../../utils/apiHelpers';
import { SelectAllCheckbox, RowCheckbox } from '../bulk/SelectCheckbox';
import { OPTION_GROUP_SWITCHES, STOCK_STATUS_OPTIONS, variationAnchor } from './productVariations';
import FamilyPicker from './FamilyPicker';

const DIMENSION_FIELDS = [
  { key: 'width', label: 'W (in)' },
  { key: 'depth', label: 'D (in)' },
  { key: 'height', label: 'H (in)' },
  { key: 'seat_width', label: 'Seat W' },
  { key: 'seat_depth', label: 'Seat D' },
  { key: 'seat_height', label: 'Seat H' },
  { key: 'arm_height', label: 'Arm H' },
  { key: 'back_height', label: 'Back H' },
  { key: 'weight', label: 'Weight (lbs)' },
  { key: 'shipping_weight', label: 'Ship weight (lbs)' },
  { key: 'upholstery_amount', label: 'Uph. (yd)' },
];

const INPUT = 'w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 outline-none';
const LABEL = 'block text-sm font-medium text-dark-200 mb-1.5';

const formatDollars = (cents) => {
  const dollars = (cents || 0) / 100;
  return `${dollars > 0 ? '+' : dollars < 0 ? '−' : ''}$${Math.abs(dollars).toFixed(2)}`;
};

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-dark-400">{title}</h4>
      {children}
    </section>
  );
}

function Chip({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-dark-700 text-dark-200 border-dark-600',
    warn: 'bg-amber-900/30 text-amber-300 border-amber-600/40',
    off: 'bg-red-900/20 text-red-300 border-red-500/30',
    on: 'bg-emerald-900/20 text-emerald-300 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex max-w-[12rem] items-center truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function VariationCard({
  variation,
  index,
  rowKey,
  expanded,
  onToggle,
  onChange,
  onRemove,
  selection,
  order,
  names,
  finishes,
  upholsteries,
  colors,
  families,
  categoryNames,
  productSwitches,
}) {
  const selected = selection.isSelected(rowKey);
  const set = (field, value) => onChange(index, { [field]: value });
  const details = [
    names.finishes[variation.finish_id],
    names.upholsteries[variation.upholstery_id],
    names.colors[variation.color_id],
  ].filter(Boolean);
  const overrides = OPTION_GROUP_SWITCHES.filter(({ field }) => variation[field] === true || variation[field] === false);

  return (
    <article
      id={variationAnchor(rowKey)}
      className={`scroll-mt-24 overflow-hidden rounded-xl border transition-colors ${
        selected ? 'border-primary-500 ring-1 ring-primary-500/40' : 'border-dark-600'
      } ${expanded ? 'bg-dark-800' : 'bg-dark-800/60'}`}
    >
      {/* Summary row: always visible, click to open */}
      <div className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${expanded ? 'border-b border-dark-600 bg-dark-700/50' : ''}`}>
        <RowCheckbox selection={selection} id={rowKey} orderedIds={order} label={`Select variation ${variation.sku || index + 1}`} />
        <button
          type="button"
          onClick={() => onToggle(rowKey)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-dark-600 text-xs font-bold tabular-nums text-dark-100">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className={`font-mono text-sm font-semibold ${variation.sku ? 'text-dark-50' : 'text-amber-300'}`}>
                {variation.sku || 'No SKU'}
              </span>
              {variation.name && <span className="truncate text-sm text-dark-300">{variation.name}</span>}
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              {!variation.sku && (
                <Chip tone="warn">
                  <AlertTriangle className="mr-1 h-3 w-3" /> SKU required to save
                </Chip>
              )}
              {details.map((d) => <Chip key={d}>{d}</Chip>)}
              {variation.is_available === false && <Chip tone="off">Not for sale</Chip>}
              {!!variation.price_adjustment && <Chip>{formatDollars(variation.price_adjustment)}</Chip>}
              {overrides.map(({ field, label }) => (
                <Chip key={field} tone={variation[field] ? 'on' : 'off'}>
                  {label} {variation[field] ? 'on' : 'off'}
                </Chip>
              ))}
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-dark-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(rowKey)}
          className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
          title="Remove variation"
          aria-label={`Remove variation ${variation.sku || index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-6 p-4 sm:p-5">
          <Section title="Identity">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className={LABEL}>SKU *</label>
                <input className={INPUT} value={variation.sku || ''} onChange={(e) => set('sku', e.target.value)} placeholder="6246-WB-BLK" />
              </div>
              <div className="md:col-span-2">
                <label className={LABEL}>
                  Name <span className="font-normal text-dark-400">(optional)</span>
                </label>
                <input
                  className={INPUT}
                  value={variation.name || ''}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Walnut Frame / Black Vinyl"
                />
              </div>
            </div>
          </Section>

          <Section title="Materials">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                ['finish_id', 'Finish', finishes, 'No finish'],
                ['upholstery_id', 'Upholstery', upholsteries, 'No upholstery'],
                ['color_id', 'Color', colors, 'No color'],
              ].map(([field, label, list, none]) => (
                <div key={field}>
                  <label className={LABEL}>{label}</label>
                  <select className={INPUT} value={variation[field] || ''} onChange={(e) => set(field, parseInt(e.target.value, 10) || null)}>
                    <option value="">{none}</option>
                    {list.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {OPTION_GROUP_SWITCHES.map(({ field, label }) => (
                <div key={field}>
                  <label className="mb-1 block text-xs text-dark-400">{label} options on site</label>
                  <select
                    className={`${INPUT} text-sm`}
                    value={variation[field] === true ? 'on' : variation[field] === false ? 'off' : ''}
                    onChange={(e) => set(field, e.target.value === '' ? null : e.target.value === 'on')}
                  >
                    <option value="">Same as product ({productSwitches[field] !== false ? 'on' : 'off'})</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Sales">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className={LABEL}>Stock status</label>
                <select
                  className={INPUT}
                  value={formatStockStatus(variation.stock_status) || 'Made to Order'}
                  onChange={(e) => set('stock_status', e.target.value)}
                >
                  {STOCK_STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Price adjustment (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className={`${INPUT} pl-7`}
                    value={(variation.price_adjustment || 0) / 100}
                    onChange={(e) => set('price_adjustment', Math.round(parseFloat(e.target.value) * 100) || 0)}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5">
                <input
                  type="checkbox"
                  checked={variation.is_available !== false}
                  onChange={(e) => set('is_available', e.target.checked)}
                  className="rounded border-dark-500"
                />
                <span className="text-dark-200">Available for sale</span>
              </label>
            </div>
          </Section>

          <Section title="Show in families">
            <p className="-mt-1 text-sm text-dark-400">
              When one of these families is viewed, this variation&apos;s image and info are shown.
            </p>
            <FamilyPicker
              families={families}
              selectedIds={variation.family_ids || []}
              onSelectedChange={(ids) => set('family_ids', ids)}
              categoryNames={categoryNames}
            />
          </Section>

          <Section title="Weight & dimensions override (optional)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {DIMENSION_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-dark-400">{label}</label>
                  <input
                    type="number"
                    step={key.includes('upholstery') ? '0.1' : '0.01'}
                    min="0"
                    value={variation[key] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      set(key, Number.isFinite(val) ? val : null);
                    }}
                    className="w-full rounded border border-dark-600 bg-dark-700 px-2 py-1.5 text-sm text-dark-50"
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </article>
  );
}

/**
 * Variations tab of the product editor: a jump list + filter for products
 * with many variations, and one collapsible card per variation whose header
 * summarises it (SKU, materials, availability, overrides). Adding variations,
 * expand/collapse all and batch edits live in the editor's floating dock.
 */
export default function ProductVariationsTab({
  variations,
  rows,
  names,
  onChange,
  onRemove,
  selection,
  expanded,
  onToggle,
  onJump,
  filter,
  onFilterChange,
  finishes,
  upholsteries,
  colors,
  families,
  categoryNames,
  productSwitches,
}) {
  const order = rows.map((r) => r.key);
  const unavailable = variations.filter((v) => v.is_available === false).length;
  const missingSku = variations.filter((v) => !v.sku).length;

  if (variations.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-dark-600 bg-dark-700/40 py-12 text-center">
        <Layers className="mx-auto mb-4 h-12 w-12 text-dark-400" />
        <p className="text-dark-200">No variations yet</p>
        <p className="mt-2 text-sm text-dark-400">
          Use <strong>Add variation</strong> in the bar below for each finish, upholstery or color combination.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Filter + jump list: follows the page below the top bar, stops at the
          ends of the variations section and never runs under the bottom dock */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col gap-3 rounded-xl border border-dark-600 bg-dark-800/95 p-3 lg:max-h-[calc(100dvh-12.5rem)]">
          <label className="flex items-center gap-2 rounded-lg border border-dark-600 bg-dark-700 px-2.5">
            <Search className="h-4 w-4 text-dark-400" />
            <input
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter SKU, name, material…"
              className="w-full bg-transparent py-2 text-sm text-dark-50 outline-none"
            />
          </label>
          <p className="px-1 text-xs text-dark-400">
            {variations.length} variation{variations.length === 1 ? '' : 's'}
            {unavailable > 0 && ` · ${unavailable} not for sale`}
            {missingSku > 0 && <span className="text-amber-300"> · {missingSku} missing SKU</span>}
          </p>
          <nav className="hidden min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain lg:block" aria-label="Jump to variation">
            {rows.map(({ variation, index, key }) => (
              <button
                key={key}
                type="button"
                onClick={() => onJump(key)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-dark-700 ${
                  expanded.has(key) ? 'bg-dark-700/70 text-dark-50' : 'text-dark-300'
                }`}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-dark-500">{index + 1}</span>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${variation.is_available === false ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="min-w-0 flex-1 truncate">
                  <span className={`font-mono ${variation.sku ? '' : 'text-amber-300'}`}>{variation.sku || 'No SKU'}</span>
                  {variation.name && <span className="text-dark-400"> · {variation.name}</span>}
                </span>
                {selection.isSelected(key) && <span className="h-2 w-2 rounded-sm bg-primary-500" title="Selected" />}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 space-y-3">
        <label className="inline-flex cursor-pointer items-center gap-2 px-1 text-sm text-dark-300">
          <SelectAllCheckbox selection={selection} label="Select all variations" />
          Select {filter ? 'matching' : 'all'} to batch edit
          <span className="hidden text-dark-500 sm:inline">(shift-click selects a range)</span>
        </label>
        {rows.length === 0 && <p className="px-1 py-6 text-sm text-dark-400">No variations match “{filter}”.</p>}
        {rows.map(({ variation, index, key }) => (
          <VariationCard
            key={key}
            variation={variation}
            index={index}
            rowKey={key}
            expanded={expanded.has(key)}
            onToggle={onToggle}
            onChange={onChange}
            onRemove={onRemove}
            selection={selection}
            order={order}
            names={names}
            finishes={finishes}
            upholsteries={upholsteries}
            colors={colors}
            families={families}
            categoryNames={categoryNames}
            productSwitches={productSwitches}
          />
        ))}
      </div>
    </div>
  );
}
