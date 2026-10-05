import { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { Edit, Trash2, FileText, X, Plus } from 'lucide-react';
import CatalogEditor from './CatalogEditor';
import ReorderableTable from '../ReorderableTable';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import { CATALOG_TYPE_OPTIONS, formatCatalogType } from '../../../utils/catalogTypes';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { ACTIVE_ACTIONS, booleanAction, retiredBy } from '../bulk/bulkActions';
import PdfPreviewButton from '../../ui/PdfPreviewButton';

const BULK_ACTIONS = [
  { label: 'Move to type', options: CATALOG_TYPE_OPTIONS, toChanges: (v) => ({ catalog_type: v }) },
  ...ACTIVE_ACTIONS,
  booleanAction('Featured', 'is_featured', 'Featured', 'Not featured'),
];

/**
 * Catalog Management - Table Layout
 */
const CatalogManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
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
  }, [fetchCatalogs, refreshKeys.catalogs]);

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
    toast.success(editingCatalog === 'new' ? 'Catalog created' : 'Catalog updated');
    fetchCatalogs();
  };

  const handleDelete = async (catalogId) => {
    if (!confirm('Are you sure you want to delete this catalog?')) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/catalog/catalogs/${catalogId}`);
      toast.success('Catalog deleted');
      await fetchCatalogs();
    } catch (error) {
      console.error('Failed to delete catalog:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete catalog');
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterActive('all');
  };

  const sortedCatalogs = useMemo(
    () => [...(catalogs || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [catalogs]
  );
  const selection = useBulkSelection(sortedCatalogs);

  const handleReorder = useCallback(
    async (ordered) => {
      const order = ordered.map((item, index) => ({ id: item.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/catalog/catalogs/reorder', { order });
        toast.success('Display order updated');
        fetchCatalogs();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchCatalogs, toast]
  );

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
    <AdminPage>
      <AdminPageHeader
        eyebrow="Publishing"
        title="Virtual Catalogs"
        description="Manage virtual catalogs and downloadable guides."
        actions={
          <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-500">
            <Plus className="w-4 h-4 mr-2" />
            Add Catalog
          </Button>
        }
      />

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
              {CATALOG_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
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
          <ReorderableTable
            onRowClick={handleEdit}
            items={sortedCatalogs}
            setItems={(next) => setCatalogs(next.map((item, i) => ({ ...item, display_order: i })))}
            getItemId={(item) => item.id}
            onReorder={handleReorder}
            selection={selection}
            minWidth="800px"
            columns={[
              { key: 'title', label: 'Title', sortKey: 'title' },
              { key: 'type', label: 'Type', sortKey: 'catalog_type' },
              { key: 'fileType', label: 'File Type', sortKey: 'file_type' },
              { key: 'version', label: 'Version', sortKey: 'version' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(catalog) => (
              <>
                <td className="px-3 sm:px-4 py-3">
                  <div className="font-semibold text-sm sm:text-base text-dark-50">{catalog.title}</div>
                  {catalog.description && (
                    <div className="text-xs sm:text-sm text-dark-400 mt-0.5 max-w-xs truncate">
                      {catalog.description}
                    </div>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  {catalog.catalog_type ? (
                    <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs rounded">
                      {formatCatalogType(catalog.catalog_type)}
                    </span>
                  ) : (
                    <span className="text-dark-500 text-sm">—</span>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded uppercase">
                    {catalog.file_type || 'PDF'}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  {catalog.version ? (
                    <span className="text-xs sm:text-sm text-dark-300 font-mono">v{catalog.version}</span>
                  ) : (
                    <span className="text-dark-500 text-xs sm:text-sm">—</span>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    catalog.is_active
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    {catalog.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <PdfPreviewButton url={catalog.file_url} title={catalog.title} fileType={catalog.file_type || 'PDF'} />
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
              </>
            )}
          />
        )}
      </Card>

      <BulkActionBar
        selection={selection} permanentDelete={{ isRetired: retiredBy(sortedCatalogs) }}
        resource="catalogs"
        noun="catalog"
        actions={BULK_ACTIONS}
        onDone={fetchCatalogs}
      />
    </AdminPage>
  );
};

export default CatalogManagement;
