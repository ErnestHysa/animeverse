# Anime Stream - Production Deployment Guide

**Version:** 1.0  
**Last Updated:** April 6, 2026  

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Deployment Options](#deployment-options)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Deployment Platforms](#deployment-platforms)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (optional but recommended)
- Git

### 5-Minute Deploy (Vercel)

```bash
# 1. Clone repository
git clone https://github.com/your-username/anime-stream.git
cd anime-stream

# 2. Install dependencies
npm install

# 3. Build application
npm run build

# 4. Deploy to Vercel
vercel deploy --prod
```

---

## Deployment Options

| Platform | Difficulty | Cost | Best For |
|----------|-----------|------|----------|
| **Vercel** | ⭐ Easy | $20/mo | Quick deployment, global CDN |
| **Railway** | ⭐⭐ Medium | $25/mo | Full-stack with database included |
| **Fly.io** | ⭐⭐ Medium | $20/mo | Global edge deployment |
| **Self-hosted** | ⭐⭐⭐ Hard | Variable | Complete control, cost savings |

---

## Environment Configuration

### Step 1: Create Environment File

```bash
cp .env.production.example .env.production
```

### Step 2: Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 16

# Generate admin password
openssl rand -base64 12
```

### Step 3: Configure Environment Variables

Edit `.env.production` and set:

```env
# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Auth
JWT_SECRET=<generated-secret>
DEFAULT_ADMIN_PASSWORD=<strong-password>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/anime_stream

# Redis
REDIS_URL=redis://host:6379

# Monitoring (optional)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

---

## Database Setup

### Option 1: Neon (Recommended)

1. Go to [neon.tech](https://neon.tech)
2. Create free account
3. Create new project: `anime-stream`
4. Copy connection string
5. Update `DATABASE_URL` in `.env.production`

### Option 2: Railway

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL
4. Copy connection string
5. Update `DATABASE_URL` in `.env.production`

### Option 3: Self-hosted

```bash
# Using Docker
docker run -d \
  --name anime-stream-db \
  -e POSTGRES_USER=anime_stream \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_DB=anime_stream \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:15-alpine
```

### Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Seed database
npm run seed
```

---

## Deployment Platforms

### 1. Vercel (Recommended for Frontend)

#### Prerequisites
- Vercel account
- GitHub repository

#### Steps

1. **Import Project**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Deploy
   vercel
   ```

2. **Configure Environment Variables**
   - Go to project Settings → Environment Variables
   - Add all variables from `.env.production`
   - **Exclude:** `DATABASE_URL`, `REDIS_URL` (use Railway for these)

3. **Update Build Settings**
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

4. **Deploy**
   ```bash
   vercel --prod
   ```

#### Limitations
- ❌ No WebSocket support (watch parties won't work)
- ❌ No server-side features
- ✅ Use Vercel for frontend + Railway for backend

---

### 2. Railway (Recommended Full-Stack)

#### Prerequisites
- Railway account
- GitHub repository

#### Steps

1. **Create Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Add Services**
   - **Main App:** Railway detects Next.js automatically
   - **PostgreSQL:** Add → Database → PostgreSQL
   - **Redis:** Add → Database → Redis

3. **Configure Environment**
   - Railway automatically sets `DATABASE_URL` and `REDIS_URL`
   - Add remaining variables from `.env.production`

4. **Update Start Command**
   - Go to Settings
   - Set start command: `node server-custom.js`

5. **Deploy**
   - Railway auto-deploys on git push

---

### 3. Fly.io (Global Edge)

#### Prerequisites
- Fly.io account
- `flyctl` CLI

#### Steps

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**
   ```bash
   fly auth login
   ```

3. **Launch App**
   ```bash
   fly launch
   ```

4. **Configure**
   ```bash
   # Add PostgreSQL
   fly postgres create

   # Add Redis
   fly redis create

   # Set environment variables
   fly secrets set JWT_SECRET=your-secret
   fly secrets set DEFAULT_ADMIN_PASSWORD=your-password
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

---

### 4. Self-Hosted (Docker Compose)

#### Prerequisites
- Docker & Docker Compose
- Server with 2GB+ RAM

#### Steps

1. **Prepare Environment**
   ```bash
   cp .env.production.example .env
   # Edit .env with your values
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

3. **Run Migrations**
   ```bash
   docker-compose exec app npx prisma db push
   ```

4. **Check Status**
   ```bash
   docker-compose ps
   ```

5. **View Logs**
   ```bash
   docker-compose logs -f app
   ```

---

## Post-Deployment

### 1. Verify Deployment

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-04-06T12:00:00.000Z"}
```

### 2. Test Authentication

```bash
# Login as admin
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Expected response:
# {"success":true,"tokens":{"access":"...","refresh":"..."}}
```

### 3. Test Watch Party

```bash
# Create room
curl -X POST https://your-domain.com/api/watch-party/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Room",
    "animeId": 21459,
    "episodeNumber": 1,
    "isPublic": true
  }'

# Expected response:
# {"success":true,"room":{"id":"ABC123",...}}
```

### 4. Setup Monitoring

#### Sentry (Error Tracking)
1. Go to [sentry.io](https://sentry.io)
2. Create new project
3. Copy DSN
4. Add to environment variables:
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
   SENTRY_AUTH_TOKEN=your-token
   ```

#### Uptime Monitoring
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add monitor: `https://your-domain.com/api/health`
3. Configure alerts

### 5. Configure DNS

| Platform | DNS Setup |
|----------|-----------|
| **Vercel** | Automatic |
| **Railway** | CNAME: `your-app.railway.app` |
| **Fly.io** | CNAME: `your-app.fly.dev` |
| **Self-hosted** | A record: `your-server-ip` |

### 6. SSL Certificate

| Platform | SSL |
|----------|-----|
| **Vercel** | Automatic |
| **Railway** | Automatic |
| **Fly.io** | Automatic |
| **Self-hosted** | Use Certbot: `certbot --nginx -d yourdomain.com` |

---

## Troubleshooting

### Issue: "WebSocket connection failed"

**Solution:** 
- Ensure you're using custom server: `npm start` (not `npm run start:next`)
- Check WebSocket URL: `NEXT_PUBLIC_WS_URL=wss://yourdomain.com`
- Verify firewall allows WebSocket connections

### Issue: "Database connection failed"

**Solution:**
- Check `DATABASE_URL` is correct
- Verify database is accessible: `psql $DATABASE_URL`
- Check SSL settings: Add `?sslmode=require` if needed

### Issue: "Build failed"

**Solution:**
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Issue: "Watch parties not working"

**Solution:**
- Ensure using custom server: `server-custom.js`
- Check Redis is connected
- Verify WebSocket port is accessible
- Check browser console for errors

### Issue: "High memory usage"

**Solution:**
- Increase server RAM (recommended: 2GB+)
- Enable Redis for caching
- Adjust `NEXT_PRIVATE_MEMORY` in `next.config.ts`

### Issue: "Videos not playing"

**Solution:**
- Check CORS settings on video sources
- Verify HLS proxy is working: `/api/proxy-hls`
- Check browser console for hls.js errors
- Try different video source

---

## Scaling Guide

### When to Scale

- **CPU > 80%:** Add more servers
- **Memory > 90%:** Upgrade server size
- **Database > 1000 connections:** Add connection pooler
- **Slow API responses:** Add Redis caching

### Vertical Scaling (Upgrade Server)

| Users | RAM | CPU | Database |
|-------|-----|-----|----------|
| 1,000 | 2GB | 1 vCPU | Shared |
| 10,000 | 4GB | 2 vCPU | Dedicated |
| 100,000 | 16GB | 8 vCPU | Read replicas |

### Horizontal Scaling (Add Servers)

```bash
# Using Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.yml anime-stream
docker service scale anime-stream_app=3
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong `JWT_SECRET`
- [ ] Enable HTTPS everywhere
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Regular database backups
- [ ] Monitor error rates
- [ ] Review access logs
- [ ] Keep dependencies updated

---

## Backup Strategy

### Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backup (cron)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

### Redis Backups

```bash
# Manual backup
redis-cli --rdb /backups/dump-$(date +%Y%m%d).rdb

# Configure in redis.conf
save 900 1
save 300 10
save 60 10000
```

### Recovery

```bash
# Restore database
psql $DATABASE_URL < backup-20260406.sql

# Restore Redis
redis-cli --rdb /backups/dump-20260406.rdb
```

---

## Cost Optimization

| Optimization | Monthly Savings |
|-------------|-----------------|
| Enable Redis caching | $20 |
| Use CDN for assets | $15 |
| Optimize images | $10 |
| Database read replicas | $30 |
| **Total Potential Savings** | **$75/month** |

---

## Support

For issues or questions:
- GitHub: [repo-url]/issues
- Discord: [discord-invite]
- Email: support@animeverse.local

---

**Happy Streaming! 🎬**
