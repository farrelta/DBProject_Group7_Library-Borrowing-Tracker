import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import BorrowerDashboard from './BorrowerDashboard';
import LibrarianDashboard from './LibrarianDashboard';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) return <Navigate to="/" />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" />;
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        {/* Simple Header */}
        <header style={{padding: '15px', background: '#333', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
           <h2 style={{margin: 0, color: 'white'}}>📚 Library System</h2>
           {localStorage.getItem('token') && (
             <button onClick={() => {
               localStorage.clear(); 
               window.location.href = '/'
             }} style={{background: 'transparent', border: '1px solid white'}}>Logout</button>
           )}
        </header>
        
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