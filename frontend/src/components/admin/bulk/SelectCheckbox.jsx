import { useEffect, useRef } from 'react';

const BOX = 'h-4 w-4 rounded border-dark-500 bg-dark-700 text-primary-600 focus:ring-primary-500 cursor-pointer';

/** Header checkbox: checked when every row is selected, dashed when some are */
export function SelectAllCheckbox({ selection, label = 'Select all rows' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selection.someSelected;
  }, [selection.someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={BOX}
      checked={selection.allSelected}
      onChange={selection.toggleAll}
      aria-label={label}
    />
  );
}

/** Row checkbox; shift-click selects a range in `orderedIds` order */
export function RowCheckbox({ selection, id, orderedIds, label = 'Select row' }) {
  return (
    <input
      type="checkbox"
      className={BOX}
      checked={selection.isSelected(id)}
      // onClick (not onChange) so the shift key is available
      onClick={(e) => {
        e.stopPropagation();
        selection.toggle(id, e, orderedIds);
      }}
      onChange={() => {}}
      aria-label={label}
    />
  );
}
