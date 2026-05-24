import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import AppNav from "./AppNav";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="nv-loading">
        <div className="nv-spinner" aria-hidden />
        <p style={{ color: "var(--text-light)", fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="nv-protected-shell">
      <AppNav />
      <div className="nv-protected-body">{children}</div>
    </div>
  );
}
