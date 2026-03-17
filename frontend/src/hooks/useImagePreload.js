import { useEffect } from 'react';
import contentService from '../services/contentService';
import productService from '../services/productService';
import { getProductImage, resolveImageUrl } from '../utils/apiHelpers';

const preloadUrl = (url) => {
  if (!url || typeof url !== 'string') return;
  try {
    const img = new Image();
    img.src = url;
  } catch (_) {}
};

const runPreload = async () => {
  try {
    const [heroSlides, categories, featuredRes] = await Promise.all([
      contentService.getHeroSlides(),
      productService.getCategories(),
      productService.getFeaturedProducts(4)
    ]);

    const slides = Array.isArray(heroSlides) ? heroSlides : heroSlides?.data || [];
    slides.slice(0, 5).forEach((s) => {
      const url = s.background_image_url || s.backgroundImageUrl || s.image;
      if (url) preloadUrl(resolveImageUrl(url));
    });

    const cats = Array.isArray(categories) ? categories : [];
    cats.slice(0, 6).forEach((c) => {
      const url = c.banner_image_url || c.bannerImageUrl || c.icon_url;
      if (url) preloadUrl(resolveImageUrl(url));
    });

    const products = featuredRes?.data || featuredRes?.items || (Array.isArray(featuredRes) ? featuredRes : []);
    products.slice(0, 8).forEach((p) => {
      preloadUrl(getProductImage(p));
    });
  } catch (_) {}
};

export const useImagePreload = () => {
  useEffect(() => {
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(runPreload, { timeout: 4000 });
      } else {
        setTimeout(runPreload, 2500);
      }
    };
    const t = setTimeout(schedule, 800);
    return () => clearTimeout(t);
  }, []);
};
