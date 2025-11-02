import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Wrench, X, Plus } from 'lucide-react';
import HardwareEditor from './HardwareEditor';

/**
 * Hardware Management - Table Layout
 */
const HardwareManagement = () => {
  const [hardware, setHardware] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingHardware, setEditingHardware] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  const fetchHardware = useCallback(async () => {
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await apiClient.get('/api/v1/admin/catalog/hardware', { params });
      setHardware(response || []);
    } catch (error) {
      console.error('Failed to fetch hardware:', error);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterActive]);

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  const handleCreate = () => {
    setEditingHardware('new');
  };

  const handleEdit = (item) => {
    setEditingHardware(item);
  };

  const handleBack = () => {
    setEditingHardware(null);
  };

  const handleSave = () => {
    setEditingHardware(null);
    fetchHardware();
  };

  const handleDelete = async (hardwareId) => {
    if (!confirm('Are you sure you want to delete this hardware item?')) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/catalog/hardware/${hardwareId}`);
      fetchHardware();
    } catch (error) {
      console.error('Failed to delete hardware:', error);
      alert(error.response?.data?.detail || 'Failed to delete hardware');
    }
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterActive('all');
  };

  const uniqueCategories = [...new Set(hardware.map(h => h.category).filter(Boolean))];

  // Show editor if editing/creating
  if (editingHardware) {
    return (
      <HardwareEditor
        hardware={editingHardware === 'new' ? null : editingHardware}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-dark-50">Hardware Management</h2>
          <p className="text-dark-300 mt-1">
            Manage hardware components and specifications
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
          <Plus className="w-4 h-4 mr-2" />
          Add Hardware
        </Button>
      </div>

      <Card className="bg-dark-800 border-dark-700">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
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
          {(filterCategory || filterActive !== 'all') && (
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
        ) : hardware.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300 mb-2">No Hardware Found</h3>
            <p className="text-dark-400 mb-6">
              {filterCategory || filterActive !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first hardware item to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">Image</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">Name</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">Category</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">Model</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {hardware.map((item) => (
                  <tr key={item.id} className="hover:bg-dark-750 transition-colors">
                    <td className="px-4 py-3">
                      {item.image_url ? (
                        <img
                          src={resolveImageUrl(item.image_url)}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded border border-dark-600"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border border-dark-600 flex items-center justify-center bg-dark-700">
                          <Wrench className="w-6 h-6 text-dark-500" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-dark-50">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-dark-400 mt-0.5 max-w-xs truncate">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.category ? (
                        <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.model_number ? (
                        <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded font-mono">
                          {item.model_number}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        item.is_active
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                          title="Edit hardware"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete hardware"
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

export default HardwareManagement;

