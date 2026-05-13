import React, { useCallback, useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";

const POLL_MS = 4000;

export default function PeerChat({
  room = "buddy",
  connectionId = null,
  cohortKey = null,
  title = "Chat",
}) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const api = import.meta.env.VITE_API_URL || "/api";

  const load = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams({ room });
    if (room === "buddy" && connectionId) {
      params.set("connection_id", String(connectionId));
    }
    if (room === "cohort") {
      params.set("cohort_key", cohortKey || "Sept 2026 arrivals");
    }
    try {
      const res = await fetch(`${api}/peers/chat?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Could not load messages");
        return;
      }
      setMessages(data.messages || []);
      setError("");
    } catch (e) {
      setError(e.message || "Network error");
    }
  }, [api, token, room, connectionId, cohortKey]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    const text = input.trim();
    if (!text || !token) return;
    const body = { room, message: text };
    if (room === "buddy") body.connection_id = connectionId;
    if (room === "cohort") body.cohort_key = cohortKey || "Sept 2026 arrivals";
    try {
      const res = await fetch(`${api}/peers/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Send failed");
        return;
      }
      setInput("");
      load();
    } catch (e) {
      setError(e.message || "Network error");
    }
  };

  if (room === "buddy" && !connectionId) {
    return (
      <div className="nv-peer-chat nv-peer-chat-muted">
        Select a buddy connection to open private chat.
      </div>
    );
  }

  return (
    <div className="nv-peer-chat">
      <div className="nv-peer-chat-header">{title}</div>
      {error && <div className="nv-form-error nv-mb-sm">{error}</div>}
      <div className="nv-peer-chat-messages">
        {messages.map((m) => (
          <div key={m.id} className="nv-peer-msg">
            <span className="nv-peer-msg-user">{m.sender_username}</span>
            <span className="nv-peer-msg-body">{m.body}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="nv-peer-chat-muted">No messages yet — say hello.</p>
        )}
      </div>
      <div className="nv-peer-chat-input-row">
        <input
          className="nv-peer-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write a message…"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button type="button" className="nv-btn-primary nv-btn-sm" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
