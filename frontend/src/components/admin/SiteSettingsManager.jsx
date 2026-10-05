import { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, Phone, MapPin, Clock, Share2, Search } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { getSiteSettingsAdmin, updateSiteSettings } from '../../services/cmsAdminService';
import { isPublishFailed } from '../../utils/cmsContentStore';
import { isSafeUrl, URL_POLICY_MESSAGE } from '../../utils/safeUrl';
import { useToast } from '../../contexts/ToastContext';
import logger from '../../utils/logger';
import ImagePickerField from './media/ImagePickerField';

const CONTEXT = 'SiteSettingsManager';

// Link fields validated against the shared URL policy before saving
const URL_FIELDS = ['facebook_url', 'instagram_url', 'linkedin_url', 'twitter_url', 'youtube_url'];

const TEXTAREA_CLASS = 'w-full rounded-lg border border-dark-400 bg-dark-700 px-4 py-2.5 text-base text-dark-50 placeholder-dark-200 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

const Section = ({ icon, title, description, children }) => (
  <section className="rounded-xl border border-dark-600 bg-dark-800">
    <header className="flex items-start gap-3 border-b border-dark-600 px-5 py-4 sm:px-6">
      <span className="mt-0.5 flex-shrink-0 text-primary-500 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">{icon}</span>
      <div>
        <h3 className="font-semibold text-dark-50">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-dark-200">{description}</p>}
      </div>
    </header>
    <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
  </section>
);

const CharCount = ({ value, max }) => {
  const length = (value || '').length;
  return (
    <span className={`text-xs tabular-nums ${length > max ? 'text-amber-400' : 'text-dark-200'}`}>
      {length}/{max}
    </span>
  );
};

/**
 * SiteSettingsManager
 *
 * Site-wide settings: branding, contact details, address, hours, social
 * links and default SEO. Saving publishes to the public site immediately.
 */
const SiteSettingsManager = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formData, setFormData] = useState({});
  const [savedData, setSavedData] = useState({});
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const toast = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await getSiteSettingsAdmin();
      setFormData(data || {});
      setSavedData(data || {});
    } catch (error) {
      logger.error(CONTEXT, 'Failed to fetch site settings', error);
      setLoadError(error.message || 'Failed to load site settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isDirty = useMemo(
    () => Object.keys({ ...formData, ...savedData }).some((key) => (formData[key] ?? '') !== (savedData[key] ?? '')),
    [formData, savedData]
  );

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleChange = (e) => setField(e.target.name, e.target.value);

  const field = (name) => ({
    name,
    value: formData[name] || '',
    onChange: handleChange,
    error: fieldErrors[name],
  });

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const errors = {};
    URL_FIELDS.forEach((name) => {
      if (!isSafeUrl(formData[name])) errors[name] = URL_POLICY_MESSAGE;
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the highlighted links before saving.');
      return;
    }

    try {
      setSaving(true);
      // The API client clears the public content caches after this write
      const response = await updateSiteSettings(formData);
      await fetchSettings();
      // A save that didn't publish raises a global warning toast instead
      if (!isPublishFailed(response)) toast.success('Site settings saved and published');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update site settings', error);
      toast.error(`Couldn't save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const renderLogoField = (name, label, hint) => (
    <ImagePickerField
      value={formData[name]}
      onChange={(url) => setField(name, url)}
      subfolder="logos"
      label={label}
      help={hint}
      previewClassName="h-24 w-full"
      disabled={saving}
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-dark-800" />)}
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        <span>{loadError}</span>
        <Button variant="ghost" size="xs" onClick={() => { setLoading(true); fetchSettings(); }}>Retry</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      <Section icon={<Building2 />} title="Branding" description="Name, tagline and logos used across the site.">
        <Input label="Company name" {...field('company_name')} />
        <div>
          <label htmlFor="company_tagline" className="mb-1.5 block text-sm font-medium text-dark-100">Tagline</label>
          <textarea id="company_tagline" {...field('company_tagline')} rows={2} className={`${TEXTAREA_CLASS} resize-y`} />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {renderLogoField('logo_url', 'Main logo', 'Dark logo for light backgrounds: emails and search results. Use a transparent PNG.')}
          {renderLogoField('logo_dark_url', 'Logo for dark backgrounds', 'Light logo shown in the header, footer and sign-in pages. Use a transparent PNG; defaults to the white Eagle Chair logo.')}
        </div>
      </Section>

      <Section icon={<Phone />} title="Contact details" description="Phone numbers and inboxes customers can reach.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Main phone" type="tel" {...field('primary_phone')} />
          <Input label="Main email" type="email" {...field('primary_email')} />
          <Input label="Sales phone" type="tel" {...field('sales_phone')} />
          <Input label="Sales email" type="email" {...field('sales_email')} />
          <Input label="Support phone" type="tel" {...field('support_phone')} />
          <Input label="Support email" type="email" {...field('support_email')} />
        </div>
      </Section>

      <Section icon={<MapPin />} title="Address">
        <Input label="Address line 1" {...field('address_line1')} />
        <Input label="Address line 2" helperText="Optional" {...field('address_line2')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="City" {...field('city')} />
          <Input label="State" {...field('state')} />
          <Input label="ZIP code" {...field('zip_code')} />
        </div>
        <Input label="Country" {...field('country')} placeholder="USA" />
      </Section>

      <Section icon={<Clock />} title="Business hours" description="Write each line as it should appear, e.g. “Monday – Friday: 8:00 AM – 5:00 PM”.">
        <Input label="Weekdays" placeholder="Monday – Friday: 8:00 AM – 5:00 PM" {...field('business_hours_weekdays')} />
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Saturday" placeholder="Saturday: Closed" {...field('business_hours_saturday')} />
          <Input label="Sunday" placeholder="Sunday: Closed" {...field('business_hours_sunday')} />
        </div>
      </Section>

      <Section icon={<Share2 />} title="Social media" description="Leave a field blank to hide that network.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Facebook" type="url" placeholder="https://facebook.com/…" {...field('facebook_url')} />
          <Input label="Instagram" type="url" placeholder="https://instagram.com/…" {...field('instagram_url')} />
          <Input label="LinkedIn" type="url" placeholder="https://linkedin.com/company/…" {...field('linkedin_url')} />
          <Input label="X (Twitter)" type="url" placeholder="https://x.com/…" {...field('twitter_url')} />
          <Input label="YouTube" type="url" placeholder="https://youtube.com/@…" {...field('youtube_url')} />
        </div>
      </Section>

      <Section icon={<Search />} title="Search engines" description="Default title and description for the homepage in Google results and link previews.">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="meta_title" className="text-sm font-medium text-dark-100">Homepage title</label>
            <CharCount value={formData.meta_title} max={60} />
          </div>
          <input id="meta_title" {...field('meta_title')} className={TEXTAREA_CLASS} />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="meta_description" className="text-sm font-medium text-dark-100">Homepage description</label>
            <CharCount value={formData.meta_description} max={160} />
          </div>
          <textarea id="meta_description" {...field('meta_description')} rows={3} className={`${TEXTAREA_CLASS} resize-y`} />
        </div>
        <Input label="Keywords" helperText="Comma-separated. Most search engines ignore these." {...field('meta_keywords')} />
      </Section>

      {/* Save bar: sticks to the bottom of the viewport while there are changes */}
      <div
        className={`sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur transition-all ${
          isDirty ? 'border-primary-500/40 bg-dark-800/95' : 'border-dark-600 bg-dark-800/80'
        }`}
      >
        <p className="text-sm" aria-live="polite">
          {isDirty
            ? <span className="font-medium text-amber-300">You have unsaved changes</span>
            : <span className="text-dark-200">All changes saved</span>}
        </p>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFormData(savedData); setFieldErrors({}); }} disabled={saving}>
              Discard
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default SiteSettingsManager;
