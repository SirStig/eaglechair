import { useState, useEffect } from 'react';
import { Package, Edit2, Eye, EyeOff, Trash2, TrendingUp, MessageSquareQuote } from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';

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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line
  }, [page, search, categoryFilter, statusFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/admin/products', {
        params: {
          page,
          page_size: 20,
          search: search || undefined,
          category_id: categoryFilter || undefined,
          is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        }
      });
      setProducts(response.data.items || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/v1/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleToggleActive = async (productId, currentStatus) => {
    try {
      await axios.patch(`/api/v1/admin/products/${productId}`, {
        is_active: !currentStatus
      });
      fetchProducts();
    } catch (error) {
      console.error('Failed to toggle product status:', error);
    }
  };

  const handleDelete = async (productId) => {
    const product = products.find(p => p.id === productId);
    const confirmMessage = `Are you sure you want to delete "${product?.name}"?\n\nThis action cannot be undone and will permanently remove:\n- Product information\n- All variations\n- All images\n- Associated analytics data\n\nType "DELETE" to confirm.`;
    
    const userInput = prompt(confirmMessage);
    if (userInput !== 'DELETE') {
      if (userInput !== null) {
        alert('Deletion cancelled. You must type DELETE to confirm.');
      }
      return;
    }
    
    try {
      await axios.delete(`/api/v1/admin/products/${productId}`);
      alert('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product. Please try again.');
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedProducts.length === 0) {
      alert('Please select products first');
      return;
    }

    switch (action) {
      case 'activate':
        // Implement bulk activate
        break;
      case 'deactivate':
        // Implement bulk deactivate
        break;
      case 'delete':
        if (!confirm(`Delete ${selectedProducts.length} products?`)) return;
        // Implement bulk delete
        break;
      default:
        break;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Product Catalog</h2>
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

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setStatusFilter('');
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
          <div className="flex items-center justify-between">
            <p className="text-dark-50 font-medium">
              {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('activate')}>
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                Deactivate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('delete')}>
                Delete
              </Button>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === products.length}
                      onChange={handleSelectAll}
                      className="rounded border-dark-600 bg-dark-700"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Image</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Model</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Price</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-dark-300">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Views
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-dark-300">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquareQuote className="w-4 h-4" />
                      Quotes
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-dark-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-dark-700 hover:bg-dark-700/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="rounded border-dark-600 bg-dark-700"
                      />
                    </td>
                    <td className="px-4 py-4">
                      {product.primary_image_url ? (
                        <img
                          src={product.primary_image_url}
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
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 text-primary-500 hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(product.id, product.is_active)}
                          className="p-2 text-accent-500 hover:bg-accent-900/20 rounded-lg transition-colors"
                          title={product.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {product.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-700">
            <p className="text-sm text-dark-300">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProductCatalog;
