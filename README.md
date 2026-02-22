# DataQ Analyzer Backend

Express.js backend with embedded admin UI for collecting and analyzing path/flow data from Axis DataQ cameras.

## Features

- **Admin UI** — React dashboard served at port 3303 (no separate frontend needed)
- **REST API** — Full CRUD for cameras, path events, users, and configuration
- **WebSocket** — Real-time streaming of path events to connected clients
- **MQTT** — Collects DataQ messages from Axis cameras via MQTT broker
- **MongoDB** — Stores path events, cameras, users, and system configuration
- **JWT Authentication** — Role-based access (admin / user)
- **Video Playback** — On-demand clip retrieval from VideoX, Milestone, or ACS

---

## Deployment

### Prerequisites

- Docker and Docker Compose

### 1. Get the compose file

Download [docker-compose.yml](docker-compose.yml) or create it with the following content:

```yaml
services:
  backend:
    image: pandosme/dataq-backend:latest
    container_name: dataq-backend
    ports:
      - "3303:80"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/dataq-analyzer
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=admin
    depends_on:
      - mongodb
    restart: unless-stopped

  mongodb:
    image: mongo:7
    container_name: dataq-mongodb
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

volumes:
  mongodb_data:
    driver: local
```

### 2. Set your credentials

Edit `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `docker-compose.yml` before first start.

### 3. Start

```bash
docker compose up -d
```

Access the admin UI at **http://\<host\>:3303**

### 4. Configure MQTT

Log in to the admin UI → **Settings → MQTT** and point it at your MQTT broker. The backend will subscribe to DataQ topics and begin collecting path events.

---

## Configuration

All configuration is done through the admin UI. No `.env` file is required.

| Setting | Where |
|---|---|
| Admin username & password | `docker-compose.yml` environment variables |
| MQTT broker | Settings → MQTT |
| MongoDB connection | Settings → MongoDB (or `MONGODB_URI` env var) |
| Data retention | Settings → System (global default) or per-camera in Camera Management |
| Video playback | Settings → Playback |
| Date/time format | Settings → System |

### Optional environment variables

These can be added to `docker-compose.yml` to override defaults:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `80` | Internal container port |
| `MONGODB_URI` | — | Full MongoDB connection string |
| `MQTT_BROKER_URL` | — | MQTT broker URL (e.g. `mqtt://broker:1883`) |
| `JWT_SECRET` | auto-generated | JWT signing secret (auto-generated if omitted — tokens reset on container restart) |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |

---

## Architecture

```
Port 3303
└── Express.js
    ├── /api/*           REST API
    ├── /ws/paths        WebSocket — real-time path events
    ├── /ws/video        WebSocket — video playback proxy
    └── /                Admin UI (React SPA)

Data flow:
  Axis Camera → MQTT broker → backend → MongoDB
                                      → WebSocket clients
```

### Source layout

```
src/
├── routes/          API routes
├── services/        Business logic
├── models/          Mongoose models
├── middleware/       Auth middleware
├── mqtt/            MQTT client
├── dataq/           DataQ message parser
├── websocket/       WebSocket server and handlers
├── config/          Configuration loading
└── server.js        Entry point

admin-ui/
├── src/components/  React components
├── src/services/    API client
└── src/context/     Auth and date format contexts
```

---

## API

See [API.md](API.md) for full REST and WebSocket API documentation.

**Quick reference:**

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/cameras
POST   /api/cameras
PUT    /api/cameras/:id
DELETE /api/cameras/:id

POST   /api/paths/query        MongoDB query syntax
POST   /api/paths/count
POST   /api/paths/aggregate
GET    /api/paths/:id

GET    /api/counters
POST   /api/counters
GET    /api/counters/:id
PUT    /api/counters/:id
DELETE /api/counters/:id
GET    /api/counters/:id/backfill
POST   /api/counters/:id/backfill    trigger recount from history
POST   /api/counters/:id/reset       reset all counters to zero
POST   /api/counters/:id/counters/:counterId/reset
GET    /api/counters/cameras          path event counts per camera (telemetry)
GET    /api/counters/cameras/:serial/series
POST   /api/counters/cleanup          trigger retention cleanup

GET    /api/config/system
PUT    /api/config/system
GET    /api/config/mqtt
PUT    /api/config/mqtt

GET    /api/health
```

---

## Development

### Build and run locally

```bash
npm install
cd admin-ui && npm install && cd ..

# Start backend (dev mode with auto-reload)
npm run dev

# Start admin UI dev server (separate terminal)
npm run dev:admin
```

Admin UI dev server: http://localhost:5174
Backend API: http://localhost:3303/api

### Build the Docker image

```bash
docker compose -f docker-compose.build.yml build
docker compose -f docker-compose.build.yml push
```

### Publish to Docker Hub (CI)

The GitHub Actions workflow at `.github/workflows/docker-publish.yml` builds and pushes `pandosme/dataq-backend:latest` automatically on a version tag push or manual trigger.

Add `DOCKERHUB_TOKEN` as a repository secret in GitHub (a Docker Hub access token for the `pandosme` account). Then:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## License

MIT
