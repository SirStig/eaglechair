import { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, Plus, Pencil, Trash2, Search, ExternalLink } from 'lucide-react';
import EditModal from '../EditModal';
import ConfirmModal from '../../ui/ConfirmModal';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { useToast } from '../../../contexts/ToastContext';
import TableSortHead, { compareValues } from '../TableSortHead';
import { LEGAL_DOCUMENT_TYPES, legalDocumentTypeLabel } from '../legalDocumentTypes';

// Public pages that render a specific legal document type
const PUBLIC_PATHS = {
  privacy_policy: '/privacy',
  terms: '/terms',
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const SORT_VALUE = {
  title: (d) => d.title,
  document_type: (d) => legalDocumentTypeLabel(d.documentType),
  updated_at: (d) => d.updatedAt || '',
  display_order: (d) => d.displayOrder ?? 0,
  is_active: (d) => (d.isActive ? 1 : 0),
};

/**
 * Legal Document Management
 *
 * Policies, terms and conditions shown on the public legal pages. Each
 * document type can be used once (enforced by the API).
 */
const LegalDocumentManagement = () => {
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('display_order');
  const [sortDir, setSortDir] = useState('asc');
  const [togglingId, setTogglingId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/cms-admin/legal-documents');
      setDocuments(response || []);
    } catch (err) {
      setError(err.message || 'Failed to load legal documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const visibleDocuments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = documents.filter((doc) => {
      const matchesSearch = !term ||
        doc.title?.toLowerCase().includes(term) ||
        doc.slug?.toLowerCase().includes(term) ||
        doc.content?.toLowerCase().includes(term);
      return matchesSearch && (filterType === 'all' || doc.documentType === filterType);
    });
    const value = SORT_VALUE[sortBy] || ((d) => d[sortBy]);
    return filtered.sort((a, b) => compareValues(value(a), value(b), sortDir));
  }, [documents, searchTerm, filterType, sortBy, sortDir]);

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (key === sortBy ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
  }, [sortBy]);

  const usedTypes = useMemo(() => new Set(documents.map((d) => d.documentType)), [documents]);
  const allTypesUsed = usedTypes.size >= LEGAL_DOCUMENT_TYPES.length;

  // Type options: types used by other documents are disabled
  const fieldSchemaFor = (doc) => {
    const options = LEGAL_DOCUMENT_TYPES.map((t) => ({
      ...t,
      disabled: usedTypes.has(t.value) && t.value !== doc.documentType,
      label: usedTypes.has(t.value) && t.value !== doc.documentType ? `${t.label} (in use)` : t.label,
    }));
    return [{ key: 'documentType', options }];
  };

  const handleCreate = () => {
    const firstFree = LEGAL_DOCUMENT_TYPES.find((t) => !usedTypes.has(t.value))?.value || '';
    setEditing({
      title: '',
      documentType: firstFree,
      content: '',
      shortDescription: '',
      slug: '',
      version: '1.0',
      effectiveDate: '',
      metaTitle: '',
      metaDescription: '',
      displayOrder: documents.length,
      isActive: true,
    });
  };

  const handleEdit = (doc) => {
    setEditing({
      id: doc.id,
      title: doc.title || '',
      documentType: doc.documentType,
      content: doc.content || '',
      shortDescription: doc.shortDescription || '',
      slug: doc.slug || '',
      version: doc.version || '1.0',
      effectiveDate: doc.effectiveDate || '',
      metaTitle: doc.metaTitle || '',
      metaDescription: doc.metaDescription || '',
      displayOrder: doc.displayOrder ?? 0,
      isActive: doc.isActive ?? true,
    });
  };

  const handleSave = async (data) => {
    // Backend schemas expect snake_case; empty optional strings are sent as null
    const payload = {
      title: data.title,
      document_type: data.documentType,
      content: data.content,
      short_description: data.shortDescription || null,
      slug: data.slug || null,
      version: data.version || '1.0',
      effective_date: data.effectiveDate || null,
      meta_title: data.metaTitle || null,
      meta_description: data.metaDescription || null,
      display_order: data.displayOrder ?? 0,
      is_active: data.isActive ?? true,
    };

    if (!editing?.id && !payload.slug) {
      throw new Error('A URL slug is required for new documents.');
    }

    if (editing?.id) {
      await apiClient.put(`/api/v1/cms-admin/legal-documents/${editing.id}`, payload);
    } else {
      await apiClient.post('/api/v1/cms-admin/legal-documents', payload);
    }
    toast.success(editing?.id ? 'Document saved' : 'Document created');
    setEditing(null);
    await fetchDocuments();
  };

  const confirmDelete = async () => {
    const doc = pendingDelete;
    if (!doc) return;
    try {
      await apiClient.delete(`/api/v1/cms-admin/legal-documents/${doc.id}`);
      toast.success(`Deleted "${doc.title}"`);
      await fetchDocuments();
    } catch (err) {
      toast.error(`Couldn't delete document: ${err.message}`);
    }
  };

  const handleToggleActive = async (doc) => {
    setTogglingId(doc.id);
    try {
      await apiClient.put(`/api/v1/cms-admin/legal-documents/${doc.id}`, { is_active: !doc.isActive });
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, isActive: !doc.isActive } : d)));
      toast.success(doc.isActive ? `"${doc.title}" unpublished` : `"${doc.title}" published`);
    } catch (err) {
      toast.error(`Couldn't update status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const headClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-100';

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary-500/10 p-2.5">
            <FileText className="h-6 w-6 text-primary-500" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-dark-50 sm:text-2xl">Legal Documents</h2>
            <p className="text-sm text-dark-100">
              Policies, terms and conditions published on the website
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreate}
          variant="primary"
          size="sm"
          disabled={allTypesUsed}
          title={allTypesUsed ? 'Every document type already has a document' : undefined}
          className="gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-200" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search documents"
            placeholder="Search title, slug or content…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2.5 pl-10 pr-4 text-dark-50 placeholder-dark-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>
        <select
          aria-label="Filter by type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-dark-500 bg-dark-800 px-3 py-2.5 text-dark-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 sm:w-64"
        >
          <option value="all">All types</option>
          {LEGAL_DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={() => { setLoading(true); fetchDocuments(); }}>Retry</Button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="overflow-hidden rounded-xl border border-dark-600 bg-dark-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-dark-600 bg-dark-900/60">
                <tr>
                  <TableSortHead label="Document" sortKey="title" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={headClass} />
                  <TableSortHead label="Type" sortKey="document_type" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={headClass} />
                  <th className={headClass}>Version</th>
                  <TableSortHead label="Updated" sortKey="updated_at" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={headClass} />
                  <TableSortHead label="Status" sortKey="is_active" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={headClass} />
                  <th className={`${headClass} text-right`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-4">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-dark-700" />
                      </td>
                    </tr>
                  ))
                ) : visibleDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="font-medium text-dark-50">
                        {documents.length === 0 ? 'No legal documents yet' : 'No documents match your filters'}
                      </p>
                      <p className="mt-1 text-sm text-dark-200">
                        {documents.length === 0
                          ? 'Add your privacy policy, terms and other policies.'
                          : 'Try a different search or type.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visibleDocuments.map((doc) => {
                    const publicPath = PUBLIC_PATHS[doc.documentType];
                    return (
                      <tr key={doc.id} className="transition-colors hover:bg-dark-750">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(doc)}
                            className="text-left font-medium text-dark-50 hover:text-primary-400 focus:outline-none focus-visible:underline"
                          >
                            {doc.title}
                          </button>
                          <div className="mt-0.5 font-mono text-xs text-dark-200">/{doc.slug}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-100">
                          {legalDocumentTypeLabel(doc.documentType)}
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-100">
                          v{doc.version || '1.0'}
                          {doc.effectiveDate && (
                            <div className="text-xs text-dark-200">Effective {doc.effectiveDate}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-100">{formatDate(doc.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!!doc.isActive}
                            aria-label={`Published: ${doc.title}`}
                            disabled={togglingId === doc.id}
                            onClick={() => handleToggleActive(doc)}
                            className="group inline-flex items-center gap-2 text-xs font-medium disabled:opacity-50"
                          >
                            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${doc.isActive ? 'bg-green-600' : 'bg-dark-500'}`}>
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${doc.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </span>
                            <span className={doc.isActive ? 'text-green-400' : 'text-dark-200'}>
                              {doc.isActive ? 'Published' : 'Hidden'}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {publicPath && doc.isActive && (
                              <a
                                href={publicPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md p-2 text-dark-100 transition-colors hover:bg-dark-700 hover:text-dark-50"
                                title="View on site"
                                aria-label={`View ${doc.title} on site`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEdit(doc)}
                              className="rounded-md p-2 text-dark-100 transition-colors hover:bg-dark-700 hover:text-primary-400"
                              title="Edit"
                              aria-label={`Edit ${doc.title}`}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(doc)}
                              className="rounded-md p-2 text-dark-100 transition-colors hover:bg-red-950/60 hover:text-red-300"
                              title="Delete"
                              aria-label={`Delete ${doc.title}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && documents.length > 0 && (
            <div className="border-t border-dark-600 px-4 py-2.5 text-xs text-dark-200">
              Showing {visibleDocuments.length} of {documents.length} documents
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditModal
          isOpen
          onClose={() => setEditing(null)}
          onSave={handleSave}
          elementData={editing}
          elementType="legal-document"
          elementId={editing.id ?? 'new'}
          fieldSchemaOverrides={fieldSchemaFor(editing)}
        />
      )}

      <ConfirmModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete legal document?"
        message={pendingDelete ? `"${pendingDelete.title}" will be removed from the website. This can't be undone.` : ''}
        confirmText="Delete"
        confirmButtonVariant="danger"
      />
    </div>
  );
};

export default LegalDocumentManagement;
