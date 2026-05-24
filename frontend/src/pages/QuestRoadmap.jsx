import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import useAuth from "../hooks/useAuth";
import QuestTimeline from "../components/QuestTimeline";
import { normalizeUniversityId } from "../faculties";

const resolveQuestSlug = (profile) => {
  const targetUniversity = normalizeUniversityId(
    profile?.target_university,
  ).toUpperCase();
  const targetFaculty = (
    profile?.target_faculty ||
    profile?.faculty ||
    ""
  ).toLowerCase();
  const studyProgram = (profile?.study_program || "").toLowerCase();
  const studentType = (profile?.student_type || "").toLowerCase();
  const profileBlob = `${targetUniversity} ${targetFaculty} ${studyProgram}`;

  if (studentType === "erasmus") {
    return "erasmus-mobility-september-2026";
  }

  if (
    targetUniversity === "UMF" ||
    /medicine|medical|pharmacy|dental|dentistry|bioengineering/.test(
      profileBlob,
    )
  ) {
    return "umf-health-sciences-september-2026";
  }

  if (
    targetUniversity === "TUIASI" ||
    /engineering|technical|computer|automation|robotics|mechanical|electrical/.test(
      profileBlob,
    )
  ) {
    return "tuiasi-technical-september-2026";
  }

  return "eu-student-admission-september-2026";
};

const QuestRoadmap = () => {
  const { getProfile, getQuestProgress, getQuestSteps, getQuestChecklist } =
    useAuth();

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [quest, setQuest] = useState(null);
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [checklist, setChecklist] = useState([]);

  useEffect(() => {
    const loadRoadmap = async () => {
      setLoading(true);
      setError("");

      try {
        const profileData = await getProfile();
        const questSlug = resolveQuestSlug(profileData);

        const [progressData, stepData] = await Promise.all([
          getQuestProgress(questSlug),
          getQuestSteps(questSlug),
        ]);

        setProfile(profileData);

        const roadmapQuest = stepData?.quest || progressData?.quest || null;
        const roadmapSteps = stepData?.steps || progressData?.steps || [];
        const currentOrder =
          progressData?.current_step_order || roadmapSteps[0]?.step_order || 1;
        const initialStep =
          roadmapSteps.find((step) => step.step_order === currentOrder) ||
          roadmapSteps[0] ||
          null;

        setQuest(roadmapQuest);
        setSteps(roadmapSteps);
        setProgress(progressData);
        setSelectedStep(initialStep);

        if (initialStep) {
          const checklistData = await getQuestChecklist({
            stepId: initialStep.id,
            questSlug: roadmapQuest?.slug || questSlug || null,
          });
          setChecklist(checklistData?.checklist || []);
        }
      } catch (fetchError) {
        setError(fetchError?.message || "Failed to load quest roadmap");
      } finally {
        setLoading(false);
      }
    };

    loadRoadmap();
  }, [getQuestChecklist, getQuestProgress, getQuestSteps]);

  const activeStepOrder =
    progress?.current_step_order || selectedStep?.step_order || 1;
  const completionPercentage = progress?.completion_percentage || 0;
  const roadmapContext = progress?.roadmap_context || {};
  const roadmapFocusLabel =
    roadmapContext.track_label ||
    profile?.target_faculty ||
    quest?.target_audience ||
    "Students";
  const roadmapFocusText =
    roadmapContext.guidance ||
    "The roadmap is tailored to the saved student profile and will adapt once the profile changes.";
  const roadmapProfileLabel =
    roadmapContext.profile_label ||
    [
      profile?.target_university,
      profile?.target_faculty,
      profile?.study_program,
    ]
      .filter(Boolean)
      .join(", ") ||
    "General studies";

  const selectedChecklistSummary = useMemo(() => {
    const completedItems = checklist.filter((item) => item.completed).length;
    return {
      completedItems,
      totalItems: checklist.length,
    };
  }, [checklist]);

  const handleStepSelect = async (step) => {
    setSelectedStep(step);
    setDetailLoading(true);

    try {
      const checklistData = await getQuestChecklist({
        stepId: step.id,
        questSlug: quest?.slug || resolveQuestSlug(profile) || null,
      });
      setChecklist(checklistData?.checklist || []);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="nv-roadmap-page">
        <div className="nv-loading">
          <div className="nv-spinner" aria-hidden />
          <p style={{ color: "var(--text-light)", fontSize: 14 }}>
            Loading roadmap...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="nv-roadmap-page">
      <div className="nv-roadmap-shell">
        <header className="nv-roadmap-hero">
          <div>
            <div className="nv-roadmap-eyebrow">
              <MapPin size={14} aria-hidden />
              Quest roadmap
            </div>
            <h1>{quest?.title || "EU Student Admission Roadmap"}</h1>
            <p>
              A linear journey for admission, visa, housing, and arrival. Every
              step is paired with a checklist and a verified resource.
              {roadmapContext?.guidance ? ` ${roadmapContext.guidance}` : ""}
            </p>
            <div className="nv-roadmap-panel-badge" style={{ marginTop: 16 }}>
              <MapPin size={14} aria-hidden />
              {roadmapFocusLabel}
            </div>
          </div>
        </header>

        {error && <div className="nv-alert nv-alert-error">{error}</div>}

        <section className="nv-roadmap-metrics">
          <article className="nv-roadmap-metric">
            <span>Progress</span>
            <strong>{completionPercentage}%</strong>
            <p>
              {progress?.current_step?.title ||
                selectedStep?.title ||
                "Starting point"}
            </p>
          </article>
          <article className="nv-roadmap-metric">
            <span>Current step</span>
            <strong>#{activeStepOrder}</strong>
            <p>{selectedStep?.title || "No step selected"}</p>
          </article>
          <article className="nv-roadmap-metric">
            <span>Checklist</span>
            <strong>
              {selectedChecklistSummary.completedItems}/
              {selectedChecklistSummary.totalItems || 0}
            </strong>
            <p>Items attached to the selected step</p>
          </article>
          <article className="nv-roadmap-metric">
            <span>Target audience</span>
            <strong>{roadmapFocusLabel}</strong>
            <p>{roadmapProfileLabel}</p>
          </article>
        </section>

        <section className="nv-roadmap-panel" style={{ marginBottom: 24 }}>
          <div className="nv-roadmap-panel-header">
            <div>
              <h2>Faculty-aware roadmap context</h2>
              <p>{roadmapFocusText}</p>
            </div>
          </div>
        </section>

        <section className="nv-roadmap-grid">
          <div className="nv-roadmap-panel">
            <div className="nv-roadmap-panel-header">
              <div>
                <h2>Step timeline</h2>
                <p>
                  Tap a step to inspect its checklist and verified resource.
                </p>
              </div>
              <div className="nv-roadmap-panel-badge">
                <ShieldCheck size={14} aria-hidden />
                Verified links only
              </div>
            </div>
            <QuestTimeline
              steps={steps}
              activeStepOrder={activeStepOrder}
              onSelectStep={handleStepSelect}
            />
          </div>

          <div className="nv-roadmap-panel nv-roadmap-detail-panel">
            <div className="nv-roadmap-panel-header">
              <div>
                <h2>{selectedStep?.title || "Step details"}</h2>
                <p>
                  {selectedStep?.description || "Select a step to inspect it."}
                </p>
              </div>
              {selectedStep?.deadline_label && (
                <div className="nv-roadmap-panel-badge">
                  <CalendarDays size={14} aria-hidden />
                  {selectedStep.deadline_label}
                </div>
              )}
            </div>

            <div className="nv-roadmap-detail-card">
              <div className="nv-roadmap-detail-meta">
                <span>
                  <Flag size={14} aria-hidden />
                  Step {selectedStep?.step_order || "-"}
                </span>
                <span>
                  {selectedStep?.resource_label || quest?.title || "Quest"}
                </span>
              </div>

              {selectedStep?.resource_url && (
                <a
                  href={selectedStep.resource_url}
                  target="_blank"
                  rel="noreferrer"
                  className="nv-roadmap-resource-link"
                >
                  Open verified resource
                </a>
              )}

              <div className="nv-roadmap-checklist-shell">
                <div className="nv-roadmap-checklist-header">
                  <h3>Checklist</h3>
                  <span>
                    {detailLoading
                      ? "Refreshing..."
                      : `${checklist.length} items`}
                  </span>
                </div>

                {checklist.length > 0 ? (
                  <ul className="nv-roadmap-checklist">
                    {checklist.map((item) => (
                      <li
                        key={item.id}
                        className={`nv-roadmap-checklist-item${item.completed ? " nv-complete" : ""}`}
                      >
                        <CheckCircle2 size={16} aria-hidden />
                        <div>
                          <strong>{item.title}</strong>
                          {item.details && <p>{item.details}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="nv-roadmap-empty nv-roadmap-empty-small">
                    No checklist items were returned for this step.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default QuestRoadmap;
