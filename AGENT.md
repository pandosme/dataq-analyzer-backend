# DataQ Analyzer Backend — Agent Context

This document gives an LLM agent enough context to work confidently on this codebase without having to rediscover architecture details.

---

## Project Overview

**DataQ Analyzer Backend** is a Node.js/Express server that:
1. Receives real-time object-tracking events from Axis cameras via MQTT (DataQ analytics).
2. Persists those events to MongoDB and re-broadcasts them to browser clients over WebSocket.
3. Provides a REST API and a built-in React admin UI for camera management, configuration, user management, and analytics (counters / heatmaps).
4. Optionally proxies video clip requests to an external recording server (VideoX, Milestone, or ACS).

---

## Runtime & Deployment

| Detail | Value |
|--------|-------|
| Language | Node.js ESM (`"type": "module"`) |
| Runtime | Node.js ≥ 18 |
| Entry point | `src/server.js` |
| Default port | **80** (env `PORT`). In Docker Compose the host maps **3303 → 80**. In local dev, set `PORT=3303`. |
| Start command | `node src/server.js` (nodemon has stdin issues when backgrounded; avoid `npm run dev` when running as a background process) |
| Database | MongoDB 7 (Mongoose **8.0.3** — breaking: use `includeResultMetadata` not `rawResult` in `findOneAndUpdate`) |
| Package manager | npm |

### Docker

```
docker compose up -d        # Uses docker-compose.yml (builds image from Dockerfile)
docker compose -f docker-compose.build.yml up -d  # Local build variant
```

The compose file bundles a MongoDB container with a named volume (`mongodb_data`). To use an external MongoDB, remove the `mongodb` service and set `MONGODB_HOST` / `MONGODB_USERNAME` / etc.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `80` | HTTP listen port |
| `NODE_ENV` | `production` | Set to `development` to enable morgan request logging |
| `MONGODB_URI` | — | Full URI (overrides individual vars) |
| `MONGODB_HOST` | `localhost` | |
| `MONGODB_PORT` | `27017` | |
| `MONGODB_DATABASE` | `dataq-analyzer` | |
| `MONGODB_USERNAME` | — | |
| `MONGODB_PASSWORD` | — | |
| `MONGODB_AUTH_REQUIRED` | `false` | |
| `MQTT_BROKER_URL` | — | e.g. `mqtt://mqtt.internal:1883` |
| `MQTT_USERNAME` | — | |
| `MQTT_PASSWORD` | — | |
| `MQTT_USE_TLS` | `false` | |
| `MQTT_TOPIC_PREFIX` | `dataq/#` | |
| `ADMIN_USERNAME` | `admin` | Bootstrap admin (env-based, works without MongoDB) |
| `ADMIN_PASSWORD` | `admin` | |
| `VIEWER_USERNAME` | — | Optional viewer account |
| `VIEWER_PASSWORD` | — | |
| `JWT_SECRET` | auto-generated | Auto-generated if absent (tokens invalidate on restart) |
| `JWT_EXPIRES_IN` | `7d` | |
| `CORS_ORIGIN` | `*` | Comma-separated origins, or `*` |

All runtime config (MQTT broker, MongoDB connection, playback server, data retention) can also be changed at runtime through the admin UI; settings are persisted in MongoDB and take precedence over env vars.

---

## Directory Structure

```
src/
  server.js           # Entry: DB connect → express app → HTTP + WebSocket server → MQTT connect
  app.js              # Express factory: CORS, JSON, /public, /api, React SPA fallback
  config/index.js     # Exports dbConfig, serverConfig, mqttConfig, authConfig, appConfig

  models/             # Mongoose schemas
    Camera.js         # Camera/device registry
    PathEvent.js      # Raw MQTT path events (strict: false — stores any fields)
    CounterSet.js     # Zone-based directional counter groups
    SystemConfig.js   # Singleton config doc (_id: 'system-config')
    MqttConfig.js     # Singleton MQTT credentials (_id: 'mqtt-config')
    MongoConfig.js    # Stored MongoDB connection info
    User.js           # JWT users (admin/viewer roles)
    index.js          # Re-exports all models

  routes/
    index.js          # Mounts sub-routers; exposes /api/health
    auth.js           # POST /api/auth/login, /refresh, /logout
    cameras.js        # CRUD /api/cameras
    paths.js          # GET /api/paths (query PathEvents)
    counters.js       # CRUD /api/counters (counter sets + backfill)
    config.js         # GET/PUT system, MQTT, MongoDB, playback config
    users.js          # CRUD /api/users (requires JWT)
    health.js         # (see index.js inline)

  services/
    authService.js        # JWT sign/verify, bcrypt password
    cameraService.js      # Camera CRUD + MQTT announcement upsert
    configService.js      # System/MQTT/MongoDB config CRUD, connection tests
    pathEventService.js   # Save PathEvent to MongoDB
    counterSetsService.js # Zone classification, counter CRUD, backfill, MQTT publish timers
    countersService.js    # Aggregation queries for admin dashboard
    retentionService.js   # Daily cleanup of old PathEvents, scheduled at midnight
    videoService.js       # Proxy video clips from VideoX / Milestone / ACS
    vapixService.js       # VAPIX calls to Axis cameras (snapshot, etc.)
    cameraService.js
  
  middleware/
    auth.js           # authenticate (JWT), requireEditor (blocks viewers)

  mqtt/
    client.js         # MQTT connect/reconnect, topic subscriptions, message dispatch

  dataq/
    parser.js         # Parse raw MQTT payload JSON; validate path messages

  websocket/
    server.js         # HTTP upgrade handler; routes /ws/paths and /ws/video
    handlers.js       # /ws/paths message handler (subscribe, filter, etc.)
    videoHandlers.js  # /ws/video: request_video → getVideoClip → stream chunks
    broadcaster.js    # broadcastPathEvent to all matching /ws/paths clients
    filters.js        # Client-side filter matching (class, age, distance, dwell)
    manager.js        # Connection registry (Map of connectionId → {ws, user, filters})
    auth.js           # WebSocket authentication (token from query param ?token=)
    index.js          # setupWebSocketServer export

  utils/
    logger.js         # Winston logger

admin-ui/             # React + Vite admin frontend (served from /; built to admin-ui/dist)
scripts/              # One-off utility scripts (check-api-key, configure-playback, etc.)
doc/                  # Additional documentation
```

---

## Data Flow

### 1. MQTT → MongoDB → WebSocket

```
Axis Camera (DataQ app)
  │  MQTT publish
  ▼
dataq/path/{SERIAL}            ← path events (object-path JSON)
dataq/connect/{SERIAL}         ← online/offline announcements (includes labels, model, etc.)
dataq/status/{SERIAL}          ← heartbeat / status
dataq/image/{SERIAL}           ← base64 JPEG snapshots
  │
  ▼
mqtt/client.js → handleMQTTMessage()
  ├─ path topic   → parseDataQMessage → shouldSavePath (camera filters) → savePathEvent (MongoDB)
  │                                                                     → broadcastPathEvent (WebSocket /ws/paths)
  │                                                                     → counterSetsService.processPathEvent
  ├─ connect topic → upsertCameraFromAnnouncement (Camera model upsert)
  ├─ status topic  → updateCameraStatus
  └─ image topic   → updateCameraSnapshotFromMQTT → broadcastSnapshot
```

### 2. /ws/paths WebSocket (Client → Browser)

Clients authenticate with `?token=<JWT>` query parameter.

**Client → Server:**
```json
{ "type": "subscribe",   "filters": { "serials": ["B8A44…"], "classes": ["Human"] } }
{ "type": "unsubscribe" }
{ "type": "ping" }
```

**Server → Client:**
```json
{ "type": "connected", "userId": "…", "timestamp": "…" }
{ "type": "path",      "data": { /* PathEvent document */ } }
{ "type": "snapshot",  "serial": "…", "image": "<base64 JPEG>", "timestamp": "…" }
{ "type": "pong" }
```

### 3. /ws/video WebSocket (Video Clip Playback)

**Client → Server:**
```json
{
  "type": "request_video",
  "serial": "B8A44FF11A35",
  "timestamp": "2026-01-15T14:30:00.000Z",
  "preTime": 5,
  "postTime": 5,
  "age": 12,
  "apiKey": "optional-override-key"
}
```

**Server → Client:**
```json
{ "type": "video_metadata", "duration": 22, "width": 1920, "height": 1080, "fps": 25, "codec": "h264", "mimeType": "video/mp4; codecs=\"avc1.640029\"" }
<binary Buffer chunks — fragmented MP4 via ffmpeg>
{ "type": "video_complete" }
{ "type": "video_error", "message": "…", "code": "…" }
```

**Video timing logic:**
- `timestamp` = when MQTT message arrived (object exit time)
- `startTime = timestamp − age − preTime`
- `endTime   = timestamp + postTime`
- `duration  = age + preTime + postTime`

**VideoX clip path:** `GET {serverUrl}/api/recordings/export-clip?cameraId={serial}&startTime={epoch_s}&duration={s}&token={apiKey}`
- Response must be `video/mp4` (a content-type guard bails out early on HTML/JSON responses)
- MP4 is buffered, written to `/tmp`, then fragmented by ffmpeg (`-movflags frag_keyframe+empty_moov+default_base_moof`) before being chunked over WebSocket

---

## Key Models

### Camera
```
serialNumber  String  unique, uppercase   ← primary key linking MQTT messages to DB docs
name          String
model         String                      ← from dataq/connect announcements
ipAddress     String                      ← for VAPIX (local cameras only)
cameraType    'local' | 'remote'
labels        [String]                    ← string array from DataQ MQTT announcement
filters       { objectTypes, minDistance, minAge }   ← per-camera event filter
rotation      0|90|180|270
retentionDays Number (nullable)           ← overrides system default when set
deviceStatus  { connected, lastSeen, ... }
enabled       Boolean
```

### PathEvent
Stored verbatim from the MQTT JSON payload (`strict: false`). Key fields present in DataQ messages:
```
serial     String   — camera serial number
timestamp  Number   — epoch seconds
class      String   — e.g. 'Human', 'Car', 'Truck'
id         Number   — tracking id (reused across events)
age        Number   — seconds object was tracked
dx, dy     Number   — displacement in DataQ coordinates (0–1000 range)
path       Array    — [{x, y, timestamp}, …]
bx, by     Number   — begin position (first point)
```
Indexes: `(serial, timestamp)`, `(serial, class, timestamp)`, `(timestamp)`, `(class)`, `(id)`, `(serial, createdAt)`.

### CounterSet
Zone-based directional counter. Each set defines:
- `serial` — which camera to count
- `zones` — named rectangular regions (coordinates in 0–1000 space)
- `objectClasses` — which classes to count
- `counters` — auto-generated A→B, B→A, etc.
- `mqttTopic` / `mqttInterval` — periodically publishes totals to MQTT
- `backfill` — tracks async historical reprocessing status

### SystemConfig (singleton `_id: 'system-config'`)
```
dataRetentionDays   Number   (default 90)
playback.enabled    Boolean
playback.type       'VideoX' | 'ACS' | 'Milestone'
playback.serverUrl  String
playback.apiKey     String
playback.preTime    Number (seconds before event)
playback.postTime   Number (seconds after event)
dateFormat          'US' | 'EU' | 'ISO'
```

**Important:** The UI uses `"None"` as a pseudo-type when playback is disabled. The routes (`PUT /api/config/system` and `PUT /api/config`) normalize `type === 'None'` → `{ enabled: false, type: 'VideoX' }` before reaching the Mongoose validator (which only accepts `VideoX/ACS/Milestone`).

---

## Authentication

Two parallel auth mechanisms coexist:

### 1. Environment-based admin (no MongoDB needed)
On login, `authService.js` checks `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars first. Issues a JWT with `id: 'env-admin'` and `role: 'admin'`. The `authenticate` middleware handles this synthetic user without a DB lookup.

### 2. MongoDB users
Standard bcrypt password storage. Roles: `admin` (full access) and `viewer` (read-only — blocked from write routes by `requireEditor` middleware).

### Admin UI Authentication
The admin UI does **not** use JWT by default. API routes in `routes/index.js` mount `/cameras`, `/paths`, `/config`, `/counters` **without** the `authenticate` middleware, making them publicly accessible on the LAN. Only `/api/users` requires JWT (`authenticate`). This is intentional — the admin UI runs on a secured internal network.

For client apps (external integrations), full JWT auth is required (see API.md).

---

## REST API Summary

All responses: `{ success: true|false, data: …, error: "…" }`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | none | Returns JWT |
| GET | `/api/config/status` | none | MongoDB + MQTT connection status |
| POST | `/api/config/mongodb/test-config` | none | Test MongoDB connection |
| POST | `/api/config/mongodb/connect` | none | Connect to MongoDB |
| GET | `/api/health` | none | Server health + playback config summary |
| GET | `/api/cameras` | none | List cameras |
| POST | `/api/cameras` | none | Create camera |
| GET | `/api/cameras/:id` | none | Get camera |
| PUT | `/api/cameras/:id` | none | Update camera |
| DELETE | `/api/cameras/:id` | none | Delete camera |
| GET | `/api/paths` | none | Query path events (supports MongoDB-style filtering) |
| GET | `/api/counters` | none | List counter sets |
| POST | `/api/counters` | editor | Create counter set (triggers async backfill) |
| GET | `/api/counters/:id` | none | Get counter set |
| PUT | `/api/counters/:id` | editor | Update counter set |
| DELETE | `/api/counters/:id` | editor | Delete counter set |
| POST | `/api/counters/:id/reset` | editor | Reset counters to zero |
| GET | `/api/config` | none | Get all config (system, MQTT, MongoDB) |
| PUT | `/api/config` | none | Update all config |
| GET | `/api/config/system` | none | Get system config |
| PUT | `/api/config/system` | none | Update system config |
| GET/PUT | `/api/config/mqtt` | none | MQTT config |
| POST | `/api/config/mqtt/connect` | none | Apply + reconnect MQTT |
| POST | `/api/config/playback/test-connection` | none | Test VMS connectivity (8s hard timeout via AbortController) |
| GET | `/api/users` | JWT | List users |
| POST | `/api/users` | JWT admin | Create user |
| PUT | `/api/users/:id` | JWT admin | Update user |
| DELETE | `/api/users/:id` | JWT admin | Delete user |

---

## MQTT Topic Conventions (DataQ Protocol)

| Topic | Direction | Content |
|-------|-----------|---------|
| `dataq/connect/{SERIAL}` | Device → Backend | Announcement: `{ name, model, labels: [String], firmware, … }` |
| `dataq/status/{SERIAL}` | Device → Backend | Heartbeat / status object |
| `dataq/path/{SERIAL}` | Device → Backend | Path event JSON (stored verbatim) |
| `dataq/image/{SERIAL}` | Device → Backend | Base64 JPEG snapshot |

`labels` is a **plain string array** (e.g. `["Human", "Car", "Truck"]`). Earlier firmware versions sent objects `{id, name, enabled}` — the schema was changed to `[String]`.

Custom MQTT topics per camera are supported (`camera.mqttTopic` overrides `dataq/path/{serial}`).

Counter sets can **publish** their totals to configurable MQTT topics at a configurable interval (via `mqttTopic` / `mqttInterval` fields).

---

## External Services

### VideoX Recording Server
- Default local URL: `http://localhost:3002`
- Auth: `Authorization: Bearer {apiKey}` + `?token={apiKey}` query param
- Used endpoint: `GET /api/recordings/export-clip?cameraId=&startTime=&duration=`
- Returns `video/mp4`; content-type is validated before ffmpeg processing
- Connection test: `GET /api/status` with an 8-second AbortController hard timeout (axios `timeout` only covers response timeout, not TCP connect stall)

### Milestone / ACS
- Placeholder implementations in `videoService.js`; not fully implemented

### Axis VAPIX (local cameras)
- Used for snapshot capture (`vapixService.js`)
- Requires `ipAddress`, `username`, `password` on the Camera document
- Uses digest authentication (`digest-fetch`)

---

## Admin UI

Located in `admin-ui/` (Vite + React). In production it is built to `admin-ui/dist/` (or `dist/admin/` in Docker) and served as static files from Express.

In local development:
```bash
cd admin-ui && npm run dev   # Vite dev server on port 5174
```
The Vite proxy forwards `/api` and WebSocket requests to `http://localhost:3303`.

**Key components:**
| Component | Purpose |
|-----------|---------|
| `Dashboard.jsx` | Live path event table, camera selector, WebSocket /ws/paths |
| `CameraManagement.jsx` | Camera CRUD, snapshot preview, filter config |
| `Settings.jsx` | System config, MQTT, MongoDB, playback (VideoX/ACS/Milestone) |
| `UserManagement.jsx` | User CRUD |
| `Setup.jsx` | First-run wizard (MongoDB connection, admin password) |
| `Login.jsx` | JWT login form (used by client apps; admin UI bypasses this) |

**Scrolling layout:** All pages use a strict CSS flex chain to allow inner tables to scroll while keeping headers fixed:
- `.app` → `height: 100vh; overflow: hidden`
- `.main-content` → `flex: 1; overflow: hidden; min-height: 0`
- `.admin-section` → `flex: 1; min-height: 0`
- Each page's `-inline` wrapper → `flex: 1; display: flex; flex-direction: column; min-height: 0`
- Scrollable region → `flex: 1; overflow-y: auto; min-height: 0`

---

## Startup Sequence

1. `setupDBEventHandlers()` — register Mongoose event listeners
2. `connectDB()` — connect to MongoDB (non-fatal if unavailable; app starts in setup mode)
3. `migrateExistingCameras()` — add default `filters` to old Camera documents
4. `createApp()` — build Express app
5. `http.createServer(app)` + `setupWebSocketServer(server)`
6. `server.listen(port)`
7. `connectMQTT()` — load config from MongoDB, connect, subscribe to camera topics
8. `initCounterSets()` — restart MQTT publish timers for all counter sets
9. `retentionService.scheduleDailyCleanup()` — midnight cron for old PathEvent deletion
10. SIGTERM/SIGINT → graceful shutdown

---

## Known Issues / Gotchas

- **nodemon + backgrounding**: `nodemon` hangs when stdin is closed (background process). Use `node src/server.js` directly.
- **Mongoose 8 breaking change**: `findOneAndUpdate` option must be `includeResultMetadata: true` (not `rawResult: true`). The return value is `{ value: doc, lastErrorObject: { upserted: … } }`.
- **VideoX content-type guard**: If VideoX returns HTML or JSON (auth error, wrong URL), the service throws early rather than passing garbage to ffmpeg. Check server URL and API key first.
- **ffmpeg dependency**: The video service requires `ffmpeg` on the system PATH to fragment MP4 for MediaSource API. Not bundled.
- **Playback "None" normalization**: The UI's `"None"` pseudo-type (meaning "disabled") must be normalized to `{ enabled: false, type: 'VideoX' }` in the route layer before hitting Mongoose (enum only allows `VideoX/ACS/Milestone`).
- **AbortController for connection tests**: `axios timeout` only applies after TCP connect is established. `AbortController` with `setTimeout` provides a hard deadline for connection tests to unreachable hosts.
- **Coordinate system**: DataQ uses a 0–1000 normalized coordinate space (`appConfig.coordinateMax = 1000`), not pixels.
