import React, { useState } from 'react';
import { GhostResult } from '../types';
import { MemeGenerator } from './MemeGenerator';

interface ResultCardProps {
  result: GhostResult;
  onReset: () => void;
  targetName: string;
}

// Visual Assets
const WireframeGlobe = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className={className}>
    <circle cx="50" cy="50" r="48" />
    <ellipse cx="50" cy="50" rx="48" ry="20" />
    <ellipse cx="50" cy="50" rx="48" ry="35" transform="rotate(45 50 50)" />
    <ellipse cx="50" cy="50" rx="48" ry="35" transform="rotate(-45 50 50)" />
    <path d="M50 2v96" />
    <path d="M2 50h96" />
  </svg>
);

const PanelCorner = () => (
    <div className="absolute top-1 right-1 text-zinc-700 text-[8px]">+</div>
);

export const ResultCard: React.FC<ResultCardProps> = ({ result, onReset, targetName }) => {
  const isCooked = result.cookedLevel > 50;
  const [copied, setCopied] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const shareText = `#DeadOrGhosting ${result.cookedLevel}% for ${targetName} 😂`;
  const shareUrl = "https://deadorghosting.lol";

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const handleWhatsappShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    window.open(url, '_blank');
  };
  
  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-black p-1">
      {/* MATTE BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-1 auto-rows-min bg-black border border-black">
        
        {/* 1. MAIN VERDICT CARD (Solid Matte) */}
        <div className="md:col-span-2 lg:col-span-2 row-span-2 bg-matte-panel relative flex flex-col justify-between min-h-[350px] overflow-hidden group">
          <PanelCorner />
          
          {/* FLOATING VERDICT PILL */}
          <div className="absolute top-6 right-6 z-20">
             <div className={`px-4 py-2 rounded-full border ${isCooked ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-green-500/10 border-green-500 text-green-500'} flex items-center gap-2 backdrop-blur-md shadow-lg`}>
                <div className={`w-2 h-2 rounded-full ${isCooked ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
                <span className="label-sm text-current">{isCooked ? 'TERMINAL' : 'ACTIVE'}</span>
             </div>
          </div>

          <div className="p-8 relative z-10 flex-1 flex flex-col justify-center">
             <div className="label-sm text-zinc-500 mb-2">Subject Analysis</div>
             <h1 className="text-4xl font-impact text-white mb-1 uppercase tracking-wider">{targetName}</h1>
             
             <div className="mt-8">
                 <h2 className={`text-[6rem] md:text-[8rem] font-impact leading-[0.8] ${isCooked ? 'text-hard-red' : 'text-hard-blue'} uppercase`}>
                    {isCooked ? "WASTED" : "ALIVE"}
                 </h2>
                 <p className="text-lg font-editorial text-zinc-300 mt-4 max-w-md leading-relaxed border-l-2 border-zinc-700 pl-4">
                   {result.verdict}
                 </p>
             </div>
          </div>

          {/* PROGRESS FOOTER */}
          <div className="p-8 border-t border-zinc-800 bg-zinc-900/50">
             <div className="flex justify-between items-end mb-2">
                <span className="label-sm text-zinc-500">PROBABILITY</span>
                <span className="font-mono text-xl text-white font-bold">{result.cookedLevel}%</span>
             </div>
             <div className="w-full h-4 bg-black border border-zinc-800 p-0.5">
                <div 
                   className={`h-full ${isCooked ? 'bg-hard-red' : 'bg-green-500'} bg-[length:4px_4px] bg-[linear-gradient(45deg,rgba(0,0,0,0.2)25%,transparent_25%,transparent_50%,rgba(0,0,0,0.2)50%,rgba(0,0,0,0.2)75%,transparent_75%,transparent)]`} 
                   style={{ width: `${result.cookedLevel}%` }}
                ></div>
             </div>
          </div>
        </div>

        {/* 2. ACTIONS CARD */}
        <div className="bg-matte-panel p-6 flex flex-col justify-between md:col-span-1 border-l border-black relative">
           <PanelCorner />
           <div>
              <h3 className="label-sm text-zinc-500 mb-6">Protocol Options</h3>
              <div className="space-y-3">
                <button onClick={onReset} className="w-full text-left group">
                   <div className="text-2xl font-impact text-zinc-400 group-hover:text-white transition-colors uppercase">NEW SCAN</div>
                   <div className="h-px w-full bg-zinc-800 group-hover:bg-hard-gold transition-colors mt-1"></div>
                </button>
                <button onClick={handleCopy} className="w-full text-left group">
                   <div className="text-2xl font-impact text-zinc-400 group-hover:text-white transition-colors uppercase">{copied ? "COPIED!" : "SHARE URL"}</div>
                   <div className="h-px w-full bg-zinc-800 group-hover:bg-hard-blue transition-colors mt-1"></div>
                </button>
              </div>
           </div>
           <div className="flex gap-1 mt-6">
              <button onClick={handleTwitterShare} className="flex-1 h-10 bg-zinc-800 hover:bg-white hover:text-black text-white font-bold text-xs uppercase transition-colors">X / TWITTER</button>
              <button onClick={handleWhatsappShare} className="flex-1 h-10 bg-zinc-800 hover:bg-[#25D366] hover:text-white text-white font-bold text-xs uppercase transition-colors">WHATSAPP</button>
           </div>
        </div>

        {/* 3. MEME GENERATOR (Tall) */}
        <div className="md:col-span-1 lg:col-span-1 row-span-2 bg-matte-panel p-4 flex flex-col relative">
           <PanelCorner />
           <div className="flex-1 bg-zinc-950 flex items-center justify-center border border-zinc-800 mb-4 overflow-hidden">
              <MemeGenerator name={targetName} score={result.cookedLevel} verdict={result.verdict} />
           </div>
           <div className="text-center">
             <span className="label-sm text-zinc-600">EVIDENCE CARD GENERATOR</span>
           </div>
        </div>

        {/* 4. EVIDENCE LIST (Wide) */}
        <div className="md:col-span-2 lg:col-span-3 bg-matte-panel relative min-h-[300px] flex flex-col">
           <PanelCorner />
           <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 bg-hard-gold rotate-45"></div>
                 <h3 className="label-sm text-hard-gold">FORENSIC LOG</h3>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto scrollbar-hide">
              {result.evidence.map((item, idx) => {
                  const isOpen = expandedIndex === idx;
                  return (
                    <div key={idx} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors">
                      <button 
                        onClick={() => setExpandedIndex(isOpen ? null : idx)}
                        className="w-full flex justify-between items-start p-5 text-left group"
                      >
                        <div className="flex gap-6 items-baseline">
                          <span className="font-mono text-xs text-zinc-600">0{idx+1}</span>
                          <div>
                             <div className="label-sm text-zinc-500 mb-1">{item.label}</div>
                             <div className="text-lg font-editorial text-zinc-200 group-hover:text-white leading-tight">{item.detail}</div>
                          </div>
                        </div>
                        <div className={`px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider ${item.status === 'clean' ? 'border-green-900 text-green-500' : 'border-red-900 text-red-500'}`}>
                           {item.status}
                        </div>
                      </button>
                      
                      {isOpen && (
                        <div className="p-4 bg-black/50">
                          {/* RETRO WINDOW STYLE POPUP */}
                          <div className="bg-zinc-900 border-2 border-zinc-700 shadow-2xl max-w-2xl mx-auto">
                             <div className="bg-zinc-800 border-b border-zinc-700 p-1 flex justify-between items-center px-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">EVIDENCE_VIEWER.EXE</span>
                                <div className="flex gap-1">
                                   <div className="w-3 h-3 bg-zinc-700 border border-zinc-600 flex items-center justify-center text-[8px] text-zinc-400">_</div>
                                   <div className="w-3 h-3 bg-zinc-700 border border-zinc-600 flex items-center justify-center text-[8px] text-zinc-400">□</div>
                                   <div onClick={() => setExpandedIndex(null)} className="w-3 h-3 bg-red-900 border border-red-700 flex items-center justify-center text-[8px] text-white cursor-pointer hover:bg-red-700">X</div>
                                </div>
                             </div>
                             <div className="p-6 font-mono text-xs text-zinc-300">
                                <div className="mb-4 text-zinc-500 border-b border-zinc-800 pb-2">
                                  SOURCE: {item.source || 'UNKNOWN'}
                                </div>
                                <div className="bg-black p-4 border border-zinc-800 text-green-500">
                                  {'>'} {item.snippet || 'No raw data available.'}
                                </div>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
              })}
           </div>
        </div>

        {/* 5. OSINT (Wide) */}
        {result.socialScan && result.socialScan.length > 0 && (
           <div className="md:col-span-3 lg:col-span-4 bg-matte-panel p-8 relative overflow-hidden group">
              <PanelCorner />
              <div className="absolute top-0 right-0 w-[300px] h-[300px] text-zinc-800 opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/3 group-hover:text-zinc-700 transition-colors">
                 <WireframeGlobe />
              </div>

              <h3 className="label-sm text-hard-blue mb-6">DIGITAL FOOTPRINT // OSINT</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                 {result.socialScan.map((scan, idx) => (
                    <div key={idx} className="bg-zinc-900 border border-zinc-800 p-4 hover:border-white transition-colors flex flex-col justify-between h-24">
                       <div className="flex justify-between items-start">
                          <span className="font-bold text-xs uppercase tracking-wider text-white">{scan.platform}</span>
                          <span className={`w-2 h-2 rounded-full ${scan.status === 'active' ? 'bg-green-500' : 'bg-zinc-700'}`}></span>
                       </div>
                       <div>
                          <div className="text-[10px] text-zinc-400 truncate">{scan.detail}</div>
                          <div className="text-[9px] font-mono text-zinc-600 mt-1 uppercase">{scan.lastSeen}</div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

      </div>
    </div>
  );
};