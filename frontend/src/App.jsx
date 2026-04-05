import React, { useState } from "react";
import QuestMap from "./components/QuestMap";
import { useChat } from "./hooks/useChat";

function App() {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [currentStep, setCurrentStep] = useState(1); // Link this to Rasa slots later

  const handleSend = () => {
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-[#003366] text-white p-5 shadow-xl flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">
          IASI-Quest Navigator
        </h1>
        <span className="bg-blue-500 px-3 py-1 rounded-full text-xs uppercase font-bold">
          Live: Use Case 1
        </span>
      </header>

      <main className="flex flex-1 p-8 gap-8 max-w-7xl mx-auto w-full">
        {/* Left: Quest Map */}
        <aside className="w-1/3">
          <QuestMap currentStep={currentStep} />
        </aside>

        {/* Right: Chat Window */}
        <section className="flex-1 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                    }`}
                >
                  {msg.text}
                  {msg.sender === "bot" && msg.citations?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                      <span className="font-semibold">Sources: </span>
                      {msg.citations.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
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

export default App;
