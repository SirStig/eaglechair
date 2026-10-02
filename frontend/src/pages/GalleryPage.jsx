import { useState, useMemo, lazy, Suspense } from 'react';
// eslint-disable-next-line no-unused-vars
import { m } from 'framer-motion';
import SEOHead from '../components/SEOHead';
import { SEO } from '../config/seoConfig';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableSectionHeading from '../components/common/EditableSectionHeading';
import EditableList from '../components/admin/EditableList';
import { useInstallations } from '../hooks/useContent';
import { runCmsBatch } from '../utils/cmsContentStore';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const CONTEXT = 'GalleryPage';

const ImageLightboxModal = lazy(() => import('../components/ui/ImageLightboxModal'));

// Admin-only write API; loaded on first save so public visitors never download it
const loadCmsAdmin = () => import('../services/cmsAdminService');

const categoryOf = (img) => img.category || img.projectType || img.project_type;
const displayOrderOf = (img) => img.displayOrder ?? img.display_order;
const imageUrlOf = (img) => img.url || img.primary_image || img.primaryImage ||
  (img.images && (typeof img.images === 'string' ? JSON.parse(img.images)[0] : img.images[0]));

/**
 * Apply a move made inside a (possibly filtered) subset to the FULL list.
 * Only the moved item changes position relative to the others: it is placed
 * right before the item that now follows it in the subset (or right after
 * the one that now precedes it when it was dropped at the end).
 */
const applySubsetMove = (fullList, reorderedSubset, movedItem) => {
  const rest = fullList.filter((img) => img.id !== movedItem.id);
  const pos = reorderedSubset.findIndex((img) => img.id === movedItem.id);
  const after = reorderedSubset[pos + 1];
  const before = reorderedSubset[pos - 1];
  let insertAt = rest.length;
  if (after) {
    insertAt = rest.findIndex((img) => img.id === after.id);
  } else if (before) {
    insertAt = rest.findIndex((img) => img.id === before.id) + 1;
  }
  if (insertAt < 0) insertAt = rest.length;
  rest.splice(insertAt, 0, movedItem);
  return rest;
};

const GalleryPage = () => {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [filter, setFilter] = useState('all');
  const { data: installations, loading } = useInstallations();

  // Use API data
  const images = useMemo(() => installations || [], [installations]);

  const categories = ['all', ...new Set(images.map(categoryOf).filter(Boolean))];
  
  const filteredImages = useMemo(() => (filter === 'all'
    ? images
    : images.filter(img => categoryOf(img) === filter)), [images, filter]);

  const lightboxImages = useMemo(() => filteredImages.map(imageUrlOf), [filteredImages]);

  // Handlers for CRUD operations
  const handleUpdateInstallation = async (id, updates) => {
    try {
      logger.info(CONTEXT, `Updating installation ${id}`);
      
      // Sync primary_image with images array if primary_image changed
      // (the static export calls the primary image `url`)
      const dataToSend = { ...updates };
      const primaryImage = updates.primary_image || updates.url;
      if (primaryImage && (!updates.images || updates.images.length === 0)) {
        dataToSend.images = [primaryImage];
      }
      
      const { updateInstallation } = await loadCmsAdmin();
      await updateInstallation(id, dataToSend);
      logger.info(CONTEXT, 'Installation updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update installation', error);
      throw error;
    }
  };

  const handleCreateInstallation = async (newData) => {
    try {
      logger.info(CONTEXT, 'Creating new installation');
      
      // Ensure images array is not empty (backend requires at least 1 image)
      const dataToSend = {
        ...newData,
        images: Array.isArray(newData.images) && newData.images.length > 0 
          ? newData.images 
          : newData.primary_image 
            ? [newData.primary_image] 
            : []
      };
      
      // Backend requires at least 1 image
      if (dataToSend.images.length === 0) {
        throw new Error('At least one image is required. Please upload an image first.');
      }
      
      const { createInstallation } = await loadCmsAdmin();
      await createInstallation(dataToSend);
      logger.info(CONTEXT, 'Installation created successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create installation', error);
      throw error;
    }
  };

  const handleDeleteInstallation = async (id) => {
    try {
      logger.info(CONTEXT, `Deleting installation ${id}`);
      const { deleteInstallation } = await loadCmsAdmin();
      await deleteInstallation(id);
      logger.info(CONTEXT, 'Installation deleted successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to delete installation', error);
      throw error;
    }
  };

  // The gallery is ordered by display_order DESC, so the first item gets the
  // highest value. Orders are computed against the FULL list, so reordering
  // inside a filtered view never collides with hidden items.
  const handleReorderInstallations = async (reorderedItems, move) => {
    const movedItem = move?.item;
    const fullOrder = filter === 'all' || !movedItem
      ? reorderedItems
      : applySubsetMove(images, reorderedItems, movedItem);

    const total = fullOrder.length;
    const changes = fullOrder
      .map((item, index) => ({ item, order: total - 1 - index }))
      .filter(({ item, order }) => displayOrderOf(item) !== order);

    logger.info(CONTEXT, `Reordering gallery installations (${changes.length} updates)`);
    try {
      const { updateInstallation } = await loadCmsAdmin();
      // One invalidation (and one re-sync) for the whole batch
      await runCmsBatch(async () => {
        for (const { item, order } of changes) {
          await updateInstallation(item.id, { display_order: order });
        }
      });
      logger.info(CONTEXT, 'Gallery installations reordered successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to reorder installations', error);
      // Some items may already be saved. runCmsBatch invalidated the content
      // caches on the way out, so the list re-syncs from the server;
      // EditableList restores the previous order meanwhile and shows a toast.
      throw new Error(`${error?.message || 'Request failed'}. The gallery was reloaded from the server.`);
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <SEOHead {...SEO.pages.gallery} />
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-[1800px]">
        {/* Header */}
        <div className="text-center mb-12">
          <EditableSectionHeading
            page="gallery"
            section="header"
            defaultTitle="Gallery"
            defaultSubtitle="Explore our furniture in real commercial settings. See how Eagle Chair products transform restaurants, hotels, and hospitality spaces."
            label="Gallery page heading"
          >
            {({ title, subtitle }) => (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-dark-50">{title}</h1>
                {subtitle && <p className="text-base sm:text-lg text-dark-100 max-w-2xl mx-auto px-4">{subtitle}</p>}
              </>
            )}
          </EditableSectionHeading>
        </div>

        {/* Filter Tabs - only when images carry more than one category */}
        {categories.length > 1 && (
        <div className="flex justify-center gap-2 mb-6 sm:mb-8 flex-wrap px-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all text-sm sm:text-base min-h-[44px] ${
                filter === category
                  ? 'bg-primary-500 text-dark-900'
                  : 'bg-dark-600 text-dark-50 hover:bg-dark-700 border border-dark-500'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
        )}

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <EditableList
            items={filteredImages}
            onUpdate={handleUpdateInstallation}
            onCreate={handleCreateInstallation}
            onDelete={handleDeleteInstallation}
            onReorder={handleReorderInstallations}
            addButtonText="Add New Image"
            itemType="installation"
            allowReorder={true}
            defaultNewItem={{
              project_name: 'New Installation',
              client_name: '',
              location: '',
              project_type: 'restaurant',
              description: '',
              primary_image: '',
              images: [],
              completion_date: '',
              display_order: filteredImages.length,
              is_active: true,
              is_featured: false
            }}
            renderItem={(image, index) => {
              const imageUrl = imageUrlOf(image);
              const title = image.title || image.project_name || image.projectName;
              const category = image.category || image.project_type || image.projectType;
              const location = image.location;
              
              return (
                <m.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative group cursor-pointer overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-shadow"
                  onClick={() => setLightboxIndex(Math.max(0, filteredImages.findIndex((img) => img.id === image.id)))}
                >
                  <ResponsiveImage
                    src={imageUrl}
                    sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    alt={title || 'Eagle Chair installation'}
                    className="w-full h-full object-cover img-sharp group-hover:scale-105 transition-transform duration-500"
                    style={{ aspectRatio: '16/10', objectFit: 'cover' }}
                  />
                  {/* Caption overlay only when there is something to say */}
                  {(title || category || location) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        {title && <h3 className="text-xl font-semibold mb-1 text-dark-50">{title}</h3>}
                        {category && <p className="text-sm text-dark-100">{category}</p>}
                        {location && <p className="text-xs text-dark-200">{location}</p>}
                      </div>
                    </div>
                  )}
                </m.div>
              );
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          />
        )}

        {/* Fullscreen viewer with zoom/pan */}
        {lightboxIndex !== null && (
          <Suspense fallback={null}>
            <ImageLightboxModal
              isOpen
              dark
              onClose={() => setLightboxIndex(null)}
              images={lightboxImages}
              initialIndex={lightboxIndex}
            />
          </Suspense>
        )}

        {/* CTA Section */}
        <div className="mt-12 sm:mt-16 bg-dark-900 border border-dark-600 rounded-2xl p-6 sm:p-8 lg:p-12 text-center">
          <EditableSectionHeading
            page="gallery"
            section="cta"
            defaultTitle="Ready to Transform Your Space?"
            defaultSubtitle="Let us help you create a stunning commercial environment with our premium furniture."
            label="Gallery call to action"
          >
            {({ title, subtitle }) => (
              <>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-dark-50">{title}</h2>
                {subtitle && <p className="text-lg sm:text-xl mb-4 sm:mb-6 max-w-2xl mx-auto text-dark-100 px-4">{subtitle}</p>}
              </>
            )}
          </EditableSectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <a href="/quote-request" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-dark-900 text-primary-500 rounded-lg font-semibold hover:bg-dark-800 transition-colors border-2 border-primary-500 min-h-[44px]">
                Request a Quote
              </button>
            </a>
            <a href="/products" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 sm:px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors min-h-[44px]">
                Browse Products
              </button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryPage;


