import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Button from '../components/ui/Button';
import HeroCarousel from '../components/ui/HeroCarousel';
import ProductCard from '../components/ui/ProductCard';
import QuickViewModal from '../components/ui/QuickViewModal';
import { HeroSkeleton, CardGridSkeleton } from '../components/ui/Skeleton';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditModal from '../components/admin/EditModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import SEOHead from '../components/SEOHead';
import { useEditMode } from '../contexts/useEditMode';
import { useToast } from '../contexts/ToastContext';
import { useHeroSlides, useClientLogos, useFeaturedProducts, usePageContent, useSiteSettings, useInstallations } from '../hooks/useContent';
import {
  updatePageContent,
  updateHeroSlide,
  updateClientLogo,
  createHeroSlide,
  createClientLogo,
  deleteHeroSlide,
  deleteClientLogo
} from '../services/contentService';
import productService from '../services/productService';
import { resolveImageUrl } from '../utils/apiHelpers';
import logger from '../utils/logger';
import { invalidateCache } from '../utils/cache';

const CONTEXT = 'HomePage';

const DEFAULT_BANNER = '/assets/default-banner-categories.png';

const HomePage = () => {
  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [isCreatingLogo, setIsCreatingLogo] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const galleryScrollRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  const { isEditMode } = useEditMode();
  const toast = useToast();

  const { data: heroSlides, loading: heroLoading, refetch: refetchHero } = useHeroSlides();
  const { data: clientLogos, refetch: refetchLogos } = useClientLogos();
  const { data: featuredProducts, loading: productsLoading } = useFeaturedProducts(4);
  const { data: ctaSection, refetch: refetchCta } = usePageContent('home', 'cta');
  const { data: installationGallerySection, refetch: refetchInstallationGallery } = usePageContent('home', 'installation_gallery');
  const { data: installations, loading: installationsLoading } = useInstallations();

  // Handler for saving content updates
  const handleSaveContent = async (pageSlug, sectionKey, newData) => {
    try {
      logger.info(CONTEXT, `Saving content for ${pageSlug}/${sectionKey}`, newData);
      await updatePageContent(pageSlug, sectionKey, newData);

      // Invalidate cache for this specific section
      const cacheKey = `page-content-${pageSlug}-${sectionKey}`;
      const invalidated = invalidateCache(cacheKey);
      logger.debug(CONTEXT, `Invalidated ${invalidated} cache entries for ${cacheKey}`);

      // Refetch the data to show updated content
      if (pageSlug === 'home' && sectionKey === 'cta') refetchCta();
      if (pageSlug === 'home' && sectionKey === 'installation_gallery') refetchInstallationGallery();
      logger.info(CONTEXT, 'Content saved successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to save content', error);
      throw error;
    }
  };

  // Hero Slides Handlers
  const handleUpdateHeroSlide = async (id, updates) => {
    await updateHeroSlide(id, updates);
    invalidateCache('hero-slides');
    refetchHero();
  };

  /* eslint-disable no-unused-vars */
  const handleCreateHeroSlide = async (newData) => {
    await createHeroSlide(newData);
    invalidateCache('hero-slides');
    refetchHero();
  };

  const handleDeleteHeroSlide = async (id) => {
    await deleteHeroSlide(id);
    invalidateCache('hero-slides');
    refetchHero();
  };
  /* eslint-enable no-unused-vars */

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const cats = await productService.getCategories();
        const active = (Array.isArray(cats) ? cats : []).filter(c => c.is_active !== false).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        setCategories(active);
        const subcatPromises = active.map(async (cat) => {
          try {
            const subcats = await productService.getSubcategories({ category_id: cat.id });
            return { categoryId: cat.id, subcategories: (Array.isArray(subcats) ? subcats : []).filter(s => s.is_active !== false).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)) };
          } catch {
            return { categoryId: cat.id, subcategories: [] };
          }
        });
        const results = await Promise.all(subcatPromises);
        const map = {};
        results.forEach(r => { map[r.categoryId] = r.subcategories; });
        setSubcategoriesByCategory(map);
      } catch (err) {
        logger.error(CONTEXT, 'Error loading categories', err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    loadCategories();
  }, []);

  // Client Logos Handlers
  const handleUpdateClientLogo = async (id, updates) => {
    await updateClientLogo(id, updates);
    invalidateCache('client-logos');
    refetchLogos();
  };

  const handleCreateClientLogo = async (newData) => {
    try {
      await createClientLogo(newData);
      const invalidated = invalidateCache('client-logos');
      logger.debug(CONTEXT, `Invalidated ${invalidated} cache entries for client-logos`);
      await refetchLogos();
      setIsCreatingLogo(false);
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create client logo', error);
      throw error;
    }
  };

  /* eslint-disable no-unused-vars */
  const handleDeleteClientLogo = async (id) => {
    await deleteClientLogo(id);
    const invalidated = invalidateCache('client-logos');
    logger.debug(CONTEXT, `Invalidated ${invalidated} cache entries for client-logos`);
    refetchLogos();
  };
  /* eslint-enable no-unused-vars */

  const slides = useMemo(() => heroSlides || [], [heroSlides]);
  const clients = clientLogos || [];
  const galleryImages = useMemo(() => {
    const inst = installations || [];
    return inst.flatMap((item) => {
      const imgs = item.images || [];
      const parsed = typeof imgs === 'string' ? (() => { try { return JSON.parse(imgs); } catch { return []; } })() : imgs;
      const urls = parsed.map(i => (typeof i === 'string' ? i : i?.url || i)).filter(Boolean);
      const primary = item.primary_image || item.primaryImage || item.url;
      if (urls.length > 0) return urls;
      if (primary) return [primary];
      return [];
    });
  }, [installations]);
  const installationGalleryTitle = installationGallerySection?.title || 'Installation Gallery';
  const installationGallerySubtitle = installationGallerySection?.subtitle || installationGallerySection?.content || 'See Eagle Chair in stunning real-world settings';

  // Extract products array from response object
  const products = (featuredProducts?.data || featuredProducts) || [];

  // CTA section content - use hardcoded fallback
  const ctaTitle = ctaSection?.title || "Ready to Furnish Your Space?";
  const ctaContent = ctaSection?.content || "Get a custom quote for your restaurant or hospitality project. Our team is ready to help you create the perfect atmosphere.";
  const ctaPrimaryText = ctaSection?.cta_text || "Request a Quote";
  const ctaPrimaryLink = ctaSection?.cta_link || "/quote-request";
  const ctaSecondaryText = ctaSection?.secondary_cta_text || "Find a Rep";
  const ctaSecondaryLink = ctaSection?.secondary_cta_link || "/find-a-rep";

  // SEO data
  const { data: siteSettings } = useSiteSettings();
  const seoTitle = siteSettings?.metaTitle || 'Eagle Chair - Premium Commercial Seating Solutions';
  const seoDescription = siteSettings?.metaDescription || 'Eagle Chair manufactures premium commercial seating for restaurants, hotels, healthcare facilities, and hospitality venues. Explore our durable, customizable furniture solutions.';
  const seoKeywords = siteSettings?.metaKeywords || 'commercial seating, restaurant chairs, hotel furniture, healthcare seating, hospitality furniture, custom chairs, commercial furniture, Eagle Chair';

  const homeSchema = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": siteSettings?.companyName || "Eagle Chair",
    "url": "https://www.eaglechair.com",
    "logo": siteSettings?.logoUrl ? `https://www.eaglechair.com${siteSettings.logoUrl}` : "https://www.eaglechair.com/og-image.jpg",
    "description": seoDescription,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": siteSettings?.addressLine1 || "",
      "addressLocality": siteSettings?.city || "",
      "addressRegion": siteSettings?.state || "",
      "postalCode": siteSettings?.zipCode || "",
      "addressCountry": siteSettings?.country || "US"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": siteSettings?.primaryPhone || "",
      "contactType": "Customer Service",
      "email": siteSettings?.primaryEmail || ""
    }
  }), [siteSettings, seoDescription]);

  // Preload first 3 hero images for instant display
  const preloadImages = useMemo(() => {
    if (!slides || slides.length === 0) return [];
    return slides.slice(0, 3).map(slide => slide.background_image_url || slide.image).filter(Boolean);
  }, [slides]);

  return (
    <div className="min-h-screen">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image="/og-image.jpg"
        url="/"
        type="website"
        keywords={seoKeywords}
        canonical="/"
        structuredData={homeSchema}
      />
      {/* Preload critical hero images */}
      {preloadImages.length > 0 && (
        <Helmet>
          {preloadImages.map((imageUrl, idx) => (
            <link
              key={`preload-hero-${idx}`}
              rel="preload"
              as="image"
              href={imageUrl}
              fetchpriority={idx === 0 ? "high" : idx === 1 ? "high" : "auto"}
            />
          ))}
        </Helmet>
      )}
      {/* Hero Carousel - extends to top, header floats above */}
      <section className="relative -mt-[var(--header-height)] min-h-screen">
        <HeroCarousel
          slides={slides}
          onUpdateSlide={handleUpdateHeroSlide}
          refetch={refetchHero}
          loading={heroLoading}
          renderSkeleton={() => <HeroSkeleton />}
        />
      </section>


      {false && (
      <>
      {/* Trusted By - Infinite Scrolling Logos */}
      <section className="py-6 sm:py-8 md:py-10 lg:py-8 bg-dark-800 overflow-hidden">
        <div className="container">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-6 sm:mb-8 md:mb-6 lg:mb-8 text-dark-50 px-4">
            Trusted by Leading Hospitality Brands
          </h2>

          {/* Centered container with fading edges */}
          <div className="relative max-w-5xl mx-auto">
            {/* Edit Mode Add Button */}
            {isEditMode && (
              <div className="mb-4 flex justify-center">
                <Button
                  onClick={() => setIsCreatingLogo(true)}
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Client Logo
                </Button>
              </div>
            )}

            {/* Create Logo Modal */}
            <EditModal
              isOpen={isCreatingLogo}
              onClose={() => setIsCreatingLogo(false)}
              onSave={handleCreateClientLogo}
              elementData={{ name: '', logo_url: '', display_order: 0 }}
              elementType="client-logo"
            />

            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 md:w-32 bg-gradient-to-r from-dark-800 to-transparent z-10 pointer-events-none"></div>

            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 md:w-32 bg-gradient-to-l from-dark-800 to-transparent z-10 pointer-events-none"></div>

            {/* Scrolling container */}
            <div className="overflow-hidden">
              {/* Calculate width and animation duration based on number of logo sets for seamless scrolling */}
              <div
                className={`flex ${!isEditMode ? 'animate-scroll-infinite' : ''}`}
                style={{
                  width: isEditMode
                    ? 'auto'
                    : clients.length < 5
                      ? '800%'  // 8 sets for very few logos (1-4)
                      : clients.length < 8
                        ? '600%'  // 6 sets for few logos (5-7)
                        : '200%',  // 2 sets for normal amount (8+)
                  // Slow down animation significantly for fewer logos to prevent gaps
                  animationDuration: !isEditMode
                    ? clients.length < 3
                      ? '120s'  // Very slow for 1-2 logos
                      : clients.length < 5
                        ? '80s'   // Slow for 3-4 logos
                        : clients.length < 8
                          ? '60s'   // Medium for 5-7 logos
                          : '40s'   // Normal for 8+ logos
                    : undefined
                }}
              >
                {/* First set of logos */}
                {clients.length > 0 && clients.map((client, index) => (
                  <EditableWrapper
                    key={`first-${client.id}-${index}`}
                    id={`client-logo-${client.id}`}
                    type="client-logo"
                    data={client}
                    onSave={(newData) => handleUpdateClientLogo(client.id, newData)}
                    refetch={refetchLogos}
                    cacheKey="client-logos"
                    label={`Logo: ${client.name}`}
                    className={`flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4 ${isEditMode ? 'inline-block' : ''}`}
                  >
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40 relative group">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}

                      {/* Delete button in edit mode */}
                      {isEditMode && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Client Logo',
                              message: `Are you sure you want to delete ${client.name}? This action cannot be undone.`,
                              onConfirm: async () => {
                                try {
                                  await deleteClientLogo(client.id);
                                  refetchLogos();
                                  toast.success(`${client.name} deleted successfully`);
                                } catch (err) {
                                  toast.error('Failed to delete client logo');
                                }
                              }
                            });
                          }}
                          className="absolute top-0 right-0 p-1 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-30"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </EditableWrapper>
                ))}

                {/* Second set of logos (duplicate for infinite scroll) - Only show when NOT in edit mode */}
                {!isEditMode && clients.length > 0 && clients.map((client, index) => (
                  <div key={`second-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Third set (for seamless loop when few logos) */}
                {!isEditMode && clients.length > 0 && clients.length < 8 && clients.map((client, index) => (
                  <div key={`third-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Fourth set (for very few logos) */}
                {!isEditMode && clients.length > 0 && clients.length < 5 && clients.map((client, index) => (
                  <div key={`fourth-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Fifth set (for few logos 5-7) */}
                {!isEditMode && clients.length > 0 && clients.length < 8 && clients.map((client, index) => (
                  <div key={`fifth-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Sixth set (for few logos 5-7) */}
                {!isEditMode && clients.length > 0 && clients.length < 8 && clients.map((client, index) => (
                  <div key={`sixth-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Seventh set (for very few logos 1-4) */}
                {!isEditMode && clients.length > 0 && clients.length < 5 && clients.map((client, index) => (
                  <div key={`seventh-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Eighth set (for very few logos 1-4) */}
                {!isEditMode && clients.length > 0 && clients.length < 5 && clients.map((client, index) => (
                  <div key={`eighth-${client.id}-${index}`} className="flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4">
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          className="max-h-full max-w-full object-contain transition-all duration-300"
                          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)' }}
                        />
                      ) : (
                        <div className="text-base font-semibold text-dark-200 text-center">
                          {client.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      </>
      )}

      {/* Featured Products */}
      <section className="-mt-px py-12 sm:py-16 md:py-20 bg-cream-50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12 px-4"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">Featured Products</h2>
            <p className="text-lg sm:text-xl text-slate-600">
              Explore our most popular commercial furniture solutions
            </p>
          </motion.div>

          {productsLoading ? (
            <CardGridSkeleton count={4} columns={4} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8 lg:gap-10 px-4 sm:px-0">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ProductCard
                    product={product}
                    onQuickView={setSelectedQuickView}
                    darkMode={false}
                  />
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center mt-8 sm:mt-12 px-4 sm:px-0">
            <Link to="/products">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Our Products - same layout as Products dropdown (productService categories) */}
      <section className="pt-12 sm:pt-16 md:pt-20 pb-0 bg-cream-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12 px-4"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">Our Products</h2>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">Explore our commercial seating categories</p>
        </motion.div>

        {categoriesLoading ? (
          <div className="w-full flex justify-center py-16">
            <div className="w-12 h-12 border-4 border-cream-300 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-full bg-cream-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0">
              {categories.slice(0, 4).map((category) => {
                const subcategories = subcategoriesByCategory[category.id] || [];
                const bannerImage = resolveImageUrl(category.banner_image_url || category.bannerImage || DEFAULT_BANNER);
                return (
                  <div key={category.id} className="relative group">
                    <div className="relative h-[400px] sm:h-[500px] md:h-[550px] lg:h-[600px] overflow-hidden">
                      <Link to={`/products/category/${category.slug}`} className="absolute inset-0 block bg-slate-100">
                        <img
                          src={bannerImage}
                          alt={category.name}
                          className="absolute inset-0 w-full h-full object-cover transition-all duration-150 group-hover:scale-110"
                          loading="eager"
                        />
                        <div
                          className="absolute top-0 left-0 right-0 bottom-0 w-full h-full pointer-events-none"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.35) 85%, rgba(0,0,0,0.2) 100%)' }}
                          aria-hidden
                        />
                      </Link>
                      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                        <div>
                          <h3 className="text-white font-bold mb-2 text-[clamp(0.875rem,1.25vw+0.75rem,1.875rem)] [text-shadow:0_0_20px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8),0_2px_4px_rgba(0,0,0,0.9)]">
                            {category.name}
                          </h3>
                          <div className="w-16 h-1 bg-primary-500 rounded-full" />
                        </div>
                        <div className="relative pl-2 sm:pl-4 pointer-events-auto py-6">
                          <div className="space-y-2">
                            {subcategories.slice(0, 5).map((subcat) => (
                              <Link
                                key={subcat.id}
                                to={`/products/category/${category.slug}/${subcat.slug}`}
                                className="block w-full text-left py-3 px-2 text-white hover:text-white hover:translate-x-2 transition-all duration-200 text-base font-medium [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.8),0_1px_3px_rgba(0,0,0,0.9)]"
                              >
                                {subcat.name}
                              </Link>
                            ))}
                            <Link
                              to={`/products/category/${category.slug}`}
                              className="block w-full text-left py-3 px-2 text-white hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-base font-bold mt-4 [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.8),0_1px_3px_rgba(0,0,0,0.9)]"
                            >
                              View All {category.name} →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {categories.length > 4 && (
                <div className="relative group">
                  <div className="relative h-[400px] sm:h-[500px] md:h-[550px] lg:h-[600px] overflow-hidden">
                    <Link to="/products" className="absolute inset-0 block">
                      <img
                        src={DEFAULT_BANNER}
                        alt="More Categories"
                        className="absolute inset-0 w-full h-full object-cover transition-all duration-150 group-hover:scale-110"
                      />
                      <div
                        className="absolute top-0 left-0 right-0 bottom-0 w-full h-full pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.35) 85%, rgba(0,0,0,0.2) 100%)' }}
                        aria-hidden
                      />
                    </Link>
                    <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                      <div>
                        <h3 className="text-white font-bold mb-2 text-[clamp(0.875rem,1.25vw+0.75rem,1.875rem)] [text-shadow:0_0_20px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8),0_2px_4px_rgba(0,0,0,0.9)]">
                          More Categories
                        </h3>
                        <div className="w-16 h-1 bg-primary-500 rounded-full" />
                      </div>
                      <div className="relative pl-2 sm:pl-4 pointer-events-auto py-6">
                        <div className="space-y-2">
                          {categories.slice(4).map((cat) => (
                            <Link
                              key={cat.id}
                              to={`/products/category/${cat.slug}`}
                              className="block w-full text-left py-3 px-2 text-white hover:text-white hover:translate-x-2 transition-all duration-200 text-base font-medium [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.8),0_1px_3px_rgba(0,0,0,0.9)]"
                            >
                              {cat.name}
                            </Link>
                          ))}
                          <Link
                            to="/products"
                            className="block w-full text-left py-3 px-2 text-white hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-base font-bold mt-4 [text-shadow:0_0_12px_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.8),0_1px_3px_rgba(0,0,0,0.9)]"
                          >
                            View All Products →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Installation Gallery */}
      <section className="py-12 sm:py-16 md:py-20 bg-cream-50 overflow-hidden">
        <div className="mb-8 sm:mb-12 px-4 sm:px-6 lg:px-8 text-center">
          <EditableWrapper
            id="home-installation-gallery-title"
            type="text"
            data={{ title: installationGalleryTitle }}
            onSave={(newData) => handleSaveContent('home', 'installation_gallery', { ...installationGallerySection, ...newData })}
            refetch={refetchInstallationGallery}
            cacheKey="page-content-home-installation_gallery"
            label="Installation Gallery Title"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">{installationGalleryTitle}</h2>
          </EditableWrapper>
          <EditableWrapper
            id="home-installation-gallery-subtitle"
            type="textarea"
            data={{ content: installationGallerySubtitle }}
            onSave={(newData) => handleSaveContent('home', 'installation_gallery', { ...installationGallerySection, ...newData })}
            refetch={refetchInstallationGallery}
            cacheKey="page-content-home-installation_gallery"
            label="Installation Gallery Subtitle"
          >
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">{installationGallerySubtitle}</p>
          </EditableWrapper>
        </div>

        {installationsLoading ? (
          <div className="h-[50vh] sm:h-[60vh] md:h-[70vh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-cream-300 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : galleryImages.length > 0 ? (
          <div className="relative w-full">
            <div
              ref={galleryScrollRef}
              className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth scrollbar-hide w-full"
              style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
            >
              {galleryImages.map((imgUrl, idx) => (
                <div
                  key={`${imgUrl}-${idx}`}
                  className="flex-shrink-0 w-full min-w-full sm:min-w-full md:min-w-[85vw] lg:min-w-[75vw] xl:min-w-[70vw] 2xl:min-w-[60vw] snap-center"
                >
                  <div className="relative w-full h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[75vh] xl:h-[80vh] px-2 sm:px-4">
                    <img
                      src={resolveImageUrl(imgUrl)}
                      alt={`Installation ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg md:rounded-xl shadow-2xl img-sharp"
                      loading={idx < 3 ? 'eager' : 'lazy'}
                      fetchpriority={idx < 2 ? 'high' : 'auto'}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => galleryScrollRef.current?.scrollBy({ left: -Math.min(galleryScrollRef.current.clientWidth, window.innerWidth * 0.85), behavior: 'smooth' })}
              className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white/95 hover:bg-cream-100 border border-cream-300 flex items-center justify-center text-slate-800 shadow-xl transition-all hover:scale-105"
              aria-label="Previous image"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => galleryScrollRef.current?.scrollBy({ left: Math.min(galleryScrollRef.current.clientWidth, window.innerWidth * 0.85), behavior: 'smooth' })}
              className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white/95 hover:bg-cream-100 border border-cream-300 flex items-center justify-center text-slate-800 shadow-xl transition-all hover:scale-105"
              aria-label="Next image"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500 px-4">
            <p className="text-center">Add installation images in the Gallery to display them here.</p>
          </div>
        )}

        <div className="text-center mt-8 sm:mt-12 px-4">
          <Link to="/gallery">
            <Button variant="outline" size="lg" className="border-primary-500 text-primary-500 hover:bg-primary-500/10">
              View Full Gallery
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-cream-50 border-t-2 border-primary-500/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center px-4">
            <EditableWrapper
              id="home-cta-title"
              type="text"
              data={{ title: ctaTitle }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
              refetch={refetchCta}
              cacheKey="page-content-home-cta"
              label="CTA Title"
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-slate-800">
                {ctaTitle}
              </h2>
            </EditableWrapper>

            <EditableWrapper
              id="home-cta-content"
              type="textarea"
              data={{ content: ctaContent }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
              refetch={refetchCta}
              cacheKey="page-content-home-cta"
              label="CTA Content"
            >
              <p className="text-lg sm:text-xl mb-6 sm:mb-8 text-slate-600 leading-relaxed">
                {ctaContent}
              </p>
            </EditableWrapper>

            <EditableWrapper
              id="home-cta-buttons"
              type="object"
              data={{
                cta_text: ctaPrimaryText,
                cta_link: ctaPrimaryLink,
                secondary_cta_text: ctaSecondaryText,
                secondary_cta_link: ctaSecondaryLink
              }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
              refetch={refetchCta}
              cacheKey="page-content-home-cta"
              label="CTA Buttons"
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
                <Link to={ctaPrimaryLink} className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 bg-primary-600 text-dark-900 rounded-lg font-semibold hover:bg-primary-500 transition-colors shadow-lg hover:shadow-primary-500/50 min-h-[48px] text-center">
                    {ctaPrimaryText}
                  </button>
                </Link>
                <Link to={ctaSecondaryLink} className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 border-2 border-primary-500 text-primary-600 rounded-lg font-semibold hover:bg-primary-500/10 transition-colors min-h-[48px] text-center">
                    {ctaSecondaryText}
                  </button>
                </Link>
              </div>
            </EditableWrapper>
          </div>
        </div>
      </section>

      <QuickViewModal
        product={selectedQuickView}
        isOpen={!!selectedQuickView}
        onClose={() => setSelectedQuickView(null)}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
        confirmButtonVariant="danger"
      />
    </div>
  );
};

export default HomePage;


