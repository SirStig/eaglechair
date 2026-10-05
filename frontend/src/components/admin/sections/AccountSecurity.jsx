import { ShieldCheck } from 'lucide-react';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

// Placeholder - replaced by the Account & Security page (password, devices)
const AccountSecurity = () => (
  <AdminPage width="default">
    <AdminPageHeader eyebrow="Account" title="Account & Security" icon={ShieldCheck} />
  </AdminPage>
);

export default AccountSecurity;
