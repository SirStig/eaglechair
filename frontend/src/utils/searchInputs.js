/**
 * Search fields site-wide: no autocorrect, autocapitalize, autocomplete or
 * spellcheck. Model numbers, SKUs and finish codes ("6246P", "TR-24") get
 * "corrected" into words otherwise.
 *
 * Applied on focus, before the first keystroke, so every search box is
 * covered - including ones added later - without repeating the attributes
 * on each input. An input opts out with data-autocorrect="on".
 */

const SEARCH_HINT = /search/i;

const isSearchField = (el) => {
  if (!(el instanceof HTMLInputElement) || el.dataset.autocorrect === 'on') return false;
  if (el.type === 'search') return true;
  if (el.type !== 'text' && el.type !== '') return false;
  return (
    SEARCH_HINT.test(el.placeholder || '') ||
    SEARCH_HINT.test(el.getAttribute('aria-label') || '') ||
    SEARCH_HINT.test(el.name || '') ||
    el.getAttribute('role') === 'searchbox' ||
    el.getAttribute('role') === 'combobox'
  );
};

const disableAssists = (el) => {
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('autocapitalize', 'off');
  el.setAttribute('autocomplete', 'off');
  el.spellcheck = false;
};

export const installSearchInputDefaults = () => {
  if (typeof document === 'undefined') return;
  document.addEventListener(
    'focusin',
    (event) => {
      if (isSearchField(event.target)) disableAssists(event.target);
    },
    true,
  );
};

export default installSearchInputDefaults;
