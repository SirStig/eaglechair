import { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';

const EAGLE_MARK = '/assets/eagle-mark.png';
const RING_TEXT = 'EAGLE CHAIR, INC. • ESTABLISHED 1984 • ';
// Circumference of the r=40 text circle, so the phrase wraps exactly once
const RING_LENGTH = 2 * Math.PI * 40;

// sm is too small for legible ring text, so it gets a plain gold arc instead
const sizes = {
  sm: 'h-8 w-8',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
  xl: 'h-40 w-40',
};
const sizeAliases = { large: 'lg', small: 'sm', medium: 'md' };

const tones = {
  light: { eagle: 'text-dark-900', ring: 'text-primary-800', label: 'text-slate-600' },
  dark: { eagle: 'text-white', ring: 'text-primary-500', label: 'text-dark-200' },
};

const EagleMark = ({ className }) => (
  <span
    aria-hidden="true"
    className={clsx('absolute inset-0 m-auto bg-current', className)}
    style={{
      WebkitMaskImage: `url(${EAGLE_MARK})`,
      maskImage: `url(${EAGLE_MARK})`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    }}
  />
);

/**
 * Brand loader: the Eagle mark with "Eagle Chair, Inc. • Established 1984"
 * circling it. tone="light" for cream/white surfaces, "dark" for coal ones.
 */
const LoadingSpinner = ({ size = 'md', tone = 'light', label, className, fullScreen = false }) => {
  const pathId = useId();
  const sizeKey = sizes[size] ? size : sizeAliases[size] || 'md';
  const colors = tones[fullScreen ? 'dark' : tone] || tones.light;
  const compact = sizeKey === 'sm';

  const spinner = (
    <div role="status" aria-live="polite" className={clsx('inline-flex flex-col items-center gap-3', className)}>
      <div className={clsx('relative flex-shrink-0', sizes[sizeKey])}>
        <div className={clsx('absolute inset-0 keep-motion-speed motion-reduce:animate-none', compact ? 'animate-[spin_1.1s_linear_infinite]' : 'animate-[spin_14s_linear_infinite]', colors.ring)}>
          {compact ? (
            <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray="70 207" />
            </svg>
          ) : (
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" aria-hidden="true">
              <defs>
                <path id={pathId} d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" />
              </defs>
              <text fill="currentColor" fontSize="8.6" fontWeight="600" letterSpacing="0.6" className="font-sans">
                <textPath href={`#${pathId}`} textLength={RING_LENGTH} lengthAdjust="spacing">
                  {RING_TEXT}
                </textPath>
              </text>
            </svg>
          )}
        </div>
        <EagleMark
          className={clsx(
            colors.eagle,
            compact ? 'w-[52%] h-[52%]' : 'w-[50%] h-[50%] keep-motion-speed animate-[eagleBreathe_2.8s_ease-in-out_infinite] motion-reduce:animate-none'
          )}
        />
      </div>
      {label ? (
        <p className={clsx('text-sm font-medium', colors.label)}>{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-dark-800 bg-opacity-95 z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * Route-level fallback. Renders nothing for the first moment so fast chunk
 * loads don't flash a loader (and the first render matches SSR's empty fallback).
 */
export const PageLoader = ({ delay = 250, tone = 'light' }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div className={clsx('min-h-[70vh] flex items-center justify-center', tone === 'dark' ? 'bg-dark-900' : 'bg-cream-50')}>
      <LoadingSpinner size="lg" tone={tone} />
    </div>
  );
};

export default LoadingSpinner;
