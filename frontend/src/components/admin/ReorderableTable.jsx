import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

const ORDER_COLUMN_KEY = 'display_order';

function compareValues(a, b, dir) {
  const va = a == null ? '' : a;
  const vb = b == null ? '' : b;
  const mult = dir === 'asc' ? 1 : -1;
  if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb);
  const sa = String(va);
  const sb = String(vb);
  return mult * (sa.localeCompare(sb, undefined, { numeric: true }) || 0);
}

function SortableTh({ label, sortKey, activeSortBy, sortDir, onSort, className = '' }) {
  if (sortKey == null) {
    return <th className={className}>{label}</th>;
  }
  const isActive = activeSortBy === sortKey;
  const handleClick = () => onSort(sortKey);
  return (
    <th className={className}>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 text-left font-semibold text-dark-300 uppercase tracking-wider hover:text-dark-100 transition-colors"
      >
        {label}
        {isActive ? (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronUp className="w-4 h-4 opacity-40" />}
      </button>
    </th>
  );
}

function SortableRow({ id, index, children, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`transition-colors ${isDragging ? 'opacity-50 bg-dark-700 z-10' : ''}`}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging, index })}
    </tr>
  );
}

export default function ReorderableTable({
  items,
  setItems,
  getItemId,
  onReorder,
  headerCells,
  columns,
  renderRow,
  minWidth = '800px',
  orderLabel = 'Order',
  disabled = false,
}) {
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState(ORDER_COLUMN_KEY);
  const [sortDir, setSortDir] = useState('asc');

  const sortedItems = useMemo(() => {
    if (!columns || sortBy === ORDER_COLUMN_KEY) return items;
    return [...items].sort((a, b) => compareValues(a[sortBy], b[sortBy], sortDir));
  }, [items, columns, sortBy, sortDir]);

  const dragDisabled = !columns ? false : sortBy !== ORDER_COLUMN_KEY;
  const itemIds = sortedItems.map((item) => String(getItemId(item)));

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (d === 'asc' && key === sortBy ? 'desc' : 'asc'));
  }, [sortBy]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = itemIds.indexOf(active.id);
      const newIndex = itemIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedItems, oldIndex, newIndex);
      setItems(reordered);
      setSaving(true);
      try {
        await onReorder(reordered);
      } catch (err) {
        setItems(items);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [items, setItems, itemIds, sortedItems, onReorder]
  );

  const thClass = 'px-2 sm:px-3 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider';
  const thClassW0 = thClass + ' w-0';

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-full" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-dark-700">
              {columns ? (
                <>
                  <SortableTh label={orderLabel} sortKey={ORDER_COLUMN_KEY} activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={thClassW0} />
                  {columns.map((col) => (
                    <SortableTh key={col.key} label={col.label} sortKey={col.sortKey} activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={thClass} />
                  ))}
                </>
              ) : (
                <>
                  <th className={thClassW0}>{orderLabel}</th>
                  {headerCells}
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {sortedItems.map((item, index) => (
                <SortableRow
                  key={getItemId(item)}
                  id={String(getItemId(item))}
                  index={index}
                  disabled={disabled || saving || dragDisabled}
                >
                  {({ dragHandleProps, isDragging, index: rowIndex }) => (
                    <>
                      <td className="px-2 sm:px-3 py-3 align-top">
                        <div className="flex items-center gap-1">
                          <span className="text-dark-400 font-mono text-xs sm:text-sm tabular-nums w-6">
                            {rowIndex}
                          </span>
                          {!disabled && !saving && !dragDisabled && (
                            <button
                              type="button"
                              className="p-1 rounded cursor-grab active:cursor-grabbing touch-none text-dark-400 hover:text-dark-200 hover:bg-dark-700"
                              {...dragHandleProps}
                              aria-label="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      {renderRow(item, rowIndex)}
                    </>
                  )}
                </SortableRow>
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
