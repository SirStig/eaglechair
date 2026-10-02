import { resolveImageUrl } from '../../utils/apiHelpers';
import ResponsiveImage from './ResponsiveImage';
import ImagePlaceholder from './ImagePlaceholder';

const sizeClasses = {
  xs: 'w-5 h-5 sm:w-6 sm:h-6',
  sm: 'w-8 h-8 sm:w-10 sm:h-10',
  md: 'w-10 h-10 sm:w-12 sm:h-12',
  lg: 'w-12 h-12 sm:w-14 sm:h-14',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
  card: 'aspect-square',
};

// Rendered CSS width per size (largest breakpoint), used for srcset selection
const sizeHints = {
  xs: '24px',
  sm: '40px',
  md: '48px',
  lg: '56px',
  xl: '80px',
  card: '(min-width: 640px) 200px, 33vw',
};

const SwatchImage = ({
  item,
  size = 'md',
  rounded = 'circle',
  zoom = true,
  kind = 'neutral', // texture shown when there is no image or color: wood | fabric | laminate | metal
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
        <ResponsiveImage
          src={resolvedSrc}
          sizes={sizeHints[size] || sizeHints.md}
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
    <ImagePlaceholder
      kind={kind}
      label={size === 'card' ? 'Swatch coming soon' : null}
      title={name || undefined}
      className={`flex-shrink-0 ${sizeClass} ${roundedClass} ${className}`}
    />
  );
};

export default SwatchImage;
