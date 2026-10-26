import { useEffect, useRef } from 'react';

const BOX = 'h-4 w-4 rounded border-dark-500 bg-dark-700 text-primary-600 focus:ring-primary-500 cursor-pointer';

/**
 * One checkbox for a long option list. Checked clears every id; anything else
 * selects every id. A partial selection shows the indeterminate dash.
 * The next selection is either all of `ids` or none — callers that must keep
 * a primary id re-add it themselves.
 */
const SelectAllToggle = ({ ids = [], selectedIds = [], onChange, group }) => {
  const ref = useRef(null);
  const selected = new Set(selectedIds);
  const count = ids.reduce((n, id) => n + (selected.has(id) ? 1 : 0), 0);
  const all = ids.length > 0 && count === ids.length;
  const some = count > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  if (ids.length === 0) return null;

  const action = all ? 'Unselect all' : 'Select all';

  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 whitespace-nowrap text-xs font-medium text-dark-300">
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        onChange={() => onChange(all ? [] : ids.slice())}
        className={BOX}
      />
      <span>{action}</span>
      {group ? <span className="sr-only"> {group}</span> : null}
      <span className="font-normal text-dark-400">
        {count} of {ids.length}
      </span>
    </label>
  );
};

export default SelectAllToggle;
