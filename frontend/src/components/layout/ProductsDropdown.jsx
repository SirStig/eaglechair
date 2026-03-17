import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import productService from '../../services/productService';
import { resolveImageUrl } from '../../utils/apiHelpers';
import logger from '../../utils/logger';

const CONTEXT = 'ProductsDropdown';

const DEFAULT_BANNER = '/assets/default-banner-categories.png';

const ProductsDropdown = () => {
  const [categories, setCategories] = useState([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState(() => new Set());
  const onImageLoad = useCallback((key) => {
    setLoadedImages((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

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
          const bannerImage = resolveImageUrl(category.banner_image_url || DEFAULT_BANNER);
          const imgKey = `cat-${category.id}-${bannerImage}`;
          const isLoaded = loadedImages.has(imgKey);

          return (
            <div key={category.id} className="relative group">
              <div className="relative h-[550px] sm:h-[650px] lg:h-[700px] overflow-hidden">
                <Link
                  to={`/products/category/${category.slug}`}
                  className="absolute inset-0 block bg-dark-900"
                >
                  <img
                    src={bannerImage}
                    alt={category.name}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-150 group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => onImageLoad(imgKey)}
                    onError={(e) => {
                      e.target.src = DEFAULT_BANNER;
                      onImageLoad(imgKey);
                    }}
                    loading="eager"
                    fetchpriority="high"
                  />
                  <div
                    className="absolute top-0 left-0 right-0 bottom-0 w-full h-full pointer-events-none"
                    style={{
                      minWidth: '100%',
                      minHeight: '100%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.4) 75%, transparent 100%)'
                    }}
                    aria-hidden
                  />
                </Link>

                {/* Content Container - Full Height with Flex */}
                <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                  {/* Category Title at Top */}
                  <div>
                    <h3 className="text-white font-bold mb-2 drop-shadow-lg text-[clamp(0.875rem,1.25vw+0.75rem,1.875rem)]">
                      {category.name}
                    </h3>
                    <div className="w-16 h-1 bg-primary-500 rounded-full"></div>
                  </div>

                  {/* Subcategory Navigation Links - at bottom, larger and better spaced */}
                  <div className="relative pl-2 sm:pl-4 pointer-events-auto py-6">
                    <div className="space-y-2">
                      {subcategories.slice(0, 5).map((subcat) => (
                        <Link
                          key={subcat.id}
                          to={`/products/category/${category.slug}/${subcat.slug}`}
                          className="block w-full text-left py-3 px-2 text-white/95 hover:text-white hover:translate-x-2 transition-all duration-200 text-base font-medium"
                        >
                          {subcat.name}
                        </Link>
                      ))}

                      <Link
                        to={`/products/category/${category.slug}`}
                        className="block w-full text-left py-3 px-2 text-primary-400 hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-base font-bold mt-4"
                      >
                        View All {category.name} →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* "More Categories" Column if there are more than MAX_COLUMNS - 1 categories */}
        {hasMoreCategories && (
          <div className="relative group">
            <div className="relative h-[550px] sm:h-[650px] lg:h-[700px] overflow-hidden">
              <Link
                to="/products"
                className="absolute inset-0 block"
              >
                <img
                  src={DEFAULT_BANNER}
                  alt="More Categories"
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-150 group-hover:scale-110 ${loadedImages.has('more-categories') ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => onImageLoad('more-categories')}
                  loading="eager"
                  fetchpriority="high"
                />
                <div
                  className="absolute top-0 left-0 right-0 bottom-0 w-full h-full pointer-events-none"
                  style={{
                    minWidth: '100%',
                    minHeight: '100%',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.4) 75%, transparent 100%)'
                  }}
                  aria-hidden
                />
              </Link>

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                <div>
                  <h3 className="text-white font-bold mb-2 drop-shadow-lg text-[clamp(0.875rem,1.25vw+0.75rem,1.875rem)]">
                    More Categories
                  </h3>
                  <div className="w-16 h-1 bg-primary-500 rounded-full"></div>
                </div>

                {/* Additional categories list - larger and better spaced */}
                <div className="relative pl-2 sm:pl-4 pointer-events-auto py-6">
                  <div className="space-y-2">
                    {categories.slice(MAX_COLUMNS - 1).map((category) => (
                      <Link
                        key={category.id}
                        to={`/products/category/${category.slug}`}
                        className="block w-full text-left py-3 px-2 text-white/95 hover:text-white hover:translate-x-2 transition-all duration-200 text-base font-medium"
                      >
                        {category.name}
                      </Link>
                    ))}

                    <Link
                      to="/products"
                      className="block w-full text-left py-3 px-2 text-primary-400 hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-base font-bold mt-4"
                    >
                      View All Products →
                    </Link>
                  </div>
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

