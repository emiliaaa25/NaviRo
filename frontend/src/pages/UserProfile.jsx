import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  LogOut,
  Edit2,
  AlertCircle,
  CheckCircle,
  MapPin,
  Zap,
  Download,
  MessageCircle,
} from "lucide-react";

export default function UserProfile() {
  const {
    user,
    token,
    logout,
    getProfile,
    updateProfile,
    createRelocationProfile,
    getQuestProgress,
    updateQuestMilestone,
    generateQuestToken,
  } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [questProgress, setQuestProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingRelocationProfile, setIsAddingRelocationProfile] =
    useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" or "quest"

  const [editFormData, setEditFormData] = useState({
    username: "",
    full_name: "",
    academic_year: "",
    faculty: "",
    specialization: "",
    bio: "",
  });

  const [relocationData, setRelocationData] = useState({
    country_of_origin: "",
    citizenship_type: "EU",
    study_program: "",
    target_university: "",
    target_faculty: "",
    birth_date: "",
    phone: "",
    languages_spoken: "",
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
    const questData = await getQuestProgress();

    if (profileData) {
      setProfile(profileData);
      setEditFormData({
        username: profileData.username ?? user?.username ?? "",
        full_name: profileData.full_name || "",
        academic_year: profileData.academic_year || "",
        faculty: profileData.faculty || "",
        specialization: profileData.specialization || "",
        bio: profileData.bio || "",
      });
    }

    if (questData) {
      setQuestProgress(questData);
      setRelocationData((prev) => ({
        ...prev,
        country_of_origin: questData.country_of_origin || "",
        citizenship_type: questData.citizenship_type || "EU",
        study_program: questData.study_program || "",
        target_university: questData.target_university || "",
        target_faculty: questData.target_faculty || "",
        languages_spoken: questData.languages_spoken || "",
      }));
    } else if (!profileData) {
      setError("Failed to load profile");
    }

    setLoading(false);
  };

  const handleEditProfileChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const result = await updateProfile(editFormData);

    if (result.success) {
      setSuccess("Profile updated successfully!");
      setIsEditingProfile(false);
      await fetchData();
    } else {
      setError(result.message || "Failed to update profile");
    }
  };

  const handleRelocationChange = (e) => {
    const { name, value } = e.target;
    setRelocationData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateRelocationProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const result = await createRelocationProfile(relocationData);

    if (result.success) {
      setSuccess("Relocation profile created! Your quest begins now!");
      setIsAddingRelocationProfile(false);
      await fetchData();

      // Generate quest token
      const tokenResult = await generateQuestToken();
      if (tokenResult.success) {
        setSuccess(
          `Quest started! Your token: ${tokenResult.quest_token.slice(0, 8)}...`,
        );
      }
    } else {
      setError(result.message || "Failed to create relocation profile");
    }
  };

  const handleMilestoneUpdate = async (milestoneName, newStatus) => {
    const result = await updateQuestMilestone(milestoneName, newStatus);

    if (result.success) {
      setSuccess(`${milestoneName} updated to ${newStatus}!`);
      await fetchData();
    } else {
      setError(result.message || "Failed to update milestone");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getMilestoneIcon = (status) => {
    switch (status) {
      case "Complete":
        return (
          <div className="nv-milestone-icon nv-milestone-icon-complete">✓</div>
        );
      case "In Progress":
        return (
          <div className="nv-milestone-icon nv-milestone-icon-progress">
            <Zap size={16} aria-hidden />
          </div>
        );
      default:
        return (
          <div className="nv-milestone-icon nv-milestone-icon-locked">
            <MapPin size={16} aria-hidden />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="nv-loading">
        <div className="nv-spinner" aria-hidden />
        <p style={{ color: "var(--text-light)", fontSize: 14 }}>
          Loading profile...
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
              Profile &amp; IAȘI-Quest
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
              <MessageCircle size={18} aria-hidden />
              Back to chat
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
              <MapPin size={18} aria-hidden />
              Quest roadmap
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="nv-btn-logout"
            >
              <LogOut size={18} />
              Log out
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

        <div className="nv-profile-tabs">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`nv-profile-tab${activeTab === "profile" ? " nv-active" : ""}`}
          >
            Student Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quest")}
            className={`nv-profile-tab${activeTab === "quest" ? " nv-active" : ""}`}
          >
            Quest Map ({questProgress ? "Active" : "Inactive"})
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <>
            <div className="nv-card" style={{ marginBottom: 24 }}>
              <div className="nv-card-header-sage">
                <h2>{profile?.full_name || "Student"}</h2>
                <p>@{profile?.username ?? user?.username}</p>
                <p>{profile?.email}</p>
              </div>

              <div className="nv-card-body">
                {!isEditingProfile ? (
                  <>
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
                        <span className="nv-label">Academic Year</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.academic_year || "Not set"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Faculty</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.faculty || "Not set"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Specialization</span>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--dark)",
                            margin: 0,
                          }}
                        >
                          {profile?.specialization || "Not set"}
                        </p>
                      </div>
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
                      onClick={() => {
                        setEditFormData({
                          username: profile?.username ?? user?.username ?? "",
                          full_name: profile?.full_name || "",
                          academic_year: profile?.academic_year || "",
                          faculty: profile?.faculty || "",
                          specialization: profile?.specialization || "",
                          bio: profile?.bio || "",
                        });
                        setIsEditingProfile(true);
                      }}
                      className="nv-btn-edit"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Edit2 size={18} />
                      Edit Profile
                    </button>
                  </>
                ) : (
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
                        onChange={handleEditProfileChange}
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
                        onChange={handleEditProfileChange}
                        className="nv-input"
                      />
                    </div>

                    <div className="nv-form-grid" style={{ marginBottom: 16 }}>
                      <div>
                        <label className="nv-label" htmlFor="academic_year">
                          Academic Year
                        </label>
                        <input
                          id="academic_year"
                          type="number"
                          name="academic_year"
                          value={editFormData.academic_year}
                          onChange={handleEditProfileChange}
                          className="nv-input"
                          placeholder="e.g., 2"
                        />
                      </div>

                      <div>
                        <label className="nv-label" htmlFor="faculty">
                          Faculty
                        </label>
                        <input
                          id="faculty"
                          type="text"
                          name="faculty"
                          value={editFormData.faculty}
                          onChange={handleEditProfileChange}
                          className="nv-input"
                          placeholder="Your faculty"
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label className="nv-label" htmlFor="specialization">
                        Specialization
                      </label>
                      <input
                        id="specialization"
                        type="text"
                        name="specialization"
                        value={editFormData.specialization}
                        onChange={handleEditProfileChange}
                        className="nv-input"
                        placeholder="Your specialization"
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label className="nv-label" htmlFor="bio">
                        Bio
                      </label>
                      <textarea
                        id="bio"
                        name="bio"
                        value={editFormData.bio}
                        onChange={handleEditProfileChange}
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
                        onClick={() => {
                          setIsEditingProfile(false);
                          if (profile) {
                            setEditFormData({
                              username:
                                profile.username ?? user?.username ?? "",
                              full_name: profile.full_name || "",
                              academic_year: profile.academic_year || "",
                              faculty: profile.faculty || "",
                              specialization: profile.specialization || "",
                              bio: profile.bio || "",
                            });
                          }
                        }}
                        className="nv-btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="nv-card">
              <div className="nv-card-header-sage">
                <h3>Student Toolkit for Iași</h3>
                <p>
                  Quick access to verified resources relevant for admission,
                  visa, integration and city life.
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
                    <span>
                      International office information and procedures.
                    </span>
                  </a>
                </div>

                <div className="nv-callout" style={{ marginTop: 20 }}>
                  <strong
                    style={{
                      display: "block",
                      marginBottom: 6,
                      color: "var(--dark)",
                    }}
                  >
                    First Week Companion
                  </strong>
                  After arrival in Iași, complete your first actions in this
                  order: check-in at university international office, update
                  residence paperwork, then activate local transport and health
                  guidance links from your Quest tab.
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quest Tab */}
        {activeTab === "quest" && (
          <>
            {!questProgress ? (
              <div className="nv-card">
                <div className="nv-card-header-sage">
                  <h2>Begin your quest</h2>
                  <p>
                    Create your relocation profile to start your IAȘI-Quest
                    journey.
                  </p>
                </div>

                <div className="nv-card-body">
                  {isAddingRelocationProfile ? (
                    <form onSubmit={handleCreateRelocationProfile}>
                      <div style={{ marginBottom: 16 }}>
                        <label className="nv-label" htmlFor="country_of_origin">
                          Country of Origin *
                        </label>
                        <input
                          id="country_of_origin"
                          type="text"
                          name="country_of_origin"
                          value={relocationData.country_of_origin}
                          onChange={handleRelocationChange}
                          className="nv-input"
                          placeholder="e.g., France, Canada, Japan"
                          required
                        />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label className="nv-label" htmlFor="citizenship_type">
                          Citizenship Type *
                        </label>
                        <select
                          id="citizenship_type"
                          name="citizenship_type"
                          value={relocationData.citizenship_type}
                          onChange={handleRelocationChange}
                          className="nv-input"
                          required
                        >
                          <option value="EU">EU Citizen</option>
                          <option value="Non-EU">Non-EU Citizen</option>
                          <option value="Bilateral-NZ">
                            Bilateral Treaty (New Zealand)
                          </option>
                          <option value="Bilateral-UAE">
                            Bilateral Treaty (UAE)
                          </option>
                          <option value="Erasmus">Erasmus Student</option>
                        </select>
                      </div>

                      <div
                        className="nv-form-grid"
                        style={{ marginBottom: 16 }}
                      >
                        <div>
                          <label className="nv-label" htmlFor="study_program">
                            Study Program
                          </label>
                          <input
                            id="study_program"
                            type="text"
                            name="study_program"
                            value={relocationData.study_program}
                            onChange={handleRelocationChange}
                            className="nv-input"
                            placeholder="e.g., Medicine, Engineering"
                          />
                        </div>

                        <div>
                          <label
                            className="nv-label"
                            htmlFor="target_university"
                          >
                            Target University
                          </label>
                          <input
                            id="target_university"
                            type="text"
                            name="target_university"
                            value={relocationData.target_university}
                            onChange={handleRelocationChange}
                            className="nv-input"
                            placeholder="e.g., UAIC, UMF"
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label className="nv-label" htmlFor="target_faculty">
                          Target Faculty
                        </label>
                        <input
                          id="target_faculty"
                          type="text"
                          name="target_faculty"
                          value={relocationData.target_faculty}
                          onChange={handleRelocationChange}
                          className="nv-input"
                          placeholder="Your faculty"
                        />
                      </div>

                      <div
                        className="nv-form-grid"
                        style={{ marginBottom: 16 }}
                      >
                        <div>
                          <label className="nv-label" htmlFor="birth_date">
                            Birth Date
                          </label>
                          <input
                            id="birth_date"
                            type="date"
                            name="birth_date"
                            value={relocationData.birth_date}
                            onChange={handleRelocationChange}
                            className="nv-input"
                          />
                        </div>

                        <div>
                          <label className="nv-label" htmlFor="phone">
                            Phone Number
                          </label>
                          <input
                            id="phone"
                            type="tel"
                            name="phone"
                            value={relocationData.phone}
                            onChange={handleRelocationChange}
                            className="nv-input"
                            placeholder="+40..."
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label className="nv-label" htmlFor="languages_spoken">
                          Languages you speak (for Buddy Finder)
                        </label>
                        <input
                          id="languages_spoken"
                          type="text"
                          name="languages_spoken"
                          value={relocationData.languages_spoken}
                          onChange={handleRelocationChange}
                          className="nv-input"
                          placeholder="e.g. English, Romanian, French"
                        />
                      </div>

                      <div
                        style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
                      >
                        <button
                          type="submit"
                          className="nv-btn-edit"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Zap size={18} />
                          Start Quest
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingRelocationProfile(false)}
                          className="nv-btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingRelocationProfile(true)}
                      className="nv-btn-edit"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Zap size={20} />
                      Create Relocation Profile &amp; Start Quest
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="nv-card">
                <div className="nv-card-header-sage">
                  <h2>Your Quest Map</h2>
                  <p>
                    {questProgress.country_of_origin} •{" "}
                    {questProgress.citizenship_type} •{" "}
                    {questProgress.study_program}
                  </p>
                </div>

                <div className="nv-card-body">
                  <div className="nv-callout" style={{ marginBottom: 28 }}>
                    <strong
                      style={{
                        display: "block",
                        marginBottom: 10,
                        color: "var(--dark)",
                      }}
                    >
                      Your Relocation Info
                    </strong>
                    <div className="nv-form-grid">
                      <div>
                        <span className="nv-label">Country of Origin</span>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontWeight: 600,
                            color: "var(--dark)",
                          }}
                        >
                          {questProgress.country_of_origin}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Citizenship Type</span>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontWeight: 600,
                            color: "var(--dark)",
                          }}
                        >
                          {questProgress.citizenship_type}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Study Program</span>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontWeight: 600,
                            color: "var(--dark)",
                          }}
                        >
                          {questProgress.study_program || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Target University</span>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontWeight: 600,
                            color: "var(--dark)",
                          }}
                        >
                          {questProgress.target_university || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Visa Status</span>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontWeight: 600,
                            color: "var(--dark)",
                          }}
                        >
                          {questProgress.visa_status}
                        </p>
                      </div>
                      <div>
                        <span className="nv-label">Housing Status</span>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontWeight: 600,
                            color: "var(--dark)",
                          }}
                        >
                          {questProgress.housing_status}
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--dark)",
                      margin: "0 0 16px",
                    }}
                  >
                    Relocation Milestones
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {questProgress.milestones &&
                      questProgress.milestones.map((milestone, index) => (
                        <div key={index}>
                          <div className="nv-milestone-row">
                            <div style={{ paddingTop: 6 }}>
                              {getMilestoneIcon(milestone.status)}
                            </div>

                            <div
                              className="nv-milestone-card"
                              style={{ flex: 1 }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  marginBottom: 8,
                                }}
                              >
                                <h4
                                  style={{
                                    margin: 0,
                                    fontSize: 15,
                                    color: "var(--dark)",
                                  }}
                                >
                                  {milestone.name}
                                </h4>
                                <span
                                  className={`nv-badge ${
                                    milestone.status === "Complete"
                                      ? "nv-badge-complete"
                                      : milestone.status === "In Progress"
                                        ? "nv-badge-progress"
                                        : "nv-badge-locked"
                                  }`}
                                >
                                  {milestone.status}
                                </span>
                              </div>

                              {milestone.notes && (
                                <p
                                  style={{
                                    fontSize: 13,
                                    color: "var(--text-light)",
                                    margin: "0 0 10px",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {milestone.notes}
                                </p>
                              )}

                              {milestone.status === "Locked" ? (
                                <p
                                  style={{
                                    fontSize: 12,
                                    color: "var(--text-light)",
                                    margin: 0,
                                  }}
                                >
                                  Locked - complete previous milestones to
                                  unlock
                                </p>
                              ) : milestone.status === "Complete" ? (
                                <p
                                  style={{
                                    fontSize: 12,
                                    color: "var(--sage-dark)",
                                    margin: 0,
                                  }}
                                >
                                  Completed on{" "}
                                  {new Date(
                                    milestone.completion_date,
                                  ).toLocaleDateString()}
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleMilestoneUpdate(
                                      milestone.name,
                                      "Complete",
                                    )
                                  }
                                  className="nv-btn-edit"
                                  style={{ fontSize: 12, padding: "6px 14px" }}
                                >
                                  Mark Complete
                                </button>
                              )}
                            </div>
                          </div>

                          {index < questProgress.milestones.length - 1 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                margin: "8px 0",
                              }}
                            >
                              <div
                                style={{
                                  width: 2,
                                  height: 20,
                                  background: "var(--cream-dark)",
                                  borderRadius: 1,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  <div
                    className="nv-callout"
                    style={{
                      marginTop: 28,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <Download
                      size={22}
                      style={{ color: "var(--sage-dark)", flexShrink: 0 }}
                    />
                    <div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          margin: "0 0 4px",
                          color: "var(--dark)",
                        }}
                      >
                        Your Quest Token
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-light)",
                          margin: 0,
                        }}
                      >
                        Use this token to resume your quest from any device
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
