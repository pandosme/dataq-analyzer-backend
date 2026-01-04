# Docker Deployment

This directory contains Docker configuration files for deploying DataQ Analyzer.

## Files

- **Dockerfile** - Multi-stage build for backend + admin UI
- **docker-compose.yml** - Orchestration for backend, admin UI, and optional MongoDB
- **.dockerignore** - Files to exclude from Docker build context

## Quick Usage

### Option 1: Easy Way (Recommended)

From the project root:

```bash
# Configure environment
./setup.sh

# Start services
./start.sh start
```

### Option 2: Using docker-compose

**With bundled MongoDB:**
```bash
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d
```

**With external MongoDB:**
```bash
docker-compose -f docker/docker-compose.yml up -d
```

**Stop services:**
```bash
docker-compose -f docker/docker-compose.yml down
```

**View logs:**
```bash
docker-compose -f docker/docker-compose.yml logs -f
```

## Architecture

### Services

**backend**
- Runs the Express.js backend + Admin UI
- Port: 3000 (configurable via .env)
- Built from multi-stage Dockerfile
- Runs as non-root user for security

**mongodb** (optional, profile: `with-mongodb`)
- MongoDB 7.x
- Port: 27017 (configurable via .env)
- Data persisted in Docker volume `mongodb_data`
- Only starts when using `--profile with-mongodb`

### Volumes

- `mongodb_data` - MongoDB database files
- `mongodb_config` - MongoDB configuration
- `backend_logs` - Application logs

### Networks

- `dataq-network` - Bridge network for service communication

## Environment Variables

See [.env.example](../.env.example) for all available configuration options.

Required variables:
- `JWT_SECRET` - JWT signing secret (generate with ./setup.sh)
- `PORT` - Server port (default: 3000)
- MongoDB configuration (component-based OR MONGODB_URI)
- MQTT configuration

## Building Custom Images

### Build backend image

```bash
docker build -t dataq-backend:custom -f docker/Dockerfile .
```

### Build with different Node version

Edit the Dockerfile and change:
```dockerfile
FROM node:18-alpine AS admin-builder
```

to:
```dockerfile
FROM node:20-alpine AS admin-builder
```

## Profiles

Docker Compose profiles allow conditional service startup.

**with-mongodb** - Includes MongoDB service
```bash
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d
```

Without profile, only the backend service starts (use external MongoDB).

## Health Checks

Both services include health checks:

**Backend:**
- Endpoint: `http://localhost:3000/api/health`
- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 40 seconds

**MongoDB:**
- Command: `mongosh ping`
- Interval: 10 seconds
- Timeout: 5 seconds
- Start period: 20 seconds

## Security Notes

⚠️ The default configuration is NOT production-ready. See [../BACKLOG.md](../BACKLOG.md) for security hardening tasks.

**Before production:**
- Complete all CRITICAL security items in BACKLOG.md
- Use strong passwords for MongoDB
- Configure CORS to specific origins (not `*`)
- Enable TLS/SSL
- Review and harden network security

## Troubleshooting

### Backend won't start

Check logs:
```bash
docker-compose -f docker/docker-compose.yml logs backend
```

Common issues:
- `.env` file missing (run `./setup.sh`)
- MongoDB connection failed (check MONGODB_URI)
- Port already in use (change PORT in .env)

### MongoDB connection refused

If using bundled MongoDB:
```bash
# Check if MongoDB is running
docker-compose -f docker/docker-compose.yml ps mongodb

# View MongoDB logs
docker-compose -f docker/docker-compose.yml logs mongodb

# Restart MongoDB
docker-compose -f docker/docker-compose.yml restart mongodb
```

### Rebuild after code changes

```bash
docker-compose -f docker/docker-compose.yml down
docker-compose -f docker/docker-compose.yml build --no-cache
docker-compose -f docker/docker-compose.yml up -d
```

## Production Checklist

- [ ] All security items in BACKLOG.md completed
- [ ] Environment variables properly configured
- [ ] MongoDB credentials changed from defaults
- [ ] JWT_SECRET is unique and secure
- [ ] CORS_ORIGIN set to specific domains
- [ ] Backup strategy for MongoDB volumes
- [ ] Monitoring and logging configured
- [ ] SSL/TLS enabled

## Additional Resources

- [Deployment Guide](../DEPLOYMENT.md) - Comprehensive deployment documentation
- [Quick Start Guide](../QUICK_START.md) - 3-step getting started guide
- [Main README](../README.md) - Project overview
- [Security Backlog](../BACKLOG.md) - Security tasks
