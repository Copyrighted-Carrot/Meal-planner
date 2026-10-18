import React, { useState, useContext } from "react";
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

    const { name, email, password, confirmPassword } = formData;

    const onChange = (e) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (password !== confirmPassword) {
            say("🥕 Passwords do not match! Try again.");
            return;
        }
        try {
            await register({ name, email, password });
            say("🥕 Welcome to the patch! Registration successful!");
            navigate("/");
        } catch (err) {
            const msg = err.message || "Registration failed";
            say(`🥕 Oops! ${msg}`);
            // Keep setError only if we want the visual alert too, currently removing to rely on Carrot as per preference
            // setError(msg); 
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await googleLogin(credentialResponse.credential);
            say("🥕 Google Registration successful! Welcome!");
            navigate("/");
        } catch (err) {
            say("🥕 Google Sign-In failed.");
        }
    };

    return (
        <div className="rustic-auth-container">
            <div className="rustic-wrapper">
                {/* Right Side: Parchment Form */}
                <div className="parchment-card">
                    <h2 className="auth-header">Join the Patch! 📝</h2>
                    {error && <div className="rustic-alert">{error}</div>}

                    <form onSubmit={onSubmit}>
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
                                    required
                                    minLength="6"
                                />
                                <span className="rustic-icon right">🔐</span>
                            </div>
                        </div>
                        <button type="submit" className="rustic-btn carrot-btn">
                            Register 🥕
                        </button>
                    </form>

                    <div className="google-btn-wrapper">
                        <div className="wood-btn" aria-hidden="true"></div>
                        <div className="google-auth-control">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => say("🥕 Google Sign-In Failed")}
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
