import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { useAdminPermissions, PERMISSIONS } from '../../hooks/useAdminPermissions';

/**
 * "History" link to the activity log filtered to one record. Only shown to
 * admins who can view the log.
 */
export default function RecordHistoryLink({ resourceType, resourceId, className = '' }) {
  const { can } = useAdminPermissions();
  if (!resourceId || !can(PERMISSIONS.VIEW_AUDIT)) return null;
  return (
    <Link
      to={`/admin/activity?resource_type=${encodeURIComponent(resourceType)}&resource_id=${resourceId}`}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm text-dark-100 transition-colors hover:bg-dark-700 hover:text-dark-50 ${className}`}
      title="See who changed this and when"
    >
      <History className="h-4 w-4" aria-hidden="true" /> History
    </Link>
  );
}
