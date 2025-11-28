import React, { useState, useCallback, useEffect } from 'react';
import { QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile, FeedbackEntry } from '../types';
import { getQuickAdvice } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';

interface QuickAdvisorProps {
  onBack: () => void;
  userProfile?: UserStyleProfile | null;
}

type ContextOption = 'new' | 'talking' | 'dating' | 'complicated' | 'ex';

const contextOptions: { value: ContextOption; label: string }[] = [
  { value: 'new', label: 'NEW' },
  { value: 'talking', label: 'TALKING' },
  { value: 'dating', label: 'DATING' },
  { value: 'complicated', label: 'COMPLICATED' },
  { value: 'ex', label: 'EX' },
];

// Corner Nodes Component - matching App.tsx style
const CornerNodes = ({ className }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
    <div className="absolute top-0 left-0">
      <div className="w-2 h-2 border-t border-l border-zinc-500"></div>
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute top-0 right-0">
       <div className="w-2 h-2 border-t border-r border-zinc-500"></div>
       <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute bottom-0 left-0">
       <div className="w-2 h-2 border-b border-l border-zinc-500"></div>
       <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute bottom-0 right-0">
       <div className="w-2 h-2 border-b border-r border-zinc-500"></div>
       <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
  </div>
);

// Starburst icon matching App.tsx
const StarBurst = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

export const QuickAdvisor: React.FC<QuickAdvisorProps> = ({ onBack, userProfile }) => {
  const [theirMessage, setTheirMessage] = useState('');
  const [yourDraft, setYourDraft] = useState('');
  const [context, setContext] = useState<ContextOption>('talking');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!theirMessage.trim()) return;
    
    setIsLoading(true);
    setResult(null);
    setFeedbackGiven({});
    setShowFeedbackThanks(false);

    const request: QuickAdviceRequest = {
      theirMessage: theirMessage.trim(),
      yourDraft: yourDraft.trim() || undefined,
      context,
      userStyle: userProfile || undefined,
    };

    try {
      const response = await getQuickAdvice(request);
      setResult(response);
      // Log session for wellbeing tracking
      logSession('quick', undefined, undefined);
    } catch (error) {
      console.error('Quick advice failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [theirMessage, yourDraft, context, userProfile]);

  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 1500);
  }, []);

  const handleFeedback = useCallback((suggestionType: 'smooth' | 'bold' | 'authentic', rating: 'helpful' | 'mid' | 'off') => {
    // Save feedback
    saveFeedback({
      source: 'quick',
      suggestionType,
      rating,
      context,
      theirEnergy: result?.vibeCheck.theirEnergy,
      recommendedAction: result?.recommendedAction,
    });
    
    // Update UI state
    setFeedbackGiven(prev => ({ ...prev, [suggestionType]: rating }));
    
    // Show thanks message briefly
    setShowFeedbackThanks(true);
    setTimeout(() => setShowFeedbackThanks(false), 2000);
  }, [context, result]);

  const resetForm = useCallback(() => {
    setResult(null);
    setTheirMessage('');
    setYourDraft('');
    setFeedbackGiven({});
    setShowFeedbackThanks(false);
  }, []);

  // Energy level to color mapping - using app's palette
  const getEnergyStyle = (energy: string) => {
    switch (energy) {
      case 'hot': return 'text-red-500';
      case 'warm': return 'text-hard-gold';
      case 'cold': return 'text-hard-blue';
      case 'mixed': return 'text-purple-400';
      default: return 'text-zinc-400';
    }
  };

  // Action badge styling
  const getActionStyle = (action: string) => {
    switch (action) {
      case 'SEND': return 'bg-white text-black';
      case 'WAIT': return 'bg-hard-gold text-black';
      case 'PULL_BACK': return 'bg-zinc-700 text-white';
      case 'ABORT': return 'bg-red-600 text-white';
      case 'MATCH': return 'bg-hard-blue text-white';
      case 'CALL': return 'bg-purple-600 text-white';
      default: return 'bg-zinc-800 text-white';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'SEND': return 'SEND IT';
      case 'WAIT': return 'WAIT';
      case 'PULL_BACK': return 'PULL BACK';
      case 'ABORT': return 'ABORT';
      case 'MATCH': return 'MATCH';
      case 'CALL': return 'CALL';
      default: return action;
    }
  };

  // Input View
  if (!result) {
    return (
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
        
        {/* Header Bar */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between relative z-10">
          <button 
            onClick={onBack}
            className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
          >
            <span className="text-lg">←</span>
            <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">BACK</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-hard-gold animate-pulse"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">QUICK_MODE</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 md:p-10 flex flex-col relative z-10 overflow-y-auto">
          {/* Title Section */}
          <div className="mb-8">
            <div className="label-sm text-hard-gold mb-2">QUICK MODE</div>
            <h2 className="text-4xl md:text-5xl font-impact text-white uppercase tracking-tight">WTF DO I SAY?</h2>
            <p className="text-zinc-500 text-sm mt-2 font-mono">Paste the chaos. Get the play.</p>
          </div>

          {/* Form Grid */}
          <div className="grid md:grid-cols-2 gap-6 flex-1">
            {/* Left Column - Inputs */}
            <div className="space-y-6">
              {/* Their Message */}
              <div>
                <label className="label-sm text-zinc-400 mb-2 block">WHAT THEY HIT YOU WITH</label>
                <textarea
                  value={theirMessage}
                  onChange={(e) => setTheirMessage(e.target.value)}
                  placeholder="PASTE WHAT THEY SENT... (the audacity)"
                  className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white placeholder:text-zinc-500/60 resize-none focus:outline-none focus:border-white transition-colors h-32 font-mono text-sm"
                />
              </div>

              {/* Your Draft */}
              <div>
                <label className="label-sm text-zinc-400 mb-2 block">YOUR POTENTIAL REPLY <span className="text-zinc-600">(BE HONEST)</span></label>
                <textarea
                  value={yourDraft}
                  onChange={(e) => setYourDraft(e.target.value)}
                  placeholder="WHAT ARE YOU THINKING OF SAYING... (don't hold back)"
                  className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white placeholder:text-zinc-500/60 resize-none focus:outline-none focus:border-white transition-colors h-24 font-mono text-sm"
                />
              </div>
            </div>

            {/* Right Column - Context & Action */}
            <div className="flex flex-col">
              {/* Context Selector */}
              <div className="mb-6">
                <label className="label-sm text-zinc-400 mb-3 block">SITUATION</label>
                <div className="grid grid-cols-5 gap-1 md:gap-2">
                  {contextOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setContext(opt.value)}
                      className={`py-2 md:py-3 px-1 md:px-4 border text-[8px] md:text-[10px] font-mono tracking-wider transition-all ${
                        context === opt.value
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Submit Button */}
              <button
                onClick={handleAnalyze}
                disabled={!theirMessage.trim() || isLoading}
                className={`w-full py-5 font-impact text-2xl uppercase tracking-wide border transition-all ${
                  !theirMessage.trim() || isLoading
                    ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                    : 'bg-white text-black border-white hover:bg-zinc-200'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <StarBurst className="w-5 h-5 animate-spin" />
                    ANALYZING...
                  </span>
                ) : (
                  'RUN DIAGNOSTIC'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
      <div className="absolute inset-0 bg-scan-lines opacity-10 pointer-events-none"></div>

      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between relative z-10 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
        <button 
          onClick={resetForm}
          className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
        >
          <span className="text-lg">←</span>
          <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">NEW SCAN</span>
        </button>
        <div className={`px-4 py-2 text-[10px] font-bold tracking-widest ${getActionStyle(result.recommendedAction)}`}>
          {getActionLabel(result.recommendedAction)}
        </div>
      </div>

      {/* Results Content */}
      <div className="flex-1 p-6 md:p-10 relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Vibe Check Card */}
          <div className="bg-zinc-900 border border-zinc-800 relative">
            <CornerNodes className="opacity-50" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="label-sm text-zinc-500 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-hard-gold"></div>
                  VIBE CHECK
                </div>
                <div className={`text-3xl font-impact ${getEnergyStyle(result.vibeCheck.theirEnergy)}`}>
                  {result.vibeCheck.theirEnergy.toUpperCase()}
                </div>
              </div>
              
              {/* Interest Level Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-2 uppercase tracking-wider">
                  <span>INTEREST LEVEL</span>
                  <span>{result.vibeCheck.interestLevel}%</span>
                </div>
                <div className="h-1 bg-zinc-800 relative">
                  <div 
                    className={`h-full transition-all ${
                      result.vibeCheck.interestLevel >= 70 ? 'bg-white' :
                      result.vibeCheck.interestLevel >= 40 ? 'bg-hard-gold' : 'bg-hard-blue'
                    }`}
                    style={{ width: `${result.vibeCheck.interestLevel}%` }}
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-2">
                {result.vibeCheck.greenFlags.map((flag, i) => (
                  <span key={`green-${i}`} className="text-[9px] font-mono uppercase tracking-wider border border-zinc-700 px-2 py-1 text-zinc-300">
                    ✓ {flag}
                  </span>
                ))}
                {result.vibeCheck.redFlags.map((flag, i) => (
                  <span key={`red-${i}`} className="text-[9px] font-mono uppercase tracking-wider border border-red-900 px-2 py-1 text-red-400">
                    ⚠ {flag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Draft Analysis (if provided) */}
          {result.draftAnalysis && (
            <div className="bg-zinc-900 border border-zinc-800 relative">
              <CornerNodes className="opacity-50" />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="label-sm text-zinc-500 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-hard-blue"></div>
                    YOUR DRAFT
                  </div>
                  <div className={`text-3xl font-impact ${
                    result.draftAnalysis.confidenceScore >= 70 ? 'text-white' :
                    result.draftAnalysis.confidenceScore >= 40 ? 'text-hard-gold' : 'text-red-500'
                  }`}>
                    {result.draftAnalysis.confidenceScore}%
                  </div>
                </div>
                <p className="text-zinc-400 text-sm mb-4 font-mono uppercase">{result.draftAnalysis.verdict}</p>
                <div className="flex flex-wrap gap-2">
                  {result.draftAnalysis.strengths.map((s, i) => (
                    <span key={`str-${i}`} className="text-[9px] font-mono uppercase tracking-wider border border-zinc-700 px-2 py-1 text-zinc-300">
                      ✓ {s}
                    </span>
                  ))}
                  {result.draftAnalysis.issues.map((issue, i) => (
                    <span key={`issue-${i}`} className="text-[9px] font-mono uppercase tracking-wider border border-red-900 px-2 py-1 text-red-400">
                      ✗ {issue}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div>
            <div className="label-sm text-zinc-500 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <StarBurst className="w-3 h-3 text-hard-gold" />
                SUGGESTED REPLIES
              </span>
              {showFeedbackThanks && (
                <span className="text-[10px] text-emerald-400 animate-pulse">✓ feedback saved</span>
              )}
            </div>
            <div className="space-y-3">
              {/* Smooth Option */}
              <div className="relative">
                <button
                  onClick={() => copyToClipboard(result.suggestions.smooth, 'smooth')}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all group relative"
                >
                  <CornerNodes className="opacity-30 group-hover:opacity-60" />
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono tracking-widest text-hard-gold uppercase">SMOOTH</span>
                      <span className="text-[9px] font-mono text-zinc-600 group-hover:text-white transition-colors uppercase">
                        {copiedIndex === 'smooth' ? '✓ COPIED' : 'TAP TO COPY'}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{result.suggestions.smooth}</p>
                  </div>
                </button>
                {/* Feedback buttons */}
                <div className="flex gap-2 mt-3 justify-end">
                  {(['helpful', 'mid', 'off'] as const).map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleFeedback('smooth', rating)}
                      disabled={!!feedbackGiven['smooth']}
                      className={`px-3 py-2 text-sm font-mono uppercase tracking-wider border transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                        feedbackGiven['smooth'] === rating
                          ? rating === 'helpful' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' :
                            rating === 'mid' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400' :
                            'bg-red-900/50 border-red-500 text-red-400'
                          : feedbackGiven['smooth']
                          ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {rating === 'helpful' ? '👍' : rating === 'mid' ? '😐' : '👎'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bold Option */}
              <div className="relative">
                <button
                  onClick={() => copyToClipboard(result.suggestions.bold, 'bold')}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all group relative"
                >
                  <CornerNodes className="opacity-30 group-hover:opacity-60" />
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono tracking-widest text-hard-blue uppercase">BOLD</span>
                      <span className="text-[9px] font-mono text-zinc-600 group-hover:text-white transition-colors uppercase">
                        {copiedIndex === 'bold' ? '✓ COPIED' : 'TAP TO COPY'}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{result.suggestions.bold}</p>
                  </div>
                </button>
                {/* Feedback buttons */}
                <div className="flex gap-2 mt-3 justify-end">
                  {(['helpful', 'mid', 'off'] as const).map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleFeedback('bold', rating)}
                      disabled={!!feedbackGiven['bold']}
                      className={`px-3 py-2 text-sm font-mono uppercase tracking-wider border transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                        feedbackGiven['bold'] === rating
                          ? rating === 'helpful' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' :
                            rating === 'mid' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400' :
                            'bg-red-900/50 border-red-500 text-red-400'
                          : feedbackGiven['bold']
                          ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {rating === 'helpful' ? '👍' : rating === 'mid' ? '😐' : '👎'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Authentic Option */}
              <div className="relative">
                <button
                  onClick={() => copyToClipboard(result.suggestions.authentic, 'authentic')}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all group relative"
                >
                  <CornerNodes className="opacity-30 group-hover:opacity-60" />
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono tracking-widest text-white uppercase">AUTHENTIC</span>
                      <span className="text-[9px] font-mono text-zinc-600 group-hover:text-white transition-colors uppercase">
                        {copiedIndex === 'authentic' ? '✓ COPIED' : 'TAP TO COPY'}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{result.suggestions.authentic}</p>
                  </div>
                </button>
                {/* Feedback buttons */}
                <div className="flex gap-2 mt-3 justify-end">
                  {(['helpful', 'mid', 'off'] as const).map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleFeedback('authentic', rating)}
                      disabled={!!feedbackGiven['authentic']}
                      className={`px-3 py-2 text-sm font-mono uppercase tracking-wider border transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                        feedbackGiven['authentic'] === rating
                          ? rating === 'helpful' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' :
                            rating === 'mid' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400' :
                            'bg-red-900/50 border-red-500 text-red-400'
                          : feedbackGiven['authentic']
                          ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {rating === 'helpful' ? '👍' : rating === 'mid' ? '😐' : '👎'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wait Option (if applicable) */}
              {result.suggestions.wait && (
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">OR WAIT</span>
                  </div>
                  <p className="text-zinc-400 text-sm">{result.suggestions.wait}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pro Tip */}
          <div className="bg-zinc-900 border border-hard-gold/30 relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-hard-gold/50 via-hard-gold to-hard-gold/50"></div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <StarBurst className="w-4 h-4 text-hard-gold" />
                <span className="text-[10px] font-mono tracking-widest text-hard-gold uppercase">PRO TIP</span>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">{result.proTip}</p>
            </div>
          </div>

          {/* Action Banner */}
          <div className={`${getActionStyle(result.recommendedAction)} p-6 text-center`}>
            <div className="font-impact text-3xl uppercase tracking-wide mb-1">
              {getActionLabel(result.recommendedAction)}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-70">
              {result.recommendedAction === 'SEND' && 'GOOD TO GO. HIT SEND.'}
              {result.recommendedAction === 'WAIT' && 'CHILL FOR A BIT FIRST.'}
              {result.recommendedAction === 'PULL_BACK' && "UR DOING TOO MUCH."}
              {result.recommendedAction === 'ABORT' && 'WALK AWAY BESTIE.'}
              {result.recommendedAction === 'MATCH' && 'MIRROR THEIR VIBE.'}
              {result.recommendedAction === 'CALL' && "TEXTING AINT IT. CALL."}
            </div>
          </div>

          {/* New Scan Button */}
          <button
            onClick={() => setResult(null)}
            className="w-full py-4 border border-zinc-700 text-zinc-400 hover:text-white hover:border-white transition-all font-mono text-sm uppercase tracking-widest"
          >
            ← NEW SCAN
          </button>

        </div>
      </div>
    </div>
  );
};