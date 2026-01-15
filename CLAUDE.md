# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataQ Analyzer is a full-stack application for collecting and analyzing path/flow data from Axis DataQ cameras. It consists of:
- **Express.js Backend** - REST API and WebSocket server
- **React Admin UI** - Admin dashboard served from root path
- **MQTT Integration** - Real-time data collection from cameras
- **MongoDB** - Data persistence for path events, cameras, and configuration
- **VAPIX Integration** - Direct communication with local Axis cameras
- **Video Playback** - On-demand video retrieval from recording servers (VideoX, Milestone, ACS)

## Technical Notes

- **ES Modules**: Project uses ES modules (`"type": "module"` in package.json). Use `import`/`export` syntax.
- **No Test Suite**: Tests are not yet implemented. See BACKLOG.md for test coverage requirements.

## Common Development Commands

### Initial Setup
```bash
npm install              # Install backend dependencies
cd admin-ui && npm install  # Install admin UI dependencies (separate package.json)
```

### Backend Development
```bash
npm run dev              # Start backend with nodemon (auto-reload)
npm start                # Start backend in production mode
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format code with Prettier
```

### Admin UI Development
```bash
npm run dev:admin        # Start Vite dev server (port 5174)
npm run build:admin      # Build admin UI for production (outputs to dist/admin/)
```

### Docker Commands
```bash
npm run docker:build     # Build Docker image
npm run docker:up        # Start with docker-compose (external MongoDB)
npm run docker:up:with-mongo  # Start with bundled MongoDB
npm run docker:down      # Stop all containers
npm run docker:logs      # View container logs
```

### Database Scripts
```bash
node scripts/check-databases.js    # List all databases and collections
node scripts/check-api-key.js      # Verify VideoX API key
node scripts/configure-playback.js # Configure video playback settings
```

### Setup
```bash
./setup.sh               # Interactive setup script (generates .env)
```

## Architecture

### Application Startup Flow

1. **src/server.js** - Entry point
   - Connects to MongoDB via `src/db/connection.js`
   - Runs database migrations (e.g., camera filter defaults)
   - Creates Express app via `src/app.js`
   - Creates HTTP server and attaches WebSocket server
   - Connects to MQTT broker via `src/mqtt/client.js`
   - Listens on configured port (default: 3303)

2. **src/app.js** - Express application factory
   - Configures CORS (supports wildcard or comma-separated origins)
   - Mounts API routes at `/api`
   - Serves admin UI static files from root path
   - Implements catch-all route for React Router (serves index.html)

### Data Flow

**MQTT → Database → WebSocket:**
```
Axis Camera → MQTT Broker → src/mqtt/client.js
  → src/dataq/parser.js (parse DataQ message)
  → src/services/pathEventService.js (save to MongoDB)
  → src/websocket/broadcaster.js (broadcast to subscribed clients)
```

**REST API:**
```
Client → Express Routes (src/routes/)
  → Services (src/services/)
  → Models (src/models/)
  → MongoDB
```

### Key Architectural Patterns

1. **MQTT Message Handling**
   - Topic pattern: `dataq/path/{serialNumber}` for path events
   - Topic pattern: `image/{serialNumber}` for camera snapshots (remote cameras)
   - Topic pattern: `dataq/connect/+` for device announcements
   - Messages are parsed by `src/dataq/parser.js` and stored as-is (preserves original property names)
   - Camera subscriptions are dynamic - loaded from database on startup

2. **WebSocket Architecture**
   - Two WebSocket endpoints: `/ws/paths` (events) and `/ws/video` (playback)
   - JWT authentication via query parameter: `?token=<jwt>`
   - Client subscribes to specific cameras with optional filters (classes, minAge, minDistance, minDwell)
   - Server-side filtering before broadcasting to clients
   - Authorization: admins can subscribe to all cameras, users only to authorized cameras

3. **Video Playback Pipeline**
   - Backend proxies video from recording server (VideoX/Milestone/ACS)
   - Buffers complete video into memory, writes to temp file (`/tmp/videox-*.mp4`)
   - ffmpeg fragments MP4 (relocates moov atom for MediaSource API compatibility)
   - Streams fragmented chunks via WebSocket as binary messages
   - Frontend uses MediaSource API to progressively load video
   - Temp files automatically deleted after streaming
   - See VIDEO_PLAYBACK_FIX.md for detailed implementation

4. **Admin UI Architecture**
   - React SPA served from root path (not `/admin`)
   - JWT stored in localStorage
   - AuthContext provides authentication state
   - DateFormatContext provides global date formatting (US/ISO/EU)
   - API calls via `src/services/api.js`
   - Router-based navigation (Dashboard, Camera Management, User Management, Settings)

5. **Authentication**
   - Environment-based admin account (stored in .env, not database)
   - Bcrypt password hashing with `ADMIN_PASSWORD_HASH`
   - Additional users stored in MongoDB with role-based access (admin/user)
   - JWT tokens with configurable expiration (default: 7 days)

6. **Configuration Management**
   - Environment variables via .env file (see .env.example)
   - MongoDB connection supports both connection string (MONGODB_URI) or component-based (HOST, PORT, etc.)
   - System configuration stored in MongoDB (SystemConfig model)
   - MQTT and playback settings configurable via admin UI

### Important Models (src/models/)

- **Camera** - Camera configuration, filters, device status, snapshots
- **PathEvent** - DataQ path/flow events (stored as-is from MQTT)
- **User** - User accounts with role-based access
- **SystemConfig** - System settings (date format, playback config, app name)
- **MqttConfig** - MQTT broker configuration
- **MongoConfig** - MongoDB connection configuration

### Directory Structure

```
src/
├── config/          - Configuration loading (serverConfig, mqttConfig)
├── dataq/           - DataQ message parser
├── db/              - MongoDB connection and event handlers
├── middleware/      - Express middleware (auth.js for JWT)
├── models/          - Mongoose models
├── mqtt/            - MQTT client and subscription management
├── routes/          - Express routes (auth, cameras, paths, config, users, health)
├── services/        - Business logic (authService, cameraService, pathEventService, videoService, vapixService)
├── utils/           - Utilities (logger.js)
├── websocket/       - WebSocket server, handlers, broadcaster, filters
├── app.js           - Express app factory
└── server.js        - Entry point

admin-ui/
├── src/
│   ├── components/  - React components (Dashboard, CameraManagement, Login, Settings, etc.)
│   ├── context/     - React contexts (AuthContext, DateFormatContext)
│   ├── services/    - API client (api.js)
│   ├── utils/       - Utilities (dateFormat.js)
│   ├── App.jsx      - Root component with routing
│   └── main.jsx     - React entry point
├── public/          - Static assets (media-stream-player.min.js)
└── dist/            - Production build output
```

## Working with Path Events

Path events are stored **exactly as received** from MQTT messages. All original property names are preserved:
- `serial` (not `serialNumber`)
- `class` (not `objectClass`)
- `timestamp` (Unix epoch seconds)
- `dx`, `dy` (displacement)
- `path` array with `x`, `y`, `d` coordinates (0-1000 normalized)

Query path events using MongoDB syntax via POST /api/paths/query:
```javascript
{
  "query": {
    "serial": "B8A44F3024BB",
    "class": "Human",
    "age": { "$gte": 3 }
  },
  "options": {
    "sort": { "timestamp": -1 },
    "limit": 100
  }
}
```

## Environment Configuration

Required environment variables:
- `JWT_SECRET` - MUST be changed in production (use setup.sh to generate)
- `ADMIN_PASSWORD_HASH` - Bcrypt hash of admin password
- `MONGODB_URI` or component-based MongoDB config
- `PORT` - Server port (default: 3303)

Optional but important:
- `CORS_ORIGIN` - Frontend URLs (comma-separated or *)
- `MQTT_BROKER_URL` - MQTT broker connection
- `NODE_ENV` - production or development

## Testing & Debugging

### Test MQTT Connection
```bash
# Subscribe to all DataQ topics
mosquitto_sub -h <broker-host> -t 'dataq/#' -v

# Publish test message
mosquitto_pub -h <broker-host> -t 'dataq/path/TEST123' -m '{"id":"123","class":"Human",...}'
```

### Test WebSocket
```bash
# Get JWT token
TOKEN=$(curl -X POST http://localhost:3303/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.data.token')

# Connect to path events WebSocket
wscat -c "ws://localhost:3303/ws/paths?token=$TOKEN"

# Subscribe to camera (send after connection)
{"type":"subscribe","cameras":["B8A44F3024BB"]}
```

### Test Video Playback
```bash
# Check VideoX server connection
curl http://<videox-server>:3002/health

# Verify API key
node scripts/check-api-key.js
```

### MongoDB Queries
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/dataq-analyzer

# View recent path events
db.pathevents.find().sort({timestamp: -1}).limit(10)

# Count events by class
db.pathevents.aggregate([
  { $group: { _id: "$class", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

## Common Issues

### MongoDB Connection Failures
- Docker: Ensure started with `--profile with-mongodb` if using bundled MongoDB
- External: Verify MONGODB_URI or component-based config in .env
- Check logs: `docker-compose -f docker/docker-compose.yml logs mongodb`

### MQTT Not Receiving Messages
- Verify broker is accessible: `telnet <broker-host> 1883`
- Check MQTT_BROKER_URL format: `mqtt://host:port` or `mqtts://host:port`
- Ensure cameras are configured in database (MQTT client subscribes to camera topics on startup)

### Admin UI 404
- Build admin UI: `npm run build:admin`
- Verify dist/admin/ directory exists
- Check that backend serves static files from admin-ui/dist

### Video Playback Not Working
- Ensure ffmpeg is installed in Docker container (included in Dockerfile)
- Check playback configuration in Settings
- Verify recording server is accessible from backend
- See VIDEO_PLAYBACK_FIX.md for troubleshooting

## Security Considerations

**NOT PRODUCTION READY** - See BACKLOG.md for critical security tasks:
- Add comprehensive test coverage
- Fix dependency vulnerabilities
- Implement input validation/sanitization
- Add rate limiting
- Add security headers
- Encrypt camera passwords in database

## API Documentation

See API.md for comprehensive REST API and WebSocket documentation, including:
- Authentication flow
- Path event queries with MongoDB syntax
- WebSocket subscriptions and filtering
- Video playback WebSocket API
- Data models and examples

## Deployment

See DEPLOYMENT.md and QUICK_START.md for:
- Docker deployment with docker-compose
- Environment configuration
- MongoDB setup (bundled or external)
- Production checklist
- Troubleshooting
