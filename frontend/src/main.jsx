import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

// CRITICAL: Configure axios globally BEFORE anything else
// This ensures all axios instances use the correct API base URL
import './config/axiosConfig';

// Token refresh is now handled in apiClient.js - no need for separate interceptor

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
