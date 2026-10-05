import { useState, useEffect, useRef, useCallback, useContext, useSyncExternalStore, useMemo } from 'react';
import { cachedFetch, peekCache } from '../utils/cache';
import { peekContentData, isContentFresh } from '../utils/contentDataLoader';
import {
  invalidateCmsContent,
  subscribeCmsContent,
  getCmsContentVersion,
  trackCmsCacheKey,
} from '../utils/cmsContentStore';
import InitialContentContext from '../contexts/InitialContentContext';
import logger from '../utils/logger';
import * as contentService from '../services/contentService';

const CONTEXT = 'useContent';
const { staticSelectors, USE_STATIC_CONTENT } = contentService;

const MAX_RETRIES = 3;
const retryDelay = (count) => Math.min(1000 * 2 ** count, 30000); // Exponential backoff: 1s, 2s, 4s (max 30s)
const getServerVersion = () => 0;

// apiClient normalizes errors to { message, status, data }; fetch() failures
// are plain Errors without a status. Retry only network errors and 5xx.
const isRetryableError = (err) => {
  const status = err?.status ?? err?.response?.status ?? null;
  return status === null || status === undefined || status >= 500;
};

const sameDeps = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Custom hook for fetching content from API
 * 
 * @param {Function} apiFn - API function to call
 * @param {any} defaultData - Default data to use if API returns null/undefined
 * @param {string} cacheKey - Cache key for API responses
 * @param {number} cacheTTL - Cache time-to-live in milliseconds (default: 5 minutes)
 * @param {Array} deps - Dependencies array for useEffect
 * @param {Function} selectStatic - Optional pure selector over contentData.json.
 *   When the content is already in memory (SSR payload, earlier load) the hook
 *   returns it synchronously on the first render - identical on server and
 *   client, so hydration matches and there is no loading flash.
 * @returns {Object} { data, loading, error, refetch } - refetch() returns a
 *   promise that resolves once fresh data has loaded.
 */
export const useContent = (apiFn, defaultData = null, cacheKey, cacheTTL = 5 * 60 * 1000, deps = [], selectStatic = null) => {
  const ssrContent = useContext(InitialContentContext);
  const version = useSyncExternalStore(subscribeCmsContent, getCmsContentVersion, getServerVersion);

  const readSync = () => {
    const cached = peekCache(cacheKey);
    if (cached !== null) return cached;
    if (!selectStatic || !USE_STATIC_CONTENT) return undefined;
    const content = ssrContent || peekContentData();
    if (!content) return undefined;
    try {
      const value = selectStatic(content);
      return value === null ? undefined : value;
    } catch {
      return undefined;
    }
  };
  // Synchronous data is only authoritative while its source is fresh
  const syncIsFresh = () => peekCache(cacheKey) !== null || isContentFresh();

  const [initial] = useState(readSync);
  const [data, setData] = useState(initial !== undefined ? initial : defaultData);
  const [loading, setLoading] = useState(initial === undefined);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const retryTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  const waitersRef = useRef([]);
  const skipFetchRef = useRef(initial !== undefined && syncIsFresh());
  const lastVersionRef = useRef(version);
  const lastDepsRef = useRef(deps);
  // Whether `data` currently holds real content (not the default placeholder)
  const hasDataRef = useRef(initial !== undefined);

  const resolveWaiters = () => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  };

  const fetchData = async ({ silent = false } = {}) => {
    const requestId = ++requestIdRef.current;
    // Ignore results for unmounted components or superseded requests
    const isCurrent = () => mountedRef.current && requestId === requestIdRef.current;

    clearTimeout(retryTimerRef.current);
    if (!silent) setLoading(true);
    setError(null);

    for (let retryCount = 0; ; retryCount++) {
      try {
        logger.debug(CONTEXT, `Fetching from API: ${cacheKey}${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}`);
        const result = await cachedFetch(cacheKey, apiFn, cacheTTL);
        if (!isCurrent()) return;

        // Use API data if available, otherwise use default data
        if (result === null || result === undefined) {
          logger.warn(CONTEXT, `API returned null for ${cacheKey}, using default content`);
          setData(defaultData);
          hasDataRef.current = false;
        } else {
          setData(result);
          hasDataRef.current = true;
        }
        break;
      } catch (err) {
        if (!isCurrent()) return;

        if (isRetryableError(err) && retryCount < MAX_RETRIES) {
          const delay = retryDelay(retryCount);
          logger.warn(CONTEXT, `Retrying ${cacheKey} after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          // Stay in the loading state until the retries settle
          await new Promise((resolve) => {
            retryTimerRef.current = setTimeout(resolve, delay);
          });
          if (!isCurrent()) return;
          continue;
        }

        logger.error(CONTEXT, `Error fetching ${cacheKey}`, err);
        setError(err);
        // Use default data on error if provided
        if (defaultData !== null && defaultData !== undefined) {
          logger.warn(CONTEXT, `API error for ${cacheKey}, using default content`);
          setData(defaultData);
        }
        break;
      }
    }
    setLoading(false);
    resolveWaiters();
  };

  useEffect(() => {
    mountedRef.current = true;
    trackCmsCacheKey(cacheKey);

    const versionChanged = lastVersionRef.current !== version;
    const depsChanged = !sameDeps(lastDepsRef.current, deps);
    lastVersionRef.current = version;
    lastDepsRef.current = deps;

    if (skipFetchRef.current) {
      // First render already has fresh data (SSR payload / cache)
      skipFetchRef.current = false;
    } else if (versionChanged && !depsChanged) {
      // Content was invalidated: refresh in place, keep showing current data
      fetchData({ silent: true });
    } else {
      const sync = readSync();
      if (sync !== undefined && syncIsFresh()) {
        setData(sync);
        hasDataRef.current = true;
        setLoading(false);
        setError(null);
        resolveWaiters();
      } else {
        // Revalidate stale-but-shown data without flashing a loading state
        fetchData({ silent: !depsChanged && hasDataRef.current });
      }
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  // Nothing may wait forever on an unmounted instance
  useEffect(() => () => resolveWaiters(), []);

  /**
   * Invalidate all CMS content (every hook instance re-fetches) and resolve
   * once this instance has the fresh data.
   */
  const refetch = useCallback(() => new Promise((resolve) => {
    waitersRef.current.push(resolve);
    invalidateCmsContent();
  }), []);

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
    30 * 60 * 1000, // 30 minutes cache
    [],
    staticSelectors.siteSettings
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
    [sectionKey],
    staticSelectors.companyInfo
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
    30 * 60 * 1000,
    [],
    staticSelectors.teamMembers
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
    30 * 60 * 1000,
    [],
    staticSelectors.companyValues
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
    30 * 60 * 1000,
    [],
    staticSelectors.companyMilestones
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
    15 * 60 * 1000,
    [],
    staticSelectors.heroSlides
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
    [featureType],
    (content) => staticSelectors.features(content, featureType)
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
    30 * 60 * 1000,
    [],
    staticSelectors.clientLogos
  );
};

/**
 * Hook for client testimonials
 */
export const useTestimonials = () => {
  return useContent(
    contentService.getTestimonials,
    [],
    'testimonials',
    30 * 60 * 1000,
    [],
    staticSelectors.testimonials
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
    30 * 60 * 1000,
    [],
    staticSelectors.salesReps
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
    [filterKey],
    (content) => staticSelectors.installations(content, filters)
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
    [pageSlug, sectionKey],
    (content) => staticSelectors.pageContent(content, pageSlug, sectionKey)
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
    30 * 60 * 1000,
    [],
    staticSelectors.finishes
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
    30 * 60 * 1000,
    [],
    staticSelectors.upholsteries
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
    30 * 60 * 1000,
    [],
    staticSelectors.laminates
  );
};

/**
 * Hook for supplier catalogs we special-order from (e.g. Wilsonart laminates).
 * Pass a material type ('laminate', 'upholstery', 'finish', 'hardware',
 * 'other') to get only those.
 */
export const useMaterialSources = (materialType) => {
  const result = useContent(
    contentService.getMaterialSources,
    [],
    'materialSources',
    30 * 60 * 1000,
    [],
    staticSelectors.materialSources
  );
  const all = result.data;
  const data = useMemo(
    () => (materialType ? (all || []).filter((s) => s.materialType === materialType) : all || []),
    [all, materialType]
  );
  return { ...result, data };
};

/**
 * Hook for hardware
 */
export const useHardware = () => {
  return useContent(
    contentService.getHardware,
    [],
    'hardware',
    30 * 60 * 1000,
    [],
    staticSelectors.hardware
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
    [catalogType],
    (content) => staticSelectors.catalogs(content, catalogType)
  );
};

export default useContent;

