#!/bin/bash

# Environment Setup Script - Creates .env file for production

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Environment Setup for Evo-TFX${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Navigate to backend directory
cd /home/appuser/app/backend || cd /home/appuser/app/Flux-test/backend || { echo -e "${RED}Cannot find backend directory${NC}"; exit 1; }

echo -e "${YELLOW}Creating .env file...${NC}"
echo ""

# Generate a secure SECRET_KEY
echo "Generating secure SECRET_KEY..."
SECRET_KEY=$(openssl rand -hex 32)
echo -e "${GREEN}✓${NC} SECRET_KEY generated"
echo ""

# Collect information
echo "Please provide the following information:"
echo ""

# Domain
read -p "Domain (default: https://fluxtest.evolune.in): " DOMAIN
DOMAIN=${DOMAIN:-https://fluxtest.evolune.in}

# Database password
echo ""
echo -e "${YELLOW}Database Configuration${NC}"
read -p "PostgreSQL database password: " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Database password is required!${NC}"
    exit 1
fi

# OpenAI API Key
echo ""
echo -e "${YELLOW}OpenAI API Key${NC}"
read -p "OpenAI API Key: " OPENAI_KEY
if [ -z "$OPENAI_KEY" ]; then
    echo -e "${YELLOW}Warning: OpenAI API Key not provided. Test generation won't work.${NC}"
    OPENAI_KEY="your-openai-api-key-here"
fi

# Google OAuth
echo ""
echo -e "${YELLOW}Google OAuth Credentials${NC}"
echo "Get these from: https://console.cloud.google.com/apis/credentials"
read -p "Google Client ID: " GOOGLE_ID
read -p "Google Client Secret: " GOOGLE_SECRET

if [ -z "$GOOGLE_ID" ] || [ -z "$GOOGLE_SECRET" ]; then
    echo -e "${YELLOW}Warning: Google OAuth not configured. Google login won't work.${NC}"
    GOOGLE_ID="your-google-client-id"
    GOOGLE_SECRET="your-google-client-secret"
fi

# GitHub OAuth
echo ""
echo -e "${YELLOW}GitHub OAuth Credentials${NC}"
echo "Get these from: https://github.com/settings/developers"
read -p "GitHub Client ID: " GITHUB_ID
read -p "GitHub Client Secret: " GITHUB_SECRET

if [ -z "$GITHUB_ID" ] || [ -z "$GITHUB_SECRET" ]; then
    echo -e "${YELLOW}Warning: GitHub OAuth not configured. GitHub login won't work.${NC}"
    GITHUB_ID="your-github-client-id"
    GITHUB_SECRET="your-github-client-secret"
fi

# GitHub Repo OAuth (optional)
echo ""
echo -e "${YELLOW}GitHub Repository OAuth (Optional - for repo integration)${NC}"
read -p "GitHub Repo Client ID (press Enter to skip): " GITHUB_REPO_ID
read -p "GitHub Repo Client Secret (press Enter to skip): " GITHUB_REPO_SECRET

if [ -z "$GITHUB_REPO_ID" ]; then
    GITHUB_REPO_ID="your-github-repo-client-id"
fi
if [ -z "$GITHUB_REPO_SECRET" ]; then
    GITHUB_REPO_SECRET="your-github-repo-client-secret"
fi

# Create .env file
echo ""
echo -e "${YELLOW}Writing .env file...${NC}"

cat > .env << EOF
# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://evo_tfx_user:${DB_PASSWORD}@localhost/evo_tfx_db

# Security
SECRET_KEY=${SECRET_KEY}

# Frontend & Backend URLs
BACKEND_URL=${DOMAIN}
FRONTEND_URL=${DOMAIN}
ALLOWED_ORIGINS=${DOMAIN}

# OpenAI API Key (for test generation)
OPENAI_API_KEY=${OPENAI_KEY}

# Google OAuth
GOOGLE_CLIENT_ID=${GOOGLE_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_SECRET}

# GitHub OAuth (for login)
GITHUB_CLIENT_ID=${GITHUB_ID}
GITHUB_CLIENT_SECRET=${GITHUB_SECRET}

# GitHub OAuth (for repository access - optional)
GITHUB_REPO_CLIENT_ID=${GITHUB_REPO_ID}
GITHUB_REPO_CLIENT_SECRET=${GITHUB_REPO_SECRET}
EOF

echo -e "${GREEN}✓${NC} .env file created successfully!"
echo ""

# Set proper permissions
chmod 600 .env
echo -e "${GREEN}✓${NC} Permissions set to 600 (owner read/write only)"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Configuration file created at:"
echo "  $(pwd)/.env"
echo ""
echo -e "${YELLOW}IMPORTANT: Configure OAuth Redirect URIs${NC}"
echo ""
echo "1. Google OAuth Redirect URI:"
echo "   ${DOMAIN}/auth/google/callback"
echo "   Add at: https://console.cloud.google.com/apis/credentials"
echo ""
echo "2. GitHub OAuth Callback URL:"
echo "   ${DOMAIN}/auth/github/callback"
echo "   Add at: https://github.com/settings/developers"
echo ""
echo "Next steps:"
echo "1. Verify the .env file: cat backend/.env"
echo "2. Run: ./fix_oauth_production.sh"
echo "3. Or manually restart: sudo systemctl restart evo-tfx-backend"
echo ""
