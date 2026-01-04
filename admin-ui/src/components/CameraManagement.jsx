import { useState, useEffect } from 'react';
import { camerasAPI } from '../services/api';
import './CameraManagement.css';

function CameraManagement({ onClose, inline = false }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCamera, setEditingCamera] = useState(null);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [formData, setFormData] = useState({
    cameraType: '', // Start with no selection
    name: '',
    location: '',
    serialNumber: '',
    ipAddress: '',
    username: '',
    password: '',
    useTLS: false,
    mqttTopic: '',
    enabled: true,
    filters: {
      objectTypes: ['Person', 'Car', 'Bike', 'Truck', 'Bus'],
      minDistance: 20,
      minAge: 2,
    },
  });

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await camerasAPI.getAll(false);
      setCameras(response.data || []);
    } catch (err) {
      setError('Failed to load cameras: ' + (err.response?.data?.error || err.message));
      console.error('Error loading cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => {
      // Handle filter fields separately
      if (name.startsWith('filter.')) {
        const filterField = name.split('.')[1];
        return {
          ...prev,
          filters: {
            ...prev.filters,
            [filterField]: type === 'number' ? parseFloat(value) : value,
          },
        };
      }

      const updates = { [name]: newValue };

      // Auto-populate MQTT topic when serial number changes (for remote cameras)
      if (name === 'serialNumber' && value && formData.cameraType === 'remote' && !prev.mqttTopic) {
        updates.mqttTopic = `dataq/path/${value.toUpperCase()}`;
      }

      return { ...prev, ...updates };
    });
  };

  const handleObjectTypeChange = (objectType) => {
    setFormData((prev) => {
      const currentTypes = prev.filters.objectTypes || [];
      const newTypes = currentTypes.includes(objectType)
        ? currentTypes.filter((t) => t !== objectType)
        : [...currentTypes, objectType];

      return {
        ...prev,
        filters: {
          ...prev.filters,
          objectTypes: newTypes,
        },
      };
    });
  };

  const handleConnect = async () => {
    if (!formData.ipAddress || !formData.username || !formData.password) {
      setError('Please fill in all connection fields');
      return;
    }

    try {
      setError(null);
      setConnecting(true);

      // Fetch device info from camera
      const response = await camerasAPI.fetchDeviceInfo(
        formData.ipAddress,
        formData.username,
        formData.password
      );

      if (response.success && response.data) {
        const { serialNumber, productName } = response.data;

        // Auto-populate fields
        setFormData((prev) => ({
          ...prev,
          serialNumber: serialNumber || '',
          mqttTopic: `dataq/path/${serialNumber || ''}`,
          name: prev.name || productName || '',
        }));

        setConnected(true);
        setError(null);
      } else {
        setError('Failed to fetch device information');
      }
    } catch (err) {
      setError('Connection failed: ' + (err.response?.data?.error || err.message));
      console.error('Error connecting to camera:', err);
    } finally {
      setConnecting(false);
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      await camerasAPI.create(formData);
      setShowAddCamera(false);
      resetForm();
      await loadCameras();
    } catch (err) {
      setError('Failed to create camera: ' + (err.response?.data?.error || err.message));
      console.error('Error creating camera:', err);
    }
  };

  const handleEditCamera = (camera) => {
    setEditingCamera(camera._id);
    setFormData({
      cameraType: camera.cameraType || 'remote',
      name: camera.name || '',
      location: camera.location || '',
      serialNumber: camera.serialNumber || '',
      ipAddress: camera.ipAddress || '',
      username: camera.username || '',
      password: '', // Don't populate password for security
      useTLS: camera.useTLS || false,
      mqttTopic: camera.mqttTopic || '',
      enabled: camera.enabled !== false,
      filters: {
        objectTypes: camera.filters?.objectTypes || ['Person', 'Car', 'Bike', 'Truck', 'Bus'],
        minDistance: camera.filters?.minDistance !== undefined ? camera.filters.minDistance : 20,
        minAge: camera.filters?.minAge !== undefined ? camera.filters.minAge : 2,
      },
    });
    setConnected(camera.cameraType === 'local'); // If editing local camera, consider it "connected"
  };

  const handleUpdateCamera = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      await camerasAPI.update(editingCamera, formData);
      setEditingCamera(null);
      resetForm();
      await loadCameras();
    } catch (err) {
      setError('Failed to update camera: ' + (err.response?.data?.error || err.message));
      console.error('Error updating camera:', err);
    }
  };

  const handleDeleteCamera = async (cameraId) => {
    if (!confirm('Are you sure you want to delete this camera?')) {
      return;
    }
    try {
      setError(null);
      await camerasAPI.delete(cameraId);
      await loadCameras();
    } catch (err) {
      setError('Failed to delete camera: ' + (err.response?.data?.error || err.message));
      console.error('Error deleting camera:', err);
    }
  };

  const handleRefreshSnapshot = async (cameraId) => {
    try {
      setError(null);
      setRefreshingSnapshot(cameraId);
      await camerasAPI.refreshSnapshot(cameraId);
      await loadCameras();
    } catch (err) {
      setError('Failed to refresh snapshot: ' + (err.response?.data?.error || err.message));
      console.error('Error refreshing snapshot:', err);
    } finally {
      setRefreshingSnapshot(null);
    }
  };

  const cancelEdit = () => {
    setEditingCamera(null);
    setShowAddCamera(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      cameraType: '',
      name: '',
      location: '',
      serialNumber: '',
      ipAddress: '',
      username: '',
      password: '',
      useTLS: false,
      mqttTopic: '',
      enabled: true,
      filters: {
        objectTypes: ['Person', 'Car', 'Bike', 'Truck', 'Bus'],
        minDistance: 20,
        minAge: 2,
      },
    });
    setConnected(false);
    setConnecting(false);
  };

  if (loading) {
    return (
      <div className={inline ? 'camera-management-inline' : 'camera-management-modal'}>
        <div className="camera-management-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? 'camera-management-inline' : 'camera-management-modal'}>
      <div className="camera-management-content">
        <div className="camera-management-header">
          <h2>Camera Management</h2>
          {!inline && onClose && (
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {!showAddCamera && !editingCamera && (
          <>
            <div className="camera-management-actions">
              <button className="btn-primary" onClick={() => setShowAddCamera(true)}>
                + Add New Camera
              </button>
            </div>

            <div className="cameras-list">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Serial Number</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="no-data">
                        No cameras found
                      </td>
                    </tr>
                  ) : (
                    cameras.map((camera) => (
                      <tr key={camera._id}>
                        <td>{camera.name}</td>
                        <td className="serial-number">{camera.serialNumber}</td>
                        <td>
                          <span className={`type-badge type-${camera.cameraType || 'remote'}`}>
                            {camera.cameraType === 'local' ? 'Local' : 'Remote'}
                          </span>
                        </td>
                        <td>{camera.location || '-'}</td>
                        <td>
                          <span className={`status-badge status-${camera.enabled ? 'enabled' : 'disabled'}`}>
                            {camera.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="actions">
                          {camera.cameraType === 'local' && (
                            <button
                              className="btn-refresh"
                              onClick={() => handleRefreshSnapshot(camera._id)}
                              disabled={refreshingSnapshot === camera._id}
                            >
                              {refreshingSnapshot === camera._id ? 'Refreshing...' : 'Refresh Image'}
                            </button>
                          )}
                          <button className="btn-edit" onClick={() => handleEditCamera(camera)}>
                            Edit
                          </button>
                          <button className="btn-delete" onClick={() => handleDeleteCamera(camera._id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(showAddCamera || editingCamera) && (
          <div className="camera-form">
            <h3>{editingCamera ? 'Edit Camera' : 'Add New Camera'}</h3>
            <form onSubmit={editingCamera ? handleUpdateCamera : handleAddCamera}>
              {/* Connection Type Selection */}
              <div className="form-group">
                <label htmlFor="cameraType">Connection Type *</label>
                <select
                  id="cameraType"
                  name="cameraType"
                  value={formData.cameraType}
                  onChange={handleInputChange}
                  required
                  disabled={editingCamera} // Can't change type when editing
                >
                  <option value="">-- Select Connection Type --</option>
                  <option value="local">Local (VAPIX access)</option>
                  <option value="remote">Remote (MQTT only)</option>
                </select>
              </div>

              {/* Show fields only after connection type is selected */}
              {formData.cameraType && (
                <>
                  {/* Local Camera Fields */}
                  {formData.cameraType === 'local' && (
                    <>
                      <div className="form-group">
                        <label htmlFor="name">Camera Name *</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          placeholder="e.g., Main Entrance"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="location">Location</label>
                        <input
                          type="text"
                          id="location"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          placeholder="e.g., Building A, Floor 1"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="ipAddress">IP Address *</label>
                        <input
                          type="text"
                          id="ipAddress"
                          name="ipAddress"
                          value={formData.ipAddress}
                          onChange={handleInputChange}
                          required
                          placeholder="e.g., 192.168.1.100"
                          disabled={connected && !editingCamera}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="username">Username *</label>
                        <input
                          type="text"
                          id="username"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          required
                          placeholder="Camera username"
                          disabled={connected && !editingCamera}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="password">
                          Password {editingCamera ? '(leave empty to keep current)' : '*'}
                        </label>
                        <input
                          type="password"
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required={!editingCamera && !connected}
                          placeholder="Camera password"
                          disabled={connected && !editingCamera}
                        />
                      </div>

                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="useTLS"
                            checked={formData.useTLS}
                            onChange={handleInputChange}
                          />
                          <span>Use TLS/HTTPS (accept self-signed certificates)</span>
                        </label>
                      </div>

                      {!connected && !editingCamera && (
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn-connect"
                            onClick={handleConnect}
                            disabled={connecting}
                          >
                            {connecting ? 'Connecting...' : 'Connect'}
                          </button>
                          <button type="button" className="btn-secondary" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      )}

                      {(connected || editingCamera) && (
                        <>
                          <div className="form-group">
                            <label htmlFor="serialNumber">Serial Number *</label>
                            <input
                              type="text"
                              id="serialNumber"
                              name="serialNumber"
                              value={formData.serialNumber}
                              onChange={handleInputChange}
                              required
                              placeholder="Auto-populated from camera"
                              disabled={!editingCamera}
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="mqttTopic">
                              MQTT Path Topic (default: dataq/path/{'{SERIAL}'})
                            </label>
                            <input
                              type="text"
                              id="mqttTopic"
                              name="mqttTopic"
                              value={formData.mqttTopic}
                              onChange={handleInputChange}
                              placeholder={`dataq/path/${formData.serialNumber || '{SERIAL}'}`}
                            />
                          </div>

                          <div className="form-group">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                name="enabled"
                                checked={formData.enabled}
                                onChange={handleInputChange}
                              />
                              <span>Camera Enabled</span>
                            </label>
                          </div>

                          <div className="form-actions">
                            <button type="submit" className="btn-primary">
                              {editingCamera ? 'Update Camera' : 'Save'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Remote Camera Fields */}
                  {formData.cameraType === 'remote' && (
                    <>
                      <div className="form-group">
                        <label htmlFor="name">Camera Name *</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          placeholder="e.g., Main Entrance"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="location">Location</label>
                        <input
                          type="text"
                          id="location"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          placeholder="e.g., Building A, Floor 1"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="serialNumber">Serial Number *</label>
                        <input
                          type="text"
                          id="serialNumber"
                          name="serialNumber"
                          value={formData.serialNumber}
                          onChange={handleInputChange}
                          required
                          placeholder="e.g., B8A44FF11A35"
                          disabled={editingCamera}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="mqttTopic">
                          MQTT Path Topic (default: dataq/path/{'{SERIAL}'})
                        </label>
                        <input
                          type="text"
                          id="mqttTopic"
                          name="mqttTopic"
                          value={formData.mqttTopic}
                          onChange={handleInputChange}
                          placeholder={`dataq/path/${formData.serialNumber || '{SERIAL}'}`}
                        />
                      </div>

                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="enabled"
                            checked={formData.enabled}
                            onChange={handleInputChange}
                          />
                          <span>Camera Enabled</span>
                        </label>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="btn-primary">
                          {editingCamera ? 'Update Camera' : 'Save'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default CameraManagement;
