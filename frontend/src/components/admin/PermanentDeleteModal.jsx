import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const CONFIRM_WORD = 'DELETE';

/**
 * Confirmation modal for permanent (hard) deletes.
 *
 * Unlike a normal soft-delete confirm(), this action cannot be undone,
 * so the admin must type "DELETE" before the confirm button enables.
 */
const PermanentDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  itemLabel = 'item',
  itemName,
  title,
  message,
  isLoading = false,
}) => {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (isOpen) setTypedValue('');
  }, [isOpen]);

  const canConfirm = typedValue.trim().toUpperCase() === CONFIRM_WORD && !isLoading;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center p-6">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>

        <h3 className="text-xl font-bold text-dark-50 mb-3">
          {title || `Permanently delete this ${itemLabel}?`}
        </h3>

        <p className="text-dark-300 mb-4 leading-relaxed">
          {message ? (
            message
          ) : itemName ? (
            <>
              <span className="font-medium text-dark-100">"{itemName}"</span> will be removed from
              the database immediately.
            </>
          ) : (
            'This item will be removed from the database immediately.'
          )}{' '}
          This cannot be undone.
        </p>

        <p className="text-sm text-dark-400 mb-2">
          Type <span className="font-mono font-bold text-red-400">{CONFIRM_WORD}</span> to confirm.
        </p>
        <input
          type="text"
          value={typedValue}
          onChange={(e) => setTypedValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) handleConfirm();
          }}
          placeholder={CONFIRM_WORD}
          autoFocus
          className="w-full px-4 py-2 mb-6 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 text-center tracking-widest placeholder-dark-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
        />

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!canConfirm}>
            {isLoading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PermanentDeleteModal;
