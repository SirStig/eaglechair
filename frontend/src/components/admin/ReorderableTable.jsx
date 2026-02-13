import { useCallback, useState } from 'react';
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
import { GripVertical } from 'lucide-react';

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
  renderRow,
  minWidth = '800px',
  orderLabel = 'Order',
  disabled = false,
}) {
  const [saving, setSaving] = useState(false);
  const itemIds = items.map((item) => String(getItemId(item)));

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

      const reordered = arrayMove(items, oldIndex, newIndex);
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
    [items, setItems, itemIds, onReorder]
  );

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-full" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-dark-700">
              <th className="px-2 sm:px-3 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider w-0">
                {orderLabel}
              </th>
              {headerCells}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {items.map((item, index) => (
                <SortableRow
                  key={getItemId(item)}
                  id={String(getItemId(item))}
                  index={index}
                  disabled={disabled || saving}
                >
                  {({ dragHandleProps, isDragging, index: rowIndex }) => (
                    <>
                      <td className="px-2 sm:px-3 py-3 align-top">
                        <div className="flex items-center gap-1">
                          <span className="text-dark-400 font-mono text-xs sm:text-sm tabular-nums w-6">
                            {rowIndex}
                          </span>
                          {!disabled && !saving && (
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
