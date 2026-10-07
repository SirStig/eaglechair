import { useState, useEffect, useRef, useContext, useId, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { m, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import logger from '../../utils/logger';
import ImagePickerField from './media/ImagePickerField';
import EditModeContext from '../../contexts/EditModeContext';
import DiscardChangesDialog from './DiscardChangesDialog';
import { isSafeUrl, URL_POLICY_MESSAGE } from '../../utils/safeUrl';
import { LEGAL_DOCUMENT_TYPES } from './legalDocumentTypes';

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
  testimonial: [
    { key: 'quote', type: 'textarea', label: 'Quote' },
    { key: 'authorName', label: 'Name' },
    { key: 'authorTitle', label: 'Job Title' },
    { key: 'companyName', label: 'Company' },
    { key: 'location', label: 'Location (e.g. Chicago, IL)' },
    { key: 'photoUrl', type: 'image', label: 'Photo or Company Logo' },
    { key: 'displayOrder', type: 'number', label: 'Display Order' },
  ],
  'legal-document': [
    { key: 'title', required: true },
    { key: 'documentType', type: 'select', label: 'Document Type', options: LEGAL_DOCUMENT_TYPES, required: true },
    { key: 'slug', label: 'URL Slug', help: 'Lowercase words separated by hyphens, e.g. warranty-policy.' },
    { key: 'shortDescription', type: 'textarea', label: 'Short Description', rows: 2, help: 'Shown in listings and as the search snippet fallback.' },
    { key: 'content', type: 'textarea', label: 'Content', rows: 16, mono: true, help: 'HTML or Markdown.' },
    { key: 'version', label: 'Version' },
    { key: 'effectiveDate', label: 'Effective Date', help: 'As it should appear on the page, e.g. January 1, 2026.' },
    { key: 'metaTitle', label: 'SEO Title', maxLength: 60, help: 'Leave blank to use the document title.' },
    { key: 'metaDescription', type: 'textarea', label: 'SEO Description', rows: 3, maxLength: 160 },
    { key: 'displayOrder', type: 'number', label: 'Display Order' },
    { key: 'isActive', type: 'boolean', label: 'Published' },
  ],
};

// Fields that hold long-form text get a taller editor
const LONG_TEXT_FIELDS = new Set(['content', 'full_description', 'fullDescription', 'body']);

const INPUT_CLASS = 'w-full px-3.5 py-2.5 bg-dark-900 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 transition-colors hover:border-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/70 focus:border-primary-500';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const humanize = (key) =>
  key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ');

// "hero-slide" -> "Hero Slide"
const titleCase = (value) =>
  humanize(String(value)).replace(/\b\w/g, (c) => c.toUpperCase());

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const stableStringify = (value) => {
  try {
    return JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((acc, k) => { acc[k] = v[k]; return acc; }, {})
      : v));
  } catch {
    return '';
  }
};

// Label, help text, character counter and error message around one input.
// Defined at module level: a component declared inside EditModal would be a
// new type on every render, remounting the input and dropping focus after
// each keystroke.
const FieldShell = ({ def = {}, fieldError, value, inputId, label, children }) => {
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="block text-sm font-medium text-dark-50">
          {label}
          {def.required && <span className="ml-0.5 text-red-400" aria-hidden="true">*</span>}
        </label>
        {def.maxLength && (
          <span className={`text-xs tabular-nums ${length > def.maxLength ? 'text-amber-400' : 'text-dark-200'}`}>
            {length}/{def.maxLength}
          </span>
        )}
      </div>
      {children}
      {fieldError ? (
        <p id={`${inputId}-error`} className="text-xs text-red-300">{fieldError}</p>
      ) : def.help ? (
        <p id={`${inputId}-help`} className="text-xs text-dark-200">{def.help}</p>
      ) : null}
    </div>
  );
};

/**
 * EditModal Component
 *
 * Generic modal for editing content
 * Handles text, textarea, images, links, numbers and complex objects
 */
const EditModal = ({ isOpen, onClose, onSave, elementData, elementType, elementId, fieldSchema, fieldSchemaOverrides }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const initialRef = useRef({ data: {}, snapshot: '' });
  const initKeyRef = useRef(null);
  const elementDataRef = useRef(elementData);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const editorId = useId();
  const titleId = useId();
  const handleSubmitRef = useRef(null);
  const errorRef = useRef(null);
  const editMode = useContext(EditModeContext);
  const setEditorDirty = editMode?.setEditorDirty;

  elementDataRef.current = elementData;

  // fieldSchemaOverrides patches individual fields (matched by key) of the
  // type's schema, e.g. to pass options that depend on live data
  const baseSchema = fieldSchema || FIELD_SCHEMAS[elementType] || null;
  const schema = baseSchema && fieldSchemaOverrides
    ? baseSchema.map((f) => ({ ...f, ...(fieldSchemaOverrides.find((o) => o.key === f.key) || {}) }))
    : baseSchema;
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
    setConfirmDiscardOpen(false);
    logger.debug(CONTEXT, `Modal opened with elementType: ${elementType}, data:`, data);
  }, [initKey, elementType]);

  const isDirty = !!initKey && initKeyRef.current === initKey &&
    stableStringify(formData) !== initialRef.current.snapshot;
  const busy = loading;

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
      // Leave keys alone while another dialog (e.g. the media library) is on top
      const otherDialog = e.target instanceof Element ? e.target.closest('[role="dialog"]') : null;
      if (otherDialog && !dialogRef.current?.contains(otherDialog)) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleSubmitRef.current?.();
        return;
      }
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
      const value = formData[key];
      if (schemaByKey[key]?.required && (value === undefined || value === null || String(value).trim() === '')) {
        errors[key] = 'This field is required.';
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
      requestAnimationFrame(() => {
        dialogRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      });
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
  handleSubmitRef.current = handleSubmit;

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

  const renderImageField = (key, label) => (
    <ImagePickerField
      key={key}
      value={formData[key] || ''}
      onChange={(url) => setField(key, url)}
      subfolder={elementType || 'general'}
      label={label}
      help={schemaByKey[key]?.help}
      previewClassName="h-56 w-full"
      disabled={loading}
    />
  );

  const renderField = (key) => {
    const value = initialData[key];
    const fieldDef = schemaByKey[key] || {};
    const label = fieldDef.label || humanize(key);
    const kind = getFieldKind(key, value);
    const inputId = `${editorId}-${key}`;
    const fieldError = fieldErrors[key];
    const describedBy = fieldError ? `${inputId}-error` : fieldDef.help ? `${inputId}-help` : undefined;
    const common = {
      id: inputId,
      name: key,
      onChange: handleChange,
      required: fieldDef.required || undefined,
      'aria-invalid': fieldError ? 'true' : undefined,
      'aria-describedby': describedBy,
      className: `${INPUT_CLASS} ${fieldError ? '!border-red-500' : ''}`,
    };

    switch (kind) {
      case 'skip':
        return null;
      case 'states':
        return renderStatesField(key, label);
      case 'image':
        return renderImageField(key, label);
      case 'url':
        return (
          <FieldShell key={key} def={fieldDef} fieldError={fieldError} value={formData[key]} inputId={inputId} label={label}>
            <input
              {...common}
              type="text"
              inputMode="url"
              value={formData[key] ?? ''}
              placeholder="https://example.com or /page"
            />
          </FieldShell>
        );
      case 'select': {
        const options = (fieldDef.options || []).map((opt) =>
          typeof opt === 'object' ? opt : { value: opt, label: humanize(opt) });
        const current = formData[key] ?? '';
        const allOptions = current && !options.some((o) => o.value === current)
          ? [{ value: current, label: humanize(current) }, ...options]
          : options;
        return (
          <FieldShell key={key} def={fieldDef} fieldError={fieldError} value={formData[key]} inputId={inputId} label={label}>
            <select {...common} value={current}>
              {(!fieldDef.required || !current) && (
                <option value="">{fieldDef.required ? 'Select…' : 'Default'}</option>
              )}
              {allOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FieldShell>
        );
      }
      case 'boolean':
        return (
          <label
            key={key}
            htmlFor={inputId}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dark-600 bg-dark-700/50 px-4 py-3"
          >
            <span>
              <span className="block text-sm font-medium text-dark-50">{label}</span>
              {fieldDef.help && <span className="block text-xs text-dark-200">{fieldDef.help}</span>}
            </span>
            <input
              id={inputId}
              name={key}
              type="checkbox"
              checked={!!formData[key]}
              onChange={handleChange}
              className="h-5 w-5 flex-shrink-0 cursor-pointer accent-primary-500"
            />
          </label>
        );
      case 'number':
        return (
          <FieldShell key={key} def={fieldDef} fieldError={fieldError} value={formData[key]} inputId={inputId} label={label}>
            <input {...common} type="number" value={formData[key] ?? ''} className={`${common.className} sm:max-w-[10rem]`} />
          </FieldShell>
        );
      case 'textarea': {
        const rows = fieldDef.rows || (LONG_TEXT_FIELDS.has(key) ? 12 : 4);
        return (
          <FieldShell key={key} def={fieldDef} fieldError={fieldError} value={formData[key]} inputId={inputId} label={label}>
            <textarea
              {...common}
              value={formData[key] ?? ''}
              rows={rows}
              className={`${common.className} resize-y leading-relaxed ${fieldDef.mono ? 'font-mono text-sm' : ''}`}
            />
          </FieldShell>
        );
      }
      case 'text':
      default:
        return (
          <FieldShell key={key} def={fieldDef} fieldError={fieldError} value={formData[key]} inputId={inputId} label={label}>
            <input {...common} type="text" value={formData[key] ?? ''} />
          </FieldShell>
        );
    }
  };

  if (!isOpen) return null;

  const isNew = elementId === 'new' || (elementId === undefined && !elementData?.id);
  const typeLabel = elementType ? titleCase(elementType) : 'Content';
  const title = `${isNew ? 'Add' : 'Edit'} ${typeLabel}`;
  const wide = fieldKeys.some((key) => getFieldKind(key, initialData[key]) === 'states') ||
    fieldKeys.some((key) => (schemaByKey[key]?.rows || 0) >= 12 || LONG_TEXT_FIELDS.has(key));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10001] flex items-end justify-center sm:items-center sm:p-4">
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
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-dark-600 bg-dark-800 shadow-2xl sm:max-h-[90vh] sm:rounded-xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-dark-600 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-editor-300">
                {isNew ? 'New content' : 'Content editor'}
              </p>
              <h2 id={titleId} className="truncate text-lg font-semibold text-dark-50">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label="Close"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-dark-200 transition-colors hover:bg-dark-700 hover:text-dark-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} noValidate className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {fieldKeys.length > 0 ? (
              fieldKeys.map(key => renderField(key))
            ) : (
              <div className="py-8 text-center text-dark-200">
                There are no editable fields for this {typeLabel.toLowerCase()}.
              </div>
            )}
          </form>

          {/* Error stays visible regardless of scroll position */}
          {error && (
            <div ref={errorRef} role="alert" className="border-t border-red-800 bg-red-950/60 px-5 py-3 text-sm text-red-100 sm:px-6">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-dark-600 bg-dark-750 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <p className="hidden text-xs text-dark-200 sm:block" aria-live="polite">
              {isDirty ? (
                <span className="text-amber-300">Unsaved changes</span>
              ) : (
                <>
                  <kbd className="rounded border border-dark-500 bg-dark-700 px-1.5 py-0.5 font-sans text-[10px]">{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
                  {' + '}
                  <kbd className="rounded border border-dark-500 bg-dark-700 px-1.5 py-0.5 font-sans text-[10px]">Enter</kbd>
                  {' to save'}
                </>
              )}
            </p>
            <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
              <Button type="button" variant="ghost" size="sm" onClick={requestClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={busy || (!isNew && !isDirty)}
              >
                {loading ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
              </Button>
            </div>
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
