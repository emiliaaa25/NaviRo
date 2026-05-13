import React from "react";

export default function ActivityCard({ activity, onRemind }) {
  if (!activity) return null;
  const targets = Array.isArray(activity.target) ? activity.target : [];

  return (
    <article className="nv-card nv-activity-card">
      <div className="nv-activity-card-head">
        <span className="nv-activity-pill">{activity.type}</span>
        <span className="nv-activity-pill nv-muted">
          {activity.schedule || "—"}
        </span>
      </div>
      <h3 className="nv-activity-title">{activity.name}</h3>
      <p className="nv-activity-desc">{activity.description}</p>
      {targets.length > 0 && (
        <div className="nv-activity-tags">
          {targets.map((t) => (
            <span key={t} className="nv-activity-tag">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="nv-activity-meta">
        <span>{activity.meeting_location || "—"}</span>
        {activity.keywords && (
          <span className="nv-activity-kw">{activity.keywords}</span>
        )}
      </div>
      <div className="nv-activity-actions">
        <a
          className="nv-btn-primary nv-btn-sm"
          href={activity.link}
          target="_blank"
          rel="noreferrer"
        >
          Details / link
        </a>
        {typeof onRemind === "function" && (
          <button
            type="button"
            className="nv-btn-ghost nv-btn-sm"
            onClick={() => onRemind(activity)}
          >
            Remind me
          </button>
        )}
      </div>
    </article>
  );
}
