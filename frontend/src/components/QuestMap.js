import React from "react";
import { CheckCircle, Circle, Lock, MapPin } from "lucide-react";

const milestones = [
  {
    id: 1,
    label: "Initial Profiling",
    description: "Nationality & Study Goals",
  },
  { id: 2, label: "Admission & Docs", description: "University acceptance" },
  { id: 3, label: "Visa Application", description: "MAE/IGI Procedures" },
  { id: 4, label: "Iași Arrival", description: "Housing & Local Registration" },
];

const QuestMap = ({
  currentStep = 1,
  questToken = null,
  userTag = null,
  questStatusLabel = "Quest not started",
}) => {
  return (
    <div className="nv-quest-map">
      <h2 className="nv-quest-map-title">
        <MapPin size={22} strokeWidth={2} aria-hidden />
        Your Iași Quest
      </h2>

      {userTag && (
        <div className="nv-quest-map-tag">
          <strong>Profile:</strong> {userTag}
          <p>{questStatusLabel}</p>
        </div>
      )}

      <div className="nv-quest-map-steps">
        {milestones.map((step) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div key={step.id} className="nv-quest-map-step">
              {step.id !== milestones.length && (
                <div
                  className={`nv-quest-map-line${isCompleted ? " nv-quest-map-line-done" : ""}`}
                />
              )}

              <div className="nv-quest-map-icon-wrap">
                {isCompleted ? (
                  <CheckCircle
                    className="nv-quest-map-icon nv-quest-map-icon-done"
                    size={24}
                  />
                ) : isActive ? (
                  <Circle
                    className="nv-quest-map-icon nv-quest-map-icon-active"
                    size={24}
                  />
                ) : (
                  <Lock
                    className="nv-quest-map-icon nv-quest-map-icon-locked"
                    size={24}
                  />
                )}
              </div>

              <div className="nv-quest-map-step-text">
                <span
                  className={
                    isActive
                      ? "nv-quest-map-label-active"
                      : "nv-quest-map-label"
                  }
                >
                  {step.label}
                </span>
                <span className="nv-quest-map-desc">{step.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {questToken ? (
        <div className="nv-quest-map-token">
          <strong>Quest Token:</strong> {questToken}
          <p>Save this to resume your journey anytime.</p>
        </div>
      ) : (
        <div className="nv-quest-map-hint">
          Start your quest from Profile to generate a Quest Token.
        </div>
      )}
    </div>
  );
};

export default QuestMap;
