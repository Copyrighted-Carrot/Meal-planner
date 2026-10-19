import React, { useState, useContext, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useCarrot } from "../../context/CarrotContext";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import "./Auth.css"; // Import Rustic Theme

const Register = () => {
    const authContext = useContext(AuthContext);
    const { register, googleLogin } = authContext;
    const { say } = useCarrot();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [error, setError] = useState("");
    const [invalidFields, setInvalidFields] = useState([]);
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);

    const { name, email, password, confirmPassword } = formData;

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
        if (submitting.current) return;
        if (password !== confirmPassword) {
            showError("Passwords do not match! Try again.", ["password", "confirmPassword"]);
            return;
        }
        if (!beginSubmission()) return;
        try {
            await register({ name, email, password });
            say("🥕 Welcome to the patch! Registration successful!");
            navigate("/");
        } catch (err) {
            if (err.code === 'SESSION_CHANGED' || err.code === 'REQUEST_CANCELLED') return;
            showError(err.message || "Registration failed. Please try again.");
        } finally {
            finishSubmission();
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        if (!beginSubmission()) return;
        try {
            await googleLogin(credentialResponse.credential);
            say("🥕 Google Registration successful! Welcome!");
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
                {/* Right Side: Parchment Form */}
                <div className="parchment-card">
                    <h2 className="auth-header">Join the Patch! 📝</h2>
                    {error && <div id="register-error" className="rustic-alert" role="alert">{error}</div>}
                    {busy && <p id="register-status" role="status">Registering...</p>}

                    <form onSubmit={onSubmit} onInvalid={onInvalid} aria-busy={busy} aria-describedby={error ? "register-error" : busy ? "register-status" : undefined}>
                        <div className="rustic-input-group">
                            <div className="rustic-field-wrapper">
                                <span className="rustic-icon left"></span>
                                <input
                                    type="text"
                                    name="name"
                                    value={name}
                                    onChange={onChange}
                                    className="rustic-input"
                                    placeholder="Your Name"
                                    aria-label="Your Name"
                                    aria-invalid={invalidFields.includes("name") || undefined}
                                    aria-describedby={invalidFields.includes("name") ? "register-error" : undefined}
                                    required
                                />
                                <span className="rustic-icon right">👤</span>
                            </div>
                        </div>
                        <div className="rustic-input-group">
                            <div className="rustic-field-wrapper">
                                <span className="rustic-icon left"></span>
                                <input
                                    type="email"
                                    name="email"
                                    value={email}
                                    onChange={onChange}
                                    className="rustic-input"
                                    placeholder="Email Address"
                                    aria-label="Email Address"
                                    aria-invalid={invalidFields.includes("email") || undefined}
                                    aria-describedby={invalidFields.includes("email") ? "register-error" : undefined}
                                    required
                                />
                                <span className="rustic-icon right">✉️</span>
                            </div>
                        </div>
                        <div className="rustic-input-group">
                            <div className="rustic-field-wrapper">
                                <span className="rustic-icon left"></span>
                                <input
                                    type="password"
                                    name="password"
                                    value={password}
                                    onChange={onChange}
                                    className="rustic-input"
                                    placeholder="Password"
                                    aria-label="Password"
                                    aria-invalid={invalidFields.includes("password") || undefined}
                                    aria-describedby={invalidFields.includes("password") ? "register-error" : undefined}
                                    required
                                    minLength="6"
                                />
                                <span className="rustic-icon right">🔒</span>
                            </div>
                        </div>
                        <div className="rustic-input-group">
                            <div className="rustic-field-wrapper">
                                <span className="rustic-icon left"></span>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={confirmPassword}
                                    onChange={onChange}
                                    className="rustic-input"
                                    placeholder="Confirm Password"
                                    aria-label="Confirm Password"
                                    aria-invalid={invalidFields.includes("confirmPassword") || undefined}
                                    aria-describedby={invalidFields.includes("confirmPassword") ? "register-error" : undefined}
                                    required
                                    minLength="6"
                                />
                                <span className="rustic-icon right">🔐</span>
                            </div>
                        </div>
                        <button type="submit" className="rustic-btn carrot-btn" disabled={busy}>
                            {busy ? "Registering..." : "Register 🥕"}
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
                        Already have an account? <Link to="/login" className="rustic-link">Login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
