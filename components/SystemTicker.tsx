import React from 'react';

export const SystemTicker: React.FC = () => (
  <div className="w-full bg-black border-t border-zinc-800 py-1 overflow-hidden shrink-0 flex items-center relative z-50">
    <div className="whitespace-nowrap animate-marquee flex gap-8">
      {[...Array(5)].map((_, i) => (
        <React.Fragment key={i}>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
            SYSTEM: ONLINE
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">
             // TARGET: LOCKED
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">
             // DETECTING LIES
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">
             // PROTOCOL: ROAST
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em] text-hard-gold">
            *** DO NOT TEXT BACK ***
          </span>
        </React.Fragment>
      ))}
    </div>
  </div>
);
