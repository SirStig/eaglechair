import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import productService from '../../services/productService';
import logger from '../../utils/logger';

const CONTEXT = 'MobileProductsMenu';

// Fallback image for categories without banner_image_url
const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1617104678098-de229db51175?w=400&h=300&fit=crop';

/**
 * Mobile Products Menu Component
 * Dynamically loads categories and subcategories from backend
 */
const MobileProductsMenu = ({ isOpen, onNavigate }) => {
  const [categories, setCategories] = useState([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategoriesAndSubcategories();
  }, []);

  const loadCategoriesAndSubcategories = async () => {
    try {
      setLoading(true);
      
      // Fetch all categories
      const categoriesData = await productService.getCategories();
      
      // Filter active categories and sort by display_order
      const activeCategories = (Array.isArray(categoriesData) ? categoriesData : [])
        .filter(cat => cat.is_active !== false)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      
      setCategories(activeCategories);
      
      // Fetch subcategories for each category
      const subcatPromises = activeCategories.map(async (cat) => {
        try {
          const subcats = await productService.getSubcategories({ category_id: cat.id });
          return {
            categoryId: cat.id,
            subcategories: (Array.isArray(subcats) ? subcats : [])
              .filter(sub => sub.is_active !== false)
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              .slice(0, 5) // Limit to 5 for mobile display
          };
        } catch (error) {
          logger.error(CONTEXT, `Error loading subcategories for category ${cat.id}`, error);
          return { categoryId: cat.id, subcategories: [] };
        }
      });
      
      const subcatResults = await Promise.all(subcatPromises);
      
      // Convert to object keyed by category ID
      const subcatMap = {};
      subcatResults.forEach(result => {
        subcatMap[result.categoryId] = result.subcategories;
      });
      
      setSubcategoriesByCategory(subcatMap);
      
      logger.info(CONTEXT, `Loaded ${activeCategories.length} categories with subcategories for mobile`);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading categories and subcategories', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden mt-3"
      >
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </Motion.div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden mt-3"
        >
          <div className="space-y-3">
            {categories.map((category) => {
              const subcategories = subcategoriesByCategory[category.id] || [];
              const bannerImage = category.banner_image_url || DEFAULT_BANNER;
              
              return (
                <div key={category.id} className="relative">
                  {/* Category Image Background */}
                  <div 
                    className="relative h-56 bg-cover bg-center overflow-hidden rounded-lg"
                    style={{ backgroundImage: `url(${bannerImage})` }}
                  >
                    {/* Dark Overlay */}
                    <div className="absolute inset-0 bg-black/60"></div>
                    
                    {/* Content Overlay */}
                    <div className="relative z-10 p-4 h-full flex flex-col">
                      {/* Category Title */}
                      <Link 
                        to={`/products/category/${category.slug}`}
                        onClick={onNavigate}
                        className="text-white font-bold text-lg mb-2 hover:text-primary-400 transition-colors"
                      >
                        {category.name}
                      </Link>
                      
                      {/* Subcategory Links */}
                      <div className="space-y-1 flex-1">
                        {subcategories.map((subcat) => (
                          <Link
                            key={subcat.id}
                            to={`/products/category/${category.slug}/${subcat.slug}`}
                            onClick={onNavigate}
                            className="block text-white/90 text-sm hover:text-primary-400 transition-colors"
                          >
                            {subcat.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* View All Products Button */}
            <div className="pt-2">
              <Link 
                to="/products" 
                onClick={onNavigate}
                className="block w-full text-center py-3 bg-primary-600 text-dark-900 font-semibold hover:bg-primary-500 transition-colors rounded-lg"
              >
                View All Products
              </Link>
            </div>
          </div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileProductsMenu;