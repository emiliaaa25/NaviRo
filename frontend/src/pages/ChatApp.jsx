import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QuestMap from "../components/QuestMap";
import { useChat } from "../hooks/useChat";
import useAuth from "../hooks/useAuth";
import { LogOut, User } from "lucide-react";

function ChatApp() {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [questSummary, setQuestSummary] = useState(null);
  const { user, logout, getQuestProgress } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadQuestProgress = async () => {
      const progress = await getQuestProgress();
      if (!progress) {
        setCurrentStep(1);
        setQuestSummary(null);
        return;
      }

      setQuestSummary(progress);
      const milestoneList = Array.isArray(progress.milestones)
        ? progress.milestones
        : [];
      const completed = milestoneList.filter(
        (milestone) => milestone.status === "Complete",
      ).length;
      setCurrentStep(Math.min(4, Math.max(1, completed + 1)));
    };

    loadQuestProgress();
  }, [getQuestProgress]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-[#003366] text-white p-5 shadow-xl flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">
          IASI-Quest Navigator
        </h1>
        <div className="flex items-center gap-4">
          <span className="bg-blue-500 px-3 py-1 rounded-full text-xs uppercase font-bold">
            Live: Use Case 1
          </span>
          {user && (
            <div className="flex items-center gap-3 text-white">
              <span className="text-sm">
                Welcome, <span className="font-semibold">{user.username}</span>!
              </span>
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-sm font-medium transition"
              >
                <User size={16} />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm font-medium transition"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 p-8 gap-8 max-w-7xl mx-auto w-full">
        {/* Left: Quest Map */}
        <aside className="w-1/3">
          <QuestMap
            currentStep={currentStep}
            questToken={localStorage.getItem("questToken")}
            userTag={
              questSummary
                ? `${questSummary.country_of_origin || "Unknown"} • ${questSummary.citizenship_type || "N/A"}`
                : null
            }
            questStatusLabel={
              questSummary
                ? `Program: ${questSummary.study_program || "Not set"}`
                : "Quest not started"
            }
          />
        </aside>

        {/* Right: Chat Window */}
        <section className="flex-1 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50">
            {messages && messages.length > 0 ? (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p>Start a conversation to begin your quest!</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-slate-100 border-none rounded-xl px-5 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Tell me where you are from..."
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
            >
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ChatApp;
