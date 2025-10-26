import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../components/ui/Modal';
import EditableWrapper from '../components/admin/EditableWrapper';
import { useInstallations } from '../hooks/useContent';
import { 
  updateInstallation, 
  createInstallation, 
  deleteInstallation 
} from '../services/contentService';
import { demoGalleryImages } from '../data/demoData';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const CONTEXT = 'GalleryPage';

const GalleryPage = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [filter, setFilter] = useState('all');
  const { data: installations, loading, refetch } = useInstallations();

  // Use API data or fallback to demo
  const images = installations || demoGalleryImages;

  const categories = ['all', ...new Set(images.map(img => img.category || img.projectType || img.project_type))];
  
  const filteredImages = filter === 'all' 
    ? images 
    : images.filter(img => (img.category || img.projectType || img.project_type) === filter);

  // Handlers for CRUD operations
  const handleUpdateInstallation = async (id, updates) => {
    try {
      logger.info(CONTEXT, `Updating installation ${id}`);
      await updateInstallation(id, updates);
      refetch();
      logger.info(CONTEXT, 'Installation updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update installation', error);
      throw error;
    }
  };

  const handleCreateInstallation = async (newData) => {
    try {
      logger.info(CONTEXT, 'Creating new installation');
      await createInstallation(newData);
      refetch();
      logger.info(CONTEXT, 'Installation created successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to create installation', error);
      throw error;
    }
  };

  const handleDeleteInstallation = async (id) => {
    try {
      logger.info(CONTEXT, `Deleting installation ${id}`);
      await deleteInstallation(id);
      refetch();
      logger.info(CONTEXT, 'Installation deleted successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to delete installation', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-[1800px]">
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
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImages.map((image, index) => {
              const imageUrl = image.url || image.primary_image || image.primaryImage || (image.images && (typeof image.images === 'string' ? JSON.parse(image.images)[0] : image.images[0]));
              const title = image.title || image.project_name || image.projectName;
              const category = image.category || image.project_type || image.projectType;
              const description = image.description;
              const location = image.location;
              
              return (
                <EditableWrapper
                  key={image.id}
                  id={`installation-${image.id}`}
                  type="installation"
                  data={image}
                  onSave={(newData) => handleUpdateInstallation(image.id, newData)}
                  label={`Installation: ${title}`}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative group cursor-pointer overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-shadow"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      style={{ aspectRatio: '16/10', objectFit: 'cover' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <h3 className="text-xl font-semibold mb-1 text-dark-50">{title}</h3>
                        <p className="text-sm text-dark-100">{category}</p>
                        {location && <p className="text-xs text-dark-200">{location}</p>}
                      </div>
                    </div>
                  </motion.div>
                </EditableWrapper>
              );
            })}
          </div>
        )}

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
        <div className="mt-16 bg-dark-900 border border-dark-600 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-3xl font-bold mb-4 text-dark-50">
            Ready to Transform Your Space?
          </h2>
          <p className="text-xl mb-6 max-w-2xl mx-auto text-dark-100">
            Let us help you create a stunning commercial environment with our premium furniture.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/quote-request">
              <button className="w-full sm:w-auto px-8 py-3 bg-dark-900 text-primary-500 rounded-lg font-semibold hover:bg-dark-800 transition-colors border-2 border-primary-500">
                Request a Quote
              </button>
            </a>
            <a href="/products">
              <button className="w-full sm:w-auto px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/20 transition-colors">
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


