import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ActivityCard from "../components/ActivityCard";
import useAuth from "../hooks/useAuth";

const TYPES = ["", "Club", "Event", "Sport", "Volunteering", "Study Group", "Cultural"];
const LOCATIONS = ["", "On-campus", "Off-campus", "Hybrid"];
const SCHEDULES = ["", "Weekly", "Biweekly", "Monthly", "One-time"];

export default function Activities() {
  const { token } = useAuth();
  const api = import.meta.env.VITE_API_URL || "/api";
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [target, setTarget] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [schedule, setSchedule] = useState("");
  const [activities, setActivities] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [interests, setInterests] = useState("");
  const [preferredTypes, setPreferredTypes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchList = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (target) params.set("target", target);
    if (meetingLocation) params.set("meeting_location", meetingLocation);
    if (schedule) params.set("schedule", schedule);
    params.set("limit", "48");
    try {
      const res = await fetch(`${api}/activities/filter?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.message || `Server error (${res.status})`);
        setActivities([]);
        return;
      }
      setActivities(data.activities || []);
      if (!data.success && data.message) setMsg(data.message);
    } catch (e) {
      setMsg(e.message || "Error loading activities");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommended = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${api}/activities/recommended?limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setRecommended(data.activities || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    fetchRecommended();
  }, [token]);

  const savePrefs = async () => {
    if (!token) {
      setMsg("Log in to save preferences.");
      return;
    }
    try {
      const res = await fetch(`${api}/profile/activity-preferences`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ interests, preferred_types: preferredTypes }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Preferences saved.");
        fetchRecommended();
      } else setMsg(data.message || "Save failed");
    } catch (e) {
      setMsg(e.message || "Error");
    }
  };

  const handleRemind = (activity) => {
    const key = "naviro_activity_reminders";
    try {
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      list.push({
        id: activity.id,
        name: activity.name,
        schedule: activity.schedule,
        at: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(list.slice(-30)));
      setMsg(`Reminder saved locally for “${activity.name}”.`);
    } catch {
      setMsg("Could not save reminder.");
    }
  };

  const calendarGroups = () => {
    const map = {};
    activities.forEach((a) => {
      const s = a.schedule || "Other";
      if (!map[s]) map[s] = [];
      map[s].push(a);
    });
    return map;
  };
  const cal = calendarGroups();

  return (
    <div className="nv-page nv-activities-page">
      <header className="nv-page-header">
        <div>
          <h1 className="nv-page-title">Activities</h1>
          <p className="nv-page-sub">
            Clubs, sports, cultural events, study groups, volunteering — filter
            and save preferences for better recommendations.
          </p>
        </div>
        <nav className="nv-page-nav">
          <Link to="/chat">Chat</Link>
          <Link to="/activities" className="nv-active">
            Activities
          </Link>
          <Link to="/buddies">Buddy Finder</Link>
          <Link to="/forum">Peer Q&amp;A</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      </header>

      {recommended.length > 0 && (
        <section className="nv-section">
          <h2 className="nv-section-title">Recommended for you</h2>
          <div className="nv-activity-grid">
            {recommended.map((a) => (
              <ActivityCard key={`rec-${a.id}`} activity={a} onRemind={handleRemind} />
            ))}
          </div>
        </section>
      )}

      <section className="nv-section nv-calendar-strip">
        <h2 className="nv-section-title">Calendar by rhythm</h2>
        <p className="nv-page-sub">
          Grouped by schedule field — use together with your own calendar or
          reminders below.
        </p>
        <div className="nv-calendar-columns">
          {Object.keys(cal).map((k) => (
            <div key={k} className="nv-calendar-col">
              <div className="nv-calendar-col-title">{k}</div>
              <ul>
                {(cal[k] || []).slice(0, 6).map((a) => (
                  <li key={a.id}>{a.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="nv-section">
        <h2 className="nv-section-title">Your preferences</h2>
        <div className="nv-prefs-row">
          <label className="nv-pref-field">
            Interests (keywords)
            <input
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. football, volunteering, Romanian culture"
            />
          </label>
          <label className="nv-pref-field">
            Preferred types (comma-separated)
            <input
              value={preferredTypes}
              onChange={(e) => setPreferredTypes(e.target.value)}
              placeholder="Club, Sport, Volunteering"
            />
          </label>
          <button type="button" className="nv-btn-primary" onClick={savePrefs}>
            Save
          </button>
        </div>
      </section>

      <section className="nv-section">
        <h2 className="nv-section-title">Filters</h2>
        <div className="nv-filters-row">
          <input
            className="nv-filter-input"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="nv-filter-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t || "all"} value={t}>
                {t || "All types"}
              </option>
            ))}
          </select>
          <input
            className="nv-filter-input"
            placeholder="Target audience contains…"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <select
            className="nv-filter-select"
            value={meetingLocation}
            onChange={(e) => setMeetingLocation(e.target.value)}
          >
            {LOCATIONS.map((t) => (
              <option key={t || "all-loc"} value={t}>
                {t || "All locations"}
              </option>
            ))}
          </select>
          <select
            className="nv-filter-select"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          >
            {SCHEDULES.map((t) => (
              <option key={t || "all-sch"} value={t}>
                {t || "All schedules"}
              </option>
            ))}
          </select>
          <button type="button" className="nv-btn-primary" onClick={fetchList}>
            Apply
          </button>
        </div>
        {msg && <p className="nv-form-success">{msg}</p>}
        {loading ? (
          <p className="nv-page-sub">Loading…</p>
        ) : (
          <div className="nv-activity-grid">
            {activities.map((a) => (
              <ActivityCard key={a.id} activity={a} onRemind={handleRemind} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
