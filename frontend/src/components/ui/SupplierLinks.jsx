import { useState } from 'react';
import { resolveImageUrl } from '../../utils/apiHelpers';
import { readSupplier } from '../../utils/productOptions';

const ArrowIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={`${className} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
  </svg>
);


const siteIcon = (url) => {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return null;
  }
};

const ICON_BOXES = {
  sm: 'h-8 w-8 rounded-lg',
  lg: 'h-11 w-11 rounded-xl',
};

/**
 * Supplier mark: the logo uploaded in the admin, else the supplier site's own
 * icon, else a letter badge if that can't be loaded. `box` overrides the
 * size/shape classes (e.g. to match a swatch).
 */
export function SupplierIcon({ source, size = 'sm', box: boxClass }) {
  const candidates = [source.logoUrl && resolveImageUrl(source.logoUrl), siteIcon(source.url)].filter(Boolean);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];
  const box = boxClass || ICON_BOXES[size] || ICON_BOXES.sm;

  return (
    <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden border border-cream-200 bg-white`}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-3/4 w-3/4 object-contain"
          onError={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <span className={`font-bold text-primary-700 ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {source.name?.trim()?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </span>
  );
}

/**
 * Outside supplier catalogs we special-order from (e.g. "any Wilsonart HPL
 * pattern"), shown as clean tiles: the supplier's icon and name, its note
 * underneath, the whole tile opening their site in a new tab.
 *
 * variant: 'inline' (inside an option picker / quick view) or 'cards'
 * (materials resource pages). Clicks are recorded by the site analytics
 * through the data-track-* attributes.
 */
export default function SupplierLinks({ sources, variant = 'inline', title, productId, className = '' }) {
  const items = (sources || []).map(readSupplier).filter((s) => s.url);
  if (items.length === 0) return null;

  const tile = (s, large) => (
    <a
      key={s.id}
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      data-track-type="supplier_link"
      data-track-label={`${s.name} supplier catalog`}
      data-track-product={productId || undefined}
      aria-label={`${s.name} (opens their website in a new tab)`}
      className={`group flex items-center gap-3 rounded-xl border border-cream-300 bg-white transition-all hover:border-primary-400 hover:shadow-md ${
        large ? 'p-4' : 'px-3 py-2.5'
      }`}
    >
      <SupplierIcon source={s} size={large ? 'lg' : 'sm'} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-semibold text-slate-800 ${large ? 'text-base' : 'text-sm'}`}>{s.name}</span>
        {s.description && (
          <span className={`mt-0.5 block leading-snug text-slate-500 ${large ? 'text-sm' : 'line-clamp-2 text-xs'}`}>
            {s.description}
          </span>
        )}
      </span>
      <ArrowIcon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-primary-600" />
    </a>
  );

  if (variant === 'cards') {
    return (
      <section className={className} aria-label={title || 'Special order from supplier catalogs'}>
        <h2 className="mb-1 text-xl font-bold text-slate-800 sm:text-2xl">{title || 'Special order from supplier catalogs'}</h2>
        <p className="mb-4 text-sm text-slate-600">
          We also order any pattern from these suppliers. Pick one on their site, then note its name or number in your
          quote request.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((s) => tile(s, true))}</div>
      </section>
    );
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title || 'Special order from'}</p>
      <div className="grid gap-2 sm:grid-cols-2">{items.map((s) => tile(s, false))}</div>
    </div>
  );
}
