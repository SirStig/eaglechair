import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckSquare, ChevronDown, ChevronRight, Download, Edit, FileSpreadsheet,
  FileText, Loader2, Search, Square, X,
} from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import ResponsiveImage from '../../ui/ResponsiveImage';
import { resolveImageUrl, formatStockStatus } from '../../../utils/apiHelpers';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import {
  bulkUpdateProducts, downloadProductIndex, downloadProductsExcel, getRegister, updateProduct, updateVariation,
} from '../../../services/catalogToolsService';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

const PAGE_SIZE = 50;
const INPUT = 'px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none';

const modelLabel = (p) => [p.model_number, p.model_suffix].filter(Boolean).join(' ');
const categoryLabel = (p) => [p.parent_category_name, p.category_name].filter(Boolean).join(' / ');
const errorText = (error, fallback) => error?.response?.data?.detail || fallback;

/** Click-to-edit text cell; commits on Enter / blur, Escape cancels. */
const EditableText = ({ value, onSave, className = '', placeholder = '—' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== (value || '')) await onSave(next);
    else setDraft(value || '');
  };

  if (editing) {
    return (
      <input
        autoFocus
        className={`${INPUT} py-1 w-full`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Click to edit"
      onClick={() => { setDraft(value || ''); setEditing(true); }}
      className={`text-left hover:bg-dark-700 rounded px-1 -mx-1 ${className}`}
    >
      {value || <span className="text-dark-400">{placeholder}</span>}
    </button>
  );
};

/**
 * Product Register - the master list of every product and variation,
 * active or not, with data-quality flags, quick edits, bulk changes and
 * exports of the whole product base (Excel workbook, product index PDF).
 */
const ProductRegister = () => {
  const toast = useToast();
  const toastError = toast.error; // stable (the toast object itself is not)
  const navigate = useNavigate();
  const { refreshKeys } = useAdminRefresh();

  const [data, setData] = useState({ products: [], families: [], issue_labels: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [bulkFamily, setBulkFamily] = useState('');
  const [busy, setBusy] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await getRegister());
    } catch (error) {
      toastError(errorText(error, 'Failed to load the product register'));
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { load(); }, [load, refreshKeys.register]);
  useEffect(() => { setPage(0); }, [search, status, familyFilter, categoryFilter, issueFilter]);

  const categories = useMemo(
    () => [...new Set(data.products.map(categoryLabel).filter(Boolean))].sort(),
    [data.products]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.products.filter((p) => {
      if (status === 'active' && !p.is_active) return false;
      if (status === 'inactive' && p.is_active) return false;
      if (familyFilter === 'none' ? p.family_id : familyFilter && String(p.family_id) !== familyFilter) return false;
      if (categoryFilter && categoryLabel(p) !== categoryFilter) return false;
      if (issueFilter === 'any' ? !p.issues.length : issueFilter && !p.issues.includes(issueFilter)) return false;
      if (!term) return true;
      return (
        modelLabel(p).toLowerCase().includes(term)
        || p.name.toLowerCase().includes(term)
        || (p.family_name || '').toLowerCase().includes(term)
        || p.variations.some((v) => (v.sku || '').toLowerCase().includes(term) || (v.name || '').toLowerCase().includes(term))
      );
    });
  }, [data.products, search, status, familyFilter, categoryFilter, issueFilter]);

  const stats = useMemo(() => ({
    products: data.products.length,
    active: data.products.filter((p) => p.is_active).length,
    variations: data.products.reduce((n, p) => n + p.variations.length, 0),
    flagged: data.products.filter((p) => p.issues.length).length,
  }), [data.products]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const patchLocalProduct = (id, changes) =>
    setData((prev) => ({ ...prev, products: prev.products.map((p) => (p.id === id ? { ...p, ...changes } : p)) }));

  const patchLocalVariation = (productId, variationId, changes) =>
    setData((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id !== productId ? p : {
        ...p,
        variations: p.variations.map((v) => (v.id === variationId ? { ...v, ...changes } : v)),
      })),
    }));

  const saveProduct = async (product, changes) => {
    try {
      await updateProduct(product.id, changes);
      patchLocalProduct(product.id, changes);
      toast.success(`${modelLabel(product)} updated`);
    } catch (error) {
      toast.error(errorText(error, 'Update failed'));
    }
  };

  const saveVariation = async (product, variation, changes) => {
    try {
      const saved = await updateVariation(variation.id, changes);
      patchLocalVariation(product.id, variation.id, saved);
    } catch (error) {
      toast.error(errorText(error, 'Update failed'));
    }
  };

  const toggle = (setter, id) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    visible.forEach((p) => (allVisibleSelected ? next.delete(p.id) : next.add(p.id)));
    return next;
  });

  const runBulk = async (changes, label) => {
    setBusy('bulk');
    try {
      const { updated } = await bulkUpdateProducts({ product_ids: [...selected], ...changes });
      toast.success(`${label}: ${updated} product${updated === 1 ? '' : 's'}`);
      setSelected(new Set());
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Bulk update failed'));
    } finally {
      setBusy(null);
    }
  };

  const runExport = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'excel') await downloadProductsExcel(includeInactive);
      else await downloadProductIndex(includeInactive);
    } catch (error) {
      toast.error(errorText(error, 'Export failed'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Products"
        title="Product Register"
        description={
          <>
            Every product and variation, live or not: {stats.products} products ({stats.active} active),{' '}
            {stats.variations} variations, {stats.flagged} with missing data.
          </>
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-dark-200 mr-2">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="accent-primary-500"
              />
              Include inactive
            </label>
            <Button size="sm" variant="outline" onClick={() => runExport('excel')} disabled={!!busy}>
              {busy === 'excel' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => runExport('index')} disabled={!!busy}>
              {busy === 'index' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Product Index PDF
            </Button>
          </>
        }
      />

      <Card className="bg-dark-800 border-dark-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={`${INPUT} w-full pl-9`}
              placeholder="Search model, name, SKU, family…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className={INPUT} value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)} aria-label="Family">
            <option value="">All families</option>
            <option value="none">No family</option>
            {data.families.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
          </select>
          <select className={INPUT} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {[['', 'All'], ['any', 'Any missing data'], ...Object.entries(data.issue_labels)].map(([key, label]) => (
            <button
              key={key || 'all'}
              type="button"
              onClick={() => setIssueFilter(key)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                issueFilter === key
                  ? 'bg-primary-500 text-dark-900 border-primary-500'
                  : 'border-dark-600 text-dark-200 hover:border-primary-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="bg-dark-800 border-primary-500/50 sticky top-2 z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-dark-100 font-medium mr-2">{selected.size} selected</span>
            <Button size="xs" variant="success" disabled={!!busy} onClick={() => runBulk({ is_active: true }, 'Activated')}>Activate</Button>
            <Button size="xs" variant="danger" disabled={!!busy} onClick={() => runBulk({ is_active: false }, 'Deactivated')}>Deactivate</Button>
            <select className={`${INPUT} py-1`} value={bulkFamily} onChange={(e) => setBulkFamily(e.target.value)} aria-label="Family to set">
              <option value="">Set family…</option>
              <option value="0">(No family)</option>
              {data.families.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
            </select>
            <Button
              size="xs"
              variant="outline"
              disabled={!!busy || bulkFamily === ''}
              onClick={() => runBulk({ family_id: Number(bulkFamily) }, 'Family set')}
            >
              Apply
            </Button>
            <button type="button" className="ml-auto text-dark-300 hover:text-dark-50" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      <Card className="bg-dark-800 border-dark-700 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-900/60 text-dark-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3 w-10">
                  <button type="button" onClick={toggleAllVisible} aria-label="Select page">
                    {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-primary-500" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="p-3 w-14" />
                <th className="p-3 text-left">Model</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left hidden md:table-cell">Family</th>
                <th className="p-3 text-left hidden lg:table-cell">Category</th>
                <th className="p-3 text-left">Variations</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left hidden md:table-cell">Missing</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {visible.map((p) => {
                const open = expanded.has(p.id);
                return (
                  <Fragment key={p.id}>
                    <tr className={`hover:bg-dark-700/40 ${selected.has(p.id) ? 'bg-primary-500/5' : ''}`}>
                      <td className="p-3">
                        <button type="button" onClick={() => toggle(setSelected, p.id)} aria-label={`Select ${modelLabel(p)}`}>
                          {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-primary-500" /> : <Square className="w-4 h-4 text-dark-400" />}
                        </button>
                      </td>
                      <td className="p-2">
                        {p.default_image ? (
                          <ResponsiveImage
                            sizes="40px"
                            fullResolution={false}
                            src={resolveImageUrl(p.default_image)}
                            alt=""
                            className="w-10 h-10 object-contain rounded bg-dark-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-dark-700" />
                        )}
                      </td>
                      <td className="p-3 font-mono text-dark-50 whitespace-nowrap">
                        <EditableText value={p.model_number} onSave={(v) => saveProduct(p, { model_number: v })} />
                        {p.model_suffix && <span className="ml-1 text-dark-300">{p.model_suffix}</span>}
                      </td>
                      <td className="p-3 text-dark-100 min-w-[12rem]">
                        <EditableText value={p.name} onSave={(v) => saveProduct(p, { name: v })} />
                      </td>
                      <td className="p-3 text-dark-200 hidden md:table-cell">{p.family_name || <span className="text-dark-500">—</span>}</td>
                      <td className="p-3 text-dark-300 hidden lg:table-cell">{categoryLabel(p) || '—'}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggle(setExpanded, p.id)}
                          disabled={!p.variations.length}
                          className="inline-flex items-center gap-1 text-dark-200 hover:text-primary-400 disabled:text-dark-500"
                        >
                          {p.variations.length ? (open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                          {p.variations.length}
                        </button>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          title="Click to toggle"
                          onClick={() => saveProduct(p, { is_active: !p.is_active })}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.is_active ? 'bg-green-500/15 text-green-400' : 'bg-dark-600 text-dark-300'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {p.issues.map((issue) => (
                            <span key={issue} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[11px]">
                              <AlertTriangle className="w-3 h-3" />
                              {data.issue_labels[issue] || issue}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          title="Open in product editor"
                          onClick={() => navigate(`/admin/catalog?edit=${p.id}`)}
                          className="text-dark-300 hover:text-primary-400"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {open && p.variations.map((v) => (
                      <tr key={`v${v.id}`} className="bg-dark-900/40 text-xs">
                        <td />
                        <td className="p-2">
                          {v.default_image && (
                            <ResponsiveImage sizes="32px" fullResolution={false} src={resolveImageUrl(v.default_image)} alt="" className="w-8 h-8 object-contain rounded bg-dark-700 ml-1" />
                          )}
                        </td>
                        <td className="p-2 font-mono text-dark-100">
                          <EditableText value={v.sku} onSave={(val) => saveVariation(p, v, { sku: val })} />
                        </td>
                        <td className="p-2 text-dark-200" colSpan={3}>
                          <EditableText value={v.name} placeholder="Add a name" onSave={(val) => saveVariation(p, v, { name: val })} />
                          <span className="text-dark-400 ml-2">
                            {[v.finish, v.upholstery, v.color].filter(Boolean).join(' · ')}
                          </span>
                        </td>
                        <td />
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => saveVariation(p, v, { is_available: !v.is_available })}
                            className={`px-2 py-0.5 rounded-full font-medium ${
                              v.is_available ? 'bg-green-500/15 text-green-400' : 'bg-dark-600 text-dark-300'
                            }`}
                          >
                            {v.is_available ? 'Available' : 'Unavailable'}
                          </button>
                        </td>
                        <td className="p-2 text-dark-400 hidden md:table-cell">{formatStockStatus(v.stock_status)}</td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-dark-400">No products match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 border-t border-dark-700 text-sm text-dark-300">
          <span>{filtered.length} products</span>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="ghost" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Previous</Button>
            <span>Page {page + 1} of {pageCount}</span>
            <Button size="xs" variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage((n) => n + 1)}>Next</Button>
          </div>
        </div>
      </Card>
      <p className="text-xs text-dark-400 flex items-center gap-1">
        <Download className="w-3 h-3" /> Exports always cover the whole product base, not just the filtered rows.
      </p>
    </AdminPage>
  );
};

export default ProductRegister;
