# Backend API Requirements

This document specifies the backend API requirements for the DataQ Analyzer frontend.

## WebSocket APIs

The backend must implement two WebSocket endpoints for real-time communication.

### 1. WebSocket Path Events API (`/ws/paths`)

Real-time path event streaming for live detections.

#### Connection

```
WS/WSS: /ws/paths?token=<JWT_TOKEN>
```

**Authentication:**
- JWT token must be provided as query parameter
- Server validates token before accepting connection
- Reject with code 4001 if token is invalid

#### Client → Server Messages

**Subscribe to cameras:**
```json
{
  "type": "subscribe",
  "cameras": ["SERIAL1", "SERIAL2"],  // Empty array = all authorized cameras
  "filters": {
    "classes": ["Human", "Car"],       // Optional: filter by object classes
    "minAge": 2,                       // Optional: minimum age in seconds
    "minDistance": 20                  // Optional: minimum distance traveled
  }
}
```

**Unsubscribe from cameras:**
```json
{
  "type": "unsubscribe",
  "cameras": ["SERIAL1", "SERIAL2"]
}
```

**Ping (keep-alive):**
```json
{
  "type": "ping"
}
```

#### Server → Client Messages

**Path event:**
```json
{
  "type": "path",
  "data": {
    "serial": "B8A44F3024BB",
    "timestamp": "2026-01-01T12:34:56.789Z",
    "class": "Human",
    "age": 5.2,
    "dwell": 3.1,
    "distance": 45,
    "color1": "Blue",
    "color2": "White",
    "anomaly": false,
    "path": [
      { "x": 123, "y": 456, "d": 0.5 },
      { "x": 125, "y": 458, "d": 1.2 }
    ]
  }
}
```

**Pong (response to ping):**
```json
{
  "type": "pong"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

### 2. WebSocket Video Streaming API (`/ws/video`)

Stream recorded video from the recording server (VideoX, Milestone, etc.) to the client.

#### Connection

```
WS/WSS: /ws/video?token=<JWT_TOKEN>
```

**Authentication:**
- JWT token must be provided as query parameter
- Server validates token before accepting connection
- Reject with code 4001 if token is invalid

#### Client → Server Messages

**Request video stream:**
```json
{
  "type": "request_video",
  "serial": "B8A44F3024BB",
  "timestamp": "2026-01-01T12:34:56.789Z",
  "preTime": 5,                         // Seconds before timestamp
  "postTime": 10,                       // Seconds after timestamp
  "format": "mp4"                       // Optional: video format (default: mp4)
}
```

**Close video stream:**
```json
{
  "type": "close_video"
}
```

**Ping (keep-alive):**
```json
{
  "type": "ping"
}
```

#### Server → Client Messages

**Video metadata (sent first):**
```json
{
  "type": "video_metadata",
  "duration": 15.5,                     // Total duration in seconds
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "codec": "h264",
  "mimeType": "video/mp4; codecs=\"avc1.42E01E\""
}
```

**Video chunk (binary data):**
```
Binary message containing video chunk data
```

The server should:
1. Fetch video from the recording server (VideoX/Milestone)
2. Stream video chunks as binary WebSocket messages
3. Send chunks sequentially until complete
4. Support chunked transfer to avoid memory issues

**Video complete:**
```json
{
  "type": "video_complete"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description",
  "code": "VIDEO_NOT_FOUND"            // Error codes: VIDEO_NOT_FOUND, RECORDING_SERVER_ERROR, etc.
}
```

**Pong (response to ping):**
```json
{
  "type": "pong"
}
```

#### Backend Implementation Notes

The backend server must:

1. **Authenticate requests** using JWT tokens
2. **Query the recording server** (VideoX, Milestone, etc.) based on:
   - Camera serial number
   - Timestamp
   - Pre/post time buffers
3. **Proxy video stream** from recording server to client
4. **Support chunked streaming** to handle large videos
5. **Handle errors gracefully**:
   - Recording server unavailable
   - Video not found for requested time period
   - Invalid camera serial number
6. **Clean up resources** when connection closes
7. **Support concurrent video streams** (multiple clients)

**Example flow:**
1. Client sends `request_video` message
2. Server queries recording server API (e.g., VideoX `/export-clip`)
3. Server sends `video_metadata` to client
4. Server streams video chunks as binary messages
5. Server sends `video_complete` when done
6. Client can request another video or close connection

---

## REST APIs

### Camera Snapshot API

**GET `/api/cameras/:serial/snapshot`**

Returns the latest snapshot for a camera.

**Response:**
```json
{
  "success": true,
  "data": {
    "image": "/9j/4AAQSkZJRgABAQAA...",   // Base64-encoded JPEG (without data URL prefix)
    "timestamp": "2026-01-01T12:34:56.789Z",
    "rotation": 0,
    "aspectRatio": "16:9"
  }
}
```

**Note:** The `image` field contains only the base64 string, NOT the full data URL. The frontend will prepend `data:image/jpeg;base64,` when using it.

---

### Camera Update API

**PUT `/api/cameras/:id`**

Update camera configuration (e.g., save filters).

**Request:**
```json
{
  "filters": {
    "objectTypes": ["Human", "Car"],
    "minDistance": 20,
    "minAge": 2
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "serialNumber": "B8A44F3024BB",
    "filters": {
      "objectTypes": ["Human", "Car"],
      "minDistance": 20,
      "minAge": 2
    }
  }
}
```

---

### Path Query API

**POST `/api/paths/query`**

Query historical path events using MongoDB-style query syntax.

**Request:**
```json
{
  "serial": "B8A44F3024BB",
  "class": "Human",
  "minAge": 2,
  "minDistance": 20,
  "startTime": "2026-01-01T00:00:00.000Z",
  "endTime": "2026-01-01T23:59:59.999Z",
  "limit": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "serial": "B8A44F3024BB",
      "timestamp": "2026-01-01T12:34:56.789Z",
      "class": "Human",
      "age": 5.2,
      "dwell": 3.1,
      "distance": 45,
      "color1": "Blue",
      "color2": "White",
      "anomaly": false,
      "path": [
        { "x": 123, "y": 456, "d": 0.5 },
        { "x": 125, "y": 458, "d": 1.2 }
      ]
    }
  ],
  "count": 150
}
```

---

## Configuration

The backend should read recording server configuration from the database/config:

```json
{
  "playback": {
    "enabled": true,
    "type": "VideoX",                    // or "Milestone"
    "serverUrl": "https://videox.example.com",
    "apiKey": "secret-api-key",
    "preTime": 5,                        // Default pre-time in seconds
    "postTime": 10                       // Default post-time in seconds
  }
}
```

The frontend should NOT have access to these credentials - only the backend uses them to proxy video streams.
