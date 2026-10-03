import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  BookOpen,
  Download,
  Eye,
  FileText,
  Filter,
  Globe,
  Mail,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  Package,
  Palette,
  RefreshCw,
  Search,
  ShoppingCart,
  Target,
  Users,
  X,
} from 'lucide-react';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import ProductAnalyticsPanel from '../ProductAnalyticsPanel';
import { CsvButton, Delta, EmptyRow, Funnel, Panel, RankedList, Segmented } from '../analyticsUi';
import {
  INTERACTION_LABELS,
  MATERIAL_TYPE_LABELS,
  missingFilesPhrase,
  RESOURCE_TYPE_LABELS,
  countryName,
  formatDuration,
  formatNumber,
  pageTitle,
} from '../analyticsFormat';

const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

// KPI tiles double as the chart's metric selector: one series at a time
const METRICS = [
  { key: 'visitors', label: 'Visitors', icon: Users, hint: 'Unique browsers' },
  { key: 'page_views', label: 'Page views', icon: Eye, hint: 'All public pages' },
  { key: 'product_views', label: 'Product views', icon: Package, hint: 'Product detail pages' },
  { key: 'downloads', label: 'Downloads', icon: Download, hint: 'Files & documents' },
  { key: 'cart_adds', label: 'Added to quote', icon: ShoppingCart, hint: 'Quote cart adds' },
];

const DEVICE_LABELS = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', unknown: 'Unknown' };

const GOLD = '#f4a52d';

// Series dates are UTC calendar days ("YYYY-MM-DD"); show them as-is
const parseDay = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDay = (value, opts = { month: 'short', day: 'numeric' }) =>
  parseDay(value).toLocaleDateString('en-US', opts);

function ChartTooltip({ active, payload, label, metricLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-dark-900/95 px-3 py-2 shadow-xl">
      <p className="text-xs text-dark-200">{formatDay(label, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      <p className="mt-0.5 text-sm font-semibold text-dark-50">
        {formatNumber(payload[0].value)} <span className="font-normal text-dark-100">{metricLabel.toLowerCase()}</span>
      </p>
    </div>
  );
}

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-dark-100 ring-1 ring-inset ring-white/10 transition-colors hover:text-dark-50 disabled:opacity-50';

/** Side sheet with one product's analytics. */
function ProductDrawer({ product, days, onClose }) {
  useEffect(() => {
    if (!product) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [product, onClose]);
  if (!product) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${product.name} activity`}>
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative flex h-full w-full max-w-4xl flex-col overflow-y-auto border-l border-white/10 bg-[#121212] p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-200">Product activity</p>
            <h2 className="truncate font-serif text-xl font-bold text-dark-50">{product.name}</h2>
            {product.model_number && <p className="text-xs text-dark-200">#{product.model_number}</p>}
          </div>
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ProductAnalyticsPanel productId={product.product_id} initialDays={days} />
      </div>
    </div>
  );
}

/** Preview of the weekly staff email, with a "send me a test" button. */
function DigestModal({ onClose }) {
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiClient
      .get('/api/v1/admin/dashboard/analytics/digest/preview')
      .then(setPreview)
      .catch(() => setStatus({ ok: false, text: 'The preview could not be loaded.' }));
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sendTest = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await apiClient.post('/api/v1/admin/dashboard/analytics/digest/send');
      setStatus({ ok: true, text: `Sent to ${res.sent_to}.` });
    } catch (err) {
      setStatus({ ok: false, text: err?.response?.data?.detail || 'The email could not be sent.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Weekly email">
      <button type="button" className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Close" />
      <div className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121212] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="font-sans text-base font-semibold text-dark-50">Weekly analytics email</h2>
            <p className="mt-0.5 text-xs text-dark-200">
              {preview ? `${preview.enabled ? preview.schedule : 'Turned off'} · to ${preview.recipients.join(', ')}` : 'Loading…'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-dark-200 hover:text-dark-50" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-white">
          {preview ? (
            <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[60vh] w-full border-0" />
          ) : (
            <div className="flex h-[60vh] items-center justify-center bg-[#121212]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
          <p className={clsx('text-xs', status ? (status.ok ? 'text-emerald-300' : 'text-secondary-300') : 'text-dark-200')}>
            {status?.text || 'Recipients and schedule are set on the server (ANALYTICS_DIGEST_* settings).'}
          </p>
          <button
            type="button"
            onClick={sendTest}
            disabled={sending || !preview}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-500 px-4 text-xs font-semibold text-dark-900 transition-colors hover:bg-primary-400 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {sending ? 'Sending…' : 'Send me a test'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page rows for RankedList: real page name, linked, with time-on-page detail. */
const pageRows = (rows, valueKey) =>
  rows.map((p) => {
    const detail = [
      p.visitors !== undefined && `${formatNumber(p.visitors)} visitor${p.visitors === 1 ? '' : 's'}`,
      p.avg_seconds ? `avg ${formatDuration(p.avg_seconds)}` : null,
      p.avg_depth ? `${p.avg_depth}% scrolled` : null,
    ].filter(Boolean);
    return {
      key: p.path,
      label: pageTitle(p),
      href: p.path,
      sublabel: detail.length ? detail.join(' · ') : p.path,
      value: p[valueKey],
    };
  });

const PAGE_VIEWS = {
  top: { key: 'top_pages', subtitle: 'Most viewed', value: 'views' },
  entry: { key: 'entry_pages', subtitle: 'Where visits start', value: 'sessions' },
  exit: { key: 'exit_pages', subtitle: 'Where visits end', value: 'sessions' },
};

const Analytics = () => {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('visitors');
  const [includeStaff, setIncludeStaff] = useState(false);
  const [pagesView, setPagesView] = useState('top');
  const [searchView, setSearchView] = useState('all');
  const [locationView, setLocationView] = useState('countries');
  const [leadsView, setLeadsView] = useState('reps');
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [showDigest, setShowDigest] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    // Only the latest request may write state, so fast range switching can't
    // let a slow, stale response overwrite fresher data
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/api/v1/admin/dashboard/analytics/traffic?days=${days}&limit=10&include_staff=${includeStaff}`
      );
      if (requestId === requestIdRef.current) setData(res);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      if (requestId === requestIdRef.current) setError('Analytics could not be loaded. Try refreshing.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [days, includeStaff]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDrawer = useCallback(() => setDrawerProduct(null), []);
  const closeDigest = useCallback(() => setShowDigest(false), []);

  const totals = data?.totals || {};
  const previous = data?.previous || {};
  const activeMetric = METRICS.find((m) => m.key === metric);
  const hasAnyData = (totals.page_views || 0) + (totals.product_views || 0) + (totals.downloads || 0) > 0;
  const rangeLabel = days === 365 ? 'last 12 months' : `last ${days} days`;
  const stamp = `last-${days}-days`;
  const gaps = data?.content_gaps;
  const weights = data?.interest_weights;
  const pageView = PAGE_VIEWS[pagesView];
  const pagesData = data?.[pageView.key] || [];
  const searchData = (searchView === 'all' ? data?.top_searches : data?.zero_result_searches) || [];

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Overview"
        title="Analytics"
        description="Who's visiting the site, what they look at and download, and how they get to a quote request."
        actions={
          <>
            {data && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-dark-100 ring-1 ring-inset ring-white/10">
                <span className="relative flex h-2 w-2">
                  {data.active_now > 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  )}
                  <span className={clsx('relative inline-flex h-2 w-2 rounded-full', data.active_now > 0 ? 'bg-emerald-400' : 'bg-dark-300')} />
                </span>
                <span className="font-semibold tabular-nums text-dark-50">{data.active_now}</span> active now
              </span>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10" role="group" aria-label="Date range">
              {RANGES.map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setDays(range.days)}
                  aria-pressed={days === range.days}
                  className={clsx(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    days === range.days ? 'bg-primary-500 text-dark-900' : 'text-dark-100 hover:text-dark-50'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIncludeStaff((v) => !v)}
              aria-pressed={includeStaff}
              title="Include visits from browsers logged into this admin panel"
              className={clsx(
                'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset transition-colors',
                includeStaff ? 'bg-primary-500/15 text-primary-300 ring-primary-500/40' : 'bg-white/[0.04] text-dark-100 ring-white/10 hover:text-dark-50'
              )}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Staff visits
            </button>
            <button type="button" onClick={() => setShowDigest(true)} className={iconButton} aria-label="Weekly email" title="Weekly email">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={load} disabled={loading} className={iconButton} aria-label="Refresh analytics">
              <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-secondary-500/30 bg-secondary-500/10 px-4 py-3 text-sm text-secondary-200">{error}</div>
      )}

      {!data && loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
        </div>
      ) : data ? (
        <div className={clsx('space-y-6 transition-opacity', loading && 'opacity-60')}>
          {/* Staff traffic is recorded but left out unless asked for */}
          {data.include_staff ? (
            <div className="rounded-lg border border-primary-500/25 bg-primary-500/[0.06] px-4 py-2.5 text-sm text-dark-100">
              Including staff visits: browsing by anyone logged into the admin panel is counted in every number below.
            </div>
          ) : data.staff_events_excluded > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-dark-100">
              <span>
                {formatNumber(data.staff_events_excluded)} {data.staff_events_excluded === 1 ? 'action' : 'actions'} by logged-in admins in
                this period {data.staff_events_excluded === 1 ? "isn't" : "aren't"} counted.
              </span>
              <button type="button" onClick={() => setIncludeStaff(true)} className="text-xs font-semibold text-primary-400 hover:text-primary-300">
                Include them
              </button>
            </div>
          ) : null}

          {!hasAnyData && (
            <div className="rounded-xl border border-primary-500/20 bg-primary-500/[0.06] px-5 py-4 text-sm text-dark-100">
              <p className="font-semibold text-dark-50">No visits recorded for the {rangeLabel} yet.</p>
              <p className="mt-1">
                Tracking is anonymous and first-party. Page views, product views, downloads, quote activity and searches show up here as
                people browse the public site. Bots, scanner traffic, 404s and logged-in admins aren&apos;t counted.
              </p>
            </div>
          )}

          {/* KPI tiles — click one to chart it */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {METRICS.map(({ key, label, icon, hint }) => {
              const Icon = icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  aria-pressed={metric === key}
                  className={clsx(
                    'ec-card rounded-xl border p-4 text-left transition-colors',
                    metric === key ? '!border-primary-500/60 ring-1 ring-primary-500/30' : 'hover:!border-white/15'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-dark-100">{label}</span>
                    <Icon className={clsx('h-4 w-4', metric === key ? 'text-primary-500' : 'text-dark-300')} aria-hidden="true" />
                  </div>
                  <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-dark-50 sm:text-[1.75rem]">{formatNumber(totals[key])}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
                    <Delta current={totals[key] || 0} previous={previous[key] || 0} />
                    <span className="hidden text-[11px] text-dark-300 2xl:inline">{hint}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trend */}
          <Panel
            title={`${activeMetric.label} per day`}
            subtitle={`${rangeLabel} · UTC days`}
            icon={activeMetric.icon}
            action={
              <CsvButton
                filename={`daily-traffic-${stamp}`}
                rows={data.timeseries}
                columns={[
                  { key: 'date', label: 'Date (UTC)' },
                  { key: 'visitors', label: 'Visitors' },
                  { key: 'page_views', label: 'Page views' },
                  { key: 'product_views', label: 'Product views' },
                  { key: 'downloads', label: 'Downloads' },
                  { key: 'cart_adds', label: 'Added to quote' },
                ]}
              />
            }
          >
            <div className="h-[260px] px-2 pb-3 pt-4 sm:h-[300px] sm:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeseries} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="analytics-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => formatDay(v)}
                    tick={{ fontSize: 11, fill: '#858585' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858585' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    content={<ChartTooltip metricLabel={activeMetric.label} />}
                    cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={GOLD}
                    strokeWidth={2}
                    fill="url(#analytics-fill)"
                    activeDot={{ r: 4, stroke: '#171717', strokeWidth: 2, fill: GOLD }}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.04] sm:grid-cols-3 xl:grid-cols-6">
              {[
                { label: 'Sessions', value: formatNumber(totals.sessions), cur: totals.sessions, prev: previous.sessions },
                { label: 'Pages / session', value: totals.pages_per_session || 0, cur: totals.pages_per_session, prev: previous.pages_per_session },
                { label: 'Bounce rate', value: `${totals.bounce_rate || 0}%`, cur: totals.bounce_rate, prev: previous.bounce_rate, invert: true },
                {
                  label: 'Time on page',
                  value: formatDuration(totals.avg_engaged_seconds),
                  cur: totals.avg_engaged_seconds,
                  prev: previous.avg_engaged_seconds,
                },
                { label: 'Scrolled', value: `${totals.avg_scroll_depth || 0}%`, cur: totals.avg_scroll_depth, prev: previous.avg_scroll_depth },
                { label: 'Quote requests', value: formatNumber(totals.quote_requests), cur: totals.quote_requests, prev: previous.quote_requests },
              ].map((s) => (
                <div key={s.label} className="bg-[#171717] px-5 py-3">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-dark-200">{s.label}</dt>
                  <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-lg font-semibold tabular-nums text-dark-50">{s.value}</span>
                    <Delta current={s.cur || 0} previous={s.prev || 0} invert={s.invert} />
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* The path to a quote, and what needs fixing */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Panel title="Path to a quote request" subtitle={`Sessions reaching each step · ${rangeLabel}`} icon={Target} className="lg:col-span-3">
              <Funnel steps={data.funnel} />
            </Panel>

            <Panel title="Worth a look" subtitle="Interest the site isn't serving yet" icon={AlertTriangle} className="lg:col-span-2">
              <div className="divide-y divide-white/[0.04]">
                <div className="px-5 py-3">
                  <p className="text-sm font-medium text-dark-50">
                    {formatNumber(gaps.missing_files_count)} viewed {gaps.missing_files_count === 1 ? 'product is' : 'products are'} missing
                    files
                  </p>
                  <p className="text-xs text-dark-200">No spec sheet, CAD file or line drawing to download.</p>
                </div>
                {gaps.missing_files.slice(0, 6).map((p) => (
                  <div key={p.product_id} className="flex items-center justify-between gap-3 px-5 py-2">
                    <button type="button" onClick={() => setDrawerProduct(p)} className="min-w-0 text-left">
                      <span className="block truncate text-sm text-dark-50 hover:text-primary-400">{p.name}</span>
                      <span className="block truncate text-xs text-dark-200">
                        No {missingFilesPhrase(p.missing)}
                      </span>
                    </button>
                    <span className="flex-shrink-0 text-xs tabular-nums text-dark-100">{formatNumber(p.views)} views</span>
                  </div>
                ))}
                <div className="px-5 py-3">
                  <p className="text-sm font-medium text-dark-50">
                    {formatNumber(gaps.never_viewed_count)} active {gaps.never_viewed_count === 1 ? 'product' : 'products'} with no views
                  </p>
                  {gaps.never_viewed.length > 0 && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-dark-200">
                      {gaps.never_viewed.map((p) => p.name).join(', ')}
                      {gaps.never_viewed_count > gaps.never_viewed.length && '…'}
                    </p>
                  )}
                </div>
                {data.zero_result_searches.length > 0 && (
                  <div className="px-5 py-3">
                    <p className="text-sm font-medium text-dark-50">
                      {formatNumber(totals.zero_result_searches)} {totals.zero_result_searches === 1 ? 'search' : 'searches'} found nothing
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-dark-200">
                      {data.zero_result_searches.map((s) => `“${s.query}”`).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Products */}
          <Panel
            title="Products with the most interest"
            subtitle={`Score = views ×${weights.views} + downloads ×${weights.downloads} + quote adds ×${weights.cart_adds} + quote requests ×${weights.quotes}`}
            icon={Package}
            action={
              <CsvButton
                filename={`products-${stamp}`}
                rows={data.top_products}
                columns={[
                  { key: 'name', label: 'Product' },
                  { key: 'model_number', label: 'Model' },
                  { key: 'views', label: 'Views' },
                  { key: 'visitors', label: 'Visitors' },
                  { key: 'downloads', label: 'Downloads' },
                  { key: 'cart_adds', label: 'Added to quote' },
                  { key: 'quotes', label: 'Quote requests' },
                  { key: 'interest_score', label: 'Interest score' },
                ]}
              />
            }
          >
            {data.top_products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-dark-200">
                      <th className="px-5 py-2.5 font-medium">Product</th>
                      <th className="px-3 py-2.5 text-right font-medium">Views</th>
                      <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Downloads</th>
                      <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Quote adds</th>
                      <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Quotes</th>
                      <th className="px-5 py-2.5 text-right font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.top_products.map((p, i) => {
                      const maxScore = data.top_products[0]?.interest_score || 1;
                      const image = p.image_url ? resolveImageUrl(p.image_url) : null;
                      return (
                        <tr key={p.product_id} className="hover:bg-white/[0.02]">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="w-4 flex-shrink-0 text-right text-xs tabular-nums text-dark-300">{i + 1}</span>
                              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
                                {image && <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => setDrawerProduct(p)}
                                  className="block max-w-full truncate text-left font-medium text-dark-50 hover:text-primary-400"
                                  title="See this product's activity"
                                >
                                  {p.name}
                                </button>
                                <div className="mt-1 flex items-center gap-2">
                                  {p.model_number && <span className="text-xs text-dark-200">#{p.model_number}</span>}
                                  {p.slug && (
                                    <a
                                      href={`/products/${p.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-dark-300 hover:text-primary-400"
                                    >
                                      View page
                                    </a>
                                  )}
                                  <div className="hidden h-1 max-w-[160px] flex-1 overflow-hidden rounded-full bg-white/[0.04] md:block">
                                    <div
                                      className="h-full rounded-full bg-primary-500/70"
                                      style={{ width: `${(p.interest_score / maxScore) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-dark-100">{formatNumber(p.views)}</td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums text-dark-100 md:table-cell">{formatNumber(p.downloads)}</td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums text-dark-100 sm:table-cell">{formatNumber(p.cart_adds)}</td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums text-dark-100 md:table-cell">{formatNumber(p.quotes)}</td>
                          <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-dark-50">{formatNumber(p.interest_score)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRow>No product activity in this period.</EmptyRow>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel
              title="Pages"
              subtitle={pageView.subtitle}
              icon={MousePointerClick}
              action={
                <>
                  <Segmented
                    label="Pages view"
                    value={pagesView}
                    onChange={setPagesView}
                    options={[
                      { value: 'top', label: 'Top' },
                      { value: 'entry', label: 'Landing' },
                      { value: 'exit', label: 'Exit' },
                    ]}
                  />
                  <CsvButton
                    filename={`pages-${pagesView}-${stamp}`}
                    rows={pagesData}
                    columns={[
                      { key: 'title', label: 'Page', value: pageTitle },
                      { key: 'path', label: 'Path' },
                      { key: pageView.value, label: pageView.value === 'views' ? 'Views' : 'Sessions' },
                      ...(pagesView === 'top'
                        ? [
                            { key: 'visitors', label: 'Visitors' },
                            { key: 'avg_seconds', label: 'Avg seconds on page' },
                            { key: 'avg_depth', label: 'Avg scroll %' },
                          ]
                        : []),
                    ]}
                  />
                </>
              }
            >
              <RankedList
                valueLabel={pageView.value}
                empty="No page views in this period."
                rows={pageRows(pagesData, pageView.value)}
              />
            </Panel>

            <Panel
              title="Top downloads"
              subtitle="Catalogs, spec sheets, CAD & images"
              icon={FileText}
              action={
                <CsvButton
                  filename={`downloads-${stamp}`}
                  rows={data.top_downloads}
                  columns={[
                    { key: 'label', label: 'File' },
                    { key: 'resource_type', label: 'Type', value: (d) => RESOURCE_TYPE_LABELS[d.resource_type] || d.resource_type },
                    { key: 'resource_url', label: 'URL' },
                    { key: 'downloads', label: 'Downloads' },
                    { key: 'visitors', label: 'Visitors' },
                  ]}
                />
              }
            >
              <RankedList
                valueLabel="downloads"
                empty="Nothing downloaded in this period."
                rows={data.top_downloads.map((d) => ({
                  key: d.resource_url || d.label,
                  label: d.label || d.resource_url,
                  sublabel: RESOURCE_TYPE_LABELS[d.resource_type] || d.resource_type || 'Document',
                  value: d.downloads,
                }))}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Downloads by type" icon={Download}>
              <RankedList
                valueLabel="downloads"
                empty="No downloads yet."
                rows={data.downloads_by_type.map((d) => ({ key: d.type, label: RESOURCE_TYPE_LABELS[d.type] || d.type, value: d.downloads }))}
              />
            </Panel>

            <Panel title="Documents read" subtitle="Average time open in the on-site viewer" icon={BookOpen}>
              <RankedList
                valueLabel="on average"
                empty="No documents opened yet."
                formatValue={formatDuration}
                rows={data.catalogs.map((c) => ({
                  key: c.label,
                  label: c.label,
                  sublabel: `${formatNumber(c.readers)} reader${c.readers === 1 ? '' : 's'} · ${formatDuration(c.total_seconds)} total`,
                  value: c.avg_seconds,
                }))}
              />
            </Panel>

            <Panel
              title="Site searches"
              subtitle={`${formatNumber(totals.searches)} total · ${formatNumber(totals.zero_result_searches)} found nothing`}
              icon={Search}
              action={
                <Segmented
                  label="Searches view"
                  value={searchView}
                  onChange={setSearchView}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'none', label: 'No results' },
                  ]}
                />
              }
            >
              <RankedList
                valueLabel="searches"
                empty={searchView === 'all' ? 'No searches yet.' : 'Every search found something.'}
                rows={searchData.map((s) => ({ key: s.query, label: `“${s.query}”`, value: s.searches }))}
              />
            </Panel>

            <Panel title="Filters used" subtitle="Catalog filters & materials searches" icon={Filter}>
              <RankedList
                valueLabel="times"
                empty="No filters used yet."
                rows={data.filters.map((f) => ({ key: f.label, label: f.label, value: f.count }))}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Panel title="Materials looked at" subtitle="Finish, fabric, laminate & hardware swatches" icon={Palette}>
              <RankedList
                valueLabel="views"
                empty="No materials opened yet."
                rows={data.materials.map((m) => ({
                  key: `${m.type}:${m.label}`,
                  label: m.label,
                  sublabel: MATERIAL_TYPE_LABELS[m.type] || m.type,
                  value: m.count,
                }))}
              />
            </Panel>

            <Panel title="Options picked on product pages" subtitle="Finishes, upholstery & variations" icon={MousePointerClick}>
              <RankedList
                valueLabel="picks"
                empty="No options picked yet."
                rows={data.product_interactions.map((m) => ({
                  key: `${m.type}:${m.label}`,
                  label: m.label,
                  sublabel: INTERACTION_LABELS[m.type] || m.type,
                  value: m.count,
                }))}
              />
            </Panel>

            <Panel
              title={leadsView === 'reps' ? 'Rep territories looked up' : 'Contact form subjects'}
              subtitle={
                leadsView === 'reps'
                  ? `${formatNumber(totals.rep_searches)} lookups on Find a Rep`
                  : `${formatNumber(totals.contact_submits)} messages sent`
              }
              icon={MapPin}
              action={
                <Segmented
                  label="Leads view"
                  value={leadsView}
                  onChange={setLeadsView}
                  options={[
                    { value: 'reps', label: 'Reps' },
                    { value: 'contact', label: 'Contact' },
                  ]}
                />
              }
            >
              <RankedList
                valueLabel={leadsView === 'reps' ? 'lookups' : 'messages'}
                empty={leadsView === 'reps' ? 'No rep lookups yet.' : 'No messages yet.'}
                rows={(leadsView === 'reps' ? data.rep_searches : data.contact_submits).map((r) => ({
                  key: r.label,
                  label: r.label,
                  value: r.count,
                }))}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Traffic sources" subtitle="Sessions by referrer" icon={Globe}>
              <RankedList
                valueLabel="sessions"
                empty="No sessions yet."
                rows={data.referrers.map((r) => ({ key: r.source, label: r.source, value: r.sessions }))}
              />
            </Panel>

            <Panel title="Campaigns" subtitle="Links tagged with utm_source" icon={Megaphone}>
              <RankedList
                valueLabel="sessions"
                empty="No tagged links used yet. Add ?utm_source=… to links in emails and ads."
                rows={data.campaigns.map((c) => ({
                  key: `${c.source}|${c.medium}|${c.campaign}`,
                  label: c.campaign || c.source,
                  sublabel: [c.source, c.medium].filter(Boolean).join(' · '),
                  value: c.sessions,
                }))}
              />
            </Panel>

            <Panel
              title="Location"
              subtitle="Visitors"
              icon={MapPin}
              action={
                <Segmented
                  label="Location view"
                  value={locationView}
                  onChange={setLocationView}
                  options={[
                    { value: 'countries', label: 'Country' },
                    { value: 'regions', label: 'State' },
                  ]}
                />
              }
            >
              <RankedList
                valueLabel="visitors"
                empty="No location data yet. The server needs a GeoIP database or a CDN country header."
                rows={
                  locationView === 'countries'
                    ? data.countries.map((c) => ({ key: c.country, label: countryName(c.country), value: c.visitors }))
                    : data.regions.map((r) => ({
                        key: `${r.country}:${r.region}`,
                        label: r.region,
                        sublabel: countryName(r.country),
                        value: r.visitors,
                      }))
                }
              />
            </Panel>

            <Panel title="Devices" subtitle="Visitors" icon={MonitorSmartphone}>
              <RankedList
                valueLabel="visitors"
                empty="No visitors yet."
                rows={data.devices.map((d) => ({ key: d.device, label: DEVICE_LABELS[d.device] || d.device, value: d.visitors }))}
              />
            </Panel>
          </div>
        </div>
      ) : null}

      <ProductDrawer product={drawerProduct} days={days} onClose={closeDrawer} />
      {showDigest && <DigestModal onClose={closeDigest} />}
    </AdminPage>
  );
};

export default Analytics;
