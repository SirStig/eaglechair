import { useMemo, useState } from 'react';
import { Check, Search, Star, X } from 'lucide-react';
import { resolveImageUrl } from '../../../utils/apiHelpers';

const Thumb = ({ url }) =>
  url ? (
    <img src={resolveImageUrl(url)} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded bg-dark-900 object-contain" />
  ) : (
    <span className="h-9 w-9 shrink-0 rounded bg-dark-800" aria-hidden="true" />
  );

/**
 * Searchable family chooser for products and variations (there are hundreds
 * of families, so a plain select / checkbox wall doesn't scale).
 *
 * - selectedIds / onSelectedChange: the families it's shown in
 * - primaryId / onPrimaryChange (optional): the product's main family. When
 *   given, the primary is listed with the selected chips and any family can
 *   be promoted; the primary is never also in selectedIds.
 * - categoryNames: optional { [categoryId]: name } shown next to each family
 */
const FamilyPicker = ({
  families = [],
  selectedIds = [],
  onSelectedChange,
  primaryId = null,
  onPrimaryChange,
  categoryNames = {},
  emptyText = 'No families. Add families in Product Families.',
}) => {
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const withPrimary = typeof onPrimaryChange === 'function';

  const byId = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isChosen = (id) => selected.has(id) || (withPrimary && id === primaryId);

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = families.filter((f) => {
    if (onlySelected && !isChosen(f.id)) return false;
    if (!tokens.length) return true;
    const hay = `${f.name} ${f.slug || ''} ${categoryNames[f.category_id] || ''}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });

  const add = (id) => {
    if (withPrimary && primaryId == null) {
      onPrimaryChange(id);
      return;
    }
    if (!selected.has(id)) onSelectedChange([...selectedIds, id]);
  };

  const remove = (id) => {
    if (withPrimary && id === primaryId) {
      onPrimaryChange(null);
      return;
    }
    onSelectedChange(selectedIds.filter((x) => x !== id));
  };

  // The old primary stays on as an additional family
  const makePrimary = (id) => {
    const rest = selectedIds.filter((x) => x !== id);
    onSelectedChange(primaryId != null && primaryId !== id ? [...rest, primaryId] : rest);
    onPrimaryChange(id);
  };

  const chips = [
    ...(withPrimary && primaryId != null ? [primaryId] : []),
    ...selectedIds.filter((id) => !(withPrimary && id === primaryId)),
  ];

  if (!families.length) return <p className="text-sm text-dark-400">{emptyText}</p>;

  return (
    <div className="space-y-3">
      {/* Chosen families */}
      <div className="flex min-h-[40px] flex-wrap gap-2">
        {chips.length === 0 && (
          <span className="self-center text-sm text-dark-400">
            {withPrimary ? 'No family yet. The first one you add becomes the primary family.' : 'Not shown in any family.'}
          </span>
        )}
        {chips.map((id) => {
          const fam = byId.get(id);
          const isPrimary = withPrimary && id === primaryId;
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-1.5 text-sm ${
                isPrimary ? 'border-primary-500 bg-primary-900/30 text-dark-50' : 'border-dark-500 bg-dark-700 text-dark-100'
              }`}
            >
              <span className="h-6 w-6 overflow-hidden rounded-full bg-dark-900">
                {fam?.family_image && <img src={resolveImageUrl(fam.family_image)} alt="" className="h-full w-full object-cover" />}
              </span>
              {fam?.name || `Family #${id}`}
              {isPrimary && <span className="rounded bg-primary-600 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-white">Primary</span>}
              {withPrimary && !isPrimary && (
                <button
                  type="button"
                  onClick={() => makePrimary(id)}
                  className="rounded-full p-0.5 text-dark-300 hover:text-primary-400"
                  title="Make primary family"
                  aria-label={`Make ${fam?.name || 'family'} the primary family`}
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(id)}
                className="rounded-full p-0.5 text-dark-300 hover:text-red-300"
                aria-label={`Remove ${fam?.name || 'family'}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
      </div>

      {/* Search + list */}
      <div className="overflow-hidden rounded-lg border border-dark-600 bg-dark-700">
        <div className="flex items-center gap-2 border-b border-dark-600 p-2">
          <label className="relative flex-1">
            <span className="sr-only">Search families</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-300" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the single match instead of submitting the form
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (visible.length === 1 && !isChosen(visible[0].id)) add(visible[0].id);
                }
              }}
              placeholder={`Search ${families.length} families…`}
              className="w-full rounded-md border border-dark-500 bg-dark-800 py-1.5 pl-9 pr-3 text-sm text-dark-50 placeholder:text-dark-300 focus:border-primary-500 focus:outline-none"
            />
          </label>
          <div className="flex shrink-0 rounded-md border border-dark-500 bg-dark-800 p-0.5 text-xs" role="group" aria-label="Show">
            {[[false, 'All'], [true, `Selected (${chips.length})`]].map(([value, text]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setOnlySelected(value)}
                aria-pressed={onlySelected === value}
                className={`rounded px-2 py-1 font-medium ${onlySelected === value ? 'bg-dark-500 text-dark-50' : 'text-dark-300 hover:text-dark-100'}`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <ul className="max-h-72 divide-y divide-dark-600 overflow-y-auto" aria-label="Families">
          {visible.map((f) => {
            const chosen = isChosen(f.id);
            const isPrimary = withPrimary && f.id === primaryId;
            return (
              <li key={f.id} className={`flex items-center gap-3 px-3 py-1.5 ${chosen ? 'bg-dark-600/60' : 'hover:bg-dark-600/40'}`}>
                <button
                  type="button"
                  onClick={() => (chosen ? remove(f.id) : add(f.id))}
                  aria-pressed={chosen}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      chosen ? 'border-primary-500 bg-primary-600 text-white' : 'border-dark-400'
                    }`}
                  >
                    {chosen && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <Thumb url={f.family_image} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-dark-50">{f.name}</span>
                    {categoryNames[f.category_id] && (
                      <span className="block truncate text-xs text-dark-300">{categoryNames[f.category_id]}</span>
                    )}
                  </span>
                </button>
                {isPrimary && <span className="shrink-0 text-xs font-medium text-primary-400">Primary</span>}
                {withPrimary && !isPrimary && (
                  <button
                    type="button"
                    onClick={() => makePrimary(f.id)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-dark-300 hover:bg-dark-500 hover:text-dark-50"
                  >
                    Make primary
                  </button>
                )}
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-dark-400">
              {onlySelected && !tokens.length ? 'Nothing selected yet.' : `No families match “${query}”.`}
            </li>
          )}
        </ul>
        <p className="border-t border-dark-600 px-3 py-1.5 text-xs text-dark-400">
          Showing {visible.length} of {families.length}
        </p>
      </div>
    </div>
  );
};

export default FamilyPicker;
