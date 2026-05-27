import { useState, useRef, useCallback } from "react";
import useAuth from "./useAuth";


export const useVoice = () => {
  const { token } = useAuth();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);

 
  const startVoiceRecording = useCallback(async () => {
    try {
      setVoiceError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      return true;
    } catch (error) {
      const errorMsg =
        error.name === "NotAllowedError"
          ? "Microphone access denied"
          : error.name === "NotFoundError"
            ? "No microphone found"
            : error.message;

      setVoiceError(errorMsg);
      return false;
    }
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());

        audioChunksRef.current = [];
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);


  const transcribeAudio = useCallback(
    async (audioBlob, detectedLanguage = "en") => {
      setIsTranscribing(true);
      setVoiceError("");

      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("language", detectedLanguage);

        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5056";
        const response = await fetch(`${apiUrl}/chat/transcribe`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          return {
            success: true,
            transcript: data.transcript,
            language: data.detected_language || detectedLanguage,
            confidence: data.confidence,
          };
        } else {
          throw new Error(data.message || "Transcription failed");
        }
      } catch (error) {
        const errorMsg = error.message || "Transcription error";
        setVoiceError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setIsTranscribing(false);
      }
    },
    [token],
  );

 
  const playBotVoice = useCallback(
    async (text, voiceUrl, language = "en-US") => {
      setIsPlayingTTS(true);
      setVoiceError("");

      try {
        if (voiceUrl) {
          try {
            const audio = new Audio(voiceUrl);
            audio.onended = () => setIsPlayingTTS(false);
            audio.onerror = () => {
              console.warn(
                "Failed to play server voice URL, falling back to TTS",
              );
              playBrowserTTS(text, language);
            };
            audio.play();
            return;
          } catch (error) {
            console.warn("Error with voice URL, using browser TTS:", error);
          }
        }

        playBrowserTTS(text, language);
      } catch (error) {
        setVoiceError("Failed to play audio");
        setIsPlayingTTS(false);
      }
    },
    [],
  );


  const playBrowserTTS = useCallback((text, language) => {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => setIsPlayingTTS(false);
        utterance.onerror = () => {
          setVoiceError("TTS failed");
          setIsPlayingTTS(false);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        throw new Error("Speech Synthesis not supported");
      }
    } catch (error) {
      setVoiceError(error.message);
      setIsPlayingTTS(false);
    }
  }, []);

 
  const stopPlayback = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingTTS(false);
  }, []);

  
  const detectLanguage = useCallback((text, userPreference = "en") => {
    const romanianPatterns = [
      /\bă\b|\bî\b|\bș\b|\bț\b/, 
      /\bcare\b|\bpentru\b|\bcum\b|\bun\b/i, 
    ];

    const isRomanian = romanianPatterns.some((pattern) => pattern.test(text));

    return isRomanian ? "ro-RO" : "en-US";
  }, []);

 
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    startVoiceRecording,
    stopVoiceRecording,
    transcribeAudio,
    isTranscribing,

    playBotVoice,
    stopPlayback,
    isPlayingTTS,

    detectLanguage,
    cleanup,
    voiceError,
    clearError: () => setVoiceError(""),
  };
};

export default useVoice;
