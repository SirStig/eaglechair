import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import { useAuthStore } from '../../../store/authStore';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import { Delta, EmptyRow, RankedList, Sparkline } from '../analyticsUi';
import { RESOURCE_TYPE_LABELS, formatNumber } from '../analyticsFormat';
import {
  Package,
  FileText,
  Inbox,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Tags,
  Settings as SettingsIcon,
  TrendingUp,
  PlusCircle,
  Users,
  Eye,
  Download,
  Search,
} from 'lucide-react';

const QUOTE_STATUS_STYLES = {
  submitted: 'bg-primary-500/10 text-primary-400 ring-primary-500/25',
  under_review: 'bg-primary-500/10 text-primary-400 ring-primary-500/25',
  quoted: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
  accepted: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
  declined: 'bg-secondary-500/10 text-secondary-300 ring-secondary-500/25',
  expired: 'bg-secondary-500/10 text-secondary-300 ring-secondary-500/25',
};

const NEUTRAL_BADGE = 'bg-white/[0.05] text-dark-100 ring-white/10';

// Engagement first: accounts are off and nothing is sold online, so traffic
// and interest in products/documents are the numbers that matter day to day
const TRAFFIC_TILES = [
  { key: 'visitors', label: 'Visitors', icon: Users },
  { key: 'page_views', label: 'Page views', icon: Eye },
  { key: 'product_views', label: 'Product views', icon: Package },
  { key: 'downloads', label: 'Downloads', icon: Download },
];

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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function Panel({ title, icon: Icon, subtitle, action, children, className }) {
  return (
    <section className={clsx('ec-card flex min-w-0 flex-col rounded-xl border', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-dark-50">
            {Icon && <Icon className="h-4 w-4 text-primary-500" aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-dark-200">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function ViewAll({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-dark-200 hover:text-dark-50">
      View all <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function TrafficTile({ tile, value, previous, trend, loading, onClick }) {
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="ec-card group flex flex-col rounded-xl border p-4 text-left transition-colors hover:border-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-200">{tile.label}</p>
        <Icon className="h-4 w-4 text-dark-200 transition-colors group-hover:text-primary-500" aria-hidden="true" />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <p className="mt-2 font-serif text-[2rem] font-bold leading-none tabular-nums text-dark-50">{formatNumber(value)}</p>
      )}
      <div className="mt-2 min-h-[16px]">
        {!loading && <Delta current={value || 0} previous={previous || 0} suffix="vs prior 24h" />}
      </div>
      <Sparkline values={trend} className="mt-3" />
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

const Skeletons = () => (
  <div className="divide-y divide-white/[0.06]">
    {[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}
  </div>
);

/**
 * Dashboard Overview — the admin home: site traffic over the last day, which
 * products and documents people are interested in, and what needs a response.
 */
const DashboardOverview = ({ onNavigate, inquiryUnread = 0 }) => {
  const { refreshKeys } = useAdminRefresh();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [day, setDay] = useState(null);
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    Promise.allSettled([
      apiClient.get('/api/v1/admin/dashboard/stats'),
      apiClient.get('/api/v1/admin/dashboard/analytics/traffic?days=1&limit=5'),
      apiClient.get('/api/v1/admin/dashboard/analytics/traffic?days=7&limit=5'),
    ]).then(([statsRes, dayRes, weekRes]) => {
      if (cancelled) return;
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (dayRes.status === 'fulfilled') setDay(dayRes.value);
      if (weekRes.status === 'fulfilled') setWeek(weekRes.value);
      const failed = [statsRes, dayRes, weekRes].filter((r) => r.status === 'rejected');
      failed.forEach((r) => console.error('Failed to fetch dashboard data:', r.reason));
      setError(failed.length > 0);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKeys.overview]);

  const pendingQuotes = stats?.pending_quotes || 0;

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
  ].filter(Boolean);

  const shortcuts = [
    { id: 'analytics', label: 'Analytics', hint: 'Traffic, products & downloads', icon: TrendingUp },
    { id: 'catalog', label: 'Product Catalog', hint: 'Edit products & variations', icon: Package },
    { id: 'catalog-builder', label: 'Catalog Builder', hint: 'Lay out printed catalogs', icon: BookOpen },
    { id: 'categories', label: 'Categories', hint: 'Organize the storefront', icon: Tags },
    { id: 'inquiries', label: 'Inquiries', hint: 'Contact form messages', icon: Inbox },
    { id: 'settings', label: 'Site Settings', hint: 'Branding, contact, SEO', icon: SettingsIcon },
  ];

  const recentQuotes = Array.isArray(stats?.recent_quotes) ? stats.recent_quotes : [];
  const trend = (key) => (week?.timeseries || []).map((d) => d[key] || 0);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow={today}
        title={`${greeting()}${user?.firstName ? `, ${user.firstName}` : ''}`}
        description="How the site is doing, what people are looking at, and what needs a response."
        actions={
          <>
            {day && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-dark-100 ring-1 ring-inset ring-white/10">
                <span className={clsx('inline-flex h-2 w-2 rounded-full', day.active_now > 0 ? 'bg-emerald-400' : 'bg-dark-300')} />
                <span className="font-semibold tabular-nums text-dark-50">{day.active_now}</span> on the site now
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => onNavigate('analytics')} className="border border-white/[0.08]">
              Full analytics
            </Button>
            <Button size="sm" icon={PlusCircle} onClick={() => onNavigate('catalog')}>
              Add product
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-secondary-500/30 bg-secondary-500/10 px-4 py-3 text-sm text-secondary-200">
          Some dashboard numbers couldn&apos;t be loaded. Refresh the page to try again.
        </div>
      )}

      {/* Last 24 hours, with a 7-day trend under each number */}
      <section aria-labelledby="traffic-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="traffic-heading" className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-200">
            Last 24 hours
          </h2>
          <span className="text-[11px] text-dark-300">Trend: last 7 days</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {TRAFFIC_TILES.map((tile) => (
            <TrafficTile
              key={tile.key}
              tile={tile}
              value={day?.totals?.[tile.key]}
              previous={day?.previous?.[tile.key]}
              trend={trend(tile.key)}
              loading={loading}
              onClick={() => onNavigate('analytics')}
            />
          ))}
        </div>
      </section>

      {/* Needs attention */}
      {!loading && stats && (
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
              You&apos;re all caught up. No quote requests or inquiries are waiting on you.
            </div>
          )}
        </section>
      )}

      {/* What people are interested in */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Panel
          title="Trending products"
          subtitle="Most viewed, last 7 days"
          icon={Package}
          className="xl:col-span-3"
          action={<ViewAll onClick={() => onNavigate('analytics')} />}
        >
          {loading ? (
            <Skeletons />
          ) : !week?.top_products?.length ? (
            <EmptyRow>No product views yet this week.</EmptyRow>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {week.top_products.map((p, i) => {
                const image = p.image_url ? resolveImageUrl(p.image_url) : null;
                return (
                  <li key={p.product_id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-4 flex-shrink-0 text-right text-xs tabular-nums text-dark-300">{i + 1}</span>
                    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
                      {image && <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-dark-50">{p.name}</p>
                      <p className="truncate text-xs text-dark-200">
                        {[p.model_number && `#${p.model_number}`, p.downloads > 0 && `${formatNumber(p.downloads)} downloads`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums text-dark-50">{formatNumber(p.views)}</span>
                      <span className="block text-[11px] text-dark-200">views</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Top downloads"
          subtitle="Last 7 days"
          icon={Download}
          className="xl:col-span-2"
          action={<ViewAll onClick={() => onNavigate('analytics')} />}
        >
          {loading ? (
            <Skeletons />
          ) : (
            <RankedList
              valueLabel="downloads"
              empty="Nothing downloaded yet this week."
              rows={(week?.top_downloads || []).map((d) => ({
                key: d.resource_url || d.label,
                label: d.label || d.resource_url,
                sublabel: RESOURCE_TYPE_LABELS[d.resource_type] || 'Document',
                value: d.downloads,
              }))}
            />
          )}
        </Panel>
      </div>

      {/* Quotes and searches */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Panel
          title="Recent quote requests"
          icon={FileText}
          className="xl:col-span-3"
          action={<ViewAll onClick={() => onNavigate('quotes')} />}
        >
          {loading ? (
            <Skeletons />
          ) : recentQuotes.length === 0 ? (
            <EmptyRow>No quote requests yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentQuotes.map((quote) => (
                <li key={quote.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('quotes')}
                    className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 truncate text-sm">
                        <span className="font-medium text-dark-50">{quote.company_name || 'Guest request'}</span>
                        <span className="font-mono text-[11px] text-dark-200">#{quote.quote_number}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-dark-200">
                        {[quote.project_name, formatDate(quote.created_at)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusBadge status={quote.status} styles={QUOTE_STATUS_STYLES} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="What people search for" subtitle="Last 7 days" icon={Search} className="xl:col-span-2">
          {loading ? (
            <Skeletons />
          ) : (
            <RankedList
              valueLabel="searches"
              empty="No site searches yet this week."
              rows={(week?.top_searches || []).map((s) => ({ key: s.query, label: `“${s.query}”`, value: s.searches }))}
            />
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
