import { useEffect, useState } from 'react';
import apiClient from '../config/apiClient';

const EMPTY = { finishes: [], upholsteries: [], colors: [], laminates: [] };

const items = (r) => (Array.isArray(r) ? r : r?.items || []);

/**
 * Finishes, upholsteries, colors and laminates for the product bulk
 * add/remove pickers. Fetched once, the first time `enabled` is true (i.e.
 * when rows get selected), so list pages don't pay for it up front.
 */
export default function useMaterialLists(enabled) {
  const [lists, setLists] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    setLoaded(true);
    const get = (url) => apiClient.get(url).then(items).catch(() => []);
    Promise.all([
      get('/api/v1/admin/finishes'),
      // Endpoint paginates (default 50), so ask for the whole list
      get('/api/v1/admin/upholsteries?page_size=500'),
      get('/api/v1/admin/colors'),
      get('/api/v1/content/laminates'),
    ]).then(([finishes, upholsteries, colors, laminates]) => setLists({ finishes, upholsteries, colors, laminates }));
  }, [enabled, loaded]);

  return lists;
}
