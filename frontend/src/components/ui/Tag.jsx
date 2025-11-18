import PropTypes from 'prop-types';

/**
 * Tag Component - Professional product tags for features, status, and attributes
 * Designed for light mode with subtle, elegant styling
 */
const Tag = ({ children, variant = 'default', size = 'md', className = '' }) => {
  const baseClasses = 'inline-flex items-center font-medium transition-colors duration-200';
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 rounded',
    md: 'text-sm px-3 py-1 rounded-md',
    lg: 'text-base px-4 py-1.5 rounded-lg',
  };

  const variantClasses = {
    // Default - Neutral gray with better contrast
    default: 'bg-slate-200 text-slate-800 border border-slate-300',
    
    // New - Fresh green with stronger text
    new: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    
    // Featured - Premium gold with darker text
    featured: 'bg-primary-100 text-primary-900 border border-primary-300',
    
    // Sale - Attention red with stronger contrast
    sale: 'bg-red-100 text-red-800 border border-red-300',
    
    // Best Seller - Professional blue with better readability
    bestseller: 'bg-blue-100 text-blue-800 border border-blue-300',
    
    // Commercial Grade - Trustworthy slate with stronger text
    commercial: 'bg-slate-200 text-slate-900 border border-slate-400',
    
    // Eco-Friendly - Nature green with better contrast
    eco: 'bg-green-100 text-green-800 border border-green-300',
    
    // Limited - Urgent orange with darker text
    limited: 'bg-orange-100 text-orange-800 border border-orange-300',
    
    // Custom - Subtle purple with better readability
    custom: 'bg-purple-100 text-purple-800 border border-purple-300',
  };

  return (
    <span 
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

Tag.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'default',
    'new',
    'featured',
    'sale',
    'bestseller',
    'commercial',
    'eco',
    'limited',
    'custom',
  ]),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

export default Tag;
