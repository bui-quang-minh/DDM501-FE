#!/usr/bin/env bash
set -e

echo "==> Installing npm dependencies..."
npm install

echo ""
echo "==> Checking environment file..."
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "    Created .env.local from .env.example"
  echo "    Edit NEXT_PUBLIC_API_URL if needed."
else
  echo "    .env.local already exists — skipping."
fi

echo ""
echo "==> Done. Start dev server with:  npm run dev   (port 3001)"
echo "    Production build:             npm run build && npm run start  (port 3000)"
