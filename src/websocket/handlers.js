/**
 * WebSocket message handlers
 * Handles incoming messages from WebSocket clients (subscribe, unsubscribe, ping)
 */

import { getConnection, updateSubscriptions } from './manager.js';
import { Camera } from '../models/index.js';
import logger from '../utils/logger.js';

/**
 * Handle incoming WebSocket message
 * @param {WebSocket} ws - WebSocket instance
 * @param {Buffer} data - Message data
 * @param {string} connectionId - Connection ID
 */
export async function handleMessage(ws, data, connectionId) {
  try {
    const message = JSON.parse(data.toString());

    logger.debug('WebSocket message received', {
      type: message.type,
      connectionId,
    });

    switch (message.type) {
      case 'subscribe':
        await handleSubscribe(ws, message, connectionId);
        break;
      case 'unsubscribe':
        await handleUnsubscribe(ws, message, connectionId);
        break;
      case 'ping':
        handlePing(ws);
        break;
      default:
        sendError(ws, 'Unknown message type', 'INVALID_REQUEST');
    }
  } catch (error) {
    logger.error('Error handling WebSocket message', {
      error: error.message,
      connectionId,
    });
    sendError(ws, 'Invalid JSON', 'INVALID_REQUEST');
  }
}

/**
 * Handle subscribe message with authorization
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} message - Subscribe message
 * @param {string} connectionId - Connection ID
 */
async function handleSubscribe(ws, message, connectionId) {
  const connection = getConnection(connectionId);
  if (!connection) {
    sendError(ws, 'Connection not found', 'INTERNAL_ERROR');
    return;
  }

  const { user } = connection;
  const requestedCameras = message.cameras || [];
  const filters = message.filters || {};

  let authorizedCameras = [];

  try {
    // Case 1: No specific cameras requested - subscribe to all authorized
    if (requestedCameras.length === 0) {
      if (user.role === 'admin') {
        // Admin: get all enabled cameras
        const allCameras = await Camera.find({ enabled: true }).select('serialNumber').lean();
        authorizedCameras = allCameras.map((c) => c.serialNumber);
      } else {
        // Regular user: get their authorized cameras
        const userCameras = await Camera.find({
          _id: { $in: user.authorizedCameras },
          enabled: true,
        })
          .select('serialNumber')
          .lean();
        authorizedCameras = userCameras.map((c) => c.serialNumber);
      }
    }
    // Case 2: Specific cameras requested - check authorization
    else {
      if (user.role === 'admin') {
        // Admin can subscribe to any requested camera
        // Verify cameras exist and are enabled
        const cameras = await Camera.find({
          serialNumber: { $in: requestedCameras },
          enabled: true,
        })
          .select('serialNumber')
          .lean();
        authorizedCameras = cameras.map((c) => c.serialNumber);
      } else {
        // Regular user: only authorize cameras in their list
        const userCameras = await Camera.find({
          _id: { $in: user.authorizedCameras },
          serialNumber: { $in: requestedCameras },
          enabled: true,
        })
          .select('serialNumber')
          .lean();
        authorizedCameras = userCameras.map((c) => c.serialNumber);
      }
    }

    // Update subscriptions
    updateSubscriptions(connectionId, authorizedCameras, filters);

    // Send confirmation
    ws.send(
      JSON.stringify({
        type: 'subscribed',
        cameras: authorizedCameras,
        timestamp: new Date().toISOString(),
      })
    );

    // Send error if some cameras were unauthorized
    if (requestedCameras.length > 0 && authorizedCameras.length < requestedCameras.length) {
      const unauthorizedCameras = requestedCameras.filter(
        (c) => !authorizedCameras.includes(c)
      );
      sendError(
        ws,
        `Some cameras were not authorized: ${unauthorizedCameras.join(', ')}`,
        'UNAUTHORIZED'
      );
    }

    logger.info('Client subscribed', {
      connectionId,
      userId: user._id,
      username: user.username,
      role: user.role,
      cameraCount: authorizedCameras.length,
      requestedCount: requestedCameras.length,
      filterCount: Object.keys(filters).length,
    });
  } catch (error) {
    logger.error('Error handling subscribe', {
      error: error.message,
      connectionId,
      userId: user._id,
    });
    sendError(ws, 'Failed to process subscription', 'INTERNAL_ERROR');
  }
}

/**
 * Handle unsubscribe message
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} message - Unsubscribe message
 * @param {string} connectionId - Connection ID
 */
async function handleUnsubscribe(ws, message, connectionId) {
  const connection = getConnection(connectionId);
  if (!connection) {
    sendError(ws, 'Connection not found', 'INTERNAL_ERROR');
    return;
  }

  const camerasToRemove = message.cameras || [];
  const currentSubs = connection.subscriptions.cameras;

  // Remove specified cameras from subscription
  const newCameras = currentSubs.filter((c) => !camerasToRemove.includes(c));

  updateSubscriptions(connectionId, newCameras, connection.subscriptions.filters);

  ws.send(
    JSON.stringify({
      type: 'unsubscribed',
      cameras: camerasToRemove,
      timestamp: new Date().toISOString(),
    })
  );

  logger.info('Client unsubscribed', {
    connectionId,
    userId: connection.user._id,
    removedCount: camerasToRemove.length,
    remainingCount: newCameras.length,
  });
}

/**
 * Handle ping message
 * @param {WebSocket} ws - WebSocket instance
 */
function handlePing(ws) {
  ws.send(
    JSON.stringify({
      type: 'pong',
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Send error message to client
 * @param {WebSocket} ws - WebSocket instance
 * @param {string} error - Error message
 * @param {string} code - Error code
 */
function sendError(ws, error, code) {
  ws.send(
    JSON.stringify({
      type: 'error',
      error,
      code,
      timestamp: new Date().toISOString(),
    })
  );
}

export default {
  handleMessage,
};
