import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { m } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Button from '../components/ui/Button';
import HeroCarousel from '../components/ui/HeroCarousel';
import QuickViewModal from '../components/ui/QuickViewModal';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import EditableWrapper from '../components/admin/EditableWrapper';
import ConfirmModal from '../components/ui/ConfirmModal';
import SEOHead from '../components/SEOHead';
import { useEditMode } from '../contexts/useEditMode';
import { useToast } from '../contexts/ToastContext';
import EditableList from '../components/admin/EditableList';
import { useHeroSlides, useClientLogos, useFeaturedProducts, usePageContent, useSiteSettings, useInstallations, useTestimonials } from '../hooks/useContent';
import CategoryTile from '../components/products/CategoryTile';
import FeaturedProductsStrip from '../components/products/FeaturedProductsStrip';
import productService from '../services/productService';
import { resolveImageUrl, ensureResolvedImageUrl, getImageSrcSet } from '../utils/apiHelpers';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import logger from '../utils/logger';
import { safeHref } from '../utils/safeUrl';
import { isPublishFailed } from '../utils/cmsContentStore';

const CONTEXT = 'HomePage';

// Admin-only; fetched when edit mode is on
const EditModal = lazy(() => import('../components/admin/EditModal'));
// Admin-only write API; loaded on first save so public visitors never download it
const loadCmsAdmin = () => import('../services/cmsAdminService');

// The "Trusted by" client-logo strip is hidden for now
const SHOW_CLIENT_LOGOS = false;

const DEFAULT_BANNER = '/assets/default-banner-categories.webp';

// Widest the product grid goes before extra categories collapse into
// "More Categories" - matches the Products dropdown
const MAX_CATEGORY_COLUMNS = 5;
const MAX_FEATURED_PRODUCTS = 20;

const HomePage = () => {
  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [isCreatingLogo, setIsCreatingLogo] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Categories beyond the first four collapse into a "More Categories" tile,
  // so the row never wraps onto a second, half-empty line.
  const featuredCategories = categories.slice(0, MAX_CATEGORY_COLUMNS - 1);
  const overflowCategories = categories.slice(MAX_CATEGORY_COLUMNS - 1);
  const categoryColumnCount = Math.min(
    featuredCategories.length + (overflowCategories.length > 0 ? 1 : 0),
    MAX_CATEGORY_COLUMNS
  );
  const galleryScrollRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  const { isEditMode } = useEditMode();
  const toast = useToast();

  const { data: heroSlides, loading: heroLoading } = useHeroSlides();
  const { data: clientLogos } = useClientLogos();
  const { data: featuredProducts, loading: productsLoading } = useFeaturedProducts(MAX_FEATURED_PRODUCTS);
  const { data: ctaSection } = usePageContent('home', 'cta');
  const { data: installationGallerySection } = usePageContent('home', 'installation_gallery');
  const { data: installations, loading: installationsLoading } = useInstallations();
  const { data: testimonials } = useTestimonials();
  const { data: testimonialsSection } = usePageContent('home', 'testimonials');

  // Saves go through cmsAdminService; the API client then invalidates the
  // shared content caches and every content hook re-fetches - no refetch here.
  const handleSaveContent = async (pageSlug, sectionKey, newData) => {
    try {
      logger.info(CONTEXT, `Saving content for ${pageSlug}/${sectionKey}`, newData);
      const { updatePageContent } = await loadCmsAdmin();
      await updatePageContent(pageSlug, sectionKey, newData);
      logger.info(CONTEXT, 'Content saved successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to save content', error);
      throw error;
    }
  };

  // Hero Slides Handlers
  const handleUpdateHeroSlide = async (id, updates) => {
    const { updateHeroSlide } = await loadCmsAdmin();
    await updateHeroSlide(id, updates);
  };

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
    const { updateClientLogo } = await loadCmsAdmin();
    await updateClientLogo(id, updates);
  };

  const handleCreateClientLogo = async (newData) => {
    try {
      const { createClientLogo } = await loadCmsAdmin();
      await createClientLogo(newData);
      setIsCreatingLogo(false);
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create client logo', error);
      throw error;
    }
  };

  // Testimonials Handlers
  const handleUpdateTestimonial = async (id, updates) => {
    const { updateTestimonial } = await loadCmsAdmin();
    await updateTestimonial(id, updates);
  };

  const handleCreateTestimonial = async (newData) => {
    const { createTestimonial } = await loadCmsAdmin();
    await createTestimonial(newData);
  };

  const handleDeleteTestimonial = async (id) => {
    const { deleteTestimonial } = await loadCmsAdmin();
    await deleteTestimonial(id);
  };

  const testimonialList = testimonials || [];
  const testimonialsTitle = testimonialsSection?.title || 'What Our Clients Say';
  const testimonialsSubtitle = testimonialsSection?.subtitle || testimonialsSection?.content || 'Trusted by restaurants, hotels and hospitality venues across the country';

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
  const ctaPrimaryText = ctaSection?.ctaText || ctaSection?.cta_text || "Request a Quote";
  const ctaPrimaryLinkRaw = ctaSection?.ctaLink || ctaSection?.cta_link || "/quote-request";
  const ctaSecondaryText = ctaSection?.secondaryCtaText || ctaSection?.secondary_cta_text || "Find a Rep";
  const ctaSecondaryLinkRaw = ctaSection?.secondaryCtaLink || ctaSection?.secondary_cta_link || "/find-a-rep";
  // CMS links only render when they pass the URL policy
  const ctaPrimaryLink = safeHref(ctaPrimaryLinkRaw, '/quote-request');
  const ctaSecondaryLink = safeHref(ctaSecondaryLinkRaw, '/find-a-rep');

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

  // Preload only the first hero image (the LCP candidate), using the same
  // srcset/sizes HeroCarousel renders so the preload and the <img> share one
  // download. Later slides are mounted lazily by HeroCarousel.
  const preloadImages = useMemo(() => {
    if (!slides || slides.length === 0) return [];
    return slides.slice(0, 1)
      .map(slide => ensureResolvedImageUrl(slide.background_image_url || slide.image))
      .filter(Boolean)
      .map(href => ({ href, srcSet: getImageSrcSet(href) }));
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
          {preloadImages.map(({ href, srcSet }, idx) => (
            <link
              key={`preload-hero-${idx}`}
              rel="preload"
              as="image"
              href={href}
              {...(srcSet ? { imagesrcset: srcSet, imagesizes: '100vw' } : {})}
              fetchpriority="high"
            />
          ))}
        </Helmet>
      )}
      {/* Hero Carousel - extends to top, header floats above */}
      <section className="relative -mt-[var(--header-height)] h-screen h-[100dvh]">
        <HeroCarousel
          slides={slides}
          onUpdateSlide={handleUpdateHeroSlide}
          loading={heroLoading}
        />
      </section>


      {SHOW_CLIENT_LOGOS && (
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
            {isEditMode && (
              <Suspense fallback={null}>
                <EditModal
                  isOpen={isCreatingLogo}
                  onClose={() => setIsCreatingLogo(false)}
                  onSave={handleCreateClientLogo}
                  elementData={{ name: '', logo_url: '', display_order: 0 }}
                  elementType="client-logo"
                />
              </Suspense>
            )}

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
                    label={`Logo: ${client.name}`}
                    className={`flex-shrink-0 px-3 sm:px-6 md:px-8 mx-1 sm:mx-2 md:mx-4 ${isEditMode ? 'inline-block' : ''}`}
                  >
                    <div className="flex items-center justify-center h-12 sm:h-16 md:h-20 w-24 sm:w-32 md:w-40 relative group">
                      {client.logoUrl || client.logo ? (
                        <img
                          src={client.logoUrl || client.logo}
                          alt={client.name}
                          loading="lazy"
                          decoding="async"
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
                                  const { deleteClientLogo } = await loadCmsAdmin();
                                  const result = await deleteClientLogo(client.id);
                                  // exported:false already shows a warning toast
                                  if (!isPublishFailed(result)) {
                                    toast.success(`${client.name} deleted successfully`);
                                  }
                                } catch {
                                  toast.error('Failed to delete client logo');
                                }
                              }
                            });
                          }}
                          className="absolute top-0 right-0 p-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors z-30"
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
                          loading="lazy"
                          decoding="async"
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
                          loading="lazy"
                          decoding="async"
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
                          loading="lazy"
                          decoding="async"
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
                          loading="lazy"
                          decoding="async"
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
                          loading="lazy"
                          decoding="async"
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
                          loading="lazy"
                          decoding="async"
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
                          loading="lazy"
                          decoding="async"
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
          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12 px-4"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">Featured Products</h2>
            <p className="text-lg sm:text-xl text-slate-600">
              Explore our most popular commercial furniture solutions
            </p>
          </m.div>

        </div>

        {productsLoading ? (
          <div className="container">
            <CardGridSkeleton count={4} columns={4} />
          </div>
        ) : (
          <FeaturedProductsStrip products={products} onQuickView={setSelectedQuickView} />
        )}

        <div className="container">
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
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12 px-4"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">Our Products</h2>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">Explore our commercial seating categories</p>
        </m.div>

        {categoriesLoading ? (
          <div className="w-full flex justify-center py-16">
            <div className="w-12 h-12 border-4 border-cream-300 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-full bg-cream-50">
            {/* The column count is set inline so all tiles stay on one row -
                a Tailwind class can't be built from a runtime value. */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--tile-columns),minmax(0,1fr))] gap-0"
              style={{ '--tile-columns': categoryColumnCount }}
            >
              {featuredCategories.map((category) => {
                const subcategories = subcategoriesByCategory[category.id] || [];
                return (
                  <CategoryTile
                    key={category.id}
                    title={category.name}
                    href={`/products/category/${category.slug}`}
                    imageUrl={resolveImageUrl(category.banner_image_url || category.bannerImage || DEFAULT_BANNER)}
                    fallbackImage={DEFAULT_BANNER}
                    columns={categoryColumnCount}
                    heightClassName="h-[520px] sm:h-[500px] md:h-[550px] lg:h-[600px]"
                    backgroundClassName="bg-slate-100"
                    links={subcategories.slice(0, 5).map((subcat) => ({
                      key: `${subcat.type || 'subcategory'}-${subcat.id}`,
                      label: subcat.name,
                      to: `/products/category/${category.slug}/${subcat.slug}`,
                    }))}
                    viewAllLabel={`View All ${category.name}`}
                  />
                );
              })}

              {overflowCategories.length > 0 && (
                <CategoryTile
                  title="More Categories"
                  href="/products"
                  imageUrl={DEFAULT_BANNER}
                  fallbackImage={DEFAULT_BANNER}
                  columns={categoryColumnCount}
                  heightClassName="h-[520px] sm:h-[500px] md:h-[550px] lg:h-[600px]"
                  backgroundClassName="bg-slate-100"
                  links={overflowCategories.map((category) => ({
                    key: `category-${category.id}`,
                    label: category.name,
                    to: `/products/category/${category.slug}`,
                  }))}
                  viewAllLabel="View All Products"
                />
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
            label="Installation Gallery Title"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">{installationGalleryTitle}</h2>
          </EditableWrapper>
          <EditableWrapper
            id="home-installation-gallery-subtitle"
            type="textarea"
            data={{ content: installationGallerySubtitle }}
            onSave={(newData) => handleSaveContent('home', 'installation_gallery', { ...installationGallerySection, ...newData })}
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
                    <ResponsiveImage
                      src={resolveImageUrl(imgUrl)}
                      sizes="(min-width: 1536px) 60vw, (min-width: 1280px) 70vw, (min-width: 1024px) 75vw, (min-width: 768px) 85vw, 100vw"
                      alt={`Installation ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg md:rounded-xl shadow-2xl img-sharp"
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

      {/* Testimonials - hidden from visitors while there are none */}
      {(isEditMode || testimonialList.length > 0) && (
        <section className="py-12 sm:py-16 md:py-20 bg-cream-50 border-t border-cream-200">
          <div className="container">
            <div className="text-center mb-8 sm:mb-12 px-4">
              <EditableWrapper
                id="home-testimonials-title"
                type="text"
                data={{ title: testimonialsTitle }}
                onSave={(newData) => handleSaveContent('home', 'testimonials', { ...testimonialsSection, ...newData })}
                label="Testimonials Title"
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-slate-800">{testimonialsTitle}</h2>
              </EditableWrapper>
              <EditableWrapper
                id="home-testimonials-subtitle"
                type="textarea"
                data={{ content: testimonialsSubtitle }}
                onSave={(newData) => handleSaveContent('home', 'testimonials', { ...testimonialsSection, ...newData })}
                label="Testimonials Subtitle"
              >
                <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">{testimonialsSubtitle}</p>
              </EditableWrapper>
            </div>

            <EditableList
              items={testimonialList}
              onUpdate={handleUpdateTestimonial}
              onCreate={handleCreateTestimonial}
              onDelete={handleDeleteTestimonial}
              itemType="testimonial"
              addButtonText="Add Testimonial"
              defaultNewItem={{ displayOrder: testimonialList.length }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 px-4 sm:px-0"
              renderItem={(testimonial, index) => (
                <m.figure
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="h-full flex flex-col bg-white rounded-xl border border-cream-200 shadow-sm p-6 sm:p-8"
                >
                  <svg className="w-8 h-8 text-primary-500/60 mb-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" />
                  </svg>
                  <blockquote className="flex-1 text-slate-700 text-base sm:text-lg leading-relaxed whitespace-pre-line">
                    {testimonial.quote}
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-4">
                    {testimonial.photoUrl && (
                      <img
                        src={resolveImageUrl(testimonial.photoUrl)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-full object-cover bg-cream-100 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">{testimonial.authorName}</div>
                      {(testimonial.authorTitle || testimonial.companyName) && (
                        <div className="text-sm text-slate-600">
                          {[testimonial.authorTitle, testimonial.companyName].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {testimonial.location && (
                        <div className="text-sm text-slate-500">{testimonial.location}</div>
                      )}
                    </div>
                  </figcaption>
                </m.figure>
              )}
            />
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-cream-50 border-t-2 border-primary-500/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center px-4">
            <EditableWrapper
              id="home-cta-title"
              type="text"
              data={{ title: ctaTitle }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
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
                cta_link: ctaPrimaryLinkRaw,
                secondary_cta_text: ctaSecondaryText,
                secondary_cta_link: ctaSecondaryLinkRaw
              }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
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


