import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  LogOut,
  Edit2,
  AlertCircle,
  CheckCircle,
  MessageCircle,
} from "lucide-react";
import {
  IASI_FACULTIES,
  UNIVERSITIES,
  getFacultiesByUniversity,
  getProgramOptionsByFaculty,
  normalizeUniversityId,
} from "../faculties.js";

const STUDENT_TYPE_LABEL = {
  international: "🎓 International Student (full degree)",
  erasmus: "🌍 Erasmus / Exchange Student",
};

const ACADEMIC_YEAR_LABELS = {
  1: "Year 1",
  2: "Year 2",
  3: "Year 3",
  4: "Year 4",
  5: "Year 5",
  6: "Year 6",
  master1: "Master – Year 1",
  master2: "Master – Year 2",
  phd: "PhD",
};

export default function UserProfile() {
  const { user, logout, getProfile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [editFormData, setEditFormData] = useState({
    username: "",
    full_name: "",
    student_type: "",
    country_of_origin: "",
    // target (Iași)
    target_university: "",
    target_faculty_id: "",
    study_program: "",
    // erasmus-only
    home_university: "",
    home_faculty: "",
    academic_year: "",
    bio: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    const profileData = await getProfile();
    if (profileData) {
      setProfile(profileData);
      setEditFormData({
        username: profileData.username ?? user?.username ?? "",
        full_name: profileData.full_name || "",
        student_type: profileData.student_type || "",
        country_of_origin: profileData.country_of_origin || "",
        target_university: normalizeUniversityId(
          profileData.target_university || "",
        ),
        target_faculty_id: profileData.target_faculty_id || "",
        study_program: profileData.study_program || "",
        home_university: profileData.home_university || "",
        home_faculty: profileData.home_faculty || "",
        academic_year: profileData.academic_year || "",
        bio: profileData.bio || "",
      });
    } else {
      setError("Failed to load profile");
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "target_university") {
        next.target_faculty_id = "";
        next.study_program = "";
      }
      if (name === "target_faculty_id") {
        next.study_program = "";
      }
      return next;
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const faculty = IASI_FACULTIES.find(
      (f) => f.id === editFormData.target_faculty_id,
    );
    const payload = {
      ...editFormData,
      target_university: normalizeUniversityId(editFormData.target_university),
      target_faculty: faculty?.name || "",
    };
    const result = await updateProfile(payload);
    if (result.success) {
      setSuccess("Profile updated successfully!");
      setIsEditingProfile(false);
      await fetchData();
    } else {
      setError(result.message || "Failed to update profile");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const availableFaculties = editFormData.target_university
    ? getFacultiesByUniversity(editFormData.target_university)
    : IASI_FACULTIES;

  const availableProgramOptions = editFormData.target_faculty_id
    ? getProgramOptionsByFaculty(editFormData.target_faculty_id)
    : [];

  // Resolve display names for read view
  const displayFaculty =
    profile?.target_faculty ||
    IASI_FACULTIES.find((f) => f.id === profile?.target_faculty_id)?.name ||
    profile?.faculty ||
    "Not set";

  const displayUniversity = profile?.target_university
    ? UNIVERSITIES.find(
        (u) => u.id === normalizeUniversityId(profile.target_university),
      )?.name || profile.target_university
    : "Not set";

  if (loading) {
    return (
      <div className="nv-loading">
        <div className="nv-spinner" aria-hidden />
        <p style={{ color: "var(--text-light)", fontSize: 14 }}>
          Loading profile…
        </p>
      </div>
    );
  }

  return (
    <div className="nv-page">
      <div className="nv-page-inner">
        <div className="nv-page-header">
          <div>
            <h1 className="nv-page-title">NaviRo</h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "var(--text-light)",
              }}
            >
              Student profile
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/chat"
              className="nv-btn-secondary"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MessageCircle size={18} aria-hidden /> Back to chat
            </Link>
            <Link
              to="/roadmap"
              className="nv-btn-secondary"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Quest roadmap
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="nv-btn-logout"
            >
              <LogOut size={18} /> Log out
            </button>
          </div>
        </div>

        {error && (
          <div className="nv-alert nv-alert-error" style={{ marginBottom: 24 }}>
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            className="nv-alert nv-alert-success"
            style={{ marginBottom: 24 }}
          >
            <CheckCircle size={18} className="flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="nv-card" style={{ marginBottom: 24 }}>
          <div className="nv-card-header-sage">
            <h2>{profile?.full_name || "Student"}</h2>
            <p>@{profile?.username ?? user?.username}</p>
            <p>{profile?.email}</p>
            {profile?.student_type && (
              <p style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                {STUDENT_TYPE_LABEL[profile.student_type] ||
                  profile.student_type}
              </p>
            )}
          </div>

          <div className="nv-card-body">
            {!isEditingProfile ? (
              <>
                {/* ── READ VIEW ── */}
                <div className="nv-form-grid" style={{ marginBottom: 24 }}>
                  <div>
                    <span className="nv-label">Username</span>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--dark)",
                        margin: 0,
                      }}
                    >
                      {profile?.username ?? user?.username}
                    </p>
                  </div>
                  <div>
                    <span className="nv-label">Country of origin</span>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--dark)",
                        margin: 0,
                      }}
                    >
                      {profile?.country_of_origin || "Not set"}
                    </p>
                  </div>

                  {/* International-specific */}
                  {(!profile?.student_type ||
                    profile.student_type === "international") && (
                    <>
                      <div>
                        <span className="nv-label">University in Iași</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {displayUniversity}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Faculty in Iași</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {displayFaculty}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Study programme</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.study_program || "Not set"}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Erasmus-specific */}
                  {profile?.student_type === "erasmus" && (
                    <>
                      <div>
                        <span className="nv-label">Home university</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.home_university || "Not set"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">
                          Faculty at home university
                        </span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.home_faculty || "Not set"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Academic year (home)</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {ACADEMIC_YEAR_LABELS[profile?.academic_year] ||
                            profile?.academic_year ||
                            "Not set"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">
                          Host university in Iași
                        </span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {displayUniversity}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Host faculty in Iași</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {displayFaculty}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Study programme (Iași)</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.study_program || "Not set"}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {profile?.bio && (
                  <div style={{ marginBottom: 24 }}>
                    <span className="nv-label">Bio</span>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "var(--text)",
                        lineHeight: 1.55,
                      }}
                    >
                      {profile.bio}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="nv-btn-edit"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Edit2 size={18} /> Edit Profile
                </button>
              </>
            ) : (
              /* ── EDIT FORM ── */
              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: 16 }}>
                  <label className="nv-label" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={editFormData.username}
                    onChange={handleChange}
                    className="nv-input"
                    autoComplete="username"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="nv-label" htmlFor="full_name">
                    Full Name
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    name="full_name"
                    value={editFormData.full_name}
                    onChange={handleChange}
                    className="nv-input"
                  />
                </div>

                {/* Student type */}
                <div style={{ marginBottom: 16 }}>
                  <label className="nv-label">Student type</label>
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    {[
                      {
                        id: "international",
                        icon: "🎓",
                        label: "International",
                      },
                      { id: "erasmus", icon: "🌍", label: "Erasmus" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setEditFormData((prev) => ({
                            ...prev,
                            student_type: t.id,
                          }))
                        }
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border:
                            editFormData.student_type === t.id
                              ? "2px solid var(--sage)"
                              : "2px solid var(--border)",
                          background:
                            editFormData.student_type === t.id
                              ? "rgba(93,138,110,0.08)"
                              : "var(--surface)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                          color: "var(--dark)",
                        }}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="nv-form-grid" style={{ marginBottom: 16 }}>
                  <div>
                    <label className="nv-label" htmlFor="country_of_origin">
                      Country of origin
                    </label>
                    <input
                      id="country_of_origin"
                      type="text"
                      name="country_of_origin"
                      value={editFormData.country_of_origin}
                      onChange={handleChange}
                      className="nv-input"
                      placeholder="Your country"
                    />
                  </div>
                </div>

                {/* Erasmus-only fields */}
                {editFormData.student_type === "erasmus" && (
                  <div className="nv-form-grid" style={{ marginBottom: 16 }}>
                    <div>
                      <label className="nv-label" htmlFor="home_university">
                        Home university
                      </label>
                      <input
                        id="home_university"
                        type="text"
                        name="home_university"
                        value={editFormData.home_university}
                        onChange={handleChange}
                        className="nv-input"
                        placeholder="e.g. University of Bologna"
                      />
                    </div>
                    <div>
                      <label className="nv-label" htmlFor="home_faculty">
                        Faculty at home university
                      </label>
                      <input
                        id="home_faculty"
                        type="text"
                        name="home_faculty"
                        value={editFormData.home_faculty}
                        onChange={handleChange}
                        className="nv-input"
                        placeholder="e.g. Faculty of Medicine"
                      />
                    </div>
                    <div>
                      <label className="nv-label" htmlFor="academic_year">
                        Academic year (home)
                      </label>
                      <select
                        id="academic_year"
                        name="academic_year"
                        value={editFormData.academic_year}
                        onChange={handleChange}
                        className="nv-input"
                        style={{ paddingLeft: 12 }}
                      >
                        <option value="">Select year…</option>
                        {Object.entries(ACADEMIC_YEAR_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* University in Iași */}
                <div style={{ marginBottom: 16 }}>
                  <label className="nv-label" htmlFor="target_university">
                    {editFormData.student_type === "erasmus"
                      ? "Host university in Iași"
                      : "University in Iași"}
                  </label>
                  <select
                    id="target_university"
                    name="target_university"
                    value={editFormData.target_university}
                    onChange={handleChange}
                    className="nv-input"
                    style={{ paddingLeft: 12 }}
                  >
                    <option value="">All universities…</option>
                    {UNIVERSITIES.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faculty – scrollable */}
                <div style={{ marginBottom: 16 }}>
                  <label className="nv-label" htmlFor="target_faculty_id">
                    {editFormData.student_type === "erasmus"
                      ? "Host faculty in Iași"
                      : "Faculty in Iași"}
                  </label>
                  <select
                    id="target_faculty_id"
                    name="target_faculty_id"
                    value={editFormData.target_faculty_id}
                    onChange={handleChange}
                    className="nv-input"
                    size={5}
                    style={{
                      paddingLeft: 12,
                      height: "auto",
                      minHeight: 130,
                      overflowY: "auto",
                    }}
                  >
                    <option value="">— select faculty —</option>
                    {availableFaculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.university})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Programme */}
                {editFormData.target_faculty_id && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="nv-label" htmlFor="study_program">
                      Study programme
                    </label>
                    <select
                      id="study_program"
                      name="study_program"
                      value={editFormData.study_program}
                      onChange={handleChange}
                      className="nv-input"
                      size={Math.min(availableProgramOptions.length, 5)}
                      style={{
                        paddingLeft: 12,
                        height: "auto",
                        minHeight: 100,
                        overflowY: "auto",
                      }}
                    >
                      <option value="">— select programme —</option>
                      {availableProgramOptions.map((program) => (
                        <option
                          key={`${program.level}:${program.name}`}
                          value={program.name}
                        >
                          {program.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label className="nv-label" htmlFor="bio">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={editFormData.bio}
                    onChange={handleChange}
                    rows={4}
                    className="nv-input nv-textarea"
                    placeholder="Tell us about yourself"
                  />
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button type="submit" className="nv-btn-edit">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="nv-btn-secondary"
                    onClick={() => {
                      setIsEditingProfile(false);
                      fetchData();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Toolkit */}
        <div className="nv-card" style={{ marginBottom: 24 }}>
          <div className="nv-card-header-sage">
            <h3>Student Toolkit for Iași</h3>
            <p>
              Quick access to verified resources for admission, visa,
              integration and city life.
            </p>
          </div>
          <div className="nv-card-body">
            <div className="nv-toolkit-grid">
              <a
                href="https://eviza.mae.ro"
                target="_blank"
                rel="noreferrer"
                className="nv-toolkit-link"
              >
                <strong>Romanian eVisa</strong>
                <span>Official visa application portal (MAE).</span>
              </a>
              <a
                href="https://igi.mai.gov.ro"
                target="_blank"
                rel="noreferrer"
                className="nv-toolkit-link"
              >
                <strong>IGI Residence Info</strong>
                <span>Residence permit and immigration procedures.</span>
              </a>
              <a
                href="https://www.iasi.esn.ro/buddy-system"
                target="_blank"
                rel="noreferrer"
                className="nv-toolkit-link"
              >
                <strong>ESN Buddy System</strong>
                <span>Find student volunteers for local integration.</span>
              </a>
              <a
                href="https://www.uaic.ro/en/international/student-mobility-for-studies/"
                target="_blank"
                rel="noreferrer"
                className="nv-toolkit-link"
              >
                <strong>UAIC Student Mobility</strong>
                <span>International office information and procedures.</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
