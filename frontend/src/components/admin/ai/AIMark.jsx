/**
 * AI Mark
 * The assistant's avatar: the white eagle mark on a graphite tile.
 */

const SIZES = {
  xs: 'w-6 h-6 rounded-md p-1',
  sm: 'w-7 h-7 rounded-lg p-1.5',
  md: 'w-8 h-8 rounded-lg p-1.5',
  lg: 'w-12 h-12 rounded-xl p-2.5',
};

export default function AIMark({ size = 'sm', className = '' }) {
  return (
    <div
      className={`${SIZES[size] || SIZES.sm} flex-shrink-0 flex items-center justify-center bg-chat-raised border border-chat-line-strong ${className}`}
    >
      <img src="/assets/eagle-mark-white.png" alt="" aria-hidden className="w-full h-full object-contain" />
    </div>
  );
}
