import React, { useState, useCallback } from 'react';
import { QuickAdviceResponse } from '../types';
import { ThumbsUp, Minus, ThumbsDown, Copy, Check, Sparkles, ArrowLeft } from 'lucide-react';
import { useGlobalToast } from './Toast';

interface QuickAdvisorResultsRedesignProps {
  result: QuickAdviceResponse;
  onNewScan: () => void;
  onFeedback: (suggestionType: 'smooth' | 'bold' | 'witty' | 'authentic', rating: 'helpful' | 'mid' | 'off') => void;
}

const SuggestionSection = ({ 
  title, 
  options, 
  type, 
  onCopy, 
  copiedId, 
  onFeedback, 
  feedbackRating 
}: { 
  title: string;
  options: any[];
  type: 'smooth' | 'bold' | 'witty' | 'authentic';
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  onFeedback: (rating: 'helpful' | 'mid' | 'off') => void;
  feedbackRating?: 'helpful' | 'mid' | 'off';
}) => {
  if (options.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">{title}</h3>
        <div className="flex gap-1">
          {(['helpful', 'mid', 'off'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onFeedback(r)}
              className={`p-1.5 rounded-md transition-all ${
                feedbackRating === r 
                  ? 'bg-white text-black' 
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {r === 'helpful' ? <ThumbsUp size={14} /> : r === 'mid' ? <Minus size={14} /> : <ThumbsDown size={14} />}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {options.map((opt, i) => (
          <div key={i} className="space-y-2">
            {opt.replies.map((reply: any, j: number) => {
              const id = `${type}-${i}-${j}`;
              const isCopied = copiedId === id;
              return (
                <button
                  key={j}
                  onClick={() => onCopy(reply.reply, id)}
                  className="w-full text-left p-5 rounded-organic bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-600 transition-all group active:scale-[0.99] relative overflow-hidden"
                >
                  <p className="text-white text-base leading-relaxed mb-2 pr-8">{reply.reply}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                      {isCopied ? 'Copied' : 'Tap to copy'}
                    </span>
                    {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const QuickAdvisorResultsRedesign: React.FC<QuickAdvisorResultsRedesignProps> = ({ 
  result, 
  onNewScan, 
  onFeedback 
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});
  const { showToast } = useGlobalToast();

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  }, [showToast]);

  const handleLocalFeedback = (type: any, rating: any) => {
    setFeedbackState(prev => ({ ...prev, [type]: rating }));
    onFeedback(type, rating);
  };

  return (
    <div className="h-full w-full flex flex-col bg-matte-base animate-fade-in overflow-y-auto scrollbar-hide">
      <div className="p-6 max-w-sm mx-auto w-full space-y-10 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onNewScan} className="text-zinc-500 hover:text-white transition-colors p-2 -ml-2">
            <ArrowLeft size={20} />
          </button>
          <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-hard-gold uppercase tracking-widest">
            Analysis Live
          </div>
        </div>

        {/* Vibe Check Header */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-mono text-hard-gold uppercase tracking-[0.3em]">Vibe Check</p>
          <h2 className="text-4xl font-impact text-white uppercase tracking-tight">
            {result.vibeCheck.theirEnergy} Energy
          </h2>
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xl font-impact text-white">{result.vibeCheck.interestLevel}%</span>
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">Interest</span>
            </div>
          </div>
        </div>

        {/* Recommended Action Card */}
        <div className="p-6 rounded-organic bg-white text-black text-center space-y-1 shadow-[0_20px_40px_rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-60">Strategic Move</p>
          <h3 className="text-3xl font-impact uppercase">{result.recommendedAction.replace('_', ' ')}</h3>
        </div>

        {/* Flags */}
        <div className="flex flex-wrap justify-center gap-2">
          {result.vibeCheck.greenFlags.map((f, i) => (
            <span key={i} className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase">
              {f}
            </span>
          ))}
          {result.vibeCheck.redFlags.map((f, i) => (
            <span key={i} className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-400 uppercase">
              {f}
            </span>
          ))}
        </div>

        {/* Suggestions */}
        <div className="space-y-10 pt-4">
          <SuggestionSection 
            title="Smooth" 
            options={result.suggestions.smooth} 
            type="smooth"
            onCopy={handleCopy}
            copiedId={copiedId}
            onFeedback={(r) => handleLocalFeedback('smooth', r)}
            feedbackRating={feedbackState['smooth']}
          />
          <SuggestionSection 
            title="Bold" 
            options={result.suggestions.bold} 
            type="bold"
            onCopy={handleCopy}
            copiedId={copiedId}
            onFeedback={(r) => handleLocalFeedback('bold', r)}
            feedbackRating={feedbackState['bold']}
          />
          <SuggestionSection 
            title="Witty" 
            options={result.suggestions.witty} 
            type="witty"
            onCopy={handleCopy}
            copiedId={copiedId}
            onFeedback={(r) => handleLocalFeedback('witty', r)}
            feedbackRating={feedbackState['witty']}
          />
          <SuggestionSection 
            title="Authentic" 
            options={result.suggestions.authentic} 
            type="authentic"
            onCopy={handleCopy}
            copiedId={copiedId}
            onFeedback={(r) => handleLocalFeedback('authentic', r)}
            feedbackRating={feedbackState['authentic']}
          />
        </div>

        {/* Pro Tip */}
        <div className="p-6 rounded-organic bg-zinc-900/50 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-hard-gold" />
            <span className="text-[10px] font-mono text-hard-gold uppercase tracking-widest">Pro Tip</span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed italic">"{result.proTip}"</p>
        </div>

        {/* Footer Actions */}
        <button 
          onClick={onNewScan}
          className="w-full py-4 rounded-organic border border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-all"
        >
          New Diagnostic
        </button>
      </div>
    </div>
  );
};

export default QuickAdvisorResultsRedesign;
