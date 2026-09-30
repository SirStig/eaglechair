import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import InitialContentContext from './contexts/InitialContentContext';
import './index.css';

import './config/axiosConfig';

// Same tree shape as entry-server. The value stays null on the client: the
// SSR content payload (window.__INITIAL_CONTENT__) is adopted by
// utils/contentDataLoader when it loads, which happens before hydration.
const app = (
  <React.StrictMode>
    <InitialContentContext.Provider value={null}>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </InitialContentContext.Provider>
  </React.StrictMode>
);

const container = document.getElementById('root');

// Only hydrate when the SSR server actually rendered markup. Apache/FastAPI
// serve the bare index.html, and hydrating an empty root forces React to
// throw away the attempt (hydration mismatch) and re-render from scratch.
if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
