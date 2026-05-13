import React from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  Lock,
} from "lucide-react";

const QuestTimeline = ({ steps = [], activeStepOrder = 1, onSelectStep }) => {
  if (!steps.length) {
    return (
      <div className="nv-roadmap-empty">
        The roadmap will appear here once quest data is available.
      </div>
    );
  }

  return (
    <div className="nv-roadmap-timeline">
      {steps.map((step) => {
        const isComplete = step.step_order < activeStepOrder;
        const isActive = step.step_order === activeStepOrder;
        const stateClass = isComplete
          ? "nv-roadmap-step-complete"
          : isActive
            ? "nv-roadmap-step-active"
            : "nv-roadmap-step-locked";

        return (
          <button
            key={step.id}
            type="button"
            className={`nv-roadmap-step ${stateClass}`}
            onClick={() => onSelectStep?.(step)}
          >
            <div className="nv-roadmap-step-marker">
              {isComplete ? (
                <CheckCircle2 size={20} aria-hidden />
              ) : isActive ? (
                <Circle size={20} aria-hidden />
              ) : (
                <Lock size={18} aria-hidden />
              )}
            </div>

            <div className="nv-roadmap-step-body">
              <div className="nv-roadmap-step-heading">
                <div>
                  <div className="nv-roadmap-step-kicker">Step {step.step_order}</div>
                  <h3>{step.title}</h3>
                </div>
                {step.deadline_label && (
                  <span className="nv-roadmap-step-deadline">
                    <CalendarDays size={14} aria-hidden />
                    {step.deadline_label}
                  </span>
                )}
              </div>

              <p>{step.description}</p>

              <div className="nv-roadmap-step-footer">
                <span>
                  {isComplete
                    ? "Completed"
                    : isActive
                      ? "Current step"
                      : "Locked until previous step is done"}
                </span>
                {step.resource_url ? (
                  <span className="nv-roadmap-step-resource">
                    Verified resource
                    <ExternalLink size={12} aria-hidden />
                  </span>
                ) : (
                  <span className="nv-roadmap-step-resource nv-roadmap-step-resource-muted">
                    No external resource attached
                  </span>
                )}
              </div>

              {step.resource_label && (
                <div className="nv-roadmap-step-link-row">
                  <ArrowRight size={14} aria-hidden />
                  <span>{step.resource_label}</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default QuestTimeline;