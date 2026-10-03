import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, LogOut, Menu, MessageSquare, Search, ShieldCheck, X } from 'lucide-react';
import { clsx } from 'clsx';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function initialsFor(user) {
  const first = user?.firstName?.[0] || user?.username?.[0] || 'A';
  const last = user?.lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

function formatRole(role) {
  if (!role) return 'Administrator';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Admin';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-white/[0.05] md:pr-2.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-bold text-dark-950">
          {initialsFor(user)}
        </span>
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium leading-tight text-dark-50">{displayName}</span>
          <span className="block text-[11px] leading-tight text-dark-200">{formatRole(user?.role)}</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-white/[0.08] bg-dark-800 shadow-2xl shadow-black/60"
        >
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="truncate text-sm font-medium text-dark-50">{displayName}</p>
            {user?.email && <p className="truncate text-xs text-dark-200">{user.email}</p>}
          </div>
          <div className="p-1.5">
            <Link
              role="menuitem"
              to="/admin/setup-security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-dark-100 hover:bg-white/[0.05] hover:text-dark-50"
            >
              <ShieldCheck className="h-4 w-4" /> Account security
            </Link>
            <a
              role="menuitem"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-dark-100 hover:bg-white/[0.05] hover:text-dark-50"
            >
              <ExternalLink className="h-4 w-4" /> View live site
            </a>
          </div>
          <div className="border-t border-white/[0.06] p-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-dark-100 hover:bg-secondary-600/15 hover:text-secondary-300"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Admin top bar: breadcrumb trail, admin search (⌘K), and the account menu.
 * Page titles live in each section's header, not here.
 */
export default function AdminTopbar({ crumbs, mobileMenuOpen, onToggleMobileMenu, onOpenSearch, onOpenAI, user, onLogout }) {
  return (
    <header className="sticky top-safe z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/[0.06] bg-dark-900/85 px-3 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onToggleMobileMenu}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-dark-50 hover:bg-white/[0.05] lg:hidden"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className={clsx('flex min-w-0 items-center gap-1.5', !last && 'hidden sm:flex')}>
                {crumb.onClick && !last ? (
                  <button type="button" onClick={crumb.onClick} className="truncate text-dark-200 hover:text-dark-50">
                    {crumb.label}
                  </button>
                ) : (
                  <span className={clsx('truncate', last ? 'font-medium text-dark-50' : 'text-dark-200')} aria-current={last ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!last && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-dark-300" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-dark-200 transition-colors hover:border-white/[0.14] hover:text-dark-50 sm:w-56 lg:w-64"
          aria-label="Search admin"
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="hidden flex-1 text-left sm:inline">Jump to…</span>
          <kbd className="hidden rounded border border-white/[0.1] px-1.5 py-0.5 font-sans text-[10.5px] text-dark-200 sm:inline">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        {onOpenAI && (
          <button
            type="button"
            onClick={onOpenAI}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-chat-button px-3 text-xs font-semibold text-dark-950 hover:bg-chat-button-hover"
            title="AI Assistant"
          >
            <MessageSquare className="h-4 w-4" /> AI
          </button>
        )}

        <div className="hidden h-6 w-px bg-white/[0.08] sm:block" aria-hidden="true" />
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
