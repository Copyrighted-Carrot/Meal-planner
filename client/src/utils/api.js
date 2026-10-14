import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api'
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Standardize error message from backend AppError
        let errorMessage = 'Something went wrong';
        if (error.response?.data) {
            if (typeof error.response.data === 'string') errorMessage = error.response.data;
            else if (error.response.data.message) errorMessage = error.response.data.message;
            else if (error.response.data.msg) errorMessage = error.response.data.msg;
        } else if (error.message) {
            errorMessage = error.message;
        }

        const customError = {
            message: errorMessage,
            statusCode: error.response?.status,
            originalError: error
        };

        // Auto-logout on 401 (Invalid/Expired Token)
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            // Optional: Redirect to login or dispatch logout action if accessible
            // window.location.href = '/login'; 
        }

        return Promise.reject(customError);
    }
);

export default api;
