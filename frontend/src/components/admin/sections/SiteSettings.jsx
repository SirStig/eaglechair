import Card from '../../ui/Card';
import SiteSettingsManager from '../SiteSettingsManager';

const SiteSettings = () => {
  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold text-dark-50">Site Settings</h2>
      <SiteSettingsManager />
    </div>
  );
};

export default SiteSettings;
