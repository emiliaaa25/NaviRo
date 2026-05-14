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

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const loadGoogleIdentityScript = () =>
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      const existing = document.getElementById("google-identity-script");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Google script")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.id = "google-identity-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google script"));
      document.head.appendChild(script);
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setLoading(true);

    if (!username || !password) {
      setLocalError("Please fill in all fields");
      setLoading(false);
      return;
    }

    const result = await login(username, password);

    if (result.success) {
      navigate("/chat");
    } else {
      setLocalError(result.message || "Login failed");
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!googleClientId) {
      setLocalError(
        "Google login is not configured. Please set VITE_GOOGLE_CLIENT_ID.",
      );
      return;
    }

    setLocalError("");
    setGoogleLoading(true);

    try {
      await loadGoogleIdentityScript();

      const credential = await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Google login timed out. Please try again."));
        }, 45000);

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);

            if (!response?.credential) {
              reject(new Error("Google did not return a credential."));
              return;
            }

            resolve(response.credential);
          },
        });

        window.google.accounts.id.prompt((notification) => {
          if (settled) return;

          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error("Google sign-in was dismissed or blocked."));
          }
        });
      });

      const result = await loginWithGoogle(credential);
      if (result.success) {
        navigate("/chat");
      } else {
        setLocalError(result.message || "Google login failed");
      }
    } catch (error) {
      setLocalError(error.message || "Google login failed");
    } finally {
      setGoogleLoading(false);
    }
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
          Login to Navi<span>Ro</span> and make the most out of your time in
          Romania!
        </h1>
        <p className="nv-login-sub">
          Your personal AI guide for navigating student life, paperwork, and
          everyday adventures in Romania.
        </p>
      </div>

      <div className="nv-login-right">
        <h2 className="nv-login-form-title">Welcome back</h2>
        <p className="nv-login-form-sub">Sign in to your NaviRo account</p>

        {localError && (
          <div className="nv-alert nv-alert-error">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="nv-form-group">
            <label htmlFor="username">Username</label>
            <div className="nv-input-wrap">
              <UserIcon />
              <input
                id="username"
                type="text"
                placeholder="your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="nv-form-group">
            <label htmlFor="password">Password</label>
            <div className="nv-input-wrap">
              <LockIcon />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="nv-form-links">
            <a href="#">Forgot password</a>
            <Link to="/register">Sign up</Link>
          </div>

          <button type="submit" className="nv-btn-login" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="nv-login-divider">
          <span>or continue with</span>
        </div>

        <button
          type="button"
          className="nv-btn-google"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
        >
          <GoogleIcon />
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <p className="nv-signup-prompt">
          Don&apos;t have an account? <Link to="/register">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
