/**
 * WebSocket event broadcasting
 * Broadcasts path events to subscribed WebSocket clients with filtering
 */

import { getAllConnections } from './manager.js';
import { matchesFilters } from './filters.js';
import logger from '../utils/logger.js';

/**
 * Broadcast a path event to all subscribed WebSocket clients
 * @param {Object} pathEvent - Path event data from MQTT
 */
export function broadcastPathEvent(pathEvent) {
  const connections = getAllConnections();
  let sentCount = 0;
  let filteredCount = 0;

  for (const connection of connections) {
    const shouldSend = shouldSendToClient(connection, pathEvent);

    if (shouldSend) {
      try {
        // Send event to client
        connection.ws.send(
          JSON.stringify({
            type: 'path',
            data: pathEvent,
          })
        );
        sentCount++;
      } catch (error) {
        logger.error('Failed to send path event to client', {
          error: error.message,
          connectionId: connection.id,
          userId: connection.user._id,
        });
      }
    } else {
      filteredCount++;
    }
  }

  if (sentCount > 0) {
    logger.debug('Path event broadcasted', {
      trackingId: pathEvent.id,
      serial: pathEvent.serial,
      class: pathEvent.class,
      recipientCount: sentCount,
      filteredCount,
      totalConnections: connections.length,
    });
  }
}

/**
 * Check if a path event should be sent to a specific client
 * @param {Object} connection - Connection metadata
 * @param {Object} pathEvent - Path event data
 * @returns {boolean} True if event should be sent
 */
function shouldSendToClient(connection, pathEvent) {
  const { ws, user, subscriptions } = connection;

  // Check WebSocket readiness (1 = OPEN)
  if (ws.readyState !== 1) {
    return false;
  }

  const { cameras, filters } = subscriptions;

  // Check camera subscription
  if (cameras.length > 0) {
    // If cameras array is populated, check if this camera is subscribed
    if (!cameras.includes(pathEvent.serial)) {
      return false;
    }
  } else {
    // Empty cameras array means "all authorized cameras"
    // For admin, this means all cameras (allow)
    // For regular users, this shouldn't happen because subscribe handler
    // populates the cameras array with authorized cameras
    // But as a safety check, verify for non-admin users
    if (user.role !== 'admin') {
      // Check if camera is in user's authorized list
      const isAuthorized = user.authorizedCameras.some(
        (camId) => camId.toString() === pathEvent.cameraId?.toString()
      );
      if (!isAuthorized) {
        return false;
      }
    }
  }

  // Apply client-side filters
  if (!matchesFilters(pathEvent, filters)) {
    return false;
  }

  return true;
}

export default {
  broadcastPathEvent,
};
