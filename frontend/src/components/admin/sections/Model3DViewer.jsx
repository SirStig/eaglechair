/**
 * 3D Studio: try configurable product models in catalog upholstery, finishes
 * and laminates (Models), and build the material library they render with
 * (Materials). three.js only loads when this page opens.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Box, Layers } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useUrlState } from '../../../hooks/useUrlState';
import { listCatalogOptions, listMaterials, listModels, saveMaterialConfig } from '../../../services/models3dService';
import { materialIndex } from '../models3d/materialKinds';

const ModelWorkspace = lazy(() => import('../models3d/studio/ModelWorkspace'));
const MaterialWorkspace = lazy(() => import('../models3d/studio/MaterialWorkspace'));

const MODES = [
  { value: 'models', label: 'Models', icon: Box },
  { value: 'materials', label: 'Materials', icon: Layers },
];

const EMPTY_CONFIG = { defaults: {}, assignments: {}, overrides: {} };

export default function Model3DViewer() {
  const toast = useToast();
  const [mode, setMode] = useUrlState('mode', 'models');
  const [models, setModels] = useState([]);
  const [library, setLibrary] = useState({ materials: [], config: EMPTY_CONFIG });
  const [catalog, setCatalog] = useState({ upholstery: [], finish: [], laminate: [] });
  const [loaded, setLoaded] = useState(false);

  const refreshModels = useCallback(async () => setModels(await listModels()), []);
  const refreshLibrary = useCallback(async () => {
    const res = await listMaterials();
    setLibrary({ materials: res.materials, config: { ...EMPTY_CONFIG, ...res.config } });
  }, []);

  useEffect(() => {
    Promise.allSettled([
      refreshModels().catch(() => toast.error('Could not load 3D models')),
      refreshLibrary().catch(() => toast.error('Could not load the material library')),
      listCatalogOptions().then(setCatalog).catch(() => toast.error('Could not load upholstery, finishes and laminates')),
    ]).then(() => setLoaded(true));
  }, [refreshModels, refreshLibrary, toast]);

  const index = useMemo(() => materialIndex(library.materials, library.config.overrides), [library]);

  /** Save the library config (defaults, assignments, built-in tweaks); optimistic. */
  const saveConfig = useCallback(async (next) => {
    const prev = library.config;
    setLibrary((l) => ({ ...l, config: next }));
    try {
      await saveMaterialConfig(next);
    } catch (err) {
      setLibrary((l) => ({ ...l, config: prev }));
      toast.error(err?.message || 'Could not save the material library');
      throw err;
    }
  }, [library.config, toast]);

  const shared = {
    models, setModels, refreshModels, library, setLibrary, refreshLibrary, index, saveConfig, catalog, loaded,
  };

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="flex h-12 flex-shrink-0 items-center gap-4 border-b border-white/[0.06] bg-dark-900 px-3 sm:px-4">
        <h1 className="flex items-center gap-2 font-serif text-lg font-bold text-dark-50">
          <Box className="h-5 w-5 text-primary-500" aria-hidden="true" />
          3D Studio
        </h1>
        <nav className="flex items-center gap-1" aria-label="Studio mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value, { push: true })}
              aria-current={mode === m.value ? 'page' : undefined}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                mode === m.value ? 'bg-white/[0.08] text-dark-50' : 'text-dark-200 hover:bg-white/[0.04] hover:text-dark-50',
              )}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-64 items-center justify-center text-sm text-dark-200">Loading studio…</div>}>
          {mode === 'materials' ? <MaterialWorkspace {...shared} /> : <ModelWorkspace {...shared} />}
        </Suspense>
      </div>
    </div>
  );
}
