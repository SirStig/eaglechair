// Clicks on these never count as "open this row"
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="switch"], [data-select-cell], [data-no-row-click]';

const openInNewTab = (href) => window.open(href, '_blank', 'noopener');

/**
 * onClick handler for a list row: runs `open` (show the editor / details)
 * unless the click landed on a control inside the row. Selecting rows is left
 * to their checkboxes.
 *
 * Pass `href` (the URL `open` navigates to) so Cmd/Ctrl-click opens the row in
 * a new tab, like a real link would.
 */
export const openOnRowClick = (open, href) => (event) => {
  if (event.target.closest(INTERACTIVE)) return;
  // Don't hijack a text selection the admin is making
  if (window.getSelection?.()?.toString()) return;
  if (href && (event.metaKey || event.ctrlKey)) {
    openInNewTab(href);
    return;
  }
  open();
};

/** onAuxClick handler for a list row: middle-click opens `href` in a new tab. */
export const openRowInNewTab = (href) => (event) => {
  if (event.button !== 1 || event.target.closest(INTERACTIVE)) return;
  event.preventDefault();
  openInNewTab(href);
};
