import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, History, RotateCcw, Search, X } from 'lucide-react';
import Button from '../../ui/Button';
import PaginationBar from '../PaginationBar';
import apiClient from '../../../config/apiClient';
import { useToast } from '../../../contexts/ToastContext';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import ChangeFields from '../timeMachine/ChangeFields';
import RestoreDialog from '../timeMachine/RestoreDialog';
import {
  OPS, absoluteTime, clockTime, dayKey, dayLabel, plural, recordName, relativeTime,
} from '../timeMachine/format';

const BASE = '/api/v1/admin/time-machine';
const PAGE_SIZE = 100;
const FILTER_KEYS = ['q', 'type', 'op', 'admin_id', 'from', 'to'];

const SELECT =
  'rounded-lg border border-dark-500 bg-dark-800 px-3 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50';

const OP_TABS = [
  { value: '', label: 'All changes' },
  { value: 'updated', label: 'Edits' },
  { value: 'deleted', label: 'Deletions' },
  { value: 'created', label: 'Additions' },
];

const localDayStart = (day) => (day ? new Date(`${day}T00:00:00`).toISOString() : undefined);
const localDayEnd = (day) => {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const readParams = (search) => {
  const params = new URLSearchParams(search);
  return {
    ...Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])),
    table: params.get('table') || '',
    key: params.get('key') || '',
  };
};

const errorMessage = (err, fallback) => err?.data?.message || err?.message || fallback;

const isRestore = (item) => Boolean(item.restores_set_id || item.restores_entry_id);

/** Most telling kind of change in a change set, for its icon */
function mainOp(item) {
  const { counts = {} } = item;
  if (counts.deleted) return 'deleted';
  if (counts.created && !counts.updated) return 'created';
  return 'updated';
}

function OpBadge({ op, restore = false }) {
  if (restore) {
    return (
      <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20">
        <RotateCcw className="h-3.5 w-3.5" aria-label="Restore" />
      </span>
    );
  }
  const meta = OPS[op];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-1 ${meta.tone}`}>
      <Icon className="h-3.5 w-3.5" aria-label={meta.label} />
    </span>
  );
}

/** "Josh edited Product “Lobo Side” and 3 more rows" */
function Sentence({ item, onRecord }) {
  const first = (item.headline || [])[0];
  const others = item.entry_count - 1;
  return (
    <>
      <span className="font-semibold text-dark-50">{item.admin.name}</span>{' '}
      {isRestore(item) ? 'used the Time Machine on' : OPS[first?.op]?.verb || 'changed'}{' '}
      {first ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRecord(first); }}
          className="text-dark-50 hover:text-primary-400 hover:underline"
        >
          {recordName(first)}
        </button>
      ) : 'a record'}
      {others > 0 && <span className="text-dark-200"> and {plural(others, 'more row')}</span>}
    </>
  );
}

/** Every record one change set touched, loaded when expanded */
function ChangeDetail({ setId, onRecord, onRewind }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [openLinked, setOpenLinked] = useState(() => new Set());

  useEffect(() => {
    let live = true;
    apiClient
      .get(`${BASE}/changes/${setId}`)
      .then((data) => live && setDetail(data))
      .catch((err) => live && setError(errorMessage(err, 'Could not load this change')));
    return () => {
      live = false;
    };
  }, [setId]);

  // Rows removed or unlinked along with a deleted record fold under it
  const { roots, children } = useMemo(() => {
    const kids = {};
    const top = [];
    (detail?.entries || []).forEach((entry) => {
      if (entry.parent_id) (kids[entry.parent_id] ||= []).push(entry);
      else top.push(entry);
    });
    return { roots: top, children: kids };
  }, [detail]);

  const toggleLinked = (id) =>
    setOpenLinked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (error) return <p className="px-4 py-3 text-sm text-red-300 sm:pl-14">{error}</p>;
  if (!detail) return <div className="mx-4 my-3 h-16 animate-pulse rounded bg-dark-750 sm:ml-14" />;

  return (
    <div className="space-y-4 border-t border-dark-700 bg-dark-900/40 px-4 py-4 sm:pl-14">
      {roots.map((entry, index) => {
        const linked = children[entry.id] || [];
        const open = openLinked.has(entry.id);
        return (
          <div key={entry.id} className="space-y-2.5">
            {index > 0 && <hr className="mb-4 border-dark-700" />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[11px] ring-1 ${OPS[entry.op]?.tone}`}>{OPS[entry.op]?.label}</span>
                {entry.is_link ? (
                  <span className="font-medium text-dark-50">{recordName(entry)}</span>
                ) : (
                  <button type="button" onClick={() => onRecord(entry)} className="font-medium text-dark-50 hover:text-primary-400 hover:underline">
                    {recordName(entry)}
                  </button>
                )}
              </p>
              {!entry.is_link && (
                <div className="flex items-center gap-3 text-xs">
                  <button type="button" onClick={() => onRecord(entry)} className="inline-flex items-center gap-1 text-dark-200 hover:text-primary-400">
                    <History className="h-3.5 w-3.5" aria-hidden="true" /> All versions
                  </button>
                  <button type="button" onClick={() => onRewind(entry)} className="inline-flex items-center gap-1 text-dark-200 hover:text-primary-400">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {entry.op === 'deleted' ? 'Bring back just this' : 'Rewind just this'}
                  </button>
                </div>
              )}
            </div>
            <ChangeFields entry={entry} />
            {linked.length > 0 && (
              <div>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleLinked(entry.id)}
                  className="inline-flex items-center gap-1 text-xs text-dark-200 hover:text-dark-50"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Removed with it: {plural(linked.length, 'row')}
                </button>
                {open && (
                  <ul className="mt-1.5 space-y-1 pl-5 text-xs text-dark-100">
                    {linked.map((child) => (
                      <li key={child.id}>{child.op === 'updated' ? 'Unlinked' : OPS[child.op]?.label} {recordName(child)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
      {detail.truncated && (
        <p className="text-xs text-dark-200">
          Showing the first {detail.entries.length} of {detail.entry_count} rows. Undo still covers all of them.
        </p>
      )}
    </div>
  );
}

/** Every version kept of one record, newest first */
function RecordView({ table, rowKey, reloadKey, onBack, onRewind }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setError(null);
    apiClient
      .get(`${BASE}/records/${encodeURIComponent(table)}/${encodeURIComponent(rowKey)}`)
      .then((body) => live && setData(body))
      .catch((err) => live && setError(errorMessage(err, 'Could not load this record')));
    return () => {
      live = false;
    };
  }, [table, rowKey, reloadKey]);

  const title = data ? recordName({ ...data, is_link: false }) : 'Record history';
  return (
    <>
      <AdminPageHeader
        eyebrow="Time Machine"
        title={title}
        icon={History}
        onBack={onBack}
        backLabel="All changes"
        description={data && (
          <>
            {data.exists ? 'Every saved version, newest first. ' : 'This record is deleted. Bring it back from its delete below. '}
            {data.section && data.exists && (
              <Link to={data.section} className="text-primary-400 hover:text-primary-300">Open in admin</Link>
            )}
          </>
        )}
      />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!data && !error && <div className="h-40 animate-pulse rounded-xl bg-dark-800" />}
      {data && data.entries.length === 0 && (
        <p className="rounded-xl border border-dark-600 bg-dark-800 px-6 py-14 text-center text-sm text-dark-200">
          No changes to this record in the history kept.
        </p>
      )}
      {data && data.entries.length > 0 && (
        <ol className="space-y-4 border-l border-dark-600 pl-5 sm:pl-6">
          {data.entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[34px] top-3 sm:-left-[38px]"><OpBadge op={entry.op} /></span>
              <div className="rounded-xl border border-dark-600 bg-dark-800 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-dark-100">
                    <span className="font-semibold text-dark-50">{entry.change_set?.admin?.name || 'Someone'}</span>{' '}
                    {OPS[entry.op]?.verb} it
                    <span className="block text-xs text-dark-200">
                      <time dateTime={entry.created_at}>{absoluteTime(entry.created_at)} · {relativeTime(entry.created_at)}</time>
                      {entry.change_set?.reverted_at && <span className="ml-2 rounded bg-dark-700 px-1.5 py-0.5 text-dark-100">Undone</span>}
                    </span>
                  </p>
                  <Button variant="ghost" size="xs" onClick={() => onRewind(entry, title)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {entry.op === 'deleted' ? 'Bring back' : 'Rewind to before this'}
                  </Button>
                </div>
                <ChangeFields entry={entry} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/**
 * Time Machine (super admins): every admin change from the last
 * HISTORY_RETENTION_DAYS days, with undo of a whole change or a rewind of
 * one record. Filters and the open record live in the URL
 * (/admin/time-machine?table=chairs&key=12) so views can be linked to.
 */
const TimeMachine = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const params = useMemo(() => readParams(location.search), [location.search]);
  const [search, setSearch] = useState(params.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  const setParams = useCallback(
    (changes) => {
      const next = new URLSearchParams(location.search);
      Object.entries(changes).forEach(([k, v]) => {
        if (v === '' || v == null) next.delete(k);
        else next.set(k, String(v));
      });
      const qs = next.toString();
      // Opening a record is a real navigation, so Back returns to the list
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: !('table' in changes) });
      setPage(1);
    },
    [location.pathname, location.search, navigate]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== params.q) setParams({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [search, params.q, setParams]);

  useEffect(() => {
    apiClient.get(`${BASE}/summary`).then(setSummary).catch(() => {});
  }, [reloadKey]);

  useEffect(() => {
    apiClient.get('/api/v1/admin/audit-log/filters').then((f) => setAdmins(f.admins || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      setError(null);
      const response = await apiClient.get(`${BASE}/changes`, {
        params: {
          page,
          page_size: PAGE_SIZE,
          q: params.q || undefined,
          table: params.type || undefined,
          op: params.op || undefined,
          admin_id: params.admin_id || undefined,
          date_from: localDayStart(params.from),
          date_to: localDayEnd(params.to),
        },
      });
      if (seq === requestSeq.current) setData(response);
    } catch (err) {
      if (seq === requestSeq.current) setError(errorMessage(err, 'Failed to load history'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, params.q, params.type, params.op, params.admin_id, params.from, params.to]);

  useEffect(() => {
    if (!params.table) load();
  }, [load, params.table, reloadKey]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openRecord = (entry) => {
    if (!entry.is_link) setParams({ table: entry.table, key: entry.row_key });
  };

  const onRestored = (result) => {
    const c = result?.counts || {};
    const parts = [
      c.restore && `${plural(c.restore, 'record')} brought back`,
      c.revert && `${plural(c.revert, 'record')} reverted`,
      c.remove && `${plural(c.remove, 'record')} removed`,
    ].filter(Boolean);
    toast.success(parts.length ? `Restored: ${parts.join(', ')}` : 'Restored');
    setRestoreTarget(null);
    setExpanded(new Set());
    setReloadKey((k) => k + 1);
  };

  const groups = useMemo(() => {
    const out = [];
    data.items.forEach((item) => {
      const key = dayKey(item.created_at);
      if (!out.length || out[out.length - 1].key !== key) out.push({ key, label: dayLabel(item.created_at), items: [] });
      out[out.length - 1].items.push(item);
    });
    return out;
  }, [data.items]);

  const activeFilters = FILTER_KEYS.some((k) => params[k]);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const retention = summary?.retention_days;

  const dialog = <RestoreDialog target={restoreTarget} onClose={() => setRestoreTarget(null)} onRestored={onRestored} />;

  if (params.table && params.key) {
    return (
      <AdminPage width="default">
        <RecordView
          table={params.table}
          rowKey={params.key}
          reloadKey={reloadKey}
          onBack={() => navigate(-1)}
          onRewind={(entry, label) => setRestoreTarget({ entryId: entry.id, label })}
        />
        {dialog}
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="System"
        title="Time Machine"
        icon={RotateCcw}
        description={
          `Undo any change made in the admin panel${retention ? ` in the last ${retention} days` : ''}: edits, deletions and additions. `
          + 'Every restore is saved here too, so it can be undone as well.'
        }
      />

      {summary && (
        <p className="-mt-2 text-xs text-dark-200">
          {plural(summary.change_sets, 'change')} kept
          {summary.oldest && <> · oldest from {absoluteTime(summary.oldest)}</>}
          {' '}· admin accounts and sign-in settings aren&apos;t included
          {!summary.enabled && <span className="text-amber-300"> · recording is turned off (HISTORY_ENABLED)</span>}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Kind of change" className="flex flex-wrap gap-1.5">
          {OP_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={params.op === tab.value}
              onClick={() => setParams({ op: tab.value })}
              className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                params.op === tab.value ? 'bg-primary-500 text-dark-900' : 'bg-dark-800 text-dark-100 hover:bg-dark-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-200" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search history"
              placeholder="Product name, SKU, ID, old text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2 pl-10 pr-4 text-sm text-dark-50 placeholder-dark-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          <select aria-label="Record type" className={SELECT} value={params.type} onChange={(e) => setParams({ type: e.target.value })}>
            <option value="">All record types</option>
            {(summary?.tables || []).map((t) => <option key={t.table} value={t.table}>{t.label}</option>)}
          </select>
          <select aria-label="Admin" className={SELECT} value={params.admin_id} onChange={(e) => setParams({ admin_id: e.target.value })}>
            <option value="">All admins</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_active ? '' : ' (inactive)'}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-dark-200">
            From
            <input type="date" className={SELECT} value={params.from} max={params.to || undefined} onChange={(e) => setParams({ from: e.target.value })} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-dark-200">
            To
            <input type="date" className={SELECT} value={params.to} min={params.from || undefined} onChange={(e) => setParams({ to: e.target.value })} />
          </label>
          {activeFilters && (
            <button
              type="button"
              onClick={() => { setSearch(''); setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, '']))); }}
              className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={load}>Retry</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-dark-600 bg-dark-800">
        {data.total > PAGE_SIZE && (
          <PaginationBar page={page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
        {loading && data.items.length === 0 ? (
          <div className="space-y-px">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse bg-dark-750" />)}
          </div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium text-dark-50">{activeFilters ? 'No changes match' : 'Nothing to undo yet'}</p>
            <p className="mt-1 text-sm text-dark-200">
              {activeFilters ? 'Try different filters.' : 'Changes made in the admin panel will show up here, ready to undo.'}
            </p>
          </div>
        ) : (
          <div className={loading ? 'opacity-60' : ''}>
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h2 className="border-b border-dark-700 bg-dark-900/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-200">
                  {group.label}
                </h2>
                <ul className="divide-y divide-dark-700">
                  {group.items.map((item) => {
                    const open = expanded.has(item.id);
                    const undone = Boolean(item.reverted_at);
                    return (
                      <li key={item.id} className={undone ? 'bg-dark-900/30' : ''}>
                        <div className="flex items-start gap-3 px-4 py-3">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={open ? 'Hide details' : 'Show details'}
                            onClick={() => toggle(item.id)}
                            className="mt-1.5 text-dark-300 hover:text-dark-50"
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <OpBadge op={mainOp(item)} restore={isRestore(item)} />
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle(item.id)} role="presentation">
                            <p className={`text-sm leading-relaxed ${undone ? 'text-dark-200' : 'text-dark-100'}`}>
                              <Sentence item={item} onRecord={openRecord} />
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dark-200">
                              <time dateTime={item.created_at} title={absoluteTime(item.created_at)}>
                                {clockTime(item.created_at)} · {relativeTime(item.created_at)}
                              </time>
                              {Object.entries(item.counts).filter(([, n]) => n).map(([op, n]) => (
                                <span key={op}>· {n} {OPS[op].verb}</span>
                              ))}
                              {undone && <span className="rounded bg-dark-700 px-1.5 py-0.5 text-dark-100">Undone</span>}
                            </p>
                          </div>
                          {!undone && (
                            <Button variant="ghost" size="xs" onClick={() => setRestoreTarget({ changeSetId: item.id })}>
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Undo
                            </Button>
                          )}
                        </div>
                        {open && (
                          <ChangeDetail
                            setId={item.id}
                            onRecord={openRecord}
                            onRewind={(entry) => setRestoreTarget({ entryId: entry.id, label: recordName(entry) })}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        {data.total > PAGE_SIZE && (
          <PaginationBar page={page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} position="bottom" />
        )}
      </div>
      {dialog}
    </AdminPage>
  );
};

export default TimeMachine;
