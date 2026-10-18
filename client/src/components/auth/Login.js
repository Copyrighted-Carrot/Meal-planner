import React, { useState, useContext } from "react";
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

    const { email, password } = formData;

    const onChange = (e) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            await login({ email, password });
            say("🥕 Welcome back! Let's cook something amazing!");
            navigate("/"); // Redirect to home/add meal
        } catch (err) {
            const msg = err.message || "Login failed";

            // Restore UI Plank ONLY for Invalid Credentials
            if (msg === "Invalid Credentials") {
                setError("Invalid Credentials");
            } else {
                setError(""); // Clear any previous error
                say(`🥕 Oops! ${msg}`); // Carrot announces other errors
            }
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await googleLogin(credentialResponse.credential);
            say("🥕 Google Login successful! Welcome!");
            navigate("/");
        } catch (err) {
            say("🥕 Google Sign-In failed. Please try again.");
        }
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



                    {error === "Invalid Credentials" && (
                        <div className="invalid-creds-plank" role="alert" aria-label="Invalid Credentials" title="Invalid Credentials"></div>
                    )}

                    <form onSubmit={onSubmit}>
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
                                    required
                                />
                                <div className="rustic-icon right">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="rustic-eye-btn"
                                    >
                                        {showPassword ? "🙈" : "👁️"}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="rustic-btn carrot-btn">
                            Login 🥕
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
                        Don't have an account? <Link to="/register" className="rustic-link">Register</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
