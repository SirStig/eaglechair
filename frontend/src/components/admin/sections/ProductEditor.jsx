import { useState, useEffect, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { useToast } from '../../../contexts/ToastContext';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl, formatStockStatus } from '../../../utils/apiHelpers';
import { slugify } from '../../../utils/slugify';
import { uploadImage } from '../../../utils/imageUpload';
import {
  FileText,
  DollarSign,
  Ruler,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  Search,
  Upload,
  X,
  Plus,
  Trash2,
  Wrench,
  Award,
  TrendingUp,
  Package,
  BarChart3,
} from 'lucide-react';
import ResponsiveImage from '../../ui/ResponsiveImage';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import ProductAnalyticsPanel from '../ProductAnalyticsPanel';
import useBulkSelection from '../../../hooks/useBulkSelection';
import { SelectAllCheckbox, RowCheckbox } from '../bulk/SelectCheckbox';

/**
 * Comprehensive Product Editor
 * 
 * Full product editing with tabs for:
 * - Basic Info
 * - Pricing
 * - Dimensions
 * - Images
 * - Materials & Construction
 * - Features & Inventory
 * - Variations
 * - Certifications & Usage
 * - SEO & Analytics
 */
const OPTION_GROUP_SWITCHES = [
  { field: 'upholstery_enabled', label: 'Upholstery' },
  { field: 'colors_enabled', label: 'Colors' },
  { field: 'laminates_enabled', label: 'Laminates' },
];

// Section label with a switch that shows or hides the whole option group on
// the storefront. Turning it off keeps the selections below.
const OptionGroupHeading = ({ label, enabled, onChange }) => (
  <div className="flex items-center justify-between gap-3 mb-2">
    <span className="text-sm font-medium text-dark-200">{label}</span>
    <label className="flex items-center gap-2 cursor-pointer text-xs text-dark-300">
      <span>{enabled ? 'Shown on site' : 'Hidden on site'}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Show ${label} on site`}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-primary-600' : 'bg-dark-600'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  </div>
);

const STOCK_STATUS_OPTIONS = ['Made to Order', 'Available', 'Low Stock', 'Out of Stock', 'Discontinued'];

// Variations have no id until the product is saved, so new ones key by position
const variationKey = (variation, index) => variation.id ?? `new-${index}`;
const rowKey = (row) => row.key;

const BULK_SELECT = 'rounded-lg border border-dark-600 bg-dark-700 px-2.5 py-1.5 text-sm text-dark-100 focus:border-primary-500 outline-none';

/**
 * Batch edit bar for the Variations tab. Changes apply to local state only;
 * they're saved with the product like any other edit.
 */
const VariationBulkBar = ({ selection, finishes, upholsteries, colors, families, onPatch, onRemove }) => {
  const [price, setPrice] = useState('');
  if (!selection.count) return null;

  const pick = (label, options, toPatch) => (
    <select
      key={label}
      value=""
      onChange={(e) => {
        if (e.target.value === '') return;
        onPatch(toPatch(e.target.value));
      }}
      className={BULK_SELECT}
      aria-label={label}
    >
      <option value="">{label}…</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
  const idOptions = (rows, none, getLabel = (r) => r.name) => [
    { value: 'none', label: none },
    ...rows.map((r) => ({ value: String(r.id), label: getLabel(r) })),
  ];
  const toId = (v) => (v === 'none' ? null : Number(v));
  const groupOptions = [
    { value: 'inherit', label: 'Same as product' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ];
  const toGroup = (v) => (v === 'inherit' ? null : v === 'on');
  const familyOptions = families.map((f) => ({ value: String(f.id), label: f.name }));
  const plural = `${selection.count} variation${selection.count === 1 ? '' : 's'}`;

  return (
    <div className="sticky bottom-20 sm:bottom-4 z-30" role="region" aria-label="Batch edit variations">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-500/60 bg-dark-800/95 px-3 py-2.5 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={selection.clear}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-dark-50 hover:bg-dark-700"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
          {plural} selected
        </button>
        <span className="hidden sm:block h-5 w-px bg-dark-600" />
        {pick('Finish', idOptions(finishes, 'No finish'), (v) => () => ({ finish_id: toId(v) }))}
        {pick('Upholstery', idOptions(upholsteries, 'No upholstery'), (v) => () => ({ upholstery_id: toId(v) }))}
        {pick('Color', idOptions(colors, 'No color'), (v) => () => ({ color_id: toId(v) }))}
        {OPTION_GROUP_SWITCHES.map(({ field, label }) =>
          pick(`${label} options`, groupOptions, (v) => () => ({ [field]: toGroup(v) }))
        )}
        {pick('Available', [{ value: 'yes', label: 'Available for sale' }, { value: 'no', label: 'Not available' }],
          (v) => () => ({ is_available: v === 'yes' }))}
        {pick('Stock status', STOCK_STATUS_OPTIONS.map((o) => ({ value: o, label: o })), (v) => () => ({ stock_status: v }))}
        {familyOptions.length > 0 && pick('Add to family', familyOptions, (v) => (variation) => ({
          family_ids: [...new Set([...(variation.family_ids || []), Number(v)])],
        }))}
        {familyOptions.length > 0 && pick('Remove from family', familyOptions, (v) => (variation) => ({
          family_ids: (variation.family_ids || []).filter((id) => id !== Number(v)),
        }))}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const dollars = parseFloat(price);
            if (Number.isNaN(dollars)) return;
            onPatch(() => ({ price_adjustment: Math.round(dollars * 100) }));
            setPrice('');
          }}
        >
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price adj. $"
            className={`${BULK_SELECT} w-28`}
            aria-label="Price adjustment in dollars"
          />
          <button type="submit" disabled={price === ''} className="rounded-lg border border-dark-600 px-2.5 py-1.5 text-sm text-dark-100 hover:bg-dark-700 disabled:opacity-50">
            Set
          </button>
        </form>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900/30"
        >
          Remove selected
        </button>
      </div>
    </div>
  );
};

const ProductEditor = ({ product, onBack }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: '',
    model_number: '',
    model_suffix: '',
    slug: '',
    category_id: null,
    subcategory_id: null,
    family_id: null,
    short_description: '',
    full_description: '',
    base_price: 0,
    msrp: null,
    width: null,
    depth: null,
    height: null,
    seat_width: null,
    seat_depth: null,
    seat_height: null,
    arm_height: null,
    back_height: null,
    weight: null,
    shipping_weight: null,
    upholstery_amount: null,
    upholstery_enabled: true,
    colors_enabled: true,
    laminates_enabled: true,
    frame_material: '',
    construction_details: '',
    features: [],
    lead_time_days: null,
    minimum_order_quantity: 1,
    is_featured: false,
    is_new: false,
    is_active: true,
    is_custom_only: false,
    is_outdoor_suitable: false,
    ada_compliant: false,
    meta_title: '',
    meta_description: '',
    ...product,
    stock_status: formatStockStatus(product?.stock_status) || 'Made to Order',
    hover_images: Array.isArray(product?.hover_images) ? product.hover_images : [],
    keywords: Array.isArray(product?.keywords) ? product.keywords : [],
    secondary_family_ids: Array.isArray(product?.secondary_family_ids) ? product.secondary_family_ids : [],
    category_ids: Array.isArray(product?.category_ids) ? product.category_ids : [],
    subcategory_ids: Array.isArray(product?.subcategory_ids) ? product.subcategory_ids : [],
  });
  const [saving, setSaving] = useState(false);

  // Dropdowns data
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);

  // Multi-value fields
  const [images, setImages] = useState(() => {
    const notGallery = new Set([product?.primary_image_url, ...(product?.hover_images || [])].filter(Boolean));
    return (Array.isArray(product?.images) ? product.images : [])
      .filter((img) => !notGallery.has(typeof img === 'string' ? img : img?.url));
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [variations, setVariations] = useState(Array.isArray(product?.variations) ? product.variations : []);
  const variationRows = useMemo(() => variations.map((v, i) => ({ key: variationKey(v, i) })), [variations]);
  const variationSelection = useBulkSelection(variationRows, rowKey);
  const variationOrder = variationRows.map(rowKey);
  // patchFor(variation) returns the fields to change on each selected variation
  const patchSelectedVariations = (patchFor) => {
    const picked = new Set(variationSelection.selectedIds);
    setVariations((prev) => prev.map((v, i) => (picked.has(variationKey(v, i)) ? { ...v, ...patchFor(v) } : v)));
  };
  const removeSelectedVariations = () => {
    const picked = new Set(variationSelection.selectedIds);
    setVariations((prev) => prev.filter((v, i) => !picked.has(variationKey(v, i))));
    variationSelection.clear();
  };
  const [selectedFinishes, setSelectedFinishes] = useState(product?.available_finishes || []);
  const [selectedUpholsteries, setSelectedUpholsteries] = useState(product?.available_upholsteries || []);
  const [selectedColors, setSelectedColors] = useState(product?.available_colors || []);
  const [selectedLaminates, setSelectedLaminates] = useState(product?.available_laminates || []);
  const [laminates, setLaminates] = useState([]);
  const [flameCerts, setFlameCerts] = useState(product?.flame_certifications || []);
  const [greenCerts, setGreenCerts] = useState(product?.green_certifications || []);

  const [keywordInput, setKeywordInput] = useState('');

  const uploadProductImage = (file) => uploadImage(file, 'products');


  useEffect(() => {
    fetchCategories();
    fetchFamilies();
    fetchFinishes();
    fetchUpholsteries();
    fetchColors();
    fetchLaminates();
  }, []);

  // Subcategory options follow every selected category, not just the primary
  const selectedCategoryIds = [
    ...(formData.category_id ? [formData.category_id] : []),
    ...(formData.category_ids || []),
  ].filter((id, index, all) => all.indexOf(id) === index);
  const selectedCategoryKey = selectedCategoryIds.join(',');

  useEffect(() => {
    if (selectedCategoryIds.length > 0) {
      fetchSubcategories(selectedCategoryIds);
    } else {
      setSubcategories([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryKey]);

  const fetchCategories = async () => {
    try {
      // include_nested so nested categories can be assigned too
      const response = await apiClient.get('/api/v1/categories?include_nested=true');
      const list = Array.isArray(response) ? response : [];
      // Parents first, each followed by its nested categories
      const topLevel = list.filter((c) => !c.parent_id);
      setCategories(
        topLevel.flatMap((parent) => [
          parent,
          ...list.filter((c) => c.parent_id === parent.id),
        ])
      );
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchSubcategories = async (categoryIds) => {
    try {
      const responses = await Promise.all(
        categoryIds.map((categoryId) =>
          apiClient.get(`/api/v1/admin/subcategories?category_id=${categoryId}`)
        )
      );
      const seen = new Set();
      const merged = [];
      for (const response of responses) {
        for (const sub of response.items || []) {
          if (!seen.has(sub.id)) {
            seen.add(sub.id);
            merged.push(sub);
          }
        }
      }
      setSubcategories(merged);
    } catch (error) {
      console.error('Failed to fetch subcategories:', error);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/families');
      setFamilies(response.items || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
    }
  };

  const fetchFinishes = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/finishes');
      setFinishes(response.items || []);
    } catch (error) {
      console.error('Failed to fetch finishes:', error);
      setFinishes([]);
    }
  };

  const fetchUpholsteries = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/upholsteries');
      setUpholsteries(response.items || []);
    } catch (error) {
      console.error('Failed to fetch upholsteries:', error);
      setUpholsteries([]);
    }
  };

  const fetchLaminates = async () => {
    try {
      const response = await apiClient.get('/api/v1/content/laminates');
      setLaminates(Array.isArray(response) ? response : (response.items || []));
    } catch {
      setLaminates([]);
    }
  };

  const fetchColors = async () => {
    try {
      // Fetch all active colors - no category filter to show all available colors
      // Users can select any color regardless of category
      const response = await apiClient.get('/api/v1/admin/colors?is_active=true');
      setColors(response.items || response || []);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
      setColors([]);
    }
  };

  // The primary category always stays part of the assigned set
  const handlePrimaryCategoryChange = (categoryId) => {
    setFormData((prev) => {
      const categoryIds = (prev.category_ids || []).filter((id) => id !== categoryId);
      return {
        ...prev,
        category_id: categoryId,
        category_ids: categoryId ? [categoryId, ...categoryIds] : categoryIds,
      };
    });
  };

  const handlePrimarySubcategoryChange = (subcategoryId) => {
    setFormData((prev) => {
      const subcategoryIds = (prev.subcategory_ids || []).filter((id) => id !== subcategoryId);
      return {
        ...prev,
        subcategory_id: subcategoryId,
        subcategory_ids: subcategoryId ? [subcategoryId, ...subcategoryIds] : subcategoryIds,
      };
    });
  };

  const toggleCategory = (categoryId) => {
    setFormData((prev) => {
      if (categoryId === prev.category_id) return prev;
      const current = prev.category_ids || [];
      return {
        ...prev,
        category_ids: current.includes(categoryId)
          ? current.filter((id) => id !== categoryId)
          : [...current, categoryId],
      };
    });
  };

  const toggleSubcategory = (subcategoryId) => {
    setFormData((prev) => {
      if (subcategoryId === prev.subcategory_id) return prev;
      const current = prev.subcategory_ids || [];
      return {
        ...prev,
        subcategory_ids: current.includes(subcategoryId)
          ? current.filter((id) => id !== subcategoryId)
          : [...current, subcategoryId],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const hoverImages = (formData.hover_images || []).filter((u) => u && String(u).trim());
      const dedupe = (ids) => ids.filter((id, index, all) => id && all.indexOf(id) === index);
      const saveData = {
        ...formData,
        // The primary assignment leads the list the backend stores
        category_ids: dedupe([formData.category_id, ...(formData.category_ids || [])]),
        subcategory_ids: dedupe([formData.subcategory_id, ...(formData.subcategory_ids || [])]),
        hover_images: hoverImages,
        images,
        variations,
        available_finishes: selectedFinishes,
        available_upholsteries: selectedUpholsteries,
        available_colors: selectedColors,
        available_laminates: selectedLaminates,
        flame_certifications: flameCerts,
        green_certifications: greenCerts,
      };

      if (product?._isNew) {
        await apiClient.post('/api/v1/admin/products', saveData);
      } else {
        await apiClient.patch(`/api/v1/admin/products/${product.id}`, saveData);
      }
      toast.success('Product saved successfully!');
      onBack();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'name') next.slug = slugify(value);
      return next;
    });
  };

  const handleArrayChange = (field, value) => {
    const arr = value.split(',').map(v => v.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, [field]: arr }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: FileText },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'dimensions', label: 'Dimensions', icon: Ruler },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'materials', label: 'Materials', icon: Wrench },
    { id: 'features', label: 'Features', icon: Package },
    { id: 'variations', label: 'Variations', icon: RefreshCw },
    { id: 'certifications', label: 'Certifications', icon: Award },
    { id: 'seo', label: 'SEO & Analytics', icon: TrendingUp },
    // Saved products only: there's no traffic to show for a new one
    ...(product?.id ? [{ id: 'activity', label: 'Site Activity', icon: BarChart3 }] : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'activity':
        return <ProductAnalyticsPanel productId={product?.id} />;
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Alpine Dining Chair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Model Number *
                </label>
                <input
                  type="text"
                  value={formData.model_number}
                  onChange={(e) => handleChange('model_number', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., 6246"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Model Suffix
                </label>
                <input
                  type="text"
                  value={formData.model_suffix || ''}
                  onChange={(e) => handleChange('model_suffix', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., WB.P, P, W"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="alpine-dining-chair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Primary Category *
                </label>
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => handlePrimaryCategoryChange(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parent_id ? `— ${cat.name}` : cat.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-dark-400">
                  Used for the product URL and breadcrumbs.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Primary Subcategory
                </label>
                <select
                  value={formData.subcategory_id || ''}
                  onChange={(e) => handlePrimarySubcategoryChange(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  disabled={subcategories.length === 0}
                >
                  <option value="">Select Subcategory</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Categories
                </label>
                <p className="mb-2 text-xs text-dark-400">
                  A product can be listed under several categories. The primary category is always included.
                </p>
                <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 p-3 bg-dark-700 border border-dark-600 rounded-lg">
                  {categories.length === 0 && (
                    <span className="text-sm text-dark-400">No categories available</span>
                  )}
                  {categories.map(cat => {
                    const isPrimary = cat.id === formData.category_id;
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                          isPrimary ? 'text-dark-300' : 'text-dark-100 hover:bg-dark-600 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isPrimary || (formData.category_ids || []).includes(cat.id)}
                          disabled={isPrimary}
                          onChange={() => toggleCategory(cat.id)}
                          className="rounded border-dark-500 bg-dark-800 text-primary-500 focus:ring-primary-500"
                        />
                        <span>{cat.parent_id ? `— ${cat.name}` : cat.name}</span>
                        {isPrimary && <span className="text-xs text-primary-400">primary</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Subcategories
                </label>
                <p className="mb-2 text-xs text-dark-400">
                  Subcategories of the selected categories. The primary subcategory is always included.
                </p>
                <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 p-3 bg-dark-700 border border-dark-600 rounded-lg">
                  {subcategories.length === 0 && (
                    <span className="text-sm text-dark-400">
                      No subcategories for the selected categories
                    </span>
                  )}
                  {subcategories.map(sub => {
                    const isPrimary = sub.id === formData.subcategory_id;
                    return (
                      <label
                        key={sub.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                          isPrimary ? 'text-dark-300' : 'text-dark-100 hover:bg-dark-600 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isPrimary || (formData.subcategory_ids || []).includes(sub.id)}
                          disabled={isPrimary}
                          onChange={() => toggleSubcategory(sub.id)}
                          className="rounded border-dark-500 bg-dark-800 text-primary-500 focus:ring-primary-500"
                        />
                        <span>{sub.name}</span>
                        {isPrimary && <span className="text-xs text-primary-400">primary</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Product Family
                </label>
                <select
                  value={formData.family_id || ''}
                  onChange={(e) => handleChange('family_id', parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="">No Family</option>
                  {families.map(family => (
                    <option key={family.id} value={family.id}>{family.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Also show in these families
                </label>
                <p className="text-sm text-dark-400 mb-2">
                  Product will appear in these family pages in addition to its main family above.
                </p>
                <div className="flex flex-wrap gap-3 max-h-40 overflow-y-auto p-3 bg-dark-700 border border-dark-600 rounded-lg">
                  {families
                    .filter(f => f.id !== formData.family_id)
                    .map(family => (
                      <label key={family.id} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(formData.secondary_family_ids || []).includes(family.id)}
                          onChange={(e) => {
                            const current = formData.secondary_family_ids || [];
                            const next = e.target.checked
                              ? [...current, family.id]
                              : current.filter(id => id !== family.id);
                            handleChange('secondary_family_ids', next);
                          }}
                          className="rounded border-dark-500 bg-dark-600 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm text-dark-100">{family.name}</span>
                      </label>
                    ))}
                  {families.filter(f => f.id !== formData.family_id).length === 0 && (
                    <span className="text-sm text-dark-400">No other families available.</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Short Description
              </label>
              <textarea
                value={formData.short_description || ''}
                onChange={(e) => handleChange('short_description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Brief product description for catalog listings"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Full Description
              </label>
              <textarea
                value={formData.full_description || ''}
                onChange={(e) => handleChange('full_description', e.target.value)}
                rows={8}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Detailed product description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Keywords / Tags
              </label>
              <p className="text-sm text-dark-400 mb-2">
                Add keywords to improve search and related product matching (e.g. fancy, dance club, outdoor).
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.keywords || []).map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-dark-600 text-dark-100 text-sm"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => {
                        const next = (formData.keywords || []).filter((_, j) => j !== i);
                        handleChange('keywords', next);
                      }}
                      className="p-0.5 rounded hover:bg-dark-500 text-dark-300 hover:text-dark-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const parts = keywordInput.split(',').map(s => s.trim()).filter(Boolean);
                      if (parts.length > 0) {
                        const existing = formData.keywords || [];
                        const next = [...new Set([...existing, ...parts])];
                        handleChange('keywords', next);
                        setKeywordInput('');
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="Add keyword (comma-separated) and press Enter"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const parts = keywordInput.split(',').map(s => s.trim()).filter(Boolean);
                    if (parts.length > 0) {
                      const existing = formData.keywords || [];
                      const next = [...new Set([...existing, ...parts])];
                      handleChange('keywords', next);
                      setKeywordInput('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Base Price (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(formData.base_price || 0) / 100}
                    onChange={(e) => handleChange('base_price', Math.round(parseFloat(e.target.value) * 100))}
                    className="w-full pl-8 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  MSRP (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(formData.msrp || 0) / 100}
                    onChange={(e) => handleChange('msrp', Math.round(parseFloat(e.target.value) * 100))}
                    className="w-full pl-8 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <Card className="bg-dark-800 border-dark-600">
              <h4 className="font-medium text-dark-50 mb-2">Pricing Notes</h4>
              <p className="text-sm text-dark-300">
                Base price is the standard price before customizations. MSRP is optional for reference.
                Prices are stored in cents to avoid floating point issues.
              </p>
            </Card>
          </div>
        );

      case 'dimensions':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-dark-50">Product Dimensions (inches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.width || ''}
                  onChange={(e) => handleChange('width', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Depth</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.depth || ''}
                  onChange={(e) => handleChange('depth', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.height || ''}
                  onChange={(e) => handleChange('height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-dark-50 pt-4">Seat Dimensions (inches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Seat Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.seat_width || ''}
                  onChange={(e) => handleChange('seat_width', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Seat Depth</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.seat_depth || ''}
                  onChange={(e) => handleChange('seat_depth', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Seat Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.seat_height || ''}
                  onChange={(e) => handleChange('seat_height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-dark-50 pt-4">Additional Dimensions (inches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Arm Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.arm_height || ''}
                  onChange={(e) => handleChange('arm_height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Back Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.back_height || ''}
                  onChange={(e) => handleChange('back_height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-dark-50 pt-4">Weight</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight || ''}
                  onChange={(e) => handleChange('weight', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Shipping Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.shipping_weight || ''}
                  onChange={(e) => handleChange('shipping_weight', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>
        );

      case 'images':
        return (
          <div className="space-y-6">
            {/* Main Product Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4">Key Product Images</h3>
              <p className="text-sm text-dark-400 mb-4">These images are used in product catalog views and cards</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Primary Image */}
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Primary Image *
                    <span className="block text-xs text-dark-400 font-normal">Main catalog image</span>
                  </label>
                  <div className="relative">
                    {formData.primary_image_url ? (
                      <div className="relative group">
                        <ResponsiveImage
                          sizes="(min-width: 768px) 33vw, 100vw"
                          fullResolution={false}
                          src={resolveImageUrl(formData.primary_image_url)}
                          alt="Primary"
                          className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-primary-500"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            handleChange('primary_image_url', null);
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                        <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                        <p className="text-sm text-dark-400 mb-2">Click to upload</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const url = await uploadProductImage(file);
                                handleChange('primary_image_url', url);
                              } catch (error) {
                                console.error('Upload failed:', error);
                                alert('Failed to upload image');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover Images: card rollover, shown in this order after the primary */}
                {[...(formData.hover_images || []).filter(Boolean), null].map((url, index) => (
                  <div key={url || `add-hover-${index}`}>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      {url ? `Hover Image ${index + 1}` : 'Add Hover Image'}
                      <span className="block text-xs text-dark-400 font-normal">
                        {url ? 'Card rollover, in this order' : 'Product angles only, not gallery photos'}
                      </span>
                    </label>
                    {url ? (
                      <div className="relative group">
                        <ResponsiveImage
                          sizes="(min-width: 768px) 33vw, 100vw"
                          fullResolution={false}
                          src={resolveImageUrl(url)}
                          alt={`Hover ${index + 1}`}
                          className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                          {index > 0 && (
                            <button
                              type="button"
                              title="Move earlier"
                              onClick={() => setFormData(prev => {
                                const next = (prev.hover_images || []).filter(Boolean);
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return { ...prev, hover_images: next };
                              })}
                              className="px-2 py-1 bg-dark-900/80 text-dark-100 rounded-lg text-sm"
                            >
                              &larr;
                            </button>
                          )}
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              hover_images: (prev.hover_images || []).filter((u) => u && u !== url),
                            }))}
                            className="p-2 bg-red-500 text-white rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative h-48 flex flex-col items-center justify-center">
                        <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                        <p className="text-sm text-dark-400">{uploadingImage ? 'Uploading...' : 'Upload hover image'}</p>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingImage}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingImage(true);
                            try {
                              const uploaded = await uploadProductImage(file);
                              setFormData(prev => ({
                                ...prev,
                                hover_images: [...(prev.hover_images || []).filter(Boolean), uploaded],
                              }));
                            } catch (error) {
                              console.error('Upload failed:', error);
                              alert('Failed to upload image');
                            } finally {
                              setUploadingImage(false);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Thumbnail */}
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Thumbnail
                    <span className="block text-xs text-dark-400 font-normal">Small preview image</span>
                  </label>
                  <div className="relative">
                    {formData.thumbnail ? (
                      <div className="relative group">
                        <ResponsiveImage
                          sizes="(min-width: 768px) 33vw, 100vw"
                          fullResolution={false}
                          src={resolveImageUrl(formData.thumbnail)}
                          alt="Thumbnail"
                          className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            handleChange('thumbnail', null);
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                        <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                        <p className="text-sm text-dark-400 mb-2">Click to upload</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const url = await uploadProductImage(file);
                                handleChange('thumbnail', url);
                              } catch (error) {
                                console.error('Upload failed:', error);
                                alert('Failed to upload image');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4">Gallery Images</h3>
              <p className="text-sm text-dark-400 mb-4">Shown in the Gallery section of the product page (below description and features). Never used for hover.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                {images.map((img, index) => (
                  <div key={(typeof img === 'string' ? img : img.url) || index} className="relative group">
                    <ResponsiveImage
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                      fullResolution={false}
                      src={resolveImageUrl(typeof img === 'string' ? img : img.url)}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setImages(images.filter((_, i) => i !== index));
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-dark-900/80 text-dark-200 text-xs rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                <Upload className="w-10 h-10 text-dark-400 mx-auto mb-3" />
                <p className="text-dark-200 mb-2">Add Gallery Images</p>
                <p className="text-sm text-dark-400 mb-4">
                  {uploadingImage ? 'Uploading...' : 'Click or drag & drop images'}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;

                    setUploadingImage(true);
                    try {
                      const uploadPromises = files.map(file => uploadProductImage(file));
                      const urls = await Promise.all(uploadPromises);
                      setImages([...images, ...urls]);
                    } catch (error) {
                      console.error('Upload failed:', error);
                      alert('Failed to upload one or more images');
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingImage}
                />
              </div>
            </div>

            {/* Variation Images */}
            {variations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-dark-50 mb-4">Variation Images</h3>
                <p className="text-sm text-dark-400 mb-4">Specific images for each product variation</p>

                {variations.map((variation, index) => (
                  <div key={index} className="bg-dark-800 rounded-lg p-4 mb-4">
                    <h4 className="text-md font-medium text-dark-100 mb-3">
                      Variation: {variation.sku || `Variation ${index + 1}`}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Variation Primary Image */}
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-2">
                          Primary Image
                        </label>
                        <div className="relative">
                          {variation.primary_image_url ? (
                            <div className="relative group">
                              <ResponsiveImage
                                sizes="(min-width: 768px) 50vw, 100vw"
                                fullResolution={false}
                                src={resolveImageUrl(variation.primary_image_url)}
                                alt={`Variation ${index + 1} Primary`}
                                className="w-full h-40 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const newVariations = [...variations];
                                  newVariations[index].primary_image_url = null;
                                  setVariations(newVariations);
                                }}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-dark-600 rounded-lg p-3 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                              <Upload className="w-6 h-6 text-dark-400 mx-auto mb-2" />
                              <p className="text-xs text-dark-400">Click to upload</p>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await uploadProductImage(file);
                                      const newVariations = [...variations];
                                      newVariations[index].primary_image_url = url;
                                      setVariations(newVariations);
                                    } catch (error) {
                                      console.error('Upload failed:', error);
                                      alert('Failed to upload image');
                                    }
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Variation Gallery Images */}
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-2">
                          Gallery Images ({(variation.images || []).length})
                        </label>
                        <div className="space-y-2">
                          {Array.isArray(variation.images) && variation.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {variation.images.map((img, imgIndex) => (
                                <div key={imgIndex} className="relative group">
                                  <ResponsiveImage
                                    sizes="(min-width: 768px) 17vw, 33vw"
                                    fullResolution={false}
                                    src={resolveImageUrl(typeof img === 'string' ? img : img.url)}
                                    alt={`Variation ${index + 1} Image ${imgIndex + 1}`}
                                    className="w-full h-20 object-contain bg-dark-700 rounded border border-dark-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const newVariations = [...variations];
                                      newVariations[index].images = newVariations[index].images.filter((_, i) => i !== imgIndex);
                                      setVariations(newVariations);
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="border-2 border-dashed border-dark-600 rounded-lg p-2 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                            <Upload className="w-5 h-5 text-dark-400 mx-auto mb-1" />
                            <p className="text-xs text-dark-400 mb-1">Upload images</p>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;

                                try {
                                  const uploadPromises = files.map(file => uploadProductImage(file));
                                  const urls = await Promise.all(uploadPromises);
                                  const newVariations = [...variations];
                                  newVariations[index].images = [...(newVariations[index].images || []), ...urls];
                                  setVariations(newVariations);
                                } catch (error) {
                                  console.error('Upload failed:', error);
                                  alert('Failed to upload images');
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'variations':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-50">Product Variations</h3>
              <Button
                onClick={() => setVariations([...variations, {
                  sku: '',
                  name: '',
                  finish_id: null,
                  upholstery_id: null,
                  color_id: null,
                  price_adjustment: 0,
                  stock_status: 'Made to Order',
                  is_available: true,
                  family_ids: [],
                  width: null,
                  depth: null,
                  height: null,
                  seat_width: null,
                  seat_depth: null,
                  seat_height: null,
                  arm_height: null,
                  back_height: null,
                  weight: null,
                  shipping_weight: null,
                  upholstery_amount: null,
                  upholstery_enabled: null,
                  colors_enabled: null,
                  laminates_enabled: null
                }])}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Variation
              </Button>
            </div>

            <p className="text-sm text-dark-300">
              Variations represent specific combinations of finish, upholstery, and color options for this product.
            </p>

            {variations.length === 0 ? (
              <div className="text-center py-12 bg-dark-700 rounded-lg border-2 border-dashed border-dark-600">
                <RefreshCw className="w-12 h-12 text-dark-400 mx-auto mb-4" />
                <p className="text-dark-300">No variations added</p>
                <p className="text-sm text-dark-400 mt-2">
                  Add variations for different finish, upholstery, or color combinations
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="inline-flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                  <SelectAllCheckbox selection={variationSelection} label="Select all variations" />
                  Select all to batch edit (shift-click selects a range)
                </label>
                {variations.map((variation, index) => (
                  <Card
                    key={index}
                    className={`p-4 ${variationSelection.isSelected(variationKey(variation, index)) ? 'ring-1 ring-primary-500' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        <RowCheckbox
                          selection={variationSelection}
                          id={variationKey(variation, index)}
                          orderedIds={variationOrder}
                          label={`Select variation ${variation.sku || index + 1}`}
                        />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-dark-200 mb-2">
                            Variation Name <span className="text-dark-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={variation.name || ''}
                            onChange={(e) => {
                              const newVariations = [...variations];
                              newVariations[index].name = e.target.value;
                              setVariations(newVariations);
                            }}
                            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            placeholder="e.g. Walnut Frame / Black Vinyl"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              SKU *
                            </label>
                            <input
                              type="text"
                              value={variation.sku || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].sku = e.target.value;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                              placeholder="6246-WB-BLK"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Stock Status
                            </label>
                            <select
                              value={formatStockStatus(variation.stock_status) || 'Made to Order'}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].stock_status = e.target.value;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="Made to Order">Made to Order</option>
                              <option value="Available">Available</option>
                              <option value="Low Stock">Low Stock</option>
                              <option value="Out of Stock">Out of Stock</option>
                              <option value="Discontinued">Discontinued</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-dark-200 mb-2">
                            Show this variation in families
                          </label>
                          <p className="text-sm text-dark-400 mb-2">
                            When this family is viewed, this variation&apos;s image and info are shown. Link opens product with this variation selected.
                          </p>
                          <div className="flex flex-wrap gap-3 max-h-32 overflow-y-auto p-3 bg-dark-700 border border-dark-600 rounded-lg">
                            {families.map(f => (
                              <label key={f.id} className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(variation.family_ids || []).includes(f.id)}
                                  onChange={(e) => {
                                    const newVariations = [...variations];
                                    const current = newVariations[index].family_ids || [];
                                    const next = e.target.checked
                                      ? [...current, f.id]
                                      : current.filter(id => id !== f.id);
                                    newVariations[index].family_ids = next;
                                    setVariations(newVariations);
                                  }}
                                  className="rounded border-dark-500 bg-dark-600 text-primary-500 focus:ring-primary-500"
                                />
                                <span className="text-sm text-dark-100">{f.name}</span>
                              </label>
                            ))}
                            {families.length === 0 && (
                              <span className="text-sm text-dark-400">No families. Add families in Family Management.</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Finish
                            </label>
                            <select
                              value={variation.finish_id || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].finish_id = parseInt(e.target.value) || null;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="">No Finish</option>
                              {finishes.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Upholstery
                            </label>
                            <select
                              value={variation.upholstery_id || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].upholstery_id = parseInt(e.target.value) || null;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="">No Upholstery</option>
                              {upholsteries.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Color
                            </label>
                            <select
                              value={variation.color_id || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].color_id = parseInt(e.target.value) || null;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="">No Color</option>
                              {colors.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Price Adjustment (USD)
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={(variation.price_adjustment || 0) / 100}
                                onChange={(e) => {
                                  const newVariations = [...variations];
                                  newVariations[index].price_adjustment = Math.round(parseFloat(e.target.value) * 100) || 0;
                                  setVariations(newVariations);
                                }}
                                className="w-full pl-8 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer pb-2">
                              <input
                                type="checkbox"
                                checked={variation.is_available !== false}
                                onChange={(e) => {
                                  const newVariations = [...variations];
                                  newVariations[index].is_available = e.target.checked;
                                  setVariations(newVariations);
                                }}
                                className="rounded border-dark-500"
                              />
                              <span className="text-dark-200">Available for Sale</span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-dark-600">
                          <p className="text-sm font-medium text-dark-200 mb-3">Option groups for this variation</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {OPTION_GROUP_SWITCHES.map(({ field, label }) => (
                              <div key={field}>
                                <label className="block text-xs text-dark-400 mb-1">{label}</label>
                                <select
                                  value={variation[field] === true ? 'on' : variation[field] === false ? 'off' : ''}
                                  onChange={(e) => {
                                    const newVariations = [...variations];
                                    newVariations[index] = {
                                      ...newVariations[index],
                                      [field]: e.target.value === '' ? null : e.target.value === 'on',
                                    };
                                    setVariations(newVariations);
                                  }}
                                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 text-sm"
                                >
                                  <option value="">Same as product ({formData[field] !== false ? 'on' : 'off'})</option>
                                  <option value="on">On</option>
                                  <option value="off">Off</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-dark-600">
                          <p className="text-sm font-medium text-dark-200 mb-3">Weight & dimensions override (optional)</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {[
                              { key: 'width', label: 'W (in)' },
                              { key: 'depth', label: 'D (in)' },
                              { key: 'height', label: 'H (in)' },
                              { key: 'seat_width', label: 'Seat W' },
                              { key: 'seat_depth', label: 'Seat D' },
                              { key: 'seat_height', label: 'Seat H' },
                              { key: 'arm_height', label: 'Arm H' },
                              { key: 'back_height', label: 'Back H' },
                              { key: 'weight', label: 'Weight (lbs)' },
                              { key: 'shipping_weight', label: 'Ship weight (lbs)' },
                              { key: 'upholstery_amount', label: 'Uph. (yd)' }
                            ].map(({ key, label }) => (
                              <div key={key}>
                                <label className="block text-xs text-dark-400 mb-1">{label}</label>
                                <input
                                  type="number"
                                  step={key.includes('upholstery') ? '0.1' : '0.01'}
                                  min="0"
                                  value={variation[key] ?? ''}
                                  onChange={(e) => {
                                    const newVariations = [...variations];
                                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                    newVariations[index][key] = Number.isFinite(val) ? val : null;
                                    setVariations(newVariations);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm bg-dark-700 border border-dark-600 rounded text-dark-50"
                                  placeholder="—"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setVariations(variations.filter((_, i) => i !== index));
                          // New variations key by position, so a removal shifts them
                          variationSelection.clear();
                        }}
                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors mt-6"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </Card>
                ))}
                <VariationBulkBar
                  selection={variationSelection}
                  finishes={finishes}
                  upholsteries={upholsteries}
                  colors={colors}
                  families={families}
                  onPatch={patchSelectedVariations}
                  onRemove={removeSelectedVariations}
                />
              </div>
            )}
          </div>
        );

      case 'materials':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">Materials & Construction</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Frame Material
                </label>
                <input
                  type="text"
                  value={formData.frame_material || ''}
                  onChange={(e) => handleChange('frame_material', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Solid Wood, Metal, Aluminum"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Construction Details
              </label>
              <textarea
                value={formData.construction_details || ''}
                onChange={(e) => handleChange('construction_details', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Describe construction methods, joinery, reinforcements, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Available Finishes
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {finishes.map(finish => (
                  <label key={finish.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedFinishes.includes(finish.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFinishes([...selectedFinishes, finish.id]);
                        } else {
                          setSelectedFinishes(selectedFinishes.filter(id => id !== finish.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <span className="text-sm text-dark-200">{finish.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Upholstery Amount (yards)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.upholstery_amount ?? ''}
                  onChange={(e) => handleChange('upholstery_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., 2.5 (leave empty if N/A)"
                />
                <p className="text-xs text-dark-400 mt-1">Yards of upholstery used when this product uses upholstery</p>
              </div>
            </div>

            <div>
              <OptionGroupHeading
                label="Available Upholsteries"
                enabled={formData.upholstery_enabled !== false}
                onChange={(on) => handleChange('upholstery_enabled', on)}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {upholsteries.map(upholstery => (
                  <label key={upholstery.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedUpholsteries.includes(upholstery.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUpholsteries([...selectedUpholsteries, upholstery.id]);
                        } else {
                          setSelectedUpholsteries(selectedUpholsteries.filter(id => id !== upholstery.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <span className="text-sm text-dark-200">{upholstery.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <OptionGroupHeading
                label="Available Laminates (table tops)"
                enabled={formData.laminates_enabled !== false}
                onChange={(on) => handleChange('laminates_enabled', on)}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {laminates.map(laminate => (
                  <label key={laminate.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedLaminates.includes(laminate.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLaminates([...selectedLaminates, laminate.id]);
                        } else {
                          setSelectedLaminates(selectedLaminates.filter(id => id !== laminate.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <span className="text-sm text-dark-100">{laminate.brand} {laminate.pattern_name || laminate.patternName || laminate.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <OptionGroupHeading
                label="Available Colors"
                enabled={formData.colors_enabled !== false}
                onChange={(on) => handleChange('colors_enabled', on)}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {colors.map(color => (
                  <label key={color.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedColors.includes(color.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedColors([...selectedColors, color.id]);
                        } else {
                          setSelectedColors(selectedColors.filter(id => id !== color.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <div className="flex items-center gap-2">
                      {color.hex_value && (
                        <div
                          className="w-4 h-4 rounded border border-dark-500"
                          style={{ backgroundColor: color.hex_value }}
                        />
                      )}
                      <span className="text-sm text-dark-200">{color.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">Features & Inventory</h3>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Features (comma-separated)
              </label>
              <input
                type="text"
                value={formData.features?.join(', ') || ''}
                onChange={(e) => handleArrayChange('features', e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="e.g., Stackable, Ganging, Swivel, Arms"
              />
              <p className="text-xs text-dark-400 mt-1">Separate multiple features with commas</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Stock Status
                </label>
                <select
                  value={formData.stock_status}
                  onChange={(e) => handleChange('stock_status', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="Made to Order">Made to Order</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Pre-Order">Pre-Order</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  value={formData.lead_time_days || ''}
                  onChange={(e) => handleChange('lead_time_days', parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Minimum Order Quantity
                </label>
                <input
                  type="number"
                  value={formData.minimum_order_quantity}
                  onChange={(e) => handleChange('minimum_order_quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        );

      case 'certifications':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">Certifications & Usage</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Flame Certifications (comma-separated)
                </label>
                <input
                  type="text"
                  value={flameCerts.join(', ')}
                  onChange={(e) => {
                    const certs = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                    setFlameCerts(certs);
                  }}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., CAL 117, UFAC Class 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Green Certifications (comma-separated)
                </label>
                <input
                  type="text"
                  value={greenCerts.join(', ')}
                  onChange={(e) => {
                    const certs = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                    setGreenCerts(certs);
                  }}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., FSC, GREENGUARD"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Recommended Use
                </label>
                <input
                  type="text"
                  value={formData.recommended_use || ''}
                  onChange={(e) => handleChange('recommended_use', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Restaurant, Healthcare, Office"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ada_compliant}
                    onChange={(e) => handleChange('ada_compliant', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">ADA Compliant</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_outdoor_suitable}
                    onChange={(e) => handleChange('is_outdoor_suitable', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Outdoor Suitable</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Warranty Information
              </label>
              <textarea
                value={formData.warranty_info || ''}
                onChange={(e) => handleChange('warranty_info', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Warranty details..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Care Instructions
              </label>
              <textarea
                value={formData.care_instructions || ''}
                onChange={(e) => handleChange('care_instructions', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Care and maintenance instructions..."
              />
            </div>
          </div>
        );

      case 'seo':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">SEO & Analytics</h3>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.meta_title || ''}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="SEO optimized title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Meta Description
              </label>
              <textarea
                value={formData.meta_description || ''}
                onChange={(e) => handleChange('meta_description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="SEO optimized description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-md font-medium text-dark-100">Product Flags</h4>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Active (visible on site)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => handleChange('is_featured', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Featured Product</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_new}
                    onChange={(e) => handleChange('is_new', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">New Product</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_custom_only}
                    onChange={(e) => handleChange('is_custom_only', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Custom Only (requires quote)</span>
                </label>
              </div>

              <div className="space-y-4">
                <h4 className="text-md font-medium text-dark-100">Analytics</h4>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    View Count
                  </label>
                  <input
                    type="number"
                    value={formData.view_count || 0}
                    disabled
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-400 outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Quote Count
                  </label>
                  <input
                    type="number"
                    value={formData.quote_count || 0}
                    disabled
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-400 outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order || 0}
                    onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Products"
        title={product?._isNew ? 'New Product' : (product?.name || 'Edit product')}
        description={product?._isNew ? 'Create a new product' : 'Edit product details, pricing, images and variations'}
        onBack={onBack}
        backDisabled={saving || uploadingImage}
        backLabel="Back to Product Catalog"
        actions={
          <>
            <Button variant="outline" onClick={onBack} disabled={saving || uploadingImage}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingImage}>
              {uploadingImage ? 'Uploading...' : saving ? 'Saving...' : 'Save Product'}
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <Card className="bg-dark-800">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-3 font-medium transition-all whitespace-nowrap flex items-center gap-2
                  ${activeTab === tab.id
                    ? 'bg-primary-900 border border-primary-500 text-primary-500 rounded-lg'
                    : 'text-dark-300 hover:text-dark-50 hover:bg-dark-700 rounded-lg'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Tab Content */}
      <Card>
        {renderTabContent()}
      </Card>
    </AdminPage>
  );
};

export default ProductEditor;
