import axios from 'axios';

const API_URL = 'http://localhost:5000'; 

const api = axios.create({
  baseURL: API_URL,
});

// Request Interceptor: Attach Token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  console.log("Outgoing Request Token:", token); 

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Handle 401 Unauthorized automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("Session invalid or expired. Redirecting to login...");
      
      // Clear the invalid token so the user isn't stuck
      sessionStorage.clear();
      
      // Force redirect to login page
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;