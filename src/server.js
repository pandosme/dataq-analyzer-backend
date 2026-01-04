import http from 'http';
import { createApp } from './app.js';
import { connectDB, setupDBEventHandlers } from './db/connection.js';
import { connectMQTT } from './mqtt/client.js';
import { serverConfig, mqttConfig } from './config/index.js';
import logger from './utils/logger.js';
import { Camera } from './models/index.js';
import { setupWebSocketServer } from './websocket/index.js';

/**
 * Migrate existing cameras to add default filters if missing
 */
async function migrateExistingCameras() {
  try {
    const defaultFilters = {
      objectTypes: ['Human', 'Car', 'Truck', 'Bus', 'Bike', 'LicensePlate', 'Head', 'Bag', 'Vehicle', 'Animal', 'Other'],
      minDistance: 20,
      minAge: 2,
    };

    // Find cameras without filters field or with incomplete filters
    const camerasWithoutFilters = await Camera.find({
      $or: [
        { filters: { $exists: false } },
        { 'filters.objectTypes': { $exists: false } },
        { 'filters.minDistance': { $exists: false } },
        { 'filters.minAge': { $exists: false } },
      ],
    });

    if (camerasWithoutFilters.length > 0) {
      logger.info(`Migrating ${camerasWithoutFilters.length} cameras to add default filters`);

      for (const camera of camerasWithoutFilters) {
        camera.filters = camera.filters || {};
        camera.filters.objectTypes = camera.filters.objectTypes || defaultFilters.objectTypes;
        camera.filters.minDistance = camera.filters.minDistance !== undefined ? camera.filters.minDistance : defaultFilters.minDistance;
        camera.filters.minAge = camera.filters.minAge !== undefined ? camera.filters.minAge : defaultFilters.minAge;
        await camera.save();
      }

      logger.info(`Successfully migrated ${camerasWithoutFilters.length} cameras`);
    }
  } catch (error) {
    logger.error('Failed to migrate cameras', { error: error.message });
  }
}

/**
 * Start the application server
 */
async function startServer() {
  try {
    logger.info('Starting DataQ Analyzer application');

    // Setup database event handlers
    setupDBEventHandlers();

    // Connect to MongoDB (don't crash if it fails)
    logger.info('Connecting to MongoDB');
    const dbConnection = await connectDB();
    if (!dbConnection) {
      logger.warn('MongoDB connection failed - application will start but database features will not work');
      logger.warn('Please configure MongoDB connection through the web interface');
    } else {
      // Run database migrations
      await migrateExistingCameras();
    }

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // Setup WebSocket server
    setupWebSocketServer(server);

    // Start HTTP server on all interfaces
    server.listen(serverConfig.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${serverConfig.port} (all interfaces)`, {
        environment: serverConfig.nodeEnv,
        port: serverConfig.port,
      });
    });

    // Connect to MQTT broker
    logger.info('Connecting to MQTT broker');
    try {
      await connectMQTT(mqttConfig);
    } catch (error) {
      logger.warn('Failed to connect to MQTT broker (will continue without MQTT)', {
        error: error.message,
      });
    }

    // Graceful shutdown handler
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Additional cleanup will be handled by DB event handlers
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info('DataQ Analyzer application started successfully');
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start the server
startServer();
