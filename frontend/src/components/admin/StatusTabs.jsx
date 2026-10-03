import { Archive, CheckCircle2 } from 'lucide-react';

/**
 * Active / Archived tab toggle used across catalog admin list pages.
 * Archived = soft-deleted (is_active: false) items, kept out of the main list.
 */
const StatusTabs = ({ tab, onChange, activeCount, archivedCount }) => {
  const tabs = [
    { key: 'active', label: 'Active', icon: CheckCircle2, count: activeCount },
    { key: 'archived', label: 'Archived', icon: Archive, count: archivedCount },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-dark-950/60 p-1" role="tablist">
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-3.5 ${
            tab === key
              ? 'bg-white/[0.08] text-dark-50 shadow-sm'
              : 'text-dark-200 hover:bg-white/[0.04] hover:text-dark-50'
          }`}
        >
          <Icon className={`h-4 w-4 ${tab === key ? 'text-primary-500' : ''}`} />
          {label}
          {typeof count === 'number' && (
            <span
              className={`ml-0.5 rounded px-1.5 py-0.5 text-xs tabular-nums ${
                tab === key ? 'bg-primary-500/15 text-primary-300' : 'bg-white/[0.05] text-dark-200'
              }`}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default StatusTabs;
