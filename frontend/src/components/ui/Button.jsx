import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  onClick, 
  disabled = false,
  type = 'button',
  icon: Icon,
  iconPosition = 'left',
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  
  const variants = {
    primary: 'bg-primary-500 text-dark-900 hover:bg-primary-600 active:bg-primary-700 shadow-md hover:shadow-lg',
    secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 active:bg-secondary-800',
    outline: 'border-2 border-primary-500 text-primary-500 bg-transparent hover:bg-primary-500/10 active:bg-primary-500/20',
    transparent: 'bg-transparent text-dark-50 hover:bg-dark-700 active:bg-dark-600 rounded-lg',
    ghost: 'bg-transparent text-dark-100 hover:bg-dark-700 active:bg-dark-600 hover:text-dark-50',
    danger: 'bg-secondary-600 text-white hover:bg-secondary-700 active:bg-secondary-800',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
  };

  const sizes = {
    xs: 'px-3 py-1.5 text-xs rounded min-h-[40px] sm:min-h-[36px]',
    sm: 'px-4 py-2 text-sm rounded-md min-h-[44px] sm:min-h-[40px]',
    md: 'px-6 py-3 text-base rounded-lg min-h-[44px]',
    lg: 'px-8 py-4 text-lg rounded-xl min-h-[48px]',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      onClick={onClick}
      disabled={disabled}
      type={type}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon className="mr-2 h-5 w-5" />}
      {children}
      {Icon && iconPosition === 'right' && <Icon className="ml-2 h-5 w-5" />}
    </motion.button>
  );
};

export default Button;


