import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import BorrowerDashboard from './BorrowerDashboard';
import LibrarianDashboard from './LibrarianDashboard';
import Navbar from './Navbar';
import './styles/App.css';

const ProtectedRoute = ({ children, requiredRole }) => {
  const token = sessionStorage.getItem('token');
  const role = sessionStorage.getItem('role');

  if (!token) return <Navigate to="/" />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" />;
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        {/* Navbar is now inside BrowserRouter, so it can listen to route changes */}
        <Navbar />
        
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route path="/borrower" element={
            <ProtectedRoute requiredRole="borrower">
              <BorrowerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/librarian" element={
            <ProtectedRoute requiredRole="librarian">
              <LibrarianDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;