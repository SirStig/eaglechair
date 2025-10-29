import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { getSiteSettingsAdmin, updateSiteSettings } from '../../services/contentService';
import { uploadImage } from '../../utils/imageUpload';
import logger from '../../utils/logger';

const CONTEXT = 'SiteSettingsManager';

/**
 * SiteSettingsManager Component
 * 
 * Admin component for managing site-wide settings including:
 * - Company information
 * - Contact details
 * - Business hours
 * - Logos and branding
 * - Social media links
 */
const SiteSettingsManager = () => {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch site settings from API (admin version - always gets DB data)
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSiteSettingsAdmin();
      setFormData(data);
    } catch (error) {
      logger.error(CONTEXT, 'Failed to fetch site settings', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const url = await uploadImage(file, 'logos');
      setFormData(prev => ({ ...prev, [fieldName]: url }));
      logger.info(CONTEXT, `Logo uploaded: ${url}`);
    } catch (error) {
      logger.error(CONTEXT, 'Logo upload failed', error);
      alert('Failed to upload logo: ' + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      logger.info(CONTEXT, 'Updating site settings');
      await updateSiteSettings(formData);
      await fetchSettings(); // Refresh data after update
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      logger.info(CONTEXT, 'Site settings updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update site settings', error);
      alert('Failed to update settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-dark-50">Site Settings</h2>
        <p className="text-dark-100 mt-1">
          Manage company information, contact details, and site-wide settings
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-900/50 border border-green-500 text-green-100 px-4 py-3 rounded-lg"
        >
          ✓ Settings updated successfully!
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Branding */}
        <Card>
          <h3 className="text-xl font-semibold text-dark-50 mb-4">Company Branding</h3>
          <div className="space-y-4">
            <Input
              label="Company Name"
              name="company_name"
              value={formData.company_name || ''}
              onChange={handleChange}
            />
            
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-2">
                Company Tagline
              </label>
              <textarea
                name="company_tagline"
                value={formData.company_tagline || ''}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            {/* Logo Upload */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Main Logo
                </label>
                {formData.logo_url && (
                  <div className="mb-2 p-4 bg-dark-700 rounded-lg">
                    <img src={formData.logo_url} alt="Logo" className="h-12 object-contain" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, 'logo_url')}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <div className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-50 rounded-lg transition-colors border border-dark-500 text-sm font-medium text-center">
                    {uploadingLogo ? 'Uploading...' : 'Choose Logo'}
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Dark Logo (Optional)
                </label>
                {formData.logo_dark_url && (
                  <div className="mb-2 p-4 bg-dark-700 rounded-lg">
                    <img src={formData.logo_dark_url} alt="Dark Logo" className="h-12 object-contain" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, 'logo_dark_url')}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <div className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-50 rounded-lg transition-colors border border-dark-500 text-sm font-medium text-center">
                    {uploadingLogo ? 'Uploading...' : 'Choose Dark Logo'}
                  </div>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card>
          <h3 className="text-xl font-semibold text-dark-50 mb-4">Contact Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Primary Phone"
              name="primary_phone"
              value={formData.primary_phone || ''}
              onChange={handleChange}
            />
            <Input
              label="Sales Phone"
              name="sales_phone"
              value={formData.sales_phone || ''}
              onChange={handleChange}
            />
            <Input
              label="Primary Email"
              name="primary_email"
              type="email"
              value={formData.primary_email || ''}
              onChange={handleChange}
            />
            <Input
              label="Sales Email"
              name="sales_email"
              type="email"
              value={formData.sales_email || ''}
              onChange={handleChange}
            />
            <Input
              label="Support Email"
              name="support_email"
              type="email"
              value={formData.support_email || ''}
              onChange={handleChange}
            />
            <Input
              label="Support Phone"
              name="support_phone"
              value={formData.support_phone || ''}
              onChange={handleChange}
            />
          </div>
        </Card>

        {/* Primary Address */}
        <Card>
          <h3 className="text-xl font-semibold text-dark-50 mb-4">Primary Address</h3>
          <div className="space-y-4">
            <Input
              label="Address Line 1"
              name="address_line1"
              value={formData.address_line1 || ''}
              onChange={handleChange}
            />
            <Input
              label="Address Line 2 (Optional)"
              name="address_line2"
              value={formData.address_line2 || ''}
              onChange={handleChange}
            />
            <div className="grid md:grid-cols-3 gap-4">
              <Input
                label="City"
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
              />
              <Input
                label="State"
                name="state"
                value={formData.state || ''}
                onChange={handleChange}
              />
              <Input
                label="ZIP Code"
                name="zip_code"
                value={formData.zip_code || ''}
                onChange={handleChange}
              />
            </div>
            <Input
              label="Country"
              name="country"
              value={formData.country || 'USA'}
              onChange={handleChange}
            />
          </div>
        </Card>

        {/* Business Hours */}
        <Card>
          <h3 className="text-xl font-semibold text-dark-50 mb-4">Business Hours</h3>
          <div className="space-y-4">
            <Input
              label="Weekdays Hours"
              name="business_hours_weekdays"
              placeholder="e.g., Monday - Friday: 8:00 AM - 5:00 PM"
              value={formData.business_hours_weekdays || ''}
              onChange={handleChange}
            />
            <Input
              label="Saturday Hours"
              name="business_hours_saturday"
              placeholder="e.g., Saturday: 9:00 AM - 2:00 PM"
              value={formData.business_hours_saturday || ''}
              onChange={handleChange}
            />
            <Input
              label="Sunday Hours"
              name="business_hours_sunday"
              placeholder="e.g., Sunday: Closed"
              value={formData.business_hours_sunday || ''}
              onChange={handleChange}
            />
          </div>
        </Card>

        {/* Social Media */}
        <Card>
          <h3 className="text-xl font-semibold text-dark-50 mb-4">Social Media</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Facebook URL"
              name="facebook_url"
              type="url"
              value={formData.facebook_url || ''}
              onChange={handleChange}
            />
            <Input
              label="Instagram URL"
              name="instagram_url"
              type="url"
              value={formData.instagram_url || ''}
              onChange={handleChange}
            />
            <Input
              label="LinkedIn URL"
              name="linkedin_url"
              type="url"
              value={formData.linkedin_url || ''}
              onChange={handleChange}
            />
            <Input
              label="Twitter URL"
              name="twitter_url"
              type="url"
              value={formData.twitter_url || ''}
              onChange={handleChange}
            />
            <Input
              label="YouTube URL"
              name="youtube_url"
              type="url"
              value={formData.youtube_url || ''}
              onChange={handleChange}
            />
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving || uploadingLogo}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SiteSettingsManager;

