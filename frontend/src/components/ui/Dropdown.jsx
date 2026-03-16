import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { clsx } from 'clsx';

const Dropdown = ({ 
  trigger, 
  children, 
  align = 'left',
  className,
  contentClassName,
  isFullWidth
}) => {
  const fullWidth = isFullWidth ?? contentClassName?.includes('w-screen');
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
          <Motion.div
            initial={fullWidth ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
            animate={fullWidth ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={fullWidth ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
            transition={{ 
              duration: 0.3, 
              ease: [0.4, 0, 0.2, 1] 
            }}
            className={clsx(
              'z-50 rounded-lg bg-dark-600 border border-dark-500 shadow-xl backdrop-blur-sm overflow-hidden',
              fullWidth ? 'fixed left-0 right-0 top-[var(--header-height,80px)]' : 'absolute',
              fullWidth ? '' : alignmentClasses[align],
              !fullWidth && 'max-w-[calc(100vw-2rem)]',
              contentClassName
            )}
            style={{
              WebkitBackdropFilter: 'blur(8px)',
              backdropFilter: 'blur(8px)',
              ...(fullWidth && {
                width: '100vw',
                maxWidth: '100vw'
              }),
              ...(!fullWidth && {
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'auto'
              })
            }}
            onClick={closeDropdown}
          >
            {childrenWithProps}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;


