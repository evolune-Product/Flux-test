#!/bin/bash

# OAuth Debugging Script for Contabo Deployment
# Run this on your Contabo server to diagnose OAuth issues

echo "=================================="
echo "OAuth Debugging Tool"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Checking Environment Variables...${NC}"
echo "-----------------------------------"

if [ -f /home/appuser/app/backend/.env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"

    # Check critical variables (without showing secrets)
    if grep -q "BACKEND_URL=" /home/appuser/app/backend/.env; then
        BACKEND_URL=$(grep "BACKEND_URL=" /home/appuser/app/backend/.env | cut -d '=' -f2)
        echo -e "${GREEN}✓${NC} BACKEND_URL is set: $BACKEND_URL"
    else
        echo -e "${RED}✗${NC} BACKEND_URL is NOT set"
    fi

    if grep -q "FRONTEND_URL=" /home/appuser/app/backend/.env; then
        FRONTEND_URL=$(grep "FRONTEND_URL=" /home/appuser/app/backend/.env | cut -d '=' -f2)
        echo -e "${GREEN}✓${NC} FRONTEND_URL is set: $FRONTEND_URL"
    else
        echo -e "${RED}✗${NC} FRONTEND_URL is NOT set"
    fi

    if grep -q "GOOGLE_CLIENT_ID=" /home/appuser/app/backend/.env && [ -n "$(grep "GOOGLE_CLIENT_ID=" /home/appuser/app/backend/.env | cut -d '=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} GOOGLE_CLIENT_ID is set"
    else
        echo -e "${RED}✗${NC} GOOGLE_CLIENT_ID is NOT set or empty"
    fi

    if grep -q "GOOGLE_CLIENT_SECRET=" /home/appuser/app/backend/.env && [ -n "$(grep "GOOGLE_CLIENT_SECRET=" /home/appuser/app/backend/.env | cut -d '=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} GOOGLE_CLIENT_SECRET is set"
    else
        echo -e "${RED}✗${NC} GOOGLE_CLIENT_SECRET is NOT set or empty"
    fi

    if grep -q "GITHUB_CLIENT_ID=" /home/appuser/app/backend/.env && [ -n "$(grep "GITHUB_CLIENT_ID=" /home/appuser/app/backend/.env | cut -d '=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} GITHUB_CLIENT_ID is set"
    else
        echo -e "${RED}✗${NC} GITHUB_CLIENT_ID is NOT set or empty"
    fi

    if grep -q "GITHUB_CLIENT_SECRET=" /home/appuser/app/backend/.env && [ -n "$(grep "GITHUB_CLIENT_SECRET=" /home/appuser/app/backend/.env | cut -d '=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} GITHUB_CLIENT_SECRET is set"
    else
        echo -e "${RED}✗${NC} GITHUB_CLIENT_SECRET is NOT set or empty"
    fi

    if grep -q "SECRET_KEY=" /home/appuser/app/backend/.env && [ -n "$(grep "SECRET_KEY=" /home/appuser/app/backend/.env | cut -d '=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} SECRET_KEY is set"
    else
        echo -e "${RED}✗${NC} SECRET_KEY is NOT set or empty"
    fi
else
    echo -e "${RED}✗${NC} .env file not found at /home/appuser/app/backend/.env"
fi

echo ""
echo -e "${YELLOW}2. Checking Backend Service Status...${NC}"
echo "-----------------------------------"
systemctl is-active --quiet evo-tfx-backend
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Backend service is running"
else
    echo -e "${RED}✗${NC} Backend service is NOT running"
    echo "Starting service..."
    sudo systemctl start evo-tfx-backend
fi

echo ""
echo -e "${YELLOW}3. Checking Recent Backend Logs (Last 30 lines)...${NC}"
echo "-----------------------------------"
sudo journalctl -u evo-tfx-backend -n 30 --no-pager

echo ""
echo -e "${YELLOW}4. Checking for OAuth-related errors...${NC}"
echo "-----------------------------------"
sudo journalctl -u evo-tfx-backend --since "1 hour ago" --no-pager | grep -i "oauth\|google\|github\|auth" | tail -20

echo ""
echo -e "${YELLOW}5. Testing Backend API Endpoints...${NC}"
echo "-----------------------------------"

# Test health endpoint
echo "Testing health endpoint..."
curl -s http://localhost:8000/ || curl -s http://localhost:8000/health
echo ""

# Test Google OAuth redirect
echo ""
echo "Testing Google OAuth redirect URL..."
curl -s -I http://localhost:8000/auth/google | head -5
echo ""

# Test GitHub OAuth redirect
echo ""
echo "Testing GitHub OAuth redirect URL..."
curl -s -I http://localhost:8000/auth/github | head -5
echo ""

echo ""
echo -e "${YELLOW}6. Checking Nginx Configuration...${NC}"
echo "-----------------------------------"
if [ -f /etc/nginx/sites-enabled/evo-tfx ]; then
    echo -e "${GREEN}✓${NC} Nginx config exists"
    echo "Checking /auth proxy configuration..."
    grep -A 5 "location /auth" /etc/nginx/sites-enabled/evo-tfx
else
    echo -e "${RED}✗${NC} Nginx config not found"
fi

echo ""
echo -e "${YELLOW}7. Checking Nginx Status...${NC}"
echo "-----------------------------------"
systemctl is-active --quiet nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Nginx is running"
else
    echo -e "${RED}✗${NC} Nginx is NOT running"
fi

echo ""
echo -e "${YELLOW}8. Checking Frontend Build...${NC}"
echo "-----------------------------------"
if [ -f /home/appuser/app/frontend/dist/index.html ]; then
    echo -e "${GREEN}✓${NC} Frontend build exists"
    echo "Checking for API_BASE_URL in build..."
    if grep -q "localhost:8000" /home/appuser/app/frontend/dist/assets/*.js 2>/dev/null; then
        echo -e "${RED}✗${NC} Frontend still has localhost:8000 references!"
        echo "You need to rebuild frontend with correct API URL"
    else
        echo -e "${GREEN}✓${NC} Frontend appears to be built for production"
    fi
else
    echo -e "${RED}✗${NC} Frontend build not found"
fi

echo ""
echo -e "${YELLOW}9. Expected OAuth Callback URLs${NC}"
echo "-----------------------------------"
if [ ! -z "$BACKEND_URL" ]; then
    echo "Google callback: ${BACKEND_URL}/auth/google/callback"
    echo "GitHub callback: ${BACKEND_URL}/auth/github/callback"
    echo ""
    echo "Make sure these URLs are added to:"
    echo "  - Google Cloud Console: https://console.cloud.google.com/apis/credentials"
    echo "  - GitHub OAuth Apps: https://github.com/settings/developers"
else
    echo -e "${RED}BACKEND_URL not set - cannot determine callback URLs${NC}"
fi

echo ""
echo "=================================="
echo -e "${YELLOW}10. Recommendations${NC}"
echo "=================================="
echo ""
echo "If OAuth is still failing, check:"
echo "1. Backend logs above for specific error messages"
echo "2. Google/GitHub OAuth console for redirect URI matches"
echo "3. Environment variables are correctly set"
echo "4. Frontend is rebuilt with production API URL"
echo "5. HTTPS is working (check SSL certificate)"
echo ""
echo "To view live logs, run:"
echo "  sudo journalctl -u evo-tfx-backend -f"
echo ""
echo "To restart backend:"
echo "  sudo systemctl restart evo-tfx-backend"
echo ""
