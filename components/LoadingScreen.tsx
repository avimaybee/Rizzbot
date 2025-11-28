import React, { useState, useEffect } from 'react';

const LOADING_PHRASES = [
  "INITIALIZING SCAN",
  "ACCESSING PUBLIC RECORDS",
  "TRIANGULATING SIGNALS",
  "ANALYZING BEHAVIOR",
  "DECODING VIBES",
  "CHECKING ALIBIS",
  "REVIEWING EVIDENCE",
  "READING THE ROOM",
  "SCANNING FOR RED FLAGS",
  "CROSS-REFERENCING DATA",
  "RUNNING DIAGNOSTICS"
];

const SNARKY_COMMENTS = [
  "this better be worth it",
  "the tea is loading",
  "manifesting clarity",
  "trust the process bestie",
  "no judgement... kinda",
  "the truth awaits",
  "brewing hot takes"
];

export const LoadingScreen: React.FC = () => {
  const [phrase, setPhrase] = useState(LOADING_PHRASES[0]);
  const [snarkyComment, setSnarkyComment] = useState(SNARKY_COMMENTS[0]);
  const [progress, setProgress] = useState(0);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        const jump = Math.floor(Math.random() * 8) + 1;
        return Math.min(prev + jump, 100);
      });

      if (Math.random() > 0.8) {
        setPhrase(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]);
      }
      
      // Random glitch effect
      if (Math.random() > 0.95) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 100);
      }

    }, 100);
    
    // Update snarky comment less frequently
    const snarkyInterval = setInterval(() => {
      setSnarkyComment(SNARKY_COMMENTS[Math.floor(Math.random() * SNARKY_COMMENTS.length)]);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(snarkyInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-matte-base flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Scan lines overlay */}
      <div className="absolute inset-0 bg-scan-lines opacity-10 pointer-events-none"></div>
      
      <div className="w-full max-w-md relative text-center">
        
        <div className="mb-12 relative">
            <h1 className="text-[10rem] font-impact text-zinc-900 leading-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap opacity-20 z-0">
                LOADING
            </h1>
            <div className={`relative z-10 text-8xl font-impact text-white transition-transform ${glitch ? 'translate-x-1 skew-x-2' : ''}`}>
                {progress}%
            </div>
            {/* Glitch overlay */}
            {glitch && (
              <div className="absolute inset-0 z-20 text-8xl font-impact text-hard-gold opacity-50 translate-x-1">
                {progress}%
              </div>
            )}
        </div>

        <div className="relative z-10 border-t border-zinc-800 pt-6 inline-block w-full">
            <div className="label-sm text-zinc-500 mb-2">SYSTEM STATUS</div>
            <div className={`font-editorial text-xl text-zinc-300 uppercase tracking-widest ${glitch ? 'text-hard-gold' : ''}`}>
                <span className="animate-pulse">{phrase}...</span>
            </div>
            {/* Snarky comment */}
            <div className="text-[10px] font-mono text-zinc-600 mt-3 italic">
              ({snarkyComment})
            </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full h-1 bg-zinc-900 mt-12 relative overflow-hidden">
            <div 
                className="h-full bg-white transition-all duration-100 ease-out"
                style={{ width: `${progress}%` }}
            ></div>
            {/* Scanning effect */}
            <div className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
                 style={{ left: `${progress - 4}%` }}></div>
        </div>
        
        {/* Matrix-style dots */}
        <div className="flex justify-center gap-1 mt-6">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i}
              className={`w-1.5 h-1.5 bg-zinc-700 ${progress > (i + 1) * 20 ? 'bg-white' : ''} transition-colors`}
            ></div>
          ))}
        </div>

      </div>
    </div>
  );
};