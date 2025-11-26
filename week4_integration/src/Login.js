import React, { useState, useEffect } from 'react'; // Import useEffect
import api from './api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('borrower'); 
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();

  // --- NEW CODE: Check if already logged in ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    if (token && savedRole) {
      navigate(savedRole === 'borrower' ? '/borrower' : '/librarian');
    }
  }, [navigate]);
  // --------------------------------------------

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const route = isRegister ? `/${role}/register` : `/${role}/login`;
    
    const payload = {};
    // ... (rest of your existing logic for payload construction) ...
    if (role === 'borrower') {
        payload.borrowerEmail = formData.email;
        payload.borrowerPass = formData.password;
        if (isRegister) payload.borrowerName = formData.name;
    } else {
        payload.librarianEmail = formData.email;
        payload.librarianPass = formData.password;
        if (isRegister) payload.librarianName = formData.name;
    }

    try {
      const res = await api.post(route, payload);
      
      if (!isRegister) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', role); // We need to store the role!
        alert('Login Success!');
        navigate(role === 'borrower' ? '/borrower' : '/librarian');
      } else {
        alert('Registration Success! Please login.');
        setIsRegister(false);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'An error occurred');
    }
  };

  return (
    // ... (Your existing JSX) ...
    <div className="container" style={{maxWidth: '400px', marginTop: '50px'}}>
      <h2>{isRegister ? 'Register' : 'Login'} as {role.charAt(0).toUpperCase() + role.slice(1)}</h2>
      
      <div className="toggle-btns" style={{marginBottom: '20px'}}>
        <button onClick={() => setRole('borrower')} disabled={role === 'borrower'}>Borrower</button>
        <button onClick={() => setRole('librarian')} disabled={role === 'librarian'}>Librarian</button>
      </div>

      <form onSubmit={handleSubmit}>
        {isRegister && (
          <input name="name" placeholder="Name" onChange={handleChange} required />
        )}
        <input name="email" placeholder="Email" type="email" onChange={handleChange} required />
        <input name="password" placeholder="Password" type="password" onChange={handleChange} required />
        <button type="submit" style={{width: '100%', marginTop: '10px'}}>{isRegister ? 'Sign Up' : 'Login'}</button>
      </form>

      <p onClick={() => setIsRegister(!isRegister)} style={{cursor: 'pointer', color: 'blue', textAlign: 'center', marginTop: '15px'}}>
        {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
      </p>
    </div>
  );
}