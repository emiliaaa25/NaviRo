import { useEffect, useState } from "react";
import io from "socket.io-client";

const SOCKET_URL = "http://localhost:5005"; // Your Rasa Server

export const useChat = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on("bot_uttered", (message) => {
      setMessages((prev) => [...prev, { text: message.text, sender: "bot" }]);
    });

    return () => newSocket.close();
  }, []);

  const sendMessage = (text) => {
    if (socket && text.trim()) {
      setMessages((prev) => [...prev, { text, sender: "user" }]);
      socket.emit("user_uttered", { message: text });
    }
  };

  return { messages, sendMessage };
};
