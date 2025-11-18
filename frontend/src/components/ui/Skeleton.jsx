import { motion } from 'framer-motion';

/**
 * Skeleton loader component for content placeholders
 * 
 * @param {string} variant - Type of skeleton: 'text', 'title', 'avatar', 'image', 'card', 'button'
 * @param {string} width - Width of skeleton (default: '100%')
 * @param {string} height - Height of skeleton
 * @param {string} className - Additional CSS classes
 */
const Skeleton = ({ 
  variant = 'text', 
  width = '100%', 
  height, 
  className = '',
  count = 1 
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'title':
        return 'h-8 rounded';
      case 'avatar':
        return 'h-12 w-12 rounded-full';
      case 'image':
        return 'h-48 rounded-lg';
      case 'card':
        return 'h-64 rounded-xl';
      case 'button':
        return 'h-10 rounded-lg';
      case 'circle':
        return 'rounded-full';
      case 'rect':
        return 'rounded';
      default:
        return 'h-4 rounded';
    }
  };

  const skeletonStyle = {
    width: width,
    height: height || undefined,
  };

  const skeletons = Array.from({ length: count }, (_, index) => (
    <motion.div
      key={index}
      className={`bg-dark-700 animate-pulse ${getVariantStyles()} ${className}`}
      style={skeletonStyle}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  ));

  return count > 1 ? (
    <div className="space-y-3">
      {skeletons}
    </div>
  ) : (
    skeletons[0]
  );
};

/**
 * Product Card Skeleton
 */
export const ProductCardSkeleton = () => (
  <div className="bg-dark-700 rounded-xl p-4 space-y-4">
    <Skeleton variant="image" height="200px" />
    <Skeleton variant="title" width="80%" />
    <Skeleton variant="text" width="60%" />
    <div className="flex justify-between items-center pt-2">
      <Skeleton variant="text" width="30%" />
      <Skeleton variant="button" width="100px" height="36px" />
    </div>
  </div>
);

/**
 * Hero Skeleton
 */
export const HeroSkeleton = () => (
  <div className="relative h-[600px] lg:h-[700px] bg-dark-900">
    <Skeleton variant="image" height="100%" className="absolute inset-0" />
    <div className="absolute inset-0 flex items-center">
      <div className="container">
        <div className="max-w-2xl space-y-6">
          <Skeleton variant="title" width="80%" height="60px" />
          <Skeleton variant="text" width="90%" height="30px" count={2} />
          <Skeleton variant="button" width="150px" height="48px" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Content Section Skeleton
 */
export const ContentSkeleton = ({ lines = 3 }) => (
  <div className="space-y-3">
    <Skeleton variant="title" width="60%" />
    <Skeleton variant="text" count={lines} />
  </div>
);

/**
 * Card Grid Skeleton
 */
export const CardGridSkeleton = ({ count = 4, columns = 4 }) => {
  const gridClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-6`}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
};

/**
 * List Item Skeleton
 */
export const ListItemSkeleton = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-dark-700 rounded-lg">
        <Skeleton variant="avatar" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="80%" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Table Skeleton
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-2">
    {/* Header */}
    <div className="grid gap-4 p-4 bg-dark-700 rounded-lg" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} variant="text" width="80%" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="grid gap-4 p-4 bg-dark-800 rounded-lg" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }, (_, j) => (
          <Skeleton key={j} variant="text" width="90%" />
        ))}
      </div>
    ))}
  </div>
);

export default Skeleton;

