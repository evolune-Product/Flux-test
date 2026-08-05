# Flasqo — Contabo Deployment Guide
**Domain:** `flasqo.com`
**Stack:** FastAPI + React/Vite + PostgreSQL + Redis + Nginx + Gunicorn

---

## Table of Contents
1. [Architecture](#architecture)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Phase 1 — Server Setup](#phase-1--server-setup)
4. [Phase 2 — Database & Redis](#phase-2--database--redis)
5. [Phase 3 — Backend Deployment](#phase-3--backend-deployment)
6. [Phase 4 — Frontend Build](#phase-4--frontend-build)
7. [Phase 5 — Nginx Configuration](#phase-5--nginx-configuration)
8. [Phase 6 — DNS Configuration](#phase-6--dns-configuration)
9. [Phase 7 — SSL Certificate](#phase-7--ssl-certificate)
10. [Phase 8 — OAuth Configuration](#phase-8--oauth-configuration)
11. [Phase 9 — Verification](#phase-9--verification)
12. [Updating the App](#updating-the-app)
13. [Auto-Deployment with GitHub Actions](#auto-deployment-with-github-actions)
14. [Maintenance & Monitoring](#maintenance--monitoring)
15. [Troubleshooting](#troubleshooting)
16. [Quick Reference](#quick-reference)

---

## Architecture

```
Browser
   ↓ HTTPS (443)
Nginx ─────────────────────────────────────────────────
   ├── /                → React SPA (frontend/dist/)
   ├── /api/*           → FastAPI (127.0.0.1:8000)
   ├── /auth/*          → FastAPI OAuth (127.0.0.1:8000)
   ├── /history/*       → FastAPI (127.0.0.1:8000)
   ├── /flows/*         → FastAPI (127.0.0.1:8000)
   ├── /report/*        → FastAPI (127.0.0.1:8000)
   ├── /dashboard/*     → FastAPI (127.0.0.1:8000)
   ├── /regression/*    → FastAPI (127.0.0.1:8000)
   ├── /contract/*      → FastAPI (127.0.0.1:8000)
   ├── /graphql/*       → FastAPI (127.0.0.1:8000)
   ├── /teams/*         → FastAPI (127.0.0.1:8000)
   └── /github/*        → FastAPI (127.0.0.1:8000)
         ↓
   PostgreSQL (127.0.0.1:5432)
   Redis      (127.0.0.1:6379)
```

**All paths on server:**
```
/home/flasqo/app/Flux-test/
├── backend/
│   ├── backend.py
│   ├── requirements.txt
│   ├── .env                  ← created manually (not in git)
│   ├── venv/                 ← created by pip install
│   └── logs/                 ← created manually
└── frontend/
    ├── src/
    ├── .env.production       ← created manually (not in git)
    ├── node_modules/         ← created by npm install
    └── dist/                 ← created by npm run build
```

---

## Pre-Deployment Checklist

Before starting, have these ready:

- [ ] Contabo VPS IP address
- [ ] Root SSH credentials for VPS
- [ ] Access to `flasqo.com` DNS panel (your domain registrar or Cloudflare)
- [ ] Google OAuth Client ID & Secret
- [ ] GitHub OAuth Client ID & Secret — both apps (auth + repo)
- [ ] OpenAI API key

---

## Phase 1 — Server Setup

### Step 1.1 — SSH into your Contabo VPS

```bash
ssh root@YOUR_CONTABO_IP
```

### Step 1.2 — Update system packages

```bash
apt update && apt upgrade -y
```

### Step 1.3 — Install all required software

```bash
apt install -y \
    nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    ufw \
    certbot \
    python3-certbot-nginx \
    curl \
    build-essential \
    libpq-dev

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### Step 1.4 — Verify installations

```bash
python3 --version    # 3.10+
node --version       # v20+
npm --version        # 10+
nginx -v
psql --version
redis-server --version
```

### Step 1.5 — Configure firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

### Step 1.6 — Create application user

```bash
adduser flasqo
```

> You will be prompted to set a password and fill in user info. Enter a strong password and save it — you will need it when switching to this user via `su - flasqo`. Press Enter to skip the optional info fields (name, phone, etc.).

---

## Phase 2 — Database & Redis

### Step 2.1 — Set up PostgreSQL

```bash
sudo -u postgres psql
```

Run inside the PostgreSQL shell:

```sql
CREATE DATABASE flasqo_db;
CREATE USER flasqo_user WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE flasqo_db TO flasqo_user;
ALTER DATABASE flasqo_db OWNER TO flasqo_user;
\q
```

> Save this password — you need it in the `.env` file.

### Step 2.2 — Test database connection

```bash
psql -U flasqo_user -d flasqo_db -h localhost
# Enter password, then:
\q
```

### Step 2.3 — Enable Redis

```bash
systemctl enable redis-server
systemctl start redis-server
redis-cli ping
# Expected output: PONG
```

---

## Phase 3 — Backend Deployment

### Step 3.1 — Clone the repository

```bash
su - flasqo
mkdir -p /home/flasqo/app
cd /home/flasqo/app
git clone YOUR_GIT_REPO_URL Flux-test
cd Flux-test
```

> This gives you: `/home/flasqo/app/Flux-test/`

### Step 3.2 — Create the backend `.env` file

> This file is excluded from git, so you must create it manually on the server.

```bash
nano /home/flasqo/app/Flux-test/backend/.env
```

Paste and fill in all values:

```env
ENVIRONMENT=production

SECRET_KEY=GENERATE_THIS_BELOW
DATABASE_URL=postgresql://flasqo_user:YOUR_DB_PASSWORD@localhost:5432/flasqo_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
DB_ECHO=False

REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=300
CACHE_ENABLED=True

FRONTEND_URL=https://flasqo.com
BACKEND_URL=https://flasqo.com
ALLOWED_ORIGINS=

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

GITHUB_CLIENT_ID=YOUR_GITHUB_AUTH_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_AUTH_CLIENT_SECRET

GITHUB_REPO_CLIENT_ID=YOUR_GITHUB_REPO_CLIENT_ID
GITHUB_REPO_CLIENT_SECRET=YOUR_GITHUB_REPO_CLIENT_SECRET

OPENAI_API_KEY=YOUR_OPENAI_API_KEY

HTTPS_ONLY=True
SECURE_COOKIES=True
ENABLE_SECURITY_HEADERS=True
SESSION_SAME_SITE=none

RATE_LIMIT_ENABLED=True
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_AUTH_PER_MINUTE=5
RATE_LIMIT_BURST=10
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=900

SESSION_MAX_AGE=3600
ACCESS_TOKEN_EXPIRE_MINUTES=10080

MIN_PASSWORD_LENGTH=8
REQUIRE_SPECIAL_CHAR=True
REQUIRE_NUMBER=True
REQUIRE_UPPERCASE=True

LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=logs/app.log

ENABLE_METRICS=True
METRICS_PORT=9090

DEFAULT_TEST_TIMEOUT=10
MAX_TEST_CASES_PER_RUN=100
MAX_UPLOAD_SIZE=10485760

HOST=0.0.0.0
PORT=8000
WORKERS=4
REQUEST_TIMEOUT=30
KEEPALIVE_TIMEOUT=75
DEBUG=False
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

Generate the SECRET_KEY and paste it in:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 3.3 — Create the frontend `.env.production` file

> Also excluded from git — create it manually.

```bash
cat > /home/flasqo/app/Flux-test/frontend/.env.production << 'EOF'
VITE_API_BASE_URL=https://flasqo.com
EOF
```

### Step 3.4 — Set up Python virtual environment

```bash
cd /home/flasqo/app/Flux-test/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
# Playwright browser binaries (required for FullSend — separate from the Python package)
playwright install chromium
```

Verify:
```bash
which python
# Expected: /home/flasqo/app/Flux-test/backend/venv/bin/python
```

### Step 3.5 — Create logs directory

```bash
mkdir -p /home/flasqo/app/Flux-test/backend/logs
```

### Step 3.6 — Test backend starts correctly

```bash
cd /home/flasqo/app/Flux-test/backend
source venv/bin/activate
uvicorn backend:app --host 0.0.0.0 --port 8000
```

Open a second terminal and test:
```bash
curl http://localhost:8000/health
```

If you get a JSON response, press `Ctrl+C` and continue.

### Step 3.7 — Create systemd service

Exit back to root:
```bash
exit
```

```bash
nano /etc/systemd/system/flasqo-backend.service
```

Paste:
```ini
[Unit]
Description=Flasqo FastAPI Backend
After=network.target postgresql.service redis.service

[Service]
User=flasqo
Group=flasqo
WorkingDirectory=/home/flasqo/app/Flux-test/backend
Environment="PATH=/home/flasqo/app/Flux-test/backend/venv/bin"
EnvironmentFile=/home/flasqo/app/Flux-test/backend/.env
ExecStart=/home/flasqo/app/Flux-test/backend/venv/bin/gunicorn backend:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    -b 127.0.0.1:8000 \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile /home/flasqo/app/Flux-test/backend/logs/access.log \
    --error-logfile /home/flasqo/app/Flux-test/backend/logs/error.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Step 3.8 — Start and enable the backend service

```bash
systemctl daemon-reload
systemctl start flasqo-backend
systemctl enable flasqo-backend
systemctl status flasqo-backend
```

Expected:
```
● flasqo-backend.service - Flasqo FastAPI Backend
   Active: active (running)
```

View live logs:
```bash
journalctl -u flasqo-backend -f
```

---

## Phase 4 — Frontend Build

### Step 4.1 — Install dependencies and build

```bash
su - flasqo
cd /home/flasqo/app/Flux-test/frontend
npm install
npm run build
```

Verify the build:
```bash
ls dist/
# Should show: index.html  assets/
```

Exit back to root:
```bash
exit
```

### Step 4.2 — Set permissions for Nginx

```bash
chmod -R 755 /home/flasqo
chmod -R 755 /home/flasqo/app/Flux-test/frontend/dist
```

---

## Phase 5 — Nginx Configuration

### Step 5.1 — Create Nginx site config

```bash
nano /etc/nginx/sites-available/flasqo
```

Paste the full configuration:

```nginx
# Redirect www → non-www (HTTP)
server {
    listen 80;
    server_name www.flasqo.com;
    return 301 https://flasqo.com$request_uri;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name flasqo.com;
    return 301 https://$host$request_uri;
}

# Redirect www → non-www (HTTPS)
server {
    listen 443 ssl;
    server_name www.flasqo.com;

    # SSL — Certbot will fill these in automatically
    # ssl_certificate /etc/letsencrypt/live/flasqo.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/flasqo.com/privkey.pem;

    return 301 https://flasqo.com$request_uri;
}

server {
    listen 443 ssl;
    server_name flasqo.com;

    # SSL — Certbot will fill these in automatically
    # ssl_certificate /etc/letsencrypt/live/flasqo.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/flasqo.com/privkey.pem;

    # Frontend static files
    root /home/flasqo/app/Flux-test/frontend/dist;
    index index.html;

    # Upload limit
    client_max_body_size 10M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ── Backend routes ────────────────────────────────────────────────────────

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /auth {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    location /history {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /flows {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /report {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /dashboard {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /regression {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /contract {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /graphql {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /teams {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /github {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /generate-tests {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /run-tests {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /run-integration-tests {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /test-suites {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /integration-scenarios {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /analyze-failure {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /fullsend {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /discovery {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /vibe {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Frontend SPA catch-all (must be last) ─────────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Step 5.2 — Enable the site

```bash
ln -s /etc/nginx/sites-available/flasqo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
```

Expected:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
systemctl restart nginx
systemctl enable nginx
```

---

## Phase 6 — DNS Configuration

Log into your domain registrar's DNS panel for `flasqo.com` and add the following records:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `YOUR_CONTABO_IP` | 3600 |
| A | `www` | `YOUR_CONTABO_IP` | 3600 |

> `@` represents the root domain (`flasqo.com`). The `www` record ensures `www.flasqo.com` also resolves (Nginx will redirect it to the root domain).

Wait 5–30 minutes for DNS to propagate, then verify:
```bash
nslookup flasqo.com
# Should return your Contabo IP

nslookup www.flasqo.com
# Should also return your Contabo IP
```

Check propagation status online: https://dnschecker.org/#A/flasqo.com

---

## Phase 7 — SSL Certificate

> DNS must be propagated before this step. Both `flasqo.com` and `www.flasqo.com` must resolve to your server IP.

Issue a certificate covering both the root domain and www:

```bash
certbot --nginx -d flasqo.com -d www.flasqo.com
```

Follow the prompts:
1. Enter your email
2. Agree to terms: `Y`
3. Share with EFF: `N`
4. Redirect option: `2`

Certbot will automatically update the Nginx config with the SSL certificate paths.

Verify:
```bash
certbot certificates
certbot renew --dry-run
```

Visit `https://flasqo.com` — padlock should appear.
Also verify `https://www.flasqo.com` redirects to `https://flasqo.com`.

---

## Phase 8 — OAuth Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Click your OAuth 2.0 Client
3. **Authorized JavaScript origins** → add:
   ```
   https://flasqo.com
   ```
4. **Authorized redirect URIs** → add:
   ```
   https://flasqo.com/auth/google/callback
   ```
5. Save

### GitHub OAuth — Auth App

1. [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps
2. Click your auth app
3. **Homepage URL**: `https://flasqo.com`
4. **Callback URL**: `https://flasqo.com/auth/github/callback`
5. Update application

### GitHub OAuth — Repo App

1. Click your repo access app
2. **Homepage URL**: `https://flasqo.com`
3. **Callback URL**: `https://flasqo.com/github/callback`
4. Update application

---

## Phase 9 — Verification

### Check all services

```bash
systemctl status flasqo-backend    # active (running)
systemctl status nginx              # active (running)
systemctl status postgresql         # active (running)
systemctl status redis-server       # active (running)
```

### Test backend

```bash
curl https://flasqo.com/health
```

### Test full app

1. Open `https://flasqo.com` — landing page loads
2. Open `https://www.flasqo.com` — redirects to `https://flasqo.com`
3. Sign in with Google — redirects to Google, comes back logged in
4. Sign in with GitHub — redirects to GitHub, comes back logged in
5. Open any testing suite — loads correctly
6. Run a Smoke test — results appear

### Check logs

```bash
journalctl -u flasqo-backend -f
tail -f /var/log/nginx/error.log
```

---

## Updating the App

### Create the update script (one time)

```bash
nano /home/flasqo/update.sh
```

Paste:
```bash
#!/bin/bash
set -e

echo "=== Flasqo Update ==="

cd /home/flasqo/app/Flux-test

echo "[1/5] Pulling latest code..."
git pull origin master

echo "[2/5] Updating backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
deactivate
cd ..

echo "[3/5] Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "[4/5] Restarting backend..."
sudo systemctl restart flasqo-backend

echo "[5/5] Done!"
sudo systemctl status flasqo-backend --no-pager
```

```bash
chmod +x /home/flasqo/update.sh
chown flasqo:flasqo /home/flasqo/update.sh

# Allow flasqo user to restart service without password prompt
echo "flasqo ALL=(ALL) NOPASSWD: /bin/systemctl restart flasqo-backend, /bin/systemctl status flasqo-backend" \
  > /etc/sudoers.d/flasqo
```

### Run an update

```bash
su - flasqo
/home/flasqo/update.sh
```

---

## Auto-Deployment with GitHub Actions

Every push to `master` automatically SSHs into your Contabo server and runs the update script. No manual steps needed after setup.

---

### Step A — Generate a deploy SSH key on the server (one time)

> Do this as the `flasqo` user so the key lives in the right place.

```bash
ssh root@YOUR_CONTABO_IP
su - flasqo

# Generate a dedicated key (no passphrase)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""

# Trust it on the server
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Print the PRIVATE key — copy everything including the header/footer lines
cat ~/.ssh/github_actions
```

Copy the full output (starts with `-----BEGIN OPENSSH PRIVATE KEY-----`).

---

### Step B — Add secrets to GitHub

1. Go to your repo on GitHub
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Add these two secrets:

| Secret name | Value |
|---|---|
| `SSH_PRIVATE_KEY` | The private key you copied above |
| `SERVER_IP` | Your Contabo VPS IP address |

---

### Step C — Create the workflow file

On your **local machine**, create this file:

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Contabo

on:
  push:
    branches:
      - master

jobs:
  deploy:
    name: Deploy via SSH
    runs-on: ubuntu-latest

    steps:
      - name: SSH and deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_IP }}
          username: flasqo
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: /home/flasqo/update.sh
```

Commit and push:

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions auto-deployment"
git push origin master
```

The first push will immediately trigger a deployment.

---

### Step D — Verify it works

1. Go to your GitHub repo → **Actions** tab
2. You should see a workflow run called **Deploy to Contabo**
3. Click it — you'll see live logs of the SSH session running `update.sh`
4. Green checkmark = deployed successfully

---

### How it works after setup

```
You push to master
       ↓
GitHub Actions triggers
       ↓
SSH into flasqo@YOUR_CONTABO_IP
       ↓
Runs /home/flasqo/update.sh
  [1] git pull origin master
  [2] pip install -r requirements.txt
  [3] npm install && npm run build
  [4] systemctl restart flasqo-backend
       ↓
Site is live with new changes
```

---

### If a deployment fails

Check the Actions tab on GitHub — it shows the exact error line.

Common fixes:

```bash
# Permission denied on SSH → check authorized_keys
ssh -i ~/.ssh/github_actions flasqo@YOUR_CONTABO_IP

# update.sh not found → recreate it (see Updating the App section)
ls -la /home/flasqo/update.sh

# systemctl permission denied → re-add sudoers rule
echo "flasqo ALL=(ALL) NOPASSWD: /bin/systemctl restart flasqo-backend, /bin/systemctl status flasqo-backend" \
  > /etc/sudoers.d/flasqo
```

---

### Skip deployment for a commit

Add `[skip ci]` anywhere in the commit message:

```bash
git commit -m "Update README [skip ci]"
```

---

## Maintenance & Monitoring

### Check status
```bash
systemctl status flasqo-backend nginx postgresql redis-server
df -h
free -h
```

### View logs
```bash
journalctl -u flasqo-backend -n 50           # last 50 lines
journalctl -u flasqo-backend --since today   # today's logs
tail -f /var/log/nginx/error.log
tail -f /home/flasqo/app/Flux-test/backend/logs/error.log
```

### Database backup
```bash
# Manual backup
sudo -u postgres pg_dump flasqo_db > /home/flasqo/backup_$(date +%Y%m%d).sql

# Restore
sudo -u postgres psql flasqo_db < /home/flasqo/backup_20260618.sql
```

### Automated daily backup
```bash
crontab -e
```
Add:
```
0 2 * * * sudo -u postgres pg_dump flasqo_db > /home/flasqo/backup_$(date +\%Y\%m\%d).sql && find /home/flasqo -name "backup_*.sql" -mtime +7 -delete
```

### SSL renewal check
```bash
certbot renew --dry-run
```

### Weekly system update
```bash
apt update && apt upgrade -y
```

---

## Troubleshooting

### Backend won't start
```bash
journalctl -u flasqo-backend -n 100

# Fix — reinstall dependencies
su - flasqo
cd /home/flasqo/app/Flux-test/backend
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
exit
systemctl restart flasqo-backend
```

### 502 Bad Gateway
```bash
systemctl status flasqo-backend
ss -tlnp | grep 8000
systemctl restart flasqo-backend
```

### Frontend blank page
```bash
tail -f /var/log/nginx/error.log
ls -la /home/flasqo/app/Flux-test/frontend/dist/
chmod -R 755 /home/flasqo/app/Flux-test/frontend/dist/

# Rebuild if needed
su - flasqo
cd /home/flasqo/app/Flux-test/frontend
rm -rf dist node_modules
npm install && npm run build
exit
```

### Google/GitHub OAuth not working
1. Confirm `HTTPS_ONLY=True` and `SESSION_SAME_SITE=none` in `.env`
2. Confirm redirect URIs in Google/GitHub console match exactly (use `https://flasqo.com`, not `www`)
3. Restart backend after any `.env` change:
   ```bash
   systemctl restart flasqo-backend
   ```
4. Check logs: `journalctl -u flasqo-backend -f`

### www not redirecting to root domain
```bash
nginx -t
systemctl reload nginx
# Verify both server_name blocks exist in /etc/nginx/sites-available/flasqo
```

### SSL certificate missing www
If you forgot to include `www.flasqo.com` when running certbot, re-run it:
```bash
certbot --nginx -d flasqo.com -d www.flasqo.com
```

### Database error
```bash
systemctl status postgresql
systemctl restart postgresql
psql -U flasqo_user -d flasqo_db -h localhost
```

### Redis error
```bash
systemctl status redis-server
systemctl restart redis-server
redis-cli ping    # Should return PONG
```

### Port 8000 already in use
```bash
ss -tlnp | grep 8000
kill -9 $(lsof -t -i:8000)
systemctl restart flasqo-backend
```

---

## Quick Reference

```bash
# ── Services ───────────────────────────────────────────────
systemctl start   flasqo-backend
systemctl stop    flasqo-backend
systemctl restart flasqo-backend
systemctl status  flasqo-backend

# ── Logs ───────────────────────────────────────────────────
journalctl -u flasqo-backend -f
journalctl -u flasqo-backend -n 100
tail -f /var/log/nginx/error.log
tail -f /home/flasqo/app/Flux-test/backend/logs/error.log

# ── Nginx ──────────────────────────────────────────────────
nginx -t
systemctl reload nginx
systemctl restart nginx

# ── Database ───────────────────────────────────────────────
sudo -u postgres psql flasqo_db
sudo -u postgres pg_dump flasqo_db > backup.sql

# ── SSL ────────────────────────────────────────────────────
certbot certificates
certbot renew --dry-run

# ── System ─────────────────────────────────────────────────
htop
df -h
free -h
ss -tlnp

# ── Update app ─────────────────────────────────────────────
su - flasqo && /home/flasqo/update.sh
```

---

## Post-Deployment Checklist

- [ ] `https://flasqo.com` loads the landing page
- [ ] `https://www.flasqo.com` redirects to `https://flasqo.com`
- [ ] `http://flasqo.com` redirects to `https://flasqo.com`
- [ ] Google OAuth login works end-to-end
- [ ] GitHub OAuth login works end-to-end
- [ ] All testing suites load and run
- [ ] `certbot renew --dry-run` succeeds
- [ ] `systemctl status flasqo-backend` → `active (running)`
- [ ] `systemctl status nginx` → `active (running)`
- [ ] `systemctl status postgresql` → `active (running)`
- [ ] `systemctl status redis-server` → `active (running)`
- [ ] Firewall configured: `ufw status`
- [ ] Database backup cron set up

---

## Switching from Coming Soon to Live App

After the countdown ends (Tuesday, August 4th, 2026 at 1:22 PM IST), follow these steps to go live with the full application:

### Step 1 — Edit Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/flasqo
```

### Step 2 — Update the Main Server Block

**Find this section (around line 28):**
```nginx
server {
    listen 443 ssl;
    server_name flasqo.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/flasqo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flasqo.com/privkey.pem;

    # Frontend static files
    root /home/flasqo/app/Flux-test;           ← CHANGE THIS
    index coming-soon.html;                     ← CHANGE THIS
```

**Change to:**
```nginx
server {
    listen 443 ssl;
    server_name flasqo.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/flasqo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flasqo.com/privkey.pem;

    # Frontend static files
    root /home/flasqo/app/Flux-test/frontend/dist;
    index index.html;
```

### Step 3 — Update the Frontend Catch-All Location Block

**Find this at the end of the server block (around line 289):**
```nginx
    # Frontend SPA catch-all (must be last)
    location / {
        root /home/flasqo/app/Flux-test;
        index coming-soon.html;
        try_files $uri $uri/ /coming-soon.html;
    }
```

**Change to:**
```nginx
    # Frontend SPA catch-all (must be last)
    location / {
        try_files $uri $uri/ /index.html;
    }
```

### Step 4 — Test and Reload Nginx

```bash
# Test the configuration
sudo nginx -t

# Should show: "configuration file test is successful"

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5 — Verify the Switch

1. **Open https://flasqo.com** — should now show the main app (not coming-soon)
2. **Hard refresh:** `Ctrl + F5` (Windows/Linux) or `Cmd + Shift + R` (Mac)
3. **Test login:** Google OAuth and GitHub OAuth should work
4. **Test a feature:** Run a smoke test or functional test

### Step 6 — Archive the Coming Soon Page (Optional)

```bash
# Rename for safekeeping
mv /home/flasqo/app/Flux-test/coming-soon.html \
   /home/flasqo/app/Flux-test/coming-soon.html.bak
```

---

### Quick Launch Day Checklist

```bash
# 1. SSH into server
ssh root@YOUR_CONTABO_IP

# 2. Edit Nginx config
sudo nano /etc/nginx/sites-available/flasqo

# 3. Change root paths:
#    - Line ~28:  root /home/flasqo/app/Flux-test/frontend/dist;
#    - Line ~28:  index index.html;
#    - Line ~289: location / { try_files $uri $uri/ /index.html; }

# 4. Test and reload
sudo nginx -t && sudo systemctl reload nginx

# 5. Verify
curl -I https://flasqo.com  # Should return 200 OK

# 6. Open in browser and test
```

---

### Rollback to Coming Soon (If Needed)

If you need to go back to the coming-soon page:

```bash
sudo nano /etc/nginx/sites-available/flasqo

# Change back:
# root /home/flasqo/app/Flux-test;
# index coming-soon.html;
# location / { try_files $uri $uri/ /coming-soon.html; }

sudo nginx -t && sudo systemctl reload nginx
```

---

**Domain:** `flasqo.com`
**App path:** `/home/flasqo/app/Flux-test`
**Last Updated:** 2026-08-03
