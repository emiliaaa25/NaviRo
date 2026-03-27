import React from "react";
import { CheckCircle, Circle, Lock, MapPin } from "lucide-react"; // Install lucide-react for icons

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

const QuestMap = ({ currentStep = 1 }) => {
  return (
    <div className="p-6 bg-slate-50 rounded-xl shadow-md border border-slate-200 w-80">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <MapPin className="text-blue-600" /> Your Iași Quest
      </h2>

      <div className="space-y-8">
        {milestones.map((step) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Vertical Line Connector */}
              {step.id !== milestones.length && (
                <div
                  className={`absolute left-3 top-8 w-0.5 h-12 ${isCompleted ? "bg-green-500" : "bg-slate-300"}`}
                />
              )}

              {/* Icon Logic */}
              <div className="z-10">
                {isCompleted ? (
                  <CheckCircle className="text-green-500 bg-white" size={24} />
                ) : isActive ? (
                  <Circle
                    className="text-blue-600 fill-blue-600 animate-pulse"
                    size={24}
                  />
                ) : (
                  <Lock className="text-slate-400" size={24} />
                )}
              </div>

              {/* Text Content */}
              <div className="flex flex-col">
                <span
                  className={`font-semibold ${isActive ? "text-blue-700" : "text-slate-700"}`}
                >
                  {step.label}
                </span>
                <span className="text-xs text-slate-500 italic">
                  {step.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-3 bg-blue-100 rounded-lg text-xs text-blue-800 border border-blue-200">
        <strong>Quest Token:</strong> IQ-7829-NZ-2026
        <p className="mt-1">Save this to resume your journey anytime.</p>
      </div>
    </div>
  );
};

export default QuestMap;
