import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, ChevronDown, ChevronUp, Info } from 'lucide-react';

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
  onDraftChange
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

  return (
    <div className="h-full w-full flex flex-col bg-matte-base animate-fade-in relative">
      {/* 1. PREVIEW AREA (Top) */}
      <div 
        data-testid="preview-container"
        className="flex-1 w-full p-6 overflow-y-auto scrollbar-hide flex flex-col items-center gap-6"
      >
        {screenshots.length > 0 ? (
          <div className="w-full max-w-sm flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4">
              {screenshots.map((src, index) => (
                <div 
                  key={index} 
                  className="relative aspect-auto rounded-organic overflow-hidden shadow-2xl border border-zinc-800/50"
                >
                  <img src={src} alt="Texting Screenshot" className="w-full h-auto object-contain" />
                  <button
                    onClick={() => {
                      if (window.navigator.vibrate) window.navigator.vibrate(5);
                      onRemoveScreenshot?.(index);
                    }}
                    className="absolute top-4 right-4 bg-zinc-950/80 backdrop-blur-md text-white p-2 rounded-full hover:bg-red-500/80 transition-all active:scale-90"
                    aria-label="Remove screenshot"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>

            {/* Progressive Reveal: Advanced Context */}
            <div className="w-full space-y-4 relative">
              {showHint && (
                <div className="absolute -top-12 left-0 w-full animate-bounce z-10">
                  <div className="bg-hard-gold text-black text-[10px] font-mono font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl mx-auto w-fit">
                    <Info size={12} />
                    <span>PRO TIP: ADD CONTEXT FOR BETTER ADVICE</span>
                    <button onClick={dismissHint} className="ml-1 opacity-50 hover:opacity-100">
                      <X size={10} />
                    </button>
                  </div>
                  <div className="w-2 h-2 bg-hard-gold rotate-45 mx-auto -mt-1 shadow-xl"></div>
                </div>
              )}
              
              <button 
                onClick={() => {
                  if (window.navigator.vibrate) window.navigator.vibrate(5);
                  setShowAdvanced(!showAdvanced);
                  if (showHint) dismissHint();
                }}
                className="flex items-center gap-2 text-zinc-500 text-[10px] font-mono uppercase tracking-[0.2em] hover:text-zinc-300 transition-colors"
              >
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Add context / your draft
              </button>

              {showAdvanced && (
                <div className="space-y-4 animate-slide-up">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] px-1">Backstory</label>
                    <textarea
                      value={context}
                      onChange={(e) => onContextChange?.(e.target.value)}
                      placeholder="What's the vibe? Any history?"
                      className="w-full bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-zinc-700 transition-all min-h-[100px] font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] px-1">Your Draft</label>
                    <textarea
                      value={yourDraft}
                      onChange={(e) => onDraftChange?.(e.target.value)}
                      placeholder="What were you going to say?"
                      className="w-full bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-zinc-700 transition-all min-h-[100px] font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center w-full">
            <button
              onClick={() => {
                if (window.navigator.vibrate) window.navigator.vibrate(10);
                onUploadClick?.();
              }}
              className="w-full max-w-sm aspect-[4/5] rounded-organic border-2 border-dashed border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900/20 transition-all flex flex-col items-center justify-center gap-4 group"
            >
              <div className="w-16 h-16 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center group-hover:bg-zinc-900 transition-colors">
                <Upload className="w-6 h-6 text-zinc-600 group-hover:text-white" />
              </div>
              <div className="text-center">
                <p className="text-white font-editorial text-lg tracking-tight">Upload Evidence</p>
                <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest mt-1">Select screenshots</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 2. ACTIONS AREA (Bottom) */}
      <div 
        data-testid="actions-container"
        className="w-full p-6 pb-12 bg-matte-base"
      >
        <div className="max-w-sm mx-auto space-y-4">
          {screenshots.length > 0 && (
            <button
              onClick={() => {
                if (window.navigator.vibrate) window.navigator.vibrate([10, 30, 10]);
                onAnalyzeClick?.();
              }}
              disabled={isLoading}
              className={`w-full py-5 rounded-organic font-impact text-xl uppercase tracking-wider shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 ${
                isLoading 
                  ? 'bg-zinc-900 text-white animate-pulse' 
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {isLoading ? (
                <>
                  <Sparkles className="animate-spin text-hard-gold" size={24} />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={24} className="text-hard-gold" />
                  <span>Get Advice</span>
                </>
              )}
            </button>
          )}

          <p className="text-center text-[9px] font-mono text-zinc-800 uppercase tracking-[0.3em]">
            Precision Texting Engine v3.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickAdvisorRedesign;

