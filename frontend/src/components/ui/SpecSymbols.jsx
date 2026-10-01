/**
 * Product dimensions with their catalog spec symbols (see utils/specSymbols).
 *
 * size="md": two-column grid, symbol beside value and label (product page).
 * size="sm": one compact line per spec (quick view).
 */

const SpecMark = ({ item, className }) => (
  item.icon ? (
    <img src={item.icon} alt="" aria-hidden="true" className={`${className} object-contain`} loading="lazy" />
  ) : (
    <span
      aria-hidden="true"
      className={`${className} inline-flex items-center justify-center rounded border border-cream-300 text-[10px] font-semibold tracking-tight text-slate-500`}
    >
      {item.badge}
    </span>
  )
);

const SpecSymbols = ({ items, size = 'md' }) => {
  if (!items?.length) return null;

  // Catalog style: symbol + value only; the label is the tooltip / screen-reader text
  if (size === 'sm') {
    return (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1 min-w-0" title={`${item.label}: ${item.value}`}>
            <SpecMark item={item} className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-slate-700 whitespace-nowrap">
              <span className="sr-only">{item.label}: </span>
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2.5 min-w-0">
          <SpecMark item={item} className="w-9 h-9 flex-shrink-0" />
          <div className="min-w-0 leading-tight flex flex-col-reverse">
            <dt className="text-xs text-slate-500 truncate">{item.label}</dt>
            <dd className="text-[15px] font-semibold text-slate-800">{item.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
};

export default SpecSymbols;
