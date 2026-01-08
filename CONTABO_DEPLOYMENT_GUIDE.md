# Contabo Deployment Guide - Evo TFX Application

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Deployment Steps](#deployment-steps)
5. [Configuration](#configuration)
6. [Maintenance](#maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete instructions for deploying the Evo TFX application (FastAPI backend + React frontend + PostgreSQL database) on a Contabo VPS with a custom subdomain.

### Technology Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite
- **Database**: PostgreSQL
- **Web Server**: Nginx
- **Process Manager**: Systemd
- **SSL**: Let's Encrypt (Certbot)

### Estimated Deployment Time
- **Initial Setup**: 45-60 minutes
- **DNS Propagation**: 5-15 minutes
- **SSL Certificate**: 5 minutes

---

## Prerequisites

### Required Information
- [ ] Contabo VPS IP address
- [ ] Root SSH access to Contabo VPS
- [ ] Domain name with DNS management access
- [ ] Subdomain name (e.g., `app.yourdomain.com`)
- [ ] OpenAI API key
- [ ] Google OAuth credentials (Client ID & Secret)
- [ ] GitHub OAuth credentials (Client ID & Secret)

### Local Requirements
- Git repository with your application code
- SSH client (PuTTY for Windows, Terminal for Mac/Linux)

---

## Architecture

```
Internet
    ↓
Nginx (Port 80/443)
    ↓
    ├── Static Files (React Build) → /home/appuser/app/frontend/dist
    ├── /api/* → FastAPI Backend (Port 8000)
    └── /auth/* → OAuth Callbacks (Port 8000)
         ↓
    PostgreSQL (Port 5432)
```

---

## Deployment Steps

### Phase 1: Server Setup

#### Step 1: Access Your Contabo VPS
```bash
ssh root@your-contabo-ip
```

**Expected Output:**
```
Welcome to Ubuntu...
root@hostname:~#
```

#### Step 2: Update System & Install Dependencies
```bash
# Update system packages
apt update && apt upgrade -y

# Install all required packages
apt install -y \
    nginx \
    postgresql \
    postgresql-contrib \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    git \
    ufw \
    certbot \
    python3-certbot-nginx \
    curl \
    build-essential
```

**Verification:**
```bash
# Check versions
python3 --version    # Should be 3.8+
node --version       # Should be 14+
nginx -v            # Should be installed
psql --version      # Should be 12+
```

#### Step 3: Set Up Firewall
```bash
# Configure UFW firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

**Expected Output:**
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
```

---

### Phase 2: Database Setup

#### Step 4: Configure PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql
```

**Inside PostgreSQL shell, run:**
```sql
-- Create database
CREATE DATABASE evo_tfx_db;

-- Create user with password
CREATE USER evo_tfx_user WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE evo_tfx_db TO evo_tfx_user;

-- Exit
\q
```

**Important:** Replace `YOUR_SECURE_PASSWORD_HERE` with a strong password. Save it securely!

#### Step 5: Configure PostgreSQL Authentication
```bash
# Edit pg_hba.conf
nano /etc/postgresql/*/main/pg_hba.conf
```

**Add this line** (find the section with "local" connections):
```
local   all   evo_tfx_user   md5
```

**Restart PostgreSQL:**
```bash
systemctl restart postgresql
systemctl status postgresql
```

**Test database connection:**
```bash
psql -U evo_tfx_user -d evo_tfx_db -h localhost
# Enter password when prompted
# If successful, you'll see: evo_tfx_db=>
\q
```

---

### Phase 3: Backend Deployment

#### Step 6: Create Application User
```bash
# Create non-root user for security
adduser --disabled-password --gecos "" appuser
su - appuser
```

#### Step 7: Clone and Setup Backend
```bash
# Create app directory
mkdir -p /home/appuser/app
cd /home/appuser/app

# Option A: Clone from Git
git clone YOUR_REPO_URL .

# Option B: Upload files via SCP (from your local machine)
# scp -r E:\Automation_project\Evo-TFX-main/* root@your-contabo-ip:/home/appuser/app/

# Navigate to backend
cd /home/appuser/app/backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

**Verification:**
```bash
which python  # Should show: /home/appuser/app/backend/venv/bin/python
pip list      # Should show all installed packages
```

#### Step 8: Create Environment File
```bash
nano /home/appuser/app/backend/.env
```

**Add this content** (replace all placeholder values):
```env
# Database Configuration
DATABASE_URL=postgresql://evo_tfx_user:YOUR_SECURE_PASSWORD_HERE@localhost/evo_tfx_db

# Security
SECRET_KEY=GENERATE_THIS_WITH_OPENSSL

# Frontend URL (update with your domain)
FRONTEND_URL=https://your-subdomain.yourdomain.com

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Generate SECRET_KEY:**
```bash
openssl rand -hex 32
# Copy the output and paste it as SECRET_KEY value
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

#### Step 9: Test Backend Locally
```bash
# Make sure you're in backend directory with venv activated
cd /home/appuser/app/backend
source venv/bin/activate

# Test run
uvicorn backend:app --host 0.0.0.0 --port 8000
```

**Test from another terminal:**
```bash
curl http://localhost:8000
# Should return response from your API
```

Press `Ctrl+C` to stop the test server.

#### Step 10: Create Systemd Service for Backend
```bash
# Exit from appuser to root
exit

# Create service file
nano /etc/systemd/system/evo-tfx-backend.service
```

**Add this content:**
```ini
[Unit]
Description=Evo TFX FastAPI Backend
After=network.target postgresql.service

[Service]
User=appuser
Group=appuser
WorkingDirectory=/home/appuser/app/backend
Environment="PATH=/home/appuser/app/backend/venv/bin"
ExecStart=/home/appuser/app/backend/venv/bin/gunicorn backend:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --timeout 120
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Step 11: Start Backend Service
```bash
# Reload systemd
systemctl daemon-reload

# Start service
systemctl start evo-tfx-backend

# Enable auto-start on boot
systemctl enable evo-tfx-backend

# Check status
systemctl status evo-tfx-backend
```

**Expected Output:**
```
● evo-tfx-backend.service - Evo TFX FastAPI Backend
   Loaded: loaded
   Active: active (running)
```

**View logs:**
```bash
journalctl -u evo-tfx-backend -f
```

---

### Phase 4: Frontend Deployment

#### Step 12: Update Frontend Configuration
```bash
su - appuser
cd /home/appuser/app/frontend
```

**Find and update API URL** (usually in `src/config.js`, `src/constants.js`, or similar):
```bash
# Search for API URL configuration
grep -r "localhost:8000" src/
grep -r "API_URL" src/
```

**Update to your domain:**
```javascript
// Before
const API_URL = 'http://localhost:8000';

// After
const API_URL = 'https://your-subdomain.yourdomain.com/api';
```

Or create a config file if it doesn't exist:
```bash
nano src/config.js
```

```javascript
const config = {
  API_URL: import.meta.env.PROD
    ? 'https://your-subdomain.yourdomain.com/api'
    : 'http://localhost:8000',
};

export default config;
```

#### Step 13: Build Frontend
```bash
# Install Node dependencies
npm install

# Build for production
npm run build

# Verify build
ls -la dist/
```

**Expected Output:**
```
dist/
├── index.html
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
└── ...
```

```bash
# Exit back to root
exit
```

---

### Phase 5: Nginx Configuration

#### Step 14: Create Nginx Configuration
```bash
nano /etc/nginx/sites-available/evo-tfx
```

**Add this configuration** (replace `your-subdomain.yourdomain.com` with your actual domain):
```nginx
# Main application
server {
    listen 80;
    server_name your-subdomain.yourdomain.com;

    # Frontend static files
    root /home/appuser/app/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API endpoints
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # OAuth callbacks
    location /auth {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # File upload size limit
    client_max_body_size 10M;
}
```

#### Step 15: Enable Site and Test Nginx
```bash
# Create symbolic link to enable site
ln -s /etc/nginx/sites-available/evo-tfx /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t
```

**Expected Output:**
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
# Restart Nginx
systemctl restart nginx
systemctl status nginx
```

---

### Phase 6: Domain Configuration

#### Step 16: Configure DNS Records
Go to your domain registrar's DNS management panel (e.g., GoDaddy, Namecheap, Cloudflare)

**Add these A records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | your-subdomain | your-contabo-ip | 3600 |
| A | api.your-subdomain | your-contabo-ip | 3600 |

**Example:**
- If your domain is `example.com` and subdomain is `app`
- Add A record: `app` → `123.45.67.89`
- Add A record: `api.app` → `123.45.67.89`

**Wait 5-15 minutes for DNS propagation**

#### Step 17: Verify DNS Propagation
```bash
# Check if DNS is propagated
nslookup your-subdomain.yourdomain.com

# Or use
dig your-subdomain.yourdomain.com

# Check from external tool
# Visit: https://dnschecker.org
```

**Expected Output:**
```
Server:     8.8.8.8
Address:    8.8.8.8#53

Name:   your-subdomain.yourdomain.com
Address: your-contabo-ip
```

---

### Phase 7: SSL Certificate (HTTPS)

#### Step 18: Install SSL Certificate with Certbot
```bash
# Make sure DNS is propagated first!
certbot --nginx -d your-subdomain.yourdomain.com
```

**Follow the prompts:**
1. Enter email address: `your-email@example.com`
2. Agree to terms: `Y`
3. Share email with EFF: `N` (optional)
4. Choose redirect option: `2` (Redirect HTTP to HTTPS)

**Expected Output:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/your-subdomain.yourdomain.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/your-subdomain.yourdomain.com/privkey.pem
```

#### Step 19: Verify SSL Certificate
```bash
# Check certificate
certbot certificates

# Test auto-renewal
certbot renew --dry-run
```

**Visit your site:**
```
https://your-subdomain.yourdomain.com
```

You should see a padlock icon indicating secure HTTPS connection.

---

### Phase 8: OAuth Configuration

#### Step 20: Update Google OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized JavaScript origins**, add:
   - `https://your-subdomain.yourdomain.com`
5. Under **Authorized redirect URIs**, add:
   - `https://your-subdomain.yourdomain.com/auth/google/callback`
6. Click **Save**

#### Step 21: Update GitHub OAuth Settings

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click on your OAuth App
3. Update **Homepage URL**: `https://your-subdomain.yourdomain.com`
4. Update **Authorization callback URL**: `https://your-subdomain.yourdomain.com/auth/github/callback`
5. Click **Update application**

---

### Phase 9: Final Testing

#### Step 22: Test All Components

**Backend Health Check:**
```bash
curl https://your-subdomain.yourdomain.com/api/health
# or
curl http://localhost:8000/health
```

**Database Connection:**
```bash
su - appuser
cd /home/appuser/app/backend
source venv/bin/activate
python3 -c "from backend import engine; print('Database connected successfully!')"
exit
```

**Frontend:**
- Visit: `https://your-subdomain.yourdomain.com`
- Should load React app without errors

**Check Logs:**
```bash
# Backend logs
journalctl -u evo-tfx-backend -f

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log
```

**Test OAuth Flows:**
1. Visit your site
2. Click "Sign in with Google" - should redirect to Google
3. Click "Sign in with GitHub" - should redirect to GitHub
4. Complete authentication
5. Should redirect back to your app

---

### Phase 10: Monitoring & Maintenance

#### Step 23: Set Up Log Rotation
```bash
nano /etc/logrotate.d/evo-tfx
```

**Add:**
```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1
    endscript
}
```

#### Step 24: Create Deployment Update Script
```bash
nano /home/appuser/update.sh
```

**Add:**
```bash
#!/bin/bash
set -e

echo "Starting deployment update..."

# Navigate to app directory
cd /home/appuser/app

# Pull latest changes
echo "Pulling latest code..."
git pull origin master

# Update backend
echo "Updating backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Update frontend
echo "Updating frontend..."
cd frontend
npm install
npm run build
cd ..

# Restart backend service
echo "Restarting backend service..."
sudo systemctl restart evo-tfx-backend

echo "Deployment update completed!"
echo "Check status: sudo systemctl status evo-tfx-backend"
```

**Make executable:**
```bash
chmod +x /home/appuser/update.sh
chown appuser:appuser /home/appuser/update.sh

# Allow appuser to restart service without password
nano /etc/sudoers.d/appuser
```

**Add:**
```
appuser ALL=(ALL) NOPASSWD: /bin/systemctl restart evo-tfx-backend
```

#### Step 25: Set Up Monitoring (Optional but Recommended)
```bash
# Install htop for resource monitoring
apt install htop

# Create monitoring script
nano /home/appuser/monitor.sh
```

**Add:**
```bash
#!/bin/bash
echo "=== System Resources ==="
free -h
df -h /
echo ""
echo "=== Backend Service Status ==="
systemctl status evo-tfx-backend --no-pager
echo ""
echo "=== Nginx Status ==="
systemctl status nginx --no-pager
echo ""
echo "=== Recent Backend Logs ==="
journalctl -u evo-tfx-backend -n 20 --no-pager
```

```bash
chmod +x /home/appuser/monitor.sh
```

---

## Configuration Checklist

### Pre-Deployment Checklist
- [ ] Contabo VPS is accessible via SSH
- [ ] Domain/subdomain DNS is configured
- [ ] All OAuth credentials are obtained
- [ ] OpenAI API key is ready
- [ ] Database password is generated and saved

### Post-Deployment Checklist
- [ ] Backend service is running (`systemctl status evo-tfx-backend`)
- [ ] Nginx is running (`systemctl status nginx`)
- [ ] PostgreSQL is running (`systemctl status postgresql`)
- [ ] SSL certificate is installed (https works)
- [ ] Frontend loads correctly
- [ ] API endpoints are accessible
- [ ] Google OAuth login works
- [ ] GitHub OAuth login works
- [ ] Database connections are successful
- [ ] Firewall is configured (`ufw status`)
- [ ] Auto-renewal is set up (`certbot renew --dry-run`)

---

## Maintenance

### Regular Tasks

**Weekly:**
```bash
# Check service status
systemctl status evo-tfx-backend
systemctl status nginx
systemctl status postgresql

# Check disk space
df -h

# Check logs for errors
journalctl -u evo-tfx-backend --since "1 week ago" | grep -i error
```

**Monthly:**
```bash
# Update system packages
apt update && apt upgrade -y

# Check SSL certificate expiry
certbot certificates

# Review logs
journalctl -u evo-tfx-backend --since "1 month ago" | grep -i error
```

### Update Application
```bash
su - appuser
/home/appuser/update.sh
```

### Backup Database
```bash
# Create backup
sudo -u postgres pg_dump evo_tfx_db > /home/appuser/backup_$(date +%Y%m%d).sql

# Restore from backup
sudo -u postgres psql evo_tfx_db < /home/appuser/backup_20240101.sql
```

### Restart Services
```bash
# Restart backend only
systemctl restart evo-tfx-backend

# Restart nginx only
systemctl restart nginx

# Restart everything
systemctl restart evo-tfx-backend nginx postgresql
```

---

## Useful Commands Reference

### Service Management
```bash
# Start service
systemctl start evo-tfx-backend

# Stop service
systemctl stop evo-tfx-backend

# Restart service
systemctl restart evo-tfx-backend

# Check status
systemctl status evo-tfx-backend

# View logs (real-time)
journalctl -u evo-tfx-backend -f

# View last 100 logs
journalctl -u evo-tfx-backend -n 100
```

### Nginx Commands
```bash
# Test configuration
nginx -t

# Reload configuration (no downtime)
nginx -s reload

# Restart nginx
systemctl restart nginx

# View access logs
tail -f /var/log/nginx/access.log

# View error logs
tail -f /var/log/nginx/error.log
```

### Database Commands
```bash
# Connect to database
sudo -u postgres psql evo_tfx_db

# List databases
sudo -u postgres psql -c "\l"

# List tables
sudo -u postgres psql evo_tfx_db -c "\dt"

# Backup database
sudo -u postgres pg_dump evo_tfx_db > backup.sql

# Restore database
sudo -u postgres psql evo_tfx_db < backup.sql
```

### SSL/Certificate Commands
```bash
# List certificates
certbot certificates

# Renew certificates manually
certbot renew

# Test auto-renewal
certbot renew --dry-run

# Revoke certificate
certbot revoke --cert-path /etc/letsencrypt/live/your-domain/cert.pem
```

### Monitoring Commands
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Interactive process monitor
htop

# Check open ports
netstat -tulpn

# Check if port is in use
lsof -i :8000

# Check process by name
ps aux | grep gunicorn
```

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
journalctl -u evo-tfx-backend -n 50
```

**Common issues:**

1. **Module not found:**
```bash
su - appuser
cd /home/appuser/app/backend
source venv/bin/activate
pip install -r requirements.txt
exit
systemctl restart evo-tfx-backend
```

2. **Database connection error:**
```bash
# Verify DATABASE_URL in .env
cat /home/appuser/app/backend/.env | grep DATABASE_URL

# Test database connection
sudo -u postgres psql evo_tfx_db
```

3. **Port already in use:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Restart service
systemctl restart evo-tfx-backend
```

### Frontend Shows Blank Page

**Check browser console:** Press F12 and look for errors

**Common issues:**

1. **API connection failed:**
   - Check API URL in frontend config
   - Verify backend is running: `systemctl status evo-tfx-backend`
   - Test API: `curl http://localhost:8000`

2. **Build issues:**
```bash
su - appuser
cd /home/appuser/app/frontend
rm -rf dist node_modules
npm install
npm run build
exit
```

3. **Nginx not serving files:**
```bash
# Check nginx error logs
tail -f /var/log/nginx/error.log

# Verify file permissions
ls -la /home/appuser/app/frontend/dist/

# Fix permissions if needed
chmod -R 755 /home/appuser/app/frontend/dist/
```

### SSL Certificate Issues

**Certificate not installing:**
```bash
# Make sure DNS is propagated
nslookup your-subdomain.yourdomain.com

# Check nginx configuration
nginx -t

# Try manual installation
certbot --nginx -d your-subdomain.yourdomain.com --dry-run
certbot --nginx -d your-subdomain.yourdomain.com
```

**Certificate expired:**
```bash
# Renew immediately
certbot renew --force-renewal

# Restart nginx
systemctl restart nginx
```

### Database Connection Issues

**Can't connect to database:**
```bash
# Check PostgreSQL status
systemctl status postgresql

# Check if PostgreSQL is listening
netstat -tulpn | grep 5432

# Restart PostgreSQL
systemctl restart postgresql

# Test connection
psql -U evo_tfx_user -d evo_tfx_db -h localhost
```

**Permission denied:**
```bash
# Edit pg_hba.conf
nano /etc/postgresql/*/main/pg_hba.conf

# Ensure this line exists:
# local   all   evo_tfx_user   md5

# Restart PostgreSQL
systemctl restart postgresql
```

### OAuth Login Not Working

**Google OAuth fails:**
1. Check Google Console redirect URIs
2. Verify FRONTEND_URL in backend `.env`
3. Check backend logs: `journalctl -u evo-tfx-backend -f`
4. Ensure HTTPS is working

**GitHub OAuth fails:**
1. Check GitHub OAuth app callback URL
2. Verify GitHub credentials in `.env`
3. Test redirect: `https://your-domain.com/auth/github/callback`

### High Memory/CPU Usage

**Check resource usage:**
```bash
htop
```

**Optimize Gunicorn workers:**
```bash
nano /etc/systemd/system/evo-tfx-backend.service

# Change workers: -w 2 (for 1GB RAM server)
# Change workers: -w 4 (for 2GB+ RAM server)

systemctl daemon-reload
systemctl restart evo-tfx-backend
```

### Nginx 502 Bad Gateway

**Backend is not running:**
```bash
systemctl status evo-tfx-backend
systemctl restart evo-tfx-backend
```

**Backend crashed:**
```bash
journalctl -u evo-tfx-backend -n 100
```

**Port mismatch:**
```bash
# Check if backend is listening on 8000
netstat -tulpn | grep 8000

# Check nginx proxy_pass configuration
cat /etc/nginx/sites-enabled/evo-tfx | grep proxy_pass
```

---

## Security Best Practices

### Implemented Security Measures
- [x] Non-root user for application
- [x] UFW firewall enabled
- [x] HTTPS with SSL certificate
- [x] Secure database password
- [x] Environment variables for secrets
- [x] Security headers in Nginx

### Additional Recommendations

**1. Enable Fail2Ban (Prevent brute force):**
```bash
apt install fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

**2. Regular security updates:**
```bash
# Enable automatic security updates
apt install unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

**3. Change SSH port (optional):**
```bash
nano /etc/ssh/sshd_config
# Change: Port 22 → Port 2222
systemctl restart sshd
ufw allow 2222
```

**4. Disable root login via SSH:**
```bash
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd
```

**5. Regular backups:**
```bash
# Create backup script
nano /home/appuser/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/appuser/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump evo_tfx_db > $BACKUP_DIR/db_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /home/appuser/app

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x /home/appuser/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/appuser/backup.sh
```

---

## Performance Optimization

### Nginx Caching
```bash
nano /etc/nginx/sites-available/evo-tfx
```

Add inside server block:
```nginx
# Browser caching for static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Gunicorn Optimization
```bash
nano /etc/systemd/system/evo-tfx-backend.service
```

Optimize workers:
```ini
# Formula: (2 x CPU cores) + 1
# For 2 CPU cores: -w 5
# For 4 CPU cores: -w 9
ExecStart=/home/appuser/app/backend/venv/bin/gunicorn backend:app -w 5 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --timeout 120 --keep-alive 5
```

### PostgreSQL Optimization
```bash
nano /etc/postgresql/*/main/postgresql.conf
```

Adjust based on your RAM:
```conf
# For 2GB RAM server
shared_buffers = 512MB
effective_cache_size = 1536MB
maintenance_work_mem = 128MB
```

---

## Cost Estimation

### Monthly Costs
- **Contabo VPS**: €5-15/month (depending on plan)
- **Domain**: $10-15/year
- **SSL Certificate**: FREE (Let's Encrypt)
- **OpenAI API**: Variable (pay-as-you-go)

### Total Initial Setup Cost
- **One-time**: ~$10-15 (domain)
- **Monthly**: ~€5-15 (VPS) + OpenAI usage

---

## Support & Resources

### Official Documentation
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)

### Useful Tools
- **DNS Checker**: https://dnschecker.org
- **SSL Checker**: https://www.sslshopper.com/ssl-checker.html
- **Server Speed Test**: https://tools.pingdom.com

### Community Help
- Stack Overflow
- FastAPI Discord
- React Community Forum

---

## Deployment Summary

### What Was Deployed
- ✅ FastAPI backend running on Gunicorn with Uvicorn workers
- ✅ React frontend built and served by Nginx
- ✅ PostgreSQL database with secure configuration
- ✅ Nginx reverse proxy with SSL/HTTPS
- ✅ Systemd service for automatic restarts
- ✅ Firewall configured (UFW)
- ✅ OAuth integration (Google & GitHub)
- ✅ SSL certificate with auto-renewal

### Server Configuration
- **OS**: Ubuntu (Contabo VPS)
- **Web Server**: Nginx
- **Application Server**: Gunicorn + Uvicorn
- **Database**: PostgreSQL
- **SSL**: Let's Encrypt
- **Process Manager**: Systemd

### Access Points
- **Frontend**: https://your-subdomain.yourdomain.com
- **API**: https://your-subdomain.yourdomain.com/api
- **OAuth Callbacks**: https://your-subdomain.yourdomain.com/auth/*

---

## Quick Reference Card

```bash
# Essential Commands
systemctl status evo-tfx-backend      # Check backend
journalctl -u evo-tfx-backend -f      # View logs
systemctl restart evo-tfx-backend     # Restart backend
nginx -t                              # Test nginx config
systemctl restart nginx               # Restart nginx
certbot renew                         # Renew SSL
su - appuser && /home/appuser/update.sh  # Update app

# Emergency Commands
systemctl stop evo-tfx-backend        # Stop backend
kill -9 $(lsof -t -i:8000)           # Force kill port 8000
nginx -s stop                         # Stop nginx
rm /var/run/nginx.pid                 # Fix nginx PID issue

# Monitoring
htop                                  # System resources
df -h                                 # Disk space
free -h                               # Memory usage
netstat -tulpn                        # Open ports
```

---

## Version History

- **v1.0** - Initial deployment guide
- **Date**: 2026-01-02
- **Application**: Evo TFX (FastAPI + React)

---

## License & Credits

This deployment guide is provided as-is for the Evo TFX application.

**Author**: Generated for Evo TFX deployment
**Last Updated**: 2026-01-02

---

**End of Deployment Guide**

For issues or questions, refer to the troubleshooting section or check application logs.
