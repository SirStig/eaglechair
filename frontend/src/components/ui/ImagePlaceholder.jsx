/**
 * Empty state for a missing image. Rather than a generic icon, each kind
 * renders a soft material texture so a gap in the grid still reads as
 * "wood finish", "fabric", etc. and sits naturally next to real photos.
 *
 *   kind:    'wood' | 'fabric' | 'laminate' | 'metal' | 'neutral'
 *   label:   caption pill text; pass null to hide (e.g. on tiny swatches)
 *
 * Product photos use /placeholder.svg instead (a static copy of the 'neutral'
 * texture + badge), since they render through <img> fallbacks.
 */

const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// Each tile repeats seamlessly; tones come from the cream palette in tailwind.config.js
const TEXTURES = {
  wood: {
    background: [
      svgUrl(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44">' +
          '<g fill="none" stroke="#75654f" stroke-linecap="round">' +
          '<path d="M0 8 C40 2 120 14 160 8" stroke-opacity=".16" stroke-width="1.2"/>' +
          '<path d="M0 19 C40 25 120 13 160 19" stroke-opacity=".10" stroke-width="2"/>' +
          '<path d="M0 30 C40 26 120 34 160 30" stroke-opacity=".14" stroke-width="1"/>' +
          '<path d="M0 39 C40 43 120 35 160 39" stroke-opacity=".08" stroke-width="1.6"/>' +
          '</g></svg>'
      ),
      'linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,0) 55%)',
      'linear-gradient(135deg, #e3d9c8, #c7b299)',
    ].join(', '),
    backgroundSize: '160px 44px, 100% 100%, 100% 100%',
  },
  fabric: {
    background: [
      svgUrl(
        '<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6">' +
          '<path d="M0 1.5h3M3 4.5h3" stroke="#75654f" stroke-opacity=".14" stroke-width="1.5"/>' +
          '<path d="M4.5 0v3M1.5 3v3" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.5"/>' +
          '</svg>'
      ),
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,.4), rgba(255,255,255,0) 60%)',
      'linear-gradient(135deg, #ede7dc, #d6c7b0)',
    ].join(', '),
    backgroundSize: '6px 6px, 100% 100%, 100% 100%',
  },
  laminate: {
    background: [
      svgUrl(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#75654f">' +
          '<circle cx="6" cy="9" r=".9" fill-opacity=".18"/><circle cx="21" cy="4" r=".6" fill-opacity=".12"/>' +
          '<circle cx="37" cy="13" r="1.1" fill-opacity=".14"/><circle cx="14" cy="27" r=".7" fill-opacity=".16"/>' +
          '<circle cx="30" cy="31" r=".8" fill-opacity=".1"/><circle cx="44" cy="40" r=".6" fill-opacity=".18"/>' +
          '<circle cx="8" cy="42" r="1" fill-opacity=".1"/><circle cx="25" cy="45" r=".5" fill-opacity=".14"/>' +
          '</svg>'
      ),
      'linear-gradient(120deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.45) 50%, rgba(255,255,255,0) 65%)',
      'linear-gradient(135deg, #f5f2ed, #e3d9c8)',
    ].join(', '),
    backgroundSize: '48px 48px, 100% 100%, 100% 100%',
  },
  metal: {
    background: [
      'repeating-linear-gradient(0deg, rgba(255,255,255,.28) 0 1px, rgba(255,255,255,0) 1px 3px)',
      'linear-gradient(100deg, #e4e0d9 0%, #f4f2ee 30%, #d3cdc3 55%, #ebe8e2 80%, #dad5cc 100%)',
    ].join(', '),
    backgroundSize: '100% 100%, 100% 100%',
  },
  neutral: {
    background: [
      'repeating-linear-gradient(45deg, rgba(117,101,79,.06) 0 1px, rgba(117,101,79,0) 1px 8px)',
      'linear-gradient(135deg, #f5f2ed, #e3d9c8)',
    ].join(', '),
    backgroundSize: '100% 100%, 100% 100%',
  },
};

const ImagePlaceholder = ({
  kind = 'neutral',
  label = 'Image coming soon',
  className = '',
  title,
  children,
}) => {
  const texture = TEXTURES[kind] || TEXTURES.neutral;

  return (
    <div
      role="img"
      aria-label={title ? `${title}: image coming soon` : 'Image coming soon'}
      title={title}
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ backgroundImage: texture.background, backgroundSize: texture.backgroundSize }}
    >
      {/* Soft inner edge so the texture reads as a surface, not a flat fill */}
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(117,101,79,0.12),inset_0_-12px_24px_-12px_rgba(117,101,79,0.18)]" aria-hidden />
      {children}
      {label && !children && (
        <span className="relative px-3 py-1 rounded-full bg-white/75 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-[0.18em] text-cream-800 whitespace-nowrap shadow-sm">
          {label}
        </span>
      )}
    </div>
  );
};

export default ImagePlaceholder;
