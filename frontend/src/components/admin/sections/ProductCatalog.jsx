import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Edit2, Trash2, RotateCcw, TrendingUp, MessageSquareQuote } from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import TableSortHead from '../TableSortHead';
import PaginationBar from '../PaginationBar';
import StatusTabs from '../StatusTabs';
import PermanentDeleteModal from '../PermanentDeleteModal';
import ResponsiveImage from '../../ui/ResponsiveImage';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { deletePermanently } from '../bulk/permanentDelete';
import { SelectAllCheckbox, SelectCell } from '../bulk/SelectCheckbox';
import { openOnRowClick } from '../bulk/rowClick';
import { ACTIVE_ACTIONS, retiredBy } from '../bulk/bulkActions';
import { productBulkActions } from './productBulkActions';
import PdfPreviewButton from '../../ui/PdfPreviewButton';
import DeleteGate from '../DeleteGate';

/**
 * Product Catalog Management
 * 
 * Comprehensive product list with:
 * - Search and filtering
 * - Pagination
 * - Quick actions
 * - Bulk operations
 */
const ProductCatalog = ({ onEdit }) => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tab, setTab] = useState('active');
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [supplierLinks, setSupplierLinks] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [permDeleteTarget, setPermDeleteTarget] = useState(null); // { id, name } | { bulk: [...ids] }
  const [permDeleting, setPermDeleting] = useState(false);
  const selection = useBulkSelection(products);
  const { clear: clearSelection } = selection;

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
    clearSelection();
  };

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (key === sortBy ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
    setPage(1);
  }, [sortBy]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSubcategories();
    fetchFamilies();
    apiClient
      .get('/api/v1/admin/material-sources')
      .then((r) => setSupplierLinks((r || []).filter((s) => s.is_active)))
      .catch(() => {});
    fetchCounts();
  }, [page, pageSize, search, categoryFilter, tab, sortBy, sortDir, refreshKeys.catalog]);

  useEffect(() => {
    clearSelection();
  }, [page, clearSelection]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/admin/products', {
        params: {
          page,
          page_size: pageSize,
          search: search || undefined,
          category_id: categoryFilter || undefined,
          is_active: tab === 'active',
          sort_by: sortBy || undefined,
          sort_dir: sortDir,
        }
      });
      setProducts(response.items || []);
      setTotalPages(response.pages || 1);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        apiClient.get('/api/v1/admin/products', { params: { page: 1, page_size: 1, search: search || undefined, category_id: categoryFilter || undefined, is_active: true } }),
        apiClient.get('/api/v1/admin/products', { params: { page: 1, page_size: 1, search: search || undefined, category_id: categoryFilter || undefined, is_active: false } }),
      ]);
      setActiveTotal(activeRes.total ?? 0);
      setArchivedTotal(archivedRes.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch product counts:', error);
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

  const fetchFamilies = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/families');
      setFamilies(Array.isArray(response) ? response : response?.items || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/subcategories');
      setSubcategories(response?.items || []);
    } catch (error) {
      console.error('Failed to fetch subcategories:', error);
    }
  };

  const handleDelete = async (productId) => {
    const product = products.find(p => p.id === productId);
    if (!confirm(`Move "${product?.name}" to Archived? It will be hidden from the active list but can be restored or permanently deleted later.`)) return;

    setLoading(true);
    try {
      await apiClient.delete(`/api/v1/admin/products/${productId}`);
      toast.success('Product archived');
      await fetchProducts();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (productId) => {
    try {
      await apiClient.patch(`/api/v1/admin/products/${productId}`, { is_active: true });
      toast.success('Product restored');
      await fetchProducts();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to restore product:', error);
      toast.error('Failed to restore product');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      // Same endpoint as the batch bar: skips products still on a quote and says so
      await deletePermanently(toast, 'products', permDeleteTarget.bulk || [permDeleteTarget.id], { noun: 'product' });
      if (permDeleteTarget.bulk) clearSelection();
      setPermDeleteTarget(null);
      await fetchProducts();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to permanently delete product:', error);
      toast.error(error.response?.data?.detail || 'Failed to permanently delete product');
    } finally {
      setPermDeleting(false);
    }
  };

  const paginationBar = (position) => (
    <PaginationBar
      page={page}
      totalPages={totalPages}
      total={total}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
      position={position}
    />
  );

  const reload = async () => {
    await fetchProducts();
    await fetchCounts();
  };

  // Archive = the per-row soft delete; there is no bulk-API equivalent
  const archiveSelected = async (ids) => {
    if (!confirm(`Move ${ids.length} products to Archived? They'll be hidden from the active list but can be restored or permanently deleted later.`)) {
      throw new Error('Cancelled');
    }
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/api/v1/admin/products/${id}`)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) throw new Error(`Failed to archive ${failed} of ${ids.length} products`);
  };

  const bulkActions = useMemo(() => (
    tab === 'active'
      ? [
          ...productBulkActions({ categories, subcategories, families, supplierLinks }),
          ...ACTIVE_ACTIONS,
          { label: 'Archive', run: archiveSelected, tone: 'danger' },
        ]
      : [{ label: 'Restore', changes: { is_active: true } }]
  ), [tab, categories, subcategories, families, supplierLinks]);

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Products"
        title="Product Catalog"
        description="Manage all products, variations, and inventory"
        actions={
          <Button
            onClick={() => onEdit({ _isNew: true })}
            className="flex items-center gap-2"
          >
            <span>➕</span>
            <span>Add Product</span>
          </Button>
        }
      />

      <StatusTabs tab={tab} onChange={handleTabChange} activeCount={activeTotal} archivedCount={archivedTotal} />

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Search Products
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, model..."
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 placeholder-dark-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setPage(1);
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-400 text-lg mb-4">No products found</p>
            <Button onClick={() => onEdit({ _isNew: true })}>
              Add Your First Product
            </Button>
          </div>
        ) : (
          <>
            {paginationBar('top')}
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-3 sm:px-4 py-3 text-left">
                    <SelectAllCheckbox selection={selection} label="Select all products on this page" />
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300">Image</th>
                  <TableSortHead label="Product" sortKey="name" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Model" sortKey="model_number" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Category" sortKey="category" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Price" sortKey="base_price" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Views" sortKey="view_count" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-center text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Quotes" sortKey="quote_count" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-center text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Status" sortKey="is_active" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-medium text-dark-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b border-dark-700 hover:bg-dark-700/50 transition-colors cursor-pointer ${selection.isSelected(product.id) ? 'bg-primary-900/10' : ''}`}
                    onClick={openOnRowClick(() => onEdit(product))}
                  >
                    <SelectCell
                      selection={selection}
                      id={product.id}
                      label={`Select ${product.name}`}
                      className="px-4 py-4"
                    />
                    <td className="px-4 py-4">
                      {product.primary_image_url ? (
                        <ResponsiveImage
                          sizes="64px"
                          fullResolution={false}
                          src={resolveImageUrl(product.primary_image_url)}
                          alt={product.name}
                          className="w-16 h-16 object-contain bg-dark-700 rounded-lg border border-dark-600"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-dark-600 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-dark-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-dark-50">{product.name}</p>
                      <p className="text-sm text-dark-400">
                        {product.short_description?.substring(0, 50)}...
                      </p>
                    </td>
                    <td className="px-4 py-4 text-dark-200">{product.model_number}</td>
                    <td className="px-4 py-4 text-dark-200">{product.category?.name || 'N/A'}</td>
                    <td className="px-4 py-4 text-dark-200">
                      ${(product.base_price / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-dark-200 font-medium">{product.view_count || 0}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-dark-200 font-medium">{product.quote_count || 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${product.is_active
                          ? 'bg-green-900/30 text-green-500'
                          : 'bg-dark-600 text-dark-300'
                        }
                      `}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4" data-no-select onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <PdfPreviewButton url={product.spec_sheet_url} title={`${product.name} spec sheet`} />
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 text-primary-500 hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {tab === 'active' ? (
                          <DeleteGate>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Archive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          </DeleteGate>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRestore(product.id)}
                              className="p-2 text-green-500 hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Restore"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <DeleteGate permanent>
                            <button
                              onClick={() => setPermDeleteTarget({ id: product.id, name: product.name })}
                              className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            </DeleteGate>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginationBar('bottom')}
          </>
        )}
      </Card>

      <BulkActionBar
        selection={selection} permanentDelete={{ isRetired: retiredBy(products) }}
        resource="products"
        noun="product"
        actions={bulkActions}
        onDone={reload}
      />

      <PermanentDeleteModal
        isOpen={!!permDeleteTarget}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        itemLabel="product"
        itemName={permDeleteTarget?.bulk ? undefined : permDeleteTarget?.name}
        title={permDeleteTarget?.bulk ? `Permanently delete ${permDeleteTarget.bulk.length} products?` : undefined}
        message={permDeleteTarget?.bulk ? `${permDeleteTarget.bulk.length} products will be removed from the database immediately, freeing their SKUs for reuse.` : undefined}
        isLoading={permDeleting}
      />
    </AdminPage>
  );
};

export default ProductCatalog;
