import React, { useEffect, useState } from "react";
import PeerChat from "../components/PeerChat";
import useAuth from "../hooks/useAuth";

export default function BuddyFinder() {
  const { token, user } = useAuth();
  const api = import.meta.env.VITE_API_URL || "/api";
  const [country, setCountry] = useState("");
  const [program, setProgram] = useState("");
  const [language, setLanguage] = useState("");
  const [peers, setPeers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeConn, setActiveConn] = useState(null);
  const [msg, setMsg] = useState("");

  const loadPeers = async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (program) params.set("program", program);
    if (language) params.set("language", language);
    try {
      const res = await fetch(`${api}/peers/find?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.message || `Server error (${res.status})`);
        setPeers([]);
        return;
      }
      setPeers(data.peers || []);
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  const loadConnections = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${api}/peers/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadConnections();
  }, [token]);

  useEffect(() => {
    if (token) {
      loadPeers();
    }
  }, [token]);

  const matchOneClick = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${api}/peers/match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "auto" }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`Matched with ${data.connection.peer_username}`);
        setActiveConn(data.connection.connection_id);
        loadConnections();
      } else setMsg(data.message || "No match");
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  const matchManual = async (peerUserId) => {
    if (!token) return;
    try {
      const res = await fetch(`${api}/peers/match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "manual", peer_user_id: peerUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`Buddy pair with ${data.connection.peer_username}`);
        setActiveConn(data.connection.connection_id);
        loadConnections();
      } else setMsg(data.message || "Could not match");
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  return (
    <div className="nv-page nv-buddies-page">
      <header className="nv-page-header">
        <div>
          <h1 className="nv-page-title">Buddy Finder</h1>
          <p className="nv-page-sub">
            Without filters you see all other registered users. If you add
            country / program / language, only those who completed their
            relocation profile in Profile appear.
          </p>
        </div>
      </header>

      {msg && <p className="nv-form-success nv-mb-md">{msg}</p>}

      <section className="nv-section">
        <div className="nv-filters-row">
          <input
            className="nv-filter-input"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <input
            className="nv-filter-input"
            placeholder="Program contains…"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          />
          <input
            className="nv-filter-input"
            placeholder="Language(s) spoken contains…"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <button type="button" className="nv-btn-primary" onClick={loadPeers}>
            Search peers
          </button>
          <button
            type="button"
            className="nv-btn-ghost"
            onClick={matchOneClick}
          >
            One-click match
          </button>
        </div>

        <div className="nv-buddy-columns">
          <div>
            <h2 className="nv-section-title">Results</h2>
            <ul className="nv-buddy-list">
              {peers.filter((p) => p.user_id !== user?.id).length === 0 && (
                <li className="nv-page-sub" style={{ padding: "12px 0" }}>
                  No other users found in database (or filters don't match
                  anyone). Register a second user or clear the filters and press
                  Search again.
                </li>
              )}
              {peers
                .filter((p) => p.user_id !== user?.id)
                .map((p) => (
                  <li key={p.user_id} className="nv-buddy-row">
                    <div>
                      <strong>{p.username}</strong>
                      <div className="nv-page-sub">
                        {p.country_of_origin || "—"} · {p.study_program || "—"}{" "}
                        · {p.languages_spoken || "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="nv-btn-primary nv-btn-sm"
                      onClick={() => matchManual(p.user_id)}
                    >
                      Match
                    </button>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2 className="nv-section-title">Your buddy chats</h2>
            <ul className="nv-buddy-list">
              {connections.map((c) => (
                <li key={c.connection_id}>
                  <button
                    type="button"
                    className={
                      activeConn === c.connection_id
                        ? "nv-buddy-conn nv-active"
                        : "nv-buddy-conn"
                    }
                    onClick={() => setActiveConn(c.connection_id)}
                  >
                    {c.peer_username}
                  </button>
                </li>
              ))}
            </ul>
            <PeerChat
              room="buddy"
              connectionId={activeConn}
              title={activeConn ? "Buddy chat" : "Buddy chat"}
            />
          </div>
        </div>
      </section>

      <section className="nv-section">
        <h2 className="nv-section-title">Cohort group — Sept 2026 arrivals</h2>
        <p className="nv-page-sub">
          Shared room for everyone in the Sept 2026 arrival cohort.
        </p>
        <PeerChat
          room="cohort"
          cohortKey="Sept 2026 arrivals"
          title="Cohort group chat"
        />
      </section>
    </div>
  );
}