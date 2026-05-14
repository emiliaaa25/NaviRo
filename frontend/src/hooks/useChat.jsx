import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import useAuth from "./useAuth";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const useChat = () => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const historyRef = useRef([]); // track {role, content} history for backend
  const didHydrateHistoryRef = useRef(false);
  const didHydrateRecentChatsRef = useRef(false);
  const activeChatIdRef = useRef(null);

  const getRecentChatsKey = () =>
    user?.id ? `naviro_recent_chats_${user.id}` : null;

  const getChatTitle = (chatMessages) => {
    const firstUserMessage = (chatMessages || []).find(
      (message) =>
        message?.sender === "user" && String(message?.text || "").trim(),
    );

    const rawTitle = String(firstUserMessage?.text || "New chat")
      .trim()
      .replace(/\s+/g, " ");

    return rawTitle.length > 42 ? `${rawTitle.slice(0, 42).trim()}…` : rawTitle;
  };

  const persistRecentChats = (nextChats) => {
    const storageKey = getRecentChatsKey();
    if (!storageKey) {
      return;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(nextChats));
    } catch (error) {
      console.error("Failed to persist recent chats:", error);
    }
  };

  const updateRecentChats = (chatId, chatMessages) => {
    if (!chatId) {
      return;
    }

    const now = new Date().toISOString();
    const nextChat = {
      id: chatId,
      title: getChatTitle(chatMessages),
      preview: String(chatMessages?.[chatMessages.length - 1]?.text || "")
        .trim()
        .slice(0, 120),
      updatedAt: now,
      messages: chatMessages,
    };

    setRecentChats((prev) => {
      const nextChats = [
        nextChat,
        ...prev.filter((chat) => chat.id !== chatId),
      ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      persistRecentChats(nextChats);
      return nextChats;
    });
  };

  const openChat = (chatId, chatMessages) => {
    activeChatIdRef.current = chatId;
    setActiveChatId(chatId);
    setMessages(chatMessages);

    historyRef.current = (chatMessages || [])
      .filter((message) => message?.text)
      .map((message) => ({
        role: message.sender === "bot" ? "assistant" : "user",
        content: message.text,
      }));
  };

  const startFreshChat = () => {
    const newChatId = `chat-${Date.now()}`;
    activeChatIdRef.current = newChatId;
    setActiveChatId(newChatId);
    setMessages([]);
    historyRef.current = [];
    return newChatId;
  };

  const normalizeCitations = (citations) => {
    if (!Array.isArray(citations)) return [];

    // Normalize to objects {url, title}
    const out = [];
    citations.forEach((c) => {
      if (!c) return;
      if (typeof c === "string") {
        const u = c.trim();
        if (u) out.push({ url: u, title: null });
      } else if (typeof c === "object" && c.url) {
        out.push({ url: c.url, title: c.title || null });
      }
    });

    return out;
  };

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      path: import.meta.env.VITE_SOCKET_PATH || "/socket.io",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    setSocket(newSocket);

    // Each chunk arrives here — accumulate into the last bot message
    newSocket.on("bot_uttered", ({ text, metadata }) => {
      setIsTyping(true);
      const incomingCitations = normalizeCitations(metadata?.citations);

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        // If last message is already a streaming bot message, append to it
        if (last?.sender === "bot" && last?.streaming) {
          const existing = Array.isArray(last.citations) ? last.citations : [];
          const combined = [...existing, ...incomingCitations];
          // dedupe by url
          const mergedCitations = combined.filter(
            (item, idx, arr) =>
              arr.findIndex((a) => a.url === item.url) === idx,
          );

          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + text, citations: mergedCitations },
          ];
        }
        // Otherwise start a new bot message
        return [
          ...prev,
          {
            text,
            sender: "bot",
            streaming: true,
            citations: incomingCitations,
          },
        ];
      });
    });

    // You'll need to emit this from Flask when the stream ends
    newSocket.on("bot_done", () => {
      setIsTyping(false);
      // Mark the last message as no longer streaming
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.sender === "bot") {
          const finalized = { ...last, streaming: false };
          // Save to history ref for next turn
          historyRef.current = [
            ...historyRef.current,
            { role: "assistant", content: last.text },
          ];
          if (activeChatIdRef.current) {
            updateRecentChats(activeChatIdRef.current, [
              ...prev.slice(0, -1),
              finalized,
            ]);
          }
          return [...prev.slice(0, -1), finalized];
        }
        return prev;
      });
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    const loadStoredConversation = async () => {
      if (!token || !user || didHydrateHistoryRef.current) {
        return;
      }

      didHydrateHistoryRef.current = true;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "/api"}/conversations?limit=20`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to load stored conversations:", data);
          }
          return;
        }

        const storedConversations = Array.isArray(data.sessions)
          ? data.sessions
          : [];

        if (storedConversations.length === 0) {
          setHistoryLoaded(false);
          return;
        }

        setHistoryLoaded(true);

        const normalizedSessions = storedConversations.map((session) => ({
          id: session?.id || `chat-${Date.now()}`,
          title: session?.title || "New chat",
          preview: session?.preview || "",
          updatedAt: session?.updatedAt || new Date().toISOString(),
          messages: Array.isArray(session?.messages) ? session.messages : [],
        }));

        setRecentChats(normalizedSessions);
        persistRecentChats(normalizedSessions);

        if (normalizedSessions.length > 0 && !activeChatIdRef.current) {
          const latestSession = normalizedSessions[0];
          openChat(
            latestSession.id,
            Array.isArray(latestSession.messages) ? latestSession.messages : [],
          );
        }
      } catch (err) {
        console.error("Network error loading stored conversations:", err);
      }
    };

    loadStoredConversation();
  }, [token, user]);

  useEffect(() => {
    if (!user?.id || didHydrateRecentChatsRef.current) {
      return;
    }

    const storageKey = getRecentChatsKey();
    if (!storageKey) {
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      const storedChats = raw ? JSON.parse(raw) : [];
      const chats = Array.isArray(storedChats) ? storedChats : [];

      didHydrateRecentChatsRef.current = true;
      setRecentChats(chats);

      if (chats.length > 0) {
        const latestChat = chats[0];
        openChat(
          latestChat.id,
          Array.isArray(latestChat.messages) ? latestChat.messages : [],
        );
      } else if (!historyLoaded) {
        startFreshChat();
      }
    } catch (error) {
      console.error("Failed to load recent chats:", error);
      didHydrateRecentChatsRef.current = true;
    }
  }, [user?.id, historyLoaded]);

  const sendMessage = (text) => {
    if (socket && text.trim()) {
      if (!activeChatIdRef.current) {
        startFreshChat();
      }

      // Add to UI
      setMessages((prev) => {
        const nextMessages = [...prev, { text, sender: "user" }];
        if (activeChatIdRef.current) {
          updateRecentChats(activeChatIdRef.current, nextMessages);
        }
        return nextMessages;
      });

      // Track in history (without current message — backend appends it)
      const currentHistory = [...historyRef.current];
      historyRef.current = [...currentHistory, { role: "user", content: text }];

      // Send message + history to Flask
      socket.emit("user_uttered", {
        message: text,
        history: currentHistory, // previous turns only
        sender: user?.id ?? user?.username ?? "user",
        session_id: activeChatIdRef.current,
      });
    }
  };

  const resetChat = () => {
    startFreshChat();
    setMessages([]);
    historyRef.current = [];
  };

  const selectRecentChat = (chatId) => {
    const selectedChat = recentChats.find((chat) => chat.id === chatId);
    if (!selectedChat) {
      return;
    }

    openChat(
      chatId,
      Array.isArray(selectedChat.messages) ? selectedChat.messages : [],
    );
    setIsTyping(false);
  };

  return {
    messages,
    sendMessage,
    resetChat,
    clearMessages: resetChat,
    isTyping,
    historyLoaded,
    recentChats,
    activeChatId,
    selectRecentChat,
  };
};
