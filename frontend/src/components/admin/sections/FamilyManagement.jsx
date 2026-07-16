import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [selectedFamilies, setSelectedFamilies] = useState([]);
  const [permDeleteTarget, setPermDeleteTarget] = useState(null); // { id, name } | { bulk: [...ids] }
  const [permDeleting, setPermDeleting] = useState(false);
  const lastSelectedIndexRef = useRef(null);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
    setSelectedFamilies([]);
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
        setSelectedFamilies([]);
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

  useEffect(() => {
    lastSelectedIndexRef.current = null;
    setSelectedFamilies([]);
  }, [page]);

  const handleSelectFamily = useCallback((familyId, index, event) => {
    if (event?.shiftKey && lastSelectedIndexRef.current !== null) {
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      const rangeIds = paginatedFamilies.slice(start, end + 1).map(f => f.id);
      setSelectedFamilies(rangeIds);
      lastSelectedIndexRef.current = index;
    } else {
      lastSelectedIndexRef.current = index;
      setSelectedFamilies(prev =>
        prev.includes(familyId)
          ? prev.filter(id => id !== familyId)
          : [...prev, familyId]
      );
    }
  }, [paginatedFamilies]);

  const handleSelectAll = () => {
    if (selectedFamilies.length === paginatedFamilies.length) {
      setSelectedFamilies([]);
      lastSelectedIndexRef.current = null;
    } else {
      setSelectedFamilies(paginatedFamilies.map(f => f.id));
      lastSelectedIndexRef.current = 0;
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedFamilies.length === 0) {
      toast.warning('Please select families first');
      return;
    }
    if (action === 'delete' && !confirm(`Move ${selectedFamilies.length} families to Archived? They'll be hidden from the active list but can be restored or permanently deleted later.`)) return;
    setLoading(true);
    const ids = [...selectedFamilies];
    setSelectedFamilies([]);
    try {
      let successCount = 0;
      let failCount = 0;
      if (action === 'restore') {
        for (const id of ids) {
          try {
            await apiClient.put(`/api/v1/admin/catalog/families/${id}`, { is_active: true });
            successCount++;
          } catch { failCount++; }
        }
        if (successCount > 0) toast.success(`${successCount} famil${successCount !== 1 ? 'ies' : 'y'} restored`);
        if (failCount > 0) toast.error(`Failed to restore ${failCount}`);
      } else if (action === 'delete') {
        for (const id of ids) {
          try {
            await apiClient.delete(`/api/v1/admin/catalog/families/${id}`);
            successCount++;
          } catch { failCount++; }
        }
        if (successCount > 0) toast.success(`${successCount} famil${successCount !== 1 ? 'ies' : 'y'} archived`);
        if (failCount > 0) toast.error(`Failed to archive ${failCount}`);
      }
      await fetchFamilies();
      await fetchCounts();
    } catch (error) {
      toast.error('Bulk action failed');
      setSelectedFamilies(ids);
    } finally {
      setLoading(false);
    }
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Product Family Management</h2>
          <p className="text-dark-300 mt-1">
            Manage product families and collections
          </p>
        </div>
        <Button onClick={handleCreate}>
          + Add Family
        </Button>
      </div>

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

      {selectedFamilies.length > 0 && (
        <Card className="bg-primary-900/20 border-primary-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-dark-50 font-medium">
              {selectedFamilies.length} family/families selected
            </p>
            <div className="flex flex-wrap gap-2">
              {tab === 'active' ? (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('delete')} className="text-red-500 border-red-500/50 hover:bg-red-900/20">
                  Archive selected
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleBulkAction('restore')}>
                    Restore selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPermDeleteTarget({ bulk: [...selectedFamilies] })}
                    className="text-red-500 border-red-500/50 hover:bg-red-900/20"
                  >
                    Delete Permanently
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

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
            minWidth="900px"
            columns={[
              { key: 'select', label: <input type="checkbox" checked={paginatedFamilies.length > 0 && selectedFamilies.length === paginatedFamilies.length} onChange={handleSelectAll} className="rounded border-dark-600 bg-dark-700" />, sortKey: null },
              { key: 'image', label: 'Image' },
              { key: 'name', label: 'Family Name', sortKey: 'name' },
              { key: 'slug', label: 'Slug', sortKey: 'slug' },
              { key: 'category', label: 'Category', sortKey: 'category_id' },
              { key: 'status', label: 'Status', sortKey: 'is_active' },
              { key: 'actions', label: 'Actions' },
            ]}
            renderRow={(family, rowIndex) => (
              <>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  <input
                    type="checkbox"
                    checked={selectedFamilies.includes(family.id)}
                    readOnly
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleSelectFamily(family.id, rowIndex, e);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectFamily(family.id, rowIndex, e);
                    }}
                    className="rounded border-dark-600 bg-dark-700 cursor-pointer"
                  />
                </td>
                <td className="px-3 sm:px-4 py-3 sm:py-4">
                  {family.family_image ? (
                    <img
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
    </div>
  );
};

export default FamilyManagement;
