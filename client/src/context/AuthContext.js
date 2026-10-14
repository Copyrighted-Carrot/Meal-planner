import React, { createContext, useReducer, useEffect } from "react";
import api from "../utils/api";

const initialState = {
    token: localStorage.getItem("token"),
    isAuthenticated: null,
    loading: true,
    user: null,
};

export const AuthContext = createContext(initialState);

const authReducer = (state, action) => {
    switch (action.type) {
        case "USER_LOADED":
            return {
                ...state,
                isAuthenticated: true,
                loading: false,
                user: action.payload,
            };
        case "REGISTER_SUCCESS":
        case "LOGIN_SUCCESS":
            localStorage.setItem("token", action.payload.token);
            return {
                ...state,
                ...action.payload,
                isAuthenticated: true,
                loading: false,
            };
        case "REGISTER_FAIL":
        case "AUTH_ERROR":
        case "LOGIN_FAIL":
        case "LOGOUT":
            localStorage.removeItem("token");
            return {
                ...state,
                token: null,
                isAuthenticated: false,
                loading: false,
                user: null,
            };
        default:
            return state;
    }
};

export const AuthProvider = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Load User & Idle Timer
    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                dispatch({ type: "AUTH_ERROR" });
                return;
            }

            try {
                const res = await api.get("/auth/user");
                dispatch({
                    type: "USER_LOADED",
                    payload: res.data,
                });
            } catch (err) {
                dispatch({ type: "AUTH_ERROR" });
            }
        };

        loadUser();
    }, [state.token]);

    // Idle Timer Logic (Logout after 1h inactivity)
    useEffect(() => {
        if (!state.isAuthenticated) return;

        let timeoutId;
        const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 Hour

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                alert("Session Expired. Please log in again.");
                dispatch({ type: "LOGOUT" });
                window.location.href = '/login';
            }, TIMEOUT_DURATION);
        };

        // Listeners for activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        const handleActivity = () => resetTimer();

        // Initial start
        resetTimer();

        // Attach listeners
        events.forEach(event => document.addEventListener(event, handleActivity));

        // Cleanup
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => document.removeEventListener(event, handleActivity));
        };
    }, [state.isAuthenticated]);

    // Register User
    const register = async (formData) => {
        try {
            const res = await api.post("/auth/register", formData);
            dispatch({
                type: "REGISTER_SUCCESS",
                payload: res.data,
            });
        } catch (err) {
            dispatch({
                type: "REGISTER_FAIL",
                payload: err.message, // api.js interceptor formats this
            });
            throw err;
        }
    };

    // Login User
    const login = async (formData) => {
        try {
            const res = await api.post("/auth/login", formData);
            dispatch({
                type: "LOGIN_SUCCESS",
                payload: res.data,
            });
        } catch (err) {
            dispatch({
                type: "LOGIN_FAIL",
                payload: err.message, // api.js interceptor formats this
            });
            throw err;
        }
    };

    // Google Login
    const googleLogin = async (credential) => {
        try {
            const res = await api.post("/auth/google", { credential });
            dispatch({
                type: "LOGIN_SUCCESS",
                payload: res.data,
            });
        } catch (err) {
            dispatch({
                type: "LOGIN_FAIL",
                payload: err.message || "Google Login failed",
            });
            throw err;
        }
    };

    // Logout
    const logout = () => dispatch({ type: "LOGOUT" });

    return (
        <AuthContext.Provider
            value={{
                token: state.token,
                isAuthenticated: state.isAuthenticated,
                loading: state.loading,
                user: state.user,
                register,
                login,
                googleLogin,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
