import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Download,
  Trash2,
  Edit2,
  Eye,
  Package,
  Image as ImageIcon,
} from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import ErrorBoundary from '../../common/ErrorBoundary';
import virtualCatalogService from '../../../services/virtualCatalogService';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import VirtualCatalogProductEditor from './VirtualCatalogProductEditor';

/**
 * Virtual Catalog Upload Management
 * 
 * Upload and parse manufacturer PDF catalogs with:
 * - File upload with progress tracking
 * - Real-time parse status monitoring
 * - Product review and editing
 * - Bulk import to production
 */
const VirtualCatalogUpload = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload'); // upload, review, history
  const [uploadState, setUploadState] = useState({
    file: null,
    uploading: false,
    uploadProgress: 0,
    uploadId: null,
    status: null,
    error: null,
  });

  const [tmpProducts, setTmpProducts] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [tmpFamilies, setTmpFamilies] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(false);
  const [maxPages, setMaxPages] = useState(''); // For testing

  // Load temporary data after parse completion
  const loadTmpData = useCallback(async (uploadId) => {
    setLoading(true);
    try {
      const [productsData, familiesData] = await Promise.all([
        virtualCatalogService.listTmpProducts(uploadId),
        virtualCatalogService.listTmpFamilies(uploadId),
      ]);
      setTmpProducts(productsData.products || []);
      setTmpFamilies(familiesData.families || []);
      setActiveTab('review');
    } catch (error) {
      console.error('Failed to load temporary data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for existing temporary data on mount
  useEffect(() => {
    const checkExistingData = async () => {
      try {
        console.log('Checking for existing tmp data...');
        
        // Load first page of families and products
        const [familiesData, productsData] = await Promise.all([
          virtualCatalogService.listTmpFamilies(null, 0, 200),
          virtualCatalogService.listTmpProducts(null, null, 0, 200)
        ]);
        
        console.log('Families response:', familiesData);
        console.log('Products response:', productsData);
        
        // Check if we have any data (families OR products)
        const hasFamilies = familiesData?.families && familiesData.families.length > 0;
        const hasProducts = productsData?.products && productsData.products.length > 0;
        
        if (hasFamilies || hasProducts) {
          // Set families if we have them
          if (hasFamilies) {
            setTmpFamilies(familiesData.families);
          }
          
          // Load all products if there are more than 200
          let allProducts = productsData?.products || [];
          
          if (productsData?.total > 200) {
            console.log(`Need to fetch ${productsData.total} products in multiple pages...`);
            // Need to fetch more pages
            const remainingPages = Math.ceil((productsData.total - 200) / 200);
            const additionalRequests = [];
            
            for (let i = 1; i <= remainingPages; i++) {
              additionalRequests.push(
                virtualCatalogService.listTmpProducts(null, null, i * 200, 200)
              );
            }
            
            const additionalResults = await Promise.all(additionalRequests);
            additionalResults.forEach(result => {
              if (result?.products) {
                allProducts = [...allProducts, ...result.products];
              }
            });
          }
          
          setTmpProducts(allProducts);
          console.log(`✅ Loaded ${familiesData?.families?.length || 0} families and ${allProducts.length} products (total: ${productsData?.total || 0})`);
          console.log('First product:', allProducts[0]);
          
          // Set upload state to show we're in review mode
          setUploadState(prev => ({
            ...prev,
            uploadId: familiesData?.families?.[0]?.upload_id || productsData?.products?.[0]?.upload_id || 'existing',
            status: { status: 'completed' }
          }));
          
          // Switch to review tab automatically
          setActiveTab('review');
        } else {
          console.log('No existing tmp data found');
        }
      } catch (error) {
        console.error('Failed to check existing data:', error);
        // This is fine - just means no existing data
      }
    };

    checkExistingData();
  }, []);

  // Poll for upload status
  useEffect(() => {
    let interval;
    if (uploadState.uploadId && uploadState.status?.status === 'parsing') {
      interval = setInterval(async () => {
        try {
          const status = await virtualCatalogService.getUploadStatus(uploadState.uploadId);
          setUploadState((prev) => ({ ...prev, status }));

          // Stop polling when complete or failed
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(interval);
            if (status.status === 'completed') {
              loadTmpData(uploadState.uploadId);
            }
          }
        } catch (error) {
          console.error('Failed to fetch status:', error);
          clearInterval(interval);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploadState.uploadId, uploadState.status?.status, loadTmpData]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadState({
        file,
        uploading: false,
        uploadProgress: 0,
        uploadId: null,
        status: null,
        error: null,
      });
    } else {
      setUploadState((prev) => ({
        ...prev,
        error: 'Please select a PDF file',
      }));
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadState.file) return;

    setUploadState((prev) => ({ ...prev, uploading: true, error: null }));

    try {
      const result = await virtualCatalogService.uploadCatalog(
        uploadState.file,
        maxPages ? parseInt(maxPages) : null,
        (progress) => {
          setUploadState((prev) => ({ ...prev, uploadProgress: progress }));
        }
      );

      // Validate response
      if (!result || !result.upload_id) {
        throw new Error('Invalid server response: missing upload_id');
      }

      setUploadState((prev) => ({
        ...prev,
        uploading: false,
        uploadId: result.upload_id,
        status: {
          status: result.status || 'parsing',
          progress: 0,
          current_step: result.message || 'Starting parse...',
        },
      }));
    } catch (error) {
      console.error('Upload error:', error);
      setUploadState((prev) => ({
        ...prev,
        uploading: false,
        error: error.response?.data?.detail || error.message || 'Upload failed',
      }));
    }
  };

  // View product details - navigate to edit page
  const handleViewProduct = (productId) => {
    navigate(`/admin/catalog/virtual-upload/edit/${productId}`);
  };

  // Update product (currently handled by VirtualCatalogProductEditor)
  // eslint-disable-next-line no-unused-vars
  const handleUpdateProduct = async (productId, updates) => {
    try {
      await virtualCatalogService.updateTmpProduct(productId, updates);
      // Reload data
      if (uploadState.uploadId) {
        loadTmpData(uploadState.uploadId);
      }
      setSelectedProduct(null);
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    if (!confirm('Skip this product? It will not be imported.')) return;

    try {
      await virtualCatalogService.deleteTmpProduct(productId);
      // Reload data
      if (uploadState.uploadId) {
        loadTmpData(uploadState.uploadId);
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  // Import to production
  const handleImportToProduction = async () => {
    if (!uploadState.uploadId) return;
    if (!confirm('Import all reviewed products to production?')) return;

    setLoading(true);
    try {
      const result = await virtualCatalogService.importToProduction(uploadState.uploadId);
      alert(
        `Import successful!\n` +
        `Families: ${result.imported.families}\n` +
        `Products: ${result.imported.products}\n` +
        `Variations: ${result.imported.variations}\n` +
        `Images: ${result.imported.images}`
      );
      // Reset state
      setUploadState({
        file: null,
        uploading: false,
        uploadProgress: 0,
        uploadId: null,
        status: null,
        error: null,
      });
      setTmpProducts([]);
      setTmpFamilies([]);
      setActiveTab('upload');
    } catch (error) {
      alert(`Import failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear current session data
  const handleClearSession = async () => {
    if (!uploadState.uploadId) {
      alert('No active session to clear');
      return;
    }

    if (!confirm('Clear current session? This will permanently delete all temporary data, images, and files for this upload.')) return;

    setLoading(true);
    try {
      // Call backend to delete upload and all associated data
      const result = await virtualCatalogService.deleteUploadSession(uploadState.uploadId);
      
      // Reset frontend state
      setUploadState({
        file: null,
        uploading: false,
        uploadProgress: 0,
        uploadId: null,
        status: null,
        error: null,
      });
      setTmpProducts([]);
      setTmpFamilies([]);
      setActiveTab('upload');
      
      const message = `Session cleared successfully!\n\n` +
        `Deleted:\n` +
        `- Families: ${result.deleted.families}\n` +
        `- Products: ${result.deleted.products}\n` +
        `- Variations: ${result.deleted.variations}\n` +
        `- Images: ${result.deleted.images}\n` +
        `- Files: ${result.deleted.files}`;
      
      alert(message);
    } catch (error) {
      alert(`Clear failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Run cleanup of expired data
  const handleCleanupExpired = async () => {
    if (!confirm('Run cleanup of all expired temporary data? This will permanently delete expired uploads, products, and files.')) return;

    setLoading(true);
    try {
      const result = await virtualCatalogService.cleanupExpired();
      
      const message = `Cleanup completed!\n\n` +
        `Expired Data Deleted:\n` +
        `- Uploads: ${result.expired.uploads_deleted}\n` +
        `- Families: ${result.expired.families_deleted}\n` +
        `- Products: ${result.expired.products_deleted}\n` +
        `- Variations: ${result.expired.variations_deleted}\n` +
        `- Images: ${result.expired.images_deleted}\n` +
        `- Files: ${result.expired.files_deleted}\n\n` +
        (result.orphaned ? 
          `Orphaned Files:\n` +
          `- Scanned: ${result.orphaned.uploads_scanned + result.orphaned.images_scanned}\n` +
          `- Deleted: ${result.orphaned.orphaned_deleted}\n` : '');
      
      alert(message);
    } catch (error) {
      alert(`Cleanup failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderUploadTab = () => (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center">
              <Upload className="w-10 h-10 text-primary-500" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-dark-50 mb-2">
              Upload Manufacturer Catalog
            </h3>
            <p className="text-dark-300">
              Upload a PDF catalog to automatically extract products, images, and specifications
            </p>
          </div>

          {/* File Input */}
          <div className="max-w-md mx-auto">
            <label className="block">
              <div className="border-2 border-dashed border-dark-600 rounded-lg p-8 hover:border-primary-500 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadState.file ? (
                  <div className="flex items-center justify-center gap-2 text-dark-50">
                    <FileText className="w-5 h-5" />
                    <span>{uploadState.file.name}</span>
                    <span className="text-dark-400">
                      ({(uploadState.file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <div className="text-dark-300">
                    <p className="font-medium">Click to select PDF file</p>
                    <p className="text-sm mt-1">or drag and drop</p>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Testing Options */}
          <div className="max-w-md mx-auto">
            <label className="block text-left">
              <span className="text-sm text-dark-300 mb-1 block">
                Max Pages (optional, for testing)
              </span>
              <input
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                placeholder="Leave empty to parse all pages"
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Upload Button */}
          {uploadState.file && !uploadState.uploading && !uploadState.uploadId && (
            <Button
              onClick={handleUpload}
              className="bg-primary-500 hover:bg-primary-600"
            >
              <Upload className="w-4 h-4 mr-2" />
              Start Upload & Parse
            </Button>
          )}

          {/* Upload Progress */}
          {uploadState.uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Uploading... {uploadState.uploadProgress}%</span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadState.uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Parse Status */}
          {uploadState.status && (
            <div className="bg-dark-700 rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-center gap-2">
                {uploadState.status.status === 'parsing' && (
                  <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
                )}
                {uploadState.status.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {uploadState.status.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="text-dark-50 font-medium capitalize">
                  {uploadState.status.status === 'parsing' ? 'Processing PDF' : uploadState.status.status}
                </span>
              </div>

              {uploadState.status.current_step && (
                <p className="text-dark-300 text-sm text-center">{uploadState.status.current_step}</p>
              )}

              {/* Progress bar for parsing */}
              {uploadState.status.status === 'parsing' && uploadState.status.progress_percentage !== undefined && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-dark-300">
                    <span>{uploadState.status.pages_processed || 0} / {uploadState.status.total_pages || '?'} pages</span>
                    <span>{uploadState.status.progress_percentage || 0}%</span>
                  </div>
                  <div className="w-full bg-dark-800 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${uploadState.status.progress_percentage || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadState.status.status === 'completed' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-dark-600">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-500">
                      {uploadState.status.families_found || 0}
                    </div>
                    <div className="text-xs text-dark-400">Families</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-500">
                      {uploadState.status.products_found || 0}
                    </div>
                    <div className="text-xs text-dark-400">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-500">
                      {uploadState.status.variations_found || 0}
                    </div>
                    <div className="text-xs text-dark-400">Variations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-500">
                      {uploadState.status.images_extracted || 0}
                    </div>
                    <div className="text-xs text-dark-400">Images</div>
                  </div>
                </div>
              )}

              {uploadState.status.error_message && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-red-500 text-sm">
                  {uploadState.status.error_message}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {uploadState.error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {uploadState.error}
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const renderReviewTab = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-dark-50">{tmpProducts.length}</div>
              <div className="text-sm text-dark-400">Products</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-dark-50">
                {tmpProducts.reduce((sum, p) => sum + (p.images_count || 0), 0)}
              </div>
              <div className="text-sm text-dark-400">Images</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-dark-50">
                {tmpProducts.filter(p => !p.requires_review).length}
              </div>
              <div className="text-sm text-dark-400">Ready to Import</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Products List */}
      <Card>
        <div className="p-4 border-b border-dark-600 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dark-50">Extracted Products</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleClearSession}
              variant="outline"
              size="sm"
              disabled={tmpProducts.length === 0}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Clear Session
            </Button>
            <Button
              onClick={handleImportToProduction}
              disabled={tmpProducts.length === 0}
              className="bg-green-500 hover:bg-green-600"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Import to Production
            </Button>
          </div>
        </div>

        <div className="divide-y divide-dark-600">
          {tmpProducts.length === 0 ? (
            <div className="p-8 text-center text-dark-400">
              No products found
            </div>
          ) : (
            tmpProducts.map((product) => (
              <div
                key={product.id}
                className="p-4 hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Product Image */}
                  {product.images && Array.isArray(product.images) && product.images.length > 0 && (
                    <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-white overflow-hidden">
                      <img
                        src={resolveImageUrl(product.images[0])}
                        alt={product.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.src = '/placeholder.png';
                        }}
                      />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-dark-50">{product.name}</h4>
                      {product.requires_review && (
                        <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs rounded">
                          Needs Review
                        </span>
                      )}
                      <span className="px-2 py-1 bg-dark-600 text-dark-300 text-xs rounded">
                        {product.model_number}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-dark-300">
                      <div>
                        <span className="text-dark-400">Page:</span> {product.source_page}
                      </div>
                      <div>
                        <span className="text-dark-400">Variations:</span> {product.variations_count}
                      </div>
                      <div>
                        <span className="text-dark-400">Images:</span> {product.images_count}
                      </div>
                      <div>
                        <span className="text-dark-400">Confidence:</span>{' '}
                        <span
                          className={
                            product.extraction_confidence >= 80
                              ? 'text-green-500'
                              : product.extraction_confidence >= 50
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          }
                        >
                          {product.extraction_confidence}%
                        </span>
                      </div>
                    </div>

                    {product.dimensions && (
                      <div className="mt-2 text-sm text-dark-400">
                        {product.dimensions.height && `H: ${product.dimensions.height}" `}
                        {product.dimensions.width && `W: ${product.dimensions.width}" `}
                        {product.dimensions.depth && `D: ${product.dimensions.depth}" `}
                        {product.dimensions.weight && `Weight: ${product.dimensions.weight}# `}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setEditingProductId(product.id)}
                      variant="secondary"
                      size="sm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleViewProduct(product.id)}
                      variant="secondary"
                      size="sm"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteProduct(product.id)}
                      variant="secondary"
                      size="sm"
                      className="text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Show editor if a product is being edited */}
      {editingProductId ? (
        <VirtualCatalogProductEditor
          productId={editingProductId}
          onBack={() => {
            setEditingProductId(null);
            loadTmpData(uploadState.uploadId); // Reload data
          }}
          onSave={() => {
            setEditingProductId(null);
            loadTmpData(uploadState.uploadId); // Reload data
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-dark-50">Virtual Catalog Upload</h2>
              <p className="text-dark-300 mt-1">
                Upload and parse manufacturer PDF catalogs
              </p>
            </div>
          </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-dark-600">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'review'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-dark-400 hover:text-dark-200'
            }`}
            disabled={tmpProducts.length === 0}
          >
            Review ({tmpProducts.length})
          </button>
        </div>
        
        {/* Cleanup button */}
        <Button
          onClick={handleCleanupExpired}
          variant="outline"
          size="sm"
          className="mb-2"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Cleanup Expired
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'upload' && renderUploadTab()}
      {activeTab === 'review' && renderReviewTab()}

      {/* Product Detail Modal (simplified, would need full modal component) */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-dark-50">{selectedProduct.name}</h3>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-dark-400 hover:text-dark-200"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-dark-400">Model:</span>{' '}
                  <span className="text-dark-50">{selectedProduct.model_number}</span>
                </div>
                <div>
                  <span className="text-dark-400">Page:</span>{' '}
                  <span className="text-dark-50">{selectedProduct.source_page}</span>
                </div>
              </div>

              {/* Images */}
              {selectedProduct.images && selectedProduct.images.length > 0 && (
                <div>
                  <h4 className="font-semibold text-dark-50 mb-2">Images</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedProduct.images.map((img) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt="Product"
                        className="w-full h-32 object-contain bg-white rounded"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Variations */}
              {selectedProduct.variations && selectedProduct.variations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-dark-50 mb-2">Variations</h4>
                  <div className="space-y-1">
                    {selectedProduct.variations.map((v) => (
                      <div key={v.id} className="text-sm text-dark-300">
                        {v.sku} - {v.suffix_description || v.suffix}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-dark-600">
                <Button onClick={() => setSelectedProduct(null)} variant="secondary">
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
};

// Wrap component with error boundary
const VirtualCatalogUploadWithErrorBoundary = () => (
  <ErrorBoundary
    showDetails={import.meta.env.DEV}
    showReload={true}
    onReset={() => window.location.reload()}
  >
    <VirtualCatalogUpload />
  </ErrorBoundary>
);

export default VirtualCatalogUploadWithErrorBoundary;
