import { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/ConfirmModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Armchair, X, RotateCcw } from 'lucide-react';
import UpholsteryEditor from './UpholsteryEditor';
import ReorderableTable from '../ReorderableTable';
import StatusTabs from '../StatusTabs';
import PermanentDeleteModal from '../PermanentDeleteModal';

/**
 * Upholstery Management - Table Layout with Separate Editor
 */
const UpholsteryManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUpholstery, setEditingUpholstery] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [tab, setTab] = useState('active');
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  const [permDeleteTarget, setPermDeleteTarget] = useState(null);
  const [permDeleting, setPermDeleting] = useState(false);

  const handleTabChange = (newTab) => {
    setTab(newTab);
  };

  const fetchUpholsteries = useCallback(async () => {
    try {
      const params = { is_active: tab === 'active', page_size: 100 };
      if (filterType) params.material_type = filterType;
      if (filterGrade) params.grade = filterGrade;

      const response = await apiClient.get('/api/v1/admin/upholsteries', { params });
      setUpholsteries(response?.items || []);
    } catch (error) {
      console.error('Failed to fetch upholsteries:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterGrade, tab]);

  const fetchCounts = useCallback(async () => {
    try {
      const params = { page_size: 1 };
      if (filterType) params.material_type = filterType;
      if (filterGrade) params.grade = filterGrade;
      const [activeRes, archivedRes] = await Promise.all([
        apiClient.get('/api/v1/admin/upholsteries', { params: { ...params, is_active: true } }),
        apiClient.get('/api/v1/admin/upholsteries', { params: { ...params, is_active: false } }),
      ]);
      setActiveTotal(activeRes?.total ?? 0);
      setArchivedTotal(archivedRes?.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch upholstery counts:', error);
    }
  }, [filterType, filterGrade]);

  useEffect(() => {
    fetchUpholsteries();
    fetchColors();
    fetchCounts();
  }, [fetchUpholsteries, fetchCounts, refreshKeys.upholstery]);

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
    toast.success(editingUpholstery === 'new' ? 'Upholstery created' : 'Upholstery updated');
    fetchUpholsteries();
  };

  const handleDelete = async (upholstery) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Upholstery',
      message: `Move "${upholstery.name}" to Archived? It will be hidden from the active list but can be restored or permanently deleted later.`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/api/v1/admin/upholsteries/${upholstery.id}`);
          await fetchUpholsteries();
          await fetchCounts();
          toast.success(`${upholstery.name} archived`);
        } catch (error) {
          console.error('Failed to delete upholstery:', error);
          toast.error(error.response?.data?.detail || 'Failed to delete upholstery');
        }
      }
    });
  };

  const handleRestore = async (upholstery) => {
    try {
      await apiClient.put(`/api/v1/admin/upholsteries/${upholstery.id}`, { is_active: true });
      toast.success(`${upholstery.name} restored`);
      await fetchUpholsteries();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to restore upholstery:', error);
      toast.error(error.response?.data?.detail || 'Failed to restore upholstery');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      await apiClient.delete(`/api/v1/admin/upholsteries/${permDeleteTarget.id}?hard_delete=true`);
      toast.success('Upholstery permanently deleted');
      setPermDeleteTarget(null);
      await fetchUpholsteries();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to permanently delete upholstery:', error);
      toast.error(error.response?.data?.detail || 'Failed to permanently delete upholstery');
    } finally {
      setPermDeleting(false);
    }
  };

  const getColorName = (colorId) => {
    const color = colors.find(c => c.id === colorId);
    return color?.name || 'N/A';
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterGrade('');
  };

  const sortedUpholsteries = useMemo(
    () => [...(upholsteries || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [upholsteries]
  );

  const handleReorder = useCallback(
    async (ordered) => {
      const order = ordered.map((item, index) => ({ id: item.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/upholsteries/reorder', { order });
        toast.success('Display order updated');
        fetchUpholsteries();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchUpholsteries, toast]
  );

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

      <StatusTabs tab={tab} onChange={handleTabChange} activeCount={activeTotal} archivedCount={archivedTotal} />

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
          {(filterType || filterGrade) && (
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
              {filterType || filterGrade
                ? 'Try adjusting your filters'
                : tab === 'archived'
                ? 'Archived upholstery options will show up here'
                : 'Create your first upholstery option to get started'}
            </p>
            {!filterType && !filterGrade && tab === 'active' && (
              <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
                Create First Upholstery
              </Button>
            )}
          </div>
        ) : (
          <ReorderableTable
            items={sortedUpholsteries}
            setItems={(next) => setUpholsteries(next.map((item, i) => ({ ...item, display_order: i })))}
            getItemId={(item) => item.id}
            onReorder={handleReorder}
            disabled={tab === 'archived'}
            minWidth="1000px"
            columns={[
              { key: 'swatch', label: 'Swatch' },
              { key: 'name', label: 'Name', sortKey: 'name' },
              { key: 'code', label: 'Code', sortKey: 'material_code' },
              { key: 'type', label: 'Type', sortKey: 'material_type' },
              { key: 'grade', label: 'Grade', sortKey: 'grade' },
              { key: 'color', label: 'Color', sortKey: 'color_id' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(upholstery) => (
              <>
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
                <td className="px-4 py-3">
                  {upholstery.material_code ? (
                    <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded font-mono">
                      {upholstery.material_code}
                    </span>
                  ) : (
                    <span className="text-dark-500 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {upholstery.material_type ? (
                    <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                      {upholstery.material_type}
                    </span>
                  ) : (
                    <span className="text-dark-500 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {upholstery.grade ? (
                    <span className="px-2 py-1 bg-purple-900/30 text-purple-400 text-xs rounded font-semibold">
                      {upholstery.grade}
                    </span>
                  ) : (
                    <span className="text-dark-500 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-dark-300">
                    {upholstery.color_id ? getColorName(upholstery.color_id) : '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    upholstery.is_active
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    {upholstery.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(upholstery)}
                      className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                      title="Edit upholstery"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {tab === 'active' ? (
                      <button
                        onClick={() => handleDelete(upholstery)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Archive upholstery"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(upholstery)}
                          className="p-2 text-green-400 hover:bg-green-900/20 rounded transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPermDeleteTarget({ id: upholstery.id, name: upholstery.name })}
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

      <PermanentDeleteModal
        isOpen={!!permDeleteTarget}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        itemLabel="upholstery"
        itemName={permDeleteTarget?.name}
        isLoading={permDeleting}
      />
    </div>
  );
};

export default UpholsteryManagement;
