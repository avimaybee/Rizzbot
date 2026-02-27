import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, ChevronDown, ChevronUp, Info, ArrowLeft, Terminal, Shield } from 'lucide-react';
import { ModuleHeader } from './ModuleHeader';
import { CornerNodes } from './CornerNodes';

interface QuickAdvisorRedesignProps {
  screenshots: string[];
  onRemoveScreenshot?: (index: number) => void;
  onUploadClick?: () => void;
  onAnalyzeClick?: () => void;
  isLoading?: boolean;
  context?: string;
  onContextChange?: (val: string) => void;
  yourDraft?: string;
  onDraftChange?: (val: string) => void;
  onBack: () => void;
}

const QuickAdvisorRedesign: React.FC<QuickAdvisorRedesignProps> = ({
  screenshots,
  onRemoveScreenshot,
  onUploadClick,
  onAnalyzeClick,
  isLoading,
  context,
  onContextChange,
  yourDraft,
  onDraftChange,
  onBack
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (screenshots.length > 0 && !showAdvanced) {
      const hasSeenHint = localStorage.getItem('rizzbot_hint_context');
      if (!hasSeenHint) {
        setShowHint(true);
      }
    } else {
      setShowHint(false);
    }
  }, [screenshots.length, showAdvanced]);

  const dismissHint = () => {
    localStorage.setItem('rizzbot_hint_context', 'true');
    setShowHint(false);
  };

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  return (
    <div className="h-full w-full flex flex-col bg-matte-base animate-fade-in relative overflow-y-auto scrollbar-hide font-mono select-none">
      <div className="bg-matte-grain"></div>
      
      {/* MODULE HEADER */}
      <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="TACTICAL_SCANNER" 
          mode="QUICK_MODE" 
          onBack={() => handleAction(onBack)}
          accentColor="blue"
          statusLabel="SCANNER_STATUS"
          statusValue="READY"
          statusColor="emerald"
        />
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center relative z-10">
        {/* 1. PREVIEW AREA (Top) */}
        <div 
          data-testid="preview-container"
          className="w-full p-6 pb-12 flex flex-col items-center gap-8"
        >
          {screenshots.length > 0 ? (
            <div className="w-full max-w-md flex flex-col gap-10">
              <div className="space-y-6">
                {screenshots.map((src, index) => (
                  <div 
                    key={index} 
                    className="relative aspect-auto glass-dark overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-white/5 soft-edge group"
                  >
                    <img src={src} alt="Tactical Input" className="w-full h-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                    <button
                      onClick={() => handleAction(() => onRemoveScreenshot?.(index), 10)}
                      className="absolute top-4 right-4 glass-dark text-white p-2.5 rounded-full hover:bg-hard-red/80 transition-all active:scale-90 border-white/10 shadow-xl"
                      aria-label="Remove screenshot"
                    >
                      <X size={18} />
                    </button>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-hard-blue via-transparent to-transparent opacity-50"></div>
                  </div>
                ))}
              </div>

              {/* Progressive Reveal: Advanced Context */}
              <div className="w-full space-y-6 relative">
                {showHint && (
                  <div className="absolute -top-14 left-0 w-full animate-bounce z-10">
                    <div className="bg-hard-gold text-black text-[10px] font-bold px-4 py-2 soft-edge flex items-center gap-3 shadow-[0_15px_30px_rgba(251,191,36,0.3)] mx-auto w-fit border border-white/20">
                      <Info size={14} />
                      <span className="uppercase tracking-widest">Add context for precision advice</span>
                      <button onClick={() => handleAction(dismissHint)} className="ml-1 opacity-50 hover:opacity-100 p-1">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="w-3 h-3 bg-hard-gold rotate-45 mx-auto -mt-1.5 shadow-xl"></div>
                  </div>
                )}
                
                <button 
                  onClick={() => handleAction(() => {
                    setShowAdvanced(!showAdvanced);
                    if (showHint) dismissHint();
                  })}
                  className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] hover:text-white transition-all py-2 px-4 glass-zinc soft-edge border-white/5"
                >
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>Supply Operational Context</span>
                </button>

                {showAdvanced && (
                  <div className="space-y-6 animate-slide-up bg-black/40 p-6 border border-white/5 soft-edge">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                         <Terminal size={12} className="text-zinc-600" />
                         <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Target Backstory</label>
                      </div>
                      <textarea
                        value={context}
                        onChange={(e) => onContextChange?.(e.target.value)}
                        placeholder="Define the current dynamic. Previous interaction patterns? Emotional stakes?"
                        className="w-full glass-zinc border-white/5 soft-edge p-5 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-hard-blue/30 transition-all min-h-[120px] leading-relaxed"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                         <Shield size={12} className="text-zinc-600" />
                         <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Proposed Transmission</label>
                      </div>
                      <textarea
                        value={yourDraft}
                        onChange={(e) => onDraftChange?.(e.target.value)}
                        placeholder="What is your intended output? AI will evaluate risk factors."
                        className="w-full glass-zinc border-white/5 soft-edge p-5 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-hard-blue/30 transition-all min-h-[120px] leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center w-full min-h-[60vh]">
              <button
                onClick={() => handleAction(onUploadClick || (() => {}), 10)}
                className="w-full max-w-sm aspect-[4/5] glass-dark border-dashed border-2 border-white/10 hover:border-hard-blue/30 hover:bg-hard-blue/[0.02] transition-all flex flex-col items-center justify-center gap-8 group soft-edge relative overflow-hidden shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-hard-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="w-20 h-20 rounded-full glass flex items-center justify-center border-white/10 group-hover:border-hard-blue/20 transition-all shadow-[0_0_30px_rgba(0,0,0,0.3)] group-hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] relative z-10">
                  <Upload className="w-8 h-8 text-zinc-500 group-hover:text-hard-blue transition-colors" />
                </div>
                <div className="text-center relative z-10 px-6">
                  <p className="text-white font-impact text-3xl tracking-tight uppercase mb-2">Ingest Evidence</p>
                  <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed">Select interaction logs <br /> for linguistic processing</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 2. ACTIONS AREA (Bottom) */}
        <div 
          data-testid="actions-container"
          className="w-full p-8 pb-16 bg-transparent sticky bottom-0"
        >
          <div className="max-w-md mx-auto space-y-6">
            {screenshots.length > 0 && (
              <button
                onClick={() => handleAction(onAnalyzeClick || (() => {}), 20)}
                disabled={isLoading}
                className={`w-full py-5 soft-edge font-impact text-2xl uppercase tracking-[0.1em] shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-70 group relative overflow-hidden ${
                  isLoading 
                    ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-zinc-600 animate-bounce"></div>
                       <div className="w-2 h-2 bg-zinc-600 animate-bounce delay-75"></div>
                       <div className="w-2 h-2 bg-zinc-600 animate-bounce delay-150"></div>
                    </div>
                    <span>Processing_Logs</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={24} className="text-hard-gold group-hover:rotate-12 transition-transform" />
                    <span className="relative z-10">Execute Analysis</span>
                    <div className="absolute inset-0 bg-hard-gold opacity-0 group-hover:opacity-5 transition-opacity"></div>
                  </>
                )}
              </button>
            )}

            <div className="flex flex-col items-center gap-2 opacity-40">
               <div className="h-[1px] w-12 bg-zinc-800"></div>
               <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-[0.5em]">
                 Precision_Texting_Engine_V3.1
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickAdvisorRedesign;
