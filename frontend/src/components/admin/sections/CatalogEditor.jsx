import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { ArrowLeft, Upload, X, FileText } from 'lucide-react';

/**
 * Catalog Editor Component
 * Separate component for editing/creating catalogs with PDF and thumbnail upload
 */
const CatalogEditor = ({ catalog, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    title: catalog?.title || '',
    description: catalog?.description || '',
    catalog_type: catalog?.catalog_type || 'full_catalog',
    version: catalog?.version || '',
    year: catalog?.year || '',
    display_order: catalog?.display_order || 0,
    is_active: catalog?.is_active !== false,
    is_featured: catalog?.is_featured || false,
    file_url: catalog?.file_url || '',
    thumbnail_url: catalog?.thumbnail_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are accepted');
      return;
    }

    setSelectedFile(file);
    setFilePreview(file.name);
  };

  const handleThumbnailUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingThumbnail(true);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('subfolder', 'catalogs');
      
      const response = await apiClient.post('/api/v1/admin/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      handleChange('thumbnail_url', response.url);
    } catch (error) {
      console.error('Failed to upload thumbnail:', error);
      alert('Failed to upload thumbnail');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const deleteThumbnail = async () => {
    if (!confirm('Delete this thumbnail?')) return;
    
    try {
      if (formData.thumbnail_url) {
        await apiClient.delete('/api/v1/admin/upload/image', {
          data: { url: formData.thumbnail_url }
        });
      }
      handleChange('thumbnail_url', '');
    } catch (error) {
      console.error('Failed to delete thumbnail:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title || !formData.title.trim()) {
      alert('Title is required');
      return;
    }
    
    if (!formData.catalog_type) {
      alert('Catalog type is required');
      return;
    }
    
    if (!catalog && !selectedFile && !formData.file_url) {
      alert('Please upload a PDF file');
      return;
    }
    
    setSaving(true);
    
    try {
      const submitFormData = new FormData();
      
      // Required fields - always send these (non-empty)
      submitFormData.append('title', formData.title.trim());
      submitFormData.append('catalog_type', formData.catalog_type);
      
      // Optional text fields - send empty string if not provided
      submitFormData.append('description', formData.description || '');
      submitFormData.append('version', formData.version || '');
      submitFormData.append('year', formData.year || '');
      
      // Numeric fields
      submitFormData.append('display_order', String(formData.display_order || 0));
      
      // Boolean fields - FastAPI Form() with bool type expects "true"/"false" (lowercase) strings
      // FormData can only send strings, so convert boolean to lowercase string
      submitFormData.append('is_active', formData.is_active !== false ? 'true' : 'false');
      submitFormData.append('is_featured', formData.is_featured === true ? 'true' : 'false');
      
      // File upload - must be included if creating new catalog
      if (selectedFile) {
        submitFormData.append('file', selectedFile);
      } else if (formData.file_url && !formData.file_url.startsWith('/uploads/')) {
        // Allow existing file_url if provided (for updates)
        submitFormData.append('file_url', formData.file_url);
      }
      
      // Thumbnail URL - send if we have one (from previous upload or existing)
      if (formData.thumbnail_url) {
        submitFormData.append('thumbnail_url', formData.thumbnail_url);
      }
      
      // Debug: Log what we're sending
      console.log('Sending FormData:', {
        title: formData.title,
        catalog_type: formData.catalog_type,
        hasFile: !!selectedFile,
        file_url: formData.file_url,
        is_active: formData.is_active,
        is_featured: formData.is_featured
      });
      
      if (catalog) {
        // Update existing catalog
        await apiClient.put(`/api/v1/admin/catalog/catalogs/${catalog.id}`, submitFormData);
      } else {
        // Create new catalog - file is required
        if (!selectedFile) {
          alert('Please upload a PDF file to create a new catalog');
          setSaving(false);
          return;
        }
        await apiClient.post('/api/v1/admin/catalog/catalogs', submitFormData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save catalog:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || 'Failed to save catalog';
      const errors = error.response?.data?.errors;
      if (errors && Array.isArray(errors)) {
        const errorDetails = errors.map(e => `${e.field}: ${e.message}`).join('\n');
        alert(`${errorMessage}\n\n${errorDetails}`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const isUploading = uploadingThumbnail;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
          disabled={saving || isUploading}
        >
          <ArrowLeft className="w-5 h-5 text-dark-300" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-dark-50">
            {catalog ? `Edit: ${catalog.title}` : 'Create Catalog'}
          </h2>
          <p className="text-dark-300 mt-1">
            {catalog ? 'Update catalog details and files' : 'Add a new virtual catalog or guide'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className="bg-dark-800 border-dark-700">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 2024 Product Catalog"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Catalog Type *
                  </label>
                  <select
                    value={formData.catalog_type}
                    onChange={(e) => handleChange('catalog_type', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    required
                  >
                    <option value="full_catalog">Full Catalog</option>
                    <option value="product_line">Product Line</option>
                    <option value="price_list">Price List</option>
                    <option value="finish_guide">Finish Guide</option>
                    <option value="upholstery_guide">Upholstery Guide</option>
                    <option value="care_guide">Care Guide</option>
                    <option value="installation_guide">Installation Guide</option>
                    <option value="specification_sheet">Specification Sheet</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  placeholder="Brief description of this catalog"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Version
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => handleChange('version', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 1.0, 2.3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Year
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => handleChange('year', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 2024"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            {/* PDF File Upload */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                PDF File
              </h3>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  {catalog ? 'Upload New PDF (Optional)' : 'Upload PDF *'}
                </label>
                {(filePreview || (formData.file_url && formData.file_url.startsWith('/uploads/'))) ? (
                  <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg border border-dark-600">
                    <FileText className="w-6 h-6 text-primary-400" />
                    <div className="flex-1">
                      <div className="text-sm text-dark-50 font-medium">
                        {filePreview || formData.file_url.split('/').pop()}
                      </div>
                      {formData.file_url && !filePreview && (
                        <div className="text-xs text-dark-400">
                          {formData.file_url}
                        </div>
                      )}
                    </div>
                    {filePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        className="p-1 text-red-400 hover:bg-red-900/20 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <label className="relative block">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={saving}
                      required={!catalog}
                    />
                    <div className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${saving ? 'opacity-50' : ''}`}>
                      <Upload className="w-10 h-10 text-dark-500 mb-2" />
                      <span className="text-sm text-dark-400">Upload PDF</span>
                      <span className="text-xs text-dark-500 mt-1">PDF only, max 100MB</span>
                    </div>
                  </label>
                )}
                {catalog && formData.file_url && !filePreview && (
                  <p className="text-xs text-dark-400 mt-2">
                    Select a new file to replace the existing one
                  </p>
                )}
              </div>
            </div>

            {/* Thumbnail Upload */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Cover Image (Thumbnail)
              </h3>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Thumbnail Image
                </label>
                {formData.thumbnail_url ? (
                  <div className="relative group inline-block">
                    <img 
                      src={resolveImageUrl(formData.thumbnail_url)} 
                      alt="Catalog thumbnail"
                      className="w-48 h-32 object-cover rounded-lg border border-dark-600"
                    />
                    <button
                      onClick={deleteThumbnail}
                      className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                      title="Delete thumbnail"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="relative block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                      disabled={uploadingThumbnail}
                    />
                    <div className={`flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingThumbnail ? 'opacity-50' : ''}`}>
                      {uploadingThumbnail ? (
                        <>
                          <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin mb-2" />
                          <span className="text-sm text-primary-400 font-medium">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-dark-500 mb-2" />
                          <span className="text-sm text-dark-400">Upload thumbnail</span>
                          <span className="text-xs text-dark-500 mt-1">PNG, JPG</span>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Display Options */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Display Options
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Active</span>
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => handleChange('is_featured', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Featured</span>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            onClick={onBack}
            disabled={saving || isUploading}
            className="bg-dark-600 hover:bg-dark-500 text-dark-200 px-6 py-3"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || isUploading || !formData.title || (!catalog && !selectedFile && !formData.file_url)}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
          >
            {isUploading ? 'Uploading...' : saving ? 'Saving...' : catalog ? 'Update Catalog' : 'Create Catalog'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CatalogEditor;
