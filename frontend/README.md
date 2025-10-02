# EagleChair Frontend

Modern frontend application built with React 19, Vite, and Material UI.

## Tech Stack

- **React 19** - Latest React with improved performance
- **Vite** - Next-generation frontend tooling
- **Material UI v7** - Comprehensive React component library
- **React Router v7** - Client-side routing
- **Axios** - HTTP client for API calls
- **Emotion** - CSS-in-JS styling

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   └── Layout.jsx   # Main layout with navigation
│   ├── pages/          # Page components
│   │   ├── Home.jsx
│   │   ├── Products.jsx
│   │   ├── Quotes.jsx
│   │   └── About.jsx
│   ├── theme.js        # Material UI theme configuration
│   ├── App.jsx         # Root component with routing
│   ├── main.jsx        # Application entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── .env.example        # Environment variables template
└── vite.config.js      # Vite configuration
```

## Features

- 📱 Responsive design with mobile-first approach
- 🎨 Modern Material Design UI
- 🚀 Fast development with Vite HMR
- 🔄 Client-side routing with React Router
- 🎯 TypeScript-ready (types included)
- 📦 Optimized production builds

## Environment Variables

Create a `.env` file in the frontend directory:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME=EagleChair
```

## API Integration

The frontend is configured to proxy API requests to the backend:

- Development API: `http://localhost:8000`
- All `/api/*` requests are automatically proxied

## Building for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` directory.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Private - All rights reserved
