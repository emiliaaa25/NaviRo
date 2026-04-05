import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatApp from "./pages/ChatApp";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserProfile from "./pages/UserProfile";

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />

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
                      {msg.citations.map((citation, index) => (
                        <React.Fragment key={citation}>
                          <a
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 underline break-all"
                          >
                            {citation}
                          </a>
                          {index < msg.citations.length - 1 ? ", " : ""}
                        </React.Fragment>
                      ))}
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
