import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

/**
 * Confirmation Modal Component
 * 
 * A reusable confirmation dialog for destructive or important actions
 * Replaces browser confirm() dialogs with a styled modal
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // danger, warning, info
  confirmButtonVariant = 'danger',
  isLoading = false
}) => {
  const icons = {
    danger: <AlertCircle className="w-12 h-12 text-red-500" />,
    warning: <AlertTriangle className="w-12 h-12 text-amber-500" />,
    info: <Info className="w-12 h-12 text-blue-500" />
  };

  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="text-center p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {icons[variant] || icons.info}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-800 mb-3">
          {title}
        </h3>

        {/* Message */}
        <p className="text-slate-600 mb-6 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmButtonVariant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
