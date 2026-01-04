# DataQ Analyzer - Deployment Guide

This guide provides step-by-step instructions for deploying the DataQ Analyzer Backend + Admin UI using Docker Compose.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Deployment Options](#deployment-options)
4. [Post-Deployment Setup](#post-deployment-setup)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Troubleshooting](#troubleshooting)
7. [Upgrading](#upgrading)

---

## Prerequisites

### System Requirements

- **Operating System:** Linux, macOS, or Windows with WSL2
- **Docker:** Version 20.10 or higher
- **Docker Compose:** Version 2.0 or higher
- **Memory:** Minimum 2GB RAM (4GB recommended)
- **Disk Space:** Minimum 5GB free space

### External Dependencies

- **MQTT Broker:** Required (e.g., Mosquitto, HiveMQ, AWS IoT Core)
- **MongoDB:** Optional (can use bundled MongoDB in Docker)

### Check Prerequisites

```bash
# Check Docker
docker --version
# Should show: Docker version 20.10.x or higher

# Check Docker Compose
docker-compose --version
# OR
docker compose version
# Should show: version 2.x or higher

# Verify Docker is running
docker ps
```

---

## Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/dataq-analyzer-backend.git
cd dataq-analyzer-backend
```

### Step 2: Run Setup Script

The interactive setup script will guide you through configuration:

```bash
./setup.sh
```

The script will:
- ✅ Generate a secure JWT secret automatically
- ✅ Ask you to configure MongoDB (bundled or external)
- ✅ Configure your MQTT broker connection
- ✅ Set CORS origins
- ✅ Create your `.env` file

### Step 3: Start the Services

**With Bundled MongoDB:**
```bash
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d
```

**With External MongoDB:**
```bash
docker-compose -f docker/docker-compose.yml up -d
```

### Step 4: Verify Deployment

```bash
# Check running containers
docker ps

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Check health
curl http://localhost:3000/api/health
```

### Step 5: Access the Application

- **Admin UI:** http://localhost:3000/admin
- **API:** http://localhost:3000/api

**First-time setup:** You'll be prompted to create an admin user on first visit to `/admin`

---

## Deployment Options

### Option 1: Bundled MongoDB (Recommended for Getting Started)

This option runs MongoDB in a Docker container alongside the application.

**Pros:**
- Easy to set up
- No external MongoDB required
- Data persists in Docker volumes

**Cons:**
- MongoDB and app share resources
- Not recommended for large-scale production

**Configuration (.env):**
```bash
MONGODB_HOST=mongodb
MONGODB_PORT=27017
MONGODB_DATABASE=dataq-analyzer
MONGODB_USERNAME=admin
MONGODB_PASSWORD=your_secure_password
MONGODB_AUTH_REQUIRED=true
```

**Start Command:**
```bash
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d
```

**NPM Shortcut:**
```bash
npm run docker:up:with-mongo
```

---

### Option 2: External MongoDB

Use an existing MongoDB instance (cloud or self-hosted).

**Pros:**
- Better for production
- Scalable and manageable independently
- Can use managed services (MongoDB Atlas, AWS DocumentDB)

**Cons:**
- Requires separate MongoDB setup

**Configuration (.env):**
```bash
MONGODB_URI=mongodb://username:password@host:27017/dataq-analyzer?authSource=admin
```

**Examples:**
```bash
# Local MongoDB without auth
MONGODB_URI=mongodb://localhost:27017/dataq-analyzer

# Local MongoDB with auth
MONGODB_URI=mongodb://admin:password@localhost:27017/dataq-analyzer?authSource=admin

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dataq-analyzer

# Network MongoDB
MONGODB_URI=mongodb://10.13.8.2:27017/dataq-analyzer
```

**Start Command:**
```bash
docker-compose -f docker/docker-compose.yml up -d
```

**NPM Shortcut:**
```bash
npm run docker:up
```

---

## Post-Deployment Setup

### 1. Create Initial Admin User

On first visit to http://localhost:3000/admin, you'll see the setup screen:

1. Enter admin username (minimum 3 characters)
2. Enter admin email (valid email format)
3. Enter admin password (minimum 6 characters, 8+ recommended)
4. Enter full name (optional)
5. Click "Create Admin User"

### 2. Configure MQTT Connection

After logging in as admin:

1. Go to **Settings** → **MQTT Configuration**
2. Enter your MQTT broker URL (e.g., `mqtt://mqtt-broker:1883`)
3. Enter credentials if required
4. Enable TLS if needed
5. Set topic prefix (default: `dataq/#`)
6. Click "Save" and then "Reconnect"

### 3. Add Cameras

1. Go to **Camera Management**
2. Click "Add Camera"
3. Choose camera type:
   - **Local Camera:** Accessible via VAPIX (requires IP, credentials)
   - **Remote Camera:** MQTT-only (no direct access needed)
4. Enter camera details:
   - Name
   - Serial Number (matches DataQ output)
   - MQTT Topic (default: `dataq/path/{SERIAL}`)
   - Filters (object types, minimum age, minimum distance)
5. Click "Save"

### 4. Add Users (Optional)

Admins can create additional users with restricted camera access:

1. Go to **User Management**
2. Click "Add User"
3. Enter user details
4. Assign authorized cameras
5. Click "Create User"

---

## Monitoring and Maintenance

### Viewing Logs

**All services:**
```bash
docker-compose -f docker/docker-compose.yml logs -f
```

**Backend only:**
```bash
docker-compose -f docker/docker-compose.yml logs -f backend
```

**MongoDB only:**
```bash
docker-compose -f docker/docker-compose.yml logs -f mongodb
```

**NPM Shortcut:**
```bash
npm run docker:logs
```

### Checking Status

```bash
# Container status
docker-compose -f docker/docker-compose.yml ps

# Health check
curl http://localhost:3000/api/health

# MongoDB status (if bundled)
docker exec -it dataq-mongodb mongosh --eval "db.adminCommand('ping')"
```

### Accessing MongoDB Shell

**If using bundled MongoDB:**
```bash
docker exec -it dataq-mongodb mongosh -u admin -p your_password --authenticationDatabase admin
```

**Common MongoDB commands:**
```javascript
// Switch to database
use dataq-analyzer

// Show collections
show collections

// Count path events
db.pathevents.countDocuments()

// Show recent paths
db.pathevents.find().sort({timestamp: -1}).limit(5)

// Count by camera
db.pathevents.aggregate([
  { $group: { _id: "$serialNumber", count: { $sum: 1 } } }
])
```

### Backup MongoDB Data

**Bundled MongoDB:**
```bash
# Create backup directory
mkdir -p backups

# Backup database
docker exec dataq-mongodb mongodump \
  -u admin -p your_password \
  --authenticationDatabase admin \
  --db dataq-analyzer \
  --out /data/backup

# Copy backup from container
docker cp dataq-mongodb:/data/backup ./backups/backup-$(date +%Y%m%d)
```

**Restore backup:**
```bash
docker cp ./backups/backup-20260101 dataq-mongodb:/data/restore

docker exec dataq-mongodb mongorestore \
  -u admin -p your_password \
  --authenticationDatabase admin \
  --db dataq-analyzer \
  /data/restore/dataq-analyzer
```

### Disk Space Management

**Check volume usage:**
```bash
docker system df -v
```

**Clean old path events (MongoDB shell):**
```javascript
// Delete events older than 30 days
db.pathevents.deleteMany({
  timestamp: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
})
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker-compose -f docker/docker-compose.yml logs backend
```

**Common issues:**
- `.env` file missing or misconfigured → Run `./setup.sh`
- Port 3000 already in use → Change `PORT` in `.env`
- MongoDB connection failed → Verify MongoDB is running and accessible

### MongoDB Connection Failed

**Bundled MongoDB:**
```bash
# Check if MongoDB container is running
docker ps | grep mongodb

# View MongoDB logs
docker-compose -f docker/docker-compose.yml logs mongodb

# Restart MongoDB
docker-compose -f docker/docker-compose.yml restart mongodb
```

**External MongoDB:**
```bash
# Test connection from backend container
docker exec -it dataq-backend node -e "
  import('mongoose').then(m =>
    m.default.connect('YOUR_MONGODB_URI')
      .then(() => console.log('✓ Connected'))
      .catch(e => console.error('✗ Failed:', e.message))
  )
"
```

### MQTT Connection Issues

**Check MQTT broker availability:**
```bash
# From host machine
telnet mqtt-broker-host 1883

# OR using mosquitto client
mosquitto_sub -h mqtt-broker-host -p 1883 -t dataq/#
```

**Test from backend container:**
```bash
docker exec -it dataq-backend node -e "
  import('mqtt').then(m => {
    const client = m.default.connect('mqtt://broker:1883');
    client.on('connect', () => console.log('✓ MQTT Connected'));
    client.on('error', (e) => console.error('✗ MQTT Error:', e.message));
  })
"
```

**Reconnect MQTT:**
1. Log in to admin UI
2. Go to Settings → MQTT Configuration
3. Click "Reconnect"

### API Returns 500 Errors

**Check backend logs:**
```bash
docker-compose -f docker/docker-compose.yml logs backend | tail -50
```

**Common causes:**
- Database connection lost
- Invalid JWT secret
- Malformed request data

### Cannot Access Admin UI

**Check these issues:**
```bash
# 1. Is frontend built?
docker exec dataq-backend ls -la /app/dist/admin

# If empty, rebuild the image
docker-compose -f docker/docker-compose.yml down
docker-compose -f docker/docker-compose.yml build --no-cache
docker-compose -f docker/docker-compose.yml up -d

# 2. Check CORS settings
# Make sure CORS_ORIGIN in .env allows your browser's origin
```

### Performance Issues

**Check resource usage:**
```bash
docker stats
```

**If MongoDB is slow:**
- Check if indexes exist: `db.pathevents.getIndexes()`
- Monitor query performance
- Consider upgrading container resources
- Archive old data

---

## Upgrading

### Update to Latest Version

```bash
# Stop services
docker-compose -f docker/docker-compose.yml down

# Backup database (important!)
# See "Backup MongoDB Data" section above

# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker/docker-compose.yml build --no-cache

# Start services
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d

# Check logs for any migration messages
docker-compose -f docker/docker-compose.yml logs -f
```

### Rollback to Previous Version

```bash
# Stop services
docker-compose -f docker/docker-compose.yml down

# Checkout previous version
git checkout <previous-tag-or-commit>

# Restore database backup if needed
# See "Backup MongoDB Data" section above

# Rebuild and start
docker-compose -f docker/docker-compose.yml build
docker-compose -f docker/docker-compose.yml up -d
```

---

## Environment Variables Reference

### Server Configuration
| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `production` | No | Environment mode |
| `PORT` | `3000` | No | HTTP server port |

### Authentication
| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `JWT_SECRET` | - | **Yes** | JWT signing secret (generate with setup.sh) |
| `JWT_EXPIRES_IN` | `7d` | No | JWT token expiration |

### MongoDB (Component-based)
| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MONGODB_HOST` | `mongodb` | No* | MongoDB hostname |
| `MONGODB_PORT` | `27017` | No* | MongoDB port |
| `MONGODB_DATABASE` | `dataq-analyzer` | No* | Database name |
| `MONGODB_USERNAME` | - | No* | MongoDB username |
| `MONGODB_PASSWORD` | - | No* | MongoDB password |
| `MONGODB_AUTH_REQUIRED` | `true` | No* | Enable authentication |

### MongoDB (Connection String)
| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MONGODB_URI` | - | No* | Full MongoDB connection string |

*Either component-based OR connection string is required

### MQTT
| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | **Yes** | MQTT broker URL |
| `MQTT_USERNAME` | - | No | MQTT username |
| `MQTT_PASSWORD` | - | No | MQTT password |
| `MQTT_USE_TLS` | `false` | No | Enable TLS |
| `MQTT_TOPIC_PREFIX` | `dataq/#` | No | MQTT topic pattern |

### CORS
| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CORS_ORIGIN` | `*` | No | Allowed origins (comma-separated) |

---

## Production Checklist

Before deploying to production:

### Security
- [ ] Review and complete [BACKLOG.md](BACKLOG.md) security items
- [ ] Change `JWT_SECRET` from default value
- [ ] Set strong MongoDB passwords
- [ ] Configure `CORS_ORIGIN` to specific domains (not `*`)
- [ ] Enable HTTPS/TLS for MQTT if supported
- [ ] Review and harden MongoDB access rules
- [ ] Enable firewall rules for ports 3000, 1883, 27017

### Reliability
- [ ] Set up automated backups for MongoDB
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Test disaster recovery procedure
- [ ] Document runbook for common issues

### Performance
- [ ] Load test the application
- [ ] Monitor resource usage (CPU, memory, disk)
- [ ] Configure MongoDB indexes for your query patterns
- [ ] Plan data retention and archival strategy

---

## Additional Resources

- **Project README:** [README.md](README.md)
- **Security Backlog:** [BACKLOG.md](BACKLOG.md)
- **API Documentation:** http://localhost:3000/api (after deployment)
- **Docker Compose Reference:** https://docs.docker.com/compose/
- **MongoDB Documentation:** https://docs.mongodb.com/
- **MQTT Documentation:** https://mqtt.org/

---

## Support

For issues and questions:
- **GitHub Issues:** https://github.com/your-org/dataq-analyzer-backend/issues
- **Security Issues:** See [BACKLOG.md](BACKLOG.md)
