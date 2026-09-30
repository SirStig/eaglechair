import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import InitialContentContext from './contexts/InitialContentContext';

/**
 * Server-side render entry point.
 *
 * Returns a Promise that resolves with { pipe, helmet } once the full
 * component tree (including all lazy-loaded pages) is ready.
 *
 * `initialContent` is the parsed contentData.json. It is provided through
 * context (per request - never module state shared between concurrent
 * renders) so content hooks render real CMS data synchronously; the server
 * embeds the same object as window.__INITIAL_CONTENT__ for hydration.
 * The caller buffers `pipe` into a string and splices it into the HTML
 * template alongside the helmet head tags.
 */
export function render(url, { initialContent = null } = {}) {
  return new Promise((resolve, reject) => {
    const helmetContext = {};

    const { pipe, abort } = renderToPipeableStream(
      <InitialContentContext.Provider value={initialContent}>
        <HelmetProvider context={helmetContext}>
          <StaticRouter location={url}>
            <App />
          </StaticRouter>
        </HelmetProvider>
      </InitialContentContext.Provider>,
      {
        onAllReady() {
          resolve({ pipe, helmet: helmetContext.helmet });
        },
        onShellError(err) {
          reject(err);
        },
        onError(err) {
          // Log but don't reject — shell errors are caught by onShellError
          console.error('[SSR]', err);
        },
      }
    );

    // Abort after 10 s to avoid hanging requests
    setTimeout(abort, 10_000);
  });
}
