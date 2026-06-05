# Flasqo — Contabo Deployment Guide
**Domain:** `flasqo.evolune.in`
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
13. [Maintenance & Monitoring](#maintenance--monitoring)
14. [Troubleshooting](#troubleshooting)
15. [Quick Reference](#quick-reference)

---

## Architecture

```
Browser
   ↓ HTTPS (443)
Nginx  ──────────────────────────────────────
   ├── /                → React SPA (dist/)
   ├── /api/*           → FastAPI (127.0.0.1:8000)
   ├── /auth/*          → FastAPI OAuth (127.0.0.1:8000)
   ├── /history/*       → FastAPI (127.0.0.1:8000)
   ├── /flows/*         → FastAPI (127.0.0.1:8000)
   ├── /report/*        → FastAPI (127.0.0.1:8000)
   ├── /dashboard/*     → FastAPI (127.0.0.1:8000)
   └── /fullsend/*      → FastAPI (127.0.0.1:8000)
         ↓
   PostgreSQL (127.0.0.1:5432)
   Redis      (127.0.0.1:6379)
```

---

## Pre-Deployment Checklist

Before starting, have these ready:

- [ ] Contabo VPS IP address
- [ ] Root SSH credentials for VPS
- [ ] Access to `evolune.in` DNS panel
- [ ] Google OAuth Client ID & Secret (from Google Cloud Console)
- [ ] GitHub OAuth Client ID & Secret — both apps (auth + repo)
- [ ] OpenAI API key
- [ ] Your app code pushed to a Git repo (or ready to SCP)

---

## Phase 1 — Server Setup

### 1.1 SSH into your Contabo VPS

```bash
ssh root@YOUR_CONTABO_IP
```

### 1.2 Update system packages

```bash
apt update && apt upgrade -y
```

### 1.3 Install all required software

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

### 1.4 Verify installations

```bash
python3 --version   # 3.10+
node --version      # v20+
npm --version       # 10+
nginx -v
psql --version
redis-server --version
```

### 1.5 Configure firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Expected output:
```
Status: active
OpenSSH    ALLOW
Nginx Full ALLOW
```

### 1.6 Create application user

```bash
adduser --disabled-password --gecos "" flasqo
```

---

## Phase 2 — Database & Redis

### 2.1 Set up PostgreSQL

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

> Save your password — you will need it in the `.env` file.

### 2.2 Test database connection

```bash
psql -U flasqo_user -d flasqo_db -h localhost
# Type password, then:
\q
```

### 2.3 Configure Redis

```bash
# Enable Redis to start on boot
systemctl enable redis-server
systemctl start redis-server

# Verify Redis is running
redis-cli ping
# Expected: PONG
```

---

## Phase 3 — Backend Deployment

### 3.1 Upload or clone your code

**Option A — Git clone (recommended):**
```bash
su - flasqo
mkdir -p /home/flasqo/app
cd /home/flasqo/app
git clone YOUR_GIT_REPO_URL .
```

**Option B — SCP from your Windows machine** (run this on your local machine):
```bash
scp -r "E:\Evolune_Products\Evo-TFX-main\backend" root@YOUR_CONTABO_IP:/home/flasqo/app/
scp -r "E:\Evolune_Products\Evo-TFX-main\frontend" root@YOUR_CONTABO_IP:/home/flasqo/app/
```

Then fix ownership:
```bash
chown -R flasqo:flasqo /home/flasqo/app
```

### 3.2 Set up Python virtual environment

```bash
su - flasqo
cd /home/flasqo/app/backend

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

Verify:
```bash
which python   # /home/flasqo/app/backend/venv/bin/python
```

### 3.3 Create the backend `.env` file

```bash
nano /home/flasqo/app/backend/.env
```

Paste and fill in all values:

```env
# ============================================
# ENVIRONMENT
# ============================================
ENVIRONMENT=production

# ============================================
# SECURITY
# ============================================
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=GENERATE_AND_PASTE_HERE

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://flasqo_user:YOUR_DB_PASSWORD@localhost:5432/flasqo_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
DB_ECHO=False

# ============================================
# REDIS
# ============================================
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=300
CACHE_ENABLED=True

# ============================================
# URLS
# ============================================
FRONTEND_URL=https://flasqo.evolune.in
BACKEND_URL=https://flasqo.evolune.in
ALLOWED_ORIGINS=

# ============================================
# GOOGLE OAUTH
# ============================================
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# ============================================
# GITHUB OAUTH (User Authentication)
# ============================================
GITHUB_CLIENT_ID=YOUR_GITHUB_AUTH_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_AUTH_CLIENT_SECRET

# ============================================
# GITHUB OAUTH (Repository Access)
# ============================================
GITHUB_REPO_CLIENT_ID=YOUR_GITHUB_REPO_CLIENT_ID
GITHUB_REPO_CLIENT_SECRET=YOUR_GITHUB_REPO_CLIENT_SECRET

# ============================================
# OPENAI
# ============================================
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# ============================================
# SECURITY SETTINGS
# ============================================
HTTPS_ONLY=True
SECURE_COOKIES=True
ENABLE_SECURITY_HEADERS=True

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_ENABLED=True
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_AUTH_PER_MINUTE=5
RATE_LIMIT_BURST=10
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=900

# ============================================
# SESSION
# ============================================
SESSION_MAX_AGE=3600
SESSION_SAME_SITE=none
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# ============================================
# PASSWORD POLICY
# ============================================
MIN_PASSWORD_LENGTH=8
REQUIRE_SPECIAL_CHAR=True
REQUIRE_NUMBER=True
REQUIRE_UPPERCASE=True

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=logs/app.log

# ============================================
# METRICS
# ============================================
ENABLE_METRICS=True
METRICS_PORT=9090

# ============================================
# LIMITS
# ============================================
DEFAULT_TEST_TIMEOUT=10
MAX_TEST_CASES_PER_RUN=100
MAX_UPLOAD_SIZE=10485760

# ============================================
# SERVER
# ============================================
HOST=0.0.0.0
PORT=8000
WORKERS=4
REQUEST_TIMEOUT=30
KEEPALIVE_TIMEOUT=75
DEBUG=False
```

Generate the SECRET_KEY:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

### 3.4 Create logs directory

```bash
mkdir -p /home/flasqo/app/backend/logs
```

### 3.5 Test backend starts correctly

```bash
cd /home/flasqo/app/backend
source venv/bin/activate
uvicorn backend:app --host 0.0.0.0 --port 8000
```

Open a second terminal and test:
```bash
curl http://localhost:8000/health
# Should return a JSON response
```

Press `Ctrl+C` to stop.

### 3.6 Create systemd service

Exit to root first:
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
WorkingDirectory=/home/flasqo/app/backend
Environment="PATH=/home/flasqo/app/backend/venv/bin"
EnvironmentFile=/home/flasqo/app/backend/.env
ExecStart=/home/flasqo/app/backend/venv/bin/gunicorn backend:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    -b 127.0.0.1:8000 \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile /home/flasqo/app/backend/logs/access.log \
    --error-logfile /home/flasqo/app/backend/logs/error.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 3.7 Start and enable backend service

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

### 4.1 Verify `.env.production` is correct

The file `frontend/.env.production` should already contain:
```env
VITE_API_BASE_URL=https://flasqo.evolune.in
```

> This is already set correctly. Do not change it.

### 4.2 Build the frontend

```bash
su - flasqo
cd /home/flasqo/app/frontend

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

### 4.3 Set correct permissions for Nginx

```bash
chmod -R 755 /home/flasqo
chmod -R 755 /home/flasqo/app/frontend/dist
```

---

## Phase 5 — Nginx Configuration

### 5.1 Create Nginx site config

```bash
nano /etc/nginx/sites-available/flasqo
```

Paste the full configuration:

```nginx
server {
    listen 80;
    server_name flasqo.evolune.in;

    # Redirect all HTTP to HTTPS (Certbot will add this automatically,
    # but include it here for clarity)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name flasqo.evolune.in;

    # SSL certificates (Certbot will fill these in)
    # ssl_certificate /etc/letsencrypt/live/flasqo.evolune.in/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/flasqo.evolune.in/privkey.pem;

    # Frontend static files
    root /home/flasqo/app/frontend/dist;
    index index.html;

    # File upload size limit (matches MAX_UPLOAD_SIZE in .env)
    client_max_body_size 10M;

    # Gzip compression
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

    # ─── Backend API routes ───────────────────────────────────────────────────

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

    # ─── Frontend SPA (catch-all — must be last) ──────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5.2 Enable the site

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

Log into your domain registrar's DNS panel for `evolune.in` and add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `flasqo` | `YOUR_CONTABO_IP` | 3600 |

This creates `flasqo.evolune.in` → your server.

**Verify DNS propagation** (wait 5–15 minutes first):
```bash
nslookup flasqo.evolune.in
# Should return your Contabo IP
```

Or check online: https://dnschecker.org/#A/flasqo.evolune.in

---

## Phase 7 — SSL Certificate

> DNS must be propagated before this step.

```bash
certbot --nginx -d flasqo.evolune.in
```

Follow the prompts:
1. Enter your email address
2. Agree to terms: `Y`
3. Share with EFF: `N`
4. Redirect option: `2` (Redirect HTTP → HTTPS)

Certbot will automatically update your Nginx config.

**Verify certificate:**
```bash
certbot certificates
# Shows expiry date

certbot renew --dry-run
# Tests auto-renewal — should succeed
```

Visit: `https://flasqo.evolune.in` — you should see the Flasqo app with a padlock.

---

## Phase 8 — OAuth Configuration

### 8.1 Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Click your OAuth 2.0 Client ID
3. Under **Authorized JavaScript origins** add:
   ```
   https://flasqo.evolune.in
   ```
4. Under **Authorized redirect URIs** add:
   ```
   https://flasqo.evolune.in/auth/google/callback
   ```
5. Click **Save**

### 8.2 GitHub OAuth — Auth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps**
2. Click your auth OAuth app
3. Update **Homepage URL**:
   ```
   https://flasqo.evolune.in
   ```
4. Update **Authorization callback URL**:
   ```
   https://flasqo.evolune.in/auth/github/callback
   ```
5. Click **Update application**

### 8.3 GitHub OAuth — Repo Access App

1. In the same Developer Settings, click your repo access OAuth app
2. Update **Homepage URL**:
   ```
   https://flasqo.evolune.in
   ```
3. Update **Authorization callback URL**:
   ```
   https://flasqo.evolune.in/github/callback
   ```
4. Click **Update application**

---

## Phase 9 — Verification

### 9.1 Check all services are running

```bash
systemctl status flasqo-backend   # active (running)
systemctl status nginx             # active (running)
systemctl status postgresql        # active (running)
systemctl status redis-server      # active (running)
```

### 9.2 Test backend health

```bash
curl https://flasqo.evolune.in/health
# or
curl http://localhost:8000/health
```

### 9.3 Test backend logs

```bash
journalctl -u flasqo-backend -f
```

### 9.4 Test the full app

1. Open `https://flasqo.evolune.in` — Flasqo landing page loads
2. Click **Sign in with Google** — redirects to Google, comes back logged in
3. Click **Sign in with GitHub** — redirects to GitHub, comes back logged in
4. Navigate to any testing suite — loads correctly
5. Run a quick Smoke test against `https://jsonplaceholder.typicode.com/posts/1` — results appear

### 9.5 Check Nginx logs

```bash
# Access log
tail -f /var/log/nginx/access.log

# Error log
tail -f /var/log/nginx/error.log
```

---

## Updating the App

After pushing new code to Git, run this on the server:

```bash
nano /home/flasqo/update.sh
```

Paste:
```bash
#!/bin/bash
set -e

echo "=== Flasqo Update ==="

cd /home/flasqo/app

echo "[1/5] Pulling latest code..."
git pull origin master

echo "[2/5] Updating backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
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

Make it executable:
```bash
chmod +x /home/flasqo/update.sh
chown flasqo:flasqo /home/flasqo/update.sh
```

Allow flasqo user to restart the service without a password:
```bash
echo "flasqo ALL=(ALL) NOPASSWD: /bin/systemctl restart flasqo-backend, /bin/systemctl status flasqo-backend" \
  > /etc/sudoers.d/flasqo
```

**Run an update:**
```bash
su - flasqo
/home/flasqo/update.sh
```

---

## Maintenance & Monitoring

### Daily check
```bash
systemctl status flasqo-backend nginx postgresql redis-server
df -h          # Disk space
free -h        # Memory
```

### View logs
```bash
journalctl -u flasqo-backend -n 50           # Last 50 log lines
journalctl -u flasqo-backend --since today   # Today's logs
tail -f /var/log/nginx/error.log             # Nginx errors live
```

### Database backup
```bash
# Backup
sudo -u postgres pg_dump flasqo_db > /home/flasqo/backup_$(date +%Y%m%d).sql

# Restore
sudo -u postgres psql flasqo_db < /home/flasqo/backup_20260101.sql
```

### Automated daily backup (cron)
```bash
crontab -e
```
Add:
```
0 2 * * * sudo -u postgres pg_dump flasqo_db > /home/flasqo/backup_$(date +\%Y\%m\%d).sql && find /home/flasqo -name "backup_*.sql" -mtime +7 -delete
```

### SSL renewal (automatic — just verify it works)
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

# Common fix — reinstall dependencies
su - flasqo
cd /home/flasqo/app/backend
source venv/bin/activate
pip install -r requirements.txt
exit
systemctl restart flasqo-backend
```

### 502 Bad Gateway
```bash
# Check if backend is running
systemctl status flasqo-backend

# Check if it's listening on port 8000
ss -tlnp | grep 8000

# Restart
systemctl restart flasqo-backend
```

### Frontend shows blank page
```bash
# Check Nginx error log
tail -f /var/log/nginx/error.log

# Check permissions
ls -la /home/flasqo/app/frontend/dist/
chmod -R 755 /home/flasqo/app/frontend/dist/

# Rebuild
su - flasqo
cd /home/flasqo/app/frontend
rm -rf dist node_modules
npm install && npm run build
exit
```

### Google/GitHub OAuth not working
1. Confirm `HTTPS_ONLY=True` and `SESSION_SAME_SITE=none` in `.env`
2. Confirm redirect URIs in Google/GitHub match exactly (including `https://`)
3. Restart backend after any `.env` change: `systemctl restart flasqo-backend`
4. Check backend logs: `journalctl -u flasqo-backend -f`

### Database connection error
```bash
systemctl status postgresql
systemctl restart postgresql

# Test connection
psql -U flasqo_user -d flasqo_db -h localhost
```

### Redis connection error
```bash
systemctl status redis-server
systemctl restart redis-server
redis-cli ping   # Should return PONG
```

### Nginx config error
```bash
nginx -t          # Test config
systemctl reload nginx
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
# ── Service control ────────────────────────────────────────
systemctl start   flasqo-backend
systemctl stop    flasqo-backend
systemctl restart flasqo-backend
systemctl status  flasqo-backend

# ── Logs ──────────────────────────────────────────────────
journalctl -u flasqo-backend -f          # Live backend logs
journalctl -u flasqo-backend -n 100      # Last 100 lines
tail -f /var/log/nginx/access.log        # Nginx access
tail -f /var/log/nginx/error.log         # Nginx errors

# ── Nginx ─────────────────────────────────────────────────
nginx -t                                 # Test config
systemctl reload nginx                   # Reload (no downtime)
systemctl restart nginx

# ── Database ──────────────────────────────────────────────
sudo -u postgres psql flasqo_db          # Connect to DB
sudo -u postgres pg_dump flasqo_db > backup.sql

# ── SSL ───────────────────────────────────────────────────
certbot certificates                     # List certs + expiry
certbot renew --dry-run                  # Test auto-renewal

# ── System ────────────────────────────────────────────────
htop                                     # Resource monitor
df -h                                    # Disk space
free -h                                  # Memory
ss -tlnp                                 # Open ports

# ── Update app ────────────────────────────────────────────
su - flasqo && /home/flasqo/update.sh
```

---

## Post-Deployment Checklist

- [ ] `https://flasqo.evolune.in` loads the landing page
- [ ] Google OAuth login works end-to-end
- [ ] GitHub OAuth login works end-to-end
- [ ] All testing suites load and run
- [ ] `certbot renew --dry-run` succeeds
- [ ] `systemctl status flasqo-backend` shows `active (running)`
- [ ] `systemctl status nginx` shows `active (running)`
- [ ] `systemctl status postgresql` shows `active (running)`
- [ ] `systemctl status redis-server` shows `active (running)`
- [ ] Firewall configured: `ufw status`
- [ ] Database backup cron is set up

---

**Domain:** `flasqo.evolune.in`
**Last Updated:** 2026-06-05
