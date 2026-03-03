import { Camera, PathEvent } from '../models/index.js';
import * as configService from './configService.js';
import logger from '../utils/logger.js';

/**
 * Get all cameras
 * @param {boolean} enabledOnly - Return only enabled cameras
 * @returns {Promise<Array>}
 */
export async function getAllCameras(enabledOnly = false, includeStats = false) {
  try {
    const query = enabledOnly ? { enabled: true } : {};
    const cameras = await Camera.find(query).sort({ name: 1 }).lean();

    if (!includeStats) return cameras;

    // Aggregate path counts per serial
    const counts = await PathEvent.aggregate([
      { $group: { _id: '$serial', count: { $sum: 1 } } },
    ]);
    const countsMap = {};
    counts.forEach((c) => {
      countsMap[c._id] = c.count;
    });

    // Get system default retention
    const systemConfig = await configService.getSystemConfig();
    const defaultRetention = systemConfig?.dataRetentionDays || 90;

    // Attach pathCount and effectiveRetentionDays to each camera
    return cameras.map((cam) => ({
      ...cam,
      pathCount: countsMap[cam.serialNumber] || 0,
      effectiveRetentionDays: cam.retentionDays != null ? cam.retentionDays : defaultRetention,
    }));
  } catch (error) {
    logger.error('Failed to get cameras', { error: error.message });
    throw error;
  }
}

/**
 * Get a camera by ID
 * @param {string} id - Camera document ID
 * @returns {Promise<Object|null>}
 */
export async function getCameraById(id) {
  try {
    return await Camera.findById(id).lean();
  } catch (error) {
    logger.error('Failed to get camera', { error: error.message, id });
    throw error;
  }
}

/**
 * Get a camera by serial number
 * @param {string} serialNumber - Camera serial number (unique identifier)
 * @returns {Promise<Object|null>}
 */
export async function getCameraBySerialNumber(serialNumber) {
  try {
    return await Camera.findOne({ serialNumber: serialNumber.toUpperCase() }).lean();
  } catch (error) {
    logger.error('Failed to get camera by serial number', {
      error: error.message,
      serialNumber,
    });
    throw error;
  }
}

/**
 * Create a new camera
 * @param {Object} cameraData - Camera data
 * @returns {Promise<Object>}
 */
export async function createCamera(cameraData) {
  try {
    const camera = new Camera(cameraData);
    await camera.save();
    logger.info('Camera created', { serialNumber: camera.serialNumber, name: camera.name });
    return camera.toObject();
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('Camera with this serial number already exists');
    }
    logger.error('Failed to create camera', { error: error.message });
    throw error;
  }
}

/**
 * Update a camera
 * @param {string} id - Camera document ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object|null>}
 */
export async function updateCamera(id, updateData) {
  try {
    const camera = await Camera.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (camera) {
      logger.info('Camera updated', { id, serialNumber: camera.serialNumber });
    }
    return camera ? camera.toObject() : null;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('Camera with this serial number already exists');
    }
    logger.error('Failed to update camera', { error: error.message, id });
    throw error;
  }
}

/**
 * Delete a camera
 * @param {string} id - Camera document ID
 * @returns {Promise<boolean>}
 */
export async function deleteCamera(id) {
  try {
    const result = await Camera.findByIdAndDelete(id);
    if (result) {
      logger.info('Camera deleted', { id, serialNumber: result.serialNumber });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to delete camera', { error: error.message, id });
    throw error;
  }
}

/**
 * Update camera snapshot from MQTT message (remote cameras)
 * @param {Object} data - Snapshot data
 * @param {string} data.serialNumber - Camera serial number
 * @param {string} data.base64Image - Base64 encoded image
 * @param {number} data.timestamp - Image timestamp
 * @param {number} data.rotation - Image rotation (optional)
 * @param {string} data.aspectRatio - Image aspect ratio (optional)
 * @returns {Promise<Object|null>}
 */
export async function updateCameraSnapshotFromMQTT(data) {
  try {
    const { serialNumber, base64Image, timestamp, rotation, aspectRatio } = data;

    const updateData = {
      latestSnapshot: base64Image,
      latestSnapshotTimestamp: new Date(timestamp),
    };

    // Update rotation and aspect ratio if provided
    if (rotation !== undefined) {
      updateData.rotation = rotation;
    }
    if (aspectRatio) {
      updateData.aspectRatio = aspectRatio;
    }

    const camera = await Camera.findOneAndUpdate(
      { serialNumber: serialNumber.toUpperCase() },
      updateData,
      { new: true }
    );

    if (camera) {
      logger.debug('Camera snapshot updated from MQTT', {
        serialNumber,
        timestamp: new Date(timestamp),
      });
    } else {
      logger.warn('Camera not found for snapshot update', { serialNumber });
    }

    return camera ? camera.toObject() : null;
  } catch (error) {
    logger.error('Failed to update camera snapshot from MQTT', {
      error: error.message,
      serialNumber: data.serialNumber,
    });
    throw error;
  }
}

/**
 * Get camera snapshot (latest image)
 * @param {string} serialNumber - Camera serial number
 * @returns {Promise<Object|null>} Object with base64 image and metadata
 */
export async function getCameraSnapshot(serialNumber) {
  try {
    const camera = await Camera.findOne(
      { serialNumber: serialNumber.toUpperCase() },
      { latestSnapshot: 1, latestSnapshotTimestamp: 1, rotation: 1, aspectRatio: 1 }
    ).lean();

    if (!camera || !camera.latestSnapshot) {
      return null;
    }

    return {
      image: camera.latestSnapshot,
      timestamp: camera.latestSnapshotTimestamp,
      rotation: camera.rotation,
      aspectRatio: camera.aspectRatio,
    };
  } catch (error) {
    logger.error('Failed to get camera snapshot', {
      error: error.message,
      serialNumber,
    });
    throw error;
  }
}

/**
 * Auto-create or update a camera from a dataq/connect announcement.
 * Only call this when the announcement has connected === true.
 * @param {Object} announcement - Parsed connect message payload
 * @param {string} announcement.serial - Device serial number
 * @param {string} announcement.name - Device name
 * @param {string} announcement.location - Device location
 * @param {string} announcement.model - Device model
 * @param {string} announcement.address - Device IP address
 * @param {Array}  announcement.labels - Detection label/class definitions
 * @returns {Promise<{camera: Object, isNew: boolean}>}
 */
export async function upsertCameraFromAnnouncement(announcement) {
  try {
    const serialNumber = (announcement.serial || '').toUpperCase();
    if (!serialNumber) throw new Error('serial is required in announcement');

    const labels = Array.isArray(announcement.labels) ? announcement.labels : [];

    const setOnInsert = {
      // Defaults only applied when the document is first created
      cameraType: 'remote',
      mqttTopic: `dataq/path/${serialNumber}`,
      autoDiscovered: true,
      enabled: true,
    };

    const setAlways = {
      name: announcement.name || serialNumber,
      location: announcement.location || '',
      model: announcement.model || '',
      labels: labels,
      'deviceStatus.connected': true,
      'deviceStatus.address': announcement.address || '',
      'deviceStatus.lastSeen': new Date(),
    };

    const result = await Camera.findOneAndUpdate(
      { serialNumber },
      {
        $set: setAlways,
        $setOnInsert: setOnInsert,
      },
      { upsert: true, new: true, includeResultMetadata: true }
    );

    const isNew = result.lastErrorObject?.upserted != null;
    const camera = result.value.toObject ? result.value.toObject() : result.value;

    logger.info(isNew ? 'Camera auto-discovered and created' : 'Camera updated from announcement', {
      serialNumber,
      name: camera.name,
      model: camera.model,
      isNew,
    });

    return { camera, isNew };
  } catch (error) {
    if (error.code === 11000) {
      // Race condition: camera was just inserted by another process - fetch it
      const camera = await Camera.findOne({
        serialNumber: (announcement.serial || '').toUpperCase(),
      }).lean();
      return { camera, isNew: false };
    }
    logger.error('Failed to upsert camera from announcement', { error: error.message });
    throw error;
  }
}

export default {
  getAllCameras,
  getCameraById,
  getCameraBySerialNumber,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraSnapshotFromMQTT,
  getCameraSnapshot,
  upsertCameraFromAnnouncement,
};
