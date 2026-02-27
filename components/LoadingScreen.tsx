import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // Pulse and Haptic
    const pulseInterval = setInterval(() => {
      setPulse(prev => !prev);
      if (!pulse && 'vibrate' in navigator) {
        navigator.vibrate(5);
      }
    }, 1500);

    // Progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        const jump = Math.floor(Math.random() * 3) + 1;
        return Math.min(prev + jump, 100);
      });
    }, 100);

    return () => {
      clearInterval(pulseInterval);
      clearInterval(progressInterval);
    };
  }, [pulse]);

  return (
    <div className="fixed inset-0 z-[100] bg-matte-base flex flex-col items-center justify-center p-6 overflow-hidden font-sans select-none">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-white/[0.02] rounded-full blur-[120px]"></div>

      <div className="w-full max-w-sm flex flex-col items-center relative z-10">
        
        {/* Minimal Pulse Indicator */}
        <div className="relative mb-12 h-24 w-24 flex items-center justify-center">
          {/* Animated rings */}
          <div className={`absolute inset-0 border border-white/5 rounded-full transition-transform duration-[1500ms] ${pulse ? 'scale-125 opacity-0' : 'scale-75 opacity-20'}`}></div>
          <div className={`absolute inset-0 border border-white/10 rounded-full transition-transform duration-[1500ms] delay-300 ${pulse ? 'scale-110 opacity-0' : 'scale-90 opacity-40'}`}></div>
          
          {/* Core */}
          <div className={`relative z-10 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl transition-transform duration-[1500ms] ${pulse ? 'scale-105' : 'scale-95'}`}>
            <Activity className="w-5 h-5 text-white/40" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Synchronizing</div>
          <div className="text-3xl font-bold text-white tracking-tighter tabular-nums">{progress}%</div>
        </div>

        {/* Progress Bar - Functional */}
        <div className="w-48 h-1 bg-white/5 rounded-full mt-8 overflow-hidden">
          <div 
            className="h-full bg-white/20 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

      </div>
    </div>
  );
};
