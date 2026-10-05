import { useCallback, useEffect, useState } from 'react';
import { getCachedLegalDocuments, loadLegalDocuments } from '../utils/legalDocumentsLoader';

/**
 * Legal documents for the public legal pages.
 *
 * Renders from the in-memory cache straight away when there is one (no
 * loader on repeat visits) and refreshes in the background.
 */
const useLegalDocuments = () => {
  const [documents, setDocuments] = useState(getCachedLegalDocuments);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadLegalDocuments().then((docs) => {
      if (cancelled) return;
      if (docs) {
        setDocuments(docs);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return {
    documents: documents || [],
    loading: !documents && !failed,
    // Only an error when there is nothing cached to show
    error: !documents && failed,
    retry,
  };
};

export default useLegalDocuments;
