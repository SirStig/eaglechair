import { resolveImageUrl } from '../../utils/apiHelpers';

const sizeClasses = {
  xs: 'w-5 h-5 sm:w-6 sm:h-6',
  sm: 'w-8 h-8 sm:w-10 sm:h-10',
  md: 'w-10 h-10 sm:w-12 sm:h-12',
  lg: 'w-12 h-12 sm:w-14 sm:h-14',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
  card: 'aspect-square',
};

const SwatchImage = ({
  item,
  size = 'md',
  rounded = 'circle',
  zoom = true,
  className = '',
  alt,
}) => {
  const isObject = item && typeof item === 'object';
  const name = isObject ? item.name : (item || '');
  const imageUrl = isObject && (item.swatchImageUrl || item.swatch_image_url || item.fullImageUrl || item.image_url || item.imageUrl);
  const colorHex = isObject && (item.color_hex || item.colorHex);
  const resolvedSrc = imageUrl ? resolveImageUrl(imageUrl) : null;

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const roundedClass = rounded === 'circle' ? 'rounded-full' : rounded === 'lg' ? 'rounded-xl' : 'rounded-lg';

  if (resolvedSrc) {
    return (
      <div
        className={`overflow-hidden bg-dark-900 flex-shrink-0 ${sizeClass} ${roundedClass} ${className}`}
      >
        <img
          src={resolvedSrc}
          alt={alt ?? name}
          className={`w-full h-full object-cover ${zoom ? 'scale-125' : ''}`}
        />
      </div>
    );
  }

  if (colorHex) {
    return (
      <div
        className={`border-2 border-dark-600 flex-shrink-0 ${sizeClass} ${roundedClass} ${className}`}
        style={{ backgroundColor: colorHex }}
        title={name}
      />
    );
  }

  return (
    <div
      className={`bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center flex-shrink-0 border-2 border-dark-600 ${sizeClass} ${roundedClass} ${className}`}
      title={name}
    >
      <span className="text-[7px] sm:text-[8px] font-bold text-white drop-shadow">
        {name ? String(name).substring(0, 1).toUpperCase() : '?'}
      </span>
    </div>
  );
};

export default SwatchImage;
