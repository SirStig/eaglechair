/**
 * Legal page prefetching.
 *
 * The legal pages are lazy chunks that then fetch legalDocuments.json, a
 * two-step waterfall. Loading a page starts the data fetch alongside the
 * chunk, and links warm both on hover/focus so the page usually opens ready.
 */

import { preloadLegalDocuments } from './legalDocumentsLoader';

const withDocuments = (load) => () => {
  preloadLegalDocuments();
  return load();
};

// Used by App.jsx's lazy() routes and by the link prefetch below
export const legalPageImports = {
  '/terms': withDocuments(() => import('../pages/TermsOfServicePage')),
  '/privacy': withDocuments(() => import('../pages/PrivacyPolicyPage')),
  '/general-information': withDocuments(() => import('../pages/GeneralInformationPage')),
};

export const prefetchLegalPage = (to) => {
  const path = String(to).split('#')[0];
  legalPageImports[path]?.().catch(() => {});
};

/** Spread onto a <Link> to a legal page */
export const legalPrefetchProps = (to) => {
  const prefetch = () => prefetchLegalPage(to);
  return { onMouseEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
};
