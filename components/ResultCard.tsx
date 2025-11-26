import React, { useState } from 'react';
import { GhostResult } from '../types';
import { MemeGenerator } from './MemeGenerator';

interface ResultCardProps {
  result: GhostResult;
  onReset: () => void;
  targetName: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onReset, targetName }) => {
  const isCooked = result.cookedLevel > 50;
  const [copied, setCopied] = useState(false);

  // Exact text requested: "#DeadOrGhosting [score] for [name] 😂"
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
    <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6 relative pb-20">
      
      {/* LEFT COLUMN: RESULT CARD */}
      <div className="w-full md:w-2/3">
        <div className="bg-hard-gold text-black font-impact text-2xl px-4 py-2 flex justify-between items-center border-b-4 border-black">
          <span>MISSION REPORT</span>
          <span>ID: {Math.floor(Math.random() * 99999)}</span>
        </div>

        <div className="bg-hard-gray border-4 border-black p-6 md:p-10 relative overflow-hidden shadow-hard-white">
          
          {/* Background Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <span className="font-impact text-[200px] text-white">
              {isCooked ? "L" : "W"}
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            
            <div className="mb-6 border-2 border-white px-4 py-1 bg-black">
              <h2 className="text-hard-gold font-mono text-xl uppercase tracking-widest">
                TARGET: {targetName}
              </h2>
            </div>

            <h1 className={`text-7xl md:text-8xl lg:text-9xl font-impact leading-none mb-4 text-outline tracking-tighter ${isCooked ? 'text-hard-red' : 'text-hard-blue'}`}>
              {isCooked ? "WASTED" : "RESPECT"}
            </h1>

            <div className="w-full max-w-lg bg-black border-2 border-white p-1 mb-8">
              <div className="h-6 w-full bg-gray-900 relative">
                <div 
                  className={`h-full ${isCooked ? 'bg-hard-red' : 'bg-hard-gold'}`}
                  style={{ width: `${result.cookedLevel}%` }}
                />
              </div>
              <div className="flex justify-between text-white font-mono text-xs mt-1 px-1">
                <span>SAFE</span>
                <span>DAMAGE: {result.cookedLevel}%</span>
                <span>CRITICAL</span>
              </div>
            </div>

            <div className="bg-black/80 border border-hard-gold p-6 w-full mb-8 transform rotate-1">
              <p className="font-impact text-2xl md:text-3xl text-white uppercase leading-tight tracking-wide">
                "{result.verdict}"
              </p>
            </div>

            {/* MAIN EVIDENCE GRID */}
            <div className="w-full grid md:grid-cols-2 gap-4 text-left mb-6">
              {result.evidence.map((item, idx) => (
                <div key={idx} className="bg-white text-black p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h4 className="font-impact text-xl uppercase bg-black text-white inline-block px-1 mb-1">{item.label}</h4>
                  <p className="font-mono text-sm font-bold uppercase leading-tight">{item.detail}</p>
                </div>
              ))}
            </div>

            {/* SOCIAL FOOTPRINT / OSINT SECTION */}
            {result.socialScan && result.socialScan.length > 0 && (
              <div className="w-full bg-zinc-900 border-4 border-zinc-700 p-4 mb-8 text-left relative">
                 <div className="absolute -top-3 left-4 bg-hard-blue text-black font-impact px-2">DIGITAL FOOTPRINT</div>
                 <div className="space-y-3 pt-2">
                    {result.socialScan.map((scan, idx) => (
                      <div key={idx} className="flex items-start justify-between border-b border-zinc-800 pb-2 last:border-0">
                        <div>
                          <span className={`font-mono text-xs px-1 mr-2 ${scan.status === 'active' ? 'bg-green-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}>
                            {scan.platform.toUpperCase()}
                          </span>
                          <span className="font-mono text-sm text-white">{scan.detail}</span>
                        </div>
                        <span className="font-mono text-xs text-hard-gold text-right whitespace-nowrap ml-2">
                           {scan.lastSeen}
                        </span>
                      </div>
                    ))}
                 </div>
              </div>
            )}

          </div>

          {/* ACTIONS */}
          <div className="mt-4 flex flex-col gap-4 relative z-10">
             {/* Primary Actions */}
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={onReset}
                  className="bg-hard-concrete text-white font-impact text-2xl py-4 border-4 border-black hover:bg-white hover:text-black transition-all uppercase shadow-hard"
                >
                  RETRY
                </button>
                <button 
                  onClick={handleCopy}
                  className="bg-black text-white font-impact text-2xl py-4 border-4 border-white hover:bg-white hover:text-black transition-all uppercase shadow-hard-white"
                >
                  {copied ? "COPIED" : "COPY LINK"}
                </button>
             </div>

             {/* Social Shares */}
             <div className="bg-black border-4 border-hard-gold p-4 shadow-[8px_8px_0_#FFD700]">
                <p className="text-hard-gold font-mono text-xs mb-3 text-center uppercase tracking-widest border-b border-zinc-800 pb-2">
                   BROADCAST TO THE STREETS
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleTwitterShare}
                    className="bg-hard-blue text-black font-impact text-xl py-3 border-2 border-black hover:brightness-110 flex items-center justify-center gap-2"
                  >
                    <span>TWITTER / X</span>
                  </button>
                  <button 
                    onClick={handleWhatsappShare}
                    className="bg-[#25D366] text-black font-impact text-xl py-3 border-2 border-black hover:brightness-110 flex items-center justify-center gap-2"
                  >
                    <span>WHATSAPP</span>
                  </button>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: MEME GENERATOR */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
         <MemeGenerator name={targetName} score={result.cookedLevel} verdict={result.verdict} />
      </div>

    </div>
  );
};