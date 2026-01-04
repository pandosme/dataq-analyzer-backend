import mqtt from 'mqtt';
import { mqttConfig } from '../config/index.js';
import { parseDataQMessage, isPathDataMessage } from '../dataq/parser.js';
import { savePathEvent } from '../services/pathEventService.js';
import { updateCameraSnapshotFromMQTT } from '../services/cameraService.js';
import { Camera } from '../models/index.js';
import logger from '../utils/logger.js';
import { broadcastPathEvent } from '../websocket/index.js';

let client = null;
let isConnected = false;
let messageCount = 0;

/**
 * Subscribe to MQTT topics for all active cameras
 */
async function subscribeToActiveCameras() {
  if (!client || !isConnected) {
    logger.warn('Cannot subscribe to cameras: MQTT client not connected');
    return;
  }

  try {
    // Load all cameras from database
    const cameras = await Camera.find({}).lean();
    console.log(`\nFound ${cameras.length} cameras in database`);

    if (cameras.length === 0) {
      console.log('No cameras configured - skipping MQTT subscriptions');
      logger.warn('No cameras found in database for MQTT subscription');
      return;
    }

    // Subscribe to each camera's path topic
    const subscriptions = [];

    for (const camera of cameras) {
      // Use custom mqttTopic if defined, otherwise use default format
      const pathTopic = camera.mqttTopic || `dataq/path/${camera.serialNumber}`;
      subscriptions.push(pathTopic);

      // For remote cameras, also subscribe to image topic
      if (camera.cameraType === 'remote') {
        const imageTopic = `image/${camera.serialNumber}`;
        subscriptions.push(imageTopic);
      }
    }

    // Add device announcement and status topics
    subscriptions.push('dataq/connect/+');
    subscriptions.push('dataq/status/+');

    // Subscribe to all topics
    console.log(`\nSubscribing to ${subscriptions.length} MQTT topics:`);
    for (const topic of subscriptions) {
      console.log(`  Attempting to subscribe to: ${topic}`);
      client.subscribe(topic, (err) => {
        if (err) {
          logger.error('Failed to subscribe to MQTT topic', {
            error: err.message,
            topic,
          });
          console.log(`  ✗ FAILED to subscribe to ${topic}: ${err.message}`);
        } else {
          logger.info('Subscribed to MQTT topic', { topic });
          console.log(`  ✓ SUBSCRIBED to ${topic}`);
        }
      });
    }

    logger.info('MQTT subscriptions initialized', {
      cameraCount: cameras.length,
      topicCount: subscriptions.length,
    });
  } catch (error) {
    logger.error('Error subscribing to camera topics', {
      error: error.message,
    });
    console.error('Error subscribing to camera topics:', error.message);
  }
}

/**
 * Initialize and connect MQTT client
 * @param {Object} config - Optional MQTT configuration override
 * @returns {Promise<mqtt.MqttClient>}
 */
export async function connectMQTT(config = mqttConfig) {
  if (client && isConnected) {
    logger.info('MQTT client already connected');
    return client;
  }

  return new Promise((resolve, reject) => {
    const options = {
      clientId: config.clientId,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
    };

    // Add authentication if provided
    if (config.username) {
      options.username = config.username;
    }
    if (config.password) {
      options.password = config.password;
    }

    logger.info('Connecting to MQTT broker', {
      broker: config.brokerUrl,
      clientId: config.clientId,
    });

    client = mqtt.connect(config.brokerUrl, options);

    client.on('connect', async () => {
      isConnected = true;
      logger.info('MQTT client connected', { broker: config.brokerUrl });
      console.log('\n✓ MQTT CLIENT CONNECTED to', config.brokerUrl);

      // Subscribe to camera-specific topics from database
      await subscribeToActiveCameras();

      resolve(client);
    });

    client.on('error', (error) => {
      logger.error('MQTT client error', { error: error.message });
      if (!isConnected) {
        reject(error);
      }
    });

    client.on('offline', () => {
      isConnected = false;
      logger.warn('MQTT client offline');
    });

    client.on('reconnect', () => {
      logger.info('MQTT client reconnecting');
    });

    client.on('close', () => {
      isConnected = false;
      logger.warn('MQTT client connection closed');
    });

    // Handle incoming messages
    client.on('message', handleMQTTMessage);
  });
}

/**
 * Check if a path should be saved based on camera filters
 * @param {Object} pathData - Parsed path event data
 * @param {Object} filters - Camera filter configuration
 * @returns {boolean} - True if path should be saved
 */
function shouldSavePath(pathData, filters) {
  // Use default values if filters not configured
  const defaultObjectTypes = ['Human', 'Car', 'Truck', 'Bus', 'Bike', 'LicensePlate', 'Head', 'Bag', 'Vehicle', 'Animal', 'Other'];
  const objectTypes = filters?.objectTypes || defaultObjectTypes;
  const minAge = filters?.minAge !== undefined ? filters.minAge : 2;
  const minDistance = filters?.minDistance !== undefined ? filters.minDistance : 20;

  // Filter by object type
  if (objectTypes.length > 0) {
    if (!objectTypes.includes(pathData.class)) {
      logger.debug('Path filtered: object type not in list', {
        class: pathData.class,
        allowedTypes: objectTypes,
      });
      return false;
    }
  }

  // Filter by minimum age (using original 'age' property)
  if (pathData.age < minAge) {
    logger.debug('Path filtered: age too low', {
      age: pathData.age,
      minAge,
      trackingId: pathData.id,
    });
    return false;
  }

  // Filter by minimum distance (as percentage of diagonal)
  // Calculate total displacement as percentage
  // Diagonal of 1000x1000 coordinate system = sqrt(1000^2 + 1000^2) = 1414.21
  const displacement = Math.sqrt(pathData.dx * pathData.dx + pathData.dy * pathData.dy);
  const displacementPercent = (displacement / 1414.21) * 100;

  if (displacementPercent < minDistance) {
    logger.debug('Path filtered: distance too short', {
      displacement: displacement.toFixed(2),
      displacementPercent: displacementPercent.toFixed(2),
      minDistance,
      dx: pathData.dx,
      dy: pathData.dy,
      trackingId: pathData.id,
    });
    return false;
  }

  return true;
}

/**
 * Handle device connection announcements (dataq/connect/{SERIAL})
 * @param {string} topic - MQTT topic
 * @param {Buffer} payload - Message payload
 */
async function handleConnectMessage(topic, payload) {
  try {
    const message = JSON.parse(payload.toString());
    const serialNumber = topic.split('/')[2]?.toUpperCase();

    if (!serialNumber) {
      logger.warn('Invalid connect topic format', { topic });
      return;
    }

    logger.info('Device connection announcement received', {
      serialNumber,
      connected: message.connected,
      address: message.address,
    });

    // Update camera device status
    await Camera.findOneAndUpdate(
      { serialNumber },
      {
        $set: {
          'deviceStatus.connected': message.connected,
          'deviceStatus.address': message.address || '',
          'deviceStatus.lastSeen': new Date(),
        },
      },
      { upsert: false }
    );

    logger.info('Camera device status updated', {
      serialNumber,
      connected: message.connected,
    });
  } catch (error) {
    logger.error('Error handling connect message', {
      error: error.message,
      topic,
    });
  }
}

/**
 * Handle device status messages (dataq/status/{SERIAL})
 * @param {string} topic - MQTT topic
 * @param {Buffer} payload - Message payload
 */
async function handleStatusMessage(topic, payload) {
  try {
    const message = JSON.parse(payload.toString());
    const serialNumber = topic.split('/')[2]?.toUpperCase();

    if (!serialNumber) {
      logger.warn('Invalid status topic format', { topic });
      return;
    }

    logger.debug('Device status message received', {
      serialNumber,
      network: message.Network_Kbps,
      cpu: message.CPU_average,
      uptime: message.Uptime_Hours,
    });

    // Update camera device status
    await Camera.findOneAndUpdate(
      { serialNumber },
      {
        $set: {
          'deviceStatus.networkKbps': message.Network_Kbps || 0,
          'deviceStatus.cpuAverage': message.CPU_average || 0,
          'deviceStatus.uptimeHours': message.Uptime_Hours || 0,
          'deviceStatus.lastSeen': new Date(),
        },
      },
      { upsert: false }
    );

    logger.debug('Camera status updated', { serialNumber });
  } catch (error) {
    logger.error('Error handling status message', {
      error: error.message,
      topic,
    });
  }
}

/**
 * Handle incoming MQTT messages
 * @param {string} topic - MQTT topic
 * @param {Buffer} payload - Message payload
 */
async function handleMQTTMessage(topic, payload) {
  try {
    logger.debug('Received MQTT message', { topic, size: payload.length });

    // Check if this is a device connect announcement (dataq/connect/{SERIAL})
    if (topic.startsWith('dataq/connect/')) {
      await handleConnectMessage(topic, payload);
      return;
    }

    // Check if this is a device status message (dataq/status/{SERIAL})
    if (topic.startsWith('dataq/status/')) {
      await handleStatusMessage(topic, payload);
      return;
    }

    // Check if this is an image topic (image/{SERIAL})
    if (topic.startsWith('image/')) {
      await handleImageMessage(topic, payload);
      return;
    }

    // Handle DataQ path messages
    const parsedData = parseDataQMessage(payload, topic);
    if (!parsedData) {
      logger.warn('Failed to parse DataQ message or invalid format', { topic });
      return;
    }

    // Check if this is path data (we're primarily interested in path data for this app)
    if (!isPathDataMessage(JSON.parse(payload.toString()))) {
      logger.debug('Message is not path data, skipping', { topic });
      return;
    }

    // Extract serial number from the message (using original property name 'serial')
    const serialNumber = (parsedData.serial || parsedData.device || '').toUpperCase();

    // Load camera filters to check if path should be saved
    const camera = await Camera.findOne({ serialNumber }).lean();
    if (!camera) {
      logger.warn('Camera not found for path event', {
        serial: parsedData.serial,
      });
      return;
    }

    // Apply camera filters
    if (!shouldSavePath(parsedData, camera.filters)) {
      logger.debug('Path filtered out by camera filters', {
        trackingId: parsedData.id,
        serial: parsedData.serial,
        class: parsedData.class,
      });
      return;
    }

    // Save to database (stores as-is with original property names)
    const savedEvent = await savePathEvent(parsedData);

    // Broadcast to WebSocket clients
    broadcastPathEvent(savedEvent.toObject ? savedEvent.toObject() : savedEvent);

    logger.debug('Path event processed and saved', {
      trackingId: parsedData.id,
      serial: parsedData.serial,
      class: parsedData.class,
    });
  } catch (error) {
    logger.error('Error handling MQTT message', {
      error: error.message,
      topic,
    });
  }
}

/**
 * Handle image messages from MQTT (remote cameras)
 * @param {string} topic - MQTT topic (format: image/{SERIAL})
 * @param {Buffer} payload - Message payload
 */
async function handleImageMessage(topic, payload) {
  try {
    const message = JSON.parse(payload.toString());

    // Extract serial number from topic (image/{SERIAL})
    const serialNumber = topic.split('/')[1];

    if (!serialNumber || !message.image) {
      logger.warn('Invalid image message format', { topic });
      return;
    }

    // Update camera snapshot in database
    await updateCameraSnapshotFromMQTT({
      serialNumber: serialNumber.toUpperCase(),
      base64Image: message.image,
      timestamp: message.timestamp || Date.now(),
      rotation: message.rotation,
      aspectRatio: message.aspect,
    });

    logger.debug('Camera snapshot updated from MQTT', {
      serialNumber,
      timestamp: message.timestamp,
    });
  } catch (error) {
    logger.error('Error handling image message', {
      error: error.message,
      topic,
    });
  }
}

/**
 * Disconnect MQTT client
 */
export async function disconnectMQTT() {
  if (client) {
    return new Promise((resolve) => {
      client.end(false, {}, () => {
        isConnected = false;
        client = null;
        logger.info('MQTT client disconnected');
        resolve();
      });
    });
  }
}

/**
 * Get MQTT client connection status
 * @returns {boolean}
 */
export function isConnectedToMQTT() {
  return isConnected;
}

/**
 * Get MQTT client instance
 * @returns {mqtt.MqttClient|null}
 */
export function getMQTTClient() {
  return client;
}

/**
 * Resubscribe to camera topics (call when cameras are added/updated)
 */
export async function resubscribeToCameras() {
  if (!client || !isConnected) {
    logger.warn('Cannot resubscribe: MQTT client not connected');
    return;
  }

  logger.info('Resubscribing to camera topics');
  console.log('\nResubscribing to camera topics...');
  await subscribeToActiveCameras();
}

export default {
  connectMQTT,
  disconnectMQTT,
  isConnectedToMQTT,
  getMQTTClient,
  resubscribeToCameras,
};
