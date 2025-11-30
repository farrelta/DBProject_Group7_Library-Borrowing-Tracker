import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './styles/Navbar.css';

export default function Navbar() {
  const location = useLocation(); 
  const navigate = useNavigate();

  const isLoggedIn = sessionStorage.getItem('token');
  const role = sessionStorage.getItem('role');
  const username = sessionStorage.getItem('username'); // Get username from storage

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  return (
    <header className="navbar">
      <h2>📚 Library System</h2>
      
      {isLoggedIn && (
        <div className="navbar-right">
          <span className="user-info">
            Logged in as: <strong>{username || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User')}</strong>
          </span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      )}
    </header>
  );
}