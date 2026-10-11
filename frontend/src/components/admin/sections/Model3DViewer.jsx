import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Camera, Download, Link2, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import { useToast } from '../../../contexts/ToastContext';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import {
  deleteModel, listFinishes, listModels, listUpholsteries, searchProducts, updateModel, uploadModel,
} from '../../../services/models3dService';
import { averageColor, optionKind } from '../models3d/slotMaterial';

// three.js is large; only load it when this page opens
const ChairViewer = lazy(() => import('../models3d/ChairViewer'));

const SLOT_INFO = {
  upholstery: { label: 'Upholstery' },
  frame: { label: 'Wood / Frame Finish' },
};

const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const optionImage = (item) => item.swatch_image_url || item.image_url || null;

export default function Model3DViewer() {
  const toast = useToast();
  const viewerRef = useRef(null);
  const fileRef = useRef(null);
  const [models, setModels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [catalog, setCatalog] = useState({ upholstery: [], frame: [] });
  const [slots, setSlots] = useState([]);
  const [picked, setPicked] = useState({ upholstery: null, frame: null });
  const [settings, setSettings] = useState({});
  const [search, setSearch] = useState({ upholstery: '', frame: '' });
  const [avgColors, setAvgColors] = useState({});
  const [dark, setDark] = useState(false);

  const selected = models.find((m) => m.id === selectedId) || null;

  const refresh = useCallback(async () => {
    const res = await listModels();
    setModels(res.models || []);
    setSelectedId((id) => (res.models || []).some((m) => m.id === id) ? id : res.models?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    refresh().catch(() => toast.error('Could not load 3D models'));
    Promise.all([listUpholsteries(), listFinishes()])
      .then(([u, f]) => setCatalog({ upholstery: u.items || [], frame: f.items || [] }))
      .catch(() => toast.error('Could not load upholstery and finishes'));
  }, [refresh, toast]);

  // Each model keeps its own swatch scale / shading settings
  useEffect(() => {
    if (!selected) return;
    const saved = selected.settings || {};
    setSettings(Object.fromEntries(Object.keys(SLOT_INFO).map((slot) => [slot, {
      grain: saved[slot]?.grain ?? 1,
    }])));
    setPicked({ upholstery: null, frame: null });
  }, [selected]);

  // Options without a hex use their swatch image's average colour
  useEffect(() => {
    for (const slot of Object.keys(SLOT_INFO)) {
      const item = picked[slot];
      if (!item || item.color_hex || !optionImage(item)) continue;
      const key = `${slot}:${item.id}`;
      if (avgColors[key]) continue;
      averageColor(resolveImageUrl(optionImage(item)))
        .then((hex) => setAvgColors((c) => ({ ...c, [key]: hex })))
        .catch(() => {});
    }
  }, [picked, avgColors]);

  const options = useMemo(() => Object.fromEntries(Object.keys(SLOT_INFO).map((slot) => {
    const item = picked[slot];
    if (!item) return [slot, null];
    const colorHex = item.color_hex || avgColors[`${slot}:${item.id}`];
    // Wait for the swatch's colour rather than flashing grey
    if (!colorHex) return [slot, null];
    return [slot, { colorHex, kind: optionKind(slot, item) }];
  })), [picked, avgColors]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const model = await uploadModel(file, { name: file.name.replace(/\.glb$/i, '') });
      await refresh();
      setSelectedId(model.id);
      toast.success('Model uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (model) => {
    if (!window.confirm(`Delete "${model.name}"? This removes the file.`)) return;
    try {
      await deleteModel(model.id);
      await refresh();
      toast.success('Model deleted');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const saveSettings = async () => {
    try {
      const updated = await updateModel(selected.id, { settings });
      setModels((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      toast.success('Viewer settings saved for this model');
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    }
  };

  const snapshot = () => {
    const data = viewerRef.current?.snapshot();
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = `${selected?.name || 'model'}.png`;
    a.click();
  };

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Publishing"
        title="3D Viewer"
        icon={Box}
        description="Preview configurable 3D product models and try upholstery and finish combinations"
        actions={
          <>
            <input ref={fileRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-primary-600 hover:bg-primary-500">
              <Upload className="mr-2 h-4 w-4" />{uploading ? 'Uploading…' : 'Upload .glb'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Model list */}
        <Card className="bg-dark-800 border-dark-700 p-3 xl:max-h-[78vh] xl:overflow-y-auto">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dark-300">Models</p>
          {models.length === 0 && <p className="text-sm text-dark-300">No models yet. Upload a .glb to start.</p>}
          <ul className="space-y-1">
            {models.map((m) => (
              <li key={m.id}>
                <div
                  className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm ${m.id === selectedId ? 'bg-primary-600/20 text-dark-50' : 'text-dark-200 hover:bg-dark-700'}`}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(m.id)}>
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block text-xs text-dark-300">{formatSize(m.size)}{m.product_id ? ' · linked' : ''}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => handleDelete(m)}
                    className="rounded p-1 text-dark-300 opacity-0 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Viewer */}
        <Card className="bg-dark-800 border-dark-700 p-2">
          <div className="h-[62vh] min-h-[380px] xl:h-[72vh]">
            {selected ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-dark-200">Loading viewer…</div>}>
                <ChairViewer
                  ref={viewerRef}
                  url={resolveImageUrl(selected.url)}
                  options={options}
                  settings={settings}
                  onSlotsFound={setSlots}
                  background={dark ? '#1c1b1a' : '#f4f2ee'}
                />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-dark-300">Select or upload a model</div>
            )}
          </div>
          {selected && (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
              <Button variant="outline" size="sm" onClick={() => viewerRef.current?.resetView()}><RotateCcw className="mr-1 h-4 w-4" />Reset view</Button>
              <Button variant="outline" size="sm" onClick={snapshot}><Camera className="mr-1 h-4 w-4" />Snapshot</Button>
              <Button variant="outline" size="sm" onClick={() => setDark((d) => !d)}>{dark ? 'Light' : 'Dark'} backdrop</Button>
              <a href={resolveImageUrl(selected.url)} download className="ml-auto inline-flex items-center text-sm text-dark-200 hover:text-dark-50">
                <Download className="mr-1 h-4 w-4" />.glb
              </a>
            </div>
          )}
        </Card>

        {/* Options */}
        <div className="space-y-4 xl:max-h-[78vh] xl:overflow-y-auto">
          {selected && slots.length === 0 && (
            <Card className="bg-dark-800 border-dark-700 p-3 text-sm text-dark-200">
              This model has no configurable parts. Materials need glTF extras <code>ec_slot</code> (upholstery / frame) or names containing “upholstery” or “frame”.
            </Card>
          )}
          {selected && slots.map((slot) => (
            <SlotPanel
              key={slot}
              slot={slot}
              items={catalog[slot]}
              picked={picked[slot]}
              onPick={(item) => setPicked((p) => ({ ...p, [slot]: item }))}
              search={search[slot]}
              onSearch={(q) => setSearch((s) => ({ ...s, [slot]: q }))}
              value={settings[slot] || {}}
              onChange={(v) => setSettings((s) => ({ ...s, [slot]: { ...s[slot], ...v } }))}
            />
          ))}
          {selected && (
            <>
              <ProductLink model={selected} onSaved={(updated) => setModels((list) => list.map((m) => (m.id === updated.id ? updated : m)))} />
              <Button onClick={saveSettings} className="w-full bg-primary-600 hover:bg-primary-500">
                <Save className="mr-2 h-4 w-4" />Save grain scale for this model
              </Button>
            </>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function SlotPanel({ slot, items, picked, onPick, search, onSearch, value, onChange }) {
  const info = SLOT_INFO[slot];
  const q = search.trim().toLowerCase();
  const visible = q
    ? items.filter((i) => [i.name, i.grade, i.material_type, i.finish_type, i.color, i.finish_code]
      .some((v) => v && String(v).toLowerCase().includes(q)))
    : items;

  return (
    <Card className="bg-dark-800 border-dark-700 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-dark-50">{info.label}</p>
        <span className="truncate pl-2 text-xs text-dark-300">{picked ? picked.name : 'Original (from photos)'}</span>
      </div>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={`Search ${items.length} ${slot === 'frame' ? 'finishes' : 'upholsteries'}…`}
        className="mb-2 w-full rounded-md border border-dark-600 bg-dark-700 px-3 py-1.5 text-sm text-dark-50 outline-none focus:border-primary-500"
      />
      <div className="grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto pr-1">
        <button
          type="button"
          title="Original (from photos)"
          onClick={() => onPick(null)}
          className={`aspect-square rounded border text-[10px] leading-tight text-dark-200 ${!picked ? 'border-primary-500 ring-2 ring-primary-500' : 'border-dark-600'}`}
        >
          Orig.
        </button>
        {visible.map((item) => {
          const image = optionImage(item);
          return (
            <button
              key={item.id}
              type="button"
              title={item.name}
              onClick={() => onPick(item)}
              className={`aspect-square overflow-hidden rounded border ${picked?.id === item.id ? 'border-primary-500 ring-2 ring-primary-500' : 'border-dark-600'}`}
              style={{ background: item.color_hex || '#888' }}
            >
              {image && <img src={resolveImageUrl(image)} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </button>
          );
        })}
      </div>
      {picked && (
        <p className="mt-2 text-xs text-dark-300">
          Shown as {optionKind(slot, picked) === 'leather' ? 'vinyl' : optionKind(slot, picked)}
          {picked.color_hex ? ` · ${picked.color_hex}` : ' · colour from swatch'}
        </p>
      )}
      <label className="mt-3 block text-xs text-dark-200">
        Grain scale: {(value.grain ?? 1).toFixed(2)}×
        <input type="range" min="0.25" max="4" step="0.05" value={value.grain ?? 1}
          onChange={(e) => onChange({ grain: Number(e.target.value) })} className="w-full" />
      </label>
    </Card>
  );
}

function ProductLink({ model, onSaved }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      searchProducts(q.trim()).then((r) => setResults(r.items || [])).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const link = async (productId) => {
    try {
      onSaved(await updateModel(model.id, { product_id: productId }));
      setQ('');
      toast.success(productId ? 'Linked to product' : 'Product link removed');
    } catch (err) {
      toast.error(err?.message || 'Could not save');
    }
  };

  return (
    <Card className="bg-dark-800 border-dark-700 p-3">
      <p className="mb-2 flex items-center text-sm font-semibold text-dark-50"><Link2 className="mr-1.5 h-4 w-4" />Product</p>
      {model.product_id ? (
        <div className="mb-2 flex items-center justify-between text-sm text-dark-200">
          <span>Linked to product #{model.product_id}</span>
          <button type="button" onClick={() => link(null)} className="text-xs text-dark-300 hover:text-red-400">Unlink</button>
        </div>
      ) : (
        <p className="mb-2 text-xs text-dark-300">Not linked. Link it so the product page can show it later.</p>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products by name or model #"
        className="w-full rounded-md border border-dark-600 bg-dark-700 px-3 py-1.5 text-sm text-dark-50 outline-none focus:border-primary-500"
      />
      {results.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-dark-600">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => link(p.id)} className="w-full px-3 py-1.5 text-left text-sm text-dark-200 hover:bg-dark-700">
                {p.model_number} · {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
