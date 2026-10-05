import { permanentDelete } from '../../../services/bulkService';

/** Toast the outcome of a permanent delete, naming anything that was skipped */
export function reportPermanentDelete(toast, { deleted = 0, skipped = [] } = {}, { noun = 'item', pluralNoun } = {}) {
  const word = (n) => (n === 1 ? noun : pluralNoun || `${noun}s`);
  if (!skipped.length) {
    toast.success(`Permanently deleted ${deleted} ${word(deleted)}`);
    return;
  }
  const shown = skipped.slice(0, 3).map((s) => `${s.name} (${s.reason})`).join('; ');
  const more = skipped.length > 3 ? `; +${skipped.length - 3} more` : '';
  const lead = deleted ? `Deleted ${deleted} ${word(deleted)}. ` : '';
  toast.warning(`${lead}Kept ${skipped.length}: ${shown}${more}`, 12000);
}

/** Delete, toast the result, and return it */
export async function deletePermanently(toast, resource, ids, labels) {
  const result = await permanentDelete(resource, ids);
  reportPermanentDelete(toast, result, labels);
  return result;
}
