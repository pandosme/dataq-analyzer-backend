# Quick Start Guide

Get DataQ Analyzer up and running in 3 simple steps!

## Step 1: Configure

Run the interactive setup script:

```bash
./setup.sh
```

This will guide you through all configuration options and create your `.env` file.

## Step 2: Start

Start all services with a single command:

```bash
./start.sh start
```

Or use the longer form if you prefer:

```bash
# With bundled MongoDB
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d

# With external MongoDB
docker-compose -f docker/docker-compose.yml up -d
```

## Step 3: Setup Admin User

1. Open your browser to: http://localhost:3000/admin
2. Create your first admin user on the setup screen
3. Log in and start configuring cameras!

---

## Common Commands

### Using start.sh (Recommended)

```bash
./start.sh start      # Start all services
./start.sh stop       # Stop all services
./start.sh restart    # Restart all services
./start.sh logs       # View logs
./start.sh status     # Check status
./start.sh clean      # Complete cleanup
```

### Using npm scripts

```bash
npm run docker:up:with-mongo    # Start with bundled MongoDB
npm run docker:up               # Start with external MongoDB
npm run docker:down             # Stop services
npm run docker:logs             # View logs
```

### Using docker-compose directly

```bash
# Start
docker-compose -f docker/docker-compose.yml --profile with-mongodb up -d

# Stop
docker-compose -f docker/docker-compose.yml down

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Restart a specific service
docker-compose -f docker/docker-compose.yml restart backend
```

---

## Access Points

Once running:

- **Admin UI:** http://localhost:3000/admin
- **API:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/api/health
- **MongoDB:** localhost:27017 (if using bundled)

---

## Troubleshooting

### "Permission denied: ./setup.sh"

Make the script executable:

```bash
chmod +x setup.sh start.sh
```

### ".env file not found"

Run the setup script first:

```bash
./setup.sh
```

### "Port 3000 already in use"

Change the port in your `.env` file:

```bash
PORT=3001
```

Then restart:

```bash
./start.sh restart
```

### "Cannot connect to MongoDB"

**If using bundled MongoDB:**
- Make sure you started with `--profile with-mongodb`
- Check MongoDB logs: `docker-compose -f docker/docker-compose.yml logs mongodb`

**If using external MongoDB:**
- Verify your `MONGODB_URI` in `.env`
- Test connection: `mongosh "YOUR_MONGODB_URI"`

### "MQTT not connecting"

1. Verify your MQTT broker is running
2. Test connection: `mosquitto_sub -h your-broker -p 1883 -t test`
3. Check MQTT settings in Admin UI → Settings → MQTT

---

## Next Steps

1. ✅ Configure MQTT broker connection in Settings
2. ✅ Add your first camera in Camera Management
3. ✅ Create additional users (optional)
4. ✅ Monitor path events as they arrive

---

## Need More Help?

- **Full Documentation:** [README.md](README.md)
- **Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Security Checklist:** [BACKLOG.md](BACKLOG.md)

---

**Enjoy using DataQ Analyzer!** 🚀
