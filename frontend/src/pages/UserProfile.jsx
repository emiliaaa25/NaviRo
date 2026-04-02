import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  LogOut,
  Edit2,
  AlertCircle,
  CheckCircle,
  MapPin,
  Zap,
  Download,
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
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
            ✓
          </div>
        );
      case "In Progress":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <MapPin size={16} className="text-gray-600" />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            IAȘI-Quest Navigator
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle
              size={20}
              className="text-red-600 flex-shrink-0 mt-0.5"
            />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle
              size={20}
              className="text-green-600 flex-shrink-0 mt-0.5"
            />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === "profile"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Student Profile
          </button>
          <button
            onClick={() => setActiveTab("quest")}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === "quest"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Quest Map ({questProgress ? "Active" : "Inactive"})
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <>
            {/* Student Profile Card */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
                <h2 className="text-2xl font-bold">
                  {profile?.full_name || "Student"}
                </h2>
                <p className="text-indigo-100">@{user?.username}</p>
                <p className="text-indigo-100">{profile?.email}</p>
              </div>

              <div className="p-6">
                {!isEditingProfile ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-gray-600">Academic Year</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {profile?.academic_year || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Faculty</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {profile?.faculty || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Specialization</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {profile?.specialization || "Not set"}
                        </p>
                      </div>
                    </div>

                    {profile?.bio && (
                      <div className="mb-6">
                        <p className="text-sm text-gray-600">Bio</p>
                        <p className="text-gray-900">{profile.bio}</p>
                      </div>
                    )}

                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      <Edit2 size={18} />
                      Edit Profile
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        value={editFormData.full_name}
                        onChange={handleEditProfileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Academic Year
                        </label>
                        <input
                          type="number"
                          name="academic_year"
                          value={editFormData.academic_year}
                          onChange={handleEditProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="e.g., 2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Faculty
                        </label>
                        <input
                          type="text"
                          name="faculty"
                          value={editFormData.faculty}
                          onChange={handleEditProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Your faculty"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Specialization
                      </label>
                      <input
                        type="text"
                        name="specialization"
                        value={editFormData.specialization}
                        onChange={handleEditProfileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Your specialization"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bio
                      </label>
                      <textarea
                        name="bio"
                        value={editFormData.bio}
                        onChange={handleEditProfileChange}
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Tell us about yourself"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Student Toolkit */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-indigo-600 p-6 text-white">
                <h3 className="text-xl font-bold">Student Toolkit for Iași</h3>
                <p className="text-indigo-100 text-sm mt-1">
                  Quick access to verified resources relevant for admission,
                  visa, integration and city life.
                </p>
              </div>

              <div className="p-6 grid md:grid-cols-2 gap-4">
                <a
                  href="https://eviza.mae.ro"
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
                >
                  <p className="font-semibold text-gray-900">Romanian eVisa</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Official visa application portal (MAE).
                  </p>
                </a>

                <a
                  href="https://igi.mai.gov.ro"
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
                >
                  <p className="font-semibold text-gray-900">
                    IGI Residence Info
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Residence permit and immigration procedures.
                  </p>
                </a>

                <a
                  href="https://www.iasi.esn.ro/buddy-system"
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
                >
                  <p className="font-semibold text-gray-900">
                    ESN Buddy System
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Find student volunteers for local integration.
                  </p>
                </a>

                <a
                  href="https://www.uaic.ro/en/international/student-mobility-for-studies/"
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
                >
                  <p className="font-semibold text-gray-900">
                    UAIC Student Mobility
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    International office information and procedures.
                  </p>
                </a>
              </div>

              <div className="px-6 pb-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    First Week Companion
                  </p>
                  <p className="text-sm text-gray-700">
                    After arrival in Iași, complete your first actions in this
                    order: check-in at university international office, update
                    residence paperwork, then activate local transport and
                    health guidance links from your Quest tab.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quest Tab */}
        {activeTab === "quest" && (
          <>
            {!questProgress ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                  <h2 className="text-2xl font-bold mb-2">Begin Your Quest!</h2>
                  <p className="text-purple-100">
                    Create your relocation profile to start your IAȘI-Quest
                    journey
                  </p>
                </div>

                <div className="p-6">
                  {isAddingRelocationProfile ? (
                    <form
                      onSubmit={handleCreateRelocationProfile}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country of Origin *
                        </label>
                        <input
                          type="text"
                          name="country_of_origin"
                          value={relocationData.country_of_origin}
                          onChange={handleRelocationChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="e.g., France, Canada, Japan"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Citizenship Type *
                        </label>
                        <select
                          name="citizenship_type"
                          value={relocationData.citizenship_type}
                          onChange={handleRelocationChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
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

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Study Program
                          </label>
                          <input
                            type="text"
                            name="study_program"
                            value={relocationData.study_program}
                            onChange={handleRelocationChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="e.g., Medicine, Engineering"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Target University
                          </label>
                          <input
                            type="text"
                            name="target_university"
                            value={relocationData.target_university}
                            onChange={handleRelocationChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="e.g., UAIC, UMF"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Faculty
                        </label>
                        <input
                          type="text"
                          name="target_faculty"
                          value={relocationData.target_faculty}
                          onChange={handleRelocationChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Your faculty"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Birth Date
                          </label>
                          <input
                            type="date"
                            name="birth_date"
                            value={relocationData.birth_date}
                            onChange={handleRelocationChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={relocationData.phone}
                            onChange={handleRelocationChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="+40..."
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition flex items-center gap-2"
                        >
                          <Zap size={18} />
                          Start Quest
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingRelocationProfile(false)}
                          className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingRelocationProfile(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition flex items-center gap-2 font-semibold"
                    >
                      <Zap size={20} />
                      Create Relocation Profile & Start Quest
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                  <h2 className="text-2xl font-bold mb-2">Your Quest Map</h2>
                  <p className="text-purple-100">
                    {questProgress.country_of_origin} •{" "}
                    {questProgress.citizenship_type} •{" "}
                    {questProgress.study_program}
                  </p>
                </div>

                <div className="p-6">
                  {/* Relocation Info */}
                  <div className="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Your Relocation Info
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Country of Origin</p>
                        <p className="font-medium text-gray-900">
                          {questProgress.country_of_origin}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Citizenship Type</p>
                        <p className="font-medium text-gray-900">
                          {questProgress.citizenship_type}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Study Program</p>
                        <p className="font-medium text-gray-900">
                          {questProgress.study_program || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Target University</p>
                        <p className="font-medium text-gray-900">
                          {questProgress.target_university || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Visa Status</p>
                        <p className="font-medium text-gray-900">
                          {questProgress.visa_status}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Housing Status</p>
                        <p className="font-medium text-gray-900">
                          {questProgress.housing_status}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Milestones */}
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Relocation Milestones
                  </h3>
                  <div className="space-y-4">
                    {questProgress.milestones &&
                      questProgress.milestones.map((milestone, index) => (
                        <div key={index} className="relative">
                          <div className="flex items-start gap-4">
                            <div className="pt-2">
                              {getMilestoneIcon(milestone.status)}
                            </div>

                            <div className="flex-1">
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-semibold text-gray-900">
                                    {milestone.name}
                                  </h4>
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      milestone.status === "Complete"
                                        ? "bg-green-100 text-green-800"
                                        : milestone.status === "In Progress"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {milestone.status}
                                  </span>
                                </div>

                                {milestone.notes && (
                                  <p className="text-sm text-gray-600 mb-3">
                                    {milestone.notes}
                                  </p>
                                )}

                                {milestone.status === "Locked" ? (
                                  <p className="text-xs text-gray-500">
                                    Locked - Complete previous milestones to
                                    unlock
                                  </p>
                                ) : milestone.status === "Complete" ? (
                                  <p className="text-xs text-green-600">
                                    Completed on{" "}
                                    {new Date(
                                      milestone.completion_date,
                                    ).toLocaleDateString()}
                                  </p>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleMilestoneUpdate(
                                          milestone.name,
                                          "Complete",
                                        )
                                      }
                                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition"
                                    >
                                      Mark Complete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {index < questProgress.milestones.length - 1 && (
                            <div className="flex justify-center mt-2 mb-2">
                              <div className="h-6 w-0.5 bg-gray-300"></div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Quest Token Info */}
                  <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-3">
                    <Download size={20} className="text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Your Quest Token
                      </p>
                      <p className="text-xs text-gray-600">
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
