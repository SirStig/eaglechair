import { useEffect } from 'react';

const NON_PRIMARY = /^(order|#|image|images|photo|sample|swatch|icon|preview|thumbnail|actions?)$/i;

/**
 * Lets admin list tables collapse into labelled cards on phones (see
 * `.admin-stack` in index.css) without each section writing a mobile layout:
 * copies every column header's text onto its body cells as `data-label`.
 *
 * Applies to tables inside `containerRef`; opt a table out with
 * `data-stack="off"`.
 */
export function useStackedTables(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const labelTable = (table) => {
      if (table.dataset.stack === 'off') return;
      table.classList.add('admin-stack');
      const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
      if (!headRow) return;

      // Expand header colSpans so labels line up with body cell positions
      const labels = [];
      for (const th of headRow.cells) {
        const text = th.textContent.replace(/\s+/g, ' ').trim();
        for (let i = 0; i < (th.colSpan || 1); i += 1) labels.push(text);
      }

      // The first descriptive column (product, company, quote #…) becomes the
      // card title; media and bookkeeping columns are skipped
      const primaryIndex = labels.findIndex((l) => l && !NON_PRIMARY.test(l));

      for (const body of table.tBodies) {
        for (const row of body.rows) {
          let col = 0;
          for (const cell of row.cells) {
            const span = cell.colSpan || 1;
            // Full-width rows (empty states, expanded details) get no label
            const label = span > 1 ? '' : labels[col] || '';
            if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
            if (span === 1 && col === primaryIndex) cell.setAttribute('data-primary', '');
            else if (cell.hasAttribute('data-primary')) cell.removeAttribute('data-primary');
            col += span;
          }
        }
      }
    };

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.querySelectorAll('table').forEach(labelTable));
    };

    run();
    // No attribute observation: our own data-label writes must not re-trigger it
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef]);
}

export default useStackedTables;
