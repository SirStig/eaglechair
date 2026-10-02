import { useState } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Button from '../../../ui/Button';
import ResponsiveImage from '../../../ui/ResponsiveImage';
import { resolveImageUrl } from '../../../../utils/apiHelpers';
import { ImagePicker, ProductPicker } from './Pickers';
import { EMBLEMS, PAGE_TYPES, defaultCaption, inspectorTabs, modelLabel, newItem } from './pageModel';

const INPUT = 'w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none';

const Field = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-medium text-dark-200">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-dark-400">{hint}</span>}
  </label>
);

const Text = ({ value, onChange, ...props }) => (
  <input className={INPUT} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
);

const Area = ({ value, onChange, rows = 3, ...props }) => (
  <textarea className={`${INPUT} resize-y`} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
);

const Section = ({ title, children }) => (
  <div className="space-y-3 pt-4 first:pt-0">
    <h4 className="text-[11px] uppercase tracking-wider text-dark-400 font-semibold">{title}</h4>
    {children}
  </div>
);

const findVariation = (product, id) => product?.variations?.find((v) => v.id === id) || null;

const itemImage = (item, product, variation) => item.image_url || variation?.default_image || product?.default_image || null;

/** One product / variation on a page: variation, photo, caption, specs, order. */
const ItemRow = ({ item, index, count, page, product, selected, onSelect, onChange, onMove, onRemove }) => {
  const [picking, setPicking] = useState(false);
  const variation = findVariation(product, item.variation_id);
  const image = itemImage(item, product, variation);
  const photos = [...new Set([
    ...(variation?.images || []),
    ...(product?.images || []),
    ...(product?.variations || []).flatMap((v) => v.images || []),
  ])];
  const moved = item.dx || item.dy || (item.scale && item.scale !== 1);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div
      onClick={() => onSelect(index)}
      className={`rounded-lg border p-2.5 space-y-2 cursor-pointer ${selected ? 'border-primary-500 bg-primary-500/5' : 'border-dark-600 bg-dark-800 hover:border-dark-500'}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={stop(() => setPicking(true))}
          className="relative w-12 h-12 rounded bg-dark-600 shrink-0 overflow-hidden group"
          title="Change photo"
        >
          {image && <ResponsiveImage sizes="48px" fullResolution={false} src={resolveImageUrl(image)} alt="" className="w-full h-full object-contain" />}
          <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/50"><ImageIcon className="w-4 h-4 text-white" /></span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-dark-50 font-mono truncate">{modelLabel(product, variation) || 'Loading…'}</div>
          <div className="text-xs text-dark-400 truncate">{variation?.name || product?.name}</div>
        </div>
        <div className="flex flex-col">
          <button type="button" disabled={index === 0} onClick={stop(() => onMove(-1))} className="p-0.5 text-dark-300 hover:text-dark-50 disabled:opacity-30" aria-label="Move up">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" disabled={index === count - 1} onClick={stop(() => onMove(1))} className="p-0.5 text-dark-300 hover:text-dark-50 disabled:opacity-30" aria-label="Move down">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <button type="button" onClick={stop(onRemove)} className="p-1 text-dark-400 hover:text-red-400" aria-label="Remove">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {selected && (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {product?.variations?.length > 0 && (
            <select
              className={INPUT}
              value={item.variation_id ?? ''}
              onChange={(e) => onChange({ variation_id: e.target.value ? Number(e.target.value) : null })}
              aria-label="Variation"
            >
              <option value="">Base model ({modelLabel(product)})</option>
              {product.variations.map((v) => <option key={v.id} value={v.id}>{v.sku}{v.name ? ` – ${v.name}` : ''}</option>)}
            </select>
          )}
          {(page.type === 'gallery' || page.type === 'cover') && (
            <Field label="Caption" hint="Leave empty for the automatic caption shown in grey.">
              <Area
                rows={2}
                value={item.caption ?? ''}
                placeholder={page.type === 'cover' ? modelLabel(product, variation) : defaultCaption(product, variation)}
                onChange={(v) => onChange({ caption: v === '' ? null : v })}
              />
            </Field>
          )}
          {page.type === 'product' && (
            <label className="flex items-center gap-2 text-xs text-dark-200">
              <input type="checkbox" className="accent-primary-500" checked={item.show_specs !== false} onChange={(e) => onChange({ show_specs: e.target.checked })} />
              Show dimensions column
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="xs" variant="ghost" onClick={() => setPicking(true)}><ImageIcon className="w-3.5 h-3.5 mr-1" />Photo</Button>
            {moved && (
              <Button size="xs" variant="ghost" onClick={() => onChange({ dx: 0, dy: 0, scale: 1 })}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset position
              </Button>
            )}
          </div>
        </div>
      )}

      <ImagePicker
        isOpen={picking}
        onClose={() => setPicking(false)}
        productImages={photos}
        allowDefault
        onPick={(url) => onChange({ image_url: url })}
      />
    </div>
  );
};

/**
 * Right-hand panel: the selected page's settings, split into tabs
 * (Page / Products / Text). onChange takes a partial page, or a function
 * (current page) => partial page.
 */
const PageInspector = ({ page, pageNumber, tab, onTabChange, products, onRegisterProduct, selectedItem, onSelectItem, onChange }) => {
  const [adding, setAdding] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const meta = PAGE_TYPES[page.type];
  const items = page.items || [];
  const tabs = inspectorTabs(page.type);
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'page';
  const set = (key) => (value) => onChange({ [key]: value });

  const setItems = (next) => onChange({ items: next });
  const updateItem = (index, changes) => setItems(items.map((it, i) => (i === index ? { ...it, ...changes } : it)));
  const moveItem = (index, delta) => {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setItems(next);
    onSelectItem(index + delta);
  };
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    onSelectItem(null);
  };
  const addItem = (product, variation) => {
    onRegisterProduct(product);
    onChange((current) => {
      const list = current.items || [];
      if (list.length >= meta.maxItems) return {};
      return { items: [...list, newItem({ product_id: product.id, variation_id: variation?.id ?? null })] };
    });
  };

  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-dark-50">
          <Icon className="w-4 h-4 text-primary-400" />
          <span className="font-semibold">{meta.label}</span>
          <span className="text-xs text-dark-400 ml-auto">Page {pageNumber}</span>
        </div>
        <p className="text-xs text-dark-400 mt-1">{meta.description}</p>
      </div>

      {tabs.length > 1 && (
        <div className="flex rounded-lg bg-dark-900/60 p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === t.id ? 'bg-primary-500 text-dark-900' : 'text-dark-200 hover:text-dark-50'
              }`}
            >
              {t.label}
              {t.id === 'products' && <span className="ml-1 opacity-70">{items.length}/{meta.maxItems}</span>}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'page' && (
        <div className="space-y-1 divide-y divide-dark-700/60">
          {page.type !== 'photo' && (
            <Section title="Heading">
              <Field label={page.type === 'cover' ? 'Headline' : 'Title'}>
                <Text value={page.title} onChange={set('title')} />
              </Field>
              {(page.type === 'product' || page.type === 'gallery') && (
                <Field label="Subtitle" hint='Smaller words after the title, e.g. "variations" or "outdoor".'>
                  <Text value={page.subtitle} onChange={set('subtitle')} />
                </Field>
              )}
              {page.type === 'cover' && (
                <>
                  <Field label="Line above the headline"><Text value={page.subtitle} onChange={set('subtitle')} /></Field>
                  <Field label="Year"><Text value={page.year} onChange={set('year')} /></Field>
                </>
              )}
            </Section>
          )}

          {page.type === 'cover' && (
            <Section title="Taglines">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Left"><Text value={page.tagline} onChange={set('tagline')} /></Field>
                <Field label="Right"><Text value={page.tagline_right} onChange={set('tagline_right')} /></Field>
              </div>
              <Field label="Website (bottom left)"><Text value={page.website} onChange={set('website')} /></Field>
            </Section>
          )}

          {(page.type === 'gallery' || page.type === 'toc') && (
            <Section title="Bottom banner">
              <Field label="Tagline"><Area rows={2} value={page.tagline} onChange={set('tagline')} /></Field>
            </Section>
          )}

          {(page.type === 'product' || page.type === 'gallery') && (
            <Section title="Emblem">
              <div className="flex gap-2">
                {EMBLEMS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => onChange({ emblem: e.value })}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs border ${
                      page.emblem === e.value ? 'border-primary-500 text-primary-300 bg-primary-500/10' : 'border-dark-600 text-dark-200'
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              {page.type === 'product' && (
                <Field label="Patent / IP" hint='Printed as "IP: …", e.g. pat. US D828,063 S'>
                  <Text value={page.ip_text} onChange={set('ip_text')} />
                </Field>
              )}
            </Section>
          )}

          {page.type === 'photo' && (
            <Section title="Photo">
              <button
                type="button"
                onClick={() => setPickingPhoto(true)}
                className="block w-32 aspect-[612/792] rounded bg-dark-700 overflow-hidden border border-dark-600 hover:border-primary-500"
                title="Choose photo"
              >
                {page.image_url ? (
                  <ResponsiveImage sizes="128px" fullResolution={false} src={resolveImageUrl(page.image_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-dark-400 p-2 text-center">Choose a photo</span>
                )}
              </button>
              <div className="flex gap-2">
                <Button size="xs" variant="outline" onClick={() => setPickingPhoto(true)}><ImageIcon className="w-3.5 h-3.5 mr-1" />Choose photo</Button>
                {(page.dx || page.dy || page.scale !== 1) && (
                  <Button size="xs" variant="ghost" onClick={() => onChange({ dx: 0, dy: 0, scale: 1 })}><RotateCcw className="w-3.5 h-3.5 mr-1" />Reset crop</Button>
                )}
              </div>
              <Field label="Caption" hint="White text, bottom left."><Area rows={2} value={page.caption} onChange={set('caption')} /></Field>
              <label className="flex items-center gap-2 text-xs text-dark-200">
                <input type="checkbox" className="accent-primary-500" checked={!!page.show_footer} onChange={(e) => onChange({ show_footer: e.target.checked })} />
                Show copyright and page number
              </label>
              <ImagePicker isOpen={pickingPhoto} onClose={() => setPickingPhoto(false)} onPick={(url) => onChange({ image_url: url })} />
            </Section>
          )}

          {page.type !== 'cover' && page.type !== 'toc' && (
            <Section title="Contents page">
              <label className="flex items-center gap-2 text-xs text-dark-200">
                <input type="checkbox" className="accent-primary-500" checked={page.include_in_toc !== false} onChange={(e) => onChange({ include_in_toc: e.target.checked })} />
                List this page in the contents
              </label>
              {page.include_in_toc !== false && (
                <Field
                  label="Name in the contents"
                  hint={page.type === 'photo' ? 'Photo pages need a name to be listed.' : 'Defaults to the title. Pages in a row with the same name share one entry.'}
                >
                  <Text value={page.toc_label ?? ''} placeholder={page.title} onChange={(v) => onChange({ toc_label: v || null })} />
                </Field>
              )}
            </Section>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-3">
          <p className="text-xs text-dark-400">
            Click a product to change its variation, photo or caption. On the preview you can also drag its photo.
          </p>
          <div className="space-y-2">
            {items.map((item, index) => (
              <ItemRow
                key={`${index}-${item.product_id}-${item.variation_id}`}
                item={item}
                index={index}
                count={items.length}
                page={page}
                product={products[item.product_id]}
                selected={selectedItem === index}
                onSelect={onSelectItem}
                onChange={(changes) => updateItem(index, changes)}
                onMove={(delta) => moveItem(index, delta)}
                onRemove={() => removeItem(index)}
              />
            ))}
            {!items.length && (
              <p className="text-sm text-dark-300 border border-dashed border-dark-600 rounded-lg p-4 text-center">No products on this page yet.</p>
            )}
          </div>
          <Button size="sm" variant="outline" className="w-full" disabled={items.length >= meta.maxItems} onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add products
          </Button>
          <ProductPicker isOpen={adding} onClose={() => setAdding(false)} onPick={addItem} remaining={meta.maxItems - items.length} />
        </div>
      )}

      {activeTab === 'text' && (
        <div className="space-y-3">
          <p className="text-xs text-dark-400">The white panel at the bottom of the sheet. Empty sections are left out; text shrinks to fit.</p>
          <Field label="Features"><Area rows={4} value={page.features} onChange={set('features')} /></Field>
          <Field label="Materials"><Area rows={2} value={page.materials} onChange={set('materials')} /></Field>
          <Field label="Environmental consideration"><Area rows={2} value={page.environmental} onChange={set('environmental')} /></Field>
          <Field label="Standard (right column)"><Area rows={2} value={page.standard} onChange={set('standard')} /></Field>
          <Field label="Options (right column)"><Area rows={2} value={page.options} onChange={set('options')} /></Field>
        </div>
      )}
    </div>
  );
};

export default PageInspector;
