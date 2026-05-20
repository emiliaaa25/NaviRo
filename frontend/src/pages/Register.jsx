import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { AlertCircle, GraduationCap, Globe } from "lucide-react";
import { IASI_FACULTIES, UNIVERSITIES, getFacultiesByUniversity, getProgramsByFaculty } from "../faculties.js";

const UserIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const STUDENT_TYPES = [
  {
    id: "international",
    icon: "🎓",
    title: "International Student",
    desc: "Apply for a full degree programme at a university in Iași",
  },
  {
    id: "erasmus",
    icon: "🌍",
    title: "Erasmus / Exchange Student",
    desc: "Coming to Iași for one or two semesters through Erasmus+ or another mobility programme",
  },
];

export default function Register() {
  const [step, setStep] = useState(1); // 1 = credentials, 2 = student type + academic profile
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    // profile
    student_type: "",
    country_of_origin: "",
    // shared
    target_university: "",
    target_faculty_id: "",
    target_program: "",
    // erasmus-only
    home_university: "",
    academic_year: "",
    home_faculty: "",
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Reset dependent fields when university changes
      if (name === "target_university") {
        next.target_faculty_id = "";
        next.target_program = "";
      }
      if (name === "target_faculty_id") {
        next.target_program = "";
      }
      return next;
    });
  };

  const validateStep1 = () => {
    if (!formData.fullName || !formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setLocalError("Please fill in all fields");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError("Passwords do not match");
      return false;
    }
    if (formData.password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setLocalError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    setLocalError("");
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!formData.student_type) {
      setLocalError("Please select whether you are an Erasmus or International student");
      return;
    }
    if (!formData.country_of_origin.trim()) {
      setLocalError("Please enter your country of origin");
      return;
    }
    if (!formData.target_faculty_id) {
      setLocalError("Please select the faculty you are applying to");
      return;
    }
    if (!formData.target_program) {
      setLocalError("Please select your study programme");
      return;
    }
    if (formData.student_type === "erasmus") {
      if (!formData.home_university.trim()) {
        setLocalError("Please enter your home university");
        return;
      }
      if (!formData.academic_year) {
        setLocalError("Please select your current academic year");
        return;
      }
    }

    setLoading(true);
    const faculty = IASI_FACULTIES.find((f) => f.id === formData.target_faculty_id);

    const result = await register(
      formData.username,
      formData.email,
      formData.password,
      formData.fullName,
      {
        student_type: formData.student_type,
        country_of_origin: formData.country_of_origin,
        target_university: faculty?.university || formData.target_university,
        target_faculty: faculty?.name || "",
        target_faculty_id: formData.target_faculty_id,
        study_program: formData.target_program,
        home_university: formData.student_type === "erasmus" ? formData.home_university : "",
        home_faculty: formData.student_type === "erasmus" ? formData.home_faculty : "",
        academic_year: formData.student_type === "erasmus" ? formData.academic_year : "",
      }
    );

    if (result.success) {
      navigate("/login", { state: { message: "Registration successful! Please login." } });
    } else {
      setLocalError(result.message || "Registration failed");
    }
    setLoading(false);
  };

  const availableFaculties = formData.target_university
    ? getFacultiesByUniversity(formData.target_university)
    : IASI_FACULTIES;

  const availablePrograms = formData.target_faculty_id
    ? getProgramsByFaculty(formData.target_faculty_id)
    : [];

  return (
    <div className="nv-auth-screen">
      <div className="nv-login-left">
        <div className="nv-login-logo">
          <div style={{ fontSize: 36, lineHeight: 1 }} aria-hidden>🤖</div>
          <div className="nv-login-logo-text">Navi<span>Ro</span></div>
        </div>
        <h1 className="nv-login-tagline">
          Join Navi<span>Ro</span> and get settled in Romania with confidence.
        </h1>
        <p className="nv-login-sub">
          Create an account to save your profile, track your relocation quest, and chat with your AI guide anytime.
        </p>
        {/* Step indicator */}
        <div style={{ marginTop: 32, display: "flex", gap: 8 }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: step >= s ? "var(--sage)" : "rgba(255,255,255,0.25)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
          Step {step} of 2 — {step === 1 ? "Account details" : "Your academic profile"}
        </p>
      </div>

      <div className="nv-login-right">
        {step === 1 ? (
          <>
            <h2 className="nv-login-form-title">Create account</h2>
            <p className="nv-login-form-sub">Sign up for your NaviRo account</p>

            {localError && (
              <div className="nv-alert nv-alert-error">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{localError}</span>
              </div>
            )}

            <form onSubmit={handleNext} style={{ width: "100%" }}>
              <div className="nv-form-group">
                <label htmlFor="fullName">Full name</label>
                <div className="nv-input-wrap">
                  <UserIcon />
                  <input id="fullName" name="fullName" type="text" placeholder="Your full name"
                    value={formData.fullName} onChange={handleChange} autoComplete="name" />
                </div>
              </div>
              <div className="nv-form-group">
                <label htmlFor="username">Username</label>
                <div className="nv-input-wrap">
                  <UserIcon />
                  <input id="username" name="username" type="text" placeholder="Choose a username"
                    value={formData.username} onChange={handleChange} autoComplete="username" />
                </div>
              </div>
              <div className="nv-form-group">
                <label htmlFor="email">Email</label>
                <div className="nv-input-wrap">
                  <MailIcon />
                  <input id="email" name="email" type="email" placeholder="your.email@example.com"
                    value={formData.email} onChange={handleChange} autoComplete="email" />
                </div>
              </div>
              <div className="nv-form-group">
                <label htmlFor="password">Password</label>
                <div className="nv-input-wrap">
                  <LockIcon />
                  <input id="password" name="password" type="password" placeholder="At least 6 characters"
                    value={formData.password} onChange={handleChange} autoComplete="new-password" />
                </div>
              </div>
              <div className="nv-form-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="nv-input-wrap">
                  <LockIcon />
                  <input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm your password"
                    value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" />
                </div>
              </div>
              <button type="submit" className="nv-btn-login">Continue →</button>
            </form>

            <div className="nv-login-divider"><span>Already registered?</span></div>
            <p className="nv-signup-prompt"><Link to="/login">Login to your account</Link></p>
          </>
        ) : (
          <>
            <h2 className="nv-login-form-title">Your academic profile</h2>
            <p className="nv-login-form-sub">This helps NaviRo personalise guidance just for you</p>

            {localError && (
              <div className="nv-alert nv-alert-error">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{localError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ width: "100%" }}>
              {/* Student type selector */}
              <div className="nv-form-group">
                <label>I am coming to Iași as…</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                  {STUDENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, student_type: t.id }))}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        padding: "14px 16px",
                        borderRadius: 10,
                        border: formData.student_type === t.id
                          ? "2px solid var(--sage)"
                          : "2px solid var(--border)",
                        background: formData.student_type === t.id
                          ? "rgba(93,138,110,0.08)"
                          : "var(--surface)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 24, lineHeight: 1.2 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--dark)", marginBottom: 2 }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-light)", lineHeight: 1.4 }}>
                          {t.desc}
                        </div>
                      </div>
                      {formData.student_type === t.id && (
                        <span style={{ marginLeft: "auto", color: "var(--sage)", fontSize: 18, alignSelf: "center" }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              <div className="nv-form-group">
                <label htmlFor="country_of_origin">Country of origin</label>
                <div className="nv-input-wrap">
                  <Globe size={16} />
                  <input id="country_of_origin" name="country_of_origin" type="text"
                    placeholder="e.g. Germany, Morocco, India"
                    value={formData.country_of_origin} onChange={handleChange} />
                </div>
              </div>

              {/* Erasmus: home university + year + home faculty */}
              {formData.student_type === "erasmus" && (
                <>
                  <div className="nv-form-group">
                    <label htmlFor="home_university">Home university</label>
                    <div className="nv-input-wrap">
                      <GraduationCap size={16} />
                      <input id="home_university" name="home_university" type="text"
                        placeholder="e.g. University of Bologna"
                        value={formData.home_university} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="nv-form-group">
                    <label htmlFor="home_faculty">Faculty / Department at home university</label>
                    <div className="nv-input-wrap">
                      <GraduationCap size={16} />
                      <input id="home_faculty" name="home_faculty" type="text"
                        placeholder="e.g. Faculty of Medicine"
                        value={formData.home_faculty} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="nv-form-group">
                    <label htmlFor="academic_year">Current academic year at home university</label>
                    <select id="academic_year" name="academic_year"
                      value={formData.academic_year} onChange={handleChange} className="nv-input"
                      style={{ paddingLeft: 12 }}>
                      <option value="">Select year…</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                      <option value="5">Year 5</option>
                      <option value="6">Year 6</option>
                      <option value="master1">Master – Year 1</option>
                      <option value="master2">Master – Year 2</option>
                      <option value="phd">PhD</option>
                    </select>
                  </div>
                </>
              )}

              {/* University in Iași */}
              <div className="nv-form-group">
                <label htmlFor="target_university">
                  University in Iași {formData.student_type === "erasmus" ? "(host)" : "(applying to)"}
                </label>
                <select id="target_university" name="target_university"
                  value={formData.target_university} onChange={handleChange} className="nv-input"
                  style={{ paddingLeft: 12 }}>
                  <option value="">All universities…</option>
                  {UNIVERSITIES.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Faculty — scrollable select */}
              <div className="nv-form-group">
                <label htmlFor="target_faculty_id">
                  Faculty in Iași {formData.student_type === "erasmus" ? "(host faculty)" : "(applying to)"}
                </label>
                <select id="target_faculty_id" name="target_faculty_id"
                  value={formData.target_faculty_id} onChange={handleChange} className="nv-input"
                  size={5}
                  style={{ paddingLeft: 12, height: "auto", minHeight: 130, overflowY: "auto" }}>
                  <option value="">— select faculty —</option>
                  {availableFaculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.university})
                    </option>
                  ))}
                </select>
              </div>

              {/* Programme */}
              {formData.target_faculty_id && (
                <div className="nv-form-group">
                  <label htmlFor="target_program">Study programme</label>
                  <select id="target_program" name="target_program"
                    value={formData.target_program} onChange={handleChange} className="nv-input"
                    size={Math.min(availablePrograms.length, 5)}
                    style={{ paddingLeft: 12, height: "auto", minHeight: 100, overflowY: "auto" }}>
                    <option value="">— select programme —</option>
                    {availablePrograms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" className="nv-btn-secondary"
                  onClick={() => { setStep(1); setLocalError(""); }}
                  style={{ flex: 1 }}>
                  ← Back
                </button>
                <button type="submit" className="nv-btn-login" disabled={loading}
                  style={{ flex: 2 }}>
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}