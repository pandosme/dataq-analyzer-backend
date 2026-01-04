# DataQ Analyzer - Backend + Admin UI

Backend API server with embedded admin interface for managing users, cameras, and system configuration.

## Overview

This repository contains:
- **Express.js Backend API** - REST API for DataQ camera data analysis
- **Admin UI** - React-based admin dashboard served at `/admin`
- **MongoDB Integration** - Data persistence with optional bundled or external MongoDB
- **MQTT Client** - Real-time data collection from Axis DataQ cameras
- **VAPIX Integration** - Direct communication with local Axis cameras

## Features

- 🔐 JWT-based authentication with role-based access control
- 👥 User management (admin only)
- 📷 Camera management (local VAPIX and remote MQTT cameras)
- ⚙️ System configuration (MQTT, MongoDB, playback integration)
- 📊 Path event data collection and querying
- 🐳 Docker deployment with optional MongoDB

## Architecture

```
Backend (Port 3000)
├── /api/*           → REST API endpoints
├── /admin/*         → Admin UI (React SPA)
└── /                → API information
```

## Quick Start

> 💡 **New User?** See [QUICK_START.md](QUICK_START.md) for a 3-step getting started guide!
>
> Use the interactive `./setup.sh` script for guided configuration, then `./start.sh` to launch!

### Prerequisites

- **Docker & Docker Compose** (for production deployment)
- **Node.js 18+** (for development only)
- **MongoDB** (bundled with Docker or external)
- **MQTT broker** for DataQ messages (e.g., Mosquitto, HiveMQ)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/dataq-analyzer-backend.git
   cd dataq-analyzer-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd admin-ui && npm install && cd ..
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development servers**
   ```bash
   # Terminal 1: Start backend
   npm run dev

   # Terminal 2: Start admin UI dev server
   npm run dev:admin
   ```

5. **Access the application**
   - Backend API: http://localhost:3000/api
   - Admin UI (dev): http://localhost:5174
   - Admin UI (via backend): http://localhost:3000/admin (after building)

### Production Deployment (Docker) - Recommended

#### Quick Setup with Interactive Script

The easiest way to get started is using the interactive setup script:

```bash
# Run the setup script
./setup.sh
```

The script will guide you through:
- Generating secure JWT secrets
- Configuring MongoDB (bundled or external)
- Setting up MQTT broker connection
- Configuring CORS and other settings
- Creating your `.env` file automatically

After setup completes, start the services:

```bash
# With bundled MongoDB
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d

# OR with external MongoDB
docker-compose -f docker/docker-compose.yml up -d
```

#### Manual Setup (Alternative)

If you prefer to configure manually:

**Option 1: With Bundled MongoDB (Default)**

```bash
# Create .env file with your configuration
cp .env.example .env

# Edit .env - set JWT_SECRET and other required values
nano .env

# Start with MongoDB
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d
```

**Option 2: With External MongoDB**

```bash
# Edit .env and set MONGODB_URI to your external MongoDB
nano .env
# MONGODB_URI=mongodb://10.13.8.2:27017/dataq-analyzer

# Start without MongoDB service
docker-compose -f docker/docker-compose.yml up -d
```

**Access:**
- API: http://localhost:3000/api
- Admin UI: http://localhost:3000/admin
- MongoDB (if bundled): localhost:27017

**Detailed deployment documentation:** See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guide, troubleshooting, and production checklist.

## Configuration

### Environment Variables

See [.env.example](.env.example) for all configuration options.

**Required:**
- `JWT_SECRET` - JWT signing secret (CHANGE IN PRODUCTION!)
- `PORT` - Server port (default: 3000)

**MongoDB Options:**

**Option A: Component-based (Bundled - Default)**
```bash
MONGODB_HOST=mongodb
MONGODB_PORT=27017
MONGODB_DATABASE=dataq-analyzer
MONGODB_USERNAME=admin
MONGODB_PASSWORD=changeme
MONGODB_AUTH_REQUIRED=true
```

**Option B: Connection String (External)**
```bash
MONGODB_URI=mongodb://username:password@host:27017/database?authSource=admin
```

**MQTT Configuration:**
```bash
MQTT_BROKER_URL=mqtt://mqtt-broker:1883
MQTT_TOPIC_PREFIX=dataq/#
```

**CORS Configuration:**
```bash
CORS_ORIGIN=*  # Development: *, Production: http://frontend-url:port
```

### Initial Setup

1. Access admin UI: http://localhost:3000/admin
2. Create initial admin user (first-time setup)
3. Log in with admin credentials
4. Configure cameras and MQTT connection in Settings

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Create user (admin only)

### Cameras
- `GET /api/cameras` - List all cameras
- `POST /api/cameras` - Create camera (admin only)
- `PUT /api/cameras/:id` - Update camera (admin only)
- `DELETE /api/cameras/:id` - Delete camera (admin only)

### Path Events
- `GET /api/paths` - Query path events (with filters)
- `GET /api/paths/:id` - Get path event by ID
- `GET /api/paths/stats/:serialNumber` - Get statistics

### Configuration (Admin Only)
- `/api/config/mqtt` - MQTT configuration
- `/api/config/mongodb` - MongoDB configuration
- `/api/config/system` - System settings

## Development

### NPM Scripts

```bash
npm run dev              # Start backend in development mode
npm run dev:admin        # Start admin UI dev server
npm run start            # Start backend in production mode
npm run build:admin      # Build admin UI for production
npm run docker:build     # Build Docker image
npm run docker:up        # Start with docker-compose (no MongoDB)
npm run docker:up:with-mongo  # Start with bundled MongoDB
npm run docker:down      # Stop docker-compose
npm run docker:logs      # View docker logs
```

### Project Structure

```
dataq-analyzer-backend/
├── src/                 # Backend source code
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── models/          # Mongoose models
│   ├── middleware/      # Express middleware
│   ├── mqtt/            # MQTT client
│   ├── dataq/           # DataQ message parser
│   └── server.js        # Entry point
├── admin-ui/            # Admin frontend
│   ├── src/             # React source code
│   ├── public/          # Static assets
│   └── vite.config.js   # Vite configuration
├── docker/              # Docker configuration
│   ├── Dockerfile       # Multi-stage build
│   ├── docker-compose.yml
│   └── .dockerignore
└── dist/admin/          # Built admin UI (served by Express)
```

## Troubleshooting

### MongoDB Connection Issues

**Problem:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solutions:**
- If using bundled MongoDB: Ensure docker-compose started with `--profile with-mongodb`
- If using external MongoDB: Check `MONGODB_URI` or component-based config
- Verify MongoDB is running: `docker ps` or `systemctl status mongod`

### MQTT Connection Issues

**Problem:** Cannot connect to MQTT broker

**Solutions:**
- Check `MQTT_BROKER_URL` in .env
- Verify MQTT broker is accessible: `telnet mqtt-broker 1883`
- Check MQTT credentials if authentication is required

### Admin UI Not Loading

**Problem:** `/admin` shows 404 or blank page

**Solutions:**
- Build admin UI: `npm run build:admin`
- Check `dist/admin/` directory exists
- Restart backend server

### CORS Errors from Frontend

**Problem:** Frontend gets CORS errors when calling API

**Solutions:**
- Set `CORS_ORIGIN` in .env to frontend URL
- For multiple origins: `CORS_ORIGIN=http://localhost:8080,http://192.168.1.100:8080`

## Security

⚠️ **Important**: This project is not yet production-ready. See [BACKLOG.md](BACKLOG.md) for security issues that must be addressed before deploying to production or publishing to Docker Hub.

**Critical security tasks include:**
- Adding comprehensive test coverage
- Fixing dependency vulnerabilities
- Adding input validation and sanitization
- Implementing rate limiting
- Adding security headers
- Encrypting camera passwords

**Do not use in production until all CRITICAL and HIGH priority items in BACKLOG.md are completed.**

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/dataq-analyzer-backend/issues
- Security Issues: See [BACKLOG.md](BACKLOG.md)
