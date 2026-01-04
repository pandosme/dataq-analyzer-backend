import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { camerasAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function CameraSelector({ selectedCamera, onCameraChange }) {
  const { user, isAdmin } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await camerasAPI.getAll(true); // Only enabled cameras
      const allCameras = response.data || [];

      // Filter cameras based on user role
      let filteredCameras = allCameras;
      if (!isAdmin() && user?.authorizedCameras) {
        // Regular users only see cameras they're authorized to access
        filteredCameras = allCameras.filter(camera =>
          user.authorizedCameras.includes(camera._id)
        );
      }

      setCameras(filteredCameras);
    } catch (err) {
      setError('Failed to load cameras');
      console.error('Error loading cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="camera-selector">Loading cameras...</div>;
  }

  if (error) {
    return (
      <div className="camera-selector error">
        {error}
        <button onClick={loadCameras}>Retry</button>
      </div>
    );
  }

  return (
    <div className="camera-selector">
      <label htmlFor="camera-select">Select Camera:</label>
      <select
        id="camera-select"
        value={selectedCamera || ''}
        onChange={(e) => onCameraChange(e.target.value)}
      >
        <option value="">-- Select a camera --</option>
        {cameras.map((camera) => (
          <option key={camera._id} value={camera.serialNumber}>
            {camera.name} ({camera.serialNumber})
          </option>
        ))}
      </select>
    </div>
  );
}

CameraSelector.propTypes = {
  selectedCamera: PropTypes.string,
  onCameraChange: PropTypes.func.isRequired,
};

export default CameraSelector;
