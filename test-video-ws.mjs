/**
 * Quick WS video pipeline test.
 * Usage: node test-video-ws.mjs [serial] [timestamp]
 */
import WebSocket from 'ws';

const BASE = 'http://localhost:3303';
const serial = process.argv[2] || 'B8A44FF11A35';
// Use a recent timestamp (1 hour ago)
const timestamp = process.argv[3] || new Date(Date.now() - 3600 * 1000).toISOString();

async function getToken() {
  const res = await fetch(`${BASE}/api/auth/client-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  });
  const data = await res.json();
  const token = data.token || data.data?.token;
  if (!token) throw new Error('Login failed: ' + JSON.stringify(data));
  return token;
}

async function run() {
  console.log(`\n=== Video WS Test ===`);
  console.log(`Serial:    ${serial}`);
  console.log(`Timestamp: ${timestamp}\n`);

  const token = await getToken();
  console.log('✓ Authenticated\n');

  const wsUrl = `ws://localhost:3303/ws/video?token=${token}`;
  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  let bytesReceived = 0;
  let chunksReceived = 0;
  const t0 = Date.now();

  ws.on('open', () => {
    console.log('✓ WebSocket connected');
    const req = {
      type: 'request_video',
      serial,
      timestamp,
      preTime: 5,
      postTime: 5,
      age: 3,
      format: 'mp4',
    };
    console.log('→ Sending request:', JSON.stringify(req, null, 2), '\n');
    ws.send(JSON.stringify(req));
  });

  ws.on('message', (data) => {
    if (typeof data === 'string' || data instanceof Buffer && data[0] === 123) {
      const msg = JSON.parse(data.toString());
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${elapsed}s] ← JSON:`, JSON.stringify(msg, null, 2));

      if (msg.type === 'error') {
        console.error('\n✗ Error received. Closing.');
        ws.close();
      } else if (msg.type === 'video_complete') {
        console.log(`\n✓ Complete! Chunks: ${chunksReceived}, Bytes: ${bytesReceived}`);
        ws.close();
      }
    } else {
      // Binary chunk
      const ab = data instanceof ArrayBuffer ? data : data.buffer;
      bytesReceived += ab.byteLength;
      chunksReceived++;
      if (chunksReceived === 1 || chunksReceived % 10 === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[${elapsed}s] ← Binary chunk #${chunksReceived}: ${ab.byteLength} bytes (total ${bytesReceived})`);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('✗ WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n[${elapsed}s] WebSocket closed: code=${code} reason=${reason.toString() || '(none)'}`);
    process.exit(0);
  });

  // Timeout after 90s
  setTimeout(() => {
    console.error('\n✗ Timeout after 90s');
    ws.close();
  }, 90000);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
