import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

import './config/axiosConfig';

const app = (
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
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
