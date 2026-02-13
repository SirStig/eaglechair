import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Palette, X } from 'lucide-react';
import FinishEditor from './FinishEditor';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';

/**
 * Finish Management - Table Layout with Separate Editor
 */
const FinishManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [finishes, setFinishes] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingFinish, setEditingFinish] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  const fetchFinishes = useCallback(async () => {
    try {
      const params = {};
      if (filterType) params.finish_type = filterType;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await apiClient.get('/api/v1/admin/catalog/finishes', { params });
      setFinishes(response || []);
    } catch (error) {
      console.error('Failed to fetch finishes:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterActive]);

  useEffect(() => {
    fetchFinishes();
    fetchColors();
  }, [fetchFinishes, refreshKeys.finishes]);

  const fetchColors = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/colors', { params: { is_active: true } });
      setColors(response || []);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
    }
  };

  const handleCreate = () => {
    setEditingFinish('new');
  };

  const handleEdit = (finish) => {
    setEditingFinish(finish);
  };

  const handleBack = () => {
    setEditingFinish(null);
  };

  const handleSave = () => {
    setEditingFinish(null);
    toast.success(editingFinish === 'new' ? 'Finish created' : 'Finish updated');
    fetchFinishes();
  };

  const handleDelete = async (finishId) => {
    if (!confirm('Are you sure you want to delete this finish?')) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/catalog/finishes/${finishId}`);
      toast.success('Finish deleted');
      await fetchFinishes();
    } catch (error) {
      console.error('Failed to delete finish:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete finish');
    }
  };

  const getColorName = (colorId) => {
    const color = colors.find(c => c.id === colorId);
    return color?.name || 'N/A';
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterActive('all');
  };

  // Show editor if editing/creating
  if (editingFinish) {
    return (
      <FinishEditor
        finish={editingFinish === 'new' ? null : editingFinish}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-dark-50">Finish Management</h2>
          <p className="text-dark-300 mt-1">
            Manage wood and metal finishes with colors and pricing
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
          + Add Finish
        </Button>
      </div>

      {/* Filters */}
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
              <option value="Wood Stain">Wood Stain</option>
              <option value="Paint">Paint</option>
              <option value="Metal">Metal</option>
              <option value="Powder Coat">Powder Coat</option>
              <option value="Lacquer">Lacquer</option>
              <option value="Veneer">Veneer</option>
              <option value="Chrome">Chrome</option>
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

      {/* Table */}
      <Card className="bg-dark-800 border-dark-700">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : finishes.length === 0 ? (
          <div className="text-center py-12">
            <Palette className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300 mb-2">No Finishes Found</h3>
            <p className="text-dark-400 mb-6">
              {filterType || filterActive !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first finish option to get started'}
            </p>
            {!filterType && filterActive === 'all' && (
              <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
                Create First Finish
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Sample
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {finishes.map((finish) => (
                  <tr key={finish.id} className="hover:bg-dark-750 transition-colors">
                    {/* Sample */}
                    <td className="px-3 sm:px-4 py-3">
                      {finish.image_url ? (
                        <img
                          src={resolveImageUrl(finish.image_url)}
                          alt={finish.name}
                          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded border border-dark-600"
                        />
                      ) : finish.color_hex ? (
                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded border-2 border-dark-600"
                          style={{ backgroundColor: finish.color_hex }}
                          title={finish.color_hex}
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded border border-dark-600 flex items-center justify-center bg-dark-700">
                          <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-dark-500" />
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-3 sm:px-4 py-3">
                      <div className="font-semibold text-xs sm:text-sm md:text-base text-dark-50">{finish.name}</div>
                      {finish.description && (
                        <div className="text-[10px] sm:text-xs text-dark-400 mt-0.5 max-w-xs truncate">
                          {finish.description}
                        </div>
                      )}
                    </td>

                    {/* Code */}
                    <td className="px-3 sm:px-4 py-3">
                      {finish.finish_code ? (
                        <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded font-mono">
                          {finish.finish_code}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-xs sm:text-sm">—</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-3 sm:px-4 py-3">
                      {finish.finish_type ? (
                        <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                          {finish.finish_type}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-xs sm:text-sm">—</span>
                      )}
                    </td>

                    {/* Color */}
                    <td className="px-3 sm:px-4 py-3">
                      <div className="text-xs sm:text-sm text-dark-300">
                        {finish.color_id ? getColorName(finish.color_id) : (
                          finish.color_hex ? (
                            <span className="font-mono text-[10px] sm:text-xs">{finish.color_hex}</span>
                          ) : '—'
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-3 sm:px-4 py-3">
                      <div className="text-xs sm:text-sm text-dark-300">
                        {finish.additional_cost > 0 ? (
                          <span className="font-semibold">+${(finish.additional_cost / 100).toFixed(2)}</span>
                        ) : (
                          <span className="text-dark-500">Standard</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 sm:px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        finish.is_active
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {finish.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 sm:px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(finish)}
                          className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                          title="Edit finish"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(finish.id)}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete finish"
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

export default FinishManagement;
