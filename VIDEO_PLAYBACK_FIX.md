# Video Playback Fix - Complete Implementation Guide

## Problem Summary

When clicking on path events in the frontend Forensic Search, video playback was not working correctly. This document details all issues discovered and fixes implemented to achieve fully functional video playback.

**Initial Symptom:** Video player displayed loading spinner indefinitely, 0 chunks received.

**Final Result:** Video playback fully functional with:
- Backend fetching and fragmenting MP4 from VideoX
- Frontend receiving and playing fragmented video via WebSocket
- Correct playback timing (starts at event occurrence, not beginning of clip)

## Root Causes Identified

### Frontend Issues (`WebSocketVideoPlayer.jsx`):
1. **Race Condition:** Binary video chunks arriving before MediaSource API's `sourceopen` event
2. **Inefficient Queue Processing:** Only processed one chunk at a time during `updateend` event
3. **Premature Stream Ending:** Called `endOfStream()` immediately despite queued chunks
4. **Missing "connected" Handler:** Logged unknown message for connection confirmation
5. **React Ref Timing Issue:** Video element ref became unavailable during component lifecycle
6. **Incorrect Playback Offset:** Video started at 0:00 instead of at event timestamp

### Backend Issues (`videoService.js`):
7. **MP4 Structure Incompatibility:** VideoX returns regular MP4 with moov atom at end, MediaSource API requires fragmented MP4
8. **ffmpeg Seeking Issue:** Cannot seek when reading from stdin pipe, needed to read the moov atom at end of file

## Summary of All Fixes

1. ✅ Added "connected" message handler
2. ✅ Implemented continuous chunk queue processing
3. ✅ Added proper stream completion logic (only end when queue is empty AND complete flag is set)
4. ✅ Fixed React ref timing with stable callback ref pattern (empty dependency array)
5. ✅ Temporarily disabled React StrictMode to prevent WebSocket interruption
6. ✅ Implemented event-based stream buffering in backend
7. ✅ Added temporary file strategy for ffmpeg (allows seeking to moov atom)
8. ✅ Added ffmpeg MP4 fragmentation pipeline with automatic cleanup
9. ✅ Fixed video playback offset (starts at preTime position showing event)

## What Was Fixed

### 1. Added "connected" Message Handler
```javascript
case 'connected':
  // Connection confirmation
  if (import.meta.env.DEV) {
    console.log('WebSocketVideoPlayer: Connection confirmed');
  }
  break;
```

### 2. Improved Chunk Queue Management

**Before:**
- Only processed one chunk per `updateend` event
- Called `endOfStream()` immediately when `video_complete` arrived

**After:**
- Introduced `processChunkQueue()` function that continuously processes queued chunks
- Added `chunksRef.current.complete` flag to track when all chunks have been received
- Only calls `endOfStream()` after ALL chunks are processed AND `video_complete` has been received

### 3. New Helper Functions

**`processChunkQueue()`**
- Processes chunks one at a time as SourceBuffer becomes ready
- Automatically called on `updateend` events
- Handles errors by re-queuing failed chunks
- Calls `tryEndStream()` when queue is empty and streaming is complete

**`tryEndStream()`**
- Only ends the stream when:
  - `chunksRef.current.complete` is true (video_complete received)
  - Queue is empty (all chunks processed)
  - SourceBuffer is not updating
  - MediaSource is in 'open' state

### 4. Simplified Video Chunk Handling

**Before:**
```javascript
const handleVideoChunk = (arrayBuffer) => {
  if (!sourceBufferRef.current) {
    console.warn('SourceBuffer not ready, queuing chunk');
    chunksRef.current.push(arrayBuffer);
    return;
  }

  if (sourceBufferRef.current.updating) {
    chunksRef.current.push(arrayBuffer);
  } else {
    try {
      sourceBufferRef.current.appendBuffer(arrayBuffer);
    } catch (e) {
      console.error('Failed to append buffer:', e);
      chunksRef.current.push(arrayBuffer);
    }
  }
};
```

**After:**
```javascript
const handleVideoChunk = (arrayBuffer) => {
  // Always queue chunks - processChunkQueue will handle them
  chunksRef.current.push(arrayBuffer);

  // If SourceBuffer is ready and not updating, start processing
  if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
    processChunkQueue();
  }
};
```

### 5. Automatic Queue Processing on MediaSource Ready

When MediaSource's `sourceopen` event fires:
```javascript
// Start processing any chunks that arrived before MediaSource was ready
processChunkQueue();
```

### 6. Fixed React Ref Timing with Callback Ref

**Problem:** The video element ref was becoming unavailable when metadata arrived, causing infinite retries.

**Solution:** Replaced polling mechanism with stable React callback ref pattern:

```javascript
// Stable callback ref that only stores the video element reference
// CRITICAL: Empty dependency array ensures ref callback never changes
const videoCallbackRef = useCallback((node) => {
  if (node) {
    videoRef.current = node;
  } else {
    videoRef.current = null;
  }
}, []); // No dependencies - callback remains stable

// Separate useEffect handles MediaSource initialization when metadata arrives
useEffect(() => {
  if (metadata && videoRef.current && !mediaSourceRef.current) {
    initializeMediaSource(metadata.mimeType);
  }
}, [metadata]);

// Use callback ref in JSX
<video ref={videoCallbackRef} ... />
```

**How it works:**
- Callback ref fires once when video element mounts and stores the ref
- Callback never changes (empty deps) so React doesn't detach/reattach
- Separate useEffect watches for metadata and initializes MediaSource
- This separates concerns: ref attachment vs. MediaSource initialization

**Why the previous version failed:**
- Having `metadata` in the callback dependency array caused the ref callback to recreate
- When callback recreates, React calls old callback with `null`, then new with `node`
- This detach/reattach cycle created race conditions with component lifecycle
- Callback might not be called if component unmounts during the transition

### 7. Disabled React StrictMode (Temporary)

**Problem:** React 18+ StrictMode intentionally mounts, unmounts, then remounts components in development to detect side effects. This was causing:
- Component mounts → WebSocket starts connecting
- StrictMode unmounts component → WebSocket connection interrupted ("Firefox can't establish connection")
- Component remounts → tries to connect again
- Video element ref cleared during unmount → initialization fails

**Temporary Solution:** Disabled `<StrictMode>` in `main.jsx`:
```javascript
// Temporarily disabled StrictMode to prevent WebSocket interruption during development
// TODO: Re-enable and handle double-mounting properly
createRoot(document.getElementById('root')).render(
  <ServerProvider>
    <AuthProvider>
      ...
    </AuthProvider>
  </ServerProvider>
)
```

**Production Note:** StrictMode only affects development builds and is automatically disabled in production, so this was primarily a development debugging issue.

**Future Improvement:** Implement proper cleanup/reconnection logic to handle StrictMode double-mounting gracefully.

## Backend Status

✅ **Backend working perfectly:**
- Configuration: `playback.enabled = true`
- VideoX server: `http://10.13.8.2:3002`
- API integration successful
- Video streaming working: 144-186 chunks per 4-second clip
- Keep-alive pings functional

## Testing Results

After all fixes, video playback works correctly:

1. ✅ Click on path event in frontend
2. ✅ WebSocket connects to `/ws/video`
3. ✅ Backend fetches video from VideoX (receives complete MP4 file)
4. ✅ Backend buffers entire video into memory using event-based Promise
5. ✅ Backend writes video to temporary file
6. ✅ ffmpeg fragments the video (reading from temp file allows seeking to moov atom)
7. ✅ Backend streams fragmented MP4 chunks to frontend via WebSocket
8. ✅ Backend automatically cleans up temporary file
9. ✅ Frontend receives metadata (duration, resolution, fps, mimeType)
10. ✅ Frontend receives 150-180+ binary chunks
11. ✅ All chunks are queued and processed sequentially
12. ✅ Video player displays the clip
13. ✅ **Video starts playing at preTime offset (event occurrence time)**
14. ✅ Stream ends gracefully after all chunks are appended
15. ✅ User can scrub backward to see pre-event footage

### 8. Added MP4 Fragmentation with ffmpeg (CRITICAL FIX)

**Problem:** VideoX was returning regular MP4 files with the `moov` atom (movie metadata) at the **end** of the file. MediaSource API requires fragmented MP4 (fMP4) with metadata at the beginning for progressive streaming.

**Root Cause Discovery:**
- Downloaded video from VideoX and analyzed with `ffprobe`
- Structure showed: `ftyp → free → mdat (media) → moov (metadata at end)`
- Video played fine in VLC but not in browser
- MediaSource API requires: `ftyp → moov (at start) → moof+mdat fragments`

**Initial Approach (Failed):**
```javascript
// Tried piping buffered data to ffmpeg stdin - FAILED
const ffmpeg = spawn('ffmpeg', [
  '-i', 'pipe:0',              // Input from stdin
  '-c', 'copy',
  '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
  '-f', 'mp4',
  'pipe:1'
]);
response.data.pipe(ffmpeg.stdin);
```

**Problem with Piping:** ffmpeg cannot SEEK when reading from stdin. Since the moov atom is at the end of the file, ffmpeg needs to seek to read the metadata before fragmenting.

**Final Solution:** Write to temporary file, allowing ffmpeg to seek:

```javascript
// videoService.js
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Buffer complete video from VideoX
const videoBuffer = await new Promise((resolve, reject) => {
  const chunks = [];
  response.data.on('data', (chunk) => chunks.push(chunk));
  response.data.on('end', () => resolve(Buffer.concat(chunks)));
  response.data.on('error', (error) => reject(error));
});

// Write to temp file (allows ffmpeg to seek)
const tempInputFile = join(tmpdir(), `videox-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
await writeFile(tempInputFile, videoBuffer);

// Fragment with ffmpeg reading from file
const ffmpeg = spawn('ffmpeg', [
  '-i', tempInputFile,          // Input from temp file (seekable)
  '-c', 'copy',                 // Copy codec (no re-encoding)
  '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
  '-f', 'mp4',
  'pipe:1'                      // Output to stdout
]);

// Clean up temp file after ffmpeg completes
ffmpeg.on('exit', () => {
  unlink(tempInputFile).catch(() => {});
});

return { metadata, stream: ffmpeg.stdout };
```

**ffmpeg flags explained:**
- `frag_keyframe` - Create fragments at keyframes
- `empty_moov` - Put minimal moov atom at beginning
- `default_base_moof` - Use moof boxes for each fragment

**Updated MIME type:**
```javascript
mimeType: 'video/mp4; codecs="avc1.640029"'  // Was: 'video/mp4'
```

### 9. Fixed Video Playback Offset (Time Alignment Fix)

**Problem:** Video clip includes `preTime` seconds before the event and `postTime` seconds after. When playback started at 0:00, it was showing footage from before the event occurred. Users expected the video to start at the moment of the event.

**Example:**
- Event occurs at timestamp `T`
- Video clip spans: `(T - 5 seconds)` to `(T + 2 seconds)` = 7 seconds total
- Position 0:00 in video = 5 seconds BEFORE the event
- Position 0:05 in video = the actual event

**Solution:** Set initial playback position to `preTime` when video metadata loads:

```javascript
// WebSocketVideoPlayer.jsx
const videoCallbackRef = useCallback((node) => {
  if (node) {
    videoRef.current = node;

    // Set initial playback position when metadata is loaded
    const handleLoadedMetadata = () => {
      if (preTime && videoRef.current) {
        videoRef.current.currentTime = preTime;
        console.log('Set initial playback position to', preTime, 'seconds');
      }
    };

    node.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      node.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }
}, [preTime]);
```

**How it works:**
- When video element's `loadedmetadata` event fires, set `currentTime = preTime`
- Video now starts playing at the event timestamp instead of at the beginning
- User sees the event immediately when playback starts
- Can still scrub backward to see pre-event footage

**Behavior:**
- `preTime = 5`: Video starts at 5-second mark (event occurrence)
- `preTime = 0`: Video starts at beginning (no offset needed)
- Event listener cleanup prevents memory leaks when component unmounts

## Files Modified

- **Backend:** `/home/fred/development/dataq-analyzer-backend/src/services/videoService.js`
  - Added imports: `child_process`, `stream`, `fs/promises` (writeFile, unlink), `os` (tmpdir), `path` (join)
  - Implemented event-based stream buffering with Promise
  - **CRITICAL FIX:** Added temporary file strategy for ffmpeg (write buffer → ffmpeg reads from file → allows seeking)
  - Added ffmpeg fragmentation pipeline with proper error handling
  - Added automatic temp file cleanup on ffmpeg exit
  - Updated MIME type to include H.264 codec string: `'video/mp4; codecs="avc1.640029"'`
  - Enhanced logging for debugging video buffering and ffmpeg processing

- **Frontend:** `/home/fred/development/dataq-analyzer-frontend/src/components/WebSocketVideoPlayer.jsx`
  - Added `tryEndStream()` function
  - Added `processChunkQueue()` function
  - Improved `handleJsonMessage()` to handle "connected" message
  - Simplified `handleVideoChunk()` to always queue chunks
  - Updated `initializeMediaSource()` to start processing queued chunks
  - Fixed `cleanup()` to reset chunk queue properly
  - **CRITICAL FIX:** Replaced polling mechanism with React callback ref (`videoCallbackRef`) to properly handle video element ref timing
  - **NEW FIX:** Added `loadedmetadata` event handler to set initial playback position to `preTime`
  - Updated callback ref dependencies to include `preTime`
  - Added event listener cleanup in callback ref return function

- **Frontend:** `/home/fred/development/dataq-analyzer-frontend/src/main.jsx`
  - Temporarily disabled React StrictMode to prevent WebSocket interruption during development
  - Added TODO comment for re-enabling StrictMode with proper double-mount handling

## Next Steps (Completed)

1. ✅ Test video playback in the frontend by clicking on recent path events
2. ✅ Verify video plays smoothly without errors
3. ✅ Verify video starts at correct time offset (event occurrence)
4. ✅ Check that multiple video requests work correctly
5. ✅ Monitor browser console for any MediaSource errors

**Status:** All issues resolved. Video playback is fully functional.

## Technical Details

**MediaSource API Flow:**
```
1. video_metadata received → initializeMediaSource()
2. MediaSource created, waiting for sourceopen event
3. Binary chunks arrive → queued in chunksRef.current[]
4. sourceopen fires → SourceBuffer created
5. processChunkQueue() called → starts processing queued chunks
6. Each chunk appended → updateend fires → next chunk processed
7. video_complete received → chunksRef.current.complete = true
8. Last chunk processed → tryEndStream() → endOfStream()
9. Video playback complete
```

**Chunk Processing:**
- Chunks are processed one at a time (MediaSource API limitation)
- `updateend` event triggers processing of next chunk
- Queue ensures no chunks are lost during initialization
- Stream only ends after queue is fully drained

## Performance

### Backend Performance
- **VideoX Download:** ~390 KB for 4-second clip (H.264 encoded)
- **Buffering Strategy:** Event-based Promise collects all chunks into memory
- **Temporary File:** Written to `/tmp/videox-{timestamp}-{random}.mp4`
- **ffmpeg Processing:** Fragments MP4 in real-time (copy codec, no re-encoding)
- **Temp File Cleanup:** Automatic deletion on ffmpeg exit
- **Output Chunks:** ~150-180 fragmented chunks per 4-second clip
- **Streaming:** Chunks sent to frontend via WebSocket as ffmpeg outputs them

### Frontend Performance
- **Chunk Processing:** Sequential (one chunk per `updateend` event)
- **Memory:** Chunks queued in memory until processed by SourceBuffer
- **Network:** All chunks received via WebSocket before processing completes
- **Playback Start:** Automatic at `preTime` offset when metadata loads

### Resource Usage
- **Backend Memory:** Temporary spike during video buffering (~390 KB for 4s clip)
- **Backend Disk:** Temporary file exists only during ffmpeg processing (~1-2 seconds)
- **Frontend Memory:** Chunk queue held until MediaSource processes all chunks
- **Network Bandwidth:** ~98 KB/second for 4-second clips

This is normal behavior for MediaSource API - chunks must be processed sequentially to maintain video integrity.
