import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

/**
 * Build MongoDB URI from environment variables
 * @returns {string} MongoDB connection URI
 */
function buildMongoUri() {
  // If MONGODB_URI is provided, use it directly
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb')) {
    return process.env.MONGODB_URI;
  }

  // Build URI from components
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const database = process.env.MONGODB_DATABASE || 'dataq-analyzer';
  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;
  const authRequired = process.env.MONGODB_AUTH_REQUIRED === 'true';

  // Build connection string with or without credentials
  if (authRequired && username && password) {
    return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=admin`;
  } else {
    return `mongodb://${host}:${port}/${database}`;
  }
}

/**
 * Generate or retrieve JWT secret
 * Auto-generates if not provided via environment
 */
function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  // Auto-generate (tokens invalidate on restart, which is acceptable)
  const secret = crypto.randomBytes(64).toString('hex');
  console.log('JWT_SECRET not set — auto-generated (tokens will reset on container restart)');
  return secret;
}

/**
 * Database configuration
 */
export const dbConfig = {
  uri: buildMongoUri(),
  host: process.env.MONGODB_HOST || 'localhost',
  port: process.env.MONGODB_PORT || '27017',
  database: process.env.MONGODB_DATABASE || 'dataq-analyzer',
  username: process.env.MONGODB_USERNAME || '',
  password: process.env.MONGODB_PASSWORD || '',
  authRequired: process.env.MONGODB_AUTH_REQUIRED === 'true',
  options: {
    // Mongoose options
  },
};

/**
 * Server configuration
 */
export const serverConfig = {
  port: parseInt(process.env.PORT, 10) || 80,
  nodeEnv: process.env.NODE_ENV || 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};

/**
 * MQTT configuration (defaults from env, can be overridden by database settings)
 */
export const mqttConfig = {
  brokerUrl: process.env.MQTT_BROKER_URL || '',
  username: process.env.MQTT_USERNAME || null,
  password: process.env.MQTT_PASSWORD || null,
  useTls: process.env.MQTT_USE_TLS === 'true',
  topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'dataq/#',
  clientId: `dataq-analyzer-${Math.random().toString(16).substr(2, 8)}`,
};

/**
 * Authentication configuration
 */
export const authConfig = {
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  viewerUsername: process.env.VIEWER_USERNAME || '',
  viewerPassword: process.env.VIEWER_PASSWORD || '',
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

/**
 * Application settings
 */
export const appConfig = {
  // Coordinate system normalization (DataQ uses 0-1000 range)
  coordinateMax: 1000,
  // Default query limits
  defaultPageSize: 100,
  maxPageSize: 1000,
};

export default {
  db: dbConfig,
  server: serverConfig,
  mqtt: mqttConfig,
  auth: authConfig,
  app: appConfig,
};
