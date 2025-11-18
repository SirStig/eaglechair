import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import Card from '../ui/Card';
import EditModal from './EditModal';
import {
  getCategories,
  updateCategory,
  createCategory,
  deleteCategory
} from '../../services/contentService';
import logger from '../../utils/logger';

const CONTEXT = 'CategoriesManager';

/**
 * CategoriesManager Component
 * 
 * Admin component for managing product categories and subcategories
 * Supports full CRUD operations with a clean interface
 */
const CategoriesManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      logger.info(CONTEXT, 'Loading categories');
      const data = await getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error(CONTEXT, 'Failed to load categories', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (newData) => {
    try {
      logger.info(CONTEXT, 'Creating category');
      await createCategory(newData);
      loadCategories();
      setShowCreateModal(false);
      logger.info(CONTEXT, 'Category created successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create category', error);
      throw error;
    }
  };

  const handleUpdate = async (newData) => {
    try {
      logger.info(CONTEXT, `Updating category ${editingCategory.id}`);
      await updateCategory(editingCategory.id, newData);
      loadCategories();
      setEditingCategory(null);
      logger.info(CONTEXT, 'Category updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update category', error);
      throw error;
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the category "${name}"? This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        logger.info(CONTEXT, `Deleting category ${id}`);
        await deleteCategory(id);
        loadCategories();
        logger.info(CONTEXT, 'Category deleted successfully');
      } catch (error) {
        logger.error(CONTEXT, 'Failed to delete category', error);
        alert(`Failed to delete category: ${error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Categories Management</h2>
          <p className="text-dark-100 mt-1">
            Manage product categories and subcategories
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </Button>
      </div>

      {/* Categories List */}
      <div className="grid gap-4">
        {categories.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-dark-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="text-lg font-semibold text-dark-50 mb-2">No Categories</h3>
              <p className="text-dark-200 mb-4">Get started by creating your first category</p>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Create Category
              </Button>
            </div>
          </Card>
        ) : (
          categories.map((category) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-dark-50">
                        {category.name}
                      </h3>
                      {!category.is_active && (
                        <span className="px-2 py-1 bg-dark-700 text-dark-200 text-xs rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    
                    {category.description && (
                      <p className="text-dark-100 mb-3">{category.description}</p>
                    )}
                    
                    {category.slug && (
                      <p className="text-sm text-dark-200">
                        <span className="font-medium">Slug:</span> {category.slug}
                      </p>
                    )}
                    
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-dark-200 mb-2">
                          <span className="font-medium">Subcategories:</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {category.subcategories.map((subcat, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-dark-700 text-dark-100 text-xs rounded border border-dark-500"
                            >
                              {typeof subcat === 'string' ? subcat : subcat.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="p-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg transition-colors"
                      title="Edit Category"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(category.id, category.name)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Delete Category"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <EditModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          elementData={{
            name: '',
            slug: '',
            description: '',
            is_active: true,
            display_order: categories.length
          }}
          elementType="category"
          elementId="new"
        />
      )}

      {/* Edit Modal */}
      {editingCategory && (
        <EditModal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={handleUpdate}
          elementData={editingCategory}
          elementType="category"
          elementId={editingCategory.id}
        />
      )}
    </div>
  );
};

export default CategoriesManager;

