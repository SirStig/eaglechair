import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl, resolveFileUrl } from '../../../utils/apiHelpers';
import { slugify } from '../../../utils/slugify';
import { FileText, Upload, X } from 'lucide-react';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import ResponsiveImage from '../../ui/ResponsiveImage';
import PdfPreviewButton from '../../ui/PdfPreviewButton';
import ImagePickerField from '../media/ImagePickerField';

/**
 * Product Family Editor Component
 * Separate component for editing/creating product families with image upload
 */
const FamilyEditor = ({ family, categories, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: family?.name || '',
    slug: family?.slug || '',
    description: family?.description || '',
    category_id: family?.category_id || null,
    subcategory_id: family?.subcategory_id || null,
    family_image: family?.family_image || '',
    banner_image_url: family?.banner_image_url || '',
    catalog_pdf_url: family?.catalog_pdf_url || '',
    overview_text: family?.overview_text || '',
    display_order: family?.display_order || 0,
    is_active: family?.is_active !== false,
    is_featured: family?.is_featured === true
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [members, setMembers] = useState(null);

  useEffect(() => {
    if (!family?.id) return;
    let cancelled = false;
    apiClient
      .get(`/api/v1/admin/families/${family.id}/members`)
      .then((data) => { if (!cancelled) setMembers(data); })
      .catch((error) => {
        console.error('Failed to load family members:', error);
        if (!cancelled) setMembers({ products: [], secondary_products: [], variations: [] });
      });
    return () => { cancelled = true; };
  }, [family?.id]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'name') next.slug = slugify(value);
      return next;
    });
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a PDF file');
      return;
    }
    setUploadingPdf(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('subfolder', 'product-families');
      const response = await apiClient.post('/api/v1/admin/upload/document', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      handleChange('catalog_pdf_url', response.url);
    } catch (error) {
      console.error('Failed to upload PDF:', error);
      alert(error.response?.data?.detail || 'Failed to upload PDF');
    } finally {
      setUploadingPdf(false);
    }
  };

  const isUploading = uploadingPdf;

  const renderImageControl = (field, label) => (
    <ImagePickerField
      value={formData[field]}
      onChange={(url) => handleChange(field, url)}
      subfolder="families"
      label={label}
      objectFit="cover"
      previewClassName={field === 'family_image' ? 'w-full h-48' : 'w-full h-32'}
      disabled={saving}
    />
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (family) {
        await apiClient.put(`/api/v1/admin/catalog/families/${family.id}`, formData);
      } else {
        await apiClient.post('/api/v1/admin/catalog/families', formData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save family:', error);
      alert(error.response?.data?.detail || 'Failed to save family');
    } finally {
      setSaving(false);
    }
  };

  const renderProductList = (title, items) => (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-400 mb-2">
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-dark-500">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                to={`/admin/catalog?edit=${p.id}`}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-dark-700 transition-colors"
              >
                {p.primary_image_url ? (
                  <ResponsiveImage
                    sizes="40px"
                    fullResolution={false}
                    src={resolveImageUrl(p.primary_image_url)}
                    alt=""
                    className="w-10 h-10 object-contain bg-white rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-dark-700 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-dark-50 truncate">{p.name}</p>
                  <p className="text-xs text-dark-400">
                    {[p.model_number, p.model_suffix].filter(Boolean).join('')}
                    {!p.is_active && <span className="ml-2 text-amber-400">Inactive</span>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const membersPanel = family?.id && (
    <aside className="lg:sticky lg:top-20 self-start">
      <Card className="bg-dark-800 border-dark-700">
        <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
          In This Family
        </h3>
        {!members ? (
          <p className="text-sm text-dark-400">Loading...</p>
        ) : (
          <div className="space-y-5 lg:max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">
            {renderProductList('Products', members.products)}
            {members.secondary_products.length > 0 &&
              renderProductList('Also Listed Here', members.secondary_products)}
            {members.variations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-400 mb-2">
                  Variations ({members.variations.length})
                </h4>
                <ul className="space-y-1">
                  {members.variations.map((v) => (
                    <li key={v.id}>
                      <Link
                        to={`/admin/catalog?edit=${v.product_id}`}
                        className="block rounded-lg px-2 py-1.5 hover:bg-dark-700 transition-colors"
                      >
                        <span className="text-sm text-dark-50 font-mono">{v.sku}</span>
                        <span className="block text-xs text-dark-400 truncate">{v.product_name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </aside>
  );

  return (
    <AdminPage width={family?.id ? 'wide' : 'default'}>
      <AdminPageHeader
        eyebrow="Products"
        title={family ? `Edit ${family.name}` : 'New Product Family'}
        description={family ? 'Update family details and images' : 'Add a new product family'}
        onBack={onBack}
        backDisabled={saving || isUploading}
        backLabel="Back to Product Families"
      />

      <div className={family?.id ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]' : undefined}>
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
                    Family Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Executive Series"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleChange('slug', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="executive-series"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                placeholder="Brief description of this family"
              />
            </div>

            {/* Overview Text */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Overview Text
              </label>
              <textarea
                value={formData.overview_text}
                onChange={(e) => handleChange('overview_text', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                placeholder="Detailed overview for the family page"
              />
            </div>

            {/* Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Images
              </h3>
              <div className="grid grid-cols-2 gap-6">
                {renderImageControl('family_image', 'Family Image')}
                {renderImageControl('banner_image_url', 'Banner Image')}
              </div>
            </div>

            {/* Family Catalog PDF */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Product Family Catalog PDF
              </h3>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Catalog PDF (optional)
              </label>
              {formData.catalog_pdf_url ? (
                <div className="flex items-center gap-3 p-4 bg-dark-700 border border-dark-600 rounded-lg">
                  <FileText className="w-8 h-8 text-primary-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={resolveFileUrl(formData.catalog_pdf_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 truncate block"
                    >
                      View catalog PDF
                    </a>
                  </div>
                  <PdfPreviewButton variant="pill" url={formData.catalog_pdf_url} title={`${formData.name || 'Family'} catalog`} />
                  <button
                    type="button"
                    onClick={() => handleChange('catalog_pdf_url', '')}
                    className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                    title="Remove PDF"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="relative block">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfUpload}
                    className="sr-only"
                    disabled={uploadingPdf}
                  />
                  <div className={`flex flex-col items-center justify-center border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all h-32 ${uploadingPdf ? 'opacity-50' : ''}`}>
                    {uploadingPdf ? (
                      <>
                        <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin mb-2" />
                        <span className="text-sm text-primary-400 font-medium">Uploading PDF...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-dark-500 mb-2" />
                        <span className="text-sm text-dark-400">Click to upload catalog PDF</span>
                        <span className="text-xs text-dark-500 mt-1">PDF up to 1GB</span>
                      </>
                    )}
                  </div>
                </label>
              )}
            </div>

            {/* Settings */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => handleChange('category_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">None</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
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

              <div className="flex gap-6 mt-4">
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
            disabled={saving || isUploading || !formData.name || !formData.slug}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
          >
            {isUploading ? 'Uploading...' : saving ? 'Saving...' : family ? 'Update Family' : 'Create Family'}
          </Button>
        </div>
      </form>
      {membersPanel}
      </div>
    </AdminPage>
  );
};

export default FamilyEditor;
