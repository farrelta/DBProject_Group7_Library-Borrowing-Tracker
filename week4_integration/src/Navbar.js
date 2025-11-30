import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation(); 
  const navigate = useNavigate();

  const isLoggedIn = sessionStorage.getItem('token');

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  return (
    <header className="navbar">
      <h2>📚 Library System</h2>
      
      {isLoggedIn && (
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      )}
    </header>
  );
}