import axios from 'axios';

// CHANGE PORT TO MATCH YOUR SERVER (e.g., 5000)
const API_URL = 'http://localhost:5000'; 

const api = axios.create({
  baseURL: API_URL,
});

// Automatically add token to headers if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;