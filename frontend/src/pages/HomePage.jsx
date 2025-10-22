import { useState } from 'react';
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
  const { data: heroSlides, loading: heroLoading, refetch: refetchHero } = useHeroSlides();
  const { data: whyChooseUs, loading: featuresLoading, refetch: refetchFeatures } = useFeatures('home_page');
  const { data: clientLogos, loading: logosLoading, refetch: refetchLogos } = useClientLogos();
  const { data: featuredProducts, loading: productsLoading } = useFeaturedProducts(4);
  const { data: ctaSection, loading: ctaLoading, refetch: refetchCta } = usePageContent('home', 'cta');

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
    dots: true,
    infinite: true,
    speed: 1000,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    fade: true,
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
                    <div className="relative h-[600px] lg:h-[700px]">
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
                            className="max-w-2xl text-white"
                          >
                            <h1 className="text-5xl lg:text-7xl font-bold mb-4">
                              {slide.title}
                            </h1>
                            <p className="text-xl lg:text-2xl mb-8 text-gray-200">
                              {slide.subtitle}
                            </p>
                            <Link to={slide.cta_link || slide.ctaLink}>
                              <Button size="lg" variant="primary">
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
      <section className="py-16 bg-dark-800 overflow-hidden">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12 text-dark-50">
            Trusted by Leading Hospitality Brands
          </h2>
          
          {/* Centered container with fading edges */}
          <div className="relative max-w-5xl mx-auto">
            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-dark-800 to-transparent z-10 pointer-events-none"></div>
            
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-dark-800 to-transparent z-10 pointer-events-none"></div>
            
            {/* Scrolling container */}
            <div className="overflow-hidden">
              <div className="flex animate-scroll-infinite">
                {/* Double the array for seamless infinite scroll - when first set finishes, second set is identical */}
                {clients.length > 0 && [...clients, ...clients].map((client, index) => (
                  <div key={`${client.id}-${index}`} className="flex-shrink-0 px-8 mx-4">
                    <div className="flex items-center justify-center h-20 w-40">
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
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-dark-700">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4 text-dark-50">Featured Products</h2>
            <p className="text-xl text-dark-100">
              Explore our most popular commercial furniture solutions
            </p>
          </motion.div>

          {productsLoading ? (
            <CardGridSkeleton count={4} columns={4} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  />
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link to="/products">
              <Button variant="primary" size="lg">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-dark-800">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4 text-dark-50">Why Choose Eagle Chair?</h2>
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
                className="bg-dark-600 border border-dark-500 p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-900 border-2 border-primary-500 rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-primary-500 rounded"></div>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-dark-50">{feature.title}</h3>
                <p className="text-dark-100">{feature.description}</p>
              </motion.div>
            )}
            className="grid md:grid-cols-3 gap-8"
          />
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 bg-dark-900 border-t-2 border-primary-500/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <EditableWrapper
              id="home-cta-title"
              type="text"
              data={{ title: ctaTitle }}
              onSave={(newData) => handleSaveContent('home', 'cta', { ...ctaSection, ...newData })}
              label="CTA Title"
            >
              <h2 className="text-4xl font-bold mb-6 text-dark-50">
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
              <p className="text-xl mb-8 text-dark-100">
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
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to={ctaPrimaryLink}>
                  <button className="px-8 py-3 bg-primary-600 text-dark-900 rounded-lg font-semibold hover:bg-primary-500 transition-colors shadow-lg hover:shadow-primary-500/50">
                    {ctaPrimaryText}
                  </button>
                </Link>
                <Link to={ctaSecondaryLink}>
                  <button className="px-8 py-3 border-2 border-primary-500 text-primary-500 rounded-lg font-semibold hover:bg-primary-500/10 transition-colors">
                    {ctaSecondaryText}
                  </button>
                </Link>
              </div>
            </EditableWrapper>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;


