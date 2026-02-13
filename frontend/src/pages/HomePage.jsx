import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Slider from 'react-slick';
import Button from '../components/ui/Button';
import ProductCard from '../components/ui/ProductCard';
import { HeroSkeleton, CardGridSkeleton } from '../components/ui/Skeleton';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableList from '../components/admin/EditableList';
import EditModal from '../components/admin/EditModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import SEOHead from '../components/SEOHead';
import { useEditMode } from '../contexts/useEditMode';
import { useToast } from '../contexts/ToastContext';
import { useHeroSlides, useFeatures, useClientLogos, useFeaturedProducts, usePageContent, useSiteSettings } from '../hooks/useContent';
import {
  updatePageContent,
  updateHeroSlide,
  updateFeature,
  updateClientLogo,
  createHeroSlide,
  createFeature,
  createClientLogo,
  deleteHeroSlide,
  deleteFeature,
  deleteClientLogo
} from '../services/contentService';
import logger from '../utils/logger';
import { invalidateCache } from '../utils/cache';

const CONTEXT = 'HomePage';

const HomePage = () => {
  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [isCreatingLogo, setIsCreatingLogo] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  const { isEditMode } = useEditMode();
  const toast = useToast();

  const { data: heroSlides, loading: heroLoading, refetch: refetchHero } = useHeroSlides();
  const { data: whyChooseUs, refetch: refetchFeatures } = useFeatures('home_page');
  const { data: clientLogos, refetch: refetchLogos } = useClientLogos();
  const { data: featuredProducts, loading: productsLoading } = useFeaturedProducts(4);
  const { data: ctaSection, refetch: refetchCta } = usePageContent('home', 'cta');

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
      if (pageSlug === 'home' && sectionKey === 'cta') {
        refetchCta();
      }
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

  // Features Handlers
  const handleUpdateFeature = async (id, updates) => {
    await updateFeature(id, updates);
    invalidateCache('features-*');
    refetchFeatures();
  };

  const handleCreateFeature = async (newData) => {
    await createFeature({ ...newData, feature_type: 'home_page' });
    invalidateCache('features-*');
    refetchFeatures();
  };

  const handleDeleteFeature = async (id) => {
    await deleteFeature(id);
    invalidateCache('features-*');
    refetchFeatures();
  };

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

  // Hero Slider Settings - Safari compatible
  const heroSettings = {
    dots: false,
    infinite: true,
    speed: 1000,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    fade: true,
    arrows: false,
    pauseOnHover: false,
    pauseOnFocus: false,
    swipe: true,
    touchMove: true,
    // Safari-specific fixes
    cssEase: 'ease-in-out',
    useCSS: true,
    useTransform: true,
    adaptiveHeight: false,
    // Enable on-demand loading
    lazyLoad: 'ondemand',
  };



  // Use API data, fallback to empty array
  const slides = useMemo(() => heroSlides || [], [heroSlides]);
  const features = useMemo(() => whyChooseUs || [], [whyChooseUs]);
  const clients = clientLogos || [];

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
      {/* Hero Slider */}
      <section className="relative">
        {heroLoading ? (
          <HeroSkeleton />
        ) : (
          <div>
            {/* Wrapper to contain the entire slider with editable capabilities */}
            <Slider {...heroSettings}>
              {slides.map((slide, index) => (
                <div key={slide.id || index} className="relative">
                  <EditableWrapper
                    id={`hero-slide-${slide.id || index}`}
                    type="hero-slide"
                    data={slide}
                    onSave={(newData) => handleUpdateHeroSlide(slide.id, newData)}
                    refetch={refetchHero}
                    cacheKey="hero-slides"
                    label={`Slide ${index + 1}`}
                  >
                    <div className="relative h-[calc(100vh-72px)] sm:h-[calc(100vh-88px)] md:h-[calc(100vh-96px)] lg:h-[calc(100vh-80px)] min-h-[400px] sm:min-h-[500px]">
                      <img
                        key={`hero-${slide.id || index}-${slide.background_image_url || slide.image}`}
                        src={slide.background_image_url || slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                        fetchpriority={index === 0 ? "high" : "auto"}
                        style={{
                          WebkitTransform: 'translateZ(0)',
                          transform: 'translateZ(0)',
                          willChange: 'transform'
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />

                      <div className="absolute inset-0 flex items-center">
                        <div className="container">
                          <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.8 }}
                            className="max-w-2xl text-white px-2 sm:px-0"
                          >
                            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
                              {slide.title}
                            </h1>
                            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl mb-6 sm:mb-8 text-gray-200 leading-relaxed">
                              {slide.subtitle}
                            </p>
                            <Link to={slide.cta_link || slide.ctaLink}>
                              <Button size="md" variant="primary" className="w-full sm:w-auto px-8 py-3">
                                {slide.cta_text || slide.ctaText || slide.cta}
                              </Button>
                            </Link>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </EditableWrapper>
                </div>
              ))}
            </Slider>
          </div>
        )}
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
      <section className="py-12 sm:py-16 md:py-20 bg-cream-50">
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

      {/* Why Choose Us */}
      <section className="py-12 sm:py-16 md:py-20 bg-dark-800">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12 px-4"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-dark-50">Why Choose Eagle Chair?</h2>
          </motion.div>

          <EditableList
            id="features-list"
            items={features}
            onUpdate={handleUpdateFeature}
            onCreate={handleCreateFeature}
            onDelete={handleDeleteFeature}
            refetch={refetchFeatures}
            cacheKey="features-home_page"
            itemType="feature"
            label="Features"
            addButtonText="Add Feature"
            defaultNewItem={{
              title: 'New Feature',
              description: 'Feature description',
              feature_type: 'home_page',
              icon: '',
              display_order: features.length
            }}
            renderItem={(feature, index) => (
              <motion.div
                key={feature.id || index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="h-full flex flex-col bg-dark-600 border border-dark-500 rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
              >
                {/* Feature Image or Icon */}
                {feature.image_url || feature.imageUrl ? (
                  <div className="w-full h-48 overflow-hidden flex-shrink-0">
                    <img
                      src={feature.image_url || feature.imageUrl}
                      alt={feature.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                    />
                  </div>
                ) : (
                  <div className="w-full h-12 flex justify-center items-center mt-6 flex-shrink-0">
                    <div className="w-12 h-12 bg-primary-900 border-2 border-primary-500 rounded-lg flex items-center justify-center">
                      {feature.icon ? (
                        <span className="text-2xl">{feature.icon}</span>
                      ) : (
                        <div className="w-6 h-6 bg-primary-500 rounded"></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Feature Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-semibold mb-2 text-dark-50">{feature.title}</h3>
                  <p className="text-dark-100 flex-1">{feature.description}</p>
                </div>
              </motion.div>
            )}
            className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 px-4 sm:px-0"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-dark-900 border-t-2 border-primary-500/30">
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-dark-50">
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
              <p className="text-lg sm:text-xl mb-6 sm:mb-8 text-dark-100 leading-relaxed">
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
                  <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 border-2 border-primary-500 text-primary-500 rounded-lg font-semibold hover:bg-primary-500/10 transition-colors min-h-[48px] text-center">
                    {ctaSecondaryText}
                  </button>
                </Link>
              </div>
            </EditableWrapper>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
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


