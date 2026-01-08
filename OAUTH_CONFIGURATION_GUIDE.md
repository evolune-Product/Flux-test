# OAuth Configuration Guide for Production

## Quick Reference for fluxtest.evolune.in

### Google OAuth Configuration

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add these EXACT URLs:

**Authorized JavaScript origins:**
```
https://fluxtest.evolune.in
```

**Authorized redirect URIs:**
```
https://fluxtest.evolune.in/auth/google/callback
```

4. Click **Save**

---

### GitHub OAuth Configuration

1. Go to: https://github.com/settings/developers
2. Click on your OAuth App (or create a new one)
3. Configure:

**Application name:** Evo-TFX (or your preferred name)

**Homepage URL:**
```
https://fluxtest.evolune.in
```

**Authorization callback URL:**
```
https://fluxtest.evolune.in/auth/github/callback
```

4. Click **Update application**
5. Copy the **Client ID** and **Client Secret**

---

## Required Environment Variables on Contabo Server

Your `/home/appuser/app/backend/.env` file must have:

```env
# Backend & Frontend URLs
BACKEND_URL=https://fluxtest.evolune.in
FRONTEND_URL=https://fluxtest.evolune.in
ALLOWED_ORIGINS=https://fluxtest.evolune.in

# Database
DATABASE_URL=postgresql://evo_tfx_user:YOUR_PASSWORD@localhost/evo_tfx_db

# Security
SECRET_KEY=your-generated-secret-key-here

# OpenAI
OPENAI_API_KEY=your-openai-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id-here
GITHUB_CLIENT_SECRET=your-github-client-secret-here
```

---

## Common Issues & Solutions

### Issue 1: "Google authentication failed"

**Cause:** Redirect URI mismatch or missing credentials

**Fix:**
1. Verify redirect URI in Google Console matches exactly: `https://fluxtest.evolune.in/auth/google/callback`
2. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
3. Restart backend: `sudo systemctl restart evo-tfx-backend`

### Issue 2: "GitHub authentication failed"

**Cause:** Callback URL mismatch or missing credentials

**Fix:**
1. Verify callback URL in GitHub OAuth App matches exactly: `https://fluxtest.evolune.in/auth/github/callback`
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set in `.env`
3. Restart backend: `sudo systemctl restart evo-tfx-backend`

### Issue 3: OAuth works locally but not in production

**Causes:**
- `BACKEND_URL` environment variable not set
- Frontend built with localhost API URL
- Session middleware misconfigured

**Fix:**
1. Set `BACKEND_URL=https://fluxtest.evolune.in` in `.env`
2. Rebuild frontend:
   ```bash
   cd /home/appuser/app/frontend
   export VITE_API_BASE_URL=https://fluxtest.evolune.in
   npm run build
   ```
3. Restart backend: `sudo systemctl restart evo-tfx-backend`

### Issue 4: 405 Method Not Allowed

**Cause:** Nginx not properly forwarding requests

**Fix:**
1. Check nginx config has `/auth` location block:
   ```bash
   cat /etc/nginx/sites-enabled/evo-tfx | grep -A 10 "location /auth"
   ```
2. Should see `proxy_pass http://127.0.0.1:8000;`
3. If missing, add it and reload: `sudo nginx -t && sudo systemctl reload nginx`

---

## Testing OAuth After Configuration

### Step 1: Check Backend Logs
```bash
sudo journalctl -u evo-tfx-backend -f
```

### Step 2: Test OAuth Flow

1. Open browser to: `https://fluxtest.evolune.in`
2. Click "Continue with Google" or "Continue with GitHub"
3. Watch the backend logs for any errors
4. You should be redirected to Google/GitHub, then back to your app

### Step 3: Verify Success

If successful, you'll see in logs:
- No errors
- User creation/login messages
- Token generation

If failed, you'll see:
- "Google OAuth error:" or "GitHub OAuth error:" with details
- Use this to diagnose the specific issue

---

## Quick Commands Reference

```bash
# View environment variables (without secrets)
cat /home/appuser/app/backend/.env | grep -v "SECRET\|PASSWORD\|KEY"

# Check backend service
sudo systemctl status evo-tfx-backend

# Restart backend
sudo systemctl restart evo-tfx-backend

# View live logs
sudo journalctl -u evo-tfx-backend -f

# Test Google OAuth endpoint
curl -I http://localhost:8000/auth/google

# Test GitHub OAuth endpoint
curl -I http://localhost:8000/auth/github

# Rebuild frontend with production URL
cd /home/appuser/app/frontend
export VITE_API_BASE_URL=https://fluxtest.evolune.in
npm run build

# Check nginx config
sudo nginx -t
```

---

## OAuth Flow Diagram

```
User clicks "Continue with Google/GitHub"
    ↓
Frontend redirects to: https://fluxtest.evolune.in/auth/google (or /auth/github)
    ↓
Backend redirects to: Google/GitHub OAuth page
    ↓
User authorizes
    ↓
Google/GitHub redirects to: https://fluxtest.evolune.in/auth/google/callback
    ↓
Backend:
  - Receives OAuth token
  - Fetches user info
  - Creates/updates user in database
  - Generates JWT token
  - Redirects to: https://fluxtest.evolune.in?token=xxx&user_id=xxx&username=xxx&email=xxx
    ↓
Frontend:
  - Extracts token from URL
  - Stores in localStorage
  - Fetches user profile
  - Redirects to dashboard
```

---

## Need Help?

Run the debug script:
```bash
chmod +x debug_oauth.sh
./debug_oauth.sh
```

Or apply all fixes automatically:
```bash
chmod +x fix_oauth_production.sh
./fix_oauth_production.sh
```
