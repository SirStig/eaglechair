import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Slider from 'react-slick';
import Button from '../components/ui/Button';
import ProductCard from '../components/ui/ProductCard';
import Card from '../components/ui/Card';
import { HeroSkeleton, ContentSkeleton, CardGridSkeleton } from '../components/ui/Skeleton';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableList from '../components/admin/EditableList';
import { demoHomeContent } from '../data/demoData';
import { useHeroSlides, useFeatures, useClientLogos, useFeaturedProducts, usePageContent } from '../hooks/useContent';
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

const CONTEXT = 'HomePage';

const HomePage = () => {
  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [showFullContent, setShowFullContent] = useState(false);
  
  const { data: heroSlides, loading: heroLoading, refetch: refetchHero } = useHeroSlides();
  const { data: whyChooseUs, loading: featuresLoading, refetch: refetchFeatures } = useFeatures('home_page');
  const { data: clientLogos, loading: logosLoading, refetch: refetchLogos } = useClientLogos();
  const { data: featuredProducts, loading: productsLoading } = useFeaturedProducts(4);
  const { data: ctaSection, loading: ctaLoading, refetch: refetchCta } = usePageContent('home', 'cta');

  // Progressive loading - show full content after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFullContent(true);
    }, 2000); // Show full content after 2 seconds
    
    return () => clearTimeout(timer);
  }, []);

  // Handler for saving content updates
  const handleSaveContent = async (pageSlug, sectionKey, newData) => {
    try {
      logger.info(CONTEXT, `Saving content for ${pageSlug}/${sectionKey}`, newData);
      await updatePageContent(pageSlug, sectionKey, newData);
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
    refetchHero();
  };

  const handleCreateHeroSlide = async (newData) => {
    await createHeroSlide(newData);
    refetchHero();
  };

  const handleDeleteHeroSlide = async (id) => {
    await deleteHeroSlide(id);
    refetchHero();
  };

  // Features Handlers
  const handleUpdateFeature = async (id, updates) => {
    await updateFeature(id, updates);
    refetchFeatures();
  };

  const handleCreateFeature = async (newData) => {
    await createFeature({ ...newData, feature_type: 'home_page' });
    refetchFeatures();
  };

  const handleDeleteFeature = async (id) => {
    await deleteFeature(id);
    refetchFeatures();
  };

  // Client Logos Handlers
  const handleUpdateClientLogo = async (id, updates) => {
    await updateClientLogo(id, updates);
    refetchLogos();
  };

  const handleCreateClientLogo = async (newData) => {
    await createClientLogo(newData);
    refetchLogos();
  };

  const handleDeleteClientLogo = async (id) => {
    await deleteClientLogo(id);
    refetchLogos();
  };

  // Hero Slider Settings
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
  };

  // Client Logos Slider Settings
  const clientSettings = {
    dots: false,
    infinite: true,
    speed: 3000,
    slidesToShow: 5,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 0,
    cssEase: 'linear',
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: { slidesToShow: 4 }
      },
      {
        breakpoint: 768,
        settings: { slidesToShow: 3 }
      },
      {
        breakpoint: 480,
        settings: { slidesToShow: 2 }
      }
    ]
  };

  // Use API data or fallback to demo
  const slides = heroSlides || demoHomeContent.heroSlides;
  const features = whyChooseUs || demoHomeContent.whyChooseUs;
  const clients = clientLogos || [];
  const products = featuredProducts || [];
  
  // CTA section content
  const ctaTitle = ctaSection?.title || "Ready to Furnish Your Space?";
  const ctaContent = ctaSection?.content || "Get a custom quote for your restaurant or hospitality project. Our team is ready to help you create the perfect atmosphere.";
  const ctaPrimaryText = ctaSection?.cta_text || "Request a Quote";
  const ctaPrimaryLink = ctaSection?.cta_link || "/quote-request";
  const ctaSecondaryText = ctaSection?.secondary_cta_text || "Find a Rep";
  const ctaSecondaryLink = ctaSection?.secondary_cta_link || "/find-a-rep";

  return (
    <div className="min-h-screen">
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
                    label={`Slide ${index + 1}`}
                  >
                    <div className="relative h-[70vh] sm:h-[75vh] md:h-[80vh] lg:h-[85vh]">
                      <img
                        src={slide.background_image_url || slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover"
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


      {/* Trusted By - Infinite Scrolling Logos */}
      <section className="py-8 sm:py-12 md:py-16 bg-dark-800 overflow-hidden">
        <div className="container">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-8 sm:mb-12 text-dark-50 px-4">
            Trusted by Leading Hospitality Brands
          </h2>
          
          <EditableList
            id="client-logos-list"
            items={clients}
            onUpdate={handleUpdateClientLogo}
            onCreate={handleCreateClientLogo}
            onDelete={(id) => deleteClientLogo(id).then(() => refetchLogos())}
            itemType="client-logo"
            label="Client Logos"
            addButtonText="Add Client"
            defaultNewItem={{
              name: 'New Client',
              logo: '',
              logoUrl: ''
            }}
            renderItem={(client) => (
              <div className="flex-shrink-0 px-4 sm:px-8 mx-2 sm:mx-4">
                <div className="flex items-center justify-center h-16 sm:h-20 w-32 sm:w-40">
                  {client.logoUrl || client.logo ? (
                    <img
                      src={client.logoUrl || client.logo}
                      alt={client.name}
                      className="max-h-full max-w-full object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    />
                  ) : (
                    <div className="text-base font-semibold text-dark-200 text-center">
                      {client.name}
                    </div>
                  )}
                </div>
              </div>
            )}
            className="relative max-w-5xl mx-auto"
          >
            {/* Centered container with fading edges */}
            <div className="relative max-w-5xl mx-auto">
              {/* Left fade */}
              <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-dark-800 to-transparent z-10 pointer-events-none"></div>
              
              {/* Right fade */}
              <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-dark-800 to-transparent z-10 pointer-events-none"></div>
              
              {/* Scrolling container */}
              <div className="overflow-hidden">
                <div className="flex animate-scroll-infinite" style={{ width: '200%' }}>
                  {/* First set of logos */}
                  {clients.length > 0 && clients.map((client, index) => (
                    <div key={`first-${client.id}-${index}`} className="flex-shrink-0 px-4 sm:px-8 mx-2 sm:mx-4">
                      <div className="flex items-center justify-center h-16 sm:h-20 w-32 sm:w-40">
                        {client.logoUrl || client.logo ? (
                          <img
                            src={client.logoUrl || client.logo}
                            alt={client.name}
                            className="max-h-full max-w-full object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                          />
                        ) : (
                          <div className="text-base font-semibold text-dark-200 text-center">
                            {client.name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Second set of logos (exact duplicate) */}
                  {clients.length > 0 && clients.map((client, index) => (
                    <div key={`second-${client.id}-${index}`} className="flex-shrink-0 px-4 sm:px-8 mx-2 sm:mx-4">
                      <div className="flex items-center justify-center h-16 sm:h-20 w-32 sm:w-40">
                        {client.logoUrl || client.logo ? (
                          <img
                            src={client.logoUrl || client.logo}
                            alt={client.name}
                            className="max-h-full max-w-full object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
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
          </EditableList>
        </div>
      </section>

      {/* Featured Products */}
      {showFullContent && (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 md:gap-10 px-4 sm:px-0">
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
      )}

      {/* Why Choose Us */}
      {showFullContent && (
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
                className="bg-dark-600 border border-dark-500 rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
              >
                {/* Feature Image or Icon */}
                {feature.image_url || feature.imageUrl ? (
                  <div className="w-full h-48 overflow-hidden">
                    <img 
                      src={feature.image_url || feature.imageUrl} 
                      alt={feature.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-12 flex justify-center items-center mt-6">
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
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2 text-dark-50">{feature.title}</h3>
                  <p className="text-dark-100">{feature.description}</p>
                </div>
              </motion.div>
            )}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 px-4 sm:px-0"
          />
        </div>
      </section>
      )}

      {/* CTA Section */}
      {showFullContent && (
        <section className="py-12 sm:py-16 md:py-20 bg-dark-900 border-t-2 border-primary-500/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center px-4">
            <EditableWrapper
              id="home-cta-title"
              type="text"
              data={{ title: ctaTitle }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
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
      )}
    </div>
  );
};

export default HomePage;


