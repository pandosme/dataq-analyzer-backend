import { useState, useEffect } from 'react';
import { configAPI } from '../services/api';
import './ConnectionStatus.css';

function ConnectionStatus() {
  const [status, setStatus] = useState({ mongodb: {}, mqtt: {} });
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const response = await configAPI.getStatus();
      if (response.success) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Error loading connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();

    // Poll for status updates every 10 seconds
    const interval = setInterval(loadStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return null;
  }

  return (
    <div className="connection-status">
      <div
        className="status-item"
        title={status.mqtt.connected ? 'MQTT Connected' : 'MQTT Disconnected'}
      >
        <span className={`status-dot ${status.mqtt.connected ? 'connected' : 'disconnected'}`}></span>
        <span className="status-label">MQTT</span>
      </div>
      <div
        className="status-item"
        title={
          status.mongodb.connected
            ? `MongoDB Connected: ${status.mongodb.host || ''}/${status.mongodb.name || ''}`
            : 'MongoDB Disconnected'
        }
      >
        <span className={`status-dot ${status.mongodb.connected ? 'connected' : 'disconnected'}`}></span>
        <span className="status-label">MongoDB</span>
      </div>
    </div>
  );
}

export default ConnectionStatus;
