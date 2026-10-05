import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Mail, Phone, Building2, ArrowLeft, Trash2, CheckCircle2, Circle } from 'lucide-react';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/ConfirmModal';
import PaginationBar from '../PaginationBar';
import apiClient from '../../../config/apiClient';
import { useToast } from '../../../contexts/ToastContext';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { booleanAction } from '../bulk/bulkActions';
import { SelectAllCheckbox, RowCheckbox } from '../bulk/SelectCheckbox';

const BASE = '/api/v1/admin/inquiries';
const PAGE_SIZE = 25;

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'open', label: 'Needs reply' },
  { value: 'responded', label: 'Responded' },
];

// Values of the Contact page subject dropdown
const SUBJECT_LABELS = {
  general: 'General Inquiry',
  quote: 'Quote Request',
  support: 'Customer Support',
  dealer: 'Become a Dealer',
  other: 'Other',
};

const BULK_ACTIONS = [
  { label: 'Mark read', changes: { is_read: true } },
  { label: 'Mark unread', changes: { is_read: false } },
  booleanAction('Responded', 'is_responded', 'Responded', 'Needs reply'),
];

const subjectLabel = (value) => SUBJECT_LABELS[value] || value || 'General Inquiry';

const formatWhen = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`;
  if (diffMin < 60 * 24 * 7) return `${Math.round(diffMin / 1440)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Inquiry inbox for contact form submissions.
 *
 * @param {function} onUnreadChange - receives the unread count (nav badge)
 */
const InquiryManagement = ({ onUnreadChange }) => {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      setError(null);
      const response = await apiClient.get(BASE, {
        params: { status, page, page_size: PAGE_SIZE, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
      });
      if (seq !== requestSeq.current) return;
      setData(response);
      onUnreadChange?.(response.unread);
    } catch (err) {
      if (seq === requestSeq.current) setError(err.message || 'Failed to load inquiries');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [status, page, debouncedSearch, onUnreadChange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  const selected = data.items.find((i) => i.id === selectedId) || null;
  const selection = useBulkSelection(data.items);

  const patch = async (id, body) => {
    const updated = await apiClient.patch(`${BASE}/${id}`, body);
    setData((prev) => {
      const before = prev.items.find((i) => i.id === id);
      const unreadDelta = before && before.is_read !== updated.is_read ? (updated.is_read ? -1 : 1) : 0;
      const unread = Math.max(0, prev.unread + unreadDelta);
      onUnreadChange?.(unread);
      return { ...prev, unread, items: prev.items.map((i) => (i.id === id ? updated : i)) };
    });
    return updated;
  };

  const openInquiry = (item) => {
    setSelectedId(item.id);
    setNotes(item.admin_notes || '');
    if (!item.is_read) {
      patch(item.id, { is_read: true }).catch(() => {});
    }
  };

  const toggleResponded = async () => {
    try {
      const updated = await patch(selected.id, { is_responded: !selected.is_responded });
      toast.success(updated.is_responded ? 'Marked as responded' : 'Marked as needing a reply');
    } catch (err) {
      toast.error(`Couldn't update inquiry: ${err.message}`);
    }
  };

  const markUnread = async () => {
    try {
      await patch(selected.id, { is_read: false, is_responded: false });
      setSelectedId(null);
    } catch (err) {
      toast.error(`Couldn't update inquiry: ${err.message}`);
    }
  };

  const saveNotes = async () => {
    try {
      setSavingNotes(true);
      await patch(selected.id, { admin_notes: notes });
      toast.success('Notes saved');
    } catch (err) {
      toast.error(`Couldn't save notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const confirmDelete = async () => {
    const item = pendingDelete;
    if (!item) return;
    try {
      await apiClient.delete(`${BASE}/${item.id}`);
      toast.success('Inquiry deleted');
      if (selectedId === item.id) setSelectedId(null);
      await load();
    } catch (err) {
      toast.error(`Couldn't delete inquiry: ${err.message}`);
    }
  };

  const replyHref = selected
    ? `mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: ${subjectLabel(selected.subject)} - Eagle Chair`)}`
    : '#';

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Sales"
        title="Inquiries"
        description={
          <>
            Messages from the website contact form
            {data.unread > 0 && <span className="text-primary-400"> · {data.unread} unread</span>}
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-dark-600 bg-dark-800 p-1" role="tablist" aria-label="Filter inquiries">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => { setStatus(tab.value); setSelectedId(null); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value ? 'bg-dark-600 text-dark-50' : 'text-dark-100 hover:text-dark-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-200" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search inquiries"
            placeholder="Search name, email, company, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2.5 pl-10 pr-4 text-dark-50 placeholder-dark-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={load}>Retry</Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* List */}
        <div className={`overflow-hidden rounded-xl border border-dark-600 bg-dark-800 ${selected ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="space-y-px">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse bg-dark-750" />)}
            </div>
          ) : data.items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-medium text-dark-50">
                {debouncedSearch || status !== 'all' ? 'No inquiries match' : 'No inquiries yet'}
              </p>
              <p className="mt-1 text-sm text-dark-200">
                {debouncedSearch || status !== 'all'
                  ? 'Try a different filter or search.'
                  : 'Messages sent through the Contact page will appear here.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-dark-700">
              <li className="flex items-center gap-3 px-4 py-2 text-xs text-dark-200">
                <SelectAllCheckbox selection={selection} label="Select all inquiries" />
                <span>Select all on this page</span>
              </li>
              {data.items.map((item) => (
                <li key={item.id} className={`flex items-start ${selection.isSelected(item.id) ? 'bg-primary-900/15' : ''}`}>
                  <span className="pl-4 pt-4">
                    <RowCheckbox selection={selection} id={item.id} label={`Select inquiry from ${item.name}`} />
                  </span>
                  <button
                    type="button"
                    onClick={() => openInquiry(item)}
                    aria-current={selectedId === item.id ? 'true' : undefined}
                    className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-dark-750 focus:outline-none focus-visible:bg-dark-750 ${selectedId === item.id ? 'bg-dark-700' : ''}`}
                  >
                    <span className="mt-1.5 flex-shrink-0" aria-hidden="true">
                      <span className={`block h-2 w-2 rounded-full ${item.is_read ? 'bg-transparent' : 'bg-primary-500'}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${item.is_read ? 'text-dark-100' : 'font-semibold text-dark-50'}`}>
                          {item.name}
                          {item.company_name && <span className="font-normal text-dark-200"> · {item.company_name}</span>}
                        </span>
                        <span className="flex-shrink-0 text-xs text-dark-200">{formatWhen(item.created_at)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="text-dark-100">{subjectLabel(item.subject)}</span>
                        {item.is_responded && (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Responded
                          </span>
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-dark-200">{item.message}</span>
                      {!item.is_read && <span className="sr-only">Unread</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.total > PAGE_SIZE && (
            <PaginationBar page={page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} position="bottom" />
          )}
        </div>

        {/* Detail */}
        <div className={`rounded-xl border border-dark-600 bg-dark-800 ${selected ? '' : 'hidden lg:flex lg:items-center lg:justify-center'}`}>
          {selected ? (
            <article className="flex h-full flex-col">
              <header className="border-b border-dark-600 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="mb-3 inline-flex items-center gap-1 text-sm text-dark-100 hover:text-dark-50 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All inquiries
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-primary-400">{subjectLabel(selected.subject)}</p>
                    <h3 className="mt-1 text-lg font-semibold text-dark-50">{selected.name}</h3>
                    <p className="text-xs text-dark-200">
                      {selected.created_at && new Date(selected.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <a
                    href={replyHref}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-semibold text-dark-900 transition-colors hover:bg-primary-600"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" /> Reply by email
                  </a>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-dark-100">
                    <Mail className="h-4 w-4 flex-shrink-0 text-dark-200" aria-hidden="true" />
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate"><a href={`mailto:${selected.email}`} className="hover:text-primary-400">{selected.email}</a></dd>
                  </div>
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-dark-100">
                      <Phone className="h-4 w-4 flex-shrink-0 text-dark-200" aria-hidden="true" />
                      <dt className="sr-only">Phone</dt>
                      <dd><a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`} className="hover:text-primary-400">{selected.phone}</a></dd>
                    </div>
                  )}
                  {selected.company_name && (
                    <div className="flex items-center gap-2 text-dark-100">
                      <Building2 className="h-4 w-4 flex-shrink-0 text-dark-200" aria-hidden="true" />
                      <dt className="sr-only">Company</dt>
                      <dd className="truncate">{selected.company_name}</dd>
                    </div>
                  )}
                </dl>
              </header>

              <div className="flex-1 space-y-5 px-5 py-5">
                <p className="whitespace-pre-wrap break-words leading-relaxed text-dark-50">{selected.message}</p>

                <div>
                  <label htmlFor="inquiry-notes" className="mb-1.5 block text-sm font-medium text-dark-100">
                    Internal notes
                  </label>
                  <textarea
                    id="inquiry-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Who followed up, what was promised…"
                    className="w-full resize-y rounded-lg border border-dark-500 bg-dark-900 px-3.5 py-2.5 text-sm text-dark-50 placeholder-dark-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={saveNotes}
                      disabled={savingNotes || notes === (selected.admin_notes || '')}
                    >
                      {savingNotes ? 'Saving…' : 'Save notes'}
                    </Button>
                  </div>
                </div>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-dark-600 px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="xs" onClick={toggleResponded} className="gap-1.5">
                    {selected.is_responded
                      ? <><Circle className="h-4 w-4" aria-hidden="true" /> Mark as needing reply</>
                      : <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Mark as responded</>}
                  </Button>
                  <Button variant="ghost" size="xs" onClick={markUnread}>Mark unread</Button>
                </div>
                <Button variant="ghost" size="xs" onClick={() => setPendingDelete(selected)} className="gap-1.5 hover:!text-red-300">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                </Button>
              </footer>
            </article>
          ) : (
            <p className="px-6 py-14 text-sm text-dark-200">Select an inquiry to read it</p>
          )}
        </div>
      </div>

      <BulkActionBar
        selection={selection}
        resource="inquiries"
        noun="message"
        actions={BULK_ACTIONS}
        onDone={load}
      />

      <ConfirmModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete inquiry?"
        message={pendingDelete ? `The message from ${pendingDelete.name} will be permanently deleted.` : ''}
        confirmText="Delete"
      />
    </AdminPage>
  );
};

export default InquiryManagement;
