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
    <div className="inline-flex items-center gap-1 p-1 bg-dark-800 border border-dark-700 rounded-lg">
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === key
              ? 'bg-primary-600 text-white'
              : 'text-dark-300 hover:text-dark-100 hover:bg-dark-700'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
          {typeof count === 'number' && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded text-xs tabular-nums ${
                tab === key ? 'bg-white/20' : 'bg-dark-700 text-dark-400'
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
