#!/bin/bash
# Production build script with verification
# Ensures API URL is correctly set before building

echo "========================================"
echo "EagleChair Frontend - Production Build"
echo "========================================"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: .env.production file not found!"
    echo "Please create .env.production with VITE_API_BASE_URL set"
    exit 1
fi

# Source the .env.production file to check variables
source .env.production

# Verify API URL is set
if [ -z "$VITE_API_BASE_URL" ]; then
    echo "❌ ERROR: VITE_API_BASE_URL is not set in .env.production"
    echo "Please set VITE_API_BASE_URL=https://api.eaglechair.com"
    exit 1
fi

# Verify it's not localhost
if [[ "$VITE_API_BASE_URL" == *"localhost"* ]]; then
    echo "❌ ERROR: VITE_API_BASE_URL is set to localhost!"
    echo "For production, use: VITE_API_BASE_URL=https://api.eaglechair.com"
    exit 1
fi

echo "✅ API URL: $VITE_API_BASE_URL"
echo "✅ Demo Mode: ${VITE_DEMO_MODE:-false}"
echo ""
echo "Building production bundle..."
echo ""

# Run the build
npm run build:production

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ Production build completed successfully!"
    echo "========================================"
    echo ""
    echo "Build output: dist/"
    echo ""
    echo "Verify your build:"
    echo "  - Check dist/index.html for hashed asset filenames"
    echo "  - Ensure dist/data/contentData.js exists"
    echo ""
    echo "Deploy command:"
    echo "  scp -r dist/* user@server:/path/to/public/"
    echo ""
else
    echo ""
    echo "========================================"
    echo "❌ Build failed!"
    echo "========================================"
    exit 1
fi
