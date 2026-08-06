import React, { useEffect, useState } from 'react';
import { Mic, X, ArrowUp, RotateCcw } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { transcribeAudio, TranscriptionResponse } from '../../services/voiceService';

interface VoiceRecorderProps {
  mode: 'therapist' | 'practice';
  onTranscriptionComplete: (result: TranscriptionResponse) => void;
  onCancel: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ mode, onTranscriptionComplete, onCancel }) => {
  const { isRecording, recordingTime, error, startRecording, stopRecording } = useVoiceRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  // Auto-start recording the moment the bar appears
  useEffect(() => {
    void startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (isTranscribing) return;
    setTranscriptionError(null);
    const blob = await stopRecording();
    if (!blob) return;
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(blob, mode);
      onTranscriptionComplete(result);
    } catch (err) {
      console.error('Transcription error:', err);
      setTranscriptionError('Transcription failed. Please try again.');
      setIsTranscribing(false);
    }
  };

  const handleCancel = () => {
    void stopRecording();
    onCancel();
  };

  const handleRetry = () => {
    setTranscriptionError(null);
    void startRecording();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const showError = error || transcriptionError;

  return (
    <div
      className="flex w-full items-center gap-2"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Cancel */}
      <button
        type="button"
        onClick={handleCancel}
        disabled={isTranscribing}
        style={{
          width: 40,
          height: 44,
          borderRadius: 12,
          border: "none",
          backgroundColor: "transparent",
          color: "rgba(26,18,8,0.45)",
          cursor: isTranscribing ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          opacity: isTranscribing ? 0.4 : 1,
        }}
        title="Cancel"
      >
        <X size={20} />
      </button>

      {/* Center status */}
      <div className="flex-1 min-w-0 flex items-center justify-center gap-2.5">
        {isRecording ? (
          <>
            <div className="relative flex items-center justify-center">
              <div
                className="absolute rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "rgba(239,68,68,0.2)",
                  animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              <div
                className="relative rounded-full flex items-center justify-center"
                style={{ width: 34, height: 34, backgroundColor: "#EF4444" }}
              >
                <Mic size={16} color="#FFFFFF" />
              </div>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: "#1A1208" }}>
              Recording
            </span>
            <span
              className="text-[13px] font-mono font-bold tabular-nums"
              style={{ color: "#C8522A" }}
            >
              {formatTime(recordingTime)}
            </span>
          </>
        ) : isTranscribing ? (
          <>
            <div
              className="w-4 h-4 rounded-full animate-spin"
              style={{ border: "2px solid rgba(200,82,42,0.2)", borderTopColor: "#C8522A" }}
            />
            <span className="text-[13px] font-medium" style={{ color: "rgba(26,18,8,0.6)" }}>
              Transcribing…
            </span>
          </>
        ) : showError ? (
          <span className="text-[12px] font-medium" style={{ color: "#DC2626" }}>
            {showError}
          </span>
        ) : (
          <span className="text-[13px] font-medium" style={{ color: "rgba(26,18,8,0.45)" }}>
            Tap send to transcribe
          </span>
        )}
      </div>

      {/* Send / Retry */}
      {isTranscribing ? (
        <div style={{ width: 44, height: 44, flexShrink: 0 }} />
      ) : showError ? (
        <button
          type="button"
          onClick={handleRetry}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            border: "none",
            backgroundColor: "#C8522A",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title="Try again"
        >
          <RotateCcw size={18} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!isRecording}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            border: "none",
            backgroundColor: "#C8522A",
            color: "#FFFFFF",
            cursor: isRecording ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: isRecording ? 1 : 0.4,
          }}
          title="Stop and transcribe"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

export default VoiceRecorder;
