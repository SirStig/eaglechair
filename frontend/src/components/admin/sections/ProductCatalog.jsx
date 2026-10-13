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
import RowLink from '../bulk/RowLink';
import { ACTIVE_ACTIONS, retiredBy } from '../bulk/bulkActions';
import useMaterialLists from '../../../hooks/useMaterialLists';
import { productBulkActions } from './productBulkActions';
import PdfPreviewButton from '../../ui/PdfPreviewButton';
import DeleteGate from '../DeleteGate';
import { useUrlState } from '../../../hooks/useUrlState';
import useProductTaxonomy from '../../../hooks/useProductTaxonomy';
import ProductTaxonomyFilters from './ProductTaxonomyFilters';

/**
 * Product Catalog Management
 * 
 * Comprehensive product list with:
 * - Search and filtering (category incl. nested, subcategory, family)
 * - Pagination
 * - Quick actions
 * - Bulk operations
 */
const editorHref = (product) => `/admin/catalog?edit=${product.id}`;
// Filter value -> API param ('none' is sent as 0 = "has none")
const idParam = (value) => (value === 'none' ? 0 : value || undefined);

const ProductCatalog = ({ onEdit }) => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useUrlState('q', '');
  const [categoryFilter, setCategoryFilter] = useUrlState('category', '');
  const [subcategoryFilter, setSubcategoryFilter] = useUrlState('subcategory', '');
  const [familyFilter, setFamilyFilter] = useUrlState('family', '');
  const [tab, setTab] = useUrlState('tab', 'active');
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [page, setPage] = useUrlState('page', 1);
  const [pageSize, setPageSize] = useUrlState('size', 100);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const taxonomy = useProductTaxonomy();
  const { categories, subcategories } = taxonomy;
  const [families, setFamilies] = useState([]);
  const [supplierLinks, setSupplierLinks] = useState([]);
  const [sortBy, setSortBy] = useUrlState('sort', 'name');
  const [sortDir, setSortDir] = useUrlState('dir', 'asc');
  const [permDeleteTarget, setPermDeleteTarget] = useState(null); // { id, name } | { bulk: [...ids] }
  const [permDeleting, setPermDeleting] = useState(false);
  const pageSelection = useBulkSelection(products);
  const { clear: clearPageSelection } = pageSelection;
  // Every product matching the filters (all pages), once "Select all N matching" is clicked
  const [matchingIds, setMatchingIds] = useState(null);
  const [selectingMatching, setSelectingMatching] = useState(false);
  const clearSelection = useCallback(() => {
    setMatchingIds(null);
    clearPageSelection();
  }, [clearPageSelection]);
  // The batch bar acts on the matching set when there is one
  const selection = useMemo(
    () => (matchingIds
      ? { ...pageSelection, selectedIds: matchingIds, count: matchingIds.length, clear: clearSelection }
      : pageSelection),
    [pageSelection, matchingIds, clearSelection]
  );
  const materials = useMaterialLists(selection.count > 0);

  const filterParams = {
    search: search || undefined,
    category_id: categoryFilter || undefined,
    subcategory_id: idParam(subcategoryFilter),
    family_id: idParam(familyFilter),
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
    clearSelection();
  };

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (key === sortBy ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
    setPage(1);
  }, [sortBy, setSortBy, setSortDir, setPage]);

  useEffect(() => {
    fetchProducts();
    fetchFamilies();
    apiClient
      .get('/api/v1/admin/material-sources')
      .then((r) => setSupplierLinks((r || []).filter((s) => s.is_active)))
      .catch(() => {});
    fetchCounts();
  }, [page, pageSize, search, categoryFilter, subcategoryFilter, familyFilter, tab, sortBy, sortDir, refreshKeys.catalog]);

  useEffect(() => {
    clearSelection();
  }, [page, search, categoryFilter, subcategoryFilter, familyFilter, tab, clearSelection]);

  // Unticking a row on the page drops back to a page selection
  useEffect(() => {
    if (matchingIds && !pageSelection.allSelected) setMatchingIds(null);
  }, [matchingIds, pageSelection.allSelected]);

  const selectAllMatching = async () => {
    setSelectingMatching(true);
    try {
      const response = await apiClient.get('/api/v1/admin/products/ids', {
        params: { ...filterParams, is_active: tab === 'active' },
      });
      setMatchingIds(response.ids || []);
    } catch (error) {
      console.error('Failed to select matching products:', error);
      toast.error('Failed to select all matching products');
    } finally {
      setSelectingMatching(false);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/admin/products', {
        params: {
          page,
          page_size: pageSize,
          ...filterParams,
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
        apiClient.get('/api/v1/admin/products', { params: { page: 1, page_size: 1, ...filterParams, is_active: true } }),
        apiClient.get('/api/v1/admin/products', { params: { page: 1, page_size: 1, ...filterParams, is_active: false } }),
      ]);
      setActiveTotal(activeRes.total ?? 0);
      setArchivedTotal(archivedRes.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch product counts:', error);
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

  // Each cell carries its own link to the editor (the cell is the positioning
  // box), so right-click / Cmd-click works across the whole row in any browser.
  // Plain left-click still goes through onEdit.
  const rowCellLink = (product) => (
    <RowLink
      to={editorHref(product)}
      onOpen={() => onEdit(product)}
      className="absolute inset-0"
      tabIndex={-1}
      aria-hidden="true"
    />
  );

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
          ...productBulkActions({ categories, subcategories, families, supplierLinks, materials }),
          ...ACTIVE_ACTIONS,
          { label: 'Archive', run: archiveSelected, tone: 'danger' },
        ]
      : [{ label: 'Restore', changes: { is_active: true } }]
  ), [tab, categories, subcategories, families, supplierLinks, materials]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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

          <ProductTaxonomyFilters
            labelled
            taxonomy={taxonomy}
            families={families}
            category={categoryFilter}
            subcategory={subcategoryFilter}
            family={familyFilter}
            onChange={(next) => {
              if ('category' in next) setCategoryFilter(next.category);
              if ('subcategory' in next) setSubcategoryFilter(next.subcategory);
              if ('family' in next) setFamilyFilter(next.family);
              setPage(1);
            }}
            selectClassName="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setSubcategoryFilter('');
                setFamilyFilter('');
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
            {pageSelection.allSelected && total > products.length && (
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-primary-500/30 bg-primary-900/10 px-4 py-2 text-sm text-dark-100">
                {matchingIds ? (
                  <>
                    <span>All <strong>{matchingIds.length}</strong> matching products are selected.</span>
                    <button type="button" onClick={clearSelection} className="font-medium text-primary-400 hover:underline">
                      Clear selection
                    </button>
                  </>
                ) : (
                  <>
                    <span>All {products.length} products on this page are selected.</span>
                    <button
                      type="button"
                      onClick={selectAllMatching}
                      disabled={selectingMatching}
                      className="font-medium text-primary-400 hover:underline disabled:opacity-60"
                    >
                      {selectingMatching ? 'Selecting…' : `Select all ${total} matching products`}
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-3 sm:px-4 py-3 text-left">
                    <SelectAllCheckbox selection={pageSelection} label="Select all products on this page" />
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
                    className={`border-b border-dark-700 hover:bg-dark-700/50 transition-colors cursor-pointer ${pageSelection.isSelected(product.id) ? 'bg-primary-900/10' : ''}`}
                  >
                    <SelectCell
                      selection={pageSelection}
                      id={product.id}
                      label={`Select ${product.name}`}
                      className="px-4 py-4 relative z-10"
                    />
                    <td className="relative px-4 py-4">
                      {rowCellLink(product)}
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
                    <td className="relative px-4 py-4">
                      {rowCellLink(product)}
                      <p className="font-medium text-dark-50">{product.name}</p>
                      <p className="text-sm text-dark-400">
                        {product.short_description?.substring(0, 50)}...
                      </p>
                    </td>
                    <td className="relative px-4 py-4 text-dark-200">{rowCellLink(product)}{product.model_number}</td>
                    <td className="relative px-4 py-4 text-dark-200">{rowCellLink(product)}{product.category?.name || 'N/A'}</td>
                    <td className="relative px-4 py-4 text-dark-200">
                      {rowCellLink(product)}
                      ${(product.base_price / 100).toFixed(2)}
                    </td>
                    <td className="relative px-4 py-4 text-center">
                      {rowCellLink(product)}
                      <span className="text-dark-200 font-medium">{product.view_count || 0}</span>
                    </td>
                    <td className="relative px-4 py-4 text-center">
                      {rowCellLink(product)}
                      <span className="text-dark-200 font-medium">{product.quote_count || 0}</span>
                    </td>
                    <td className="relative px-4 py-4">
                      {rowCellLink(product)}
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
                    <td className="px-4 py-4 relative z-10" data-no-select onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <PdfPreviewButton url={product.spec_sheet_url} title={`${product.name} spec sheet`} />
                        <RowLink
                          to={editorHref(product)}
                          onOpen={() => onEdit(product)}
                          className="p-2 text-primary-500 hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </RowLink>
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
        selection={selection}
        // Off-page rows of a "select all matching" aren't loaded; the tab says whether they're archived
        permanentDelete={{ isRetired: matchingIds ? () => tab !== 'active' : retiredBy(products) }}
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
