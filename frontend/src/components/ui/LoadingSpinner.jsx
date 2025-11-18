import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const LoadingSpinner = ({ size = 'md', className, fullScreen = false }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const spinner = (
    <motion.div
      className={clsx(
        'border-4 border-dark-600 border-t-primary-500 rounded-full',
        sizes[size],
        className
      )}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-dark-800 bg-opacity-95 z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;


