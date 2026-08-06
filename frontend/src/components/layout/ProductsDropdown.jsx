import { useState, useEffect } from 'react';
import productService from '../../services/productService';
import { resolveImageUrl } from '../../utils/apiHelpers';
import CategoryTile from '../products/CategoryTile';
import logger from '../../utils/logger';

const CONTEXT = 'ProductsDropdown';

const DEFAULT_BANNER = '/assets/default-banner-categories.png';

// Widest the dropdown goes before extra categories collapse into "More Categories"
const MAX_COLUMNS = 5;

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

  // Categories beyond the first four collapse into a "More Categories" column
  const displayCategories = categories.slice(0, MAX_COLUMNS - 1);
  const overflowCategories = categories.slice(MAX_COLUMNS - 1);
  const hasMoreCategories = overflowCategories.length > 0;
  const columnCount = Math.min(
    displayCategories.length + (hasMoreCategories ? 1 : 0),
    MAX_COLUMNS
  );

  if (columnCount === 0) return null;

  return (
    <div className="w-full bg-dark-800/95 backdrop-blur-md">
      {/* The column count is set inline so every column stays on one row -
          a Tailwind class can't be built from a runtime value. */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--tile-columns),minmax(0,1fr))] gap-0"
        style={{ '--tile-columns': columnCount }}
      >
        {displayCategories.map((category) => {
          const subcategories = subcategoriesByCategory[category.id] || [];

          return (
            <CategoryTile
              key={category.id}
              title={category.name}
              href={`/products/category/${category.slug}`}
              imageUrl={resolveImageUrl(category.banner_image_url || DEFAULT_BANNER)}
              fallbackImage={DEFAULT_BANNER}
              columns={columnCount}
              eager
              links={subcategories.slice(0, 5).map((subcat) => ({
                key: `${subcat.type || 'subcategory'}-${subcat.id}`,
                label: subcat.name,
                to: `/products/category/${category.slug}/${subcat.slug}`,
              }))}
              viewAllLabel={`View All ${category.name}`}
            />
          );
        })}

        {hasMoreCategories && (
          <CategoryTile
            title="More Categories"
            href="/products"
            imageUrl={DEFAULT_BANNER}
            fallbackImage={DEFAULT_BANNER}
            columns={columnCount}
            eager
            links={overflowCategories.map((category) => ({
              key: `category-${category.id}`,
              label: category.name,
              to: `/products/category/${category.slug}`,
            }))}
            viewAllLabel="View All Products"
          />
        )}
      </div>
    </div>
  );
};

export default ProductsDropdown;
