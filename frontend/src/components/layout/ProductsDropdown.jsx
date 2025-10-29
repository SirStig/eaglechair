import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import productService from '../../services/productService';
import logger from '../../utils/logger';

const CONTEXT = 'ProductsDropdown';

// Fallback image for categories without banner_image_url
const DEFAULT_BANNER = '/assets/default-banner-categories.png';

const ProductsDropdown = () => {
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
      
      logger.info(CONTEXT, `Loaded ${activeCategories.length} categories with subcategories`);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading categories and subcategories', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-dark-800/95 backdrop-blur-md p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Limit to maximum 5 categories for display
  const MAX_COLUMNS = 5;
  const displayCategories = categories.slice(0, MAX_COLUMNS - 1);
  const hasMoreCategories = categories.length > MAX_COLUMNS - 1;

  return (
    <div className="w-full bg-dark-800/95 backdrop-blur-md">
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(displayCategories.length + (hasMoreCategories ? 1 : 0), MAX_COLUMNS)} gap-0`}>
        {displayCategories.map((category) => {
          const subcategories = subcategoriesByCategory[category.id] || [];
          const bannerImage = category.banner_image_url || DEFAULT_BANNER;
          
          return (
            <div key={category.id} className="relative group">
              {/* Full height container with minimum height */}
              <div className="relative h-[500px] sm:h-[600px] overflow-hidden">
                {/* Background Image - Full Height - Clickable */}
                <Link 
                  to={`/products/category/${category.slug}`}
                  className="absolute inset-0"
                >
                  <img
                    src={bannerImage}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      e.target.src = DEFAULT_BANNER;
                    }}
                  />
                </Link>
                
                {/* Dark overlay - stronger for better button visibility */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80 group-hover:from-black/50 group-hover:via-black/60 group-hover:to-black/75 transition-all duration-300 pointer-events-none"></div>
                
                {/* Content Container - Full Height with Flex */}
                <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                  {/* Category Title at Top */}
                  <div>
                    <h3 className="text-white font-bold text-2xl sm:text-3xl mb-2 drop-shadow-lg">
                      {category.name}
                    </h3>
                    <div className="w-16 h-1 bg-primary-500 rounded-full"></div>
                  </div>
                  
                  {/* Subcategory Navigation Links - Overlaid on Image at Bottom */}
                  <div className="space-y-1 pointer-events-auto">
                    {subcategories.slice(0, 5).map((subcat) => (
                      <Link
                        key={subcat.id}
                        to={`/products/category/${category.slug}/${subcat.slug}`}
                        className="block w-full text-left px-2 py-2 text-white/90 hover:text-white hover:translate-x-2 transition-all duration-200 text-sm font-medium"
                      >
                        {subcat.name}
                      </Link>
                    ))}
                    
                    {/* View All link with distinct styling */}
                    <Link
                      to={`/products/category/${category.slug}`}
                      className="block w-full text-left px-2 py-2 text-primary-400 hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-sm font-bold mt-3"
                    >
                      View All {category.name} →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* "More Categories" Column if there are more than MAX_COLUMNS - 1 categories */}
        {hasMoreCategories && (
          <div className="relative group">
            <div className="relative h-[500px] sm:h-[600px] overflow-hidden">
              {/* Background Image */}
              <Link 
                to="/products"
                className="absolute inset-0"
              >
                <img
                  src={DEFAULT_BANNER}
                  alt="More Categories"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </Link>
              
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80 group-hover:from-black/50 group-hover:via-black/60 group-hover:to-black/75 transition-all duration-300 pointer-events-none"></div>
              
              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                <div>
                  <h3 className="text-white font-bold text-2xl sm:text-3xl mb-2 drop-shadow-lg">
                    More Categories
                  </h3>
                  <div className="w-16 h-1 bg-primary-500 rounded-full"></div>
                </div>
                
                {/* Additional categories list */}
                <div className="space-y-1 pointer-events-auto">
                  {categories.slice(MAX_COLUMNS - 1).map((category) => (
                    <Link
                      key={category.id}
                      to={`/products/category/${category.slug}`}
                      className="block w-full text-left px-2 py-2 text-white/90 hover:text-white hover:translate-x-2 transition-all duration-200 text-sm font-medium"
                    >
                      {category.name}
                    </Link>
                  ))}
                  
                  {/* View All Products link */}
                  <Link
                    to="/products"
                    className="block w-full text-left px-2 py-2 text-primary-400 hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-sm font-bold mt-3"
                  >
                    View All Products →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsDropdown;

