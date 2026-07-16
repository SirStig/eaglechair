import { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Layers, X, Plus, RotateCcw } from 'lucide-react';
import LaminateEditor from './LaminateEditor';
import ReorderableTable from '../ReorderableTable';
import StatusTabs from '../StatusTabs';
import PermanentDeleteModal from '../PermanentDeleteModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';

/**
 * Laminate Management - Table Layout
 */
const LaminateManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [laminates, setLaminates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLaminate, setEditingLaminate] = useState(null);
  const [filterBrand, setFilterBrand] = useState('');
  const [tab, setTab] = useState('active');
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [permDeleteTarget, setPermDeleteTarget] = useState(null);
  const [permDeleting, setPermDeleting] = useState(false);

  const handleTabChange = (newTab) => {
    setTab(newTab);
  };

  const fetchLaminates = useCallback(async () => {
    try {
      const params = { is_active: tab === 'active' };
      if (filterBrand) params.brand = filterBrand;

      const response = await apiClient.get('/api/v1/admin/catalog/laminates', { params });
      setLaminates(response || []);
    } catch (error) {
      console.error('Failed to fetch laminates:', error);
    } finally {
      setLoading(false);
    }
  }, [filterBrand, tab]);

  const fetchCounts = useCallback(async () => {
    try {
      const params = {};
      if (filterBrand) params.brand = filterBrand;
      const [activeRes, archivedRes] = await Promise.all([
        apiClient.get('/api/v1/admin/catalog/laminates', { params: { ...params, is_active: true } }),
        apiClient.get('/api/v1/admin/catalog/laminates', { params: { ...params, is_active: false } }),
      ]);
      setActiveTotal((activeRes || []).length);
      setArchivedTotal((archivedRes || []).length);
    } catch (error) {
      console.error('Failed to fetch laminate counts:', error);
    }
  }, [filterBrand]);

  useEffect(() => {
    fetchLaminates();
    fetchCounts();
  }, [fetchLaminates, fetchCounts, refreshKeys.laminates]);

  const handleCreate = () => {
    setEditingLaminate('new');
  };

  const handleEdit = (laminate) => {
    setEditingLaminate(laminate);
  };

  const handleBack = () => {
    setEditingLaminate(null);
  };

  const handleSave = () => {
    setEditingLaminate(null);
    toast.success(editingLaminate === 'new' ? 'Laminate created' : 'Laminate updated');
    fetchLaminates();
  };

  const handleDelete = async (laminateId) => {
    const laminate = laminates.find((l) => l.id === laminateId);
    if (!confirm(`Move "${laminate?.pattern_name}" to Archived? It will be hidden from the active list but can be restored or permanently deleted later.`)) return;

    try {
      await apiClient.delete(`/api/v1/admin/catalog/laminates/${laminateId}`);
      toast.success('Laminate archived');
      await fetchLaminates();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to delete laminate:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete laminate');
    }
  };

  const handleRestore = async (laminateId) => {
    try {
      await apiClient.put(`/api/v1/admin/catalog/laminates/${laminateId}`, { is_active: true });
      toast.success('Laminate restored');
      await fetchLaminates();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to restore laminate:', error);
      toast.error(error.response?.data?.detail || 'Failed to restore laminate');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      await apiClient.delete(`/api/v1/admin/catalog/laminates/${permDeleteTarget.id}?hard_delete=true`);
      toast.success('Laminate permanently deleted');
      setPermDeleteTarget(null);
      await fetchLaminates();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to permanently delete laminate:', error);
      toast.error(error.response?.data?.detail || 'Failed to permanently delete laminate');
    } finally {
      setPermDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterBrand('');
  };

  const uniqueBrands = [...new Set(laminates.map(l => l.brand).filter(Boolean))];
  const sortedLaminates = useMemo(
    () => [...(laminates || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [laminates]
  );

  const handleReorder = useCallback(
    async (ordered) => {
      const order = ordered.map((item, index) => ({ id: item.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/catalog/laminates/reorder', { order });
        toast.success('Display order updated');
        fetchLaminates();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchLaminates, toast]
  );

  // Show editor if editing/creating
  if (editingLaminate) {
    return (
      <LaminateEditor
        laminate={editingLaminate === 'new' ? null : editingLaminate}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-dark-50">Laminate Management</h2>
          <p className="text-dark-300 mt-1">
            Manage laminate brands and patterns
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
          <Plus className="w-4 h-4 mr-2" />
          Add Laminate
        </Button>
      </div>

      <StatusTabs tab={tab} onChange={handleTabChange} activeCount={activeTotal} archivedCount={archivedTotal} />

      <Card className="bg-dark-800 border-dark-700">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Brand
            </label>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Brands</option>
              {uniqueBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          {filterBrand && (
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
        ) : laminates.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300 mb-2">No Laminates Found</h3>
            <p className="text-dark-400 mb-6">
              {filterBrand
                ? 'Try adjusting your filters'
                : tab === 'archived'
                ? 'Archived laminates will show up here'
                : 'Create your first laminate to get started'}
            </p>
          </div>
        ) : (
          <ReorderableTable
            items={sortedLaminates}
            setItems={(next) => setLaminates(next.map((item, i) => ({ ...item, display_order: i })))}
            getItemId={(item) => item.id}
            onReorder={handleReorder}
            disabled={tab === 'archived'}
            minWidth="800px"
            columns={[
              { key: 'swatch', label: 'Swatch' },
              { key: 'brand', label: 'Brand', sortKey: 'brand' },
              { key: 'pattern', label: 'Pattern', sortKey: 'pattern_name' },
              { key: 'code', label: 'Code', sortKey: 'pattern_code' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(laminate) => (
              <>
                <td className="px-4 py-3">
                  {laminate.swatch_image_url ? (
                    <img
                      src={resolveImageUrl(laminate.swatch_image_url)}
                      alt={laminate.pattern_name}
                      className="w-12 h-12 object-cover rounded border border-dark-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded border border-dark-600 flex items-center justify-center bg-dark-700">
                      <Layers className="w-6 h-6 text-dark-500" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-dark-50">{laminate.brand}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-dark-50">{laminate.pattern_name}</div>
                  {laminate.description && (
                    <div className="text-sm text-dark-400 mt-0.5 max-w-xs truncate">
                      {laminate.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {laminate.pattern_code ? (
                    <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded font-mono">
                      {laminate.pattern_code}
                    </span>
                  ) : (
                    <span className="text-dark-500 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    laminate.is_active
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    {laminate.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(laminate)}
                      className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                      title="Edit laminate"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {tab === 'active' ? (
                      <button
                        onClick={() => handleDelete(laminate.id)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Archive laminate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(laminate.id)}
                          className="p-2 text-green-400 hover:bg-green-900/20 rounded transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPermDeleteTarget({ id: laminate.id, name: laminate.pattern_name })}
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
        itemLabel="laminate"
        itemName={permDeleteTarget?.name}
        isLoading={permDeleting}
      />
    </div>
  );
};

export default LaminateManagement;

