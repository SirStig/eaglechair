import { useState, useEffect } from 'react';
import { cachedFetch } from '../utils/cache';
import logger from '../utils/logger';
import * as contentService from '../services/contentService';

const CONTEXT = 'useContent';

/**
 * Custom hook for fetching content from API
 * 
 * @param {Function} apiFn - API function to call
 * @param {any} defaultData - Default data to use if API returns null/undefined
 * @param {string} cacheKey - Cache key for API responses
 * @param {number} cacheTTL - Cache time-to-live in milliseconds (default: 5 minutes)
 * @param {Array} deps - Dependencies array for useEffect
 * @returns {Object} { data, loading, error, refetch }
 */
export const useContent = (apiFn, defaultData = null, cacheKey, cacheTTL = 5 * 60 * 1000, deps = []) => {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from API with caching
      logger.debug(CONTEXT, `Fetching from API: ${cacheKey}`);
      const result = await cachedFetch(cacheKey, apiFn, cacheTTL);
      
      // Use API data if available, otherwise use default data
      if (result === null || result === undefined) {
        logger.warn(CONTEXT, `API returned null for ${cacheKey}, using default content`);
        setData(defaultData);
      } else {
        setData(result);
      }
    } catch (err) {
      logger.error(CONTEXT, `Error fetching ${cacheKey}`, err);
      setError(err);
      // Use default data on error if provided
      if (defaultData !== null && defaultData !== undefined) {
        logger.warn(CONTEXT, `API error for ${cacheKey}, using default content`);
        setData(defaultData);
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
    null,
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
    null,
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
    [],
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
    [],
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
    [],
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
    [],
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
    [],
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
    [],
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
    [],
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
    [],
    `installations-${filterKey}`,
    15 * 60 * 1000,
    [filterKey]
  );
};

export const useProducts = (filters = {}) => {
  const filterKey = JSON.stringify(filters);
  
  return useContent(
    () => contentService.getProducts(filters),
    [],
    `products-${filterKey}`,
    15 * 60 * 1000,
    [filterKey]
  );
};

export const useFeaturedProducts = (limit = 4) => {
  return useContent(
    () => contentService.getFeaturedProducts(limit),
    [],
    `featured-products-${limit}`,
    15 * 60 * 1000,
    [limit]
  );
};

export const usePageContent = (pageSlug, sectionKey = null) => {
  const cacheKey = sectionKey ? `page-content-${pageSlug}-${sectionKey}` : `page-content-${pageSlug}`;
  
  return useContent(
    () => contentService.getPageContent(pageSlug, sectionKey),
    null,
    cacheKey,
    30 * 60 * 1000,
    [pageSlug, sectionKey]
  );
};

/**
 * Hook for finishes
 */
export const useFinishes = () => {
  return useContent(
    contentService.getFinishes,
    [],
    'finishes',
    30 * 60 * 1000
  );
};

/**
 * Hook for upholsteries
 */
export const useUpholsteries = () => {
  return useContent(
    contentService.getUpholsteries,
    [],
    'upholsteries',
    30 * 60 * 1000
  );
};

/**
 * Hook for laminates
 */
export const useLaminates = () => {
  return useContent(
    contentService.getLaminates,
    [],
    'laminates',
    30 * 60 * 1000
  );
};

/**
 * Hook for hardware
 */
export const useHardware = () => {
  return useContent(
    contentService.getHardware,
    [],
    'hardware',
    30 * 60 * 1000
  );
};

/**
 * Hook for catalogs
 */
export const useCatalogs = (catalogType = null) => {
  return useContent(
    () => contentService.getCatalogs(catalogType),
    [],
    `catalogs${catalogType ? `-${catalogType}` : ''}`,
    30 * 60 * 1000,
    [catalogType]
  );
};

export default useContent;

