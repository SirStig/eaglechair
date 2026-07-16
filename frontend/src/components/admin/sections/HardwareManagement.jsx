import { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Wrench, X, Plus, RotateCcw } from 'lucide-react';
import HardwareEditor from './HardwareEditor';
import ReorderableTable from '../ReorderableTable';
import StatusTabs from '../StatusTabs';
import PermanentDeleteModal from '../PermanentDeleteModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';

/**
 * Hardware Management - Table Layout
 */
const HardwareManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [hardware, setHardware] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingHardware, setEditingHardware] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [tab, setTab] = useState('active');
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [permDeleteTarget, setPermDeleteTarget] = useState(null);
  const [permDeleting, setPermDeleting] = useState(false);

  const handleTabChange = (newTab) => {
    setTab(newTab);
  };

  const fetchHardware = useCallback(async () => {
    try {
      const params = { is_active: tab === 'active' };
      if (filterCategory) params.category = filterCategory;

      const response = await apiClient.get('/api/v1/admin/catalog/hardware', { params });
      setHardware(response || []);
    } catch (error) {
      console.error('Failed to fetch hardware:', error);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, tab]);

  const fetchCounts = useCallback(async () => {
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      const [activeRes, archivedRes] = await Promise.all([
        apiClient.get('/api/v1/admin/catalog/hardware', { params: { ...params, is_active: true } }),
        apiClient.get('/api/v1/admin/catalog/hardware', { params: { ...params, is_active: false } }),
      ]);
      setActiveTotal((activeRes || []).length);
      setArchivedTotal((archivedRes || []).length);
    } catch (error) {
      console.error('Failed to fetch hardware counts:', error);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchHardware();
    fetchCounts();
  }, [fetchHardware, fetchCounts, refreshKeys.hardware]);

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
    toast.success(editingHardware === 'new' ? 'Hardware created' : 'Hardware updated');
    fetchHardware();
  };

  const handleDelete = async (hardwareId) => {
    const item = hardware.find((h) => h.id === hardwareId);
    if (!confirm(`Move "${item?.name}" to Archived? It will be hidden from the active list but can be restored or permanently deleted later.`)) return;

    try {
      await apiClient.delete(`/api/v1/admin/catalog/hardware/${hardwareId}`);
      toast.success('Hardware archived');
      await fetchHardware();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to delete hardware:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete hardware');
    }
  };

  const handleRestore = async (hardwareId) => {
    try {
      await apiClient.put(`/api/v1/admin/catalog/hardware/${hardwareId}`, { is_active: true });
      toast.success('Hardware restored');
      await fetchHardware();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to restore hardware:', error);
      toast.error(error.response?.data?.detail || 'Failed to restore hardware');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      await apiClient.delete(`/api/v1/admin/catalog/hardware/${permDeleteTarget.id}?hard_delete=true`);
      toast.success('Hardware permanently deleted');
      setPermDeleteTarget(null);
      await fetchHardware();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to permanently delete hardware:', error);
      toast.error(error.response?.data?.detail || 'Failed to permanently delete hardware');
    } finally {
      setPermDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterCategory('');
  };

  const uniqueCategories = [...new Set(hardware.map(h => h.category).filter(Boolean))];
  const sortedHardware = useMemo(
    () => [...(hardware || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [hardware]
  );

  const handleReorder = useCallback(
    async (ordered) => {
      const order = ordered.map((item, index) => ({ id: item.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/catalog/hardware/reorder', { order });
        toast.success('Display order updated');
        fetchHardware();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchHardware, toast]
  );

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

      <StatusTabs tab={tab} onChange={handleTabChange} activeCount={activeTotal} archivedCount={archivedTotal} />

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
          {filterCategory && (
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
              {filterCategory
                ? 'Try adjusting your filters'
                : tab === 'archived'
                ? 'Archived hardware will show up here'
                : 'Create your first hardware item to get started'}
            </p>
          </div>
        ) : (
          <ReorderableTable
            items={sortedHardware}
            setItems={(next) => setHardware(next.map((item, i) => ({ ...item, display_order: i })))}
            getItemId={(item) => item.id}
            onReorder={handleReorder}
            disabled={tab === 'archived'}
            minWidth="800px"
            columns={[
              { key: 'image', label: 'Image' },
              { key: 'name', label: 'Name', sortKey: 'name' },
              { key: 'category', label: 'Category', sortKey: 'category' },
              { key: 'model', label: 'Model', sortKey: 'model_number' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(item) => (
              <>
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
                    {tab === 'active' ? (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Archive hardware"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(item.id)}
                          className="p-2 text-green-400 hover:bg-green-900/20 rounded transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPermDeleteTarget({ id: item.id, name: item.name })}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </>
            )}
          />
        )}
      </Card>

      <PermanentDeleteModal
        isOpen={!!permDeleteTarget}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        itemLabel="hardware item"
        itemName={permDeleteTarget?.name}
        isLoading={permDeleting}
      />
    </div>
  );
};

export default HardwareManagement;

