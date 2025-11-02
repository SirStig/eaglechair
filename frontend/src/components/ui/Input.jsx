import { forwardRef } from 'react';
import { clsx } from 'clsx';

const Input = forwardRef(({ 
  label,
  error,
  helperText,
  className,
  containerClassName,
  type = 'text',
  icon: Icon,
  iconPosition = 'left',
  ...props 
}, ref) => {
  const inputClasses = clsx(
    'w-full rounded-lg border px-4 py-2.5 focus:outline-none transition-all bg-dark-700 text-dark-50 placeholder-dark-200 text-base',
    error 
      ? 'border-secondary-600 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500' 
      : 'border-dark-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500',
    Icon && iconPosition === 'left' && 'pl-10',
    Icon && iconPosition === 'right' && 'pr-10',
    className
  );

  return (
    <div className={clsx('w-full', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-dark-100 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-dark-200" />
        )}
        <input
          ref={ref}
          type={type}
          className={inputClasses}
          {...props}
        />
        {Icon && iconPosition === 'right' && (
          <Icon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-dark-200" />
        )}
      </div>
      {(error || helperText) && (
        <p className={clsx(
          'mt-1.5 text-sm',
          error ? 'text-secondary-500' : 'text-dark-200'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;


