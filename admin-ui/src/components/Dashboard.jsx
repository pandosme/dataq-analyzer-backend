import { useState, useEffect } from 'react';
import { camerasAPI, pathsAPI } from '../services/api';
import './Dashboard.css';

function Dashboard({ inline = false }) {
  const [cameras, setCameras] = useState([]);
  const [recentPaths, setRecentPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    connected: 0,
    disconnected: 0,
  });

  useEffect(() => {
    loadDashboardData();
    // Refresh data every 10 seconds
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const [camerasResponse, pathsResponse] = await Promise.all([
        camerasAPI.getAll(),
        pathsAPI.query({ limit: 10, sort: 'timestamp', order: 'desc' }),
      ]);

      const camerasData = camerasResponse.data || [];
      setCameras(camerasData);

      // Calculate statistics
      const total = camerasData.length;
      const connected = camerasData.filter((cam) => cam.deviceStatus?.connected).length;
      const disconnected = total - connected;

      setStats({ total, connected, disconnected });

      setRecentPaths(pathsResponse.data || []);
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

  const formatUptime = (hours) => {
    if (!hours) return 'N/A';
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
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
                    <th>Address</th>
                    <th>Network</th>
                    <th>CPU</th>
                    <th>Uptime</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.map((camera) => (
                    <tr key={camera._id} className={camera.deviceStatus?.connected ? 'device-connected' : 'device-disconnected'}>
                      <td>
                        <span className={`status-indicator ${camera.deviceStatus?.connected ? 'status-online' : 'status-offline'}`}>
                          {camera.deviceStatus?.connected ? '●' : '○'}
                        </span>
                      </td>
                      <td className="device-name">{camera.name || 'Unnamed'}</td>
                      <td className="device-serial">{camera.serialNumber}</td>
                      <td>
                        <span className="device-type-badge">{camera.cameraType || 'N/A'}</span>
                      </td>
                      <td className="device-address">{camera.deviceStatus?.address || 'N/A'}</td>
                      <td className="device-metric">
                        {camera.deviceStatus?.networkKbps
                          ? `${Math.round(camera.deviceStatus.networkKbps)} Kbps`
                          : 'N/A'}
                      </td>
                      <td className="device-metric">
                        {camera.deviceStatus?.cpuAverage
                          ? `${Math.round(camera.deviceStatus.cpuAverage)}%`
                          : 'N/A'}
                      </td>
                      <td className="device-metric">
                        {formatUptime(camera.deviceStatus?.uptimeHours)}
                      </td>
                      <td className="device-lastseen">
                        {formatTimestamp(camera.deviceStatus?.lastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Path Events */}
        <div className="dashboard-section">
          <h3>Recent Path Events</h3>
          {recentPaths.length === 0 ? (
            <div className="no-data">No recent path events</div>
          ) : (
            <div className="events-list">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Camera</th>
                    <th>Class</th>
                    <th>Tracking ID</th>
                    <th>Age</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPaths.map((path) => (
                    <tr key={path._id}>
                      <td className="event-time">{formatTimestamp(path.timestamp)}</td>
                      <td className="event-camera">
                        {cameras.find((c) => c.serialNumber === path.serial)?.name || path.serial}
                      </td>
                      <td>
                        <span className="class-badge">{path.class}</span>
                      </td>
                      <td className="event-tracking">{path.id}</td>
                      <td className="event-metric">{path.age?.toFixed(1)}s</td>
                      <td className="event-metric">
                        {path.dx && path.dy
                          ? Math.round(Math.sqrt(path.dx * path.dx + path.dy * path.dy))
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
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
