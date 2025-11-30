import React, { useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import './styles/Login.css';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('borrower'); 
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const savedRole = sessionStorage.getItem('role');
    if (token && savedRole) {
      navigate(savedRole === 'borrower' ? '/borrower' : '/librarian');
    }
  }, [navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const route = isRegister ? `/${role}/register` : `/${role}/login`;
    const payload = {};
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
        sessionStorage.setItem('token', res.data.token);
        sessionStorage.setItem('role', role);
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
    <div className="container" style={{maxWidth: '400px', marginTop: '60px'}}>
      <h2>{isRegister ? 'Register' : 'Login'} as {role.charAt(0).toUpperCase() + role.slice(1)}</h2>
      
      <div className="toggle-btns">
        <button 
          onClick={() => setRole('borrower')} 
          className={role === 'borrower' ? 'btn-primary' : 'btn-secondary'}
          disabled={role === 'borrower'}
        >
          Borrower
        </button>
        <button 
          onClick={() => setRole('librarian')} 
          className={role === 'librarian' ? 'btn-primary' : 'btn-secondary'}
          disabled={role === 'librarian'}
        >
          Librarian
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-group">
        {isRegister && <input name="name" placeholder="Name" onChange={handleChange} required />}
        <input name="email" placeholder="Email" type="email" onChange={handleChange} required />
        <input name="password" placeholder="Password" type="password" onChange={handleChange} required />
        <button type="submit" className="btn-success" style={{marginTop: '10px'}}>
            {isRegister ? 'Sign Up' : 'Login'}
        </button>
      </form>

      <p onClick={() => setIsRegister(!isRegister)} style={{cursor: 'pointer', color: '#007bff', textAlign: 'center', marginTop: '20px'}}>
        {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
      </p>
    </div>
  );
}