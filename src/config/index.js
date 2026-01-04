import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validates that required environment variables are set
 * @param {string[]} required - Array of required env var names
 */
function validateEnv(required) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate required configuration
// MONGODB_URI is optional - if not provided, will be built from components
validateEnv(['PORT', 'JWT_SECRET']);

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
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

/**
 * MQTT configuration (defaults from env, can be overridden by database settings)
 */
export const mqttConfig = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
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
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: 10,
  // Environment-based admin account
  adminUsername: process.env.ADMIN_USERNAME,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
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
