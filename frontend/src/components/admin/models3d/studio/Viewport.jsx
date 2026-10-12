/**
 * The 3D studio viewport: a StudioEngine canvas with editor toolbars (view
 * presets, display toggles, lighting, backdrop), a stats overlay, snapshot
 * and fullscreen. Display preferences persist per browser.
 *
 * Shortcuts (pointer over the viewport): 1-5 views, F frame, G grid,
 * W wireframe, R turntable, I stats.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Activity, Camera, Grid3x3, Maximize, Minimize, RotateCw, Scan, SlidersHorizontal, SunMedium, Box as BoxIcon,
} from 'lucide-react';
import { ENVIRONMENTS, StudioEngine } from '../studioEngine';
import { Divider, InfoRows, Segmented, Slider, ToolButton, Toolbar, Toggle } from './ui';
import { formatCount } from './format';

const PREFS_KEY = 'ec-3d-studio-view';
const BACKDROPS = {
  light: { label: 'Light', css: 'radial-gradient(circle at 50% 35%, #fbfaf7 0%, #e9e6df 75%)', fill: '#f2f0eb' },
  gray: { label: 'Gray', css: 'radial-gradient(circle at 50% 35%, #9a9a98 0%, #6e6e6c 80%)', fill: '#888886' },
  dark: { label: 'Dark', css: 'radial-gradient(circle at 50% 35%, #2c2b29 0%, #141413 80%)', fill: '#1c1b1a' },
  checker: { label: 'Transparent', css: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2d2d2d 0% 50%) 50% / 20px 20px', fill: null },
};
const VIEWS = [
  { value: 'persp', label: '3/4', title: '3/4 view (1)' },
  { value: 'front', label: 'Front', title: 'Front (2)' },
  { value: 'side', label: 'Side', title: 'Side (3)' },
  { value: 'back', label: 'Back', title: 'Back (4)' },
  { value: 'top', label: 'Top', title: 'Top (5)' },
];
const DEFAULT_PREFS = {
  env: 'studio', backdrop: 'light', grid: false, shadows: true, wireframe: false,
  autoRotate: false, exposure: 1.05, light: 1.6, stats: false,
};

function readPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'), wireframe: false, autoRotate: false };
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function Viewport({ onEngine, loading, error, empty, info = [], snapshotName = 'snapshot', children }) {
  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const [prefs, setPrefs] = useState(readPrefs);
  const [view, setView] = useState('persp');
  const [lightsOpen, setLightsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [stats, setStats] = useState(null);
  const hoverRef = useRef(false);

  const set = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);

  useEffect(() => {
    const e = new StudioEngine(mountRef.current);
    setEngine(e);
    onEngine?.(e);
    return () => {
      onEngine?.(null);
      e.dispose();
    };
    // onEngine is a registration callback; the engine lives for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!engine) return;
    engine.setEnvironment(prefs.env);
    engine.setGrid(prefs.grid);
    engine.setShadows(prefs.shadows);
    engine.setWireframe(prefs.wireframe);
    engine.setAutoRotate(prefs.autoRotate);
    engine.setExposure(prefs.exposure);
    engine.setLightIntensity(prefs.light);
    // Wireframe and turntable are per-visit, not remembered
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, wireframe: false, autoRotate: false }));
  }, [engine, prefs]);

  // Stats poll only while shown, so the overlay costs nothing when hidden
  useEffect(() => {
    if (!engine || !prefs.stats) return undefined;
    const tick = () => setStats(engine.stats());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [engine, prefs.stats]);

  const goView = useCallback((v) => {
    setView(v);
    engine?.setView(v);
  }, [engine]);

  const snapshot = useCallback((transparent = false) => {
    if (!engine) return;
    const fill = transparent ? null : BACKDROPS[prefs.backdrop].fill;
    const data = engine.snapshot({ background: fill });
    const a = document.createElement('a');
    a.href = data;
    a.download = `${snapshotName}.png`;
    a.click();
  }, [engine, prefs.backdrop, snapshotName]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!hoverRef.current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      const k = e.key.toLowerCase();
      const viewKey = { 1: 'persp', 2: 'front', 3: 'side', 4: 'back', 5: 'top' }[k];
      if (viewKey) goView(viewKey);
      else if (k === 'f') goView(view);
      else if (k === 'g') set({ grid: !prefs.grid });
      else if (k === 'w') set({ wireframe: !prefs.wireframe });
      else if (k === 'r') set({ autoRotate: !prefs.autoRotate });
      else if (k === 'i') set({ stats: !prefs.stats });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goView, view, prefs, set]);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-dark-950"
      style={{ background: BACKDROPS[prefs.backdrop]?.css }}
      onPointerEnter={() => { hoverRef.current = true; }}
      onPointerLeave={() => { hoverRef.current = false; }}
    >
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top: views left, display right */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2.5">
        <Toolbar>
          <Segmented value={view} onChange={goView} options={VIEWS} />
          <Divider />
          <ToolButton icon={Scan} label="Frame object (F)" onClick={() => goView(view)} />
        </Toolbar>
        <Toolbar>
          <ToolButton icon={Grid3x3} label="Grid (G)" active={prefs.grid} onClick={() => set({ grid: !prefs.grid })} />
          <ToolButton icon={BoxIcon} label="Wireframe (W)" active={prefs.wireframe} onClick={() => set({ wireframe: !prefs.wireframe })} />
          <ToolButton icon={RotateCw} label="Turntable (R)" active={prefs.autoRotate} onClick={() => set({ autoRotate: !prefs.autoRotate })} />
          <ToolButton icon={Activity} label="Stats (I)" active={prefs.stats} onClick={() => set({ stats: !prefs.stats })} />
          <Divider />
          <div className="relative">
            <ToolButton icon={SunMedium} label="Lighting and backdrop" active={lightsOpen} onClick={() => setLightsOpen((v) => !v)}>
              <SlidersHorizontal className="h-3 w-3 opacity-60" />
            </ToolButton>
            {lightsOpen && (
              <div className="absolute right-0 top-10 z-10 w-64 rounded-lg border border-white/[0.08] bg-dark-800/95 p-3 shadow-2xl backdrop-blur-md">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-dark-200">Environment</p>
                <Segmented
                  value={prefs.env}
                  onChange={(env) => set({ env })}
                  options={Object.entries(ENVIRONMENTS).map(([value, e]) => ({ value, label: e.label }))}
                />
                <div className="mt-2">
                  <Slider label="Exposure" value={prefs.exposure} min={0.4} max={2} defaultValue={1.05} onChange={(exposure) => set({ exposure })} />
                  <Slider label="Key light" value={prefs.light} min={0} max={4} step={0.05} defaultValue={1.6} onChange={(light) => set({ light })} />
                  <Toggle label="Floor shadow" checked={prefs.shadows} onChange={(shadows) => set({ shadows })} />
                </div>
                <p className="mb-1.5 mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-dark-200">Backdrop</p>
                <div className="flex gap-1.5">
                  {Object.entries(BACKDROPS).map(([key, b]) => (
                    <button
                      key={key}
                      type="button"
                      title={b.label}
                      aria-label={`${b.label} backdrop`}
                      onClick={() => set({ backdrop: key })}
                      className={clsx('h-7 w-7 rounded-md border', prefs.backdrop === key ? 'border-primary-500 ring-1 ring-primary-500' : 'border-white/[0.12]')}
                      style={{ background: b.css }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Toolbar>
      </div>

      {/* Bottom: stats left, capture right */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <div>
          {prefs.stats && (
            <div className="pointer-events-auto w-52 rounded-lg border border-white/[0.08] bg-dark-900/85 p-2.5 shadow-lg backdrop-blur-md">
              <InfoRows rows={[
                ['FPS', stats?.fps ? stats.fps : 'idle'],
                ['Triangles', formatCount(stats?.triangles)],
                ['Draw calls', stats?.calls ?? 0],
                ['Textures', stats?.textures ?? 0],
                ['Geometries', stats?.geometries ?? 0],
                ...info,
              ]}
              />
            </div>
          )}
        </div>
        <Toolbar>
          <ToolButton icon={Camera} label="Snapshot PNG (shift-click: transparent)" onClick={(e) => snapshot(e?.shiftKey)} />
          <ToolButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen} />
        </Toolbar>
      </div>

      {children}

      {(loading || error || empty) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-white/[0.08] bg-dark-900/85 px-4 py-3 text-center text-sm text-dark-50 shadow-xl backdrop-blur-md">
            {error ? <span className="text-red-300">{error}</span> : empty || (
              <>
                <p>{loading.label || 'Loading…'}</p>
                {loading.progress != null && (
                  <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-dark-600">
                    <div className="h-full bg-primary-500 transition-[width] duration-150" style={{ width: `${Math.round(loading.progress * 100)}%` }} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
