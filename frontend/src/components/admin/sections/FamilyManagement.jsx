import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import FamilyEditor from './FamilyEditor';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import ReorderableTable from '../ReorderableTable';
import PaginationBar from '../PaginationBar';
import StatusTabs from '../StatusTabs';
import PermanentDeleteModal from '../PermanentDeleteModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import ResponsiveImage from '../../ui/ResponsiveImage';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { booleanAction, idAction } from '../bulk/bulkActions';

/**
 * Product Family Management with Full CRUD
 */
const FamilyManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingFamily, setEditingFamily] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [tab, setTab] = useState('active');
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [permDeleteTarget, setPermDeleteTarget] = useState(null); // { id, name } | { bulk: [...ids] }
  const [permDeleting, setPermDeleting] = useState(false);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchFamilies();
      await fetchCounts();
      if (categories.length === 0) {
        await fetchCategories();
      }
    };
    loadData();
  }, [filterCategory, tab, refreshKeys.families]);

  const fetchFamilies = async () => {
    try {
      const params = { is_active: tab === 'active' };
      if (filterCategory) params.category_id = filterCategory;

      const response = await apiClient.get('/api/v1/admin/catalog/families', { params });
      setFamilies(response || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const params = {};
      if (filterCategory) params.category_id = filterCategory;
      const [activeRes, archivedRes] = await Promise.all([
        apiClient.get('/api/v1/admin/catalog/families', { params: { ...params, is_active: true } }),
        apiClient.get('/api/v1/admin/catalog/families', { params: { ...params, is_active: false } }),
      ]);
      setActiveTotal((activeRes || []).length);
      setArchivedTotal((archivedRes || []).length);
    } catch (error) {
      console.error('Failed to fetch family counts:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/api/v1/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreate = () => {
    setEditingFamily(null);
    setShowEditor(true);
  };

  const handleEdit = (family) => {
    setEditingFamily(family);
    setShowEditor(true);
  };

  const handleSave = () => {
    setShowEditor(false);
    setEditingFamily(null);
    toast.success(editingFamily ? 'Family updated' : 'Family created');
    fetchFamilies();
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingFamily(null);
  };

  const handleDelete = async (familyId) => {
    const family = families.find((f) => f.id === familyId);
    if (!confirm(`Move "${family?.name}" to Archived? It will be hidden from the active list but can be restored or permanently deleted later.`)) return;

    try {
      await apiClient.delete(`/api/v1/admin/catalog/families/${familyId}`);
      toast.success('Family archived');
      await fetchFamilies();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to delete family:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete family');
    }
  };

  const handleRestore = async (familyId) => {
    try {
      await apiClient.put(`/api/v1/admin/catalog/families/${familyId}`, { is_active: true });
      toast.success('Family restored');
      await fetchFamilies();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to restore family:', error);
      toast.error(error.response?.data?.detail || 'Failed to restore family');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      if (permDeleteTarget.bulk) {
        let successCount = 0;
        let failCount = 0;
        for (const id of permDeleteTarget.bulk) {
          try {
            await apiClient.delete(`/api/v1/admin/catalog/families/${id}?hard_delete=true`);
            successCount++;
          } catch {
            failCount++;
          }
        }
        if (successCount > 0) toast.success(`${successCount} famil${successCount !== 1 ? 'ies' : 'y'} permanently deleted`);
        if (failCount > 0) toast.error(`Failed to permanently delete ${failCount}`);
        selection.clear();
      } else {
        await apiClient.delete(`/api/v1/admin/catalog/families/${permDeleteTarget.id}?hard_delete=true`);
        toast.success('Family permanently deleted');
      }
      setPermDeleteTarget(null);
      await fetchFamilies();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to permanently delete family:', error);
      toast.error('Failed to permanently delete family');
    } finally {
      setPermDeleting(false);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  const sortedFamilies = useMemo(
    () => [...(families || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [families]
  );

  const totalFamilies = sortedFamilies.length;
  const totalPages = Math.max(1, Math.ceil(totalFamilies / pageSize));
  const paginatedFamilies = useMemo(
    () => sortedFamilies.slice((page - 1) * pageSize, page * pageSize),
    [sortedFamilies, page, pageSize]
  );

  const selection = useBulkSelection(paginatedFamilies);

  const bulkActions = useMemo(() => [
    tab === 'active'
      ? {
          label: 'Archive',
          tone: 'danger',
          // Same soft delete as the row action, which hides the family from the active list
          run: async (ids) => {
            const results = await Promise.allSettled(
              ids.map((id) => apiClient.delete(`/api/v1/admin/catalog/families/${id}`))
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed) throw new Error(`Failed to archive ${failed} of ${ids.length}`);
          },
        }
      : { label: 'Restore', changes: { is_active: true } },
    ...(tab === 'archived' ? [{ label: 'Delete permanently', tone: 'danger', onClick: (ids) => setPermDeleteTarget({ bulk: [...ids] }) }] : []),
    booleanAction('Featured', 'is_featured', 'Featured', 'Not featured'),
    idAction('Move to category', 'category_id', categories, { none: 'No category' }),
  ], [tab, categories]);

  const refreshAfterBulk = async () => {
    await fetchFamilies();
    await fetchCounts();
  };

  const handleReorder = useCallback(
    async (ordered) => {
      const start = (page - 1) * pageSize;
      const fullList = [...sortedFamilies];
      for (let i = 0; i < ordered.length; i++) fullList[start + i] = ordered[i];
      const order = fullList.map((item, index) => ({ id: item.id, display_order: index }));
      try {
        await apiClient.post('/api/v1/admin/catalog/families/reorder', { order });
        toast.success('Display order updated');
        fetchFamilies();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to update order');
        throw err;
      }
    },
    [fetchFamilies, toast, page, pageSize, sortedFamilies]
  );

  // Show editor if editing or creating
  if (showEditor) {
    return (
      <FamilyEditor
        family={editingFamily}
        categories={categories}
        onBack={handleCancel}
        onSave={handleSave}
      />
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Products"
        title="Product Families"
        description="Manage product families and collections"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCreate}>
              + Add Family
            </Button>
          </div>
        }
      />

      <StatusTabs tab={tab} onChange={handleTabChange} activeCount={activeTotal} archivedCount={archivedTotal} />

      {/* Filters */}
      <Card>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Family List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : families.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            <p className="text-lg mb-4">No families found</p>
            <Button onClick={handleCreate}>
              Create Your First Product Family
            </Button>
          </div>
        ) : (
          <>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={totalFamilies}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              position="top"
            />
            <ReorderableTable
              onRowClick={handleEdit}
              items={paginatedFamilies}
              setItems={(next) => {
                const start = (page - 1) * pageSize;
                const fullList = [...sortedFamilies];
                for (let i = 0; i < next.length; i++) fullList[start + i] = next[i];
                setFamilies(fullList.map((f, i) => ({ ...f, display_order: i })));
              }}
            getItemId={(item) => item.id}
            onReorder={handleReorder}
            disabled={tab === 'archived'}
            selection={selection}
            minWidth="900px"
            columns={[
              { key: 'image', label: 'Image' },
              { key: 'name', label: 'Family Name', sortKey: 'name' },
              { key: 'slug', label: 'Slug', sortKey: 'slug' },
              { key: 'category', label: 'Category', sortKey: 'category_id' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(family) => (
              <>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  {family.family_image ? (
                    <ResponsiveImage
                      sizes="64px"
                      fullResolution={false}
                      src={resolveImageUrl(family.family_image)}
                      alt={family.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 object-contain bg-dark-700 rounded-lg border border-dark-600"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-dark-600 rounded-lg flex items-center justify-center">
                      <span className="text-dark-400 text-[10px] sm:text-xs">No image</span>
                    </div>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-xs sm:text-sm md:text-base text-dark-50 truncate">{family.name}</p>
                      {family.description && (
                        <p className="text-[10px] sm:text-xs text-dark-400 line-clamp-1">
                          {family.description}
                        </p>
                      )}
                    </div>
                    {family.is_featured && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-yellow-900/30 text-yellow-400 text-[10px] sm:text-xs rounded whitespace-nowrap flex-shrink-0">
                        Featured
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  <span className="font-mono text-xs sm:text-sm text-dark-300">/{family.slug}</span>
                </td>
                <td className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-dark-200">
                  {getCategoryName(family.category_id)}
                </td>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${family.is_active
                      ? 'bg-green-900/30 text-green-500'
                      : 'bg-dark-600 text-dark-300'
                    }
                  `}>
                    {family.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(family)}
                      className="p-2 text-primary-400 hover:bg-primary-900/20 rounded-lg transition-colors"
                      title="Edit family"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {tab === 'active' ? (
                      <button
                        onClick={() => handleDelete(family.id)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Archive family"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(family.id)}
                          className="p-2 text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPermDeleteTarget({ id: family.id, name: family.name })}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
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
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={totalFamilies}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              position="bottom"
            />
          </>
        )}
      </Card>

      <BulkActionBar
        selection={selection}
        resource="families"
        noun="family"
        actions={bulkActions}
        onDone={refreshAfterBulk}
      />

      <PermanentDeleteModal
        isOpen={!!permDeleteTarget}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        itemLabel="family"
        itemName={permDeleteTarget?.bulk ? undefined : permDeleteTarget?.name}
        title={permDeleteTarget?.bulk ? `Permanently delete ${permDeleteTarget.bulk.length} families?` : undefined}
        message={permDeleteTarget?.bulk ? `${permDeleteTarget.bulk.length} families will be removed from the database immediately.` : undefined}
        isLoading={permDeleting}
      />
    </AdminPage>
  );
};

export default FamilyManagement;
