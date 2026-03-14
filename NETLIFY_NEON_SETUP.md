# Netlify + Neon Database Deployment Guide

## Overview
This guide explains how to deploy your DreamBid application using **Netlify** for hosting and **Neon** for the PostgreSQL database.

## Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Netlify Hosting                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React/Vite) in /dist                             │
│                                                              │
│  Netlify Functions (Serverless APIs) in /netlify/functions  │
│  └─ /api.js → Handles all API routes                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
          ┌────────────────────────┐
          │   Neon PostgreSQL DB   │
          │  (Cloud-hosted PG)     │
          └────────────────────────┘
```

## Step 1: Set Up Neon Database

### 1.1 Create Neon Account
1. Go to [https://neon.tech](https://neon.tech)
2. Sign up with your email or GitHub account
3. Create a new project

### 1.2 Create Database
1. In Neon dashboard, create a new database named `dreambid`
2. Copy the connection string (looks like: `postgresql://username:password@neon.tech/dreambid?sslmode=require`)

### 1.3 Initialize Database Schema
You have two options:

**Option A: Using Neon Console**
1. Open Neon dashboard → SQL Editor
2. Copy the contents of `setup-database.sql`
3. Paste and execute it
4. Execute `seed-properties.sql` for sample data

**Option B: Using CLI (after deployment)**
- Run after Netlify deployment is complete

## Step 2: Prepare Local Repository

### 2.1 Install Dependencies
```bash
npm install
```

### 2.2 Set Up Environment Variables

Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://username:password@ep-xyz.neon.tech/dreambid?sslmode=require

# Frontend
FRONTEND_URL=https://your-site.netlify.app
VITE_API_URL=https://your-site.netlify.app/api

# Node Environment
NODE_ENV=production
```

### 2.3 Test Locally (Optional)
```bash
npm run dev
```

## Step 3: Deploy to Netlify

### 3.1 Connect Repository to Netlify

**Using Netlify UI:**
1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Click "New site from Git"
3. Select your repository
4. Build settings should auto-detect:
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
5. Click "Deploy site"

**Using Netlify CLI:**
```bash
npm install -g netlify-cli
netlify auth login
netlify init
netlify deploy --prod
```

### 3.2 Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Go to **Site settings** → **Build & deploy** → **Environment**
3. Add the following variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your Netlify site URL (e.g., `https://dreambid.netlify.app`) |

4. **Trigger a new deploy** to apply variables

### 3.3 Deploy Your Site

```bash
# Option 1: Push to Git (auto-deploy)
git push origin main

# Option 2: Manual deploy
netlify deploy --prod --dir=dist
```

## Step 4: Verify Deployment

1. **Check API Health:**
   ```bash
   curl https://your-site.netlify.app/api/health
   ```
   Expected response:
   ```json
   { "status": "OK", "timestamp": "2024-03-14T..." }
   ```

2. **Test Authentication:**
   ```bash
   curl -X POST https://your-site.netlify.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@dreambid.com","password":"admin123"}'
   ```

3. **Check Netlify Logs:**
   - Site dashboard → **Logs** → **Functions** for API logs
   - Site dashboard → **Deploy** for build logs

## Troubleshooting

### Database Connection Errors
**Problem:** "Connection refused" or "ECONNREFUSED"
- **Solution:** Verify `DATABASE_URL` is correct in Netlify environment variables
- Check Neon dashboard for connection limits
- Ensure SSL mode is enabled (`sslmode=require`)

### Functions Not Starting
**Problem:** 404 on `/api/*` routes
- **Solution:** Check `netlify.toml` redirects are correct
- Verify `netlify/functions/api.js` exists
- Check Netlify Functions logs for errors

### Cold Start Issues
**Problem:** First request takes 5-10 seconds
- **Solution:** This is normal for serverless. Neon auto-suspends, causing cold starts.
  - Enable **Neon Autoscaling** for better performance
  - Use a Redis cache layer for frequently accessed data

### CORS Errors
**Problem:** Requests blocked from frontend
- **Solution:** Update `allowedOrigins` in `netlify/functions/api.js` to match your frontend URL

## Performance Optimization

### 1. Connection Pooling
The app already uses `pg` Pool with 20 max connections. For serverless, consider:
- Reducing max connections in `config/database.js`
- Using Neon's connection pooler feature

### 2. Caching
- Enable Netlify edge caching for static assets
- Implement application-level caching for frequently accessed data

### 3. Database Optimization
- Add indexes on frequently queried columns
- Consider Neon's read-only replica for analytics queries

## File Structure
```
/
├── netlify/
│   └── functions/
│       └── api.js                 # Main serverless function
├── src/                           # Frontend (React)
├── config/
│   └── database.js               # Database pool config
├── routes/                        # API route handlers
├── services/                      # Business logic
├── netlify.toml                  # Netlify configuration
├── vite.config.js                # Frontend build config
└── .env                          # Environment variables (not in git)
```

## Migration from Previous Hosting

### From Railway/Vercel
If you were previously using Railway or Vercel:
1. Export your database from Railway/Vercel
2. Import schema and data into Neon
3. Update `DATABASE_URL` environment variable
4. Deploy to Netlify

### Database Migration Steps
```bash
# Export from old database
pg_dump postgresql://old-host/db > backup.sql

# Import to Neon
psql "postgresql://user:pass@neon.tech/dreambid" < backup.sql
```

## Cost Estimation

| Service | Pricing | Notes |
|---------|---------|-------|
| **Netlify** | Free-$119/mo | Free tier includes 125k builds/month |
| **Neon** | Free-$75/mo | Free tier: 3 projects, 10GB storage, 1 month data retention |
| **Total** | ~$0-50/mo | Suitable for small-medium apps |

## Additional Resources

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Neon Documentation](https://neon.tech/docs)
- [Serverless Best Practices](https://www.netlify.com/blog/2021/01/06/how-to-deploy-node-js-on-netlify/)

## Support

For issues:
1. Check Netlify Functions logs: Site dashboard → Logs
2. Check Neon database logs: Neon dashboard → Logs
3. Verify environment variables are set correctly
4. Check database connection string format
