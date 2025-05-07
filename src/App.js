import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login.js';
import Dashboard from './components/Dashboard.js';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = () => {
    const username = localStorage.getItem('username');
    setIsAuthenticated(!!username);
  };

  useEffect(() => {
    // Clear authentication state on initial load
    localStorage.removeItem('username');
    localStorage.removeItem('userTier');
    setIsAuthenticated(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('userTier');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onAuthChange={checkAuth} />
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;