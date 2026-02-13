import { clsx } from 'clsx';

const Badge = ({ 
  children, 
  variant = 'default', 
  size = 'md',
  className 
}) => {
  const variants = {
    default: 'bg-dark-600 text-dark-100 border border-dark-500',
    defaultLight: 'bg-slate-200 text-slate-700 border border-slate-300',
    primary: 'bg-primary-900 text-primary-300 border border-primary-700',
    primaryLight: 'bg-primary-100 text-primary-800 border border-primary-200',
    secondary: 'bg-secondary-900 text-secondary-300 border border-secondary-700',
    secondaryLight: 'bg-cream-200 text-slate-700 border border-cream-300',
    success: 'bg-green-900 text-green-300 border border-green-700',
    warning: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
    danger: 'bg-secondary-900 text-secondary-300 border border-secondary-700',
    info: 'bg-blue-900 text-blue-300 border border-blue-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};

export default Badge;


