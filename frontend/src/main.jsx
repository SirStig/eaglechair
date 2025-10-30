import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// CRITICAL: Configure axios globally BEFORE anything else
// This ensures all axios instances use the correct API base URL
import './config/axiosConfig';

// Import axios interceptor for automatic token refresh
import './services/axios-interceptor';

// Import Slick Carousel CSS
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
