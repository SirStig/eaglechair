/**
 * Toast and Confirmation Modal Usage Guide
 * 
 * This guide demonstrates how to use the new toast notification system
 * and confirmation modals throughout the application.
 */

// ============================================================================
// SETUP - Import required hooks and components
// ============================================================================

import { useToast } from '../contexts/ToastContext';
import { useState } from 'react';
import ConfirmModal from '../components/ui/ConfirmModal';

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function ExampleComponent() {
  const toast = useToast();

  // Success notifications (green)
  const handleSuccess = () => {
    toast.success('Product saved successfully!');
    toast.success('Changes published', 3000); // Custom duration (3 seconds)
  };

  // Error notifications (red)
  const handleError = () => {
    toast.error('Failed to save product');
    toast.error('Network error occurred', 5000);
  };

  // Warning notifications (amber/yellow)
  const handleWarning = () => {
    toast.warning('This action cannot be undone');
    toast.warning('Low stock alert!');
  };

  // Info notifications (blue)
  const handleInfo = () => {
    toast.info('Loading products...');
    toast.info('New update available');
  };

  // ============================================================================
  // REPLACING OLD ALERT() CALLS
  // ============================================================================

  // OLD WAY ❌
  const oldWay = () => {
    alert('File uploaded successfully!'); // Ugly browser dialog
  };

  // NEW WAY ✅
  const newWay = () => {
    toast.success('File uploaded successfully!'); // Beautiful toast notification
  };

  // ============================================================================
  // CONFIRMATION MODALS
  // ============================================================================

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    onConfirm: null,
    message: '',
    title: '',
    variant: 'danger' // 'danger', 'warning', or 'info'
  });

  // OLD WAY ❌ - Using window.confirm()
  const oldConfirm = async (itemName) => {
    if (window.confirm(`Delete ${itemName}?`)) { // Ugly browser confirm
      await deleteItem();
    }
  };

  // NEW WAY ✅ - Using ConfirmModal
  const newConfirm = (itemName, itemId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Item',
      message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteItem(itemId);
          toast.success(`${itemName} deleted successfully`);
        } catch (error) {
          toast.error('Failed to delete item');
        }
      }
    });
  };

  // Helper function to delete items
  const deleteItem = async (id) => {
    // Your delete logic here
    console.log('Deleting item', id);
  };

  // ============================================================================
  // DIFFERENT MODAL VARIANTS
  // ============================================================================

  // Danger variant (red) - for destructive actions
  const showDangerConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: 'This will permanently delete the product and all its data.',
      variant: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await deleteItem();
        toast.success('Product deleted');
      }
    });
  };

  // Warning variant (amber) - for important actions
  const showWarningConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Publish Changes',
      message: 'This will make your changes visible to all users immediately.',
      variant: 'warning',
      confirmText: 'Publish',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await publishChanges();
        toast.success('Changes published successfully');
      }
    });
  };

  const publishChanges = async () => {
    console.log('Publishing changes');
  };

  // Info variant (blue) - for informational confirmations
  const showInfoConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Action',
      message: 'Do you want to proceed with this action?',
      variant: 'info',
      confirmText: 'Continue',
      cancelText: 'Go Back',
      onConfirm: async () => {
        await performAction();
        toast.info('Action completed');
      }
    });
  };

  const performAction = async () => {
    console.log('Performing action');
  };

  // ============================================================================
  // COMMON PATTERNS
  // ============================================================================

  // Pattern 1: Form submission with success/error feedback
  const handleFormSubmit = async (formData) => {
    try {
      await saveData(formData);
      toast.success('Form submitted successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to submit form');
    }
  };

  const saveData = async (data) => {
    console.log('Saving data', data);
  };

  // Pattern 2: File upload with progress
  const handleFileUpload = async (file) => {
    const toastId = toast.info('Uploading file...', 0); // Duration 0 = stays until manually dismissed
    
    try {
      await uploadFile(file);
      toast.success('File uploaded successfully!');
    } catch (error) {
      toast.error('Upload failed');
    }
  };

  const uploadFile = async (file) => {
    console.log('Uploading file', file);
  };

  // Pattern 3: Bulk actions with confirmation
  const handleBulkDelete = (selectedItems) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Multiple Items',
      message: `Are you sure you want to delete ${selectedItems.length} items? This action cannot be undone.`,
      variant: 'danger',
      confirmText: `Delete ${selectedItems.length} Items`,
      onConfirm: async () => {
        try {
          await bulkDelete(selectedItems);
          toast.success(`${selectedItems.length} items deleted successfully`);
        } catch (error) {
          toast.error('Failed to delete some items');
        }
      }
    });
  };

  const bulkDelete = async (items) => {
    console.log('Bulk deleting', items);
  };

  // Pattern 4: Copy to clipboard
  const handleCopyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // ============================================================================
  // COMPONENT RENDER
  // ============================================================================

  return (
    <div>
      <h1>Example Component</h1>
      
      {/* Your component content */}
      <button onClick={() => toast.success('Success!')}>Show Success Toast</button>
      <button onClick={() => toast.error('Error!')}>Show Error Toast</button>
      <button onClick={() => newConfirm('Product XYZ', 123)}>Delete with Confirm</button>
      
      {/* Confirmation Modal - Place at the end of your component */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
      />
    </div>
  );
}

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/**
 * To migrate from alert() and confirm() to the new system:
 * 
 * 1. Import useToast hook:
 *    import { useToast } from '../contexts/ToastContext';
 * 
 * 2. Add toast to your component:
 *    const toast = useToast();
 * 
 * 3. Replace all alert() calls:
 *    - alert('Success!') → toast.success('Success!')
 *    - alert('Error!') → toast.error('Error!')
 *    - alert('Warning!') → toast.warning('Warning!')
 *    - alert('Info!') → toast.info('Info!')
 * 
 * 4. For confirm() dialogs:
 *    a. Add state for confirmation modal
 *    b. Import ConfirmModal component
 *    c. Replace confirm() with setConfirmModal()
 *    d. Add <ConfirmModal /> component to your JSX
 * 
 * 5. Choose appropriate toast duration:
 *    - Quick actions: 3000ms (3 seconds)
 *    - Normal: 5000ms (default)
 *    - Important: 7000ms
 *    - Persistent: 0 (stays until user dismisses)
 */

export default ExampleComponent;
