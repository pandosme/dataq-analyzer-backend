import { useState, useEffect } from 'react';
import { configAPI } from '../services/api';
import { useDateFormat } from '../context/DateFormatContext';
import './Settings.css';

function Settings({ onClose, inline = false }) {
  const { updateDateFormat } = useDateFormat();
  const [activeTab, setActiveTab] = useState('mqtt');
  const [status, setStatus] = useState({ mongodb: {}, mqtt: {} });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // MQTT Configuration
  const [mqttConfig, setMqttConfig] = useState({
    brokerUrl: '',
    host: '',
    port: 1883,
    protocol: 'mqtt',
    username: '',
    password: '',
    useTls: false,
    topicPrefix: 'dataq/#',
  });

  // MongoDB Configuration
  const [mongoConfig, setMongoConfig] = useState({
    host: 'localhost',
    port: 27017,
    database: 'dataq-analyzer',
    username: '',
    password: '',
    authRequired: false,
    authSource: 'admin',
    ssl: false,
    replicaSet: '',
  });

  // System Configuration
  const [systemConfig, setSystemConfig] = useState({
    appName: 'DataQ-Management',
    defaultPageSize: 100,
    maxPageSize: 1000,
    dataRetentionDays: 90,
    defaultTimeRangeHours: 24,
    dateFormat: 'US',
    pathVisualization: {
      showStartPoints: true,
      showEndPoints: true,
      pathOpacity: 0.7,
      pathLineWidth: 2,
    },
    playback: {
      enabled: false,
      type: 'None',
      serverUrl: 'http://localhost:3002',
      apiKey: '',
      useTls: false,
      preTime: 5,
      postTime: 5,
    },
  });

  // MongoDB test
  const [mongoConnectionString, setMongoConnectionString] = useState('');
  const [testingMongo, setTestingMongo] = useState(false);
  const [testingMqtt, setTestingMqtt] = useState(false);
  const [testingPlayback, setTestingPlayback] = useState(false);

  useEffect(() => {
    loadConfigurations();
    loadStatus();
  }, []);

  const loadConfigurations = async () => {
    try {
      const [mqttRes, mongoRes, systemRes] = await Promise.all([
        configAPI.getMqttConfig(),
        configAPI.getMongoConfig(),
        configAPI.getSystemConfig(),
      ]);

      if (mqttRes.success) {
        setMqttConfig(mqttRes.data);
      }

      if (mongoRes.success) {
        setMongoConfig(mongoRes.data);
      }

      if (systemRes.success) {
        // Ensure playback config exists with defaults (support legacy videox field)
        const legacyVideox = systemRes.data.videox;
        const playbackData = systemRes.data.playback || legacyVideox;

        // Determine type based on enabled state
        let playbackType = playbackData?.type || 'VideoX';
        if (!playbackData?.enabled && !playbackData?.type) {
          playbackType = 'None';
        }

        const loadedConfig = {
          ...systemRes.data,
          playback: {
            enabled: playbackData?.enabled || false,
            type: playbackType,
            serverUrl: playbackData?.serverUrl || 'http://localhost:3002',
            apiKey: playbackData?.apiKey || '',
            useTls: playbackData?.useTls || false,
            preTime: playbackData?.preTime || 5,
            postTime: playbackData?.postTime || 5,
          },
        };
        setSystemConfig(loadedConfig);
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
      showMessage('error', 'Failed to load configurations');
    }
  };

  const loadStatus = async () => {
    try {
      const response = await configAPI.getStatus();
      if (response.success) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleMqttChange = (field, value) => {
    setMqttConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleMongoChange = (field, value) => {
    setMongoConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSystemChange = (field, value) => {
    if (field.includes('.')) {
      const parts = field.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        setSystemConfig((prev) => ({
          ...prev,
          [parent]: { ...(prev[parent] || {}), [child]: value },
        }));
      } else if (parts.length === 3) {
        const [parent, middle, child] = parts;
        setSystemConfig((prev) => ({
          ...prev,
          [parent]: {
            ...(prev[parent] || {}),
            [middle]: { ...(prev[parent]?.[middle] || {}), [child]: value },
          },
        }));
      }
    } else {
      setSystemConfig((prev) => ({ ...prev, [field]: value }));
    }
  };

  const testMqttConnection = async () => {
    setTestingMqtt(true);
    try {
      const result = await configAPI.testMqttConnection({
        brokerUrl: mqttConfig.brokerUrl,
        username: mqttConfig.username,
        password: mqttConfig.password,
      });
      showMessage(result.success ? 'success' : 'error', result.message);
    } catch (error) {
      showMessage('error', 'Failed to test MQTT connection');
    } finally {
      setTestingMqtt(false);
    }
  };

  const saveMqttConfig = async () => {
    setLoading(true);
    try {
      const result = await configAPI.updateMqttConfig(mqttConfig);
      if (result.success) {
        showMessage('success', 'MQTT configuration saved successfully');
        // Optionally reconnect
        const reconnect = window.confirm(
          'Configuration saved. Do you want to reconnect with the new settings?'
        );
        if (reconnect) {
          await reconnectMqtt();
        }
      }
    } catch (error) {
      showMessage('error', 'Failed to save MQTT configuration');
    } finally {
      setLoading(false);
    }
  };

  const reconnectMqtt = async () => {
    setLoading(true);
    try {
      const result = await configAPI.reconnectMqtt();
      showMessage(result.success ? 'success' : 'error', result.message);
      if (result.success) {
        await loadStatus();
      }
    } catch (error) {
      showMessage('error', 'Failed to reconnect MQTT');
    } finally {
      setLoading(false);
    }
  };

  const saveMongoConfig = async () => {
    setLoading(true);
    try {
      const result = await configAPI.updateMongoConfig(mongoConfig);
      if (result.success) {
        showMessage('success', 'MongoDB configuration saved successfully');
        showMessage('info', 'Note: Restart the application to apply MongoDB connection changes');
      }
    } catch (error) {
      showMessage('error', 'Failed to save MongoDB configuration');
    } finally {
      setLoading(false);
    }
  };

  const testMongoConfigConnection = async () => {
    setTestingMongo(true);
    try {
      const result = await configAPI.testMongoConfig(mongoConfig);
      showMessage(result.success ? 'success' : 'error', result.message);
    } catch (error) {
      showMessage('error', 'Failed to test MongoDB configuration');
    } finally {
      setTestingMongo(false);
    }
  };

  const testMongoConnection = async () => {
    if (!mongoConnectionString) {
      showMessage('error', 'Please enter a MongoDB connection string');
      return;
    }

    setTestingMongo(true);
    try {
      const result = await configAPI.testMongoConnection(mongoConnectionString);
      showMessage(result.success ? 'success' : 'error', result.message);
    } catch (error) {
      showMessage('error', 'Failed to test MongoDB connection');
    } finally {
      setTestingMongo(false);
    }
  };

  const testPlaybackConnection = async () => {
    setTestingPlayback(true);
    try {
      const result = await configAPI.testPlaybackConnection(
        systemConfig.playback?.type || 'VideoX',
        systemConfig.playback?.serverUrl || '',
        systemConfig.playback?.apiKey || '',
        systemConfig.playback?.useTls || false
      );
      showMessage(result.success ? 'success' : 'error', result.message);
    } catch (error) {
      showMessage('error', 'Failed to test playback connection');
    } finally {
      setTestingPlayback(false);
    }
  };

  const saveSystemConfig = async () => {
    setLoading(true);
    try {
      const result = await configAPI.updateSystemConfig(systemConfig);
      if (result.success) {
        // Update date format context if it changed
        if (systemConfig.dateFormat) {
          await updateDateFormat(systemConfig.dateFormat);
        }
        showMessage('success', 'System configuration saved successfully');
      }
    } catch (error) {
      showMessage('error', 'Failed to save system configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={inline ? 'settings-inline' : 'settings-overlay'}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Settings & Configuration</h2>
          {!inline && onClose && (
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        {message.text && (
          <div className={`message message-${message.type}`}>{message.text}</div>
        )}

        <div className="settings-tabs">
          <button
            className={activeTab === 'mqtt' ? 'active' : ''}
            onClick={() => setActiveTab('mqtt')}
          >
            MQTT Connection
          </button>
          <button
            className={activeTab === 'mongodb' ? 'active' : ''}
            onClick={() => setActiveTab('mongodb')}
          >
            MongoDB Connection
          </button>
          <button
            className={activeTab === 'playback' ? 'active' : ''}
            onClick={() => setActiveTab('playback')}
          >
            Playback
          </button>
          <button
            className={activeTab === 'system' ? 'active' : ''}
            onClick={() => setActiveTab('system')}
          >
            System Settings
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'mqtt' && (
            <div className="config-section">
              <h3>MQTT Broker Configuration</h3>

              <div className="status-indicator">
                <span className="label">Connection Status:</span>
                <span className={`status ${status.mqtt.connected ? 'connected' : 'disconnected'}`}>
                  {status.mqtt.connected ? '● Connected' : '○ Disconnected'}
                </span>
              </div>

              <div className="form-group">
                <label>Broker URL</label>
                <input
                  type="text"
                  value={mqttConfig.brokerUrl}
                  onChange={(e) => handleMqttChange('brokerUrl', e.target.value)}
                  placeholder="mqtt://localhost:1883"
                />
                <small>Full broker URL (e.g., mqtt://broker.example.com:1883)</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Host</label>
                  <input
                    type="text"
                    value={mqttConfig.host}
                    onChange={(e) => handleMqttChange('host', e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="number"
                    value={mqttConfig.port}
                    onChange={(e) => handleMqttChange('port', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Protocol</label>
                  <select
                    value={mqttConfig.protocol}
                    onChange={(e) => handleMqttChange('protocol', e.target.value)}
                  >
                    <option value="mqtt">MQTT</option>
                    <option value="mqtts">MQTTS (TLS)</option>
                    <option value="ws">WebSocket</option>
                    <option value="wss">WebSocket Secure</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={mqttConfig.useTls}
                      onChange={(e) => handleMqttChange('useTls', e.target.checked)}
                    />
                    Use TLS
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Username (optional)</label>
                <input
                  type="text"
                  value={mqttConfig.username}
                  onChange={(e) => handleMqttChange('username', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Password (optional)</label>
                <input
                  type="password"
                  value={mqttConfig.password}
                  onChange={(e) => handleMqttChange('password', e.target.value)}
                  placeholder={mqttConfig.hasPassword ? '••••••••' : ''}
                />
              </div>

              <div className="form-group">
                <label>Topic Prefix</label>
                <input
                  type="text"
                  value={mqttConfig.topicPrefix}
                  onChange={(e) => handleMqttChange('topicPrefix', e.target.value)}
                  placeholder="dataq/#"
                />
                <small>MQTT topic pattern to subscribe to</small>
              </div>

              <div className="form-actions">
                <button onClick={testMqttConnection} disabled={testingMqtt} className="btn-test">
                  {testingMqtt ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={saveMqttConfig} disabled={loading} className="btn-primary">
                  Save Configuration
                </button>
              </div>
            </div>
          )}

          {activeTab === 'mongodb' && (
            <div className="config-section">
              <h3>MongoDB Connection Configuration</h3>

              <div className="status-indicator">
                <span className="label">Connection Status:</span>
                <span
                  className={`status ${status.mongodb.connected ? 'connected' : 'disconnected'}`}
                >
                  {status.mongodb.connected ? '● Connected' : '○ Disconnected'}
                </span>
                {status.mongodb.connected && (
                  <small>
                    Connected to: {status.mongodb.host}/{status.mongodb.name}
                  </small>
                )}
              </div>

              <div className="info-box">
                <p>
                  <strong>Note:</strong> Changes to MongoDB configuration require restarting the application to take effect.
                </p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Host</label>
                  <input
                    type="text"
                    value={mongoConfig.host}
                    onChange={(e) => handleMongoChange('host', e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="number"
                    value={mongoConfig.port}
                    onChange={(e) => handleMongoChange('port', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Database Name</label>
                <input
                  type="text"
                  value={mongoConfig.database}
                  onChange={(e) => handleMongoChange('database', e.target.value)}
                  placeholder="dataq-analyzer"
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={mongoConfig.authRequired}
                    onChange={(e) => handleMongoChange('authRequired', e.target.checked)}
                  />
                  Authentication Required
                </label>
              </div>

              {mongoConfig.authRequired && (
                <>
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={mongoConfig.username}
                      onChange={(e) => handleMongoChange('username', e.target.value)}
                      placeholder="admin"
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={mongoConfig.password}
                      onChange={(e) => handleMongoChange('password', e.target.value)}
                      placeholder={mongoConfig.hasPassword ? '••••••••' : ''}
                    />
                  </div>

                  <div className="form-group">
                    <label>Auth Source</label>
                    <input
                      type="text"
                      value={mongoConfig.authSource}
                      onChange={(e) => handleMongoChange('authSource', e.target.value)}
                      placeholder="admin"
                    />
                    <small>Database name for authentication (usually 'admin')</small>
                  </div>
                </>
              )}

              <h4>Advanced Options</h4>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={mongoConfig.ssl}
                    onChange={(e) => handleMongoChange('ssl', e.target.checked)}
                  />
                  Use SSL/TLS
                </label>
              </div>

              <div className="form-group">
                <label>Replica Set (optional)</label>
                <input
                  type="text"
                  value={mongoConfig.replicaSet}
                  onChange={(e) => handleMongoChange('replicaSet', e.target.value)}
                  placeholder="Leave empty if not using replica set"
                />
              </div>

              <div className="form-actions">
                <button onClick={testMongoConfigConnection} disabled={testingMongo} className="btn-test">
                  {testingMongo ? 'Testing...' : 'Test Configuration'}
                </button>
                <button onClick={saveMongoConfig} disabled={loading} className="btn-primary">
                  Save Configuration
                </button>
              </div>

              <hr style={{ margin: '2rem 0' }} />
              <h4>Test Custom Connection String</h4>
              <div className="form-group">
                <label>Connection String</label>
                <input
                  type="text"
                  value={mongoConnectionString}
                  onChange={(e) => setMongoConnectionString(e.target.value)}
                  placeholder="mongodb://username:password@host:port/database"
                />
                <small>Test any MongoDB connection string</small>
              </div>

              <div className="form-actions">
                <button onClick={testMongoConnection} disabled={testingMongo} className="btn-test">
                  {testingMongo ? 'Testing...' : 'Test Connection String'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'playback' && systemConfig.playback && (
            <div className="config-section">
              <div className="form-group">
                <label>Recording Service</label>
                <select
                  value={systemConfig.playback?.type || 'None'}
                  onChange={(e) => {
                    const newType = e.target.value;
                    handleSystemChange('playback.type', newType);
                    // Auto-enable/disable based on selection
                    handleSystemChange('playback.enabled', newType !== 'None');
                  }}
                >
                  <option value="None">None</option>
                  <option value="VideoX">VideoX</option>
                  <option value="ACS" disabled>ACS</option>
                  <option value="Milestone" disabled>Milestone</option>
                </select>
              </div>

              {systemConfig.playback?.type === 'VideoX' && (
                <>
                  <div className="form-row playback-url-row">
                    <div className="form-group url-group">
                      <label>Server URL</label>
                      <input
                        type="text"
                        value={systemConfig.playback?.serverUrl || ''}
                        onChange={(e) => handleSystemChange('playback.serverUrl', e.target.value)}
                        placeholder="http://localhost:3002"
                      />
                    </div>

                    <div className="form-group tls-group">
                      <label className="checkbox-label-tls">
                        <input
                          type="checkbox"
                          checked={systemConfig.playback?.useTls || false}
                          onChange={(e) => handleSystemChange('playback.useTls', e.target.checked)}
                        />
                        <span>Use TLS</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={systemConfig.playback?.apiKey || ''}
                      onChange={(e) => handleSystemChange('playback.apiKey', e.target.value)}
                      placeholder="API token or credentials"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Pre-Buffer Time (seconds)</label>
                      <input
                        type="number"
                        value={systemConfig.playback?.preTime || 5}
                        onChange={(e) => handleSystemChange('playback.preTime', parseInt(e.target.value) || 0)}
                        min="0"
                        max="60"
                        placeholder="5"
                      />
                      <small className="form-hint">Seconds of video before the event</small>
                    </div>

                    <div className="form-group">
                      <label>Post-Buffer Time (seconds)</label>
                      <input
                        type="number"
                        value={systemConfig.playback?.postTime || 5}
                        onChange={(e) => handleSystemChange('playback.postTime', parseInt(e.target.value) || 0)}
                        min="0"
                        max="60"
                        placeholder="5"
                      />
                      <small className="form-hint">Seconds of video after the event</small>
                    </div>
                  </div>
                </>
              )}

              <div className="form-actions">
                <button
                  onClick={testPlaybackConnection}
                  disabled={testingPlayback || systemConfig.playback?.type === 'None'}
                  className="btn-test"
                >
                  {testingPlayback ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={saveSystemConfig} disabled={loading} className="btn-primary">
                  Save Configuration
                </button>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="config-section">
              <h3>System Configuration</h3>

              <div className="form-group">
                <label>Application Name</label>
                <input
                  type="text"
                  value={systemConfig.appName}
                  onChange={(e) => handleSystemChange('appName', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Data Retention (days)</label>
                <input
                  type="number"
                  value={systemConfig.dataRetentionDays}
                  onChange={(e) =>
                    handleSystemChange('dataRetentionDays', parseInt(e.target.value))
                  }
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Date/Time Format</label>
                <select
                  value={systemConfig.dateFormat}
                  onChange={(e) => handleSystemChange('dateFormat', e.target.value)}
                >
                  <option value="US">US Format (DD/MM/YYYY hh:MM:ss AM/PM)</option>
                  <option value="ISO">ISO Format (YYYY-MM-DD HH:MM:SS)</option>
                </select>
              </div>

              <h4>Path Visualization</h4>

              <div className="form-group">
                <label>Path Line Width</label>
                <select
                  value={systemConfig.pathVisualization.pathLineWidth}
                  onChange={(e) =>
                    handleSystemChange('pathVisualization.pathLineWidth', parseInt(e.target.value))
                  }
                >
                  <option value="1">1 pixel</option>
                  <option value="2">2 pixels</option>
                  <option value="3">3 pixels</option>
                  <option value="4">4 pixels</option>
                  <option value="5">5 pixels</option>
                </select>
              </div>

              <div className="form-actions">
                <button onClick={saveSystemConfig} disabled={loading} className="btn-primary">
                  Save Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
