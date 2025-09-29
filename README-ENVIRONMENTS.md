# Environment Configuration Guide

This project supports multiple environment configurations for different deployment scenarios.

## 🚀 Quick Start

### 1. Local Development (External Services)
```bash
# Uses external database (port 3307) and external ChatFusion service
npm run dev
```

### 2. Local Development (Everything Local)
```bash
# Uses local database (port 3306) and local ChatFusion service
npm run local
```

### 3. Docker Development
```bash
# Uses Docker with development configuration
npm run docker:dev
```

### 4. Docker Production
```bash
# Uses Docker with production configuration
npm run docker:prod
```

## 📁 Environment Files

| File | Purpose | Database | ChatFusion Service |
|------|---------|----------|-------------------|
| `.env.development` | External services | External (3307) | External (chatfusion.murraltd.com) |
| `.env.local` | Everything local | Local (3306) | Local (localhost:5500) |
| `.env.production` | Docker production | External (3307) | External (chatfusion.murraltd.com) |

## 🔧 Environment Details

### Development Environment (`.env.development`)
- **Database**: External MySQL on port 3307
- **ChatFusion**: External service (chatfusion.murraltd.com)
- **Rate Limiting**: Enabled
- **Debug**: Enabled
- **Trust Proxy**: Disabled

### Local Environment (`.env.local`)
- **Database**: Local MySQL on port 3306
- **ChatFusion**: Local service (localhost:5500)
- **Rate Limiting**: Disabled
- **Debug**: Enabled
- **Trust Proxy**: Disabled

### Production Environment (`.env.production`)
- **Database**: External MySQL on port 3307
- **ChatFusion**: External service (chatfusion.murraltd.com)
- **Rate Limiting**: Enabled
- **Debug**: Disabled
- **Trust Proxy**: Enabled (for Docker)

## 🐳 Docker Commands

### Development Docker
```bash
# Start development container
npm run docker:dev

# View logs
npm run docker:logs

# Restart container
npm run docker:restart

# Stop container
npm run docker:down
```

### Production Docker
```bash
# Start production container
npm run docker:prod

# View logs
npm run docker:logs

# Restart container
npm run docker:restart

# Stop container
npm run docker:down
```

## 🗄️ Database Setup

### For External Database (Development/Production)
```bash
# Create database
npm run db:create:dev

# Run migrations
npm run migrate:dev

# Seed initial data
npm run seed:dev:initial
```

### For Local Database
```bash
# Make sure MySQL is running on port 3306
# Then run the same commands as above
```

## 🔍 Troubleshooting

### Connection Issues
1. **Database Connection**: Check if MySQL is running on the correct port
2. **ChatFusion Service**: Ensure the ChatFusion service is running
3. **Port Conflicts**: Make sure ports 5550 and 3306/3307 are available

### Environment Switching
```bash
# Switch to local environment
cp .env.local .env

# Switch to development environment
cp .env.development .env

# Switch to production environment
cp .env.production .env
```

### Docker Issues
```bash
# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check container status
docker ps
docker logs chatfusion_backend
```

## 📊 Environment Comparison

| Feature | Development | Local | Production |
|---------|-------------|-------|------------|
| Database Port | 3307 | 3306 | 3307 |
| ChatFusion URL | External | Local | External |
| Rate Limiting | On | Off | On |
| Debug Mode | On | On | Off |
| Trust Proxy | Off | Off | On |
| JWT Secret | Dev | Local | Production |
| Pool Size | 10 | 5 | 20 |

## 🚀 Recommended Workflow

1. **Development**: Use `npm run dev` for external services
2. **Local Testing**: Use `npm run local` for everything local
3. **Docker Testing**: Use `npm run docker:dev` for Docker development
4. **Production**: Use `npm run docker:prod` for production deployment

## 🔧 Custom Environment

To create a custom environment:

1. Copy an existing `.env.*` file
2. Modify the configuration as needed
3. Use `cp .env.custom .env` to activate it
4. Run `node server.js` to start with custom config
