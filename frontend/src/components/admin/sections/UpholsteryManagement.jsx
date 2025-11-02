import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/ConfirmModal';
import { useToast } from '../../../contexts/ToastContext';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Armchair, X } from 'lucide-react';
import UpholsteryEditor from './UpholsteryEditor';

/**
 * Upholstery Management - Table Layout with Separate Editor
 */
const UpholsteryManagement = () => {
  const toast = useToast();
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUpholstery, setEditingUpholstery] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });

  const fetchUpholsteries = useCallback(async () => {
    try {
      const params = {};
      if (filterType) params.material_type = filterType;
      if (filterGrade) params.grade = filterGrade;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await apiClient.get('/api/v1/admin/upholsteries', { params });
      setUpholsteries(response?.items || []);
    } catch (error) {
      console.error('Failed to fetch upholsteries:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterGrade, filterActive]);

  useEffect(() => {
    fetchUpholsteries();
    fetchColors();
  }, [fetchUpholsteries]);

  const fetchColors = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/colors', { params: { is_active: true } });
      setColors(response || []);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
    }
  };

  const handleCreate = () => {
    setEditingUpholstery('new');
  };

  const handleEdit = (upholstery) => {
    setEditingUpholstery(upholstery);
  };

  const handleBack = () => {
    setEditingUpholstery(null);
  };

  const handleSave = () => {
    setEditingUpholstery(null);
    fetchUpholsteries();
  };

  const handleDelete = async (upholstery) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Upholstery',
      message: `Are you sure you want to delete "${upholstery.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/api/v1/admin/upholsteries/${upholstery.id}`);
          fetchUpholsteries();
          toast.success(`${upholstery.name} deleted successfully`);
        } catch (error) {
          console.error('Failed to delete upholstery:', error);
          toast.error(error.response?.data?.detail || 'Failed to delete upholstery');
        }
      }
    });
  };

  const getColorName = (colorId) => {
    const color = colors.find(c => c.id === colorId);
    return color?.name || 'N/A';
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterGrade('');
    setFilterActive('all');
  };

  // Show editor if editing/creating
  if (editingUpholstery) {
    return (
      <UpholsteryEditor
        upholstery={editingUpholstery === 'new' ? null : editingUpholstery}
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
          <h2 className="text-3xl font-bold text-dark-50">Upholstery Management</h2>
          <p className="text-dark-300 mt-1">
            Manage upholstery materials with grades and pricing
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
          + Add Upholstery
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
              <option value="Vinyl">Vinyl</option>
              <option value="Fabric">Fabric</option>
              <option value="Leather">Leather</option>
              <option value="Faux Leather">Faux Leather</option>
              <option value="Mesh">Mesh</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Grade
            </label>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Grades</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
              <option value="Premium">Premium</option>
              <option value="Luxury">Luxury</option>
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
          {(filterType || filterGrade || filterActive !== 'all') && (
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
        ) : upholsteries.length === 0 ? (
          <div className="text-center py-12">
            <Armchair className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300 mb-2">No Upholstery Options Found</h3>
            <p className="text-dark-400 mb-6">
              {filterType || filterGrade || filterActive !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first upholstery option to get started'}
            </p>
            {!filterType && !filterGrade && filterActive === 'all' && (
              <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
                Create First Upholstery
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Swatch
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
                    Grade
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-dark-300 uppercase tracking-wider">
                    Color
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
                {upholsteries.map((upholstery) => (
                  <tr key={upholstery.id} className="hover:bg-dark-750 transition-colors">
                    {/* Swatch */}
                    <td className="px-4 py-3">
                      {upholstery.swatch_image_url ? (
                        <img
                          src={resolveImageUrl(upholstery.swatch_image_url)}
                          alt={upholstery.name}
                          className="w-12 h-12 object-cover rounded border border-dark-600"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border border-dark-600 flex items-center justify-center bg-dark-700">
                          <Armchair className="w-6 h-6 text-dark-500" />
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-dark-50">{upholstery.name}</div>
                      {upholstery.description && (
                        <div className="text-sm text-dark-400 mt-0.5 max-w-xs truncate">
                          {upholstery.description}
                        </div>
                      )}
                      {upholstery.is_com && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
                          COM
                        </span>
                      )}
                    </td>

                    {/* Code */}
                    <td className="px-4 py-3">
                      {upholstery.material_code ? (
                        <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded font-mono">
                          {upholstery.material_code}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      {upholstery.material_type ? (
                        <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                          {upholstery.material_type}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>

                    {/* Grade */}
                    <td className="px-4 py-3">
                      {upholstery.grade ? (
                        <span className="px-2 py-1 bg-purple-900/30 text-purple-400 text-xs rounded font-semibold">
                          {upholstery.grade}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">—</span>
                      )}
                    </td>

                    {/* Color */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-dark-300">
                        {upholstery.color_id ? getColorName(upholstery.color_id) : '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        upholstery.is_active
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {upholstery.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(upholstery)}
                          className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                          title="Edit upholstery"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(upholstery)}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete upholstery"
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

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
        confirmButtonVariant="danger"
      />
    </div>
  );
};

export default UpholsteryManagement;
