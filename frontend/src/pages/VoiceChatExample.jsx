/**
 * Example Voice Chat Integration
 * Shows how to integrate VoiceInput component and useVoice hook into ChatApp
 */

import React, { useEffect, useState } from "react";
import VoiceInput from "../components/VoiceInput";
import useVoice from "../hooks/useVoice";
import useAuth from "../hooks/useAuth";
import { useChat } from "../hooks/useChat";

const VoiceChatExample = () => {
  // State management
  const { user, token } = useAuth();
  const { socket, messages, sendMessage: sendChatMessage } = useChat();
  const {
    transcribeAudio,
    playBotVoice,
    voiceError,
    isPlayingTTS,
    detectLanguage,
  } = useVoice();

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [enableTTS, setEnableTTS] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState("en-US");
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle voice input transcript
  const handleTranscript = (transcript) => {
    console.log("📝 Transcript received:", transcript);
  };

  // Handle sending voice message
  const handleSendVoiceMessage = async (transcript) => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    try {
      // Detect language from transcript
      const detectedLang = detectLanguage(transcript);
      console.log(`🔤 Detected language: ${detectedLang}`);

      // Send message via chat socket with voice metadata
      socket.emit("user_uttered", {
        message: transcript,
        sender: user?.id,
        session_id: `chat-${Date.now()}`,
        language: detectedLang,
        enable_tts: enableTTS,
        is_voice_message: true,
        transcription: transcript,
        history: messages
          .filter((m) => m.text)
          .map((m) => ({
            role: m.sender === "bot" ? "assistant" : "user",
            content: m.text,
          })),
      });

      // Listen for bot response and play if TTS enabled
      if (enableTTS) {
        socket.once("bot_uttered", ({ text, metadata }) => {
          console.log("🤖 Bot response:", text);
          if (metadata?.voice_response_url && enableTTS) {
            console.log("🔊 Playing TTS response...");
            playBotVoice(text, metadata.voice_response_url, metadata.language);
          }
        });
      }
    } catch (error) {
      console.error("Error sending voice message:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle playing voice for messages
  const handlePlayVoiceMessage = async (messageText) => {
    try {
      playBotVoice(messageText, null, currentLanguage);
    } catch (error) {
      console.error("Error playing message:", error);
    }
  };

  return (
    <div className="voice-chat-example">
      <style jsx>{`
        .voice-chat-example {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          border-radius: 8px;
          background-color: #f9fafb;
        }

        .voice-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .voice-control-btn {
          padding: 8px 16px;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .voice-control-btn:hover {
          border-color: #0066cc;
          color: #0066cc;
        }

        .voice-control-btn.active {
          background: #0066cc;
          color: white;
          border-color: #0066cc;
        }

        .voice-status {
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }

        .voice-status.error {
          background-color: #fee;
          color: #c33;
          border-left: 3px solid #c33;
        }

        .voice-status.info {
          background-color: #e3f2fd;
          color: #1565c0;
          border-left: 3px solid #1565c0;
        }

        .message-with-voice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e1e8ed;
        }

        .play-voice-btn {
          padding: 4px 8px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .play-voice-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* Header */}
      <div>
        <h2>🎤 Voice Chat Example Integration</h2>
        <p>
          This demonstrates how to integrate voice chat features into your app
        </p>
      </div>

      {/* Voice Controls */}
      <div className="voice-controls">
        <button
          className={`voice-control-btn ${voiceEnabled ? "active" : ""}`}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
        >
          {voiceEnabled ? "🎤 Disable Voice" : "🎙️ Enable Voice"}
        </button>

        <button
          className={`voice-control-btn ${enableTTS ? "active" : ""}`}
          onClick={() => setEnableTTS(!enableTTS)}
        >
          {enableTTS ? "🔊 TTS On" : "🔇 TTS Off"}
        </button>

        <select
          value={currentLanguage}
          onChange={(e) => setCurrentLanguage(e.target.value)}
          className="voice-control-btn"
        >
          <option value="en-US">🇺🇸 English</option>
          <option value="ro-RO">🇷🇴 Română</option>
        </select>
      </div>

      {/* Error Display */}
      {voiceError && <div className="voice-status error">❌ {voiceError}</div>}

      {/* Status Display */}
      {isProcessing && (
        <div className="voice-status info">⏳ Processing voice message...</div>
      )}

      {isPlayingTTS && (
        <div className="voice-status info">🔊 Playing bot response...</div>
      )}

      {/* Voice Input Component */}
      {voiceEnabled && (
        <VoiceInput
          onTranscript={handleTranscript}
          onSend={handleSendVoiceMessage}
          isLoading={isProcessing}
        />
      )}

      {/* Example Message Display with Voice Controls */}
      <div>
        <h3>💬 Messages Example</h3>
        <div className="message-with-voice">
          <span>
            Bot: "Student housing in Iași is affordable and close to campus"
          </span>
          <button
            className="play-voice-btn"
            onClick={() =>
              handlePlayVoiceMessage(
                "Student housing in Iași is affordable and close to campus",
              )
            }
            disabled={isPlayingTTS}
          >
            {isPlayingTTS ? "Playing..." : "🔊 Play"}
          </button>
        </div>
      </div>

      {/* Implementation Notes */}
      <div style={{ paddingTop: "16px", borderTop: "1px solid #e1e8ed" }}>
        <h3>📋 Implementation Checklist</h3>
        <ul>
          <li>✅ VoiceInput component created with waveform visualization</li>
          <li>✅ useVoice hook for STT/TTS functionality</li>
          <li>✅ Database migration with voice fields</li>
          <li>✅ Backend transcription endpoint</li>
          <li>✅ Backend TTS generation endpoint</li>
          <li>✅ Socket.io event handlers updated</li>
          <li>✅ Language detection support</li>
          <li>⏳ Frontend integration in ChatApp (next step)</li>
        </ul>
      </div>

      {/* Usage Notes */}
      <div style={{ paddingTop: "16px", borderTop: "1px solid #e1e8ed" }}>
        <h3>📝 Next Steps</h3>
        <ol>
          <li>
            Install backend packages:
            <pre>cd bot/actions && pip install -r requirements.txt</pre>
          </li>
          <li>
            Run database migration:
            <pre>python migrate_voice_fields.py</pre>
          </li>
          <li>Import VoiceInput in ChatApp.jsx and add to render</li>
          <li>Use useVoice hook for voice functionality</li>
          <li>Update socket event listeners to handle voice metadata</li>
          <li>Test with real voice input and verify TTS playback</li>
        </ol>
      </div>
    </div>
  );
};

export default VoiceChatExample;
