import {
  findCategoryById,
  findCategoryBySlug,
  findChildBySlug,
  findNestedCategoryById,
  findNestedCategoryBySlug,
  isNestedCategoryChild,
} from './categoryTree';

export const DEFAULT_CATALOG_FILTERS = {
  category_id: '',
  subcategory_id: '',
  family_id: '',
  search: '',
  upholstery_ids: [],
  color_ids: [],
  is_stackable: null,
  is_outdoor_suitable: null,
  ada_compliant: null,
  min_height: '',
  max_height: '',
  min_width: '',
  max_width: '',
  stock_status: '',
  featured: false,
  new: false,
  sortBy: 'smart',
  per_page: 25,
};

// Products per page; 'all' shows the whole result set on one page
export const CATALOG_PAGE_SIZES = [25, 50, 100, 'all'];

function parsePerPage(value) {
  if (value === 'all') return 'all';
  const n = parseInt(value, 10);
  return CATALOG_PAGE_SIZES.includes(n) ? n : DEFAULT_CATALOG_FILTERS.per_page;
}

export function parseCatalogFilters(searchParams) {
  return {
    category_id: searchParams.get('category_id') || '',
    subcategory_id: searchParams.get('subcategory_id') || '',
    family_id: searchParams.get('family_id') || '',
    search: searchParams.get('search') || '',
    upholstery_ids: searchParams.get('upholstery_ids')?.split(',').filter(Boolean) || [],
    color_ids: searchParams.get('color_ids')?.split(',').filter(Boolean) || [],
    is_stackable: searchParams.get('is_stackable') === 'true' ? true : null,
    is_outdoor_suitable: searchParams.get('is_outdoor_suitable') === 'true' ? true : null,
    ada_compliant: searchParams.get('ada_compliant') === 'true' ? true : null,
    min_height: searchParams.get('min_height') || '',
    max_height: searchParams.get('max_height') || '',
    min_width: searchParams.get('min_width') || '',
    max_width: searchParams.get('max_width') || '',
    stock_status: searchParams.get('stock_status') || '',
    featured: searchParams.get('featured') === 'true',
    new: searchParams.get('new') === 'true',
    sortBy: searchParams.get('sort') || 'smart',
    per_page: parsePerPage(searchParams.get('per_page')),
  };
}

export function getCatalogPage(searchParams) {
  const page = parseInt(searchParams.get('page') || '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function resolveCatalogFilters({
  searchParams,
  categoryParam,
  subcategoryParam,
  categories,
  subcategories,
}) {
  const filters = parseCatalogFilters(searchParams);

  if (categoryParam && categories.length > 0) {
    const category = findCategoryBySlug(categories, categoryParam);

    if (!category) {
      // A nested category addressed directly, e.g. /products/category/wood-chairs
      const nested = findNestedCategoryBySlug(categories, categoryParam);
      if (nested) {
        filters.category_id = nested.category.id;
        filters.subcategory_id = '';
      }
      return filters;
    }

    filters.category_id = category.id;
    filters.subcategory_id = '';

    if (subcategoryParam) {
      // A child is either a subcategory or a nested category; they share the
      // /products/category/<parent>/<child> URL shape but filter differently.
      const child =
        findChildBySlug(category, subcategoryParam) ||
        (subcategories || []).find(
          (s) => (s.slug || '').toLowerCase() === subcategoryParam.toLowerCase()
        );

      if (isNestedCategoryChild(child)) {
        filters.category_id = child.id;
      } else if (child) {
        filters.subcategory_id = child.id;
      }
    }
  }

  return filters;
}

export function buildCatalogPath(categorySlug, subcategorySlug) {
  if (categorySlug && subcategorySlug) {
    return `/products/category/${categorySlug}/${subcategorySlug}`;
  }
  if (categorySlug) {
    return `/products/category/${categorySlug}`;
  }
  return '/products';
}

export function buildCatalogSearchParams(filters, page = 1) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set('page', String(page));
  }

  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.family_id) {
    params.set('family_id', String(filters.family_id));
  }
  if (filters.upholstery_ids?.length > 0) {
    params.set('upholstery_ids', filters.upholstery_ids.join(','));
  }
  if (filters.color_ids?.length > 0) {
    params.set('color_ids', filters.color_ids.join(','));
  }
  if (filters.is_stackable === true) {
    params.set('is_stackable', 'true');
  }
  if (filters.is_outdoor_suitable === true) {
    params.set('is_outdoor_suitable', 'true');
  }
  if (filters.ada_compliant === true) {
    params.set('ada_compliant', 'true');
  }
  if (filters.min_height) {
    params.set('min_height', filters.min_height);
  }
  if (filters.max_height) {
    params.set('max_height', filters.max_height);
  }
  if (filters.min_width) {
    params.set('min_width', filters.min_width);
  }
  if (filters.max_width) {
    params.set('max_width', filters.max_width);
  }
  if (filters.stock_status) {
    params.set('stock_status', filters.stock_status);
  }
  if (filters.featured) {
    params.set('featured', 'true');
  }
  if (filters.new) {
    params.set('new', 'true');
  }
  if (filters.sortBy && filters.sortBy !== 'smart') {
    params.set('sort', filters.sortBy);
  }
  if (filters.per_page && filters.per_page !== DEFAULT_CATALOG_FILTERS.per_page) {
    params.set('per_page', String(filters.per_page));
  }

  return params;
}

export function getCatalogLocation(filters, categories, subcategories, page = 1) {
  const nested = findCategoryById(categories, filters.category_id)
    ? null
    : findNestedCategoryById(categories, filters.category_id);

  const category = nested
    ? nested.parent
    : findCategoryById(categories, filters.category_id);
  const subcategory = nested
    ? nested.category
    : subcategories.find((s) => String(s.id) === String(filters.subcategory_id));

  const pathname = buildCatalogPath(category?.slug, subcategory?.slug);
  const search = buildCatalogSearchParams(filters, page);
  const searchString = search.toString();

  return {
    pathname,
    search: searchString ? `?${searchString}` : '',
  };
}
