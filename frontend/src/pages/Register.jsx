import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { AlertCircle } from "lucide-react";

const UserIcon = () => (
  <svg
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const MailIcon = () => (
  <svg
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export default function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const navigate = useNavigate();
  const { register } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setLoading(true);

    // Validation
    if (
      !formData.username ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.fullName
    ) {
      setLocalError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setLocalError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setLocalError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    const result = await register(
      formData.username,
      formData.email,
      formData.password,
      formData.fullName,
    );

    if (result.success) {
      navigate("/login", {
        state: { message: "Registration successful! Please login." },
      });
    } else {
      setLocalError(result.message || "Registration failed");
    }

    setLoading(false);
  };

  return (
    <div className="nv-auth-screen">
      <div className="nv-login-left">
        <div className="nv-login-logo">
          <div style={{ fontSize: 36, lineHeight: 1 }} aria-hidden>
            🤖
          </div>
          <div className="nv-login-logo-text">
            Navi<span>Ro</span>
          </div>
        </div>
        <h1 className="nv-login-tagline">
          Join Navi<span>Ro</span> and get settled in Romania with confidence.
        </h1>
        <p className="nv-login-sub">
          Create an account to save your profile, track your relocation quest,
          and chat with your AI guide anytime.
        </p>
      </div>

      <div className="nv-login-right">
        <h2 className="nv-login-form-title">Create account</h2>
        <p className="nv-login-form-sub">Sign up for your NaviRo account</p>

        {localError && (
          <div className="nv-alert nv-alert-error">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="nv-form-group">
            <label htmlFor="fullName">Full name</label>
            <div className="nv-input-wrap">
              <UserIcon />
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Your full name"
                value={formData.fullName}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="nv-form-group">
            <label htmlFor="username">Username</label>
            <div className="nv-input-wrap">
              <UserIcon />
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="nv-form-group">
            <label htmlFor="email">Email</label>
            <div className="nv-input-wrap">
              <MailIcon />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="nv-form-group">
            <label htmlFor="password">Password</label>
            <div className="nv-input-wrap">
              <LockIcon />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="nv-form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="nv-input-wrap">
              <LockIcon />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="nv-btn-login" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="nv-login-divider">
          <span>Already registered?</span>
        </div>

        <p className="nv-signup-prompt">
          <Link to="/login">Login to your account</Link>
        </p>
      </div>
    </div>
  );
}
