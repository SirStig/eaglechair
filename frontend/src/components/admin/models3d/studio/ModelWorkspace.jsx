/**
 * 3D Studio → Models: model library and part outliner (left), viewport
 * (centre), inspector (right: Configure / Part / Model).
 *
 * The model, and the option picked for each slot, live in the URL so a link
 * reopens the same configuration.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Box, Download, ImagePlus, Link2, Loader2, MousePointerClick, RotateCcw, Save, Trash2, Upload, X,
} from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { useSetUrlParams, useUrlState } from '../../../../hooks/useUrlState';
import ConfirmModal from '../../../ui/ConfirmModal';
import {
  deleteModel, getProduct, searchProducts, setModelThumbnail, updateModel, uploadModel,
} from '../../../../services/models3dService';
import { resolveImageUrl } from '../../../../utils/apiHelpers';
import {
  KINDS, SLOTS, SLOT_KEYS, materialSlot, optionImage, optionKey, optionKind, optionLabel, optionText, resolveMaterial,
} from '../materialKinds';
import { applyMaterial } from '../slotMaterial';
import { averageColor } from '../loaders';
import Viewport from './Viewport';
import {
  Field, InfoRows, SearchInput, Section, Segmented, Slider, inputClass,
} from './ui';
import { formatBytes, formatCount } from './format';

const TABS = [
  { value: 'configure', label: 'Configure' },
  { value: 'part', label: 'Part' },
  { value: 'model', label: 'Model' },
];
const INCH = 39.3701;
// Which kind group a slot's option list opens on
const SLOT_GROUP = { frame: 'Wood', metal: 'Metal' };

const slotSettings = (settings, slot) => settings?.[slot] || {};

export default function ModelWorkspace({ models, setModels, refreshModels, library, index, saveConfig, catalog }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const engineRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadState, setLoadState] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [scene, setScene] = useState(null); // { parts, vertices, loadMs, size, modelId }
  const [selectedPart, setSelectedPart] = useState(null);
  const [tab, setTab] = useState('configure');
  const [settings, setSettings] = useState({});
  const [avgColors, setAvgColors] = useState({});
  const [modelQuery, setModelQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const setParams = useSetUrlParams();
  const [modelParam] = useUrlState('model', null);
  const [pickUpholstery] = useUrlState('upholstery', null);
  const [pickFrame] = useUrlState('frame', null);
  const [pickMetal] = useUrlState('metal', null);
  const [pickTop] = useUrlState('top', null);
  const pickIds = useMemo(
    () => ({ upholstery: pickUpholstery, frame: pickFrame, metal: pickMetal, top: pickTop }),
    [pickUpholstery, pickFrame, pickMetal, pickTop],
  );

  const model = models.find((m) => m.id === modelParam) || models[0] || null;
  const savedSettings = model?.settings;
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings || {});

  const selectModel = (id) => {
    if (id === model?.id) return;
    setParams({ model: id, upholstery: null, frame: null, metal: null, top: null }, { push: true });
  };

  const picked = useMemo(() => Object.fromEntries(SLOT_KEYS.map((slot) => {
    const source = SLOTS[slot].source;
    return [slot, catalog[source]?.find((i) => String(i.id) === pickIds[slot]) || null];
  })), [catalog, pickIds]);

  useEffect(() => { setSettings(savedSettings || {}); }, [model?.id, savedSettings]);

  const onEngine = useCallback((engine) => {
    engineRef.current = engine;
    setEngineReady(Boolean(engine));
    if (engine) engine.onSelect = (material) => {
      setSelectedPart(material);
      if (material) setTab('part');
    };
  }, []);

  // Load the model
  const modelUrl = model?.url;
  const modelId = model?.id;
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !modelUrl) return undefined;
    let cancelled = false;
    setLoadState({ label: 'Loading model…', progress: 0 });
    setLoadError(null);
    setScene(null);
    setSelectedPart(null);
    engine.loadModel(modelUrl, { onProgress: (p) => !cancelled && setLoadState({ label: 'Loading model…', progress: p }) })
      .then((result) => {
        if (cancelled || !result) return;
        setScene({ ...result, modelId });
        setLoadState(null);
      })
      .catch((err) => {
        console.error('Failed to load 3D model:', err);
        if (!cancelled) {
          setLoadState(null);
          setLoadError('This model could not be loaded.');
        }
      });
    return () => { cancelled = true; };
  }, [engineReady, modelUrl, modelId]);

  const slotMap = settings.slotMap;
  const partSlots = useMemo(() => {
    const map = new Map();
    for (const part of scene?.parts || []) map.set(part.material, materialSlot(part.material, slotMap || {}));
    return map;
  }, [scene, slotMap]);
  const slotsPresent = useMemo(() => SLOT_KEYS.filter((s) => [...partSlots.values()].includes(s)), [partSlots]);

  // Swatches without a hex use their image's average colour
  useEffect(() => {
    for (const slot of SLOT_KEYS) {
      const item = picked[slot];
      const image = optionImage(item);
      if (!item || item.color_hex || !image) continue;
      const key = optionKey(SLOTS[slot].source, item);
      if (avgColors[key]) continue;
      averageColor(resolveImageUrl(image))
        .then((hex) => setAvgColors((c) => ({ ...c, [key]: hex })))
        .catch(() => setAvgColors((c) => ({ ...c, [key]: '#888888' })));
    }
  }, [picked, avgColors]);

  // Dress each slot in its picked option's material (last pick wins)
  const applyTokens = useRef({});
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !scene) return;
    const bySlot = { none: [] };
    for (const [material, slot] of partSlots) (bySlot[slot || 'none'] ||= []).push(material);
    applyMaterial(bySlot.none, null).then(() => engine.requestRender());
    for (const slot of SLOT_KEYS) {
      const materials = bySlot[slot];
      if (!materials?.length) continue;
      const item = picked[slot];
      const grain = slotSettings(settings, slot).grain || 1;
      const token = {};
      applyTokens.current[slot] = token;
      let lib = null;
      let color = null;
      let swatchUrl = null;
      if (item) {
        const source = SLOTS[slot].source;
        const key = optionKey(source, item);
        lib = resolveMaterial(key, optionKind(source, item), library.config, index);
        color = item.color_hex || avgColors[key];
        swatchUrl = optionImage(item) ? resolveImageUrl(optionImage(item)) : null;
        // Wait for the swatch's colour rather than flashing grey
        if (lib.tint && !color) continue;
      }
      applyMaterial(materials, lib, { color, grain, swatchUrl })
        .then(() => applyTokens.current[slot] === token && engine.requestRender())
        .catch((err) => {
          console.error(`Failed to apply ${slot} material:`, err);
          toast.error(`Could not load the ${SLOTS[slot].label.toLowerCase()} material`);
        });
    }
  }, [scene, partSlots, picked, settings, library.config, index, avgColors, toast]);

  useEffect(() => { engineRef.current?.highlight(selectedPart); }, [selectedPart]);

  // A model without a thumbnail gets one from its first clean view
  const thumbTried = useRef(new Set());
  const captureThumbnail = useCallback(async (silent = false) => {
    const engine = engineRef.current;
    if (!engine || !model) return;
    const data = engine.snapshot({ width: 360 });
    const blob = await (await fetch(data)).blob();
    try {
      const updated = await setModelThumbnail(model.id, blob);
      setModels((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      if (!silent) toast.success('Thumbnail updated');
    } catch (err) {
      if (!silent) toast.error(err?.message || 'Could not save the thumbnail');
    }
  }, [model, setModels, toast]);
  useEffect(() => {
    if (!scene || !model || model.thumbnail_url || thumbTried.current.has(model.id)) return undefined;
    thumbTried.current.add(model.id);
    const t = setTimeout(() => captureThumbnail(true), 900);
    return () => clearTimeout(t);
  }, [scene, model, captureThumbnail]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const created = await uploadModel(file, { name: file.name.replace(/\.glb$/i, '') });
      await refreshModels();
      selectModel(created.id);
      const saved = created.optimized && created.optimized.before - created.optimized.after;
      toast.success(saved > 1024 * 100 ? `Model uploaded · textures optimised, ${formatBytes(saved)} smaller` : 'Model uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    const target = confirmDelete;
    try {
      await deleteModel(target.id);
      if (target.id === model?.id) setParams({ model: null, upholstery: null, frame: null, metal: null, top: null });
      await refreshModels();
      toast.success('Model deleted');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const saveSettings = async () => {
    try {
      const updated = await updateModel(model.id, { settings });
      setModels((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      toast.success('Model settings saved');
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    }
  };

  const setSlotSetting = (slot, patch) => setSettings((s) => ({ ...s, [slot]: { ...slotSettings(s, slot), ...patch } }));
  const setPartSlot = (material, slot) => setSettings((s) => {
    const next = { ...(s.slotMap || {}) };
    if (slot === 'auto') delete next[material.name];
    else next[material.name] = slot === 'none' ? null : slot;
    return { ...s, slotMap: next };
  });

  const visibleModels = modelQuery.trim()
    ? models.filter((m) => m.name.toLowerCase().includes(modelQuery.trim().toLowerCase()))
    : models;

  const info = scene && model ? [
    ['File', formatBytes(model.size)],
    ['Load', `${scene.loadMs} ms`],
  ] : [];

  return (
    <div className="grid lg:h-full lg:grid-cols-[264px_minmax(0,1fr)_340px]">
      {/* Left: library + outliner */}
      <aside className="flex min-h-0 flex-col border-white/[0.06] bg-dark-900 lg:border-r">
        <div className="flex items-center gap-2 border-b border-white/[0.06] p-2.5">
          <SearchInput value={modelQuery} onChange={setModelQuery} placeholder={`Search ${models.length} models`} />
          <input ref={fileRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={handleUpload} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Upload a .glb model"
            className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md bg-primary-500 px-2.5 text-xs font-semibold text-dark-950 hover:bg-primary-400 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            .glb
          </button>
        </div>
        <ul className="max-h-60 min-h-0 overflow-y-auto p-1.5 lg:max-h-none lg:flex-[3]">
          {visibleModels.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-dark-200">
              {models.length ? 'No models match.' : 'No models yet. Upload a .glb to start.'}
            </li>
          )}
          {visibleModels.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => selectModel(m.id)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors',
                  m.id === model?.id ? 'bg-primary-500/15 text-dark-50' : 'text-dark-100 hover:bg-white/[0.04]',
                )}
              >
                <span className="flex h-10 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-b from-[#f4f2ee] to-[#dedad2]">
                  {m.thumbnail_url
                    ? <img src={m.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                    : <Box className="h-4 w-4 text-dark-300" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{m.name}</span>
                  <span className="block truncate text-[11px] text-dark-200">
                    {formatBytes(m.size)}
                    {m.summary ? ` · ${formatCount(m.summary.triangles)} tris` : ''}
                    {m.product_id ? ' · linked' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {scene && (
          <div className="flex min-h-0 flex-col border-t border-white/[0.06] lg:flex-[2]">
            <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-dark-200">Parts</p>
            <ul className="min-h-0 overflow-y-auto px-1.5 pb-2">
              {scene.parts.map((part) => {
                const slot = partSlots.get(part.material);
                return (
                  <li key={part.material.uuid}>
                    <button
                      type="button"
                      onClick={() => { setSelectedPart(part.material); setTab('part'); }}
                      className={clsx(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                        selectedPart === part.material ? 'bg-white/[0.08] text-dark-50' : 'text-dark-100 hover:bg-white/[0.04]',
                      )}
                    >
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-sm border border-white/20"
                        style={{ background: `#${part.material.userData.ecOriginal?.color.getHexString() ?? part.material.color.getHexString()}` }}
                      />
                      <span className="min-w-0 flex-1 truncate">{part.material.name || 'Unnamed material'}</span>
                      <span className={clsx('rounded px-1.5 py-0.5 text-[10px]', slot ? 'bg-primary-500/15 text-primary-400' : 'bg-white/[0.05] text-dark-200')}>
                        {slot ? SLOTS[slot].label : 'Fixed'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>

      {/* Centre: viewport */}
      <div className="h-[58vh] min-h-[360px] lg:h-auto">
        <Viewport
          onEngine={onEngine}
          loading={loadState}
          error={loadError}
          empty={!model && (models.length ? 'Select a model' : 'Upload a .glb model to start')}
          info={info}
          snapshotName={[model?.name, ...SLOT_KEYS.map((s) => picked[s]?.name)].filter(Boolean).join(' - ') || 'model'}
        />
      </div>

      {/* Right: inspector */}
      <aside className="flex min-h-0 flex-col border-white/[0.06] bg-dark-900 lg:border-l">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <Segmented value={tab} onChange={setTab} options={TABS} size="md" className="w-full [&>button]:flex-1 [&>button]:justify-center" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!model ? (
            <p className="p-4 text-sm text-dark-200">No model selected.</p>
          ) : tab === 'configure' ? (
            <>
              {scene && slotsPresent.length === 0 && (
                <div className="m-3 rounded-md border border-white/[0.08] bg-dark-800 p-3 text-xs leading-relaxed text-dark-100">
                  No configurable parts found. Pick a part (click it in the viewport or the Parts list) and assign it a slot,
                  or tag materials in Blender with the custom property <code className="text-primary-400">ec_slot</code>.
                </div>
              )}
              {slotsPresent.map((slot) => (
                <SlotOptions
                  key={`${model.id}-${slot}`}
                  slot={slot}
                  items={catalog[SLOTS[slot].source] || []}
                  picked={picked[slot]}
                  onPick={(item) => setParams({ [slot]: item ? item.id : null })}
                  grain={slotSettings(settings, slot).grain ?? 1}
                  onGrain={(grain) => setSlotSetting(slot, { grain })}
                  library={library}
                  index={index}
                  saveConfig={saveConfig}
                />
              ))}
            </>
          ) : tab === 'part' ? (
            <PartInspector
              part={scene?.parts.find((p) => p.material === selectedPart)}
              slot={selectedPart ? partSlots.get(selectedPart) : null}
              override={selectedPart && settings.slotMap && Object.prototype.hasOwnProperty.call(settings.slotMap, selectedPart.name)
                ? settings.slotMap[selectedPart.name] : undefined}
              onSlot={(slot) => setPartSlot(selectedPart, slot)}
              onClear={() => setSelectedPart(null)}
            />
          ) : (
            <ModelInspector
              model={model}
              scene={scene}
              onSaved={(updated) => setModels((list) => list.map((m) => (m.id === updated.id ? updated : m)))}
              onThumbnail={() => captureThumbnail(false)}
              onDelete={() => setConfirmDelete(model)}
            />
          )}
        </div>
        {model && dirty && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] bg-dark-800 px-3 py-2.5">
            <span className="flex-1 text-xs text-dark-100">Unsaved model settings</span>
            <button type="button" onClick={() => setSettings(savedSettings || {})} className="h-8 rounded-md px-2.5 text-xs text-dark-100 hover:bg-white/[0.06]">
              Revert
            </button>
            <button type="button" onClick={saveSettings} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-500 px-3 text-xs font-semibold text-dark-950 hover:bg-primary-400">
              <Save className="h-3.5 w-3.5" />Save
            </button>
          </div>
        )}
      </aside>

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete model?"
        message={`"${confirmDelete?.name}" and its file will be removed.`}
        confirmText="Delete"
      />
    </div>
  );
}

/** One slot's catalog options: kind filter, search, swatches, and how the pick renders. */
function SlotOptions({ slot, items, picked, onPick, grain, onGrain, library, index, saveConfig }) {
  const source = SLOTS[slot].source;
  const kinds = useMemo(() => new Map(items.map((i) => [i.id, optionKind(source, i)])), [items, source]);
  const groups = useMemo(() => [...new Set([...kinds.values()].map((k) => KINDS[k].group))], [kinds]);
  const [group, setGroup] = useState(() => (groups.includes(SLOT_GROUP[slot]) ? SLOT_GROUP[slot] : 'all'));
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => (group === 'all' || KINDS[kinds.get(i.id)].group === group) && (!q || optionText(i).includes(q)));
  const key = picked ? optionKey(source, picked) : null;
  const kind = picked ? kinds.get(picked.id) : null;
  const rendered = picked ? resolveMaterial(key, kind, library.config, index) : null;
  const assigned = key ? library.config.assignments[key] : null;

  const assign = (materialId) => {
    const assignments = { ...library.config.assignments };
    if (materialId) assignments[key] = materialId;
    else delete assignments[key];
    saveConfig({ ...library.config, assignments }).catch(() => {});
  };

  const candidates = Object.values(index).filter((m) => m.kind === kind || m.swatch || (KINDS[m.kind]?.group === KINDS[kind]?.group));

  return (
    <Section
      title={SLOTS[slot].label}
      aside={<span className="max-w-[45%] truncate text-[11px] text-dark-200">{picked ? optionLabel(source, picked) : 'Original'}</span>}
    >
      {groups.length > 1 && (
        <Segmented
          value={group}
          onChange={setGroup}
          options={[{ value: 'all', label: 'All' }, ...groups.map((g) => ({ value: g, label: g }))]}
          className="mb-2 flex-wrap"
        />
      )}
      <SearchInput value={query} onChange={setQuery} placeholder={`Search ${visible.length} ${source === 'finish' ? 'finishes' : source === 'laminate' ? 'laminates' : 'upholsteries'}`} />
      <div className="mt-2 grid max-h-52 grid-cols-6 gap-1 overflow-y-auto pr-0.5">
        <button
          type="button"
          title="Original (as modelled)"
          onClick={() => onPick(null)}
          className={clsx(
            'flex aspect-square items-center justify-center rounded border text-dark-200',
            !picked ? 'border-primary-500 ring-1 ring-primary-500' : 'border-white/[0.1] hover:border-white/30',
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {visible.map((item) => {
          const image = optionImage(item);
          return (
            <button
              key={item.id}
              type="button"
              title={`${optionLabel(source, item)} · ${KINDS[kinds.get(item.id)].label}`}
              onClick={() => onPick(item)}
              className={clsx(
                'aspect-square overflow-hidden rounded border [content-visibility:auto]',
                picked?.id === item.id ? 'border-primary-500 ring-1 ring-primary-500' : 'border-white/[0.1] hover:border-white/30',
              )}
              style={{ background: item.color_hex || '#777' }}
            >
              {image && <img src={resolveImageUrl(image)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
            </button>
          );
        })}
      </div>
      {visible.length === 0 && <p className="mt-2 text-xs text-dark-200">No options match.</p>}

      {picked && (
        <div className="mt-3 rounded-md bg-dark-800 p-2.5">
          <p className="truncate text-xs font-medium text-dark-50">{optionLabel(source, picked)}</p>
          <p className="mt-0.5 text-[11px] text-dark-200">
            {KINDS[kind].label}
            {picked.color_hex ? ` · ${picked.color_hex}` : ' · colour from swatch'}
          </p>
          <Field label="Rendered with">
            <select value={assigned || ''} onChange={(e) => assign(e.target.value || null)} className={inputClass}>
              <option value="">{`${KINDS[kind].label} default (${resolveMaterial(null, kind, library.config, index).name})`}</option>
              {candidates.map((m) => <option key={m.id} value={m.id}>{m.name}{m.builtin ? '' : ' · uploaded'}</option>)}
            </select>
          </Field>
          {rendered?.swatch && !optionImage(picked) && (
            <p className="mt-1 text-[11px] text-amber-300">This option has no swatch image to use as a texture.</p>
          )}
        </div>
      )}
      <Slider label="Texture scale" value={grain} min={0.1} max={4} step={0.05} defaultValue={1} format={(v) => `${v.toFixed(2)}×`} onChange={onGrain} />
    </Section>
  );
}

function PartInspector({ part, slot, override, onSlot, onClear }) {
  if (!part) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center text-xs text-dark-200">
        <MousePointerClick className="mb-2 h-6 w-6" />
        Click a part in the viewport, or pick one from the Parts list.
      </div>
    );
  }
  const m = part.material;
  const orig = m.userData.ecOriginal || m;
  const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].filter((k) => orig[k]);
  const triangles = part.meshes.reduce((n, mesh) => n + (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3, 0);
  const detected = materialSlot(m, {});
  return (
    <>
      <Section title="Part" aside={<button type="button" onClick={onClear} aria-label="Clear selection" className="text-dark-200 hover:text-dark-50"><X className="h-3.5 w-3.5" /></button>}>
        <p className="mb-2 truncate text-sm font-medium text-dark-50">{m.name || 'Unnamed material'}</p>
        <Field label="Configurable slot">
          <select
            value={override === undefined ? 'auto' : override === null ? 'none' : override}
            onChange={(e) => onSlot(e.target.value)}
            className={inputClass}
            disabled={!m.name}
          >
            <option value="auto">Auto ({detected ? SLOTS[detected].label : 'fixed'})</option>
            {Object.entries(SLOTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
            <option value="none">Fixed (not configurable)</option>
          </select>
        </Field>
        {!m.name && <p className="text-[11px] text-amber-300">Unnamed materials can't be remapped. Name it in Blender.</p>}
        <p className="mt-1 text-[11px] text-dark-200">Slot changes apply now; Save keeps them for this model.</p>
      </Section>
      <Section title="Details">
        <InfoRows rows={[
          ['Slot', slot ? SLOTS[slot].label : 'Fixed'],
          ['Tagged kind', m.userData.ec_kind || '—'],
          ['Meshes', part.meshes.length],
          ['Triangles', formatCount(Math.round(triangles))],
          ['Maps', maps.length ? maps.map((k) => k.replace('Map', '')).join(', ') : 'none'],
        ]}
        />
      </Section>
    </>
  );
}

function ModelInspector({ model, scene, onSaved, onThumbnail, onDelete }) {
  const toast = useToast();
  const [name, setName] = useState(model.name);
  useEffect(() => setName(model.name), [model.name]);

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === model.name) return setName(model.name);
    try {
      onSaved(await updateModel(model.id, { name: next }));
    } catch (err) {
      toast.error(err?.message || 'Could not rename');
    }
    return undefined;
  };

  const size = scene?.size;
  const summary = model.summary;
  return (
    <>
      <Section title="Model">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={inputClass}
          />
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={onThumbnail} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-xs text-dark-50 hover:bg-white/[0.1]">
            <ImagePlus className="h-3.5 w-3.5" />Use view as thumbnail
          </button>
          <a href={model.url} download className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-xs text-dark-50 hover:bg-white/[0.1]">
            <Download className="h-3.5 w-3.5" />.glb
          </a>
        </div>
      </Section>
      <ProductLink model={model} onSaved={onSaved} />
      <Section title="File">
        <InfoRows rows={[
          ['Size', formatBytes(model.size)],
          model.optimized && model.optimized.before !== model.optimized.after
            && ['Original', `${formatBytes(model.optimized.before)} (−${Math.round((1 - model.optimized.after / model.optimized.before) * 100)}%)`],
          summary && ['Triangles', formatCount(summary.triangles)],
          summary && ['Vertices', formatCount(summary.vertices)],
          summary && ['Meshes', summary.meshes],
          summary && ['Materials', summary.materials],
          summary && ['Textures', summary.textures],
          size && ['Dimensions', `${(size.x * INCH).toFixed(1)}″ W × ${(size.z * INCH).toFixed(1)}″ D × ${(size.y * INCH).toFixed(1)}″ H`],
          scene && ['Load time', `${scene.loadMs} ms`],
          ['Uploaded', new Date(model.uploaded_at * 1000).toLocaleDateString()],
        ]}
        />
        {summary?.extensions?.length > 0 && <p className="mt-2 text-[11px] text-dark-200">Extensions: {summary.extensions.join(', ')}</p>}
      </Section>
      <Section title="Danger zone" defaultOpen={false}>
        <button type="button" onClick={onDelete} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 text-xs text-red-300 hover:bg-red-500/20">
          <Trash2 className="h-3.5 w-3.5" />Delete model
        </button>
      </Section>
    </>
  );
}

function ProductLink({ model, onSaved }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [product, setProduct] = useState(null);

  useEffect(() => {
    setProduct(null);
    if (!model.product_id) return;
    getProduct(model.product_id).then(setProduct).catch(() => setProduct(null));
  }, [model.product_id]);

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
    <Section title="Product" aside={<Link2 className="h-3.5 w-3.5 text-dark-200" />}>
      {model.product_id ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-dark-800 px-2.5 py-2 text-xs">
          <span className="min-w-0 truncate text-dark-50">
            {product ? `${product.model_number} · ${product.name}` : `Product #${model.product_id}`}
          </span>
          <button type="button" onClick={() => link(null)} className="flex-shrink-0 text-dark-200 hover:text-red-300">Unlink</button>
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-dark-200">Not linked. Link it so the product page can show it later.</p>
      )}
      <SearchInput value={q} onChange={setQ} placeholder="Search products by name or model #" />
      {results.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-white/[0.08]">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => link(p.id)} className="w-full truncate px-2.5 py-1.5 text-left text-xs text-dark-100 hover:bg-white/[0.06]">
                {p.model_number} · {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
