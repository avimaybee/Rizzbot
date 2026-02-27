import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield, Cpu, Activity, Database, Radio, Search, AlertCircle } from 'lucide-react';

const LOADING_STEPS = [
  { id: 'SCAN', phrase: "INITIALIZING SCAN", icon: Search },
  { id: 'REC', phrase: "ACCESSING RECORDS", icon: Database },
  { id: 'SIG', phrase: "TRIANGULATING SIGNALS", icon: Radio },
  { id: 'ANA', phrase: "ANALYZING BEHAVIOR", icon: Activity },
  { id: 'CPU', phrase: "PROCESSING DATA", icon: Cpu },
  { id: 'PRO', phrase: "DECODING PROTOCOLS", icon: Shield },
];

const LOG_MESSAGES = [
  "UPLINK_STABLE",
  "NEURAL_MAP_READY",
  "CORE_TEMP_OPTIMAL",
  "VIBE_CHECK_PASS",
  "GLITCH_CORE_DETECTION",
  "ENCRYPTION_ACTIVE",
  "ALIBI_VERIFIED",
  "RED_FLAG_DETECTION_ON",
];

export const LoadingScreen: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>(["> INITIALIZING..."]);
  const [pulse, setPulse] = useState(false);
  const [glitch, setGlitch] = useState(false);
  
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Pulse and Haptic Loop
    const pulseInterval = setInterval(() => {
      setPulse(prev => !prev);
      if (!pulse && 'vibrate' in navigator) {
        // Subtle "thump" every second
        navigator.vibrate(5);
      }
    }, 1000);

    // Progress Loop
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        const jump = Math.floor(Math.random() * 5) + 1;
        return Math.min(prev + jump, 100);
      });

      // Random glitch
      if (Math.random() > 0.98) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 50);
      }
    }, 150);

    // Log & Step Loop
    const logInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newMsg = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
        setLog(prev => [...prev.slice(-4), `> ${newMsg}... [OK]`]);
      }
      
      // Update Step based on progress
      const newStep = Math.min(Math.floor((progress / 100) * LOADING_STEPS.length), LOADING_STEPS.length - 1);
      if (newStep !== stepIndex) {
        setStepIndex(newStep);
        if ('vibrate' in navigator) navigator.vibrate([10, 30]); // Thump for milestone
      }
    }, 800);

    return () => {
      clearInterval(pulseInterval);
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [progress, stepIndex, pulse]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const CurrentIcon = LOADING_STEPS[stepIndex].icon;

  return (
    <div className="fixed inset-0 z-[100] bg-matte-base flex flex-col items-center justify-center p-6 overflow-hidden font-mono select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-scan-lines opacity-[0.05] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-hard-gold/5 rounded-full blur-[100px] animate-pulse-slow"></div>
      <div className="bg-matte-grain"></div>

      <div className="w-full max-w-sm flex flex-col items-center">
        
        {/* THE PULSE ORB */}
        <div className="relative mb-16 h-32 w-32 flex items-center justify-center">
          {/* Outer Ring */}
          <div className={`absolute inset-0 border border-hard-gold/20 rounded-full transition-transform duration-1000 ${pulse ? 'scale-110 opacity-20' : 'scale-90 opacity-40'}`}></div>
          
          {/* Mid Ring */}
          <div className={`absolute inset-4 border border-hard-blue/20 rounded-full transition-transform duration-1000 delay-200 ${pulse ? 'scale-105 opacity-10' : 'scale-95 opacity-30'}`}></div>
          
          {/* Core Orb */}
          <div className={`relative z-10 w-16 h-16 rounded-full glass flex items-center justify-center border-white/10 shadow-[0_0_30px_rgba(251,191,36,0.15)] transition-all duration-1000 ${pulse ? 'scale-105 shadow-[0_0_40px_rgba(251,191,36,0.25)]' : 'scale-100'}`}>
            <CurrentIcon className={`w-8 h-8 ${glitch ? 'text-hard-gold translate-x-1' : 'text-white'} transition-all`} />
          </div>
          
          {/* Progress Indicator - Tactical Style */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
             <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-600 mb-1 font-bold">Protocol Status</div>
             <div className="text-xl font-impact text-white tracking-tighter">{progress}%</div>
          </div>
        </div>

        {/* PHASE & STEP */}
        <div className="w-full glass-dark p-6 relative border-white/5 shadow-2xl overflow-hidden mb-6">
           <div className="absolute top-0 left-0 w-1 h-full bg-hard-gold opacity-50"></div>
           
           <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-1 bg-hard-gold rounded-full animate-ping"></div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
                 System Diagnostics
              </div>
           </div>

           <div className="text-sm text-zinc-300 uppercase tracking-widest mb-6 min-h-[1.5em] flex items-center gap-3">
              <span className="text-hard-gold font-bold">{'>'}</span>
              <span className={glitch ? 'animate-pulse text-hard-gold' : ''}>
                 {LOADING_STEPS[stepIndex].phrase}
              </span>
           </div>

           {/* MINI LOG PANEL */}
           <div 
             ref={logRef}
             className="bg-black/40 border border-white/5 p-3 h-24 overflow-hidden font-mono text-[9px] text-zinc-600 space-y-1"
           >
              {log.map((msg, i) => (
                <p key={i} className={i === log.length - 1 ? 'text-zinc-400' : ''}>
                  {msg}
                </p>
              ))}
              <div className="w-1 h-3 bg-zinc-700 animate-blink inline-block ml-1"></div>
           </div>
        </div>

        {/* BOTTOM ACCENT: SYSTEM IDENTIFIER */}
        <div className="flex items-center gap-4 opacity-30">
           <div className="h-[1px] w-8 bg-zinc-800"></div>
           <div className="text-[8px] uppercase tracking-[0.5em] text-zinc-700 font-bold">
              RIZZBOT_OS_V2.0
           </div>
           <div className="h-[1px] w-8 bg-zinc-800"></div>
        </div>

      </div>
    </div>
  );
};
