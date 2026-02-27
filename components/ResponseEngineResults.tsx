import React, { useState } from 'react';
import { RefreshCw, MessageSquare, Copy, Check, Sparkles, ThumbsUp, ThumbsDown, Minus, Info, AlertTriangle, Clock, Zap, Target, ArrowLeft } from 'lucide-react';
import { QuickAdviceResponse } from '../types';
import { ModuleHeader } from './ModuleHeader';

interface ResponseEngineResultsProps {
  result: QuickAdviceResponse;
  onNewScan: () => void;
  onFeedback: (suggestionType: 'smooth' | 'bold' | 'witty' | 'authentic', rating: 'helpful' | 'mid' | 'off') => void;
  onBack: () => void;
}

const ResponseEngineResults: React.FC<ResponseEngineResultsProps> = ({
  result,
  onNewScan,
  onFeedback,
  onBack
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    if ('vibrate' in navigator) navigator.vibrate(10);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleFeedback = (type: 'smooth' | 'bold' | 'witty' | 'authentic', rating: 'helpful' | 'mid' | 'off') => {
    onFeedback(type, rating);
    setFeedbackGiven(prev => ({ ...prev, [type]: rating }));
    if ('vibrate' in navigator) navigator.vibrate(5);
  };

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'HARD_STOP': return { icon: AlertTriangle, text: 'text-red-400', border: 'border-red-400/20', bg: 'bg-red-400/5' };
      case 'PULL_BACK': return { icon: Minus, text: 'text-amber-400', border: 'border-amber-400/20', bg: 'bg-amber-400/5' };
      case 'WAIT': return { icon: Clock, text: 'text-blue-400', border: 'border-blue-400/20', bg: 'bg-blue-400/5' };
      case 'FULL_SEND': return { icon: Zap, text: 'text-emerald-400', border: 'border-emerald-400/20', bg: 'bg-emerald-400/5' };
      default: return { icon: MessageSquare, text: 'text-zinc-400', border: 'border-white/5', bg: 'bg-white/5' };
    }
  };

  const actionStyle = getActionStyle(result.recommendedAction);
  const ActionIcon = actionStyle.icon;

  return (
    <div className="h-full w-full flex flex-col bg-matte-base animate-fade-in relative overflow-y-auto scrollbar-hide font-sans select-none">
      
      {/* MODULE HEADER */}
      <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="Analysis Results" 
          mode="Summary Report" 
          onBack={() => handleAction(onBack)}
          accentColor="blue"
          statusLabel="Status"
          statusValue="Complete"
          statusColor="emerald"
        />
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col gap-12 p-8 pb-32 relative z-10">
        
        {/* 1. HERO: ACTION DIRECTIVE */}
        <div className="flex flex-col items-center text-center gap-8">
          <div className="space-y-4">
            <h3 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[0.9]">
              {result.vibeCheck.theirEnergy} Energy Detected
            </h3>
            <p className="text-zinc-500 text-sm md:text-base max-w-xl mx-auto font-medium leading-relaxed">
              Based on the interaction patterns, here is the recommended approach for your next response.
            </p>
          </div>

          <div className={`w-full max-w-2xl p-10 rounded-[3rem] border-2 ${actionStyle.border} ${actionStyle.bg} shadow-2xl group transition-all`}>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-8">Recommended Action</div>
            <ActionIcon className={`w-16 h-16 ${actionStyle.text} mx-auto mb-6`} />
            <div className={`text-4xl md:text-6xl font-bold ${actionStyle.text} uppercase tracking-tight`}>
              {result.recommendedAction.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* 2. METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Interest Level */}
          <div className="bg-white/5 border border-white/5 p-10 rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center text-center">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-8">Engagement Level</div>
            <div className="text-7xl font-bold text-blue-400 tracking-tighter mb-6">{result.vibeCheck.interestLevel}%</div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${result.vibeCheck.interestLevel}%` }}></div>
            </div>
          </div>

          {/* Key Indicators */}
          <div className="bg-white/5 border border-white/5 p-10 rounded-[2.5rem] shadow-xl space-y-8">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Key Observations</div>
            <div className="space-y-4">
              {result.vibeCheck.redFlags.map((flag, i) => (
                <div key={i} className="flex items-center gap-4 text-red-400 bg-red-400/5 p-4 rounded-2xl border border-red-400/10">
                  <AlertTriangle size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">{flag}</span>
                </div>
              ))}
              {result.vibeCheck.greenFlags.map((flag, i) => (
                <div key={i} className="flex items-center gap-4 text-emerald-400 bg-emerald-400/5 p-4 rounded-2xl border border-emerald-400/10">
                  <Check size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. RESPONSE OPTIONS */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 px-1">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Response Options</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(['smooth', 'bold', 'witty', 'authentic'] as const).map((type) => {
              const content = result.suggestions[type];
              if (!content) return null;
              
              const colors = {
                smooth: 'border-white/5 hover:border-white/20',
                bold: 'border-blue-500/10 hover:border-blue-500/30',
                witty: 'border-amber-500/10 hover:border-amber-500/30',
                authentic: 'border-emerald-500/10 hover:border-emerald-500/30'
              };

              return (
                <div 
                  key={type}
                  className={`bg-white/5 border ${colors[type]} p-8 rounded-[2.5rem] shadow-xl transition-all relative group flex flex-col gap-6`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{type}</span>
                    <button 
                      onClick={() => copyToClipboard(content)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-90"
                    >
                      {copiedText === content ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  
                  <p className="text-lg font-bold text-white leading-relaxed italic pr-4">
                    "{content}"
                  </p>

                  <div className="mt-auto pt-6 flex items-center gap-4">
                    <button 
                      onClick={() => handleFeedback(type, 'helpful')}
                      className={`p-2.5 rounded-xl transition-all ${feedbackGiven[type] === 'helpful' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      <ThumbsUp size={18} />
                    </button>
                    <button 
                      onClick={() => handleFeedback(type, 'off')}
                      className={`p-2.5 rounded-xl transition-all ${feedbackGiven[type] === 'off' ? 'bg-red-500/20 text-red-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      <ThumbsDown size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. ACTIONS */}
        <div className="pt-12 border-t border-white/5 flex justify-center">
          <button
            onClick={() => handleAction(onNewScan, 15)}
            className="px-16 py-5 bg-white text-black font-black text-xl uppercase tracking-tight rounded-3xl shadow-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center gap-4"
          >
            <RefreshCw size={24} />
            <span>New Analysis</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResponseEngineResults;
