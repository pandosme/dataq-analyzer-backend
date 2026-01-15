import express from 'express';
import camerasRouter from './cameras.js';
import pathsRouter from './paths.js';
import configRouter from './config.js';
import authRouter from './auth.js';
import usersRouter from './users.js';
import { authenticate } from '../middleware/auth.js';
import * as configService from '../services/configService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Auth routes
router.use('/auth', authRouter);

// Public config status endpoint (needed for initial setup check)
router.get('/config/status', (req, res) => {
  try {
    const status = {
      mongodb: configService.getMongoStatus(),
      mqtt: configService.getMqttStatus(),
    };
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Error getting status', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// Public MongoDB test endpoint (needed for initial setup)
router.post('/config/mongodb/test-config', async (req, res) => {
  try {
    const connectionString = configService.buildMongoConnectionString(req.body);
    const result = await configService.testMongoConnection(connectionString);
    res.json({ success: result.success, message: result.message, connectionString });
  } catch (error) {
    logger.error('Error testing MongoDB config', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to test MongoDB configuration' });
  }
});

// Public MongoDB connection endpoint (needed for initial setup)
router.post('/config/mongodb/connect', async (req, res) => {
  try {
    const result = await configService.connectToMongoDB(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error connecting to MongoDB', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to connect to MongoDB' });
  }
});

// API routes (admin UI is password-protected)
router.use('/cameras', camerasRouter);
router.use('/paths', pathsRouter);
router.use('/config', configRouter);

// User routes (requires JWT authentication for client apps)
router.use('/users', authenticate, usersRouter);

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const { getSystemConfig } = await import('../services/configService.js');
    const config = await getSystemConfig();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      playback: {
        enabled: config.playback?.enabled || false,
        type: config.playback?.type || 'None',
        serverUrl: config.playback?.serverUrl || null,
        configured: !!(config.playback?.enabled && config.playback?.serverUrl && config.playback?.apiKey),
      },
    });
  } catch (error) {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      playback: {
        enabled: false,
        type: 'None',
        configured: false,
        error: error.message,
      },
    });
  }
});

export default router;
