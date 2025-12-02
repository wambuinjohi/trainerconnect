#!/bin/bash
# Clean build script - removes all caches before building
# This ensures a fresh Vite deps optimization

set -e

echo "🧹 Cleaning build artifacts..."

# Remove dist directory
if [ -d "dist" ]; then
  rm -rf dist
  echo "✓ Removed dist/"
fi

# Remove node_modules/.vite directory (Vite deps cache)
if [ -d "node_modules/.vite" ]; then
  rm -rf node_modules/.vite
  echo "✓ Removed node_modules/.vite/"
fi

# Remove node_modules/.cache directory if it exists
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "✓ Removed node_modules/.cache/"
fi

echo "✓ Clean complete"
echo "🏗️  Building application..."

npm run build

echo "✅ Build successful!"
