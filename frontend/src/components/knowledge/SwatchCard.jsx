import SwatchImage from '../ui/SwatchImage';

/** One material swatch (finish, vinyl, laminate) with its name, code and a few facts. */
const SwatchCard = ({ item, kind, title, code, facts = [], description, badges = [] }) => (
  <article className="bg-white rounded-lg border border-cream-200 overflow-hidden hover:border-primary-500 transition-colors duration-300">
    <SwatchImage item={item} size="card" rounded="none" kind={kind} alt={title} className="w-full rounded-none" />
    <div className="p-3 sm:p-4">
      <h3 className="font-semibold text-slate-800 leading-snug">{title}</h3>
      {code && <p className="text-xs font-mono text-primary-700 mt-0.5">{code}</p>}
      {facts.filter(Boolean).length > 0 && (
        <p className="text-xs text-slate-500 mt-1">{facts.filter(Boolean).join(' · ')}</p>
      )}
      {description && <p className="text-sm text-slate-600 mt-2 line-clamp-3">{description}</p>}
      {badges.filter(Boolean).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {badges.filter(Boolean).map((b) => (
            <span key={b} className="px-2 py-0.5 text-xs bg-cream-100 text-slate-700 rounded">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  </article>
);

export default SwatchCard;
