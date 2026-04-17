import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';

/**
 * Server-side render entry point.
 *
 * Returns a Promise that resolves with { pipe, helmet } once the full
 * component tree (including all lazy-loaded pages) is ready.
 * The caller buffers `pipe` into a string and splices it into the HTML
 * template alongside the helmet head tags.
 */
export function render(url) {
  return new Promise((resolve, reject) => {
    const helmetContext = {};

    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </HelmetProvider>,
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
