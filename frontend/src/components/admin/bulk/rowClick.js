// Clicks on these never count as "open this row"
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="switch"], [data-select-cell], [data-no-row-click]';

/**
 * onClick handler for a list row: runs `open` (show the editor / details)
 * unless the click landed on a control inside the row. Selecting rows is left
 * to their checkboxes.
 */
export const openOnRowClick = (open) => (event) => {
  if (event.target.closest(INTERACTIVE)) return;
  // Don't hijack a text selection the admin is making
  if (window.getSelection?.()?.toString()) return;
  open();
};
