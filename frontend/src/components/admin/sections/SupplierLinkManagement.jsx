import { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { Edit, Trash2, Link2, X, Plus, RotateCcw, ExternalLink } from 'lucide-react';
import SupplierLinkEditor from './SupplierLinkEditor';
import { SUPPLIER_TYPE_OPTIONS, supplierTypeLabel } from './supplierLinkTypes';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { ACTIVE_ACTIONS, retiredBy } from '../bulk/bulkActions';
import { deletePermanently } from '../bulk/permanentDelete';
import ReorderableTable from '../ReorderableTable';
import StatusTabs from '../StatusTabs';
import PermanentDeleteModal from '../PermanentDeleteModal';
import { useToast } from '../../../contexts/ToastContext';

const BULK_ACTIONS = [
  ...ACTIVE_ACTIONS,
  { label: 'Set type', options: SUPPLIER_TYPE_OPTIONS, toChanges: (v) => ({ material_type: v }) },
];

const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Supplier Links - outside catalogs we order from on request (e.g. any
 * Wilsonart laminate) instead of keeping our own swatch list. Products opt in
 * from the product editor; the links show on product and materials pages.
 */
const SupplierLinkManagement = () => {
  const toast = useToast();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [tab, setTab] = useState('active');
  const [permDeleteTarget, setPermDeleteTarget] = useState(null);
  const [permDeleting, setPermDeleting] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/material-sources');
      setSources(response || []);
    } catch (error) {
      console.error('Failed to fetch supplier links:', error);
      toast.error(error.response?.data?.detail || 'Failed to load supplier links');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // The list endpoint returns everything; tabs and the type filter are client-side
  const byType = useMemo(
    () => sources.filter((s) => !filterType || s.material_type === filterType),
    [sources, filterType]
  );
  const activeTotal = byType.filter((s) => s.is_active).length;
  const archivedTotal = byType.length - activeTotal;
  const rows = useMemo(
    () => byType
      .filter((s) => (tab === 'active' ? s.is_active : !s.is_active))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [byType, tab]
  );
  const selection = useBulkSelection(rows);

  const handleSave = () => {
    toast.success(editing === 'new' ? 'Supplier link added' : 'Supplier link updated');
    setEditing(null);
    fetchSources();
  };

  const handleDeactivate = async (source) => {
    if (!confirm(`Move "${source.name}" to Archived? It will be hidden from the website but can be restored or permanently deleted later.`)) return;
    try {
      await apiClient.delete(`/api/v1/admin/material-sources/${source.id}`);
      toast.success('Supplier link archived');
      fetchSources();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to archive supplier link');
    }
  };

  const handleRestore = async (source) => {
    try {
      await apiClient.put(`/api/v1/admin/material-sources/${source.id}`, { is_active: true });
      toast.success('Supplier link restored');
      fetchSources();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to restore supplier link');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      await deletePermanently(toast, 'material-sources', [permDeleteTarget.id], { noun: 'supplier link' });
      setPermDeleteTarget(null);
      fetchSources();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to permanently delete supplier link');
    } finally {
      setPermDeleting(false);
    }
  };

  const handleReorder = useCallback(
    async (ordered) => {
      const order = ordered.map((item, index) => ({ id: item.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/material-sources/reorder', { order });
        toast.success('Display order updated');
        fetchSources();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchSources, toast]
  );

  if (editing) {
    return (
      <SupplierLinkEditor
        source={editing === 'new' ? null : editing}
        onBack={() => setEditing(null)}
        onSave={handleSave}
      />
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Materials & Options"
        title="Supplier Links"
        description="Outside catalogs we order from on request, like any Wilsonart laminate, instead of keeping our own swatch list. Tick them on products to show the links on the website."
        actions={
          <Button onClick={() => setEditing('new')} className="bg-primary-600 hover:bg-primary-500">
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier Link
          </Button>
        }
      />

      <StatusTabs tab={tab} onChange={setTab} activeCount={activeTotal} archivedCount={archivedTotal} />

      <Card className="bg-dark-800 border-dark-700">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2" htmlFor="supplier-type-filter">
              Filter by Type
            </label>
            <select
              id="supplier-type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Types</option>
              {SUPPLIER_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {filterType && (
            <div className="flex items-end">
              <Button onClick={() => setFilterType('')} className="bg-dark-600 hover:bg-dark-500 text-dark-200">
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
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Link2 className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-300 mb-2">No Supplier Links</h3>
            <p className="text-dark-400 mb-6">
              {filterType
                ? 'Try adjusting your filters'
                : tab === 'archived'
                ? 'Archived supplier links will show up here'
                : 'Add a supplier, like Wilsonart for laminates, to link customers to its catalog'}
            </p>
          </div>
        ) : (
          <ReorderableTable
            onRowClick={setEditing}
            items={rows}
            setItems={(next) => {
              const order = new Map(next.map((item, i) => [item.id, i]));
              setSources((prev) => prev.map((s) => (order.has(s.id) ? { ...s, display_order: order.get(s.id) } : s)));
            }}
            getItemId={(item) => item.id}
            onReorder={handleReorder}
            selection={selection}
            disabled={tab === 'archived'}
            minWidth="800px"
            columns={[
              { key: 'name', label: 'Name', sortKey: 'name' },
              { key: 'type', label: 'Type', sortKey: 'material_type' },
              { key: 'link', label: 'Link', sortKey: 'url' },
              { key: 'note', label: 'Note' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(source) => (
              <>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {source.logo_url ? (
                      <img
                        src={resolveImageUrl(source.logo_url)}
                        alt=""
                        className="h-9 w-16 shrink-0 rounded border border-dark-600 bg-white object-contain p-0.5"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-dark-600 bg-dark-700">
                        <Link2 className="h-4 w-4 text-dark-500" />
                      </div>
                    )}
                    <span className="font-semibold text-dark-50">{source.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                    {supplierTypeLabel(source.material_type)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[14rem] items-center gap-1 truncate text-sm text-primary-400 hover:text-primary-300"
                    title={source.url}
                  >
                    <span className="truncate">{hostOf(source.url)}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  {source.description ? (
                    <div className="max-w-xs truncate text-sm text-dark-300" title={source.description}>
                      {source.description}
                    </div>
                  ) : (
                    <span className="text-dark-500 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    source.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                  }`}>
                    {source.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(source)}
                      className="p-2 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                      title="Edit supplier link"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {tab === 'active' ? (
                      <button
                        onClick={() => handleDeactivate(source)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Archive supplier link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(source)}
                          className="p-2 text-green-400 hover:bg-green-900/20 rounded transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPermDeleteTarget({ id: source.id, name: source.name })}
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
        itemLabel="supplier link"
        itemName={permDeleteTarget?.name}
        isLoading={permDeleting}
      />

      <BulkActionBar
        selection={selection}
        permanentDelete={{ isRetired: retiredBy(rows) }}
        resource="material-sources"
        noun="supplier link"
        actions={BULK_ACTIONS}
        onDone={fetchSources}
      />
    </AdminPage>
  );
};

export default SupplierLinkManagement;
