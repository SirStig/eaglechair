import { useState } from 'react';
import { ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { ADMIN_NAV } from '../adminNav';
import { useSiteSettings } from '../../../hooks/useContent';

function SidebarBrand({ collapsed }) {
  const { data: siteSettings } = useSiteSettings();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = siteSettings?.logoDarkUrl;
  const showWordmark = !collapsed && logoUrl && !logoFailed;

  return (
    <div className={clsx('flex h-16 flex-shrink-0 items-center border-b border-white/[0.06]', collapsed ? 'px-5 md:justify-center md:px-2' : 'px-5')}>
      {showWordmark ? (
        <img
          src={logoUrl}
          alt={siteSettings?.companyName || 'Eagle Chair'}
          className="h-8 w-auto max-w-[180px] object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/web-app-manifest-192x192.png" alt="Eagle Chair" className="h-8 w-8 flex-shrink-0 rounded" />
          <span className={clsx('truncate font-serif text-lg font-bold text-dark-50', collapsed && 'md:hidden')}>Eagle Chair</span>
        </div>
      )}
    </div>
  );
}

/**
 * Admin sidebar: brand, grouped navigation with a gold active rail, and a
 * footer with the live-site link and collapse toggle (desktop only).
 * Permanently pinned from md up (icon rail when `collapsed`); a slide-out
 * drawer on phones.
 */
export default function AdminSidebar({
  activeSection,
  badges = {},
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onNavigate,
  bottomPadding,
}) {
  return (
    <aside
      aria-label="Admin navigation"
      className={clsx(
        // Always fixed (never sticky): an overflow ancestor would make sticky scroll away with the page
        'fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-white/[0.06] bg-dark-950 pt-safe',
        'transition-[width,transform] duration-300 ease-out md:z-40',
        bottomPadding && 'pb-nav-spacer',
        collapsed && 'md:w-[4.5rem]',
        mobileOpen ? 'translate-x-0 shadow-2xl shadow-black/60' : '-translate-x-full md:translate-x-0'
      )}
    >
      <SidebarBrand collapsed={collapsed} />

      <nav className="admin-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.id} className="mb-5 last:mb-0">
            {collapsed && <div className="mx-auto mb-2 hidden h-px w-6 bg-white/[0.08] md:block" aria-hidden="true" />}
            <p
              className={clsx(
                'mb-1.5 px-3 font-sans text-[10.5px] font-semibold uppercase tracking-[0.16em] text-dark-200',
                collapsed && 'md:sr-only'
              )}
            >
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const badge = badges[item.id] || 0;
                return (
                  <li key={item.id}>
                    <a
                      href={item.path}
                      onClick={(e) => {
                        // Let modified clicks open a new tab as usual
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        onNavigate(item.path, item.id);
                      }}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        'group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70',
                        collapsed && 'md:justify-center md:px-0',
                        isActive
                          ? 'bg-white/[0.07] text-dark-50'
                          : 'text-dark-100 hover:bg-white/[0.04] hover:text-dark-50'
                      )}
                    >
                      {isActive && (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-primary-500" aria-hidden="true" />
                      )}
                      <span className="relative flex-shrink-0">
                        <Icon
                          className={clsx(
                            'h-[18px] w-[18px] transition-colors',
                            isActive ? 'text-primary-500' : 'text-dark-200 group-hover:text-dark-50'
                          )}
                          aria-hidden="true"
                        />
                        {badge > 0 && collapsed && (
                          <span className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-primary-500 md:block" aria-hidden="true" />
                        )}
                      </span>
                      <span className={clsx('truncate', collapsed && 'md:sr-only')}>{item.label}</span>
                      {badge > 0 && (
                        <span
                          className={clsx(
                            'ml-auto rounded-full bg-primary-500 px-1.5 py-0.5 text-[10.5px] font-bold leading-none tabular-nums text-dark-950',
                            collapsed && 'md:hidden'
                          )}
                        >
                          {badge > 99 ? '99+' : badge}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex-shrink-0 space-y-0.5 border-t border-white/[0.06] p-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'View live site' : undefined}
          className={clsx(
            'flex h-9 items-center gap-3 rounded-md px-3 text-[13px] text-dark-100 transition-colors hover:bg-white/[0.04] hover:text-dark-50',
            collapsed && 'md:justify-center md:px-0'
          )}
        >
          <ExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className={clsx(collapsed && 'md:sr-only')}>View live site</span>
        </a>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'hidden h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] text-dark-100 transition-colors hover:bg-white/[0.04] hover:text-dark-50 lg:flex',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
