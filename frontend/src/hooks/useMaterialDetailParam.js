import { useMemo } from 'react';
import { useUrlState } from './useUrlState';

/**
 * MaterialDetailOverlay state kept in the URL as `?<key>=<id>`, so a link opens
 * the same swatch. `groups` (memoize it) is `[{ items, toDetail }]`: the overlay
 * steps through the group the open item belongs to, as the cards are laid out.
 */
export default function useMaterialDetailParam(key, groups) {
  const [openId, setOpenId] = useUrlState(key, null);

  const detail = useMemo(() => {
    if (openId == null) return null;
    for (const { items, toDetail } of groups) {
      const index = items.findIndex((x) => String(x.id) === openId);
      if (index >= 0) return { raw: items, items: items.map(toDetail), index };
    }
    return null;
  }, [openId, groups]);

  const openDetail = (item) => setOpenId(String(item.id), { push: true });

  const overlayProps = {
    items: detail?.items,
    index: detail?.index,
    onIndexChange: (index) => {
      const next = detail?.raw[index];
      if (next) setOpenId(String(next.id));
    },
    onClose: () => setOpenId(null),
  };

  return { openDetail, overlayProps };
}
