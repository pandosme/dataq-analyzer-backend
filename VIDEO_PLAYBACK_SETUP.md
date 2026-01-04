# Video Playback Setup Guide

## Implementation Summary

The DataQ Analyzer backend now supports video playback via WebSocket streaming from VideoX recording server.

### What Was Implemented

1. **WebSocket Video Endpoint** - `ws://localhost:3000/ws/video`
   - JWT authentication via query parameter
   - Real-time video streaming to clients
   - Binary chunk streaming with metadata

2. **VideoX Integration** - [src/services/videoService.js](src/services/videoService.js)
   - Uses VideoX API: `GET /api/recordings/export-clip`
   - Supports epoch timestamp and duration-based retrieval
   - Automatic error mapping (VIDEO_NOT_FOUND, RECORDING_SERVER_ERROR, etc.)

3. **WebSocket Video Handler** - [src/websocket/videoHandlers.js](src/websocket/videoHandlers.js)
   - `request_video` - Request clip by camera serial and timestamp
   - `close_video` - Terminate active stream
   - `ping/pong` - Keep-alive mechanism

4. **Configuration Support** - Already in [src/models/SystemConfig.js](src/models/SystemConfig.js:69-100)
   - `playback.enabled` - Enable/disable video playback
   - `playback.type` - Recording server type (VideoX, Milestone, ACS)
   - `playback.serverUrl` - VideoX server URL
   - `playback.apiKey` - VideoX API token
   - `playback.preTime` - Default seconds before event (default: 5)
   - `playback.postTime` - Default seconds after event (default: 5)

---

## Configuration Required

To enable video playback, you need to configure the system settings in MongoDB.

### Option 1: Via Management UI

1. Log into DataQ-Management UI at `http://localhost:3000`
2. Go to **Settings** page
3. Enable **Video Playback**
4. Configure:
   - **Server Type**: VideoX
   - **Server URL**: `http://localhost:3002` (or your VideoX server URL)
   - **API Key**: Your VideoX API token (create one in VideoX Settings)
   - **Pre-time**: 5 seconds (default)
   - **Post-time**: 5 seconds (default)
5. Click **Save**

### Option 2: Via MongoDB Directly

Connect to MongoDB and update the system configuration:

```javascript
use dataq_analyzer

db.systemconfigs.updateOne(
  { _id: "system-config" },
  {
    $set: {
      "playback.enabled": true,
      "playback.type": "VideoX",
      "playback.serverUrl": "http://localhost:3002",
      "playback.apiKey": "YOUR_VIDEOX_API_TOKEN",
      "playback.preTime": 5,
      "playback.postTime": 5
    }
  },
  { upsert: true }
)
```

### Option 3: Via REST API

```bash
# Get current config
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/config

# Update config
curl -X PUT http://localhost:3000/api/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "playback": {
      "enabled": true,
      "type": "VideoX",
      "serverUrl": "http://localhost:3002",
      "apiKey": "YOUR_VIDEOX_API_TOKEN",
      "preTime": 5,
      "postTime": 10
    }
  }'
```

---

## Getting VideoX API Token

1. Log into VideoX UI at `http://localhost:5174`
2. Go to **Settings** → **API Tokens**
3. Click **Create New Token**
4. Name: "DataQ Integration"
5. Expiration: Never (or set duration)
6. Copy the token (shown only once!)
7. Use this token as `playback.apiKey`

---

## Testing Video Playback

### 1. Test with wscat

```bash
# Install wscat if not already installed
npm install -g wscat

# Get JWT token from DataQ backend
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' \
  | jq -r '.data.token'

# Connect to video WebSocket
wscat -c "ws://localhost:3000/ws/video?token=YOUR_JWT_TOKEN"

# Request video (replace serial and timestamp)
{"type":"request_video","serial":"B8A44F3024BB","timestamp":"2026-01-02T12:00:00.000Z"}

# You should receive:
# 1. {"type":"video_metadata",...}
# 2. Binary chunks (video data)
# 3. {"type":"video_complete"}
```

### 2. Test with Frontend

The frontend should automatically work once backend is configured:
1. Navigate to Forensic Search
2. Click on a path event
3. Video player should load and show the clip

---

## VideoX API Details

The backend uses this VideoX API endpoint:

```
GET /api/recordings/export-clip?cameraId=SERIAL&startTime=EPOCH&duration=SECONDS
```

**Parameters:**
- `cameraId` - Camera serial number (e.g., B8A44F3024BB)
- `startTime` - Event timestamp in epoch seconds
- `duration` - Clip duration in seconds (max 3600)

**Authentication:**
- Header: `Authorization: Bearer <api_token>`

**Response:**
- Content-Type: `video/mp4`
- Body: MP4 video stream

---

## Troubleshooting

### Error: "Video playback is not enabled in system configuration"

**Cause:** `playback.enabled` is false or not set

**Solution:** Enable playback in settings (see Configuration section above)

---

### Error: "VIDEO_NOT_FOUND"

**Cause:** VideoX doesn't have recordings for the requested time

**Solution:**
1. Check if camera is recording in VideoX
2. Verify timestamp is correct
3. Check VideoX has retention period covering the timestamp
4. Use VideoX UI to verify recordings exist

---

### Error: "RECORDING_SERVER_ERROR"

**Cause:** VideoX server is unreachable or returned 500 error

**Solution:**
1. Verify VideoX server is running: `curl http://localhost:3002/api/system/health`
2. Check `playback.serverUrl` is correct
3. Check network connectivity between DataQ and VideoX servers
4. Check VideoX logs for errors

---

### Error: "CAMERA_NOT_FOUND"

**Cause:** Camera serial number doesn't exist in VideoX

**Solution:**
1. Verify camera serial matches between DataQ and VideoX
2. Check camera is added in VideoX UI
3. Use correct case (serial numbers are case-sensitive)

---

### Error: "Failed to connect to VideoX"

**Cause:** Invalid API token or authentication failure

**Solution:**
1. Verify API token is correct
2. Check token hasn't expired
3. Recreate API token in VideoX if needed
4. Ensure token has proper permissions

---

## Architecture

```
Frontend (Forensic Search)
    |
    | WebSocket /ws/video
    | {"type":"request_video","serial":"...","timestamp":"..."}
    |
    v
DataQ Analyzer Backend (Port 3000)
    |
    | Reads playback config from MongoDB
    | Calculates pre/post time
    | Converts timestamp to epoch
    |
    v
VideoX Server (Port 3002)
    |
    | GET /api/recordings/export-clip
    | ?cameraId=...&startTime=...&duration=...
    |
    v
VideoX Storage
    |
    | Retrieves/stitches MP4 segments
    | Returns video stream
    |
    v
DataQ Analyzer Backend
    |
    | Proxies video chunks via WebSocket
    |
    v
Frontend Video Player
```

---

## Security Notes

1. **API Token Storage** - VideoX API token is stored in MongoDB, never exposed to frontend
2. **JWT Authentication** - All WebSocket connections require valid JWT token
3. **Proxy Pattern** - Frontend never communicates directly with VideoX
4. **Token Permissions** - VideoX API token should have read-only recording access
5. **HTTPS** - Use HTTPS/WSS in production

---

## Performance Considerations

1. **Concurrent Streams** - Backend supports multiple simultaneous video streams
2. **Timeout** - 60-second timeout for video requests
3. **Chunk Size** - Videos streamed in chunks to avoid memory issues
4. **Pre/Post Time** - Keep reasonable (5-10 seconds) to minimize bandwidth
5. **Network** - Ensure sufficient bandwidth between DataQ ↔ VideoX servers

---

## Next Steps

1. ✅ Backend WebSocket video API implemented
2. ✅ VideoX integration completed
3. ⏭️ **Configure playback settings** (see Configuration section)
4. ⏭️ **Create VideoX API token** (see Getting VideoX API Token section)
5. ⏭️ **Test with wscat** to verify integration
6. ⏭️ Frontend should automatically work once backend is configured
