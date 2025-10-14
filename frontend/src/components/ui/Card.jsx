import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const Card = ({ 
  children, 
  className,
  hoverable = false,
  onClick,
  padding = 'default',
  ...props 
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  };

  const Component = hoverable ? motion.div : 'div';
  const motionProps = hoverable ? {
    whileHover: { y: -4, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' },
    transition: { duration: 0.2 }
  } : {};

  return (
    <Component
      className={clsx(
        'bg-dark-600 border border-dark-500 rounded-xl shadow-md transition-shadow duration-300',
        paddingStyles[padding],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Card;


