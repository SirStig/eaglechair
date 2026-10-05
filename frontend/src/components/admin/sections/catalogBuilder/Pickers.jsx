import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Images, Layers, Loader2, Plus, Search, Upload } from 'lucide-react';
import Modal from '../../../ui/Modal';
import Button from '../../../ui/Button';
import ResponsiveImage from '../../../ui/ResponsiveImage';
import MediaLibraryModal from '../../media/MediaLibraryModal';
import { resolveImageUrl } from '../../../../utils/apiHelpers';
import { getInstallations } from '../../../../services/contentService';
import { listFamilies, searchProducts, uploadCatalogImage } from '../../../../services/catalogToolsService';
import { PAGE_TYPES, modelLabel } from './pageModel';

const INPUT = 'w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-50 focus:border-primary-500 outline-none';

const Thumb = ({ url, size = 'w-12 h-12' }) => (url ? (
  <ResponsiveImage sizes="64px" fullResolution={false} src={resolveImageUrl(url)} alt="" className={`${size} object-contain rounded bg-dark-600 shrink-0`} />
) : (
  <div className={`${size} rounded bg-dark-600 shrink-0`} />
));

/**
 * Search products and add a product or one of its variations.
 * onPick(product, variation | null); stays open so several can be added.
 */
export const ProductPicker = ({ isOpen, onClose, onPick, remaining }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(() => new Set());

  useEffect(() => {
    if (isOpen) setAdded(new Set());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchProducts({ search: search.trim() || undefined, limit: 40 }));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, isOpen]);

  const pick = (product, variation) => {
    onPick(product, variation);
    setAdded((prev) => new Set(prev).add(variation ? `v${variation.id}` : `p${product.id}`));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add products" size="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input autoFocus className={`${INPUT} pl-9`} placeholder="Model number or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-dark-400">
          {remaining > 0 ? `${remaining} more can go on this page.` : 'This page is full: remove an item to add another.'}
        </p>
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-dark-700 border border-dark-700 rounded-lg">
          {loading && <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>}
          {!loading && !results.length && <div className="p-6 text-center text-dark-400 text-sm">No products found.</div>}
          {!loading && results.map((product) => (
            <div key={product.id} className="p-3">
              <div className="flex items-center gap-3">
                <Thumb url={product.default_image} />
                <div className="flex-1 min-w-0">
                  <div className="text-dark-50 text-sm font-medium truncate">
                    <span className="font-mono">{modelLabel(product)}</span> {product.name}
                  </div>
                  <div className="text-xs text-dark-400 truncate">
                    {[product.family_name, product.category_name].filter(Boolean).join(' · ')}
                    {!product.is_active && <span className="ml-2 text-amber-400">inactive</span>}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant={added.has(`p${product.id}`) ? 'ghost' : 'outline'}
                  disabled={remaining <= 0}
                  onClick={() => pick(product, null)}
                  aria-label={`Add ${modelLabel(product)}`}
                >
                  {added.has(`p${product.id}`) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              {product.variations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pl-[3.75rem]">
                  {product.variations.map((variation) => (
                    <button
                      key={variation.id}
                      type="button"
                      disabled={remaining <= 0}
                      onClick={() => pick(product, variation)}
                      className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-md border text-xs disabled:opacity-50 ${
                        added.has(`v${variation.id}`) ? 'border-primary-500 text-primary-300' : 'border-dark-600 text-dark-200 hover:border-primary-500'
                      }`}
                      title={variation.name || variation.sku}
                    >
                      <Thumb url={variation.default_image} size="w-7 h-7" />
                      <span className="font-mono">{variation.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end"><Button size="sm" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
};

/** Choose families; the server builds starter pages for them. */
export const FamilyPicker = ({ isOpen, onClose, onConfirm }) => {
  const [families, setFamilies] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [filter, setFilter] = useState('');
  const [includeGallery, setIncludeGallery] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setChosen([]);
    listFamilies().then(setFamilies).catch(() => setFamilies([]));
  }, [isOpen]);

  const toggle = (id) => setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const visible = families.filter((f) => f.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(chosen, includeGallery);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add family pages" size="md">
      <div className="space-y-3">
        <p className="text-sm text-dark-300">
          Each family gets product sheets (two products per page) filled in from the product data,
          plus a variations page when it has at least three photographed variations. Pages are added in the order you pick.
        </p>
        <input className={INPUT} placeholder="Filter families…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="max-h-[45vh] overflow-y-auto border border-dark-700 rounded-lg divide-y divide-dark-700">
          {visible.map((family) => {
            const order = chosen.indexOf(family.id);
            return (
              <button
                key={family.id}
                type="button"
                onClick={() => toggle(family.id)}
                className={`w-full flex items-center gap-3 p-2.5 text-left text-sm ${order >= 0 ? 'bg-primary-500/10' : 'hover:bg-dark-700'}`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                    order >= 0 ? 'bg-primary-500 border-primary-500 text-dark-900' : 'border-dark-500 text-transparent'
                  }`}
                >
                  {order >= 0 ? order + 1 : '·'}
                </span>
                <span className="flex-1 text-dark-50">{family.name}</span>
                <span className="text-xs text-dark-400">{family.product_count} products</span>
              </button>
            );
          })}
          {!visible.length && <p className="p-6 text-center text-sm text-dark-400">No families found.</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-dark-200">
          <input type="checkbox" className="accent-primary-500" checked={includeGallery} onChange={(e) => setIncludeGallery(e.target.checked)} />
          Add variations pages
        </label>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={confirm} disabled={!chosen.length || busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add {chosen.length || ''} {chosen.length === 1 ? 'family' : 'families'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const installationImages = (installations) => {
  const urls = [];
  (installations || []).forEach((inst) => {
    [inst.primary_image, ...(inst.images || [])].forEach((entry) => {
      const url = typeof entry === 'string' ? entry : entry?.url;
      if (url && url.startsWith('/uploads/images/') && !urls.some((u) => u.url === url)) {
        urls.push({ url, label: inst.project_name || inst.projectName || '' });
      }
    });
  });
  return urls;
};

/**
 * Choose a photo: the product's own photos, the install gallery, or upload one.
 * onPick(url | null) - null goes back to the product's default photo.
 */
export const ImagePicker = ({ isOpen, onClose, onPick, productImages = [], allowDefault = false }) => {
  const [tab, setTab] = useState('gallery');
  const [gallery, setGallery] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (isOpen) setTab(productImages.length ? 'product' : 'gallery');
    else setLibraryOpen(false);
  }, [isOpen, productImages.length]);

  useEffect(() => {
    if (!isOpen || tab !== 'gallery' || gallery) return;
    getInstallations().then((list) => setGallery(installationImages(list))).catch(() => setGallery([]));
  }, [isOpen, tab, gallery]);

  const choose = (url) => {
    onPick(url);
    onClose();
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadCatalogImage(file);
      choose(result.url);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const tabs = [
    ['product', 'Product photos', productImages.length > 0],
    ['gallery', 'Install gallery', true],
    ['upload', 'Upload', true],
  ].filter(([, , show]) => show);
  const images = tab === 'product' ? productImages.map((url) => ({ url, label: '' })) : gallery || [];
  const waiting = tab === 'gallery' && gallery === null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a photo" size="lg">
      <div className="space-y-3">
        <div className="flex gap-2 border-b border-dark-700">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-primary-500 text-primary-300' : 'border-transparent text-dark-300 hover:text-dark-100'}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 border-transparent text-dark-300 hover:text-dark-100"
          >
            <Images className="w-4 h-4" />
            Media library…
          </button>
        </div>

        {tab === 'upload' && (
          <div className="border-2 border-dashed border-dark-600 rounded-lg p-10 text-center space-y-3">
            <Upload className="w-8 h-8 mx-auto text-dark-400" />
            <p className="text-sm text-dark-300">PNG with a transparent background for product cut-outs, JPEG for install photos.</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
              Choose file
            </Button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}

        {tab !== 'upload' && (
          <div className="max-h-[55vh] overflow-y-auto">
            {waiting ? (
              <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map(({ url, label }) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => choose(url)}
                    className="rounded-lg overflow-hidden border border-dark-600 hover:border-primary-500 bg-dark-700"
                    title={label}
                  >
                    <ResponsiveImage sizes="160px" fullResolution={false} src={resolveImageUrl(url)} alt={label} className="w-full aspect-square object-contain" />
                  </button>
                ))}
                {!images.length && <p className="col-span-full text-sm text-dark-400 p-6 text-center">No photos here yet.</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between">
          {allowDefault ? <Button size="sm" variant="ghost" onClick={() => choose(null)}>Use default photo</Button> : <span />}
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
      <MediaLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(url) => choose(url)}
        subfolder="catalog"
        title="Choose a photo"
      />
    </Modal>
  );
};

/**
 * "Add page": the quickest path (whole families, pre-filled) first, then
 * every single page type with what it looks like.
 */
export const AddPageDialog = ({ isOpen, onClose, onAddType, onAddFamilies }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Add pages" size="lg">
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { onClose(); onAddFamilies(); }}
        className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-primary-500/70 bg-primary-500/10 hover:bg-primary-500/20 text-left"
      >
        <Layers className="w-8 h-8 text-primary-400 shrink-0" />
        <div>
          <div className="text-dark-50 font-semibold">Product families <span className="ml-1 text-[11px] font-normal text-primary-300">Recommended</span></div>
          <p className="text-sm text-dark-300 mt-0.5">
            Pick one or more families: their product sheets and variations pages are built for you, with dimensions,
            photos and text filled in from the product data. You can edit everything afterwards.
          </p>
        </div>
      </button>
      <div>
        <p className="text-xs uppercase tracking-wider text-dark-400 mb-2">Or add a single page</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(PAGE_TYPES).map(([type, meta]) => (
            <button
              key={type}
              type="button"
              onClick={() => { onClose(); onAddType(type); }}
              className="flex items-start gap-3 p-3 rounded-lg border border-dark-500 hover:border-primary-500 bg-dark-700/40 text-left"
            >
              <meta.icon className="w-5 h-5 text-dark-200 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-dark-50 font-medium">{meta.label}</div>
                <p className="text-xs text-dark-300 mt-0.5">{meta.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  </Modal>
);
