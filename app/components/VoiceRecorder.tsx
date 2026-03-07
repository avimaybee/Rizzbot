import React, { useState, useEffect, useRef } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { transcribeAudio, TranscriptionResponse } from '../../services/voiceService';

interface VoiceRecorderProps {
  mode: 'therapist' | 'practice';
  onTranscriptionComplete: (result: TranscriptionResponse) => void;
  onCancel: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ mode, onTranscriptionComplete, onCancel }) => {
  const {
    isRecording,
    recordingTime,
    audioBlob,
    error,
    volume,
    startRecording,
    stopRecording,
    clearRecording
  } = useVoiceRecorder();

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handle audio blob changes to update preview
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setPlaybackUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPlaybackUrl(null);
    }
  }, [audioBlob]);

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    
    setTranscriptionError(null);
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(audioBlob, mode);
      onTranscriptionComplete(result);
    } catch (err: any) {
      console.error('Transcription error:', err);
      setTranscriptionError('Failed to transcribe audio. Gemini might be overloaded or the recording was too short. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div 
        className="voice-recorder-card w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="flex justify-between items-center w-full mb-2">
          <h3 className="text-xl font-bold text-[#1A1208]">Record Voice Note</h3>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Visualizer / Timer Area */}
        <div className="relative flex flex-col items-center justify-center w-full py-8">
          {isRecording && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-24 h-24 bg-[#C8522A]/10 rounded-full animate-ping"></div>
              <div className="w-32 h-32 bg-[#C8522A]/5 rounded-full animate-ping delay-300"></div>
            </div>
          )}
          
          <div className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-4 ${isRecording ? 'border-[#C8522A] bg-[#FEF4F0]' : 'border-[#F1EDE7] bg-[#F9F7F4]'}`}>
             {isRecording && (
               <div className="flex items-center gap-1 mb-2 h-8">
                 {[1, 0.8, 1.2, 0.6, 1.1, 0.9, 1.3].map((multiplier, i) => (
                   <div 
                     key={i}
                     className="w-1 bg-[#C8522A] rounded-full transition-all duration-75"
                     style={{ 
                       height: `${Math.max(4, volume * multiplier * 0.4)}px`,
                       opacity: 0.3 + (volume / 100) * 0.7
                     }}
                   />
                 ))}
               </div>
             )}
             <div className="text-3xl font-mono font-bold text-[#C8522A]">
                {formatTime(recordingTime)}
             </div>
          </div>
        </div>

        {(error || transcriptionError) && (
          <div className="w-full p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center font-medium">
            {error || transcriptionError}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-4 w-full">
          {!audioBlob ? (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98] ${
                isRecording 
                  ? 'bg-[#1A1208] text-white hover:bg-black' 
                  : 'bg-[#C8522A] text-white hover:shadow-lg shadow-[#C8522A]/20'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white'}`}></div>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              {playbackUrl && (
                <div className="flex items-center gap-3 bg-[#F9F7F4] p-3 rounded-2xl border border-[#E8E0D4]">
                  <audio ref={audioRef} src={playbackUrl} className="hidden" onEnded={() => {}} />
                  <button 
                    onClick={() => audioRef.current?.play()}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-[#C8522A]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <div className="flex-1 h-1.5 bg-[#E8E0D4] rounded-full overflow-hidden">
                    <div className="w-0 h-full bg-[#C8522A]"></div>
                  </div>
                  <button 
                    onClick={clearRecording}
                    className="text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-red-500"
                  >
                    Discard
                  </button>
                </div>
              )}

              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="w-full py-4 bg-[#C8522A] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-xl shadow-[#C8522A]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTranscribing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Transcribing...
                  </>
                ) : (
                  'Transcribe Note'
                )}
              </button>
            </div>
          )}
          
          <p className="text-[11px] text-center text-gray-400 font-medium">
             Audio is processed securely and is not stored permanently.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorder;
