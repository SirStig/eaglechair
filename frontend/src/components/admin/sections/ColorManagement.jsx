import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit2, Trash2, Palette } from 'lucide-react';
import ColorEditor from './ColorEditor';

/**
 * Color Management Component
 * Table-based color list with separate editor component
 */
const ColorManagement = () => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingColor, setEditingColor] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => {
    fetchColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterActive]);

  const fetchColors = async () => {
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await apiClient.get('/api/v1/admin/colors', { params });
      setColors(response);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (color) => {
    setEditingColor(color);
  };

  const handleCreate = () => {
    setEditingColor({});
  };

  const handleBack = () => {
    setEditingColor(null);
  };

  const handleSave = () => {
    setEditingColor(null);
    fetchColors();
  };

  const handleDelete = async (colorId) => {
    if (!confirm('Are you sure you want to delete this color?')) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/colors/${colorId}`);
      fetchColors();
    } catch (error) {
      console.error('Failed to delete color:', error);
      alert(error.response?.data?.detail || 'Failed to delete color');
    }
  };

  // Show editor if editing/creating
  if (editingColor !== null) {
    return (
      <ColorEditor
        color={editingColor.id ? editingColor : null}
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
          <h2 className="text-3xl font-bold text-dark-50">Color Management</h2>
          <p className="text-dark-300 mt-2">
            Manage color options for finishes and upholstery
          </p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
        >
          + Add Color
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-dark-800 border-dark-700">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Categories</option>
              <option value="wood">Wood</option>
              <option value="metal">Metal</option>
              <option value="fabric">Fabric</option>
              <option value="paint">Paint</option>
              <option value="leather">Leather</option>
              <option value="vinyl">Vinyl</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="all">All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          <Button
            onClick={() => {
              setFilterCategory('');
              setFilterActive('all');
            }}
            className="bg-dark-600 hover:bg-dark-500 text-dark-200"
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Content */}
      <Card className="bg-dark-800 border-dark-700">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin mb-4" />
            <p className="text-dark-400">Loading colors...</p>
          </div>
        ) : colors.length === 0 ? (
          <div className="text-center py-20">
            <Palette className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-400 mb-2">No colors found</h3>
            <p className="text-dark-500 mb-6">
              {filterCategory || filterActive !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Get started by creating your first color'}
            </p>
            <Button 
              onClick={handleCreate}
              className="bg-primary-600 hover:bg-primary-500"
            >
              Create First Color
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Swatch</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Name</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Code</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Hex Value</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Category</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Status</th>
                  <th className="text-right px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-dark-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {colors.map((color) => (
                  <tr key={color.id} className="hover:bg-dark-750 transition-colors">
                    {/* Swatch */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2">
                        {color.image_url ? (
                          <img 
                            src={resolveImageUrl(color.image_url)} 
                            alt={color.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-lg border border-dark-600"
                          />
                        ) : color.hex_value ? (
                          <div 
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 border-dark-600"
                            style={{ backgroundColor: color.hex_value }}
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-dark-700 rounded-lg border border-dark-600 flex items-center justify-center">
                            <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-dark-500" />
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Name */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="font-medium text-xs sm:text-sm md:text-base text-dark-50">{color.name}</div>
                      <div className="text-[10px] sm:text-xs text-dark-400 mt-1">Order: {color.display_order}</div>
                    </td>
                    
                    {/* Code */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {color.color_code ? (
                        <code className="text-xs sm:text-sm text-dark-300 bg-dark-700 px-2 py-1 rounded">
                          {color.color_code}
                        </code>
                      ) : (
                        <span className="text-dark-500 text-xs sm:text-sm">—</span>
                      )}
                    </td>
                    
                    {/* Hex Value */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {color.hex_value ? (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <div 
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-dark-600 flex-shrink-0"
                            style={{ backgroundColor: color.hex_value }}
                          />
                          <code className="text-xs sm:text-sm text-dark-300 font-mono">
                            {color.hex_value}
                          </code>
                        </div>
                      ) : (
                        <span className="text-dark-500 text-xs sm:text-sm">—</span>
                      )}
                    </td>
                    
                    {/* Category */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {color.category ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-dark-700 border border-dark-600 text-dark-300 text-xs rounded-md font-medium capitalize">
                          {color.category}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-xs">Uncategorized</span>
                      )}
                    </td>
                    
                    {/* Status */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                        color.is_active
                          ? 'bg-green-900/30 border border-green-800 text-green-400'
                          : 'bg-red-900/30 border border-red-800 text-red-400'
                      }`}>
                        {color.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(color)}
                          className="p-2 text-primary-400 hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit color"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(color.id)}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete color"
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

export default ColorManagement;
