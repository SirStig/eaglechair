import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Row selection for admin lists: click toggles a row, shift-click selects the
 * range from the last clicked row (in the order the table shows them), and
 * the header checkbox selects every row in view.
 *
 * Selected ids that are no longer in `items` (filtered out, deleted, next
 * page) drop out automatically.
 */
export default function useBulkSelection(items, getId = (item) => item.id) {
  const [selected, setSelected] = useState(() => new Set());
  const lastIdRef = useRef(null);

  const visibleIds = useMemo(() => (items || []).map(getId), [items, getId]);
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const selectedIds = useMemo(() => [...selected].filter((id) => visibleSet.has(id)), [selected, visibleSet]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const isSelected = useCallback((id) => selectedSet.has(id), [selectedSet]);

  /** Toggle one row; `orderedIds` is the on-screen order for shift ranges */
  const toggle = useCallback((id, event, orderedIds = visibleIds) => {
    const last = lastIdRef.current;
    setSelected((prev) => {
      const next = new Set([...prev].filter((v) => visibleSet.has(v)));
      if (event?.shiftKey && last != null && last !== id) {
        const a = orderedIds.indexOf(last);
        const b = orderedIds.indexOf(id);
        if (a !== -1 && b !== -1) {
          const on = !prev.has(id);
          orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((v) => (on ? next.add(v) : next.delete(v)));
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIdRef.current = id;
  }, [visibleIds, visibleSet]);

  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
    lastIdRef.current = null;
  }, [allSelected, visibleIds]);

  const clear = useCallback(() => {
    setSelected(new Set());
    lastIdRef.current = null;
  }, []);

  return {
    selectedIds,
    count: selectedIds.length,
    isSelected,
    toggle,
    toggleAll,
    allSelected,
    someSelected,
    clear,
  };
}
