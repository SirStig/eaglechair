import { useState, useEffect, useRef, useContext, useId, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { m, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import { uploadImage, previewImage } from '../../utils/imageUpload';
import logger from '../../utils/logger';
import ResponsiveImage from '../ui/ResponsiveImage';
import EditModeContext from '../../contexts/EditModeContext';
import DiscardChangesDialog from './DiscardChangesDialog';
import { isSafeUrl, URL_POLICY_MESSAGE } from '../../utils/safeUrl';

const CONTEXT = 'EditModal';

// Auto-generated or internal fields that are never edited
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'view_count', 'viewCount', 'index']);

// Fields that hold an uploaded image. Matched by exact name (collected from
// the contentData.json export and the admin API shapes) - never by substring
// or by "the value looks like a URL", which turned link fields into uploads.
const IMAGE_FIELDS = new Set([
  'image', 'imageUrl', 'image_url',
  'backgroundImage', 'backgroundImageUrl', 'background_image_url',
  'bannerImageUrl', 'banner_image_url',
  'coverImageUrl', 'cover_image_url',
  'fullImageUrl', 'full_image_url',
  'swatchImageUrl', 'swatch_image_url',
  'thumbnail', 'thumbnailUrl', 'thumbnail_url',
  'logo', 'logoUrl', 'logo_url', 'logoDarkUrl', 'logo_dark_url',
  'faviconUrl', 'favicon_url',
  'photo', 'photoUrl', 'photo_url',
  'iconUrl', 'icon_url',
  'primaryImage', 'primary_image', 'primaryImageUrl', 'primary_image_url',
  'cta_image', 'ctaImage',
]);

// Per-type image fields that don't follow the naming above
const TYPE_IMAGE_FIELDS = {
  // The gallery export calls the primary image `url`
  installation: new Set(['url']),
};

// Anything else ending in url/link/href/website is a link, edited as text and
// validated against the URL policy.
const URL_FIELD_PATTERN = /(url|link|href|website)$/i;

const BOOLEAN_FIELDS = new Set(['is_active', 'is_featured', 'isActive', 'isFeatured', 'is_published', 'isPublished']);
const NUMBER_FIELDS = new Set(['display_order', 'displayOrder', 'order', 'sort_order', 'sortOrder']);
const TEXTAREA_HINTS = ['description', 'content', 'bio', 'full_description', 'fullDescription'];

/**
 * Optional per-type field schemas. Listed fields are always shown, even when
 * the key is missing from the data (e.g. the hero-slide export omits the
 * secondary CTA), so they can still be edited inline.
 */
const FIELD_SCHEMAS = {
  'hero-slide': [
    { key: 'title' },
    { key: 'subtitle', type: 'textarea' },
    { key: 'image', type: 'image', label: 'Background Image' },
    { key: 'ctaText', label: 'CTA Text' },
    { key: 'ctaLink', type: 'url', label: 'CTA Link' },
    { key: 'ctaStyle', type: 'select', label: 'CTA Style', options: ['primary', 'secondary', 'outline'] },
    { key: 'secondaryCtaText', label: 'Secondary CTA Text' },
    { key: 'secondaryCtaLink', type: 'url', label: 'Secondary CTA Link' },
    { key: 'displayOrder', type: 'number', label: 'Display Order' },
  ],
};

const INPUT_CLASS = 'w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const humanize = (key) =>
  key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');

const stableStringify = (value) => {
  try {
    return JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((acc, k) => { acc[k] = v[k]; return acc; }, {})
      : v));
  } catch {
    return '';
  }
};

/**
 * EditModal Component
 *
 * Generic modal for editing content
 * Handles text, textarea, images, links, numbers and complex objects
 */
const EditModal = ({ isOpen, onClose, onSave, elementData, elementType, elementId, fieldSchema }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const uploadSeqRef = useRef({});
  const initialRef = useRef({ data: {}, snapshot: '' });
  const initKeyRef = useRef(null);
  const elementDataRef = useRef(elementData);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const editorId = useId();
  const titleId = useId();
  const editMode = useContext(EditModeContext);
  const setEditorDirty = editMode?.setEditorDirty;

  elementDataRef.current = elementData;

  const schema = fieldSchema || FIELD_SCHEMAS[elementType] || null;
  const schemaByKey = schema ? Object.fromEntries(schema.map((f) => [f.key, f])) : {};

  // Initialize the form only when the modal opens or switches to another
  // element - NOT whenever the caller passes a new elementData object
  // (inline literals would otherwise wipe the user's edits on every render).
  const initKey = isOpen ? String(elementId ?? elementData?.id ?? elementType ?? 'new') : null;
  useEffect(() => {
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;
    if (!initKey) return;
    const data = { ...(elementDataRef.current || {}) };
    initialRef.current = { data, snapshot: stableStringify(data) };
    setFormData(data);
    setError(null);
    setFieldErrors({});
    setImagePreview(null);
    setConfirmDiscardOpen(false);
    logger.debug(CONTEXT, `Modal opened with elementType: ${elementType}, data:`, data);
  }, [initKey, elementType]);

  const isDirty = !!initKey && initKeyRef.current === initKey &&
    stableStringify(formData) !== initialRef.current.snapshot;
  const busy = loading || uploadingImage;

  // Let the edit-mode toggle know there are unsaved changes
  useEffect(() => {
    if (!setEditorDirty) return undefined;
    setEditorDirty(editorId, isDirty);
    return () => setEditorDirty(editorId, false);
  }, [setEditorDirty, editorId, isDirty]);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  }, [busy, isDirty, onClose]);

  const confirmDiscard = () => {
    setConfirmDiscardOpen(false);
    setEditorDirty?.(editorId, false);
    onClose();
  };

  const cancelDiscard = useCallback(() => setConfirmDiscardOpen(false), []);

  // Move focus into the dialog; restore it to the opener when it closes
  useEffect(() => {
    if (!isOpen) return undefined;
    returnFocusRef.current = document.activeElement;
    const raf = requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const firstField = root.querySelector(`form ${FOCUSABLE.split(', ').join(', form ')}`) ||
        root.querySelector(FOCUSABLE);
      firstField?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      const target = returnFocusRef.current;
      if (target?.isConnected && typeof target.focus === 'function') target.focus();
    };
  }, [isOpen]);

  // Escape closes (with the dirty check); Tab stays inside the dialog
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (confirmDiscardOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = [...root.querySelectorAll(FOCUSABLE)]
        .filter((el) => el.getClientRects().length > 0 || el === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmDiscardOpen, requestClose]);

  const setField = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  // Coerce by input type so number fields are saved as numbers, not strings
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setField(name, checked);
    } else if (type === 'number') {
      if (value === '') {
        setField(name, null);
      } else {
        const num = Number(value);
        setField(name, Number.isNaN(num) ? value : num);
      }
    } else {
      setField(name, value);
    }
  };

  const handleImageSelect = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Guard against out-of-order resolution when multiple uploads are
    // kicked off for the same field before an earlier one finishes.
    const seq = (uploadSeqRef.current[fieldName] || 0) + 1;
    uploadSeqRef.current[fieldName] = seq;
    const isLatest = () => uploadSeqRef.current[fieldName] === seq;

    setUploadingImage(true);
    setError(null);
    previewImage(file).then(preview => {
      if (!isLatest()) return;
      setImagePreview(prev => ({ ...prev, [fieldName]: preview }));
    }).catch(() => {});

    try {
      const subfolder = elementType || 'general';
      const imageUrl = await uploadImage(file, subfolder);
      if (!isLatest()) return;
      setField(fieldName, imageUrl);
      logger.info(CONTEXT, `Image uploaded for ${fieldName}: ${imageUrl}`);
    } catch (err) {
      if (!isLatest()) return;
      logger.error(CONTEXT, 'Image upload failed', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      if (isLatest()) {
        setUploadingImage(false);
      }
    }
  };

  const getFieldKind = (key, value) => {
    const declared = schemaByKey[key]?.type;
    if (declared) return declared;
    if (elementType === 'sales-rep' && (key === 'states_covered' || key === 'statesCovered')) return 'states';
    if (Array.isArray(value)) return 'skip';
    if (IMAGE_FIELDS.has(key) || TYPE_IMAGE_FIELDS[elementType]?.has(key)) return 'image';
    if (URL_FIELD_PATTERN.test(key)) return 'url';
    if (BOOLEAN_FIELDS.has(key) || typeof value === 'boolean') return 'boolean';
    if (NUMBER_FIELDS.has(key) || typeof value === 'number') return 'number';
    if (TEXTAREA_HINTS.some(field => key.toLowerCase().includes(field.toLowerCase())) ||
        (typeof value === 'string' && value.length > 100)) return 'textarea';
    if (value === null || value === undefined || typeof value === 'string') return 'text';
    return 'skip';
  };

  // Schema fields first (in schema order), then any other keys in the data
  const initialData = initialRef.current.data;
  const fieldKeys = [
    ...(schema ? schema.map((f) => f.key) : []),
    ...Object.keys(initialData).filter((key) => !schemaByKey[key]),
  ].filter((key) => !HIDDEN_FIELDS.has(key));

  const validate = () => {
    const errors = {};
    fieldKeys.forEach((key) => {
      const kind = getFieldKind(key, initialData[key]);
      if (kind === 'url' && !isSafeUrl(formData[key])) {
        errors[key] = URL_POLICY_MESSAGE;
      }
    });
    return errors;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (busy) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    // Schema-only fields the user left empty are not sent, so a key that is
    // merely missing from the export can't wipe the stored value.
    const payload = { ...formData };
    if (schema) {
      schema.forEach(({ key }) => {
        if (!(key in initialData) && (payload[key] === '' || payload[key] === null || payload[key] === undefined)) {
          delete payload[key];
        }
      });
    }

    setLoading(true);
    setError(null);

    try {
      await onSave(payload);
      // Saved: nothing left to lose if the caller keeps the modal mounted
      initialRef.current = { data: initialData, snapshot: stableStringify(formData) };
      setEditorDirty?.(editorId, false);
      logger.info(CONTEXT, `Content saved for ${elementType}`);
    } catch (err) {
      logger.error(CONTEXT, `Error saving content for ${elementType}:`, err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const renderStatesField = (key, label) => {
    const statesByRegion = {
      'Northeast': ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
      'Southeast': ['MD', 'DE', 'VA', 'WV', 'KY', 'NC', 'SC', 'TN', 'GA', 'FL', 'AL', 'MS', 'LA'],
      'Midwest': ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
      'Southwest': ['TX', 'OK', 'AR', 'NM', 'AZ'],
      'West': ['CO', 'WY', 'MT', 'ID', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI'],
    };

    const allStates = Object.values(statesByRegion).flat();
    const currentStates = formData[key] || [];

    const toggleState = (stateCode) => {
      const newStates = currentStates.includes(stateCode)
        ? currentStates.filter(s => s !== stateCode)
        : [...currentStates, stateCode];
      setField(key, newStates);
    };

    const selectRegion = (states) => {
      setField(key, states);
    };

    return (
      <div key={key} className="space-y-3">
        <span className="block text-sm font-medium text-dark-100">
          {label}
        </span>

        {/* Quick selection buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => selectRegion(allStates)}
            className="px-3 py-1 text-xs bg-primary-600 hover:bg-primary-700 text-dark-900 rounded transition-colors font-semibold"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => selectRegion([])}
            className="px-3 py-1 text-xs bg-dark-600 text-dark-100 rounded hover:bg-dark-500 transition-colors"
          >
            Clear
          </button>
          {Object.entries(statesByRegion).map(([region, states]) => (
            <button
              key={region}
              type="button"
              onClick={() => selectRegion(states)}
              className="px-3 py-1 text-xs bg-dark-600 text-dark-100 rounded hover:bg-dark-500 transition-colors"
            >
              {region}
            </button>
          ))}
        </div>

        {/* Selection summary */}
        <div className="bg-dark-700 p-3 rounded-lg">
          <div className="text-sm text-dark-100">
            <strong className="text-dark-50">Selected:</strong> {currentStates.length > 0 ? (
              <span className="text-primary-500 font-medium">{[...currentStates].sort().join(', ')}</span>
            ) : (
              <span className="text-dark-300">None</span>
            )}
          </div>
        </div>

        {/* State grid by region */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {Object.entries(statesByRegion).map(([region, states]) => (
            <div key={region} className="bg-dark-700 p-3 rounded-lg">
              <h4 className="text-sm font-semibold text-dark-50 mb-2">{region}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {states.map(stateCode => {
                  const isSelected = currentStates.includes(stateCode);
                  return (
                    <button
                      key={stateCode}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleState(stateCode)}
                      className={`
                        px-2 py-1.5 rounded text-xs font-medium transition-all
                        ${isSelected
                          ? 'bg-primary-600 text-dark-900 border-2 border-primary-500 shadow-lg'
                          : 'bg-dark-600 text-dark-100 border-2 border-dark-500 hover:bg-dark-500 hover:border-dark-400'
                        }
                      `}
                    >
                      {stateCode}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderImageField = (key, label) => {
    const currentImage = imagePreview?.[key] || formData[key];

    return (
      <div key={key} className="space-y-2">
        <span className="block text-sm font-medium text-dark-100">
          {label}
        </span>

        {/* Current Image Preview */}
        {currentImage && (
          <div className="relative w-full max-w-md mx-auto bg-dark-700 rounded-lg overflow-hidden border-2 border-dark-500">
            <ResponsiveImage
              sizes="448px"
              fullResolution={false}
              src={currentImage}
              alt={label}
              className="w-full h-auto max-h-64 object-contain"
              onError={(e) => {
                // If image fails to load, hide the preview
                e.target.style.display = 'none';
              }}
            />
            {/* Image overlay showing it's the current image */}
            <div className="absolute top-2 left-2 px-2 py-1 bg-dark-900/80 text-dark-50 text-xs rounded">
              Current Image
            </div>
          </div>
        )}

        {/* Upload/Replace Button */}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-lg focus-within:ring-2 focus-within:ring-accent-500">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e, key)}
              className="sr-only"
              disabled={uploadingImage}
              aria-label={`${currentImage ? 'Replace' : 'Upload'} ${label}`}
            />
            <div className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-dark-900 rounded-lg transition-colors border border-primary-500 text-sm font-semibold">
              {uploadingImage ? 'Uploading...' : currentImage ? 'Replace Image' : 'Upload Image'}
            </div>
          </label>
          {formData[key] && (
            <button
              type="button"
              onClick={() => {
                setField(key, '');
                setImagePreview(prev => ({ ...prev, [key]: null }));
              }}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-100 rounded-lg transition-colors border border-red-700 text-sm font-medium"
            >
              Remove Image
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderField = (key) => {
    const value = initialData[key];
    const fieldDef = schemaByKey[key];
    const label = fieldDef?.label || humanize(key);
    const kind = getFieldKind(key, value);
    const inputId = `${editorId}-${key}`;
    const fieldError = fieldErrors[key];
    const errorId = fieldError ? `${inputId}-error` : undefined;

    switch (kind) {
      case 'skip':
        return null;
      case 'states':
        return renderStatesField(key, label);
      case 'image':
        return renderImageField(key, label);
      case 'url':
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-medium text-dark-100">
              {label}
            </label>
            <input
              id={inputId}
              name={key}
              type="text"
              inputMode="url"
              value={formData[key] ?? ''}
              onChange={handleChange}
              placeholder="https://example.com or /page"
              aria-invalid={fieldError ? 'true' : undefined}
              aria-describedby={errorId}
              className={`${INPUT_CLASS} ${fieldError ? 'border-red-500' : ''}`}
            />
            {fieldError && (
              <p id={errorId} className="text-sm text-red-300">{fieldError}</p>
            )}
          </div>
        );
      case 'select': {
        const options = fieldDef?.options || [];
        const current = formData[key] ?? '';
        const allOptions = current && !options.includes(current) ? [current, ...options] : options;
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-medium text-dark-100">
              {label}
            </label>
            <select
              id={inputId}
              name={key}
              value={current}
              onChange={handleChange}
              className={INPUT_CLASS}
            >
              <option value="">Default</option>
              {allOptions.map((opt) => (
                <option key={opt} value={opt}>{humanize(opt)}</option>
              ))}
            </select>
          </div>
        );
      }
      case 'boolean':
        return (
          <div key={key} className="flex items-center gap-3">
            <input
              id={inputId}
              name={key}
              type="checkbox"
              checked={!!formData[key]}
              onChange={handleChange}
              className="w-5 h-5 bg-dark-700 border border-dark-500 rounded text-accent-500 focus:ring-2 focus:ring-accent-500"
            />
            <label htmlFor={inputId} className="text-sm font-medium text-dark-100">
              {label}
            </label>
          </div>
        );
      case 'number':
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-medium text-dark-100">
              {label}
            </label>
            <input
              id={inputId}
              name={key}
              type="number"
              value={formData[key] ?? ''}
              onChange={handleChange}
              className={INPUT_CLASS}
            />
          </div>
        );
      case 'textarea':
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-medium text-dark-100">
              {label}
            </label>
            <textarea
              id={inputId}
              name={key}
              value={formData[key] ?? ''}
              onChange={handleChange}
              rows={6}
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>
        );
      case 'text':
      default:
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-medium text-dark-100">
              {label}
            </label>
            <input
              id={inputId}
              name={key}
              type="text"
              value={formData[key] ?? ''}
              onChange={handleChange}
              className={INPUT_CLASS}
            />
          </div>
        );
    }
  };

  if (!isOpen) return null;

  const title = `Edit ${elementType ? elementType.charAt(0).toUpperCase() + elementType.slice(1) : 'Content'}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        {/* Backdrop */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={requestClose}
          aria-hidden="true"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <m.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={busy || undefined}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-dark-800 rounded-xl shadow-2xl border border-dark-600 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
            <h2 id={titleId} className="text-xl font-semibold text-dark-50">
              {title}
            </h2>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label="Close"
              className="text-dark-300 hover:text-dark-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {fieldKeys.length > 0 ? (
              fieldKeys.map(key => renderField(key))
            ) : (
              <div className="text-center py-8 text-dark-300">
                No editable fields available for this {elementType}
              </div>
            )}

            {error && (
              <div role="alert" className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-100 text-sm">
                {error}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-600 bg-dark-750">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              onClick={handleSubmit}
              disabled={busy}
            >
              {loading ? 'Saving...' : uploadingImage ? 'Uploading...' : 'Save Changes'}
            </Button>
          </div>
        </m.div>

        <DiscardChangesDialog
          isOpen={confirmDiscardOpen}
          onConfirm={confirmDiscard}
          onCancel={cancelDiscard}
        />
      </div>
    </AnimatePresence>
  );
};

export default EditModal;
