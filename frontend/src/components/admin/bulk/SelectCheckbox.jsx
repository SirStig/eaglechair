import { useEffect, useRef } from 'react';

const BOX = 'h-4 w-4 rounded border-dark-500 bg-dark-700 text-primary-600 focus:ring-primary-500 cursor-pointer';

// Shift-click selects a range of rows; stop it also highlighting page text
const noShiftTextSelect = (e) => {
  if (e.shiftKey) e.preventDefault();
};

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
      onMouseDown={noShiftTextSelect}
      aria-label={label}
    />
  );
}

/**
 * Table cell holding a row checkbox. The whole cell toggles the row, so the
 * tap target is bigger than the box itself; the rest of the row stays free to
 * open the item.
 */
export function SelectCell({ selection, id, orderedIds, label, className = 'px-3 py-3 align-middle' }) {
  return (
    <td
      className={`w-0 cursor-pointer select-none ${className}`}
      data-select-cell
      onMouseDown={noShiftTextSelect}
      onClick={(e) => {
        if (e.target.closest('input')) return; // the checkbox handles itself
        e.stopPropagation();
        selection.toggle(id, e, orderedIds);
      }}
    >
      <RowCheckbox selection={selection} id={id} orderedIds={orderedIds} label={label} />
    </td>
  );
}
