import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { clsx } from 'clsx';

const Dropdown = ({ 
  trigger, 
  children, 
  align = 'left',
  className,
  contentClassName,
  isFullWidth,
  onOpenChange
}) => {
  const fullWidth = isFullWidth ?? contentClassName?.includes('w-screen');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const portalRef = useRef(null);

  const setOpen = (open) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const inTrigger = dropdownRef.current?.contains(event.target);
      const inPortal = portalRef.current?.contains(event.target);
      if (!inTrigger && !inPortal) {
        setOpen(false);
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

  const triggerWithState = typeof trigger === 'function' 
    ? trigger(isOpen) 
    : trigger;

  const closeDropdown = () => setOpen(false);

  const childrenWithProps = typeof children === 'function'
    ? children(closeDropdown)
    : children;

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          ref={portalRef}
          initial={fullWidth ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
          animate={fullWidth ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={fullWidth ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.4, 0, 0.2, 1] 
          }}
          className={clsx(
            'z-50 rounded-lg bg-dark-600 border border-dark-500 shadow-xl backdrop-blur-sm overflow-hidden',
            fullWidth ? 'fixed left-0 right-0 top-[var(--header-height)]' : 'absolute',
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
  );

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <div onClick={() => setOpen(!isOpen)}>
        {triggerWithState}
      </div>
      {fullWidth ? createPortal(dropdownContent, document.body) : dropdownContent}
    </div>
  );
};

export default Dropdown;


