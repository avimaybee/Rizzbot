import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, ChevronDown, ChevronUp, Info, Terminal, Shield } from 'lucide-react';
import { ModuleHeader } from './ModuleHeader';

interface ResponseEngineProps {
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

const ResponseEngine: React.FC<ResponseEngineProps> = ({
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
    <div className="h-full w-full flex flex-col bg-matte-base animate-fade-in relative overflow-y-auto scrollbar-hide font-sans select-none">
      
      {/* MODULE HEADER */}
      <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="Analyze Message" 
          mode="New Session" 
          onBack={() => handleAction(onBack)}
          accentColor="blue"
          statusLabel="Analysis"
          statusValue="Ready"
          statusColor="emerald"
        />
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center relative z-10 px-8">
        {/* 1. PREVIEW AREA */}
        <div 
          data-testid="preview-container"
          className="w-full p-6 pb-12 flex flex-col items-center gap-10"
        >
          {screenshots.length > 0 ? (
            <div className="w-full max-w-md flex flex-col gap-12">
              <div className="space-y-8">
                {screenshots.map((src, index) => (
                  <div 
                    key={index} 
                    className="relative aspect-auto bg-white/5 overflow-hidden shadow-2xl rounded-3xl border border-white/5 group"
                  >
                    <img src={src} alt="Message Screenshot" className="w-full h-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                    <button
                      onClick={() => handleAction(() => onRemoveScreenshot?.(index), 10)}
                      className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-red-500 transition-all active:scale-90 border border-white/10"
                      aria-label="Remove image"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Advanced Context */}
              <div className="w-full space-y-6 relative">
                {showHint && (
                  <div className="absolute -top-16 left-0 w-full animate-bounce z-10">
                    <div className="bg-amber-400 text-black text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl mx-auto w-fit">
                      <Info size={14} />
                      <span className="uppercase tracking-widest">Add details for better analysis</span>
                      <button onClick={() => handleAction(dismissHint)} className="ml-1 opacity-50 hover:opacity-100 p-1">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => handleAction(() => {
                    setShowAdvanced(!showAdvanced);
                    if (showHint) dismissHint();
                  })}
                  className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-all py-3 px-6 bg-white/5 rounded-2xl border border-white/5"
                >
                  {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span>Add Context</span>
                </button>

                {showAdvanced && (
                  <div className="space-y-8 animate-slide-up bg-white/5 p-8 rounded-3xl border border-white/5">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Situation Overview</label>
                      <textarea
                        value={context}
                        onChange={(e) => onContextChange?.(e.target.value)}
                        placeholder="What's the relationship history? Any specific goal?"
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-blue-500/30 transition-all min-h-[120px]"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Your Draft (Optional)</label>
                      <textarea
                        value={yourDraft}
                        onChange={(e) => onDraftChange?.(e.target.value)}
                        placeholder="What were you planning to say?"
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-blue-500/30 transition-all min-h-[120px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center w-full min-h-[50vh]">
              <button
                onClick={() => handleAction(onUploadClick || (() => {}), 10)}
                className="w-full max-w-sm aspect-[4/5] bg-white/5 border-dashed border-2 border-white/10 hover:border-blue-500/30 transition-all flex flex-col items-center justify-center gap-8 group rounded-[40px] relative overflow-hidden shadow-2xl"
              >
                <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-blue-500/20 transition-all">
                  <Upload className="w-8 h-8 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <div className="text-center px-8">
                  <p className="text-white font-bold text-2xl mb-2">Upload Screenshots</p>
                  <p className="text-zinc-500 text-xs font-medium leading-relaxed">Select conversation images for processing</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 2. ACTIONS AREA */}
        <div 
          data-testid="actions-container"
          className="w-full p-8 pb-20 sticky bottom-0"
        >
          <div className="max-w-md mx-auto">
            {screenshots.length > 0 && (
              <button
                onClick={() => handleAction(onAnalyzeClick || (() => {}), 20)}
                disabled={isLoading}
                className={`w-full py-5 rounded-[2rem] font-black text-xl uppercase tracking-tight shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-70 ${
                  isLoading 
                    ? 'bg-zinc-900 text-zinc-500' 
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce delay-150"></div>
                  </div>
                ) : (
                  <>
                    <Sparkles size={22} />
                    <span>Generate Feedback</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponseEngine;
