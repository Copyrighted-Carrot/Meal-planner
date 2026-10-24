import React, { useState, useContext, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useCarrot } from "../../context/CarrotContext";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import "./Auth.css"; // Import Rustic Theme

const Login = () => {
    const authContext = useContext(AuthContext);
    const { login, googleLogin } = authContext;
    const { say } = useCarrot(); // Use Carrot Logic
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [invalidFields, setInvalidFields] = useState([]);
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);

    const { email, password } = formData;

    const onChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (invalidFields.includes(e.target.name)) {
            setError("");
            setInvalidFields([]);
        }
    };

    const showError = (message, fields = []) => {
        setError(message);
        setInvalidFields(fields);
        say(`🥕 Oops! ${message}`);
    };

    const onInvalid = (event) => {
        const field = [...event.currentTarget.querySelectorAll("input")].find(input => !input.validity.valid);
        if (!submitting.current && field === event.target) {
            showError(field.validationMessage, [field.name]);
        }
    };

    const beginSubmission = () => {
        if (submitting.current) return false;
        submitting.current = true;
        setBusy(true);
        setError("");
        setInvalidFields([]);
        return true;
    };

    const finishSubmission = () => {
        submitting.current = false;
        setBusy(false);
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!beginSubmission()) return;
        try {
            await login({ email, password });
            say("🥕 Welcome back! Let's cook something amazing!");
            navigate("/"); // Redirect to home/add meal
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.code === 'REQUEST_CANCELLED') return;
            showError(err.message || "Login failed. Please try again.");
        } finally {
            finishSubmission();
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        if (!beginSubmission()) return;
        try {
            await googleLogin(credentialResponse.credential);
            say("🥕 Google Login successful! Welcome!");
            navigate("/");
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.code === 'REQUEST_CANCELLED') return;
            showError("Google Sign-In failed. Please try again.");
        } finally {
            finishSubmission();
        }
    };

    const handleGoogleError = () => {
        if (!submitting.current) showError("Google Sign-In failed. Please try again.");
    };

    return (
        <div className="rustic-auth-container">
            <div className="rustic-wrapper">
                {/* Main Parchment "Menu" */}
                <div className="parchment-card">
                    <div className="auth-header">
                        <span className="brand-name">© Carrot’s Meal Planner™</span>
                        <span className="slogan">“Plan Smart. Eat Better.”</span>
                        <h2 className="page-title">Login 🗝️</h2>
                    </div>



                    {error && (
                        <div id="login-error" className="rustic-alert" role="alert">{error}</div>
                    )}
                    {busy && <p id="login-status" role="status">Signing in...</p>}

                    <form onSubmit={onSubmit} onInvalid={onInvalid} aria-busy={busy} aria-describedby={error ? "login-error" : busy ? "login-status" : undefined}>
                        <div className="rustic-input-group">
                            <div className="rustic-field-wrapper">
                                <span className="rustic-icon left"></span> {/* Carrot Image */}
                                <input
                                    type="email"
                                    name="email"
                                    value={email}
                                    onChange={onChange}
                                    className="rustic-input"
                                    placeholder="Email Address"
                                    aria-label="Email Address"
                                    aria-invalid={invalidFields.includes("email") || undefined}
                                    aria-describedby={invalidFields.includes("email") ? "login-error" : undefined}
                                    required
                                />
                                <span className="rustic-icon right">✉️</span>
                            </div>
                        </div>
                        <div className="rustic-input-group">
                            <div className="rustic-field-wrapper">
                                <span className="rustic-icon left"></span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={password}
                                    onChange={onChange}
                                    className="rustic-input"
                                    placeholder="Password"
                                    aria-label="Password"
                                    aria-invalid={invalidFields.includes("password") || undefined}
                                    aria-describedby={invalidFields.includes("password") ? "login-error" : undefined}
                                    required
                                />
                                <div className="rustic-icon right">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="rustic-eye-btn"
                                        aria-label={`${showPassword ? "Hide" : "Show"} password`}
                                        title={`${showPassword ? "Hide" : "Show"} password`}
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="rustic-btn carrot-btn" disabled={busy}>
                            {busy ? "Signing in..." : "Login 🥕"}
                        </button>
                    </form>

                    <div className="google-btn-wrapper">
                        <div className="wood-btn" aria-hidden="true"></div>
                        <div className="google-auth-control">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                width="240"
                            />
                        </div>
                    </div>

                    <p className="mt-3 text-center">
                        Don't have an account? <Link to="/register" className="rustic-link">Register</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
