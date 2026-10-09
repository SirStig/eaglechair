import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import SwatchImage from './SwatchImage';
import SupplierLinks, { SupplierIcon } from './SupplierLinks';
import { readSupplier } from '../../utils/productOptions';

// Above this many options a section gets a filter box
const SEARCH_THRESHOLD = 20;

const normalize = (opt) => (opt && typeof opt === 'object' ? opt : { name: opt });

const optionKey = (opt, idx) => opt.id ?? `${opt.name}-${idx}`;

const isSame = (a, b) => {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  return na.id != null && nb.id != null ? na.id === nb.id : na.name === nb.name;
};

const Chevron = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ExternalBadge = () => (
  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm">
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 17L17 7M9 7h8v8" />
    </svg>
  </span>
);

const suppliersOf = (section) => (section.sources || []).map(readSupplier).filter((s) => s.url);

const Arrow = ({ dir }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
  </svg>
);

/**
 * Two-row horizontal swatch strip with smooth scrolling and edge arrows.
 */
const SwatchStrip = ({ section, compact, productId }) => {
  const scrollerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [edges, setEdges] = useState({ left: false, right: false });

  const options = useMemo(() => section.options.map(normalize), [section.options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => [o.name, o.brand].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [options, query]);

  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  };

  // Bring the current selection into view when the strip opens
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const target = el?.querySelector('[aria-pressed="true"]');
    if (el && target) {
      el.scrollLeft = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
    }
    updateEdges();
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filtered.length]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const itemWidth = compact ? 'w-[4.5rem]' : 'w-[5.5rem] sm:w-24';
  // Short lists stay on one row instead of splitting into two half-empty rows
  // "None" leads the strip unless the customer is filtering
  const showNone = !query.trim();
  // Supplier catalogs sit right after "None" as link icons (hidden while filtering)
  const suppliers = showNone ? suppliersOf(section) : [];
  const rows = filtered.length + suppliers.length + (showNone ? 1 : 0) <= 4 ? 'grid-rows-1' : 'grid-rows-2';
  const noneDot = compact ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-10 h-10 sm:w-12 sm:h-12';

  return (
    <div className="pt-3">
      {options.length > SEARCH_THRESHOLD && (
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${options.length} ${section.label.toLowerCase()} options`}
            aria-label={`Search ${section.label.toLowerCase()} options`}
            className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">No matches for “{query}”.</p>
      ) : (
        <div className="relative">
          <div
            ref={scrollerRef}
            onScroll={updateEdges}
            role="group"
            aria-label={`${section.label} options`}
            className={`grid ${rows} grid-flow-col auto-cols-max gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide overscroll-x-contain`}
          >
            {showNone && (
              <button
                type="button"
                aria-pressed={!section.selected}
                title={`No ${section.label.toLowerCase()} preference`}
                onClick={() => section.onSelect(null)}
                className={`${itemWidth} snap-start flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-colors text-center ${!section.selected
                  ? 'border-primary-600 bg-primary-50 text-primary-900'
                  : 'border-transparent bg-white text-slate-700 hover:border-primary-300'
                  }`}
              >
                <span className={`${noneDot} flex items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400`}>
                  <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" strokeWidth={1.75} />
                    <path strokeLinecap="round" strokeWidth={1.75} d="M6.5 17.5l11-11" />
                  </svg>
                </span>
                <span className="text-[11px] leading-tight font-medium line-clamp-2 break-words w-full">None</span>
              </button>
            )}
            {suppliers.map((s) => (
              <a
                key={`supplier-${s.id ?? s.name}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                data-track-type="supplier_link"
                data-track-label={`${s.name} supplier catalog`}
                data-track-product={productId || undefined}
                title={s.description ? `${s.name}: ${s.description}` : `Browse ${s.name}'s catalog`}
                aria-label={`Special order from ${s.name} (opens their website in a new tab)`}
                className={`${itemWidth} snap-start flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 border-dashed border-cream-300 bg-white text-slate-700 hover:border-primary-400 hover:text-primary-800 transition-colors text-center`}
              >
                <span className="relative">
                  <SupplierIcon source={s} box={`${noneDot} rounded-full`} />
                  <ExternalBadge />
                </span>
                <span className="text-[11px] leading-tight font-medium line-clamp-2 break-words w-full">{s.name}</span>
              </a>
            ))}
            {filtered.map((opt, idx) => {
              const selected = isSame(section.selected, opt);
              return (
                <button
                  key={optionKey(opt, idx)}
                  type="button"
                  aria-pressed={selected}
                  title={opt.brand ? `${opt.name} (${opt.brand})` : opt.name}
                  onClick={() => section.onSelect(opt)}
                  className={`${itemWidth} snap-start flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-colors text-center ${selected
                    ? 'border-primary-600 bg-primary-50 text-primary-900'
                    : 'border-transparent bg-white text-slate-700 hover:border-primary-300'
                    }`}
                >
                  <SwatchImage item={opt} size={compact ? 'sm' : 'md'} rounded="circle" zoom kind={section.kind} />
                  <span className="text-[11px] leading-tight font-medium line-clamp-2 break-words w-full">{opt.name}</span>
                </button>
              );
            })}
          </div>

          {edges.left && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-cream-50 to-transparent" />
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label={`Scroll ${section.label.toLowerCase()} left`}
                className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white shadow-md border border-cream-300 text-slate-700 hover:text-primary-700"
              >
                <Arrow dir="left" />
              </button>
            </>
          )}
          {edges.right && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream-50 to-transparent" />
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label={`Scroll ${section.label.toLowerCase()} right`}
                className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white shadow-md border border-cream-300 text-slate-700 hover:text-primary-700"
              >
                <Arrow dir="right" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Accordion of option pickers (finish, upholstery, laminate...). Only one
 * section is open at a time; closed sections show the current selection.
 *
 * sections: [{ key, label, kind, options, selected, onSelect, sources? }]
 *
 * `sources` are outside supplier catalogs for that option (special order,
 * e.g. any Wilsonart laminate). A section shows when it has swatches, supplier
 * links or both; the links sit under the swatches.
 */
const OptionPicker = ({ sections, compact = false, className = '', productId }) => {
  const baseId = useId();
  const visible = sections.filter((s) => s.options?.length > 0 || s.sources?.length > 0);
  const [openKey, setOpenKey] = useState(null);

  if (visible.length === 0) return null;

  return (
    <div className={`divide-y divide-cream-200 border border-cream-200 rounded-xl bg-cream-50 ${className}`}>
      {visible.map((section) => {
        const isOpen = openKey === section.key;
        const selected = section.selected ? normalize(section.selected) : null;
        const panelId = `${baseId}-${section.key}`;
        const optionCount = section.options?.length || 0;
        const suppliers = suppliersOf(section);
        // Name one or two suppliers; past that the logos carry it and the text just counts
        const supplierText = suppliers.length <= 2
          ? suppliers.map((src) => src.name).join(' & ')
          : `${suppliers.length} supplier catalogs`;
        let subtitle = `${optionCount} option${optionCount === 1 ? '' : 's'}`;
        if (suppliers.length) {
          subtitle = optionCount ? `${subtitle} · or special order from ${supplierText}` : `Special order from ${supplierText}`;
        }
        return (
          <div key={section.key} className={compact ? 'px-3' : 'px-3 sm:px-4'}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenKey(isOpen ? null : section.key)}
              className={`w-full flex items-center gap-3 text-left ${compact ? 'py-2' : 'py-3'}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">{section.label}</span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                  {suppliers.length > 0 && (
                    <span className="flex flex-shrink-0 -space-x-1.5" aria-hidden="true">
                      {suppliers.slice(0, 4).map((src) => (
                        <SupplierIcon key={src.id ?? src.name} source={src} box="h-5 w-5 rounded-full ring-2 ring-cream-50" />
                      ))}
                    </span>
                  )}
                  <span className="truncate" title={suppliers.length > 2 ? suppliers.map((src) => src.name).join(', ') : undefined}>
                    {subtitle}
                  </span>
                </span>
              </span>
              <span className="ml-auto flex max-w-[50%] flex-shrink-0 items-center gap-2 min-w-0">
                {selected ? (
                  <>
                    <span className="text-sm text-slate-700 truncate">{selected.name}</span>
                    <SwatchImage item={selected} size="sm" rounded="circle" zoom kind={section.kind} />
                  </>
                ) : (
                  <span className="text-sm text-slate-400">{optionCount ? 'None' : 'View'}</span>
                )}
                <Chevron className={`w-4 h-4 flex-shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div
                  id={panelId}
                  key="panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="pb-3 -mt-1">
                    {optionCount > 0 ? (
                      <>
                        <SwatchStrip section={section} compact={compact} productId={productId} />
                        {suppliers.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Dashed icons open supplier catalogs we special order from. Note the pattern name/number in
                            your quote request.
                          </p>
                        )}
                      </>
                    ) : (
                      <SupplierLinks sources={section.sources} productId={productId} className="mt-2" title="Special order" />
                    )}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default OptionPicker;
