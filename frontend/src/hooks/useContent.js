import { useState, useEffect } from 'react';
import { IS_DEMO, demoSiteSettings, companyInfo, demoAboutContent, demoHomeContent, demoClients, demoReps, demoGalleryImages, demoProducts, demoPageContent } from '../data/demoData';
import { cachedFetch } from '../utils/cache';
import logger from '../utils/logger';
import * as contentService from '../services/contentService';

const CONTEXT = 'useContent';

/**
 * Custom hook for fetching content with demo mode support
 * Automatically uses demo data when IS_DEMO is true, otherwise fetches from API
 * 
 * @param {Function} apiFn - API function to call when not in demo mode
 * @param {any} demoData - Demo data to use when in demo mode
 * @param {string} cacheKey - Cache key for API responses
 * @param {number} cacheTTL - Cache time-to-live in milliseconds (default: 5 minutes)
 * @param {Array} deps - Dependencies array for useEffect
 * @returns {Object} { data, loading, error, refetch }
 */
export const useContent = (apiFn, demoData, cacheKey, cacheTTL = 5 * 60 * 1000, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (IS_DEMO) {
        // Use demo data in demo mode
        logger.debug(CONTEXT, `Using demo data for ${cacheKey}`);
        setData(demoData);
      } else {
        // Fetch from API with caching
        logger.debug(CONTEXT, `Fetching from API: ${cacheKey}`);
        const result = await cachedFetch(cacheKey, apiFn, cacheTTL);
        
        // Use API data if available, otherwise use demo data as fallback
        if (result === null || result === undefined) {
          logger.warn(CONTEXT, `API returned null for ${cacheKey}, using default content`);
          setData(demoData);
        } else {
          setData(result);
        }
      }
    } catch (err) {
      logger.error(CONTEXT, `Error fetching ${cacheKey}`, err);
      setError(err);
      // Only fallback to demo data if available and error is not critical
      if (demoData) {
        logger.warn(CONTEXT, `API error for ${cacheKey}, using default content`);
        setData(demoData);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = () => {
    fetchData();
  };

  return { data, loading, error, refetch };
};

/**
 * Hook for site settings
 */
export const useSiteSettings = () => {
  return useContent(
    contentService.getSiteSettings,
    demoSiteSettings,
    'site-settings',
    30 * 60 * 1000 // 30 minutes cache
  );
};

/**
 * Hook for company info
 */
export const useCompanyInfo = (sectionKey = null) => {
  return useContent(
    () => contentService.getCompanyInfo(sectionKey),
    companyInfo,
    `company-info${sectionKey ? `-${sectionKey}` : ''}`,
    30 * 60 * 1000,
    [sectionKey]
  );
};

/**
 * Hook for team members
 */
export const useTeamMembers = () => {
  return useContent(
    contentService.getTeamMembers,
    demoAboutContent.team,
    'team-members',
    30 * 60 * 1000
  );
};

/**
 * Hook for company values
 */
export const useCompanyValues = () => {
  return useContent(
    contentService.getCompanyValues,
    demoAboutContent.values,
    'company-values',
    30 * 60 * 1000
  );
};

/**
 * Hook for company milestones
 */
export const useCompanyMilestones = () => {
  return useContent(
    contentService.getCompanyMilestones,
    demoAboutContent.milestones,
    'company-milestones',
    30 * 60 * 1000
  );
};

/**
 * Hook for hero slides
 */
export const useHeroSlides = () => {
  return useContent(
    contentService.getHeroSlides,
    demoHomeContent.heroSlides,
    'hero-slides',
    15 * 60 * 1000
  );
};

/**
 * Hook for features (Why Choose Us)
 */
export const useFeatures = (featureType = 'general') => {
  return useContent(
    () => contentService.getFeatures(featureType),
    demoHomeContent.whyChooseUs,
    `features-${featureType}`,
    30 * 60 * 1000,
    [featureType]
  );
};

/**
 * Hook for client logos
 */
export const useClientLogos = () => {
  return useContent(
    contentService.getClientLogos,
    demoClients,
    'client-logos',
    30 * 60 * 1000
  );
};

/**
 * Hook for sales representatives
 */
export const useSalesReps = () => {
  return useContent(
    contentService.getSalesReps,
    demoReps,
    'sales-reps',
    30 * 60 * 1000
  );
};

/**
 * Hook for installations (gallery)
 */
export const useInstallations = (filters = {}) => {
  const filterKey = JSON.stringify(filters);
  
  return useContent(
    () => contentService.getInstallations(filters),
    demoGalleryImages,
    `installations-${filterKey}`,
    15 * 60 * 1000,
    [filterKey]
  );
};

export const useProducts = (filters = {}) => {
  const filterKey = JSON.stringify(filters);
  
  return useContent(
    () => contentService.getProducts(filters),
    demoProducts,
    `products-${filterKey}`,
    15 * 60 * 1000,
    [filterKey]
  );
};

export const useFeaturedProducts = (limit = 4) => {
  const featuredDemoProducts = demoProducts.filter(p => p.is_featured).slice(0, limit);
  
  return useContent(
    () => contentService.getFeaturedProducts(limit),
    featuredDemoProducts,
    `featured-products-${limit}`,
    15 * 60 * 1000,
    [limit]
  );
};

export const usePageContent = (pageSlug, sectionKey = null) => {
  const cacheKey = sectionKey ? `page-content-${pageSlug}-${sectionKey}` : `page-content-${pageSlug}`;
  
  // Get demo data for this page/section
  const demoData = sectionKey 
    ? demoPageContent[pageSlug]?.[sectionKey]
    : demoPageContent[pageSlug];
  
  return useContent(
    () => contentService.getPageContent(pageSlug, sectionKey),
    demoData,
    cacheKey,
    30 * 60 * 1000,
    [pageSlug, sectionKey]
  );
};

export default useContent;

