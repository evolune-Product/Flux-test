#!/bin/bash

# OAuth Production Fix Script for Contabo
# This script fixes common OAuth issues in production

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  OAuth Production Fix Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as appuser
if [ "$USER" != "appuser" ]; then
    echo -e "${RED}Error: This script must be run as appuser${NC}"
    echo "Please run: su - appuser"
    echo "Then run this script again"
    exit 1
fi

# Navigate to app directory
cd /home/appuser/app || { echo -e "${RED}Failed to navigate to app directory${NC}"; exit 1; }

echo -e "${YELLOW}Step 1: Backing up current configuration...${NC}"
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓${NC} Backup created"
echo ""

echo -e "${YELLOW}Step 2: Checking environment variables...${NC}"

# Function to update or add env variable
update_env() {
    local key=$1
    local value=$2
    local file="backend/.env"

    if grep -q "^${key}=" "$file"; then
        # Update existing
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        echo -e "${GREEN}✓${NC} Updated $key"
    else
        # Add new
        echo "${key}=${value}" >> "$file"
        echo -e "${GREEN}✓${NC} Added $key"
    fi
}

# Get domain from user or use default
read -p "Enter your domain (default: https://fluxtest.evolune.in): " DOMAIN
DOMAIN=${DOMAIN:-https://fluxtest.evolune.in}

echo ""
echo "Updating environment variables..."
update_env "BACKEND_URL" "$DOMAIN"
update_env "FRONTEND_URL" "$DOMAIN"
update_env "ALLOWED_ORIGINS" "$DOMAIN"

echo ""
echo -e "${GREEN}✓${NC} Environment variables updated"
echo ""

echo -e "${YELLOW}Step 3: Verifying OAuth credentials...${NC}"

# Check if OAuth credentials exist
if ! grep -q "^GOOGLE_CLIENT_ID=.\+" backend/.env; then
    echo -e "${YELLOW}⚠${NC}  GOOGLE_CLIENT_ID not set or empty"
    read -p "Enter Google Client ID (or press Enter to skip): " GOOGLE_ID
    if [ ! -z "$GOOGLE_ID" ]; then
        update_env "GOOGLE_CLIENT_ID" "$GOOGLE_ID"
    fi
fi

if ! grep -q "^GOOGLE_CLIENT_SECRET=.\+" backend/.env; then
    echo -e "${YELLOW}⚠${NC}  GOOGLE_CLIENT_SECRET not set or empty"
    read -p "Enter Google Client Secret (or press Enter to skip): " GOOGLE_SECRET
    if [ ! -z "$GOOGLE_SECRET" ]; then
        update_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_SECRET"
    fi
fi

if ! grep -q "^GITHUB_CLIENT_ID=.\+" backend/.env; then
    echo -e "${YELLOW}⚠${NC}  GITHUB_CLIENT_ID not set or empty"
    read -p "Enter GitHub Client ID (or press Enter to skip): " GITHUB_ID
    if [ ! -z "$GITHUB_ID" ]; then
        update_env "GITHUB_CLIENT_ID" "$GITHUB_ID"
    fi
fi

if ! grep -q "^GITHUB_CLIENT_SECRET=.\+" backend/.env; then
    echo -e "${YELLOW}⚠${NC}  GITHUB_CLIENT_SECRET not set or empty"
    read -p "Enter GitHub Client Secret (or press Enter to skip): " GITHUB_SECRET
    if [ ! -z "$GITHUB_SECRET" ]; then
        update_env "GITHUB_CLIENT_SECRET" "$GITHUB_SECRET"
    fi
fi

echo ""
echo -e "${GREEN}✓${NC} OAuth credentials verified"
echo ""

echo -e "${YELLOW}Step 4: Pulling latest code from GitHub...${NC}"
git pull origin master
echo -e "${GREEN}✓${NC} Code updated"
echo ""

echo -e "${YELLOW}Step 5: Updating backend dependencies...${NC}"
cd backend
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
cd ..
echo -e "${GREEN}✓${NC} Backend dependencies updated"
echo ""

echo -e "${YELLOW}Step 6: Rebuilding frontend with production API URL...${NC}"
cd frontend

# Set production API URL
export VITE_API_BASE_URL="$DOMAIN"

# Clean previous build
rm -rf dist

# Install dependencies (in case there are updates)
echo "Installing frontend dependencies..."
npm install --silent

# Build for production
echo "Building frontend for production..."
npm run build

if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}✗${NC} Frontend build failed!"
    exit 1
fi

# Verify no localhost references in build
if grep -r "localhost:8000" dist/ 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC}  Warning: Found localhost:8000 references in build"
    echo "This might cause issues in production"
else
    echo -e "${GREEN}✓${NC} Frontend built successfully with production URL"
fi

cd ..
echo ""

echo -e "${YELLOW}Step 7: Restarting backend service...${NC}"
sudo systemctl restart evo-tfx-backend

# Wait for service to start
sleep 3

# Check if service is running
if sudo systemctl is-active --quiet evo-tfx-backend; then
    echo -e "${GREEN}✓${NC} Backend service restarted successfully"
else
    echo -e "${RED}✗${NC} Backend service failed to start"
    echo "Checking logs..."
    sudo journalctl -u evo-tfx-backend -n 20 --no-pager
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 8: Checking service status...${NC}"
sudo systemctl status evo-tfx-backend --no-pager | head -15
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ OAuth Fix Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Verify OAuth Redirect URIs in Google Cloud Console:"
echo "   ${DOMAIN}/auth/google/callback"
echo ""
echo "2. Verify OAuth Callback URL in GitHub OAuth App:"
echo "   ${DOMAIN}/auth/github/callback"
echo ""
echo "3. Test OAuth login at:"
echo "   ${DOMAIN}"
echo ""
echo "4. Monitor backend logs:"
echo "   sudo journalctl -u evo-tfx-backend -f"
echo ""
echo -e "${YELLOW}Configuration backup saved at:${NC}"
echo "   backend/.env.backup.*"
echo ""
