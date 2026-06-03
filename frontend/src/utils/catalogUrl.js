export const DEFAULT_CATALOG_FILTERS = {
  category_id: '',
  subcategory_id: '',
  family_id: '',
  search: '',
  finish_ids: [],
  upholstery_ids: [],
  color_ids: [],
  is_stackable: null,
  is_outdoor_suitable: null,
  ada_compliant: null,
  min_seat_height: '',
  max_seat_height: '',
  min_width: '',
  max_width: '',
  max_lead_time: '',
  stock_status: '',
  featured: false,
  new: false,
  sortBy: 'smart',
};

export function parseCatalogFilters(searchParams) {
  return {
    category_id: searchParams.get('category_id') || '',
    subcategory_id: searchParams.get('subcategory_id') || '',
    family_id: searchParams.get('family_id') || '',
    search: searchParams.get('search') || '',
    finish_ids: searchParams.get('finish_ids')?.split(',').filter(Boolean) || [],
    upholstery_ids: searchParams.get('upholstery_ids')?.split(',').filter(Boolean) || [],
    color_ids: searchParams.get('color_ids')?.split(',').filter(Boolean) || [],
    is_stackable: searchParams.get('is_stackable') === 'true' ? true : null,
    is_outdoor_suitable: searchParams.get('is_outdoor_suitable') === 'true' ? true : null,
    ada_compliant: searchParams.get('ada_compliant') === 'true' ? true : null,
    min_seat_height: searchParams.get('min_seat_height') || '',
    max_seat_height: searchParams.get('max_seat_height') || '',
    min_width: searchParams.get('min_width') || '',
    max_width: searchParams.get('max_width') || '',
    max_lead_time: searchParams.get('max_lead_time') || '',
    stock_status: searchParams.get('stock_status') || '',
    featured: searchParams.get('featured') === 'true',
    new: searchParams.get('new') === 'true',
    sortBy: searchParams.get('sort') || 'smart',
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
    const category = categories.find((c) => c.slug === categoryParam);
    if (category) {
      filters.category_id = category.id;
      if (subcategoryParam && subcategories.length > 0) {
        const subcat = subcategories.find(
          (s) => (s.slug || '').toLowerCase() === subcategoryParam.toLowerCase()
        );
        filters.subcategory_id = subcat ? subcat.id : '';
      } else {
        filters.subcategory_id = '';
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
  if (filters.finish_ids?.length > 0) {
    params.set('finish_ids', filters.finish_ids.join(','));
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
  if (filters.min_seat_height) {
    params.set('min_seat_height', filters.min_seat_height);
  }
  if (filters.max_seat_height) {
    params.set('max_seat_height', filters.max_seat_height);
  }
  if (filters.min_width) {
    params.set('min_width', filters.min_width);
  }
  if (filters.max_width) {
    params.set('max_width', filters.max_width);
  }
  if (filters.max_lead_time) {
    params.set('max_lead_time', filters.max_lead_time);
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

  return params;
}

export function getCatalogLocation(filters, categories, subcategories, page = 1) {
  const category = categories.find((c) => String(c.id) === String(filters.category_id));
  const subcategory = subcategories.find((s) => String(s.id) === String(filters.subcategory_id));
  const pathname = buildCatalogPath(category?.slug, subcategory?.slug);
  const search = buildCatalogSearchParams(filters, page);
  const searchString = search.toString();

  return {
    pathname,
    search: searchString ? `?${searchString}` : '',
  };
}
