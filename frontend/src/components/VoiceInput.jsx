import React, { useEffect, useState, useRef } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import "../styles/VoiceInput.css";

const VoiceInput = ({ onTranscript, onSend, isLoading, compact = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [waveform, setWaveform] = useState([]);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);
  const isRecordingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const waveformIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const normalizeTranscript = (value) =>
    String(value || "")
      .replace(/#+/g, "")
      .replace(/\s+/g, " ")
      .trim();

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const startRecognition = () => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    try {
      recognition.start();
    } catch (error) {
      if (error?.name !== "InvalidStateError") {
        console.error("Failed to start speech recognition:", error);
      }
    }
  };

  const stopMicrophoneStream = () => {
    if (waveformIntervalRef.current) {
      cancelAnimationFrame(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setWaveform([]);
  };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language;

    recognition.onstart = () => {
      isRecordingRef.current = true;
      shouldStopRef.current = false;
      setIsRecording(true);
      setError("");
      initializeAudioVisualization();
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const cleanedTranscript = normalizeTranscript(
        finalTranscript || interimTranscript,
      );

      setTranscript(cleanedTranscript);
      onTranscriptRef.current?.(cleanedTranscript);
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);

      if (
        !shouldStopRef.current &&
        [
          "no-speech",
          "network",
          "audio-capture",
          "service-not-allowed",
        ].includes(event.error)
      ) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!shouldStopRef.current) {
            startRecognition();
          }
        }, 400);
      }
    };

    recognition.onend = () => {
      isRecordingRef.current = false;

      if (shouldStopRef.current) {
        setIsRecording(false);
        stopMicrophoneStream();
        return;
      }

      restartTimeoutRef.current = setTimeout(() => {
        if (!shouldStopRef.current) {
          startRecognition();
        }
      }, 250);
    };

    recognitionRef.current = recognition;

    return () => {
      shouldStopRef.current = true;
      isRecordingRef.current = false;

      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

      recognition.abort();
      stopMicrophoneStream();
    };
  }, [language]);

  const initializeAudioVisualization = async () => {
    try {
      if (waveformIntervalRef.current) {
        cancelAnimationFrame(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }

      if (mediaStreamRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(
          mediaStreamRef.current,
        );
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;

        source.connect(analyser);
        analyserRef.current = analyser;

        const draw = () => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);

          const bars = [];
          const step = Math.floor(dataArray.length / 20);
          for (let i = 0; i < 20; i++) {
            const value = dataArray[i * step] / 255;
            bars.push(value);
          }
          setWaveform(bars);

          waveformIntervalRef.current = requestAnimationFrame(draw);
        };

        draw();
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);
      analyserRef.current = analyser;

      const draw = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const bars = [];
        const step = Math.floor(dataArray.length / 20);
        for (let i = 0; i < 20; i++) {
          const value = dataArray[i * step] / 255;
          bars.push(value);
        }
        setWaveform(bars);

        waveformIntervalRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied");
    }
  };

  const stopAudioVisualization = () => {
    if (waveformIntervalRef.current) {
      cancelAnimationFrame(waveformIntervalRef.current);
    }
    setWaveform([]);
  };

  const handleToggleRecording = () => {
    if (isRecordingRef.current) {
      shouldStopRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopMicrophoneStream();
    } else {
      if (recognitionRef.current) {
        setTranscript("");
        shouldStopRef.current = false;
        startRecognition();
      }
    }
  };

  const handleSendTranscript = () => {
    if (transcript.trim()) {
      onSend?.(normalizeTranscript(transcript));
      setTranscript("");
    }
  };

  const handlePlayback = () => {
    if (!transcript) return;

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.lang = language;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  if (compact) {
    return (
      <div className="nv-voice-mic-button">
        <button
          type="button"
          className={`nv-voice-btn ${isRecording ? "recording" : ""}`}
          onClick={handleToggleRecording}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        {isRecording && waveform.length > 0 && (
          <div className="nv-waveform-mini">
            {waveform.map((value, idx) => (
              <div
                key={idx}
                className="nv-waveform-bar"
                style={{ height: `${value * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="nv-voice-input-container">
      {error && <div className="nv-voice-error">{error}</div>}

      <div className="nv-voice-header">
        <div className="nv-voice-language-selector">
          <label htmlFor="voice-lang">Language:</label>
          <select id="voice-lang" value={language} disabled>
            <option value="en-US">English</option>
          </select>
        </div>
      </div>

      {isRecording && waveform.length > 0 && (
        <div className="nv-waveform-container">
          {waveform.map((value, idx) => (
            <div
              key={idx}
              className="nv-waveform-bar"
              style={{ height: `${value * 100}%` }}
            />
          ))}
        </div>
      )}

      {transcript && <div className="nv-transcript-display">{transcript}</div>}

      <div className="nv-voice-controls">
        <button
          type="button"
          className={`nv-record-btn ${isRecording ? "recording" : ""}`}
          onClick={handleToggleRecording}
        >
          {isRecording ? (
            <>
              <MicOff size={16} />
              Stop
            </>
          ) : (
            <>
              <Mic size={16} />
              Start
            </>
          )}
        </button>

        {transcript && (
          <>
            <button
              type="button"
              className="nv-playback-btn"
              onClick={handlePlayback}
              disabled={isSpeaking}
            >
              <Volume2 size={16} />
              {isSpeaking ? "Playing..." : "Play"}
            </button>

            <button
              type="button"
              className="nv-send-transcript-btn"
              onClick={handleSendTranscript}
            >
              Send
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceInput;
