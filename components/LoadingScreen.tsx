import React, { useState, useEffect } from 'react';

const LOADING_PHRASES = [
  "PINGING THE STREETS...",
  "CHECKING E-COURTS RECORDS...",
  "SCANNING FIR DATABASE...",
  "SEARCHING TIMES OF INDIA...",
  "CALCULATING SIMP COEFFICIENT...",
  "ASKING THE AUNTIES...",
  "CHECKING KUNDALI MATCH...",
  "PINGING OUIJA BOARD...",
  "RUNNING VIBE CHECK.EXE...",
  "SEARCHING FOR AUDACITY...",
  "ACCESSING WHATSAPP LEAKS...",
  "TRIANGULATING THE LIES...",
  "STALKING SPOTIFY PLAYLISTS...",
  "CHECKING STRAVA RUNS...",
  "LOOKING FOR VENMO RECEIPTS...",
  "SCANNING LINKEDIN ACTIVITY...",
  "DECODING MIXED SIGNALS...",
  "CHECKING TRUECALLER SPAM LIST...",
  "ANALYZING REPLY TIMES...",
  "CONSULTING THE ASTROLOGER..."
];

export const LoadingScreen: React.FC = () => {
  const [phrase, setPhrase] = useState(LOADING_PHRASES[0]);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Progress bar and logs
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        const jump = Math.floor(Math.random() * 5) + 1;
        return Math.min(prev + jump, 100);
      });

      // Randomly change phrase
      if (Math.random() > 0.7) {
        setPhrase(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]);
      }

      // Add "hacker" logs
      if (Math.random() > 0.5) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + Math.floor(Math.random() * 999);
        const newLog = `[${timestamp}] AUTH_TOKEN_RECEIVED: ${Math.random().toString(36).substring(7).toUpperCase()}`;
        setLogs(prev => [newLog, ...prev].slice(0, 8)); // Keep last 8 logs
      }

    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono p-4">
      {/* Background Grid/Grain is handled by body CSS, but we ensure black bg here */}
      
      <div className="w-full max-w-lg relative">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-2 border-b-2 border-hard-red pb-1">
          <span className="text-hard-red font-bold blink">SYSTEM OVERRIDE</span>
          <span className="text-xs text-zinc-500">CPU: {(Math.random() * 50 + 20).toFixed(1)}%</span>
        </div>

        {/* MAIN VISUAL */}
        <div className="border-4 border-white bg-zinc-900 p-6 mb-6 shadow-hard-blue relative overflow-hidden">
          
          {/* Animated striped background overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ 
                 backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)', 
                 backgroundSize: '20px 20px' 
               }}>
          </div>

          <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-3xl font-impact text-white mb-2 animate-pulse">
              {phrase}
            </h2>
            <div className="text-6xl font-impact text-hard-gold mb-4">
              {progress}%
            </div>
            
            {/* PROGRESS BAR */}
            <div className="w-full h-6 bg-black border-2 border-white relative">
              <div 
                className="h-full bg-hard-blue transition-all duration-100 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* TERMINAL LOGS */}
        <div className="bg-black border-2 border-zinc-700 p-2 font-mono text-xs h-32 overflow-hidden flex flex-col-reverse shadow-[4px_4px_0_#333]">
          {logs.map((log, idx) => (
            <div key={idx} className="text-green-500 whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="text-zinc-500 mr-2">{'>'}</span>{log}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};