/**
 * 3D Studio → Materials: the material library (left), a preview viewport
 * (centre) and the material inspector (right: look, maps, where it is used).
 *
 * Uploads: a glTF material (.glb, e.g. Poly Haven), loose PBR maps, or a .zip
 * of maps (ambientCG / Poly Haven downloads). Drop files anywhere here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Loader2, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { useUrlState } from '../../../../hooks/useUrlState';
import ConfirmModal from '../../../ui/ConfirmModal';
import { deleteMaterial, updateMaterial, uploadMaterial } from '../../../../services/models3dService';
import { resolveImageUrl } from '../../../../utils/apiHelpers';
import {
  KINDS, KIND_KEYS, SOURCES, builtinDefaults, optionImage, optionKey, optionKind, optionLabel, optionText,
} from '../materialKinds';
import { applyMaterial } from '../slotMaterial';
import { averageColor } from '../loaders';
import Viewport from './Viewport';
import {
  Field, InfoRows, SearchInput, Section, Segmented, Slider, Toggle, inputClass,
} from './ui';
import { formatBytes } from './format';

const SHAPES = [
  { value: 'sphere', label: 'Sphere' },
  { value: 'cushion', label: 'Cushion' },
  { value: 'cube', label: 'Cube' },
  { value: 'plane', label: 'Panel' },
];
const PREVIEW_COLORS = {
  fabric: '#5b6b82', vinyl: '#7a2e2a', leather: '#5a3a24', wood: '#8b5a2b', paint: '#2f4f4f', metal: '#b8b8b8',
  chrome: '#e6e6e6', brushed: '#c8c8c8', powder: '#2a2a2a', laminate: '#d9d4c7', laminate_wood: '#b08a5a', other: '#999999',
};
const GROUPS = [...new Set(Object.values(KINDS).map((k) => k.group))];
const MAP_LABELS = { map: 'Colour', normalMap: 'Normal', roughnessMap: 'Roughness', metalnessMap: 'Metalness', aoMap: 'AO' };
const ACCEPT = '.glb,.zip,.jpg,.jpeg,.png,.webp,.tif,.tiff,model/gltf-binary,application/zip,image/*';

/** Look sliders: key, label, range, default when unset. */
const LOOK = [
  ['scale', 'Texture size', 0.05, 8, 1, (v) => `${v.toFixed(2)}×`],
  ['roughness', 'Roughness', 0, 1, null],
  ['metalness', 'Metalness', 0, 1, null],
  ['normalScale', 'Surface relief', 0, 3, 1],
  ['sheen', 'Cloth sheen', 0, 1, 0],
  ['clearcoat', 'Clear coat', 0, 1, 0],
  ['clearcoatRoughness', 'Clear coat roughness', 0, 1, 0.3],
  ['anisotropy', 'Brushed (anisotropy)', 0, 1, 0],
  ['aoIntensity', 'Ambient occlusion', 0, 2, 1],
  ['envIntensity', 'Reflections', 0, 3, 1],
];

const draftOf = (m) => (m ? { name: m.name, kind: m.kind, tint: Boolean(m.tint), settings: { ...(m.settings || {}) } } : null);

export default function MaterialWorkspace({ library, setLibrary, refreshLibrary, index, saveConfig, catalog }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const engineRef = useRef(null);
  const previewRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const [selectedId, setSelectedId] = useUrlState('material', 'builtin:fabric');
  const [shape, setShape] = useUrlState('shape', 'sphere');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(null);
  const [previewColor, setPreviewColor] = useState(null);
  const [previewOption, setPreviewOption] = useState(null); // { source, item }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applyError, setApplyError] = useState(null);

  const all = useMemo(() => Object.values(index), [index]);
  const selected = index[selectedId] || index['builtin:fabric'];
  const { defaults, assignments } = library.config;

  useEffect(() => {
    setDraft(draftOf(selected));
    setPreviewOption(null);
    setPreviewColor(null);
    // Re-seed only when switching materials, not when the same one is saved
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const saved = draftOf(selected);
  const dirty = draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const live = useMemo(() => (selected && draft ? { ...selected, ...draft } : selected), [selected, draft]);

  const onEngine = useCallback((engine) => {
    engineRef.current = engine;
    setEngineReady(Boolean(engine));
  }, []);

  useEffect(() => {
    if (!engineReady) return;
    previewRef.current = engineRef.current.showPreview(shape);
  }, [engineReady, shape]);

  // Preview colour: the picked catalog option's colour, else a typical colour for the kind
  const [optionColor, setOptionColor] = useState(null);
  useEffect(() => {
    setOptionColor(null);
    const item = previewOption?.item;
    if (!item) return;
    if (item.color_hex) setOptionColor(item.color_hex);
    else if (optionImage(item)) averageColor(resolveImageUrl(optionImage(item))).then(setOptionColor).catch(() => {});
  }, [previewOption]);
  const color = previewColor || optionColor || PREVIEW_COLORS[live?.kind] || '#999999';
  const swatchUrl = previewOption?.item && optionImage(previewOption.item) ? resolveImageUrl(optionImage(previewOption.item)) : null;

  useEffect(() => {
    const engine = engineRef.current;
    const material = previewRef.current;
    if (!engine || !material || !live) return undefined;
    let cancelled = false;
    setApplyError(null);
    applyMaterial([material], live, { color, swatchUrl })
      .then(() => !cancelled && engine.requestRender())
      .catch((err) => {
        console.error('Material preview failed:', err);
        if (!cancelled) setApplyError('This material could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [live, color, swatchUrl, engineReady, shape]);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const created = await uploadMaterial([...files]);
      await refreshLibrary();
      setSelectedId(created.id, { push: true });
      toast.success(`Material "${created.name}" added as ${KINDS[created.kind]?.label || created.kind}`);
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      if (selected.builtin) {
        // Built-ins keep only the look settings that differ from what ships
        const base = builtinDefaults(selected.id);
        const changed = Object.fromEntries(Object.entries(draft.settings).filter(([k, v]) => base[k] !== v));
        const overrides = { ...library.config.overrides };
        if (Object.keys(changed).length) overrides[selected.id] = changed;
        else delete overrides[selected.id];
        await saveConfig({ ...library.config, overrides });
      } else {
        const updated = await updateMaterial(selected.id, draft);
        setLibrary((l) => ({ ...l, materials: l.materials.map((m) => (m.id === updated.id ? updated : m)) }));
      }
      toast.success('Material saved');
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMaterial(selected.id);
      setSelectedId('builtin:fabric');
      await refreshLibrary();
      toast.success('Material deleted');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const setDefaultFor = (kind, on) => {
    const next = { ...defaults };
    if (on) next[kind] = selected.id;
    else delete next[kind];
    saveConfig({ ...library.config, defaults: next }).catch(() => {});
  };

  const unassign = (key) => {
    const next = { ...assignments };
    delete next[key];
    saveConfig({ ...library.config, assignments: next }).catch(() => {});
  };

  const assign = (source, item) => {
    saveConfig({ ...library.config, assignments: { ...assignments, [optionKey(source, item)]: selected.id } }).catch(() => {});
  };

  const q = query.trim().toLowerCase();
  const visible = all.filter((m) => (group === 'all' || KINDS[m.kind]?.group === group)
    && (!q || `${m.name} ${KINDS[m.kind]?.label}`.toLowerCase().includes(q)));
  const defaultKinds = (id) => Object.entries(defaults).filter(([, v]) => v === id).map(([k]) => k);
  const isDefaultFor = (kind) => (defaults[kind] || `builtin:${kind}`) === selected?.id;
  const usedBy = Object.entries(assignments).filter(([, v]) => v === selected?.id).map(([k]) => k);

  const optionByKey = useMemo(() => {
    const map = {};
    for (const [source, items] of Object.entries(catalog)) for (const item of items) map[optionKey(source, item)] = { source, item };
    return map;
  }, [catalog]);

  return (
    <div
      className="relative grid lg:h-full lg:grid-cols-[264px_minmax(0,1fr)_340px]"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      {/* Left: library */}
      <aside className="flex min-h-0 flex-col border-white/[0.06] bg-dark-900 lg:border-r">
        <div className="space-y-2 border-b border-white/[0.06] p-2.5">
          <div className="flex items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder={`Search ${all.length} materials`} />
            <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Upload a .glb material, texture maps or a .zip of maps"
              className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md bg-primary-500 px-2.5 text-xs font-semibold text-dark-950 hover:bg-primary-400 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Add
            </button>
          </div>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={inputClass} aria-label="Material group">
            <option value="all">All groups</option>
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="max-h-72 min-h-0 overflow-y-auto p-1.5 lg:max-h-none lg:flex-1">
          {GROUPS.map((g) => {
            const items = visible.filter((m) => KINDS[m.kind]?.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="mb-2">
                <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-dark-200">{g}</p>
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors',
                      m.id === selected?.id ? 'bg-primary-500/15 text-dark-50' : 'text-dark-100 hover:bg-white/[0.04]',
                    )}
                  >
                    <MaterialChip material={m} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{m.name}</span>
                      <span className="block truncate text-[11px] text-dark-200">
                        {KINDS[m.kind]?.label}{m.builtin ? ' · built-in' : ` · ${m.source === 'glb' ? 'glTF' : 'maps'}`}
                      </span>
                    </span>
                    {defaultKinds(m.id).length > 0 && (
                      <span className="rounded bg-primary-500/15 px-1.5 py-0.5 text-[10px] text-primary-400" title={`Default for ${defaultKinds(m.id).map((k) => KINDS[k].label).join(', ')}`}>
                        default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] leading-relaxed text-dark-200">
          Drop a <b className="text-dark-100">.glb</b>, PBR maps or a <b className="text-dark-100">.zip</b> from ambientCG / Poly Haven anywhere here.
        </p>
      </aside>

      {/* Centre: preview */}
      <div className="h-[50vh] min-h-[320px] lg:h-auto">
        <Viewport onEngine={onEngine} error={applyError} snapshotName={selected?.name || 'material'}>
          <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/[0.08] bg-dark-900/80 p-1 shadow-lg backdrop-blur-md">
              <Segmented value={shape} onChange={setShape} options={SHAPES} />
              <label className="flex items-center gap-1.5 pr-1.5 text-[11px] text-dark-100" title="Preview tint colour">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setPreviewColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  disabled={!live?.tint}
                />
                {live?.tint ? 'Tint' : 'Untinted'}
              </label>
            </div>
          </div>
        </Viewport>
      </div>

      {/* Right: inspector */}
      <aside className="flex min-h-0 flex-col border-white/[0.06] bg-dark-900 lg:border-l">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected && draft && (
            <>
              <Section title="Material">
                <Field label="Name">
                  <input
                    value={draft.name}
                    disabled={selected.builtin}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className={clsx(inputClass, 'disabled:opacity-60')}
                  />
                </Field>
                <Field label="Kind">
                  <select
                    value={draft.kind}
                    disabled={selected.builtin}
                    onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
                    className={clsx(inputClass, 'disabled:opacity-60')}
                  >
                    {KIND_KEYS.map((k) => <option key={k} value={k}>{KINDS[k].group} · {KINDS[k].label}</option>)}
                  </select>
                </Field>
                {!selected.swatch && (
                  <Toggle
                    label="Tint with catalog colour"
                    hint={draft.tint ? 'Neutral maps, coloured by each option' : 'Shown in its own colours (scans, glTF materials)'}
                    checked={draft.tint}
                    onChange={(tint) => !selected.builtin && setDraft((d) => ({ ...d, tint }))}
                  />
                )}
                {selected.swatch && (
                  <p className="text-[11px] leading-relaxed text-dark-200">
                    Tiles each option&apos;s own swatch image. Use for flat scans (laminates, finish chips), not styled upholstery photos.
                  </p>
                )}
                {selected.builtin && <p className="mt-1 text-[11px] text-dark-200">Built-in: name, kind and maps are fixed; look settings can be tuned.</p>}
              </Section>

              <Section
                title="Look"
                aside={(
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, settings: selected.builtin ? { ...builtinDefaults(selected.id) } : {} }))}
                    className="text-[11px] text-dark-200 hover:text-dark-50"
                  >
                    Reset
                  </button>
                )}
              >
                {LOOK.map(([key, label, min, max, fallback, format]) => (
                  <Slider
                    key={key}
                    label={label}
                    min={min}
                    max={max}
                    step={0.01}
                    format={format}
                    value={draft.settings[key] ?? fallback ?? (key === 'metalness' ? 0 : 1)}
                    defaultValue={selected.builtin ? builtinDefaults(selected.id)[key] ?? fallback ?? undefined : fallback ?? undefined}
                    onChange={(v) => setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: v } }))}
                  />
                ))}
                <p className="mt-1 text-[11px] text-dark-200">With a roughness or metalness map, those sliders scale the map.</p>
              </Section>

              <Section title="Maps">
                {selected.url ? (
                  <p className="text-xs text-dark-100">glTF material · maps embedded in the .glb</p>
                ) : Object.keys(selected.maps || {}).length ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries(selected.maps).map(([key, url]) => (
                      <figure key={key}>
                        <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded border border-white/[0.08] object-cover" />
                        <figcaption className="mt-0.5 text-center text-[10px] text-dark-200">{MAP_LABELS[key]}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dark-100">{selected.swatch ? 'The option’s swatch image' : 'No maps: a smooth, uniform surface'}</p>
                )}
                {!selected.builtin && (
                  <div className="mt-2">
                    <InfoRows rows={[['Source', selected.source === 'glb' ? 'glTF (.glb)' : 'Texture maps'], ['Size', formatBytes(selected.size)]]} />
                  </div>
                )}
              </Section>

              <Section title="Default for">
                <p className="mb-2 text-[11px] text-dark-200">Options of these kinds render with this material unless assigned another.</p>
                <div className="flex flex-wrap gap-1">
                  {KIND_KEYS.filter((k) => k !== 'other').map((k) => {
                    const on = isDefaultFor(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setDefaultFor(k, !on)}
                        disabled={on && selected.id === `builtin:${k}`}
                        title={on && selected.id === `builtin:${k}` ? 'Built-in fallback for this kind' : undefined}
                        className={clsx(
                          'h-6 rounded-full border px-2 text-[11px] transition-colors',
                          on ? 'border-primary-500/60 bg-primary-500/15 text-primary-300' : 'border-white/[0.1] text-dark-200 hover:text-dark-50',
                        )}
                      >
                        {KINDS[k].label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title={`Assigned options (${usedBy.length})`}>
                {usedBy.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {usedBy.map((key) => {
                      const ref = optionByKey[key];
                      return (
                        <li key={key} className="flex items-center gap-2 rounded-md bg-dark-800 px-2 py-1.5 text-xs">
                          {ref && optionImage(ref.item)
                            ? <img src={resolveImageUrl(optionImage(ref.item))} alt="" className="h-5 w-5 rounded object-cover" />
                            : <span className="h-5 w-5 rounded" style={{ background: ref?.item.color_hex || '#666' }} />}
                          <button type="button" onClick={() => ref && setPreviewOption(ref)} className="min-w-0 flex-1 truncate text-left text-dark-50 hover:underline">
                            {ref ? `${SOURCES[ref.source].label}: ${optionLabel(ref.source, ref.item)}` : key}
                          </button>
                          <button type="button" onClick={() => unassign(key)} aria-label="Unassign" className="text-dark-200 hover:text-red-300">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <OptionPicker
                  catalog={catalog}
                  kind={live.kind}
                  onPreview={setPreviewOption}
                  onAssign={assign}
                  assignedKeys={new Set(usedBy)}
                />
                {previewOption && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-dark-100">
                    Previewing {optionLabel(previewOption.source, previewOption.item)}
                    <button type="button" onClick={() => setPreviewOption(null)} className="text-dark-200 hover:text-dark-50" aria-label="Stop previewing">
                      <X className="h-3 w-3" />
                    </button>
                  </p>
                )}
              </Section>

              {!selected.builtin && (
                <Section title="Danger zone" defaultOpen={false}>
                  <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 text-xs text-red-300 hover:bg-red-500/20">
                    <Trash2 className="h-3.5 w-3.5" />Delete material
                  </button>
                </Section>
              )}
            </>
          )}
        </div>
        {dirty && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] bg-dark-800 px-3 py-2.5">
            <span className="flex-1 text-xs text-dark-100">Unsaved changes</span>
            <button type="button" onClick={() => setDraft(draftOf(selected))} className="h-8 rounded-md px-2.5 text-xs text-dark-100 hover:bg-white/[0.06]">Revert</button>
            <button type="button" onClick={save} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-500 px-3 text-xs font-semibold text-dark-950 hover:bg-primary-400">
              <Save className="h-3.5 w-3.5" />Save
            </button>
          </div>
        )}
      </aside>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary-500/70 bg-dark-950/70 text-sm font-medium text-primary-300">
          Drop to add a material
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete material?"
        message={`"${selected?.name}" will be removed from the library.`}
        confirmText="Delete"
      />
    </div>
  );
}

/** Library list chip: the colour map, else a swatch of the material's look. */
function MaterialChip({ material }) {
  // Neutral (tinted) maps are grey; only real colour maps say anything
  const image = !material.tint && material.maps?.map;
  const metal = (material.settings?.metalness ?? 0) > 0.5;
  return (
    <span
      className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-white/[0.12]"
      style={{
        background: metal
          ? 'radial-gradient(circle at 35% 30%, #fff 0%, #bbb 30%, #555 75%, #999 100%)'
          : `radial-gradient(circle at 35% 30%, #fff8 0%, ${PREVIEW_COLORS[material.kind] || '#888'} 45%, #0006 100%)`,
      }}
    >
      {image && <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </span>
  );
}

/** Search catalog options to preview this material on, or assign it to them. */
function OptionPicker({ catalog, kind, onPreview, onAssign, assignedKeys }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    const out = [];
    for (const [source, items] of Object.entries(catalog)) {
      for (const item of items) {
        const k = optionKind(source, item);
        const sameGroup = KINDS[k]?.group === KINDS[kind]?.group;
        if (q ? optionText(item).includes(q) : sameGroup) out.push({ source, item, kind: k });
        if (out.length >= 40) return out;
      }
    }
    return out;
  }, [catalog, kind, q]);

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} placeholder="Find upholstery, finishes, laminates" />
      <ul className="mt-1 max-h-56 overflow-y-auto">
        {results.map(({ source, item, kind: k }) => {
          const key = optionKey(source, item);
          const image = optionImage(item);
          return (
            <li key={key} className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-white/[0.04]">
              {image
                ? <img src={resolveImageUrl(image)} alt="" loading="lazy" className="h-6 w-6 rounded object-cover" />
                : <span className="h-6 w-6 rounded" style={{ background: item.color_hex || '#666' }} />}
              <button type="button" onClick={() => onPreview({ source, item })} className="min-w-0 flex-1 text-left" title="Preview on this material">
                <span className="block truncate text-dark-50">{optionLabel(source, item)}</span>
                <span className="block truncate text-[10px] text-dark-200">{SOURCES[source].label} · {KINDS[k].label}</span>
              </button>
              {assignedKeys.has(key) ? (
                <span className="text-[10px] text-primary-400">assigned</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAssign(source, item)}
                  title="Always render this option with this material"
                  className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-dark-200 opacity-0 hover:bg-white/[0.08] hover:text-dark-50 focus:opacity-100 group-hover:opacity-100"
                >
                  <Plus className="h-3 w-3" />Assign
                </button>
              )}
            </li>
          );
        })}
        {results.length === 0 && <li className="px-1.5 py-2 text-[11px] text-dark-200">No catalog options found.</li>}
      </ul>
    </div>
  );
}
