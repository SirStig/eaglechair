import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Modal from '../components/ui/Modal';
import EditableWrapper from '../components/admin/EditableWrapper';
import EditableList from '../components/admin/EditableList';
import { useInstallations } from '../hooks/useContent';
import { 
  updateInstallation, 
  createInstallation, 
  deleteInstallation 
} from '../services/contentService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const CONTEXT = 'GalleryPage';

const GalleryPage = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [filter, setFilter] = useState('all');
  const { data: installations, loading, refetch } = useInstallations();

  // Use API data
  const images = installations || [];

  const categories = ['all', ...new Set(images.map(img => img.category || img.projectType || img.project_type).filter(Boolean))];
  
  const filteredImages = filter === 'all' 
    ? images 
    : images.filter(img => (img.category || img.projectType || img.project_type) === filter);

  // Handlers for CRUD operations
  const handleUpdateInstallation = async (id, updates) => {
    try {
      logger.info(CONTEXT, `Updating installation ${id}`);
      
      // Sync primary_image with images array if primary_image changed
      const dataToSend = { ...updates };
      if (updates.primary_image && (!updates.images || updates.images.length === 0)) {
        dataToSend.images = [updates.primary_image];
      }
      
      await updateInstallation(id, dataToSend);
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
      
      await createInstallation(dataToSend);
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

  const handleReorderInstallations = async (reorderedItems) => {
    try {
      logger.info(CONTEXT, 'Reordering gallery installations');
      // Update the order property for each item
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        order: index
      }));
      
      // Update each item individually with the new order
      for (const item of updatedItems) {
        await updateInstallation(item.id, { order: item.order });
      }
      
      refetch();
      logger.info(CONTEXT, 'Gallery installations reordered successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to reorder installations', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-[1800px]">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-dark-50">Gallery</h1>
          <p className="text-base sm:text-lg text-dark-100 max-w-2xl mx-auto px-4">
            Explore our furniture in real commercial settings. See how Eagle Chair products 
            transform restaurants, hotels, and hospitality spaces.
          </p>
        </div>

        {/* Filter Tabs */}
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
              const imageUrl = image.url || image.primary_image || image.primaryImage || 
                (image.images && (typeof image.images === 'string' ? JSON.parse(image.images)[0] : image.images[0]));
              const title = image.title || image.project_name || image.projectName;
              const category = image.category || image.project_type || image.projectType;
              const location = image.location;
              
              return (
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
                    loading={index < 6 ? "eager" : "lazy"}
                    decoding="async"
                    fetchpriority={index < 3 ? "high" : index < 6 ? "auto" : "low"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <h3 className="text-xl font-semibold mb-1 text-dark-50">{title}</h3>
                      <p className="text-sm text-dark-100">{category}</p>
                      {location && <p className="text-xs text-dark-200">{location}</p>}
                    </div>
                  </div>
                </motion.div>
              );
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          />
        )}

        {/* Image Modal */}
        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          size="lg"
          title={selectedImage?.title}
        >
          {selectedImage && (
            <div className="max-h-[70vh] overflow-auto">
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
              />
              <div className="mt-4 space-y-2">
                <p className="text-dark-100 font-medium">{selectedImage.category}</p>
                {selectedImage.location && (
                  <p className="text-dark-200 text-sm">{selectedImage.location}</p>
                )}
                {selectedImage.description && (
                  <p className="text-dark-300 text-sm">{selectedImage.description}</p>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* CTA Section */}
        <div className="mt-12 sm:mt-16 bg-dark-900 border border-dark-600 rounded-2xl p-6 sm:p-8 lg:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-dark-50">
            Ready to Transform Your Space?
          </h2>
          <p className="text-lg sm:text-xl mb-4 sm:mb-6 max-w-2xl mx-auto text-dark-100 px-4">
            Let us help you create a stunning commercial environment with our premium furniture.
          </p>
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


