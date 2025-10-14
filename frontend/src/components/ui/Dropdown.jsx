import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const Dropdown = ({ 
  trigger, 
  children, 
  align = 'left',
  className,
  contentClassName 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alignmentClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 transform -translate-x-1/2',
  };

  // Clone trigger element and pass isOpen state to it
  const triggerWithState = typeof trigger === 'function' 
    ? trigger(isOpen) 
    : trigger;

  // Function to close dropdown
  const closeDropdown = () => setIsOpen(false);

  // Clone children and inject closeDropdown function
  const childrenWithProps = typeof children === 'function'
    ? children(closeDropdown)
    : children;

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {triggerWithState}
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ 
              duration: 0.2, 
              ease: [0.4, 0, 0.2, 1] 
            }}
            className={clsx(
              'absolute z-50 mt-2 rounded-lg bg-dark-600 border border-dark-500 shadow-xl backdrop-blur-sm overflow-hidden',
              alignmentClasses[align],
              contentClassName
            )}
            style={{
              WebkitBackdropFilter: 'blur(8px)',
              backdropFilter: 'blur(8px)'
            }}
            onClick={closeDropdown}
          >
            {childrenWithProps}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;


