import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Setup from './components/Setup';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import CameraManagement from './components/CameraManagement';
import { authAPI } from './services/api';
import { useAuth } from './context/AuthContext';
import './App.css';

const ADMIN_SECTIONS = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  { id: 'users', name: 'User Management', icon: '👥' },
  { id: 'cameras', name: 'Camera Management', icon: '📷' },
  { id: 'settings', name: 'Settings', icon: '⚙️' },
];

function App() {
  const { isAuthenticated, loading: authLoading, user, isAdmin, logout } = useAuth();
  const [setupRequired, setSetupRequired] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [currentSection, setCurrentSection] = useState('dashboard');

  // Check if initial setup is required
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await authAPI.checkSetup();
        setSetupRequired(response.data.setupRequired);
      } catch (err) {
        console.error('Failed to check setup status:', err);
        setSetupRequired(true);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, []);

  // Reset setupRequired when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setSetupRequired(false);
    }
  }, [isAuthenticated]);

  // Show loading state while checking setup and auth
  if (checkingSetup || authLoading) {
    return (
      <div className="app-loading">
        <h2>Loading...</h2>
      </div>
    );
  }

  // Show setup page if setup is required
  if (setupRequired) {
    return <Setup />;
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Require admin role
  if (!isAdmin()) {
    return (
      <div className="app-loading">
        <h2>Access Denied</h2>
        <p>This admin interface requires administrator privileges.</p>
        <button onClick={logout} className="logout-btn">Logout</button>
      </div>
    );
  }

  return (
    <div className="app admin-app">
      <header className="app-header">
        <div className="header-left">
          <h1>DataQ-Management</h1>
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
          <div className="header-actions">
            <div className="user-menu">
              <span className="username">{user?.username} (Admin)</span>
              <button className="logout-btn" onClick={logout} title="Logout">
                Logout
              </button>
            </div>
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
