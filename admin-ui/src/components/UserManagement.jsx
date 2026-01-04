import { useState, useEffect } from 'react';
import { authAPI, camerasAPI } from '../services/api';
import './UserManagement.css';

function UserManagement({ onClose, inline = false }) {
  const [users, setUsers] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    authorizedCameras: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersResponse, camerasResponse] = await Promise.all([
        authAPI.getAllUsers(),
        camerasAPI.getAll(),
      ]);
      setUsers(usersResponse.data || []);
      setCameras(camerasResponse.data || []);
    } catch (err) {
      setError('Failed to load data: ' + (err.response?.data?.error || err.message));
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCameraToggle = (cameraId) => {
    setFormData((prev) => {
      const cameras = prev.authorizedCameras.includes(cameraId)
        ? prev.authorizedCameras.filter((id) => id !== cameraId)
        : [...prev.authorizedCameras, cameraId];
      return { ...prev, authorizedCameras: cameras };
    });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      await authAPI.createUser(formData);
      setShowAddUser(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'user',
        authorizedCameras: [],
      });
      await loadData();
    } catch (err) {
      setError('Failed to create user: ' + (err.response?.data?.error || err.message));
      console.error('Error creating user:', err);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user._id);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      authorizedCameras: user.authorizedCameras || [],
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const updateData = { ...formData };
      // Don't send password if it's empty (no change)
      if (!updateData.password) {
        delete updateData.password;
      }
      await authAPI.updateUser(editingUser, updateData);
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'user',
        authorizedCameras: [],
      });
      await loadData();
    } catch (err) {
      setError('Failed to update user: ' + (err.response?.data?.error || err.message));
      console.error('Error updating user:', err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    try {
      setError(null);
      await authAPI.deleteUser(userId);
      await loadData();
    } catch (err) {
      setError('Failed to delete user: ' + (err.response?.data?.error || err.message));
      console.error('Error deleting user:', err);
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowAddUser(false);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      authorizedCameras: [],
    });
  };

  const getCameraNames = (cameraIds) => {
    if (!cameraIds || cameraIds.length === 0) return 'None';
    return cameras
      .filter((cam) => cameraIds.includes(cam._id))
      .map((cam) => cam.name || cam.serialNumber)
      .join(', ');
  };

  if (loading) {
    return (
      <div className={inline ? 'user-management-inline' : 'user-management-modal'}>
        <div className="user-management-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? 'user-management-inline' : 'user-management-modal'}>
      <div className="user-management-content">
        <div className="user-management-header">
          <h2>User Management</h2>
          {!inline && onClose && (
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {!showAddUser && !editingUser && (
          <>
            <div className="user-management-actions">
              <button className="btn-primary" onClick={() => setShowAddUser(true)}>
                + Add New User
              </button>
            </div>

            <div className="users-list">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Authorized Cameras</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge role-${user.role}`}>{user.role}</span>
                      </td>
                      <td className="camera-list">{getCameraNames(user.authorizedCameras)}</td>
                      <td className="actions">
                        <button className="btn-edit" onClick={() => handleEditUser(user)}>
                          Edit
                        </button>
                        <button className="btn-delete" onClick={() => handleDeleteUser(user._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(showAddUser || editingUser) && (
          <div className="user-form">
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
              <div className="form-group">
                <label htmlFor="username">Username *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  Password {editingUser ? '(leave empty to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select id="role" name="role" value={formData.role} onChange={handleInputChange}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>Authorized Cameras</label>
                <div className="camera-checkboxes">
                  {cameras.length === 0 ? (
                    <p className="no-cameras">No cameras available</p>
                  ) : (
                    cameras.map((camera) => (
                      <label key={camera._id} className="camera-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.authorizedCameras.includes(camera._id)}
                          onChange={() => handleCameraToggle(camera._id)}
                        />
                        <span>
                          {camera.name} ({camera.serialNumber})
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button type="button" className="btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;
