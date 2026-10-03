import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import { useAuthStore } from '../../../store/authStore';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import {
  Package,
  FileText,
  Building2,
  Inbox,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  BookOpen,
  Tags,
  Settings as SettingsIcon,
  Mail,
  TrendingUp,
  PlusCircle,
} from 'lucide-react';

const QUOTE_STATUS_STYLES = {
  submitted: 'bg-primary-500/10 text-primary-400 ring-primary-500/25',
  under_review: 'bg-primary-500/10 text-primary-400 ring-primary-500/25',
  quoted: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
  accepted: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
  declined: 'bg-secondary-500/10 text-secondary-300 ring-secondary-500/25',
  expired: 'bg-secondary-500/10 text-secondary-300 ring-secondary-500/25',
};

const COMPANY_STATUS_STYLES = {
  pending: 'bg-primary-500/10 text-primary-400 ring-primary-500/25',
  active: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
};

const NEUTRAL_BADGE = 'bg-white/[0.05] text-dark-100 ring-white/10';

function StatusBadge({ status, styles }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset',
        styles[status] || NEUTRAL_BADGE
      )}
    >
      {status ? status.replace(/_/g, ' ') : 'unknown'}
    </span>
  );
}

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

const formatCurrency = (cents) =>
  cents
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
    : null;

const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n || 0);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function Panel({ title, icon: Icon, action, children, className }) {
  return (
    <section className={clsx('ec-card flex flex-col rounded-xl border', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-dark-50">
          {Icon && <Icon className="h-4 w-4 text-primary-500" aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function StatTile({ label, value, detail, icon: Icon, highlight, onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'ec-card group relative overflow-hidden rounded-xl border p-5 text-left transition-colors',
        'hover:border-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60'
      )}
    >
      {highlight && <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/70 to-transparent" aria-hidden="true" />}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-200">{label}</p>
        <Icon className={clsx('h-4 w-4', highlight ? 'text-primary-500' : 'text-dark-200')} aria-hidden="true" />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <p className="mt-2 font-serif text-[2rem] font-bold leading-none tabular-nums text-dark-50">{value}</p>
      )}
      <p className="mt-2 flex items-center gap-1 text-xs text-dark-200">
        {detail}
        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </p>
    </button>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.05]" />
    </div>
  );
}

function EmptyRow({ children }) {
  return <p className="px-5 py-10 text-center text-sm text-dark-200">{children}</p>;
}

/**
 * Dashboard Overview — the admin home: headline numbers, what needs a
 * response, recent activity and shortcuts.
 */
const DashboardOverview = ({ onNavigate, inquiryUnread = 0 }) => {
  const { refreshKeys } = useAdminRefresh();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    apiClient.get('/api/v1/admin/dashboard/stats')
      .then((response) => { if (!cancelled) setStats(response); })
      .catch((err) => {
        console.error('Failed to fetch stats:', err);
        if (!cancelled) setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKeys.overview]);

  const pendingQuotes = stats?.pending_quotes || 0;
  const pendingCompanies = stats?.pending_companies || 0;
  const potentialRevenue = formatCurrency(stats?.potential_revenue);

  const statTiles = [
    {
      label: 'Quotes to review',
      value: formatNumber(pendingQuotes),
      detail: `${formatNumber(stats?.total_quotes)} quotes all time`,
      icon: FileText,
      highlight: pendingQuotes > 0,
      section: 'quotes',
    },
    {
      label: 'Open quote value',
      value: potentialRevenue || '$0',
      detail: `${formatNumber(stats?.accepted_quotes)} accepted`,
      icon: TrendingUp,
      section: 'quotes',
    },
    {
      label: 'Active companies',
      value: formatNumber(stats?.active_companies),
      detail: `${formatNumber(stats?.total_companies)} registered`,
      icon: Building2,
      highlight: pendingCompanies > 0,
      section: 'companies',
    },
    {
      label: 'Products',
      value: formatNumber(stats?.active_products),
      detail: `${formatNumber(stats?.total_products)} in catalog`,
      icon: Package,
      section: 'catalog',
    },
  ];

  const attention = [
    pendingQuotes > 0 && {
      id: 'quotes',
      icon: FileText,
      text: `${pendingQuotes} quote ${pendingQuotes === 1 ? 'request is' : 'requests are'} waiting for review`,
      cta: 'Review quotes',
    },
    inquiryUnread > 0 && {
      id: 'inquiries',
      icon: Inbox,
      text: `${inquiryUnread} unread ${inquiryUnread === 1 ? 'inquiry' : 'inquiries'} from the contact form`,
      cta: 'Open inbox',
    },
    pendingCompanies > 0 && {
      id: 'companies',
      icon: Building2,
      text: `${pendingCompanies} ${pendingCompanies === 1 ? 'company is' : 'companies are'} awaiting account approval`,
      cta: 'Review accounts',
    },
  ].filter(Boolean);

  const shortcuts = [
    { id: 'catalog', label: 'Product Catalog', hint: 'Edit products & variations', icon: Package },
    { id: 'catalog-builder', label: 'Catalog Builder', hint: 'Lay out printed catalogs', icon: BookOpen },
    { id: 'categories', label: 'Categories', hint: 'Organize the storefront', icon: Tags },
    { id: 'emails', label: 'Email Templates', hint: 'Customer notifications', icon: Mail },
    { id: 'analytics', label: 'Analytics', hint: 'Demand & popular products', icon: TrendingUp },
    { id: 'settings', label: 'Site Settings', hint: 'Branding, contact, SEO', icon: SettingsIcon },
  ];

  const recentQuotes = Array.isArray(stats?.recent_quotes) ? stats.recent_quotes : [];
  const recentCompanies = Array.isArray(stats?.recent_companies) ? stats.recent_companies : [];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow={today}
        title={`${greeting()}${user?.firstName ? `, ${user.firstName}` : ''}`}
        description="Where things stand across quotes, dealer accounts and the catalog."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('quotes')} className="border border-white/[0.08]">
              All quotes
            </Button>
            <Button size="sm" icon={PlusCircle} onClick={() => onNavigate('catalog')}>
              Add product
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-secondary-500/30 bg-secondary-500/10 px-4 py-3 text-sm text-secondary-200">
          Couldn&apos;t load dashboard numbers. Refresh the page to try again.
        </div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((tile) => (
          <StatTile key={tile.label} {...tile} loading={loading} onClick={() => onNavigate(tile.section)} />
        ))}
      </div>

      {/* Needs attention */}
      {!loading && !error && (
        <section aria-label="Needs attention" className="ec-card overflow-hidden rounded-xl border">
          {attention.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {attention.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10 ring-1 ring-inset ring-primary-500/25">
                      <Icon className="h-4 w-4 text-primary-400" aria-hidden="true" />
                    </span>
                    <p className="flex-1 text-sm text-dark-50">{item.text}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary-400 hover:text-primary-300 sm:self-auto"
                    >
                      {item.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-5 py-4 text-sm text-dark-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              You&apos;re all caught up. No quotes, inquiries or accounts are waiting on you.
            </div>
          )}
        </section>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Panel
          title="Recent quote requests"
          icon={FileText}
          className="xl:col-span-3"
          action={
            <button type="button" onClick={() => onNavigate('quotes')} className="inline-flex items-center gap-1 text-xs font-medium text-dark-200 hover:text-dark-50">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
        >
          {loading ? (
            <div className="divide-y divide-white/[0.06]">{[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}</div>
          ) : recentQuotes.length === 0 ? (
            <EmptyRow>No quote requests yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentQuotes.map((quote) => {
                const amount = formatCurrency(quote.quoted_price || quote.total_amount);
                return (
                  <li key={quote.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('quotes')}
                      className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-2 truncate text-sm">
                          <span className="font-medium text-dark-50">{quote.company_name || 'Unknown company'}</span>
                          <span className="font-mono text-[11px] text-dark-200">#{quote.quote_number}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-dark-200">
                          {[quote.project_name, formatDate(quote.created_at)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {amount && <span className="hidden text-sm tabular-nums text-dark-100 sm:block">{amount}</span>}
                      <StatusBadge status={quote.status} styles={QUOTE_STATUS_STYLES} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="New dealer accounts"
          icon={Building2}
          className="xl:col-span-2"
          action={
            <button type="button" onClick={() => onNavigate('companies')} className="inline-flex items-center gap-1 text-xs font-medium text-dark-200 hover:text-dark-50">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
        >
          {loading ? (
            <div className="divide-y divide-white/[0.06]">{[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}</div>
          ) : recentCompanies.length === 0 ? (
            <EmptyRow>No companies have registered yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentCompanies.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('companies')}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-dark-50">
                      {(company.company_name || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-dark-50">{company.company_name || 'Unknown company'}</p>
                      <p className="truncate text-xs text-dark-200">
                        {[company.rep_email, company.created_at && `Joined ${formatDate(company.created_at)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusBadge status={company.status} styles={COMPANY_STATUS_STYLES} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Shortcuts */}
      <section aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading" className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-200">
          Shortcuts
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onNavigate(s.id)}
                className="ec-card group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors hover:border-primary-500/40"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] transition-colors group-hover:bg-primary-500/10 group-hover:ring-primary-500/25">
                  <Icon className="h-[18px] w-[18px] text-dark-100 transition-colors group-hover:text-primary-400" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-dark-50">{s.label}</span>
                  <span className="block truncate text-xs text-dark-200">{s.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-dark-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-400" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
    </AdminPage>
  );
};

export default DashboardOverview;
