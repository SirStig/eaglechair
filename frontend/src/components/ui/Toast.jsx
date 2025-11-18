import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

/**
 * Toast Notification Component
 * 
 * A modern, elegant toast notification that slides in from the top
 * Supports multiple variants: success, error, warning, info
 * Auto-dismisses after a configurable duration
 */
const Toast = ({ 
  message, 
  variant = 'info', 
  duration = 5000, 
  onClose,
  isVisible = true 
}) => {
  useEffect(() => {
    if (duration && isVisible) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onClose, isVisible]);

  const variantStyles = {
    success: {
      bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      progress: 'bg-green-500'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-50 to-rose-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      progress: 'bg-red-500'
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      progress: 'bg-amber-500'
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-50 to-sky-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: <Info className="w-5 h-5 text-blue-500" />,
      progress: 'bg-blue-500'
    }
  };

  const style = variantStyles[variant] || variantStyles.info;

  if (!isVisible) return null;

  return (
    <div
      className={`
        ${style.bg} ${style.border} ${style.text}
        border-2 rounded-lg shadow-lg
        px-4 py-3 pr-10
        min-w-[320px] max-w-md
        relative overflow-hidden
        animate-slide-down
      `}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {style.icon}
        </div>
        <div className="flex-1 text-sm font-medium leading-relaxed">
          {message}
        </div>
      </div>
      
      <button
        onClick={onClose}
        className={`
          absolute top-2 right-2
          ${style.text} hover:opacity-70
          transition-opacity
          p-1 rounded
        `}
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      {duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
          <div
            className={`h-full ${style.progress} animate-progress`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Toast Container Component
 * Manages positioning and stacking of multiple toasts
 */
export const ToastContainer = ({ toasts, onRemove }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            variant={toast.variant}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
            isVisible={true}
          />
        ))}
      </div>
    </div>
  );
};

export default Toast;
