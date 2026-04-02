import React, { useState, useEffect, useCallback } from "react";
import AuthContext from "./AuthContextObject";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5056";

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      verifyToken(savedToken);
    }

    setLoading(false);
  }, []);

  // Verify token with backend
  const verifyToken = useCallback(async (tokenToVerify) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
        },
      });

      if (!response.ok) {
        throw new Error("Token verification failed");
      }

      return true;
    } catch (err) {
      console.error("Token verification error:", err);
      logout();
      return false;
    }
  }, []);

  const register = useCallback(async (username, email, password, fullName) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          full_name: fullName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registration failed");
        return { success: false, message: data.message };
      }

      return { success: true, message: data.message };
    } catch (err) {
      const errorMessage = err.message || "Network error during registration";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return { success: false, message: data.message };
      }

      // Save token and user to localStorage
      localStorage.setItem("authToken", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: data.user_id,
          username: data.username,
          email: data.email,
        }),
      );

      setToken(data.token);
      setUser({
        id: data.user_id,
        username: data.username,
        email: data.email,
      });

      return { success: true, message: data.message };
    } catch (err) {
      const errorMessage = err.message || "Network error during login";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const getProfile = useCallback(async () => {
    if (!token) {
      setError("No authentication token");
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to fetch profile");
        return null;
      }

      localStorage.setItem("profile", JSON.stringify(data.profile));
      return data.profile;
    } catch (err) {
      setError(err.message || "Network error fetching profile");
      return null;
    }
  }, [token]);

  const updateProfile = useCallback(
    async (profileData) => {
      if (!token) {
        setError("No authentication token");
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profileData),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to update profile");
          return { success: false, message: data.message };
        }

        return { success: true, message: data.message };
      } catch (err) {
        const errorMessage = err.message || "Network error updating profile";
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const addProject = useCallback(
    async (title, description, category = null) => {
      if (!token) {
        setError("No authentication token");
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title, description, category }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to add project");
          return { success: false, message: data.message };
        }

        return { success: true, message: data.message };
      } catch (err) {
        const errorMessage = err.message || "Network error adding project";
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const updateProject = useCallback(
    async (projectId, projectData) => {
      if (!token) {
        setError("No authentication token");
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(projectData),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to update project");
          return { success: false, message: data.message };
        }

        return { success: true, message: data.message };
      } catch (err) {
        const errorMessage = err.message || "Network error updating project";
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // ============ IASI-QUEST METHODS ============

  const generateQuestToken = useCallback(async () => {
    if (!token) {
      setError("No authentication token");
      return { success: false };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/quest/token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to generate quest token");
        return { success: false, message: data.message };
      }

      localStorage.setItem("questToken", data.quest_token);
      return { success: true, quest_token: data.quest_token };
    } catch (err) {
      setError(err.message || "Network error generating quest token");
      return { success: false, message: err.message };
    }
  }, [token]);

  const resumeQuest = useCallback(async (questToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/quest/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quest_token: questToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to resume quest");
        return null;
      }

      localStorage.setItem("questToken", questToken);
      localStorage.setItem("authToken", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: data.user_id,
          username: data.profile.username,
          email: data.profile.email,
        }),
      );

      setToken(data.token);
      setUser({
        id: data.user_id,
        username: data.profile.username,
        email: data.profile.email,
      });

      return data.profile;
    } catch (err) {
      setError(err.message || "Network error resuming quest");
      return null;
    }
  }, []);

  const createRelocationProfile = useCallback(
    async (profileData) => {
      if (!token) {
        setError("No authentication token");
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/quest/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profileData),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to create relocation profile");
          return { success: false, message: data.message };
        }

        localStorage.setItem("relocationProfile", JSON.stringify(profileData));
        return { success: true, message: data.message };
      } catch (err) {
        const errorMessage =
          err.message || "Network error creating relocation profile";
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const getQuestProgress = useCallback(async () => {
    if (!token) {
      setError("No authentication token");
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/quest/progress`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Quest module can be disabled on some backend deployments.
        if (response.status === 404) {
          return null;
        }
        setError(data.message || "Failed to fetch quest progress");
        return null;
      }

      localStorage.setItem("questProgress", JSON.stringify(data.progress));
      return data.progress;
    } catch (err) {
      setError(err.message || "Network error fetching quest progress");
      return null;
    }
  }, [token]);

  const updateQuestMilestone = useCallback(
    async (milestoneName, status, notes = null) => {
      if (!token) {
        setError("No authentication token");
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/quest/milestone/${milestoneName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status, notes }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to update milestone");
          return { success: false, message: data.message };
        }

        return { success: true, message: data.message };
      } catch (err) {
        const errorMessage = err.message || "Network error updating milestone";
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const getDigitalShadow = useCallback(async () => {
    if (!token) {
      setError("No authentication token");
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/quest/shadow`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        setError(data.message || "Failed to fetch digital shadow");
        return null;
      }

      localStorage.setItem("digitalShadow", JSON.stringify(data.shadow));
      return data.shadow;
    } catch (err) {
      setError(err.message || "Network error fetching digital shadow");
      return null;
    }
  }, [token]);

  const isAuthenticated = !!user && !!token;

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    addProject,
    updateProject,
    setError,
    // Quest methods
    generateQuestToken,
    resumeQuest,
    createRelocationProfile,
    getQuestProgress,
    updateQuestMilestone,
    getDigitalShadow,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
