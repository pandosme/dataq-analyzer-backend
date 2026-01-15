import { useState, useEffect } from 'react';
import { camerasAPI } from '../services/api';
import './Dashboard.css';

function Dashboard({ inline = false }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    connected: 0,
    disconnected: 0,
  });

  // Camera is considered connected if any MQTT message has been received (lastSeen exists)
  const isConnected = (camera) => {
    return !!camera.deviceStatus?.lastSeen;
  };

  useEffect(() => {
    loadDashboardData();
    // Refresh data every 10 seconds
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const camerasResponse = await camerasAPI.getAll();

      const camerasData = camerasResponse.data || [];
      setCameras(camerasData);

      // Calculate statistics based on lastSeen
      const total = camerasData.length;
      const connected = camerasData.filter((cam) => isConnected(cam)).length;
      const disconnected = total - connected;

      setStats({ total, connected, disconnected });
    } catch (err) {
      setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className={inline ? 'dashboard-inline' : 'dashboard-modal'}>
        <div className="dashboard-content">
          <div className="loading">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? 'dashboard-inline' : 'dashboard-modal'}>
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Dashboard</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Statistics Cards */}
        <div className="dashboard-stats">
          <div className="stat-card stat-total">
            <div className="stat-icon">📊</div>
            <div className="stat-details">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Devices</div>
            </div>
          </div>

          <div className="stat-card stat-connected">
            <div className="stat-icon">✓</div>
            <div className="stat-details">
              <div className="stat-value">{stats.connected}</div>
              <div className="stat-label">Connected</div>
            </div>
          </div>

          <div className="stat-card stat-disconnected">
            <div className="stat-icon">✗</div>
            <div className="stat-details">
              <div className="stat-value">{stats.disconnected}</div>
              <div className="stat-label">Disconnected</div>
            </div>
          </div>
        </div>

        {/* Device List */}
        <div className="dashboard-section">
          <h3>Device Status</h3>
          {cameras.length === 0 ? (
            <div className="no-data">No devices configured</div>
          ) : (
            <div className="device-list">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Name</th>
                    <th>Serial Number</th>
                    <th>Type</th>
                    <th>Model</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.map((camera) => {
                    const connected = isConnected(camera);
                    return (
                      <tr key={camera._id} className={connected ? 'device-connected' : 'device-disconnected'}>
                        <td>
                          <span className={`status-indicator ${connected ? 'status-online' : 'status-offline'}`}>
                            {connected ? '●' : '○'}
                          </span>
                        </td>
                        <td className="device-name">{camera.name || 'Unnamed'}</td>
                        <td className="device-serial">{camera.serialNumber}</td>
                        <td>
                          <span className="device-type-badge">{camera.cameraType || 'N/A'}</span>
                        </td>
                        <td className="device-model">
                          {camera.model || 'N/A'}
                        </td>
                        <td className="device-lastseen">
                          {formatTimestamp(camera.deviceStatus?.lastSeen)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
