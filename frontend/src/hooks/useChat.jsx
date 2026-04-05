import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const useChat = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const historyRef = useRef([]); // track {role, content} history for backend

  const normalizeCitations = (citations) => {
    if (!Array.isArray(citations)) {
      return [];
    }

    return citations.filter(
      (citation) => typeof citation === "string" && citation.trim().length > 0,
    );
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
          const mergedCitations = [
            ...(last.citations || []),
            ...incomingCitations,
          ].filter((item, index, arr) => arr.indexOf(item) === index);

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
          return [...prev.slice(0, -1), finalized];
        }
        return prev;
      });
    });

    return () => newSocket.close();
  }, []);

  const sendMessage = (text) => {
    if (socket && text.trim()) {
      // Add to UI
      setMessages((prev) => [...prev, { text, sender: "user" }]);

      // Track in history (without current message — backend appends it)
      const currentHistory = [...historyRef.current];
      historyRef.current = [...currentHistory, { role: "user", content: text }];

      // Send message + history to Flask
      socket.emit("user_uttered", {
        message: text,
        history: currentHistory, // previous turns only
        sender: "user",
      });
    }
  };

  const resetChat = () => {
    setMessages([]);
    historyRef.current = [];
  };

  return {
    messages,
    sendMessage,
    resetChat,
    clearMessages: resetChat,
    isTyping,
  };
};
