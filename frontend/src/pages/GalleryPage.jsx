import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../components/ui/Modal';
import { demoGalleryImages, IS_DEMO } from '../data/demoData';

const GalleryPage = () => {
  const [images, setImages] = useState(demoGalleryImages);
  const [selectedImage, setSelectedImage] = useState(null);
  const [filter, setFilter] = useState('all');

  const categories = ['all', ...new Set(images.map(img => img.category))];
  
  const filteredImages = filter === 'all' 
    ? images 
    : images.filter(img => img.category === filter);

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-dark-50">Gallery</h1>
          <p className="text-lg text-dark-100 max-w-2xl mx-auto">
            Explore our furniture in real commercial settings. See how Eagle Chair products 
            transform restaurants, hotels, and hospitality spaces.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                filter === category
                  ? 'bg-primary-500 text-dark-900'
                  : 'bg-dark-600 text-dark-50 hover:bg-dark-700 border border-dark-500'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImages.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative group cursor-pointer aspect-square overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-shadow"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={image.url}
                alt={image.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-1 text-dark-50">{image.title}</h3>
                  <p className="text-sm text-dark-100">{image.category}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Image Modal */}
        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          size="xl"
          title={selectedImage?.title}
        >
          {selectedImage && (
            <div>
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="w-full rounded-lg"
              />
              <p className="mt-4 text-dark-100">{selectedImage.category}</p>
            </div>
          )}
        </Modal>

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-r from-primary-700 to-primary-500 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Space?
          </h2>
          <p className="text-xl mb-6 max-w-2xl mx-auto">
            Let us help you create a stunning commercial environment with our premium furniture.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/quote-request">
              <button className="px-8 py-3 bg-dark-900 text-primary-500 rounded-lg font-semibold hover:bg-dark-800 transition-colors border-2 border-primary-500">
                Request a Quote
              </button>
            </a>
            <a href="/products">
              <button className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors">
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


