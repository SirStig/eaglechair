import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [permDeleteTarget, setPermDeleteTarget] = useState(null); // { id, name } | { bulk: [...ids] }
  const [permDeleting, setPermDeleting] = useState(false);
  const lastSelectedIndexRef = useRef(null);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
    setSelectedProducts([]);
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
    fetchCounts();
  }, [page, pageSize, search, categoryFilter, tab, sortBy, sortDir, refreshKeys.catalog]);

  useEffect(() => {
    lastSelectedIndexRef.current = null;
    setSelectedProducts([]);
  }, [page]);

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
      if (permDeleteTarget.bulk) {
        let successCount = 0;
        let failCount = 0;
        for (const id of permDeleteTarget.bulk) {
          try {
            await apiClient.delete(`/api/v1/admin/products/${id}?hard=true`);
            successCount++;
          } catch {
            failCount++;
          }
        }
        if (successCount > 0) toast.success(`${successCount} product${successCount !== 1 ? 's' : ''} permanently deleted`);
        if (failCount > 0) toast.error(`Failed to permanently delete ${failCount} product${failCount !== 1 ? 's' : ''}`);
        setSelectedProducts([]);
      } else {
        await apiClient.delete(`/api/v1/admin/products/${permDeleteTarget.id}?hard=true`);
        toast.success('Product permanently deleted');
      }
      setPermDeleteTarget(null);
      await fetchProducts();
      await fetchCounts();
    } catch (error) {
      console.error('Failed to permanently delete product:', error);
      toast.error('Failed to permanently delete product');
    } finally {
      setPermDeleting(false);
    }
  };

  const handleSelectProduct = useCallback((productId, index, event) => {
    if (event?.shiftKey && lastSelectedIndexRef.current !== null) {
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      const rangeIds = products.slice(start, end + 1).map(p => p.id);
      setSelectedProducts(rangeIds);
      lastSelectedIndexRef.current = index;
    } else {
      lastSelectedIndexRef.current = index;
      setSelectedProducts(prev =>
        prev.includes(productId)
          ? prev.filter(id => id !== productId)
          : [...prev, productId]
      );
    }
  }, [products]);

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
      lastSelectedIndexRef.current = null;
    } else {
      setSelectedProducts(products.map(p => p.id));
      lastSelectedIndexRef.current = 0;
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

  const handleBulkChangeCategory = async () => {
    if (selectedProducts.length === 0) {
      toast.warning('Please select products first');
      return;
    }
    if (!bulkCategoryId) {
      toast.warning('Please select a category');
      return;
    }
    setLoading(true);
    const ids = [...selectedProducts];
    setSelectedProducts([]);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const id of ids) {
        try {
          await apiClient.patch(`/api/v1/admin/products/${id}`, {
            category_id: Number(bulkCategoryId),
            subcategory_id: null
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) toast.success(`${successCount} product${successCount !== 1 ? 's' : ''} category updated`);
      if (failCount > 0) toast.error(`Failed to update ${failCount} product${failCount !== 1 ? 's' : ''}`);
      setBulkCategoryId('');
      await fetchProducts();
    } catch {
      toast.error('Bulk category update failed');
      setSelectedProducts(ids);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkChangeSubcategory = async () => {
    if (selectedProducts.length === 0) {
      toast.warning('Please select products first');
      return;
    }
    if (!bulkSubcategoryId) {
      toast.warning('Please select a subcategory');
      return;
    }
    const subcat = subcategories.find(s => s.id === Number(bulkSubcategoryId));
    if (!subcat?.category_id) {
      toast.error('Invalid subcategory');
      return;
    }
    setLoading(true);
    const ids = [...selectedProducts];
    setSelectedProducts([]);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const id of ids) {
        try {
          await apiClient.patch(`/api/v1/admin/products/${id}`, {
            category_id: subcat.category_id,
            subcategory_id: subcat.id
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) toast.success(`${successCount} product${successCount !== 1 ? 's' : ''} subcategory updated`);
      if (failCount > 0) toast.error(`Failed to update ${failCount} product${failCount !== 1 ? 's' : ''}`);
      setBulkSubcategoryId('');
      await fetchProducts();
    } catch {
      toast.error('Bulk subcategory update failed');
      setSelectedProducts(ids);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedProducts.length === 0) {
      toast.warning('Please select products first');
      return;
    }

    if (action === 'delete' && !confirm(`Move ${selectedProducts.length} products to Archived? They'll be hidden from the active list but can be restored or permanently deleted later.`)) {
      return;
    }

    setLoading(true);
    const ids = [...selectedProducts];
    setSelectedProducts([]);

    try {
      let successCount = 0;
      let failCount = 0;

      if (action === 'activate' || action === 'deactivate') {
        const isActive = action === 'activate';
        for (const id of ids) {
          try {
            await apiClient.patch(`/api/v1/admin/products/${id}`, { is_active: isActive });
            successCount++;
          } catch {
            failCount++;
          }
        }
        if (successCount > 0) {
          toast.success(`${successCount} product${successCount !== 1 ? 's' : ''} ${action === 'activate' ? 'activated' : 'deactivated'}`);
        }
        if (failCount > 0) {
          toast.error(`Failed to update ${failCount} product${failCount !== 1 ? 's' : ''}`);
        }
      } else if (action === 'delete') {
        for (const id of ids) {
          try {
            await apiClient.delete(`/api/v1/admin/products/${id}`);
            successCount++;
          } catch {
            failCount++;
          }
        }
        if (successCount > 0) {
          toast.success(`${successCount} product${successCount !== 1 ? 's' : ''} archived`);
        }
        if (failCount > 0) {
          toast.error(`Failed to archive ${failCount} product${failCount !== 1 ? 's' : ''}`);
        }
      } else if (action === 'restore') {
        for (const id of ids) {
          try {
            await apiClient.patch(`/api/v1/admin/products/${id}`, { is_active: true });
            successCount++;
          } catch {
            failCount++;
          }
        }
        if (successCount > 0) {
          toast.success(`${successCount} product${successCount !== 1 ? 's' : ''} restored`);
        }
        if (failCount > 0) {
          toast.error(`Failed to restore ${failCount} product${failCount !== 1 ? 's' : ''}`);
        }
      }

      await fetchProducts();
      await fetchCounts();
    } catch (error) {
      console.error('Bulk action failed:', error);
      toast.error('Bulk action failed. Please try again.');
      setSelectedProducts(ids);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-dark-50">Product Catalog</h2>
          <p className="text-dark-300 mt-1">
            Manage all products, variations, and inventory
          </p>
        </div>
        <Button
          onClick={() => onEdit({ _isNew: true })}
          className="flex items-center gap-2"
        >
          <span>➕</span>
          <span>Add Product</span>
        </Button>
      </div>

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

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <Card className="bg-primary-900/20 border-primary-500">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-dark-50 font-medium">
                {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={bulkCategoryId}
                    onChange={(e) => setBulkCategoryId(e.target.value)}
                    className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none min-w-[140px]"
                  >
                    <option value="">Change category...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={handleBulkChangeCategory} disabled={!bulkCategoryId}>
                    Apply
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkSubcategoryId}
                    onChange={(e) => setBulkSubcategoryId(e.target.value)}
                    className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none min-w-[140px]"
                  >
                    <option value="">Change subcategory...</option>
                    {subcategories.map(sc => (
                      <option key={sc.id} value={sc.id}>
                        {categories.find(c => c.id === sc.category_id)?.name ? `${categories.find(c => c.id === sc.category_id).name} › ` : ''}{sc.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={handleBulkChangeSubcategory} disabled={!bulkSubcategoryId}>
                    Apply
                  </Button>
                </div>
                <div className="w-px h-6 bg-dark-600 self-center" />
                {tab === 'active' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('activate')}>
                      Activate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                      Deactivate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('delete')}>
                      Archive selected
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('restore')}>
                      Restore selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPermDeleteTarget({ bulk: [...selectedProducts] })}
                      className="text-red-500 border-red-500/50 hover:bg-red-900/20"
                    >
                      Delete Permanently
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

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
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selectedProducts.length === products.length}
                      onChange={handleSelectAll}
                      className="rounded border-dark-600 bg-dark-700"
                    />
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
                {products.map((product, index) => (
                  <tr
                    key={product.id}
                    className={`border-b border-dark-700 hover:bg-dark-700/50 transition-colors cursor-pointer select-none ${selectedProducts.includes(product.id) ? 'bg-primary-900/10' : ''}`}
                    onClick={(e) => {
                      if (!e.target.closest('button') && !e.target.closest('[data-no-select]')) {
                        handleSelectProduct(product.id, index, e);
                      }
                    }}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        readOnly
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleSelectProduct(product.id, index, e);
                          }
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectProduct(product.id, index, e);
                        }}
                        className="rounded border-dark-600 bg-dark-700 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      {product.primary_image_url ? (
                        <img
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
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 text-primary-500 hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {tab === 'active' ? (
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Archive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRestore(product.id)}
                              className="p-2 text-green-500 hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Restore"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setPermDeleteTarget({ id: product.id, name: product.name })}
                              className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
    </div>
  );
};

export default ProductCatalog;
