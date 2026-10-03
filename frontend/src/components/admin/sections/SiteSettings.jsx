import SiteSettingsManager from '../SiteSettingsManager';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

const SiteSettings = () => (
  <AdminPage width="default">
    <AdminPageHeader
      eyebrow="System"
      title="Site Settings"
      description="Company details shown in the header, footer and contact page. Changes go live when you save."
    />
    <SiteSettingsManager />
  </AdminPage>
);

export default SiteSettings;
