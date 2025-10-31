import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { Edit, Trash2, FileText, X, Plus } from 'lucide-react';
import CatalogEditor from './CatalogEditor';

/**
 * Catalog Management - Table Layout
 */
const CatalogManagement = () => {
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCatalog, setEditingCatalog] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  const fetchCatalogs = useCallback(async () => {
    try {
      const params = {};
      if (filterType) params.catalog_type = filterType;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await apiClient.get('/api/v1/admin/catalog/catalogs', { params });
      setCatalogs(response || []);
    } catch (error) {
      console.error('Failed to fetch catalogs:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterActive]);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  const handleCreate = () => {
    setEditingCatalog('new');
  };

  const handleEdit = (catalog) => {
    setEditingCatalog(catalog);
  };

  const handleBack = () => {
    setEditingCatalog(null);
  };

  const handleSave = () => {
    setEditingCatalog(null);
    fetchCatalogs();
  };

  const handleDelete = async (catalogId) => {
    if (!confirm('Are you sure you want to delete this catalog?')) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/catalog/catalogs/${catalogId}`);
      fetchCatalogs();
    } catch (error) {
      console.error('Failed to delete catalog:', error);
      alert(error.response?.data?.detail || 'Failed to delete catalog');
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterActive('all');
  };

  // Show editor if editing/creating
  if (editingCatalog) {
    return (
      <CatalogEditor
        catalog={editingCatalog === 'new' ? null : editingCatalog}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-dark-50">Catalog Management</h2>
          <p className="text-dark-300 mt-1">
            Manage virtual catalogs and downloadable guides
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
          <Plus className="w-4 h-4 mr-2" />
          Add Catalog
        </Button>
      </div>

      <Card className="bg-dark-800 border-dark-700">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Types</option>
              <option value="product_catalog">Product Catalog</option>
              <option value="line_sheet">Line Sheet</option>
              <option value="installation_guide">Installation Guide</option>
              <option value="care_guide">Care Guide</option>
              <option value="specification_sheet">Specification Sheet</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          {(filterType || filterActive !== 'all') && (
            <div className="flex items-end">
              <Button
                onClick={clearFilters}
                className="bg-dark-600 hover:bg-dark-500 text-dark-200"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-dark-800 border-dark-700">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : catalogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300 mb-2">No Catalogs Found</h3>
            <p className="text-dark-400 mb-6">
              {filterType || filterActive !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first catalog to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-300 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-300 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-300 uppercase tracking-wider">File Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-300 uppercase tracking-wider">Version</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-dark-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {catalogs.map((catalog) => (
                  <tr key={catalog.id} className="hover:bg-dark-750 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-dark-50">{catalog.title}</div>
                      {catalog.description && (
                        <div className="text-sm text-dark-400 mt-0.5 max-w-xs truncate">
                          {catalog.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {catalog.catalog_type ? (
                        <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                          {catalog.catalog_type}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded uppercase">
                        {catalog.file_type || 'PDF'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {catalog.version ? (
                        <span className="text-sm text-dark-300 font-mono">v{catalog.version}</span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        catalog.is_active
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {catalog.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(catalog)}
                          className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                          title="Edit catalog"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(catalog.id)}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete catalog"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CatalogManagement;

