const VariationImageDisclaimer = ({ className = '', compact = false }) => (
  <div
    className={`absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-10 ${className}`}
    aria-hidden
  >
    <div
      className={`absolute flex items-center justify-center bg-slate-900/80 backdrop-blur-sm ${compact ? 'w-[180%] h-8 -left-2/5 -top-4' : 'w-[250%] h-12 -left-3/4 -top-6'}`}
      style={{ transform: 'rotate(-45deg)' }}
    >
      <span className={`font-medium uppercase tracking-[0.15em] text-white/95 ${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}>
        Image may not represent product
      </span>
    </div>
  </div>
);

export default VariationImageDisclaimer;
