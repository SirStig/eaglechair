import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, History, Search, X } from 'lucide-react';
import Button from '../../ui/Button';
import PaginationBar from '../PaginationBar';
import apiClient from '../../../config/apiClient';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

const BASE = '/api/v1/admin/audit-log';
const PAGE_SIZE = 50;
const FILTER_KEYS = ['admin_id', 'resource_type', 'resource_id', 'action', 'q', 'from', 'to'];

const SELECT =
  'rounded-lg border border-dark-500 bg-dark-800 px-3 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50';

// Past-tense verbs for audit actions (backend/services/audit_service.py)
const VERBS = {
  create: 'created',
  update: 'updated',
  update_status: 'changed the status of',
  delete: 'deleted',
  bulk_edit: 'bulk-edited',
  permanent_delete: 'permanently deleted',
  reorder: 'reordered',
  assign: 'assigned',
  duplicate: 'duplicated',
  invite: 'invited',
  test: 'sent a test of',
  send: 'sent',
  apply: 'applied',
  decline: 'declined',
  apply_edit: 'applied an AI edit to',
  export_all: 'exported',
  sample: 'created a sample',
  batch: 'batch-uploaded',
  reset_password: 'set a new password for',
  reset_security: 'reset 2FA and passkeys for',
  unlock: 'unlocked',
  restore: 'undid a change with',
};

// "tried to …" wording for refused requests (details.attempted)
const ATTEMPTS = {
  create: 'create',
  update: 'update',
  update_status: 'change the status of',
  delete: 'delete',
  bulk_edit: 'bulk-edit',
  permanent_delete: 'permanently delete',
  reorder: 'reorder',
  reset_password: 'set a password for',
  reset_security: 'reset 2FA for',
  unlock: 'unlock',
};

// Account events read as a sentence about the admin themselves
const ACCOUNT_EVENTS = {
  login: 'signed in',
  login_failed: 'failed to sign in',
  logout: 'signed out',
  confirm_identity: "confirmed it's them",
  confirm_failed: "failed to confirm it's them",
  passkey_added: 'added a passkey',
  '2fa_enabled': 'turned on two-factor authentication',
};

const ACTION_LABELS = {
  ...Object.fromEntries(Object.entries(VERBS).map(([k, v]) => [k, v.charAt(0).toUpperCase() + v.slice(1)])),
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  confirm_identity: 'Confirmed identity',
  confirm_failed: 'Failed identity confirmation',
  passkey_added: 'Added passkey',
  '2fa_enabled': 'Turned on 2FA',
  denied: 'Denied',
  restore: 'Time Machine restore',
};

const RED_ACTIONS = new Set(['denied', 'login_failed', 'confirm_failed']);

const titleCase = (s) =>
  String(s || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const resourceLabel = (type) => {
  const labels = { admin_users: 'Admin', admins: 'Admin', 'ai-training': 'AI training doc', 'ai-chats': 'AI chat' };
  return labels[type] || titleCase(type);
};

const actionLabel = (action) => {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (/^AI_/.test(action)) return `AI: ${titleCase(action.slice(3).toLowerCase())}`;
  return titleCase(action);
};

const relativeTime = (iso) => {
  const date = new Date(iso);
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const absoluteTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

// YYYY-MM-DD (local) -> ISO of that local midnight
const localDayStart = (day) => (day ? new Date(`${day}T00:00:00`).toISOString() : undefined);
const localDayEnd = (day) => {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

function readFilters(search) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
}

/** "Product “Lobo Side” (#12)" */
function RecordText({ entry }) {
  const { resource_type: type, resource_id: id, resource_name: name } = entry;
  return (
    <>
      {resourceLabel(type)}
      {name && <> “{name}”</>}
      {id != null && <span className="text-dark-200"> (#{id})</span>}
    </>
  );
}

function Sentence({ entry, onAdmin, onRecord }) {
  const d = entry.details || {};
  const who = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAdmin(entry.admin.id); }}
      className="font-semibold text-dark-50 hover:text-primary-400 hover:underline"
    >
      {entry.admin.name}
    </button>
  );
  const record = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRecord(entry.resource_type, entry.resource_id); }}
      className="text-dark-50 hover:text-primary-400 hover:underline"
    >
      <RecordText entry={entry} />
    </button>
  );
  const target = d.target ? <span className="text-dark-200"> › {d.target}</span> : null;
  const label = d.label && !entry.resource_name ? <span className="text-dark-200"> “{d.label}”</span> : null;

  if (ACCOUNT_EVENTS[entry.action]) {
    const isOther = ['admins', 'admin_users'].includes(entry.resource_type) && entry.resource_id !== entry.admin.id;
    return (
      <>
        {who} {ACCOUNT_EVENTS[entry.action]}
        {d.method && <span className="text-dark-200"> ({d.method})</span>}
        {isOther && <> for {record}</>}
        {d.reason && entry.action !== 'login' && <span className="text-red-300"> · {d.reason}</span>}
      </>
    );
  }

  if (entry.action === 'denied') {
    const tried = ATTEMPTS[d.attempted] || (d.attempted ? d.attempted.replace(/_/g, ' ') : 'change');
    return (
      <>
        {who} <span className="text-red-300">was denied</span>: tried to {tried} {record}
        {target}
      </>
    );
  }

  if (/^AI_/.test(entry.action)) {
    const [, verb = 'changed'] = entry.action.toLowerCase().split('_');
    return (
      <>
        {who} applied an AI edit: {verb === 'update' ? 'updated' : verb === 'create' ? 'created' : verb} {record}
      </>
    );
  }

  if (entry.action === 'bulk_edit' || entry.action === 'permanent_delete') {
    return (
      <>
        {who} {VERBS[entry.action]} {d.count ?? ''} {record}
      </>
    );
  }

  return (
    <>
      {who} {VERBS[entry.action] || entry.action.replace(/_/g, ' ')} {record}
      {label}
      {target}
    </>
  );
}

function Details({ entry }) {
  const d = entry.details || {};
  const rows = [
    ['When', absoluteTime(entry.created_at)],
    ['Request', d.method || d.path ? `${d.method || ''} ${d.path || ''}`.trim() : null],
    ['Outcome', d.outcome],
    ['Reason', d.reason],
    ['IP address', entry.ip_address],
    ['Browser', entry.user_agent],
  ].filter(([, v]) => v);
  const known = new Set(['method', 'path', 'outcome', 'reason', 'body', 'query', 'target', 'label', 'count', 'attempted', 'history_set']);
  const extra = Object.fromEntries(Object.entries(d).filter(([k]) => !known.has(k)));

  return (
    <div className="space-y-3 border-t border-dark-700 bg-dark-900/40 px-4 py-3 text-xs sm:pl-12">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[8rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-dark-200">{k}</dt>
            <dd className="break-all text-dark-50">{v}</dd>
          </div>
        ))}
      </dl>
      {d.query && (
        <div>
          <p className="mb-1 text-dark-200">Query</p>
          <pre className="overflow-x-auto rounded-md bg-dark-900 p-2.5 text-[11px] text-dark-100">{JSON.stringify(d.query, null, 2)}</pre>
        </div>
      )}
      {d.body !== undefined && (
        <div>
          <p className="mb-1 text-dark-200">Changes sent</p>
          <pre className="max-h-80 overflow-auto rounded-md bg-dark-900 p-2.5 text-[11px] text-dark-100">{JSON.stringify(d.body, null, 2)}</pre>
        </div>
      )}
      {Object.keys(extra).length > 0 && (
        <div>
          <p className="mb-1 text-dark-200">Details</p>
          <pre className="max-h-80 overflow-auto rounded-md bg-dark-900 p-2.5 text-[11px] text-dark-100">{JSON.stringify(extra, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Activity log: who did what in the admin panel. Filters live in the URL
 * (/admin/activity?resource_type=products&resource_id=12) so record
 * histories can be linked to.
 */
const ActivityLog = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const [search, setSearch] = useState(filters.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [options, setOptions] = useState({ admins: [], resource_types: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const requestSeq = useRef(0);

  const setFilters = useCallback(
    (changes) => {
      const params = new URLSearchParams(location.search);
      Object.entries(changes).forEach(([k, v]) => {
        if (v === '' || v == null) params.delete(k);
        else params.set(k, String(v));
      });
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
      setPage(1);
    },
    [location.pathname, location.search, navigate]
  );

  // Debounced search box -> URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== filters.q) setFilters({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [search, filters.q, setFilters]);

  useEffect(() => {
    apiClient.get(`${BASE}/filters`).then(setOptions).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      setError(null);
      const params = {
        page,
        page_size: PAGE_SIZE,
        admin_id: filters.admin_id || undefined,
        resource_type: filters.resource_type || undefined,
        resource_id: filters.resource_id || undefined,
        action: filters.action || undefined,
        q: filters.q || undefined,
        date_from: localDayStart(filters.from),
        date_to: localDayEnd(filters.to),
      };
      const response = await apiClient.get(BASE, { params });
      if (seq === requestSeq.current) setData(response);
    } catch (err) {
      if (seq === requestSeq.current) setError(err?.data?.message || err.message || 'Failed to load activity');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const activeFilters = FILTER_KEYS.some((k) => filters[k]);
  const adminName = options.admins.find((a) => String(a.id) === filters.admin_id)?.name;
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const actions = options.actions.includes('denied') ? options.actions : [...options.actions, 'denied'];

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="System"
        title="Activity Log"
        icon={History}
        description="Every change made in the admin panel: who, what and when. Refused attempts and sign-ins are recorded too."
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-200" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search activity"
              placeholder="Search names, values, paths…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2 pl-10 pr-4 text-sm text-dark-50 placeholder-dark-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          <select aria-label="Admin" className={SELECT} value={filters.admin_id} onChange={(e) => setFilters({ admin_id: e.target.value })}>
            <option value="">All admins</option>
            {options.admins.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.is_active ? '' : ' (inactive)'}</option>
            ))}
          </select>
          <select
            aria-label="Record type"
            className={SELECT}
            value={filters.resource_type}
            onChange={(e) => setFilters({ resource_type: e.target.value, resource_id: '' })}
          >
            <option value="">All record types</option>
            {options.resource_types.map((t) => (
              <option key={t} value={t}>{resourceLabel(t)}</option>
            ))}
          </select>
          <select aria-label="Action" className={SELECT} value={filters.action} onChange={(e) => setFilters({ action: e.target.value })}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{actionLabel(a)}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-dark-200">
            From
            <input type="date" className={SELECT} value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-dark-200">
            To
            <input type="date" className={SELECT} value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
          </label>
        </div>

        {activeFilters && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {adminName && <span className="rounded-full bg-dark-700 px-2.5 py-1 text-dark-100">Admin: {adminName}</span>}
            {filters.resource_type && (
              <span className="rounded-full bg-dark-700 px-2.5 py-1 text-dark-100">
                {resourceLabel(filters.resource_type)}{filters.resource_id ? ` #${filters.resource_id}` : ''}
              </span>
            )}
            <button
              type="button"
              onClick={() => { setSearch(''); setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, '']))); }}
              className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
            </button>
          </div>
        )}
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
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse bg-dark-750" />)}
          </div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium text-dark-50">{activeFilters ? 'No activity matches' : 'No activity yet'}</p>
            <p className="mt-1 text-sm text-dark-200">
              {activeFilters ? 'Try different filters.' : 'Changes made in the admin panel will appear here.'}
            </p>
          </div>
        ) : (
          <ul className={`divide-y divide-dark-700 ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((entry) => {
              const open = expanded.has(entry.id);
              const red = RED_ACTIONS.has(entry.action);
              return (
                <li key={entry.id} className={red ? 'bg-red-950/15' : ''}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggle(entry.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(entry.id); } }}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-dark-750 focus:outline-none focus-visible:bg-dark-750"
                  >
                    <span className="mt-0.5 text-dark-300" aria-hidden="true">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-relaxed ${red ? 'text-red-200' : 'text-dark-100'}`}>
                        <Sentence
                          entry={entry}
                          onAdmin={(id) => setFilters({ admin_id: id })}
                          onRecord={(type, id) => setFilters({ resource_type: type, resource_id: id ?? '' })}
                        />
                      </span>
                      <span className="mt-0.5 block text-xs text-dark-200">
                        <time dateTime={entry.created_at} title={absoluteTime(entry.created_at)}>
                          {relativeTime(entry.created_at)} · {absoluteTime(entry.created_at)}
                        </time>
                        {entry.ip_address && <> · {entry.ip_address}</>}
                      </span>
                    </span>
                    <span
                      className={`hidden flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] sm:inline ${
                        red ? 'bg-red-500/15 text-red-300' : 'bg-dark-700 text-dark-100'
                      }`}
                    >
                      {actionLabel(entry.action)}
                    </span>
                  </div>
                  {open && <Details entry={entry} />}
                </li>
              );
            })}
          </ul>
        )}
        {data.total > PAGE_SIZE && (
          <PaginationBar page={page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} position="bottom" />
        )}
      </div>
    </AdminPage>
  );
};

export default ActivityLog;
