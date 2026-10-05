/** Full id set with the primary first and no duplicates (what the API stores). */
export const withPrimary = (primary, ids = []) =>
  [...new Set([primary, ...ids].filter((id) => id != null))];
