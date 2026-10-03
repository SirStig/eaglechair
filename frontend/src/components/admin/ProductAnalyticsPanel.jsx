import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Download, Eye, Flame, MousePointerClick, ShoppingCart, FileText } from 'lucide-react';
import apiClient from '../../config/apiClient';
import { Delta, Panel, RankedList, Segmented } from './analyticsUi';
import { INTERACTION_LABELS, RESOURCE_TYPE_LABELS, formatNumber, missingFilesPhrase } from './analyticsFormat';

const RANGES = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '1Y', value: 365 },
];

const METRICS = [
  { key: 'views', series: 'views', label: 'Views', icon: Eye },
  { key: 'downloads', series: 'downloads', label: 'Downloads', icon: Download },
  { key: 'cart_adds', series: 'cart_adds', label: 'Added to quote', icon: ShoppingCart },
  { key: 'quotes', label: 'In quote requests', icon: FileText },
];

const GOLD = '#f4a52d';

const formatDay = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Site activity for one product: views, downloads, quote-cart adds, quote
 * requests and what people did on its page. Used in the product editor and
 * from the Analytics page.
 */
const ProductAnalyticsPanel = ({ productId, initialDays = 30 }) => {
  const [days, setDays] = useState(initialDays);
  const [metric, setMetric] = useState('views');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!productId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/admin/dashboard/analytics/products/${productId}?days=${days}`);
      if (requestId === requestIdRef.current) setData(res);
    } catch (err) {
      console.error('Failed to load product analytics:', err);
      if (requestId === requestIdRef.current) setError('Activity for this product could not be loaded.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [productId, days]);

  useEffect(() => {
    load();
  }, [load]);

  if (!productId) return null;
  if (error) {
    return <div className="rounded-lg border border-secondary-500/30 bg-secondary-500/10 px-4 py-3 text-sm text-secondary-200">{error}</div>;
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      </div>
    );
  }

  const { totals, previous, product } = data;
  const weights = data.interest_weights;
  const activeMetric = METRICS.find((m) => m.key === metric);
  const missing = [
    !product.has_spec_sheet && 'spec_sheet',
    !product.has_cad && 'cad',
    !product.has_line_drawing && 'line_drawing',
  ].filter(Boolean);

  return (
    <div className={clsx('space-y-5 transition-opacity', loading && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dark-100">
          Anonymous visitors to <span className="font-semibold text-dark-50">{product.name}</span>
          {product.slug && (
            <>
              {' · '}
              <a href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                View page
              </a>
            </>
          )}
        </p>
        <Segmented options={RANGES} value={days} onChange={setDays} label="Date range" />
      </div>

      {missing.length > 0 && totals.views > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary-500/25 bg-primary-500/[0.06] px-4 py-3 text-sm text-dark-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" aria-hidden="true" />
          <span>
            Viewed {formatNumber(totals.views)} {totals.views === 1 ? 'time' : 'times'} but has no{' '}
            {missingFilesPhrase(missing)} to download.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {METRICS.map(({ key, series, label, icon }) => {
          const Icon = icon;
          const Tag = series ? 'button' : 'div';
          return (
            <Tag
              key={key}
              {...(series ? { type: 'button', onClick: () => setMetric(key), 'aria-pressed': metric === key } : {})}
              className={clsx(
                'ec-card rounded-xl border p-3.5 text-left transition-colors',
                series && (metric === key ? '!border-primary-500/60 ring-1 ring-primary-500/30' : 'hover:!border-white/15')
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-dark-100">{label}</span>
                <Icon className={clsx('h-4 w-4', metric === key ? 'text-primary-500' : 'text-dark-300')} aria-hidden="true" />
              </div>
              <p className="mt-1.5 font-serif text-2xl font-bold tabular-nums text-dark-50">{formatNumber(totals[key])}</p>
              <Delta current={totals[key] || 0} previous={previous[key] || 0} />
            </Tag>
          );
        })}
        <div
          className="ec-card col-span-2 rounded-xl border p-3.5 lg:col-span-1"
          title={`Views ×${weights.views} + downloads ×${weights.downloads} + quote adds ×${weights.cart_adds} + quote requests ×${weights.quotes}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-dark-100">Interest score</span>
            <Flame className="h-4 w-4 text-dark-300" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-serif text-2xl font-bold tabular-nums text-dark-50">{formatNumber(totals.interest_score)}</p>
          <Delta current={totals.interest_score || 0} previous={previous.interest_score || 0} />
        </div>
      </div>

      {activeMetric?.series && (
        <Panel title={`${activeMetric.label} per day`} subtitle="UTC days" icon={activeMetric.icon}>
          <div className="h-[200px] px-2 pb-3 pt-4 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeseries} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="product-analytics-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: '#858585' }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858585' }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  labelFormatter={formatDay}
                  formatter={(v) => [formatNumber(v), activeMetric.label]}
                  contentStyle={{ background: 'rgba(23,23,23,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey={activeMetric.series} stroke={GOLD} strokeWidth={2} fill="url(#product-analytics-fill)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="What people did on the page" subtitle="Options picked and photos browsed" icon={MousePointerClick}>
          <RankedList
            valueLabel="times"
            empty="No option picks yet."
            rows={data.interactions.map((r) => ({
              key: `${r.type}:${r.label}`,
              label: r.label,
              sublabel: INTERACTION_LABELS[r.type] || r.type,
              value: r.count,
            }))}
          />
        </Panel>
        <Panel
          title="Files downloaded"
          subtitle={totals.cart_removes ? `${formatNumber(totals.cart_removes)} removed from a quote cart` : undefined}
          icon={Download}
        >
          <RankedList
            valueLabel="downloads"
            empty="Nothing downloaded yet."
            rows={data.downloads.map((r) => ({
              key: `${r.type}:${r.label}`,
              label: r.label,
              sublabel: RESOURCE_TYPE_LABELS[r.type] || r.type,
              value: r.count,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
};

export default ProductAnalyticsPanel;
