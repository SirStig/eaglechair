import { useEffect, useState } from 'react';
import productService from '../services/productService';
import { resolveSpecProfile } from '../utils/specSymbols';

/**
 * A product's spec symbol profile, inherited from its subcategory/category
 * (see resolveSpecProfile). Null until categories load or when none is set.
 */
const useSpecProfile = (product) => {
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    let cancelled = false;
    productService
      .getCategories()
      .then((cats) => { if (!cancelled) setCategories(cats); })
      .catch(() => { /* no profile: specs render with text badges */ });
    return () => { cancelled = true; };
  }, []);

  return resolveSpecProfile(product, categories);
};

export default useSpecProfile;
