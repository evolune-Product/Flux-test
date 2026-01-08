#!/bin/bash

# Quick OAuth Fix - Run from /app/Flux-test directory

echo "========================================="
echo "  Quick OAuth Fix"
echo "========================================="
echo ""

# Check we're in the right directory
if [ ! -f "backend/.env" ]; then
    echo "ERROR: backend/.env not found!"
    echo "Make sure you're in the /app/Flux-test directory"
    pwd
    exit 1
fi

echo "Current directory: $(pwd)"
echo ""

# 1. Update .env file with production URLs
echo "Step 1: Updating .env with production URLs..."

# Function to update env variable
update_env_var() {
    local key=$1
    local value=$2
    local file="backend/.env"

    if grep -q "^${key}=" "$file"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        echo "  ✓ Updated $key"
    else
        echo "${key}=${value}" >> "$file"
        echo "  ✓ Added $key"
    fi
}

# Set production URLs
update_env_var "BACKEND_URL" "https://fluxtest.evolune.in"
update_env_var "FRONTEND_URL" "https://fluxtest.evolune.in"
update_env_var "ALLOWED_ORIGINS" "https://fluxtest.evolune.in"

echo ""
echo "Step 2: Pulling latest code (with SessionMiddleware fix)..."
git pull origin master

echo ""
echo "Step 3: Updating backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt --quiet
cd ..

echo ""
echo "Step 4: Rebuilding frontend with production URL..."
cd frontend
export VITE_API_BASE_URL="https://fluxtest.evolune.in"
rm -rf dist
npm install --silent
npm run build

if [ ! -f "dist/index.html" ]; then
    echo "ERROR: Frontend build failed!"
    exit 1
fi

cd ..

echo ""
echo "Step 5: Restarting backend service..."
sudo systemctl restart evo-tfx-backend
sleep 2

echo ""
echo "Step 6: Checking service status..."
sudo systemctl status evo-tfx-backend --no-pager | head -10

echo ""
echo "========================================="
echo "  Fix Complete!"
echo "========================================="
echo ""
echo "IMPORTANT: Make sure you've configured:"
echo ""
echo "1. Google OAuth Redirect URI:"
echo "   https://fluxtest.evolune.in/auth/google/callback"
echo "   At: https://console.cloud.google.com/apis/credentials"
echo ""
echo "2. GitHub OAuth Callback URL:"
echo "   https://fluxtest.evolune.in/auth/github/callback"
echo "   At: https://github.com/settings/developers"
echo ""
echo "Now test at: https://fluxtest.evolune.in"
echo ""
echo "View logs: sudo journalctl -u evo-tfx-backend -f"
echo ""
