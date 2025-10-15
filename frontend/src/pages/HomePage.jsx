import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Slider from 'react-slick';
import Button from '../components/ui/Button';
import ProductCard from '../components/ui/ProductCard';
import { demoProducts, demoClients } from '../data/demoData';

const HomePage = () => {
  const [selectedQuickView, setSelectedQuickView] = useState(null);

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

  const heroSlides = [
    {
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920',
      title: 'Have a Seat',
      subtitle: 'Premium Commercial Furniture for Restaurants & Hospitality',
      cta: 'Explore Products',
      ctaLink: '/products'
    },
    {
      image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920',
      title: 'Crafted with Excellence',
      subtitle: 'Family-Owned. American-Made. Built to Last.',
      cta: 'Our Story',
      ctaLink: '/about'
    },
    {
      image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=1920',
      title: 'Indoor & Outdoor Solutions',
      subtitle: 'Complete furniture solutions for every commercial space',
      cta: 'View Gallery',
      ctaLink: '/gallery'
    },
  ];

  const featuredProducts = demoProducts.filter(p => p.featured).slice(0, 4);

  return (
    <div className="min-h-screen">
      {/* Hero Slider */}
      <section className="relative">
        <Slider {...heroSettings}>
          {heroSlides.map((slide, index) => (
            <div key={index} className="relative">
              <div className="relative h-[600px] lg:h-[700px]">
                <img
                  src={slide.image}
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
                      <Link to={slide.ctaLink}>
                        <Button size="lg" variant="primary">
                          {slide.cta}
                        </Button>
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </section>

      {/* About Section */}
      <section className="py-20 bg-dark-800">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold mb-6 text-dark-50">
                Family-Owned Since 1984
              </h2>
              <p className="text-lg text-dark-100 mb-4">
                Founded in Houston, Texas by the Yuglich Family, Eagle Chair has been a trusted name in commercial 
                furniture manufacturing. Under the leadership of Katarina Kac-Statton and Maximilian Kac, our 
                commitment to quality craftsmanship and customer satisfaction has made us a preferred partner 
                for restaurants, hotels, and hospitality businesses nationwide.
              </p>
              <p className="text-lg text-dark-100 mb-6">
                Every piece of furniture we create is built to withstand the rigors of commercial use while 
                maintaining the beauty and comfort your guests expect.
              </p>
              <div className="flex gap-4">
                <Link to="/about">
                  <Button variant="primary">Learn More</Button>
                </Link>
                <a href="/downloads/catalog-2024.pdf" download>
                  <Button variant="outline">Download Catalog</Button>
                </a>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <img
                src="https://images.unsplash.com/photo-1565891741441-64926e441838?w=800"
                alt="Eagle Chair Workshop"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-primary-700 border-2 border-primary-500 text-white p-6 rounded-xl shadow-xl">
                <div className="text-4xl font-bold">Since 1984</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trusted By - Infinite Scrolling Logos */}
      <section className="py-16 bg-dark-800 overflow-hidden border-t border-dark-600">
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
                {[...demoClients, ...demoClients].map((client, index) => (
                  <div key={`${client.id}-${index}`} className="flex-shrink-0 px-8 mx-4">
                    <div className="flex items-center justify-center h-20 w-40">
                      {client.logo ? (
                        <img
                          src={client.logo}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product, index) => (
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

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'American Made',
                description: 'All our furniture is manufactured in the USA with premium materials and superior craftsmanship.'
              },
              {
                title: 'Commercial Grade',
                description: 'Built to withstand heavy daily use in the most demanding commercial environments.'
              },
              {
                title: 'Custom Options',
                description: 'Extensive customization options including finishes, fabrics, and sizes to match your vision.'
              },
              {
                title: 'Quick Turnaround',
                description: 'Fast production and shipping to get your furniture delivered when you need it.'
              },
              {
                title: 'Warranty Backed',
                description: 'Comprehensive warranty coverage because we stand behind the quality of our products.'
              },
              {
                title: 'Expert Support',
                description: 'Dedicated sales representatives to help you choose the perfect furniture for your space.'
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
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
            ))}
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 bg-dark-900 border-t-2 border-primary-500/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6 text-dark-50">
              Ready to Furnish Your Space?
            </h2>
            <p className="text-xl mb-8 text-dark-100">
              Get a custom quote for your restaurant or hospitality project. 
              Our team is ready to help you create the perfect atmosphere.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/quote-request">
                <button className="px-8 py-3 bg-primary-600 text-dark-900 rounded-lg font-semibold hover:bg-primary-500 transition-colors shadow-lg hover:shadow-primary-500/50">
                  Request a Quote
                </button>
              </Link>
              <Link to="/find-a-rep">
                <button className="px-8 py-3 border-2 border-primary-500 text-primary-500 rounded-lg font-semibold hover:bg-primary-500/10 transition-colors">
                  Find a Rep
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;


