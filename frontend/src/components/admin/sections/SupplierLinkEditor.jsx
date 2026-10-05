import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { uploadImage } from '../../../utils/imageUpload';
import { Upload, X, ExternalLink } from 'lucide-react';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import { SUPPLIER_TYPE_OPTIONS } from './supplierLinkTypes';

const INPUT =
  'w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all';
const LABEL = 'block text-sm font-medium text-dark-200 mb-2';

// FastAPI 422 bodies list field errors; show them as one readable message
const errorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${(d.loc || []).slice(-1)[0] || 'field'}: ${String(d.msg || '').replace(/^Value error, /, '')}`)
      .join('; ');
  }
  return detail || error?.message || 'Failed to save supplier link';
};

/**
 * Create / edit one supplier link (an outside catalog we order from on request)
 */
const SupplierLinkEditor = ({ source, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: source?.name || '',
    material_type: source?.material_type || 'laminate',
    url: source?.url || '',
    description: source?.description || '',
    logo_url: source?.logo_url || '',
    is_active: source?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      handleChange('logo_url', await uploadImage(file, 'suppliers'));
    } catch (err) {
      setError(err?.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...formData,
      name: formData.name.trim(),
      url: formData.url.trim(),
      description: formData.description.trim() || null,
      logo_url: formData.logo_url.trim() || null,
    };
    try {
      if (source) {
        await apiClient.put(`/api/v1/admin/material-sources/${source.id}`, payload);
      } else {
        await apiClient.post('/api/v1/admin/material-sources', payload);
      }
      onSave();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        onBack={onBack}
        backDisabled={busy}
        backLabel="Back to Supplier Links"
        eyebrow="Materials & Options"
        title={source ? `Edit: ${source.name}` : 'Add Supplier Link'}
        description="A supplier catalog customers can pick from; we order the material on request."
      />

      <form onSubmit={handleSubmit}>
        <Card className="bg-dark-800 border-dark-700">
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-300" role="alert">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="supplier-name">Name *</label>
                <input
                  id="supplier-name"
                  required
                  maxLength={255}
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={INPUT}
                  placeholder="e.g. Wilsonart"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="supplier-type">Type *</label>
                <select
                  id="supplier-type"
                  value={formData.material_type}
                  onChange={(e) => handleChange('material_type', e.target.value)}
                  className={INPUT}
                >
                  {SUPPLIER_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="supplier-url">Link *</label>
              <div className="flex gap-2">
                <input
                  id="supplier-url"
                  required
                  maxLength={500}
                  value={formData.url}
                  onChange={(e) => handleChange('url', e.target.value)}
                  className={INPUT}
                  placeholder="https://www.wilsonart.com/laminate"
                />
                {formData.url.trim() && (
                  <a
                    href={/^https?:\/\//i.test(formData.url.trim()) ? formData.url.trim() : `https://${formData.url.trim()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center rounded-lg border border-dark-600 px-3 text-dark-200 hover:bg-dark-700"
                    title="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <p className="mt-1 text-xs text-dark-400">Full web address. A bare domain like wilsonart.com gets https:// added.</p>
            </div>

            <div>
              <label className={LABEL} htmlFor="supplier-note">Customer note</label>
              <textarea
                id="supplier-note"
                rows={3}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className={INPUT}
                placeholder="Choose any HPL pattern at wilsonart.com and give its pattern number in your quote request."
              />
              <p className="mt-1 text-xs text-dark-400">Shown next to the link on product and materials pages.</p>
            </div>

            <div>
              <label className={LABEL} htmlFor="supplier-logo">Logo (optional)</label>
              <div className="flex flex-wrap items-center gap-3">
                {formData.logo_url && (
                  <div className="relative">
                    <img
                      src={resolveImageUrl(formData.logo_url)}
                      alt=""
                      className="h-14 w-28 rounded border border-dark-600 bg-white object-contain p-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleChange('logo_url', '')}
                      className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-500"
                      title="Remove logo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <input
                  id="supplier-logo"
                  value={formData.logo_url}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  className={`${INPUT} min-w-0 flex-1`}
                  placeholder="Image URL, or upload"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dark-600 px-3 py-2 text-sm text-dark-100 hover:bg-dark-700">
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={busy} />
                </label>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="rounded border-dark-500"
              />
              <span className="text-dark-200">Active (shown on the website)</span>
            </label>

            <div className="flex justify-end gap-3 border-t border-dark-700 pt-4">
              <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {saving ? 'Saving…' : source ? 'Save Changes' : 'Add Supplier Link'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </AdminPage>
  );
};

export default SupplierLinkEditor;
