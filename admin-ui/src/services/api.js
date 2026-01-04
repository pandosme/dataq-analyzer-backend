import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on 401 (let components handle the redirect)
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
    return Promise.reject(error);
  }
);

// Cameras API
export const camerasAPI = {
  getAll: async (enabledOnly = false) => {
    const response = await api.get('/cameras', { params: { enabled: enabledOnly } });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/cameras/${id}`);
    return response.data;
  },

  create: async (cameraData) => {
    const response = await api.post('/cameras', cameraData);
    return response.data;
  },

  update: async (id, cameraData) => {
    const response = await api.put(`/cameras/${id}`, cameraData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/cameras/${id}`);
    return response.data;
  },

  getSnapshot: async (serialNumber) => {
    const response = await api.get(`/cameras/${serialNumber}/snapshot`);
    return response.data;
  },

  refreshSnapshot: async (id) => {
    const response = await api.post(`/cameras/${id}/refresh-snapshot`);
    return response.data;
  },

  fetchDeviceInfo: async (ipAddress, username, password) => {
    const response = await api.post('/cameras/fetch-device-info', {
      ipAddress,
      username,
      password,
    });
    return response.data;
  },
};

// Path Events API
export const pathsAPI = {
  query: async (filters) => {
    const response = await api.get('/paths', { params: filters });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/paths/${id}`);
    return response.data;
  },

  getStats: async (serialNumber, filters) => {
    const response = await api.get(`/paths/stats/${serialNumber}`, {
      params: filters,
    });
    return response.data;
  },
};

// Authentication API
export const authAPI = {
  // Check if setup is required (no users exist)
  checkSetup: async () => {
    const response = await api.get('/auth/setup-check');
    return response.data;
  },

  // Create initial admin user
  setup: async (userData) => {
    const response = await api.post('/auth/setup', userData);
    return response.data;
  },

  // Login
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Get current user
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Get all users (admin only)
  getAllUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },

  // Get user by ID
  getUserById: async (id) => {
    const response = await api.get(`/auth/users/${id}`);
    return response.data;
  },

  // Create new user (admin only)
  createUser: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Update user (admin only)
  updateUser: async (id, userData) => {
    const response = await api.put(`/auth/users/${id}`, userData);
    return response.data;
  },

  // Delete user (admin only)
  deleteUser: async (id) => {
    const response = await api.delete(`/auth/users/${id}`);
    return response.data;
  },
};

// Configuration API
export const configAPI = {
  // Get connection status
  getStatus: async () => {
    const response = await api.get('/config/status');
    return response.data;
  },

  // MQTT Configuration
  getMqttConfig: async () => {
    const response = await api.get('/config/mqtt');
    return response.data;
  },

  updateMqttConfig: async (config) => {
    const response = await api.put('/config/mqtt', config);
    return response.data;
  },

  testMqttConnection: async (config) => {
    const response = await api.post('/config/mqtt/test', config);
    return response.data;
  },

  reconnectMqtt: async () => {
    const response = await api.post('/config/mqtt/reconnect');
    return response.data;
  },

  // System Configuration
  getSystemConfig: async () => {
    const response = await api.get('/config/system');
    return response.data;
  },

  updateSystemConfig: async (config) => {
    const response = await api.put('/config/system', config);
    return response.data;
  },

  // MongoDB Configuration
  getMongoConfig: async () => {
    const response = await api.get('/config/mongodb');
    return response.data;
  },

  updateMongoConfig: async (config) => {
    const response = await api.put('/config/mongodb', config);
    return response.data;
  },

  testMongoConnection: async (connectionString) => {
    const response = await api.post('/config/mongodb/test', { connectionString });
    return response.data;
  },

  testMongoConfig: async (config) => {
    const response = await api.post('/config/mongodb/test-config', config);
    return response.data;
  },

  // Playback Configuration
  testPlaybackConnection: async (type, serverUrl, apiKey, useTls) => {
    const response = await api.post('/config/playback/test', { type, serverUrl, apiKey, useTls });
    return response.data;
  },
};

// Playback API
export const playbackAPI = {
  // Get video URL for a path event
  getVideoUrl: (playbackConfig, pathEvent) => {
    if (!playbackConfig || !playbackConfig.enabled || !playbackConfig.serverUrl || !playbackConfig.apiKey) {
      return null;
    }

    if (!pathEvent || !pathEvent.serialNumber || !pathEvent.timestamp || !pathEvent.age) {
      return null;
    }

    const { type, serverUrl, apiKey, preTime, postTime } = playbackConfig;

    // Currently only VideoX is implemented
    if (type === 'VideoX') {
      const eventDate = new Date(pathEvent.timestamp);
      const startTime = Math.floor(eventDate.getTime() / 1000) - (preTime || 5);
      const duration = Math.ceil(pathEvent.age) + (preTime || 5) + (postTime || 5);

      // Note: API key must be included in URL since <video> element cannot send Authorization headers
      // The VideoX server must support token authentication via query parameter or URL-based auth
      const url = `${serverUrl}/api/recordings/export-clip?cameraId=${pathEvent.serialNumber}&startTime=${startTime}&duration=${duration}&token=${apiKey}`;

      return {
        url,
        startTime,
        duration,
        apiKey,
        type,
      };
    } else if (type === 'ACS') {
      // ACS implementation to be added later
      return null;
    } else if (type === 'Milestone') {
      // Milestone implementation to be added later
      return null;
    }

    return null;
  },

  // Get download URL for a path event
  getDownloadUrl: (playbackConfig, pathEvent) => {
    const videoInfo = playbackAPI.getVideoUrl(playbackConfig, pathEvent);
    if (!videoInfo) return null;

    // Currently only VideoX supports downloads
    // The export-clip endpoint can be used for both streaming and downloading
    if (playbackConfig.type === 'VideoX') {
      return videoInfo.url;
    }

    return null;
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
