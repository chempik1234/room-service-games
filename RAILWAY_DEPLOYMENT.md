# 🚂 Railway Deployment Guide

**Railway** is the perfect platform for deploying RoomService games because it supports long-running Node.js servers with real-time connections.

## 🎯 Why Railway?

- ✅ **Full container hosting** (not serverless)
- ✅ **Long-running processes** (perfect for game servers)
- ✅ **WebSocket support** (real-time multiplayer)
- ✅ **Free tier** ($5/month credit)
- ✅ **GitHub integration** (auto-deploy)
- ✅ **Easy environment variables**

## 🚀 Quick Deployment

### Step 1: Prepare Your Repository

1. **Push gaming repository to GitHub:**
   ```bash
   cd room-service-games
   git init
   git add .
   git commit -m "Ready for Railway deployment"
   git remote add origin https://github.com/yourusername/room-service-games.git
   git push -u origin main
   ```

2. **Railway configurations are already set up:**
   - `pixel-battle/railway.json`
   - `gartic-phone/railway.json`
   - `tic-tac-toe/railway.json`

### Step 2: Deploy to Railway

1. **Go to [railway.app](https://railway.app/)** and sign up/login
2. **Click "New Project" → "Deploy from GitHub repo"**
3. **Select your `room-service-games` repository**

### Step 3: Configure Each Game

Railway will detect the individual game folders. For each game:

#### **Pixel Battle**
- **Root Directory**: `pixel-battle`
- **Start Command**: `node server.js`
- **Environment Variables**:
  ```
  PORT=3001
  ROOMSERVICE_HOST=your-roomservice-host:50052
  ROOMSERVICE_API_KEY=your-api-key
  NODE_ENV=production
  ```

#### **Gartic Phone**
- **Root Directory**: `gartic-phone`
- **Start Command**: `node server.js`
- **Environment Variables**:
  ```
  PORT=3002
  ROOMSERVICE_HOST=your-roomservice-host:50052
  ROOMSERVICE_API_KEY=your-api-key
  NODE_ENV=production
  ```

#### **Tic-Tac-Toe**
- **Root Directory**: `tic-tac-toe`
- **Start Command**: `tsx server.ts`
- **Environment Variables**:
  ```
  PORT=3000
  ROOMSERVICE_HOST=your-roomservice-host:50052
  ROOMSERVICE_API_KEY=your-api-key
  NODE_ENV=production
  ```

## 🔧 Environment Setup

### In Railway Dashboard:

1. **Select your project**
2. **Click on each service** (pixel-battle, gartic-phone, tic-tac-toe)
3. **Go to "Variables" tab**
4. **Add environment variables:**

```bash
# RoomService Configuration
ROOMSERVICE_HOST=roomky.chickenkiller.com:50052
ROOMSERVICE_API_KEY=rs_live_tenant-20s-b15968f3_dbb54fa5-e970-4b0e-a044-41313bf79dee

# Server Configuration
PORT=3001  # Use 3000, 3001, 3002 for different games
NODE_ENV=production
```

## 🌐 Getting Your URLs

After deployment, Railway will provide URLs like:
- `https://pixel-battle-production.up.railway.app`
- `https://gartic-phone-production.up.railway.app`
- `https://tic-tac-toe-production.up.railway.app`

## 🔄 Continuous Deployment

**Automatic Deployments:**
- Every `git push` to main triggers automatic deployment
- Railway builds and deploys each game separately
- Zero-downtime deployments

## 💰 Pricing & Free Tier

**Railway Free Tier:**
- $5/month credit
- Sufficient for all 3 games
-512MB RAM per service
- Always-on servers

**Usage Estimates:**
- Each game: ~100-200MB RAM
- Total for 3 games: ~400-600MB
- Well within free tier limits

## 📊 Monitoring

Railway provides:
- **Metrics**: CPU, memory, network usage
- **Logs**: Real-time application logs
- **Health Checks**: `/health` endpoint monitoring
- **Alerts**: Free tier usage warnings

## 🛠️ Troubleshooting

### Common Issues:

**1. Port Conflicts**
- Each game must use different PORT (3000, 3001, 3002)
- Railway automatically handles port mapping

**2. RoomService Connection**
- Ensure ROOMSERVICE_HOST is accessible from Railway
- Check firewall rules if using private RoomService instance
- Test connection: `curl https://your-roomservice-host:50052`

**3. Build Failures**
- Check `package.json` has correct dependencies
- Ensure `railway.json` has proper start command
- Review Railway build logs

**4. Runtime Errors**
- Check Railway logs for error messages
- Verify environment variables are set
- Test locally with same configuration

## 🚀 Alternative: Individual Repositories

If you prefer separate repositories:

```bash
# Create separate GitHub repos
- https://github.com/yourusername/pixel-battle
- https://github.com/yourusername/gartic-phone
- https://github.com/yourusername/tic-tac-toe

# Deploy each independently on Railway
```

## 📱 Custom Domains (Optional)

**Add Custom Domain:**
1. **Go to service Settings → Domains**
2. **Add custom domain** (e.g., `games.yourdomain.com`)
3. **Configure DNS** (CNAME record)
4. **Railway handles SSL certificates automatically**

## 🔒 Security Best Practices

**Production Deployment:**
- ✅ Use production RoomService API keys
- ✅ Enable Railway's built-in SSL
- ✅ Set up monitoring and alerts
- ✅ Use environment-specific configurations
- ✅ Regular dependency updates

## 🎮 Scaling

**When to Scale:**
- **CPU > 80%**: Add more RAM
- **Many players**: Add more services
- **Global reach**: Use Railway regions

**Railway Scaling:**
- **Free tier**: 512MB RAM
- **Paid plans**: Start at $5/month
- **Automatic scaling** based on usage

## 📚 Additional Resources

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **RoomService SDK**: See `room-service-js/README.md`
- **Game Documentation**: See individual game folders

## 🎯 Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Railway project created
- [ ] All 3 games deployed
- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] Custom domains configured (optional)
- [ ] Monitoring set up
- [ ] Backup plan documented

**Your games are ready for production!** 🚀