# Quick Start: Netlify + Neon Deployment

## TL;DR - 5 Steps to Deploy

### 1. Create Neon Database
```bash
# Visit https://neon.tech → Sign up → Create project
# Copy connection string: postgresql://user:pass@neon.tech/dreambid?sslmode=require
```

### 2. Set Environment Variables
Create `.env`:
```env
DATABASE_URL=postgresql://user:pass@neon.tech/dreambid?sslmode=require
NODE_ENV=production
FRONTEND_URL=https://your-site.netlify.app
```

### 3. Connect to Netlify
```bash
# Option A: Via UI
# 1. Go to app.netlify.com → New site from Git
# 2. Select your repository

# Option B: Via CLI
npm install -g netlify-cli
netlify init
netlify deploy --prod
```

### 4. Add Environment Variables in Netlify
1. Site dashboard → Build & deploy → Environment
2. Add `DATABASE_URL`, `NODE_ENV`, `FRONTEND_URL`
3. Trigger new deploy

### 5. Verify Deployment
```bash
curl https://your-site.netlify.app/api/health
# Should return: { "status": "OK", "timestamp": "..." }
```

## Differences from Previous Setup

| Aspect | Old | New |
|--------|-----|-----|
| **Hosting** | Railway/Vercel | Netlify |
| **Database** | Railway/Neon | Neon (only) |
| **Backend** | Express server | Netlify Functions |
| **Cost** | $5-20/mo | Free-$50/mo |
| **Cold Start** | <1s | 5-10s (serverless) |

## Key File Changes

- **netlify/functions/api.js** - New serverless handler
- **netlify.toml** - Updated with functions config
- **config/database.js** - No changes needed (already supports DATABASE_URL)
- **server.js** - Still used for local development only

## Testing Locally

```bash
npm install
npm run dev
```

Visit: `http://localhost:5173` (frontend) and `http://localhost:5000` (API)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 on `/api/*` | Check netlify.toml redirects |
| DB connection error | Verify DATABASE_URL in Netlify env vars |
| Functions not building | Check netlify/functions/api.js syntax |
| CORS errors | Update allowedOrigins in netlify/functions/api.js |

## Next Steps

1. Read full guide: [NETLIFY_NEON_SETUP.md](./NETLIFY_NEON_SETUP.md)
2. Deploy and test
3. Monitor Netlify Functions logs
4. Set up caching if needed

---

For detailed information, see [NETLIFY_NEON_SETUP.md](./NETLIFY_NEON_SETUP.md)
