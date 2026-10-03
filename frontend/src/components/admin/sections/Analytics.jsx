import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  FileText,
  Globe,
  MonitorSmartphone,
  MousePointerClick,
  Package,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { CATALOG_TYPE_LABELS } from '../../../utils/catalogTypes';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

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
  { key: 'downloads', label: 'Downloads', icon: Download, hint: 'Files & documents opened' },
];

const RESOURCE_TYPE_LABELS = {
  ...CATALOG_TYPE_LABELS,
  catalog: 'Catalog',
  spec_sheet: 'Spec Sheet',
  line_drawing: 'Line Drawing',
  cad: 'CAD File',
  image: 'Product Image',
  guide: 'Guide',
  document: 'Document',
  other: 'Other',
};

const DEVICE_LABELS = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', unknown: 'Unknown' };

const GOLD = '#f4a52d';

const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n || 0);

// Series dates are UTC calendar days ("YYYY-MM-DD"); show them as-is
const parseDay = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDay = (value, opts = { month: 'short', day: 'numeric' }) =>
  parseDay(value).toLocaleDateString('en-US', opts);

const humanizePath = (path) => (!path || path === '/' ? 'Home' : path);

function changeOf(current, previous) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

function Delta({ current, previous, invert = false }) {
  const change = changeOf(current, previous);
  if (change === null) {
    return <span className="text-[11px] font-medium text-dark-200">New this period</span>;
  }
  if (Math.abs(change) < 0.5) {
    return <span className="text-[11px] font-medium text-dark-200">No change</span>;
  }
  const up = change > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-[11px] font-medium', good ? 'text-emerald-300' : 'text-secondary-300')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%
      <span className="sr-only">{up ? 'increase' : 'decrease'}</span>
      <span className="ml-1 font-normal text-dark-200">vs prev.</span>
    </span>
  );
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

function EmptyRow({ children }) {
  return <p className="px-5 py-8 text-center text-sm text-dark-200">{children}</p>;
}

/** Ranked rows with a thin magnitude bar under each label (single hue). */
function RankedList({ rows, empty, valueLabel }) {
  if (!rows.length) return <EmptyRow>{empty}</EmptyRow>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="divide-y divide-white/[0.04]">
      {rows.map((row) => (
        <li key={row.key} className="group px-5 py-2.5" title={`${row.label}: ${formatNumber(row.value)} ${valueLabel}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-dark-50">{row.label}</p>
              {row.sublabel && <p className="truncate text-xs text-dark-200">{row.sublabel}</p>}
            </div>
            <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-dark-50">{formatNumber(row.value)}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-primary-500/70 transition-colors group-hover:bg-primary-500"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

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

const Analytics = () => {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('visitors');
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
      const res = await apiClient.get(`/api/v1/admin/dashboard/analytics/traffic?days=${days}&limit=10`);
      if (requestId === requestIdRef.current) setData(res);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      if (requestId === requestIdRef.current) setError('Analytics could not be loaded. Try refreshing.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const previous = data?.previous || {};
  const activeMetric = METRICS.find((m) => m.key === metric);
  const hasAnyData = (totals.page_views || 0) + (totals.product_views || 0) + (totals.downloads || 0) > 0;
  const rangeLabel = days === 365 ? 'last 12 months' : `last ${days} days`;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Overview"
        title="Analytics"
        description="Who's visiting the site, which products they look at and what they download."
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
              onClick={load}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-dark-100 ring-1 ring-inset ring-white/10 transition-colors hover:text-dark-50 disabled:opacity-50"
              aria-label="Refresh analytics"
            >
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
          {!hasAnyData && (
            <div className="rounded-xl border border-primary-500/20 bg-primary-500/[0.06] px-5 py-4 text-sm text-dark-100">
              <p className="font-semibold text-dark-50">No visits recorded for the {rangeLabel} yet.</p>
              <p className="mt-1">
                Tracking is anonymous and first-party: page views, product views, searches and downloads appear here as people
                browse the public site. Bots and logged-in admins aren&apos;t counted.
              </p>
            </div>
          )}

          {/* KPI tiles — click one to chart it */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-dark-50 sm:text-[1.75rem]">
                  {formatNumber(totals[key])}
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
                  <Delta current={totals[key] || 0} previous={previous[key] || 0} />
                  <span className="hidden text-[11px] text-dark-300 xl:inline">{hint}</span>
                </div>
              </button>
              );
            })}
          </div>

          {/* Trend */}
          <Panel title={`${activeMetric.label} per day`} subtitle={`${rangeLabel} · UTC days`} icon={activeMetric.icon}>
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
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#858585' }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
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
            <dl className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
              {[
                { label: 'Sessions', value: formatNumber(totals.sessions), cur: totals.sessions, prev: previous.sessions },
                { label: 'Pages / session', value: totals.pages_per_session || 0, cur: totals.pages_per_session, prev: previous.pages_per_session },
                { label: 'Bounce rate', value: `${totals.bounce_rate || 0}%`, cur: totals.bounce_rate, prev: previous.bounce_rate, invert: true },
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

          {/* Products */}
          <Panel title="Most viewed products" subtitle={rangeLabel} icon={Package}>
            {data.top_products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-dark-200">
                      <th className="px-5 py-2.5 font-medium">Product</th>
                      <th className="px-3 py-2.5 text-right font-medium">Views</th>
                      <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Visitors</th>
                      <th className="px-5 py-2.5 text-right font-medium">Downloads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.top_products.map((p, i) => {
                      const maxViews = data.top_products[0]?.views || 1;
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
                                {p.slug ? (
                                  <a
                                    href={`/products/${p.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block truncate font-medium text-dark-50 hover:text-primary-400"
                                  >
                                    {p.name}
                                  </a>
                                ) : (
                                  <span className="block truncate font-medium text-dark-100">{p.name}</span>
                                )}
                                <div className="mt-1 flex items-center gap-2">
                                  {p.model_number && <span className="text-xs text-dark-200">#{p.model_number}</span>}
                                  <div className="hidden h-1 max-w-[160px] flex-1 overflow-hidden rounded-full bg-white/[0.04] md:block">
                                    <div className="h-full rounded-full bg-primary-500/70" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-dark-50">{formatNumber(p.views)}</td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums text-dark-100 sm:table-cell">{formatNumber(p.visitors)}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-dark-100">{formatNumber(p.downloads)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRow>No product views in this period.</EmptyRow>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Top downloads" subtitle="Catalogs, spec sheets, CAD & images" icon={FileText}>
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

            <Panel title="Top pages" subtitle="Page views" icon={MousePointerClick}>
              <RankedList
                valueLabel="views"
                empty="No page views in this period."
                rows={data.top_pages.map((p) => ({
                  key: p.path,
                  label: humanizePath(p.path),
                  sublabel: `${formatNumber(p.visitors)} visitor${p.visitors === 1 ? '' : 's'}`,
                  value: p.views,
                }))}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Downloads by type" icon={Download}>
              <RankedList
                valueLabel="downloads"
                empty="No downloads yet."
                rows={data.downloads_by_type.map((d) => ({
                  key: d.type,
                  label: RESOURCE_TYPE_LABELS[d.type] || d.type,
                  value: d.downloads,
                }))}
              />
            </Panel>

            <Panel title="Traffic sources" subtitle="Sessions by referrer" icon={Globe}>
              <RankedList
                valueLabel="sessions"
                empty="No sessions yet."
                rows={data.referrers.map((r) => ({ key: r.source, label: r.source, value: r.sessions }))}
              />
            </Panel>

            <Panel title="Devices" subtitle="Visitors" icon={MonitorSmartphone}>
              <RankedList
                valueLabel="visitors"
                empty="No visitors yet."
                rows={data.devices.map((d) => ({ key: d.device, label: DEVICE_LABELS[d.device] || d.device, value: d.visitors }))}
              />
            </Panel>

            <Panel title="Site searches" subtitle={`${formatNumber(totals.searches)} total`} icon={Search}>
              <RankedList
                valueLabel="searches"
                empty="No searches yet."
                rows={data.top_searches.map((s) => ({ key: s.query, label: `“${s.query}”`, value: s.searches }))}
              />
            </Panel>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
};

export default Analytics;
