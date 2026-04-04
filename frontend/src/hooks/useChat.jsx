import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";

const SOCKET_URL = "http://127.0.0.1:5000";

export const useChat = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const historyRef = useRef([]); // track {role, content} history for backend

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Each chunk arrives here — accumulate into the last bot message
    newSocket.on("bot_uttered", ({ text }) => {
      setIsTyping(true);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        // If last message is already a streaming bot message, append to it
        if (last?.sender === "bot" && last?.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + text },
          ];
        }
        // Otherwise start a new bot message
        return [...prev, { text, sender: "bot", streaming: true }];
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

  return { messages, sendMessage, resetChat, isTyping };
};