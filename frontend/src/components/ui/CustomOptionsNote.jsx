/**
 * Slim "custom options available" note for the product page hero.
 *
 * Deliberately non-specific: it says customization is an option without
 * listing what can (or can't) be changed. The mark is a fanned swatch deck
 * in the catalog spec-symbol palette.
 */

const SwatchMark = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
    <g transform="translate(1.5 1.5)">
      <g stroke="#594a42" strokeWidth="0.8" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="15" rx="1" fill="#5966af" transform="rotate(-28 12 18)" />
        <rect x="9" y="3" width="6" height="15" rx="1" fill="#e25a8c" transform="rotate(-9 12 18)" />
        <rect x="9" y="3" width="6" height="15" rx="1" fill="#44a099" transform="rotate(12 12 18)" />
      </g>
      <circle cx="12" cy="18" r="1.3" fill="#faf8f5" stroke="#594a42" strokeWidth="0.8" />
    </g>
  </svg>
);

const CustomOptionsNote = ({ className = '' }) => (
  <div className={`flex items-center gap-3 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 ${className}`}>
    <SwatchMark />
    <p className="text-sm leading-snug text-slate-600">
      <span className="font-semibold text-slate-800">Custom options available.</span>{' '}
      Ask us about tailoring this model to your project.
    </p>
  </div>
);

export default CustomOptionsNote;
