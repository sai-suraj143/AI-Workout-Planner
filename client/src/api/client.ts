import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_URL is not configured. Set it in the client environment before running the app.');
}

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

// Optional: Add request/response interceptors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;