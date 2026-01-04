import { MongoConfig, MqttConfig, SystemConfig } from '../models/index.js';
import { connectMQTT, disconnectMQTT, getMQTTClient } from '../mqtt/client.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Get MQTT configuration
 * @returns {Promise<Object>}
 */
export async function getMqttConfig() {
  try {
    let config = await MqttConfig.findById('mqtt-config').lean();
    if (!config) {
      // Create default config
      config = await MqttConfig.create({
        _id: 'mqtt-config',
        brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
        host: 'localhost',
        port: 1883,
        protocol: 'mqtt',
        topicPrefix: 'dataq/#',
      });
    }
    // Don't expose password in response
    const { password, ...safeConfig } = config;
    return { ...safeConfig, hasPassword: !!password };
  } catch (error) {
    logger.error('Failed to get MQTT config', { error: error.message });
    throw error;
  }
}

/**
 * Update MQTT configuration
 * @param {Object} updateData - MQTT config updates
 * @returns {Promise<Object>}
 */
export async function updateMqttConfig(updateData) {
  try {
    const allowedFields = [
      'brokerUrl',
      'host',
      'port',
      'protocol',
      'username',
      'password',
      'useTls',
      'topicPrefix',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // Update or create config
    const config = await MqttConfig.findByIdAndUpdate('mqtt-config', updates, {
      new: true,
      upsert: true,
      runValidators: true,
    });

    logger.info('MQTT configuration updated', { host: config.host, port: config.port });

    // Don't expose password in response
    const { password, ...safeConfig } = config.toObject();
    return { ...safeConfig, hasPassword: !!password };
  } catch (error) {
    logger.error('Failed to update MQTT config', { error: error.message });
    throw error;
  }
}

/**
 * Test MQTT connection with provided settings
 * @param {Object} settings - MQTT connection settings to test
 * @returns {Promise<Object>} - Test result
 */
export async function testMqttConnection(settings) {
  const mqtt = (await import('mqtt')).default;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (testClient) testClient.end(true);
      resolve({
        success: false,
        message: 'Connection timeout after 10 seconds',
      });
    }, 10000);

    const options = {
      clientId: `dataq-test-${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      connectTimeout: 5000,
    };

    if (settings.username) options.username = settings.username;
    if (settings.password) options.password = settings.password;

    const testClient = mqtt.connect(settings.brokerUrl, options);

    testClient.on('connect', () => {
      clearTimeout(timeout);
      testClient.end(false, {}, () => {
        resolve({
          success: true,
          message: 'Successfully connected to MQTT broker',
        });
      });
    });

    testClient.on('error', (error) => {
      clearTimeout(timeout);
      testClient.end(true);
      resolve({
        success: false,
        message: `Connection failed: ${error.message}`,
      });
    });
  });
}

/**
 * Reconnect MQTT with new configuration
 * @returns {Promise<Object>}
 */
export async function reconnectMqtt() {
  try {
    // Disconnect current client
    await disconnectMQTT();

    // Get new config from database
    const config = await MqttConfig.findById('mqtt-config').lean();
    if (!config) {
      throw new Error('MQTT configuration not found');
    }

    // Build connection config
    const mqttConfig = {
      brokerUrl: config.brokerUrl,
      username: config.username || null,
      password: config.password || null,
      useTls: config.useTls || false,
      topicPrefix: config.topicPrefix || 'dataq/#',
      clientId: `dataq-analyzer-${Math.random().toString(16).substr(2, 8)}`,
    };

    // Connect with new config
    await connectMQTT(mqttConfig);

    return { success: true, message: 'MQTT reconnected successfully' };
  } catch (error) {
    logger.error('Failed to reconnect MQTT', { error: error.message });
    return { success: false, message: error.message };
  }
}

/**
 * Get system configuration
 * @returns {Promise<Object>}
 */
export async function getSystemConfig() {
  try {
    let config = await SystemConfig.findById('system-config').lean();

    logger.debug('getSystemConfig - findById result', {
      found: !!config,
      playbackEnabled: config?.playback?.enabled,
      playbackType: config?.playback?.type,
      playbackServerUrl: config?.playback?.serverUrl,
    });

    if (!config) {
      // Create default config
      logger.warn('No system config found in database, creating default');
      config = await SystemConfig.create({ _id: 'system-config' });
      logger.info('Created default system config', {
        playbackEnabled: config.playback?.enabled,
      });
    }
    return config;
  } catch (error) {
    logger.error('Failed to get system config', { error: error.message });
    throw error;
  }
}

/**
 * Update system configuration
 * @param {Object} updateData - System config updates
 * @returns {Promise<Object>}
 */
export async function updateSystemConfig(updateData) {
  try {
    const config = await SystemConfig.findByIdAndUpdate('system-config', updateData, {
      new: true,
      upsert: true,
      runValidators: true,
    });

    logger.info('System configuration updated');
    return config.toObject();
  } catch (error) {
    logger.error('Failed to update system config', { error: error.message });
    throw error;
  }
}

/**
 * Test Playback/VMS server connection
 * @param {Object} settings - Playback settings (type, serverUrl, apiKey, useTls)
 * @returns {Promise<Object>}
 */
export async function testPlaybackConnection(settings) {
  const { type, serverUrl, apiKey, useTls } = settings;

  if (!serverUrl) {
    return {
      success: false,
      message: 'Server URL is required',
    };
  }

  if (!apiKey) {
    return {
      success: false,
      message: 'API Key is required',
    };
  }

  try {
    // Test connection based on type
    const axios = (await import('axios')).default;
    const https = (await import('https')).default;

    if (type === 'VideoX') {
      // Test VideoX health endpoint
      const healthUrl = `${serverUrl}/api/system/health`;

      // Configure HTTPS agent if TLS is enabled
      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 5000,
      };

      // If using TLS, disable certificate verification
      if (useTls) {
        axiosConfig.httpsAgent = new https.Agent({
          rejectUnauthorized: false,
        });
      }

      const response = await axios.get(healthUrl, axiosConfig);

      if (response.data && response.data.status) {
        return {
          success: true,
          message: `Connected successfully to VideoX. Server is ${response.data.status}`,
          data: response.data,
        };
      } else {
        return {
          success: false,
          message: 'Unexpected response from VideoX server',
        };
      }
    } else if (type === 'ACS') {
      // ACS implementation to be added later
      return {
        success: false,
        message: 'ACS integration not yet implemented',
      };
    } else if (type === 'Milestone') {
      // Milestone implementation to be added later
      return {
        success: false,
        message: 'Milestone integration not yet implemented',
      };
    } else {
      return {
        success: false,
        message: `Unknown playback type: ${type}`,
      };
    }
  } catch (error) {
    logger.error('Playback connection test failed', { error: error.message, type });

    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        message: `Cannot connect to ${type} server at ${serverUrl}`,
      };
    } else if (error.response?.status === 401) {
      return {
        success: false,
        message: 'Invalid API key',
      };
    } else {
      return {
        success: false,
        message: error.message || 'Connection failed',
      };
    }
  }
}

/**
 * Test MongoDB connection
 * @param {string} connectionString - MongoDB connection string to test
 * @returns {Promise<Object>} - Test result
 */
export async function testMongoConnection(connectionString) {
  let testConnection = null;
  try {
    // Create a test connection
    testConnection = await mongoose.createConnection(connectionString, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      testConnection.once('open', resolve);
      testConnection.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 6000);
    });

    // Close test connection
    await testConnection.close();

    return {
      success: true,
      message: 'Successfully connected to MongoDB',
    };
  } catch (error) {
    if (testConnection) {
      try {
        await testConnection.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
    };
  }
}

/**
 * Get MQTT connection status
 * @returns {Object}
 */
export function getMqttStatus() {
  const client = getMQTTClient();
  return {
    connected: client?.connected || false,
    reconnecting: client?.reconnecting || false,
  };
}

/**
 * Get MongoDB connection status
 * @returns {Object}
 */
export function getMongoStatus() {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    connected: state === 1,
    state: states[state] || 'unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}

/**
 * Get MongoDB configuration
 * @returns {Promise<Object>}
 */
export async function getMongoConfig() {
  try {
    let config = await MongoConfig.findById('mongo-config').lean();
    if (!config) {
      // Create default config from environment
      config = await MongoConfig.create({
        _id: 'mongo-config',
        host: process.env.MONGODB_HOST || 'localhost',
        port: parseInt(process.env.MONGODB_PORT || '27017'),
        database: process.env.MONGODB_DATABASE || 'dataq-analyzer',
        username: process.env.MONGODB_USERNAME || '',
        password: process.env.MONGODB_PASSWORD || '',
        authRequired: process.env.MONGODB_AUTH_REQUIRED === 'true',
      });
    }
    // Don't expose password in response
    const { password, ...safeConfig } = config;
    return { ...safeConfig, hasPassword: !!password };
  } catch (error) {
    logger.error('Failed to get MongoDB config', { error: error.message });
    throw error;
  }
}

/**
 * Update MongoDB configuration
 * @param {Object} updateData - MongoDB config updates
 * @returns {Promise<Object>}
 */
export async function updateMongoConfig(updateData) {
  try {
    const allowedFields = [
      'host',
      'port',
      'database',
      'username',
      'password',
      'authRequired',
      'authSource',
      'ssl',
      'replicaSet',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // Update or create config
    const config = await MongoConfig.findByIdAndUpdate('mongo-config', updates, {
      new: true,
      upsert: true,
      runValidators: true,
    });

    logger.info('MongoDB configuration updated', { host: config.host, port: config.port });

    // Don't expose password in response
    const { password, ...safeConfig } = config.toObject();
    return { ...safeConfig, hasPassword: !!password };
  } catch (error) {
    logger.error('Failed to update MongoDB config', { error: error.message });
    throw error;
  }
}

/**
 * Build MongoDB connection string from config
 * @param {Object} config - MongoDB configuration
 * @returns {string} Connection string
 */
export function buildMongoConnectionString(config) {
  const { host, port, database, username, password, authRequired, authSource, ssl, replicaSet } =
    config;

  let uri;
  if (authRequired && username && password) {
    uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  } else {
    uri = `mongodb://${host}:${port}/${database}`;
  }

  const params = [];
  if (authRequired && authSource) {
    params.push(`authSource=${authSource}`);
  }
  if (ssl) {
    params.push('ssl=true');
  }
  if (replicaSet) {
    params.push(`replicaSet=${replicaSet}`);
  }

  if (params.length > 0) {
    uri += '?' + params.join('&');
  }

  return uri;
}

/**
 * Connect to MongoDB with provided configuration
 * @param {Object} config - MongoDB configuration
 * @returns {Promise<Object>}
 */
export async function connectToMongoDB(config) {
  const { connectDB } = await import('../db/connection.js');

  try {
    const connectionString = buildMongoConnectionString(config);
    const connection = await connectDB(connectionString);

    if (!connection) {
      return { success: false, message: 'Failed to connect to MongoDB' };
    }

    // Save config to database if connection successful
    try {
      await updateMongoConfig(config);
    } catch (configError) {
      logger.warn('Failed to save MongoDB config (connection succeeded)', {
        error: configError.message,
      });
    }

    return { success: true, message: 'Successfully connected to MongoDB' };
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    return { success: false, message: error.message };
  }
}

export default {
  getMqttConfig,
  updateMqttConfig,
  testMqttConnection,
  reconnectMqtt,
  getSystemConfig,
  updateSystemConfig,
  testMongoConnection,
  getMqttStatus,
  getMongoStatus,
  getMongoConfig,
  updateMongoConfig,
  buildMongoConnectionString,
  connectToMongoDB,
};
