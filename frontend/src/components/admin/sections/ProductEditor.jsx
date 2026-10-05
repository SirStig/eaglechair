import { useState, useEffect, useMemo } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { useToast } from '../../../contexts/ToastContext';
import apiClient from '../../../config/apiClient';
import { formatStockStatus } from '../../../utils/apiHelpers';
import { slugify } from '../../../utils/slugify';
import {
  FileText,
  DollarSign,
  Ruler,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  Search,
  X,
  Plus,
  Trash2,
  Wrench,
  Award,
  TrendingUp,
  Package,
  BarChart3,
} from 'lucide-react';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import ImagePickerField from '../media/ImagePickerField';
import ImageListField from '../media/ImageListField';
import FamilyPicker from './FamilyPicker';
import RecordHistoryLink from '../RecordHistoryLink';
import ProductAnalyticsPanel from '../ProductAnalyticsPanel';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import FloatingDock from '../bulk/FloatingDock';
import FitLabel from '../bulk/FitLabel';
import ProductVariationsTab from './ProductVariationsTab';
import { groupSupplierLinks } from './supplierLinkTypes';
import {
  OPTION_GROUP_SWITCHES,
  STOCK_STATUS_OPTIONS,
  useVariationRows,
  variationAnchor,
  variationKey,
} from './productVariations';

// Gallery entries may be plain URLs or objects like { url, ... }.
const imageUrlOf = (img) => (typeof img === 'string' ? img : img?.url);

// Rebuild a gallery from the picker's URL list, keeping any existing object
// entries intact so their extra fields survive a reorder or removal.
const mergeImageList = (items, urls) =>
  urls.map((url) => (items || []).find((img) => imageUrlOf(img) === url) ?? url);

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

const rowKey = (row) => row.key;
// Variations open by default when there are only a few
const OPEN_ALL_UP_TO = 3;
let newVariationSeq = 0;

const DOCK_BUTTON =
  'flex h-11 w-[6.5rem] sm:w-36 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-center font-medium transition-colors disabled:opacity-60';

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
    material_sources: Array.isArray(product?.material_sources) ? product.material_sources : [],
  });
  const [saving, setSaving] = useState(false);

  // Dropdowns data
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);

  // "Parent › Child" category names, shown next to each family in the pickers
  const categoryNames = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return Object.fromEntries(categories.map((c) => {
      const parent = c.parent_id ? byId.get(c.parent_id) : null;
      return [c.id, parent ? `${parent.name} › ${c.name}` : c.name];
    }));
  }, [categories]);

  // Multi-value fields
  const [images, setImages] = useState(() => {
    const notGallery = new Set([product?.primary_image_url, ...(product?.hover_images || [])].filter(Boolean));
    return (Array.isArray(product?.images) ? product.images : [])
      .filter((img) => !notGallery.has(typeof img === 'string' ? img : img?.url));
  });
  const [variations, setVariations] = useState(Array.isArray(product?.variations) ? product.variations : []);
  const [selectedFinishes, setSelectedFinishes] = useState(product?.available_finishes || []);
  const [selectedUpholsteries, setSelectedUpholsteries] = useState(product?.available_upholsteries || []);
  const [selectedColors, setSelectedColors] = useState(product?.available_colors || []);
  const [selectedLaminates, setSelectedLaminates] = useState(product?.available_laminates || []);
  const [laminates, setLaminates] = useState([]);
  // Outside supplier catalogs (Supplier Links) this product can be ordered with
  const [supplierLinks, setSupplierLinks] = useState([]);
  const [flameCerts, setFlameCerts] = useState(product?.flame_certifications || []);
  const [greenCerts, setGreenCerts] = useState(product?.green_certifications || []);

  const [keywordInput, setKeywordInput] = useState('');


  useEffect(() => {
    fetchCategories();
    fetchFamilies();
    fetchFinishes();
    fetchUpholsteries();
    fetchColors();
    fetchLaminates();
    fetchSupplierLinks();
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

  const fetchSupplierLinks = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/material-sources');
      setSupplierLinks((response || []).filter((s) => s.is_active));
    } catch {
      setSupplierLinks([]);
    }
  };

  const toggleSupplierLink = (id, on) =>
    setFormData((prev) => {
      const current = prev.material_sources || [];
      return { ...prev, material_sources: on ? [...new Set([...current, id])] : current.filter((x) => x !== id) };
    });

  // "Also orderable from Wilsonart" note under a swatch list, so an empty list reads as intended
  const supplierHint = (type) => {
    const names = supplierLinks
      .filter((s) => s.material_type === type && (formData.material_sources || []).includes(s.id))
      .map((s) => s.name);
    if (!names.length) return null;
    return (
      <p className="mb-2 text-xs text-primary-300">
        Supplier links: {names.join(', ')}. Customers can order any pattern from them, so this list can stay empty.
      </p>
    );
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

  // ---- Variations: filter, open cards, selection and batch edits ----
  const [variationFilter, setVariationFilter] = useState('');
  const [expandedVariations, setExpandedVariations] = useState(() =>
    variations.length <= OPEN_ALL_UP_TO ? new Set(variations.map(variationKey)) : new Set()
  );
  const [scrollToVariation, setScrollToVariation] = useState(null);
  const { rows: variationRows, names: variationNames } = useVariationRows(variations, variationFilter, {
    finishes,
    upholsteries,
    colors,
  });
  const variationSelection = useBulkSelection(variationRows, rowKey);

  useEffect(() => {
    if (scrollToVariation == null) return;
    document.getElementById(variationAnchor(scrollToVariation))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollToVariation(null);
  }, [scrollToVariation, variations, expandedVariations]);

  const toggleVariation = (key) =>
    setExpandedVariations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const jumpToVariation = (key) => {
    setExpandedVariations((prev) => new Set(prev).add(key));
    setScrollToVariation(key);
  };
  const updateVariation = (index, patch) =>
    setVariations((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  // patchFor(variation) returns the fields to change on each variation in keys
  const patchVariations = (keys, patchFor) => {
    const picked = new Set(keys);
    setVariations((prev) => prev.map((v, i) => (picked.has(variationKey(v, i)) ? { ...v, ...patchFor(v) } : v)));
  };
  const removeVariations = (keys) => {
    const picked = new Set(keys);
    setVariations((prev) => prev.filter((v, i) => !picked.has(variationKey(v, i))));
  };
  const removeVariation = (key) => {
    const variation = variations.find((v, i) => variationKey(v, i) === key);
    if (variation?.sku && !confirm(`Remove variation ${variation.sku}? This takes effect when you save the product.`)) return;
    removeVariations([key]);
  };
  const addVariation = () => {
    newVariationSeq += 1;
    const key = `new-${Date.now()}-${newVariationSeq}`;
    setVariations((prev) => [
      ...prev,
      {
        _key: key,
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
        laminates_enabled: null,
      },
    ]);
    setVariationFilter('');
    jumpToVariation(key);
  };

  const variationBulkActions = useMemo(() => {
    const patch = (patchFor) => async (keys, value) => patchVariations(keys, (v) => patchFor(value, v));
    const idOptions = (list, none) => [
      { value: 'none', label: none },
      ...list.map((r) => ({ value: String(r.id), label: r.name })),
    ];
    const toId = (v) => (v === 'none' ? null : Number(v));
    const groupOptions = [
      { value: 'inherit', label: 'Same as product' },
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ];
    const familyOptions = families.map((f) => ({ value: String(f.id), label: f.name }));
    return [
      { label: 'Finish', options: idOptions(finishes, 'No finish'), run: patch((v) => ({ finish_id: toId(v) })) },
      { label: 'Upholstery', options: idOptions(upholsteries, 'No upholstery'), run: patch((v) => ({ upholstery_id: toId(v) })) },
      { label: 'Color', options: idOptions(colors, 'No color'), run: patch((v) => ({ color_id: toId(v) })) },
      ...OPTION_GROUP_SWITCHES.map(({ field, label }) => ({
        label: `${label} options`,
        options: groupOptions,
        run: patch((v) => ({ [field]: v === 'inherit' ? null : v === 'on' })),
      })),
      {
        label: 'Available',
        options: [{ value: 'yes', label: 'Available for sale' }, { value: 'no', label: 'Not for sale' }],
        run: patch((v) => ({ is_available: v === 'yes' })),
      },
      {
        label: 'Stock status',
        options: STOCK_STATUS_OPTIONS.map((o) => ({ value: o, label: o })),
        run: patch((v) => ({ stock_status: v })),
      },
      {
        label: 'Price adjustment',
        input: { type: 'number', step: '0.01', placeholder: 'Dollars, e.g. 12.50 or -5' },
        run: patch((v) => ({ price_adjustment: Math.round(parseFloat(v) * 100) || 0 })),
      },
      {
        label: 'Add to family',
        options: familyOptions,
        run: patch((v, variation) => ({ family_ids: [...new Set([...(variation.family_ids || []), Number(v)])] })),
      },
      {
        label: 'Remove from family',
        options: familyOptions,
        run: patch((v, variation) => ({ family_ids: (variation.family_ids || []).filter((id) => id !== Number(v)) })),
      },
      {
        label: 'Open selected',
        run: async (keys) => setExpandedVariations((prev) => new Set([...prev, ...keys])),
      },
      {
        label: 'Remove',
        tone: 'danger',
        run: async (keys) => {
          if (!confirm(`Remove ${keys.length} variation${keys.length === 1 ? '' : 's'}? This takes effect when you save the product.`)) {
            return false;
          }
          removeVariations(keys);
        },
      },
    ];
    // patchVariations / removeVariations only call the stable setVariations
  }, [finishes, upholsteries, colors, families]);

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

              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-dark-200 mb-1">
                  Product Families
                </span>
                <p className="text-sm text-dark-400 mb-2">
                  The primary family is the product&apos;s main family. It also appears on the pages of any other families added here.
                </p>
                <FamilyPicker
                  families={families}
                  primaryId={formData.family_id || null}
                  onPrimaryChange={(id) => handleChange('family_id', id)}
                  selectedIds={(formData.secondary_family_ids || []).filter((id) => id !== formData.family_id)}
                  onSelectedChange={(ids) => handleChange('secondary_family_ids', ids)}
                  categoryNames={categoryNames}
                />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <ImagePickerField
                  label="Primary Image *"
                  help="Main catalog image"
                  value={formData.primary_image_url || ''}
                  onChange={(url) => handleChange('primary_image_url', url || null)}
                  subfolder="products"
                  previewClassName="h-48 w-full"
                  libraryTitle="Choose primary image"
                />
                <ImagePickerField
                  label="Thumbnail"
                  help="Small preview image"
                  value={formData.thumbnail || ''}
                  onChange={(url) => handleChange('thumbnail', url || null)}
                  subfolder="products"
                  previewClassName="h-48 w-full"
                  libraryTitle="Choose thumbnail"
                />
              </div>

              {/* Hover Images: card rollover, shown in this order after the primary */}
              <ImageListField
                label="Hover Images"
                help="Card rollover, shown in this order after the primary. Product angles only, not gallery photos."
                value={(formData.hover_images || []).filter(Boolean)}
                onChange={(urls) => setFormData((prev) => ({ ...prev, hover_images: urls }))}
                subfolder="products"
                tileClassName="h-36 w-36"
                libraryTitle="Add hover images"
              />
            </div>

            {/* Gallery Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4">Gallery Images</h3>
              <p className="text-sm text-dark-400 mb-4">Shown in the Gallery section of the product page (below description and features). Never used for hover.</p>

              <ImageListField
                value={images.map(imageUrlOf)}
                onChange={(urls) => setImages((prev) => mergeImageList(prev, urls))}
                subfolder="products"
                tileClassName="h-36 w-36"
                libraryTitle="Add gallery images"
              />
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
                      <ImagePickerField
                        label="Primary Image"
                        value={variation.primary_image_url || ''}
                        onChange={(url) =>
                          setVariations((prev) =>
                            prev.map((v, i) => (i === index ? { ...v, primary_image_url: url || null } : v))
                          )
                        }
                        subfolder="products"
                        libraryTitle={`Choose image for ${variation.sku || `variation ${index + 1}`}`}
                      />
                      <ImageListField
                        label="Gallery Images"
                        value={(Array.isArray(variation.images) ? variation.images : []).map(imageUrlOf)}
                        onChange={(urls) =>
                          setVariations((prev) =>
                            prev.map((v, i) => (i === index ? { ...v, images: mergeImageList(v.images, urls) } : v))
                          )
                        }
                        subfolder="products"
                        tileClassName="h-20 w-20"
                        libraryTitle={`Add gallery images for ${variation.sku || `variation ${index + 1}`}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'variations':
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-dark-50">Product Variations</h3>
              <p className="mt-1 text-sm text-dark-300">
                Specific combinations of finish, upholstery and color. Click a variation to open it; tick several to batch edit.
              </p>
            </div>
            <ProductVariationsTab
              variations={variations}
              rows={variationRows}
              names={variationNames}
              onChange={updateVariation}
              onRemove={removeVariation}
              selection={variationSelection}
              expanded={expandedVariations}
              onToggle={toggleVariation}
              onJump={jumpToVariation}
              filter={variationFilter}
              onFilterChange={setVariationFilter}
              finishes={finishes}
              upholsteries={upholsteries}
              colors={colors}
              families={families}
              categoryNames={categoryNames}
              productSwitches={formData}
            />
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
              {supplierHint('upholstery')}
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
              {supplierHint('laminate')}
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

            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-dark-200">Order from supplier catalogs</span>
                <a href="/admin/supplier-links" target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:text-primary-300">
                  Manage supplier links
                </a>
              </div>
              <p className="mb-3 text-xs text-dark-400">
                Outside catalogs this product can be ordered with (e.g. any Wilsonart laminate). Ticked links show on the
                product page with their note.
              </p>
              {supplierLinks.length === 0 ? (
                <p className="rounded-lg bg-dark-700 p-4 text-sm text-dark-400">
                  No supplier links yet. Add them under Materials &amp; Options › Supplier Links.
                </p>
              ) : (
                <div className="space-y-3 rounded-lg bg-dark-700 p-4">
                  {groupSupplierLinks(supplierLinks).map((group) => (
                    <div key={group.type}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-dark-400">{group.label}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {group.links.map((link) => (
                          <label key={link.id} className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-dark-600">
                            <input
                              type="checkbox"
                              checked={(formData.material_sources || []).includes(link.id)}
                              onChange={(e) => toggleSupplierLink(link.id, e.target.checked)}
                              className="mt-0.5 rounded border-dark-500"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm text-dark-100">{link.name}</span>
                              {link.description && (
                                <span className="block truncate text-xs text-dark-400" title={link.description}>
                                  {link.description}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
        backDisabled={saving}
        backLabel="Back to Product Catalog"
        actions={
          <>
            {!product?._isNew && <RecordHistoryLink resourceType="products" resourceId={product?.id} />}
            <Button variant="outline" onClick={onBack} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Product'}
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

      {activeTab === 'variations' && variationSelection.count > 0 ? (
        <BulkActionBar
          selection={variationSelection}
          actions={variationBulkActions}
          noun="variation"
          confirm={false}
          quiet
        />
      ) : (
        <FloatingDock label="Product actions" spacer="h-24">
          <div className="flex items-center gap-2 p-2.5">
            {activeTab === 'variations' && (
              <>
                <button
                  type="button"
                  onClick={addVariation}
                  className={`${DOCK_BUTTON} border-primary-500/60 bg-primary-900/30 text-primary-300 hover:bg-primary-900/50`}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <FitLabel text="Add variation" />
                </button>
                {variations.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedVariations((prev) =>
                        prev.size >= variations.length ? new Set() : new Set(variations.map(variationKey))
                      )
                    }
                    className={`${DOCK_BUTTON} border-dark-600 bg-dark-700/60 text-dark-100 hover:bg-dark-700`}
                  >
                    <FitLabel text={expandedVariations.size >= variations.length ? 'Collapse all' : 'Expand all'} />
                  </button>
                )}
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                disabled={saving}
                className={`${DOCK_BUTTON} hidden sm:flex border-dark-600 text-dark-200 hover:bg-dark-700`}
              >
                <FitLabel text="Cancel" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`${DOCK_BUTTON} border-primary-500 bg-primary-600 text-white hover:bg-primary-500`}
              >
                <FitLabel text={saving ? 'Saving…' : 'Save product'} />
              </button>
            </div>
          </div>
        </FloatingDock>
      )}
    </AdminPage>
  );
};

export default ProductEditor;
