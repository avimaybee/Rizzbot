import React, { useState } from 'react';
import { X, Upload, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

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
                    onClick={() => onRemoveScreenshot?.(index)}
                    className="absolute top-4 right-4 bg-zinc-950/80 backdrop-blur-md text-white p-2 rounded-full hover:bg-red-500/80 transition-all active:scale-90"
                    aria-label="Remove screenshot"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>

            {/* Progressive Reveal: Advanced Context */}
            <div className="w-full space-y-4">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-zinc-500 text-xs font-mono uppercase tracking-widest hover:text-zinc-300 transition-colors"
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Add context / your draft
              </button>

              {showAdvanced && (
                <div className="space-y-4 animate-slide-up">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Backstory</label>
                    <textarea
                      value={context}
                      onChange={(e) => onContextChange?.(e.target.value)}
                      placeholder="What's the vibe? Any history?"
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 transition-all min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Your Draft</label>
                    <textarea
                      value={yourDraft}
                      onChange={(e) => onDraftChange?.(e.target.value)}
                      placeholder="What were you going to say?"
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 transition-all min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center w-full">
            <button
              onClick={onUploadClick}
              className="w-full max-w-sm aspect-[4/5] rounded-organic border-2 border-dashed border-zinc-800 hover:border-zinc-500 hover:bg-zinc-900/30 transition-all flex flex-col items-center justify-center gap-4 group"
            >
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                <Upload className="w-8 h-8 text-zinc-500 group-hover:text-white" />
              </div>
              <div className="text-center">
                <p className="text-white font-editorial text-lg">Upload Evidence</p>
                <p className="text-zinc-500 text-sm">Tap to select screenshots</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 2. ACTIONS AREA (Bottom) */}
      <div 
        data-testid="actions-container"
        className="w-full p-6 pb-12 bg-matte-base border-t border-zinc-900/50"
      >
        <div className="max-w-sm mx-auto space-y-4">
          {screenshots.length > 0 && (
            <button
              onClick={onAnalyzeClick}
              disabled={isLoading}
              className="w-full py-5 rounded-organic bg-white text-black font-impact text-xl uppercase tracking-wider shadow-xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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

          <p className="text-center text-[10px] font-mono text-zinc-600 uppercase tracking-widest opacity-30">
            Powered by Gemini 3 Flash
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickAdvisorRedesign;

