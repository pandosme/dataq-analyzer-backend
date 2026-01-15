import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import CameraManagement from './components/CameraManagement';
import ConnectionStatus from './components/ConnectionStatus';
import { useAuth } from './context/AuthContext';
import './App.css';

const ADMIN_SECTIONS = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  { id: 'users', name: 'User Management', icon: '👥' },
  { id: 'cameras', name: 'Camera Management', icon: '📷' },
  { id: 'settings', name: 'Settings', icon: '⚙️' },
];

function App() {
  const { isAuthenticated, loading, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState('dashboard');

  // Show loading state
  if (loading) {
    return (
      <div className="app-loading">
        <h2>Loading...</h2>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app admin-app">
      <header className="app-header">
        <div className="header-left">
          <h1>DataQ Management</h1>
          <nav className="app-navigation">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`nav-tab ${currentSection === section.id ? 'active' : ''}`}
                onClick={() => setCurrentSection(section.id)}
                title={section.name}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-label">{section.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="header-right">
          <ConnectionStatus />
          <div className="header-actions">
            <button className="logout-btn" onClick={logout} title="Logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="main-content admin-content">
        {currentSection === 'dashboard' && (
          <div className="admin-section">
            <Dashboard inline />
          </div>
        )}

        {currentSection === 'users' && (
          <div className="admin-section">
            <UserManagement inline />
          </div>
        )}

        {currentSection === 'cameras' && (
          <div className="admin-section">
            <CameraManagement inline />
          </div>
        )}

        {currentSection === 'settings' && (
          <div className="admin-section">
            <Settings inline />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
