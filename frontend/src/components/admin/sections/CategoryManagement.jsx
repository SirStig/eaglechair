import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit2, Trash2, FolderTree, GripVertical } from 'lucide-react';
import CategoryEditor from './CategoryEditor';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';

function SortableCategoryRow({ category, index, isExpanded, hasSubcategories, onToggle, getSubcategoryCount, getCategoryName, handleEdit, handleDelete, handleCreateSubcategory, handleEditSubcategory, handleDeleteSubcategory, expandedCategories }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(category.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <React.Fragment>
      <tr
        ref={setNodeRef}
        style={style}
        className={`hover:bg-dark-750 transition-colors ${isDragging ? 'opacity-50 bg-dark-700 z-10' : ''}`}
      >
        <td className="px-2 sm:px-3 py-3 align-top">
          <div className="flex items-center gap-1">
            <span className="text-dark-400 font-mono text-xs sm:text-sm tabular-nums w-6">{index}</span>
            <button
              type="button"
              className="p-1 rounded cursor-grab active:cursor-grabbing touch-none text-dark-400 hover:text-dark-200 hover:bg-dark-700"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          </div>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            {hasSubcategories && (
              <button
                onClick={() => onToggle(category.id)}
                className="p-1 hover:bg-dark-700 rounded transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg 
                  className={`w-4 h-4 text-dark-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {category.icon_url ? (
              <img 
                src={resolveImageUrl(category.icon_url)} 
                alt={category.name}
                className="w-10 h-10 object-contain rounded-lg border border-dark-600"
              />
            ) : (
              <div className="w-10 h-10 bg-dark-700 rounded-lg border border-dark-600 flex items-center justify-center">
                <FolderTree className="w-5 h-5 text-dark-500" />
              </div>
            )}
          </div>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="font-medium text-dark-50">{category.name}</div>
          <div className="text-xs text-dark-400 mt-1">Order: {category.display_order}</div>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <code className="text-xs sm:text-sm text-dark-300 bg-dark-700 px-2 py-1 rounded">/{category.slug}</code>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="text-xs sm:text-sm text-dark-300 line-clamp-2 max-w-md">
            {category.description || <span className="text-dark-500 italic">No description</span>}
          </div>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          {hasSubcategories ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-900/30 border border-primary-800 text-primary-400 text-xs rounded-md font-medium">
              <FolderTree className="w-3 h-3" />
              {getSubcategoryCount(category)}
            </span>
          ) : (
            <span className="text-dark-500 text-xs">None</span>
          )}
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
            category.is_active
              ? 'bg-green-900/30 border border-green-800 text-green-400'
              : 'bg-red-900/30 border border-red-800 text-red-400'
          }`}>
            {category.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleCreateSubcategory(category)}
              className="px-3 py-1.5 text-xs text-green-400 hover:bg-green-900/20 border border-green-800/50 rounded-lg transition-colors"
              title="Add subcategory"
            >
              + Sub
            </button>
            <button
              onClick={() => handleEdit(category)}
              className="p-2 text-primary-400 hover:bg-primary-900/20 rounded-lg transition-colors"
              title="Edit category"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(category.id)}
              className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {hasSubcategories && isExpanded && category.subcategories.map((subcat) => (
        <tr key={`sub-${subcat.id}`} className="bg-dark-750/50 hover:bg-dark-700 transition-colors">
          <td className="px-6 py-3" />
          <td className="px-6 py-3">
            <div className="flex items-center gap-2 pl-8">
              {subcat.icon_url ? (
                <img 
                  src={resolveImageUrl(subcat.icon_url)} 
                  alt={subcat.name}
                  className="w-8 h-8 object-contain rounded-lg border border-dark-600"
                />
              ) : (
                <div className="w-8 h-8 bg-dark-600 rounded-lg border border-dark-500 flex items-center justify-center">
                  <FolderTree className="w-4 h-4 text-dark-500" />
                </div>
              )}
            </div>
          </td>
          <td className="px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-dark-400 text-xs">└</span>
              <div>
                <div className="text-sm font-medium text-dark-200">{subcat.name}</div>
                <div className="text-xs text-dark-500 mt-0.5">Subcategory · Order: {subcat.display_order}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-3">
            <code className="text-xs text-dark-400 bg-dark-700 px-2 py-1 rounded">/{subcat.slug}</code>
          </td>
          <td className="px-6 py-3">
            <div className="text-xs text-dark-400 line-clamp-1 max-w-md">
              {subcat.description || <span className="text-dark-500 italic">No description</span>}
            </div>
          </td>
          <td className="px-6 py-3">
            <span className="text-dark-600 text-xs">—</span>
          </td>
          <td className="px-6 py-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              subcat.is_active
                ? 'bg-green-900/30 border border-green-800 text-green-400'
                : 'bg-red-900/30 border border-red-800 text-red-400'
            }`}>
              {subcat.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="px-6 py-3">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleEditSubcategory(subcat)}
                className="p-1.5 text-primary-400 hover:bg-primary-900/20 rounded-lg transition-colors"
                title="Edit subcategory"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteSubcategory(subcat.id)}
                className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete subcategory"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </React.Fragment>
  );
}

/**
 * Category Management Component
 * Table-based category list with separate editor component
 */
const CategoryManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  
  useEffect(() => {
    fetchCategories();
  }, [refreshKeys.categories]);
  
  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/categories');
      setCategories(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
  };

  const handleCreate = () => {
    setEditingCategory({});
  };

  const handleBack = () => {
    setEditingCategory(null);
  };

  const handleSave = (message) => {
    setEditingCategory(null);
    toast.success(message || (editingCategory?.id ? 'Category updated' : 'Category created'));
    fetchCategories();
  };
  
  const handleDelete = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await apiClient.delete(`/api/v1/admin/categories/${categoryId}`);
      toast.success('Category deleted');
      await fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete category');
    }
  };

  const handleDeleteSubcategory = async (subcategoryId) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;
    try {
      await apiClient.delete(`/api/v1/admin/catalog/subcategories/${subcategoryId}`);
      toast.success('Subcategory deleted');
      await fetchCategories();
    } catch (error) {
      console.error('Failed to delete subcategory:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete subcategory');
    }
  };

  const parentCategoryForSubcategory = editingCategory?.parent_id != null && !editingCategory?.id
    ? categories.find((c) => c.id === editingCategory.parent_id)
    : editingCategory?.id && categories.some((c) => c.subcategories?.some((s) => s.id === editingCategory.id))
      ? categories.find((c) => c.subcategories?.some((s) => s.id === editingCategory.id))
      : null;
  const isSubcategory = !!editingCategory?.id && categories.some((c) => c.subcategories?.some((s) => s.id === editingCategory.id));

  const getSubcategoryCount = (category) => {
    return category.subcategories?.length || 0;
  };

  const getCategoryName = (categoryId) => {
    for (const c of categories) {
      if (c.id === categoryId) return c.name;
      const sub = c.subcategories?.find(s => s.id === categoryId);
      if (sub) return sub.name;
    }
    return 'N/A';
  };

  const toggleExpanded = (categoryId) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleCreateSubcategory = (parentCategory) => {
    setEditingCategory({ parent_id: parentCategory.id });
  };

  const topLevelCategories = useMemo(
    () => [...(categories || [])].filter(c => !c.parent_id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [categories]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleReorder = useCallback(
    async (ordered) => {
      const order = ordered.map((cat, index) => ({ id: cat.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/categories/reorder', { order });
        toast.success('Display order updated');
        fetchCategories();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchCategories, toast]
  );

  const onDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = topLevelCategories.findIndex(c => String(c.id) === active.id);
      const newIndex = topLevelCategories.findIndex(c => String(c.id) === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(topLevelCategories, oldIndex, newIndex);
      setCategories(prev => {
        const topLevel = prev.filter(c => !c.parent_id);
        const reordered = arrayMove(topLevel, oldIndex, newIndex);
        return reordered.map((c, i) => ({ ...c, display_order: i }));
      });
      handleReorder(reordered).catch(() => fetchCategories());
    },
    [topLevelCategories, handleReorder, fetchCategories]
  );

  if (editingCategory !== null) {
    return (
      <CategoryEditor
        key={`${editingCategory?.id ?? 'new'}-${editingCategory?.parent_id ?? ''}-${isSubcategory}`}
        category={editingCategory.id ? editingCategory : null}
        categories={categories}
        parentCategory={parentCategoryForSubcategory}
        isSubcategory={isSubcategory}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-dark-50">Category Management</h2>
          <p className="text-dark-300 mt-2">
            Manage product categories with subcategories and images
          </p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
        >
          + Add Category
        </Button>
      </div>

      {/* Content */}
      <Card className="bg-dark-800 border-dark-700">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin mb-4" />
            <p className="text-dark-400">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20">
            <FolderTree className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-400 mb-2">No categories yet</h3>
            <p className="text-dark-500 mb-6">Get started by creating your first product category</p>
            <Button 
              onClick={handleCreate}
              className="bg-primary-600 hover:bg-primary-500"
            >
              Create First Category
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200 w-0">Order</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Icon</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Name</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Slug</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Description</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Subcategories</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Status</th>
                    <th className="text-right px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  <SortableContext items={topLevelCategories.map(c => String(c.id))} strategy={verticalListSortingStrategy}>
                    {topLevelCategories.map((category, index) => (
                      <SortableCategoryRow
                        key={category.id}
                        category={category}
                        index={index}
                        isExpanded={expandedCategories.has(category.id)}
                        hasSubcategories={getSubcategoryCount(category) > 0}
                        onToggle={toggleExpanded}
                        getSubcategoryCount={getSubcategoryCount}
                        getCategoryName={getCategoryName}
                        handleEdit={handleEdit}
                        handleDelete={handleDelete}
                        handleCreateSubcategory={handleCreateSubcategory}
                        handleEditSubcategory={handleEdit}
                        handleDeleteSubcategory={handleDeleteSubcategory}
                        expandedCategories={expandedCategories}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CategoryManagement;