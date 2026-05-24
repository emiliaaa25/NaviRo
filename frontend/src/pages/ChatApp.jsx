import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import useAuth from "../hooks/useAuth";
import { Volume2 } from "lucide-react";
import VoiceInput from "../components/VoiceInput";

const ChatBubbleIcon = () => (
  <svg
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const QUICK_CHIPS = [
  { label: "🏛️ Visa info", text: "Visa info" },
  { label: "🚌 Transport", text: "Transport options in my city" },
  { label: "📱 SIM card", text: "How do I get a SIM card in Romania?" },
  { label: "🏠 Housing", text: "Best student areas to live in Romania" },
  {
    label: "🏥 Healthcare",
    text: "How does Romanian healthcare work for students?",
  },
];

const TOPICS = [
  {
    icon: "🏛️",
    label: "Visa & Permits",
    text: "Visa & Permits for international students in Romania",
  },
  {
    icon: "🏥",
    label: "Healthcare",
    text: "Healthcare for international students in Romania",
  },
  {
    icon: "🏠",
    label: "Housing",
    text: "Student housing options in Romania",
  },
  {
    icon: "🎓",
    label: "University life",
    text: "University life as an international student in Romania",
  },
  {
    icon: "🏦",
    label: "Banking",
    text: "Banking for international students in Romania",
  },
  {
    icon: "🚌",
    label: "Transport",
    text: "Public transport options for students in Romania",
  },
];

const TIPS = [
  {
    icon: "📋",
    title: "Register within 90 days",
    body: "All non-EU students must register at the Immigration Office (IGI) within 90 days of arrival. Start early as queues can be long.",
  },
  {
    icon: "💊",
    title: "Get a family doctor (medic de familie)",
    body: "Register with a local GP as soon as possible — this is your gateway to the Romanian public health system and free specialist referrals.",
  },
  {
    icon: "🚇",
    title: "Get a student transport card",
    body: "Most Romanian cities offer heavily discounted or free public transport for students. Bring your student ID to the local transport office.",
  },
  {
    icon: "🛒",
    title: "Shop at local piețe (markets)",
    body: "Fresh produce at outdoor markets is far cheaper than supermarkets and a great way to practice Romanian with locals.",
  },
  {
    icon: "🗣️",
    title: "Learn a few Romanian phrases",
    body: '"Vă rog" (please), "Mulțumesc" (thank you), "Scuze" (sorry) — locals genuinely appreciate any effort with the language.',
  },
];

function ChatApp() {
  const {
    messages,
    sendMessage,
    clearMessages,
    historyLoaded,
    recentChats,
    activeChatId,
    selectRecentChat,
  } = useChat();
  const [input, setInput] = useState("");
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleChip = (text) => {
    sendMessage(text);
  };

  const handleTopic = (text) => {
    setActiveTab("chat");
    sendMessage(text);
  };

  const handleNewChat = () => {
    clearMessages();
    setActiveTab("chat");
  };

  const stopBotSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  const handleSpeakBotMessage = (text, messageId) => {
    const spokenText = String(text || "").trim();

    if (!spokenText || !window.speechSynthesis) {
      return;
    }

    if (speakingMessageId === messageId && window.speechSynthesis.speaking) {
      stopBotSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    setSpeakingMessageId(messageId);
    utterance.onend = () => {
      setSpeakingMessageId((currentId) =>
        currentId === messageId ? null : currentId,
      );
    };
    utterance.onerror = () => {
      setSpeakingMessageId((currentId) =>
        currentId === messageId ? null : currentId,
      );
    };
    window.speechSynthesis.speak(utterance);
  };

  const displayName = user?.username || "there";
  const userInitial = (user?.username || "?").charAt(0).toUpperCase();
  const sidebarSubtitle = "International student";

  const tabClass = (id) => `nv-nav-tab${activeTab === id ? " nv-active" : ""}`;

  const renderInlineText = (text, keyPrefix = "inline") => {
    const value = String(text || "");
    const nodes = [];
    const regex = /(\*\*(.+?)\*\*)|(\[(.+?)\]\((https?:\/\/[^\s)]+)\))/g;
    let lastIndex = 0;
    let match;
    let idx = 0;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(value.slice(lastIndex, match.index));
      }

      if (match[2]) {
        nodes.push(
          <strong key={`${keyPrefix}-b-${idx}`} className="nv-md-strong">
            {match[2]}
          </strong>,
        );
      } else if (match[4] && match[5]) {
        nodes.push(
          <a
            key={`${keyPrefix}-a-${idx}`}
            href={match[5]}
            target="_blank"
            rel="noreferrer"
            className="nv-md-link"
          >
            {match[4]}
          </a>,
        );
      }

      lastIndex = regex.lastIndex;
      idx += 1;
    }

    if (lastIndex < value.length) {
      nodes.push(value.slice(lastIndex));
    }

    return nodes.length > 0 ? nodes : value;
  };

  const renderBotText = (text) => {
    const lines = String(text || "").split(/\r?\n/);
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i += 1;
        continue;
      }

      const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
      if (headingMatch) {
        blocks.push(
          <p key={`h-${i}`} className="nv-md-heading">
            {renderInlineText(headingMatch[1], `h-${i}`)}
          </p>,
        );
        i += 1;
        continue;
      }

      if (
        line.includes("|") &&
        i + 1 < lines.length &&
        /^\s*\|?\s*[-:]+[-| :]*\|\s*$/.test(lines[i + 1].trim())
      ) {
        const headerCells = line
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());

        i += 2; // skip header + separator row
        const rows = [];
        while (i < lines.length && lines[i].includes("|")) {
          const rowLine = lines[i].trim();
          if (!rowLine) {
            break;
          }
          const cells = rowLine
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
          rows.push(cells);
          i += 1;
        }

        blocks.push(
          <div key={`tbl-${i}`} className="nv-md-table-wrap">
            <table className="nv-md-table">
              <thead>
                <tr>
                  {headerCells.map((cell, idx) => (
                    <th key={`th-${idx}`}>
                      {renderInlineText(cell, `th-${i}-${idx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              {rows.length > 0 && (
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={`tr-${rowIdx}`}>
                      {row.map((cell, colIdx) => (
                        <td key={`td-${rowIdx}-${colIdx}`}>
                          {renderInlineText(
                            cell,
                            `td-${i}-${rowIdx}-${colIdx}`,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>,
        );
        continue;
      }

      if (/^(-|\*)\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*(-|\*)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*(-|\*)\s+/, "").trim());
          i += 1;
        }
        blocks.push(
          <ul key={`ul-${i}`} className="nv-md-list">
            {items.map((item, idx) => (
              <li key={`uli-${idx}`}>
                {renderInlineText(item, `ul-${i}-${idx}`)}
              </li>
            ))}
          </ul>,
        );
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
          i += 1;
        }
        blocks.push(
          <ol key={`ol-${i}`} className="nv-md-list nv-md-list-ordered">
            {items.map((item, idx) => (
              <li key={`oli-${idx}`}>
                {renderInlineText(item, `ol-${i}-${idx}`)}
              </li>
            ))}
          </ol>,
        );
        continue;
      }

      blocks.push(
        <p key={`p-${i}`} className="nv-md-paragraph">
          {renderInlineText(line, `p-${i}`)}
        </p>,
      );
      i += 1;
    }

    return blocks.length > 0 ? blocks : text;
  };

  const renderCitationLinks = (citations, keyPrefix = "citations") => {
    // Support citations as strings (urls) or objects {url, title}
    const input = Array.isArray(citations) ? citations : [];
    const urlToTitle = {};
    const urls = [];
    input.forEach((c) => {
      if (!c) return;
      if (typeof c === "string") {
        const u = c.trim();
        if (u && !urls.includes(u)) urls.push(u);
      } else if (typeof c === "object" && c.url) {
        const u = c.url.trim();
        if (u && !urls.includes(u)) urls.push(u);
        if (c.title) urlToTitle[c.url] = c.title;
      }
    });

    const uniqueCitations = urls;

    if (uniqueCitations.length === 0) {
      return null;
    }

    return (
      <div className="nv-chat-citations">
        <div className="nv-chat-citations-label">📚 Official Sources</div>
        <div className="nv-chat-citations-list">
          {uniqueCitations.map((citation, idx) => {
            const title =
              urlToTitle[citation] ||
              (() => {
                try {
                  return new URL(citation).hostname.replace(/^www\./, "");
                } catch {
                  return citation;
                }
              })();

            return (
              <a
                key={`${keyPrefix}-${idx}`}
                href={citation}
                target="_blank"
                rel="noreferrer"
                className="nv-chat-citation-link"
                title={title}
              >
                <span className="nv-citation-icon">🔗</span>
                <span className="nv-citation-title">{title}</span>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="nv-app">
      <aside className="nv-sidebar">
        

        <div className="nv-sidebar-section">
          <div className="nv-sidebar-section-label">Recent chats</div>
          <div className="nv-recent-chat-list">
            {recentChats.length > 0 ? (
              recentChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`nv-prev-chat${activeChatId === chat.id ? " nv-active" : ""}`}
                  onClick={() => selectRecentChat(chat.id)}
                >
                  <ChatBubbleIcon />
                  <span className="nv-prev-chat-text">
                    <span className="nv-prev-chat-title">{chat.title}</span>
                    <span className="nv-prev-chat-preview">
                      {chat.preview || "Open conversation"}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="nv-prev-chat-muted">
                <span className="nv-prev-chat" style={{ cursor: "default" }}>
                  <ChatBubbleIcon />
                  {historyLoaded
                    ? "Saved conversation loaded"
                    : "No saved history yet"}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="nv-btn-new-chat"
          onClick={handleNewChat}
        >
          <PlusIcon />
          New chat
        </button>

        <div className="nv-sidebar-bottom">
          <button
            type="button"
            className="nv-sidebar-user"
            onClick={() => navigate("/profile")}
          >
            <div className="nv-sidebar-avatar">{userInitial}</div>
            <div className="nv-sidebar-user-info">
              <div className="nv-sidebar-user-name">{displayName}</div>
              <div className="nv-sidebar-user-role">{sidebarSubtitle}</div>
            </div>
          </button>
        </div>
      </aside>

      <div className="nv-main">
        <div className="nv-chat-subnav" aria-label="Chat sections">
          <button
            type="button"
            className={tabClass("chat")}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={tabClass("topics")}
            onClick={() => setActiveTab("topics")}
          >
            Topics
          </button>
          <button
            type="button"
            className={tabClass("tips")}
            onClick={() => setActiveTab("tips")}
          >
            Tips
          </button>
        </div>

        {/* Chat */}
        <div
          className={`nv-panel nv-chat-panel${activeTab === "chat" ? " nv-active" : ""}`}
        >
          <div className="nv-chat-messages">
            {messages.length === 0 && (
              <div className="nv-welcome-msg nv-anim">
                <h2>Welcome {displayName}! What can I help you with today?</h2>
                <p>
                  Ask me anything about life in Romania — visas, healthcare,
                  housing and more.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`nv-chat-bubble-wrap nv-anim${msg.sender === "user" ? " nv-user" : ""}`}
              >
                {msg.sender === "bot" && (
                  <div className="nv-chat-avatar" aria-hidden>
                    🤖
                  </div>
                )}
                <div
                  className={`nv-chat-bubble${msg.sender === "user" ? " nv-user" : " nv-bot"}`}
                >
                  {msg.sender === "bot" ? (
                    <>
                      {renderBotText(msg.text)}
                      {renderCitationLinks(msg.citations, `msg-${i}`)}
                      <div className="nv-chat-bubble-actions">
                        <button
                          type="button"
                          className="nv-chat-speak-btn"
                          onClick={() => handleSpeakBotMessage(msg.text, i)}
                          title={
                            speakingMessageId === i &&
                            window.speechSynthesis?.speaking
                              ? "Stop reading aloud"
                              : "Read response aloud"
                          }
                        >
                          <Volume2 size={14} />
                          {speakingMessageId === i &&
                          window.speechSynthesis?.speaking
                            ? "Stop"
                            : "Speak"}
                        </button>
                      </div>
                    </>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
          </div>

          {messages.length === 0 && (
            <div className="nv-quick-chips">
              {QUICK_CHIPS.map((c) => (
                <button
                  key={c.text}
                  type="button"
                  className="nv-chip"
                  onClick={() => handleChip(c.text)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div className="nv-chat-input-bar">
            <div className="nv-chat-input-wrap">
              <span className="nv-chat-input-icon" aria-hidden>
                ✦
              </span>
              <input
                type="text"
                placeholder="Ask anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <VoiceInput
                compact={true}
                onTranscript={(text) =>
                  setInput(
                    String(text || "")
                      .replace(/#+/g, "")
                      .replace(/\s+/g, " ")
                      .trimStart(),
                  )
                }
                onSend={sendMessage}
              />
              <button
                type="button"
                className="nv-send-btn"
                onClick={handleSend}
                title="Send"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Topics */}
        <div
          className={`nv-panel nv-scroll-panel${activeTab === "topics" ? " nv-active" : ""}`}
        >
          <div className="nv-panel-inner">
            <div className="nv-panel-header">
              <h2>Topics</h2>
              <p>Browse by category to find what you need.</p>
            </div>
            <div className="nv-topics-card">
              <h3>What do you need help with?</h3>
              <p>Tap a topic to start a conversation</p>
              <div className="nv-topics-grid">
                {TOPICS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className="nv-topic-item"
                    onClick={() => handleTopic(t.text)}
                  >
                    <div className="nv-topic-item-icon">{t.icon}</div>
                    <div className="nv-topic-item-label">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div
          className={`nv-panel nv-scroll-panel${activeTab === "tips" ? " nv-active" : ""}`}
        >
          <div className="nv-panel-inner">
            <div className="nv-panel-header">
              <h2>Tips</h2>
              <p>Practical advice for your first weeks in Romania.</p>
            </div>
            <div className="nv-tips-card">
              <h3>Survival tips</h3>
              <p>Things every international student should know</p>
              {TIPS.map((tip) => (
                <div key={tip.title} className="nv-tip-item">
                  <div className="nv-tip-icon">{tip.icon}</div>
                  <div>
                    <div className="nv-tip-title">{tip.title}</div>
                    <div className="nv-tip-body">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Account summary → full profile */}
        <div
          className={`nv-panel nv-scroll-panel${activeTab === "account" ? " nv-active" : ""}`}
        >
          <div className="nv-account-inner">
            <div className="nv-panel-header">
              <h2>Account</h2>
              <p>Your profile and preferences.</p>
            </div>
            <div className="nv-account-card">
              <div className="nv-account-header-bg">
                <div className="nv-account-avatar-wrap">
                  <div className="nv-account-avatar" aria-hidden>
                    👤
                  </div>
                </div>
              </div>
              <div className="nv-account-info">
                <div className="nv-account-name">{displayName}</div>
                <div className="nv-account-role">
                  {user?.email || "Signed in"}
                </div>
                <div className="nv-account-divider" />
                <div className="nv-account-section-title">About</div>
                <div className="nv-account-field">
                  <label>Username</label>
                  <div className="nv-account-field-val">{user?.username}</div>
                </div>
                <div className="nv-account-field">
                  <label>Email</label>
                  <div className="nv-account-field-val">{user?.email}</div>
                </div>
                <div className="nv-account-divider" />
                <Link to="/profile" className="nv-btn-edit">
                  Edit profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatApp;