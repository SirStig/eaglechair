import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { ADMIN_NAV_ITEMS } from '../adminNav';

/**
 * ⌘K / Ctrl+K quick switcher for admin sections.
 */
export default function AdminCommandPalette({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV_ITEMS;
    return ADMIN_NAV_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const choose = (item) => {
    if (!item) return;
    onSelect(item);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Jump to section">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.08] bg-dark-800 shadow-2xl shadow-black/70">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-dark-200" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a section…"
            className="h-12 w-full border-0 bg-transparent text-sm text-dark-50 placeholder-dark-200 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={results[activeIndex] ? `palette-${results[activeIndex].id}` : undefined}
          />
          <kbd className="rounded border border-white/[0.1] px-1.5 py-0.5 text-[10.5px] text-dark-200">Esc</kbd>
        </div>
        <ul id="admin-palette-list" ref={listRef} role="listbox" className="admin-scrollbar max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-dark-200">No matching sections</li>}
          {results.map((item, i) => {
            const Icon = item.icon;
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const active = i === activeIndex;
            return (
              <li key={item.id} role="presentation">
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-dark-200">{item.group}</p>
                )}
                <button
                  id={`palette-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  onMouseMove={() => setActiveIndex(i)}
                  onClick={() => choose(item)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                    active ? 'bg-white/[0.07] text-dark-50' : 'text-dark-100'
                  )}
                >
                  <Icon className={clsx('h-4 w-4', active ? 'text-primary-500' : 'text-dark-200')} />
                  <span className="flex-1">{item.label}</span>
                  {active && <CornerDownLeft className="h-3.5 w-3.5 text-dark-200" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
