import { Camera } from '../models/index.js';
import logger from '../utils/logger.js';

/**
 * Get all cameras
 * @param {boolean} enabledOnly - Return only enabled cameras
 * @returns {Promise<Array>}
 */
export async function getAllCameras(enabledOnly = false) {
  try {
    const query = enabledOnly ? { enabled: true } : {};
    return await Camera.find(query).sort({ name: 1 }).lean();
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

export default {
  getAllCameras,
  getCameraById,
  getCameraBySerialNumber,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraSnapshotFromMQTT,
  getCameraSnapshot,
};
