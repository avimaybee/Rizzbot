import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile, FeedbackEntry } from '../types';
import { getQuickAdvice } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createSession, submitFeedback } from '../services/dbService';
import { Sparkles, Upload, X, Image, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';
import { useGlobalToast } from './Toast';

interface QuickAdvisorProps {
  onBack: () => void;
  userProfile?: UserStyleProfile | null;
  firebaseUid?: string | null;
  userId?: number | null;
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

// Suggestion Category Component - handles both single string and array of suggestions
interface SuggestionCategoryProps {
  title: string;
  titleColor: string;
  suggestions: string | string[];
  copiedIndex: string | null;
  onCopy: (text: string, key: string) => void;
  categoryKey: string;
  feedbackGiven?: 'helpful' | 'mid' | 'off';
  onFeedback: (rating: 'helpful' | 'mid' | 'off') => void;
}

const SuggestionCategory: React.FC<SuggestionCategoryProps> = ({
  title,
  titleColor,
  suggestions,
  copiedIndex,
  onCopy,
  categoryKey,
  feedbackGiven,
  onFeedback,
}) => {
  const suggestionList = Array.isArray(suggestions) ? suggestions : [suggestions];

  return (
    <div className="relative">
      {/* Category Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-mono tracking-widest ${titleColor} uppercase`}>{title}</span>
        {suggestionList.length > 1 && (
          <span className="text-[9px] font-mono text-zinc-600">({suggestionList.length} OPTIONS)</span>
        )}
      </div>

      {/* Suggestion Options */}
      <div className={suggestionList.length > 1 ? "space-y-2" : ""}>
        {suggestionList.map((suggestion, index) => {
          const copyKey = suggestionList.length > 1 ? `${categoryKey}-${index}` : categoryKey;
          return (
            <button
              key={index}
              onClick={() => onCopy(suggestion, copyKey)}
              className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all group relative"
            >
              <CornerNodes className="opacity-30 group-hover:opacity-60" />
              <div className="p-4 sm:p-5">
                <div className="flex justify-between items-center mb-1.5">
                  {suggestionList.length > 1 && (
                    <span className="text-[9px] font-mono text-zinc-500">OPTION {index + 1}</span>
                  )}
                  <span className="text-[9px] font-mono text-zinc-600 group-hover:text-white transition-colors uppercase ml-auto">
                    {copiedIndex === copyKey ? '✓ COPIED' : 'TAP TO COPY'}
                  </span>
                </div>
                <p className="text-white text-sm leading-relaxed">{suggestion}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Feedback buttons */}
      <div className="flex gap-2 mt-3 justify-end">
        {(['helpful', 'mid', 'off'] as const).map((rating) => (
          <button
            key={rating}
            onClick={() => onFeedback(rating)}
            disabled={!!feedbackGiven}
            className={`px-3 py-2 border transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${feedbackGiven === rating
              ? rating === 'helpful' ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' :
                rating === 'mid' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400' :
                  'bg-red-900/50 border-red-500 text-red-400'
              : feedbackGiven
                ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            title={rating === 'helpful' ? 'Helpful' : rating === 'mid' ? 'Neutral' : 'Not helpful'}
          >
            {rating === 'helpful' ? <ThumbsUp className="w-4 h-4" /> : rating === 'mid' ? <Minus className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export const QuickAdvisor: React.FC<QuickAdvisorProps> = ({ onBack, userProfile, firebaseUid, userId }) => {
  const [theirMessage, setTheirMessage] = useState('');
  const [yourDraft, setYourDraft] = useState('');
  const [context, setContext] = useState<ContextOption>('talking');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useGlobalToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setScreenshots(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = useCallback(async () => {
    if (!theirMessage.trim() && screenshots.length === 0) return;

    setIsLoading(true);
    setResult(null);
    setFeedbackGiven({});
    setShowFeedbackThanks(false);

    const request: QuickAdviceRequest = {
      theirMessage: theirMessage.trim(),
      yourDraft: yourDraft.trim() || undefined,
      context,
      userStyle: userProfile || undefined,
      screenshots: screenshots.length > 0 ? screenshots : undefined
    };

    try {
      const response = await getQuickAdvice(request);
      setResult(response);
      // Log session for wellbeing tracking
      logSession('quick', undefined, undefined);

      // Save session to D1 with enhanced metadata
      if (firebaseUid) {
        try {
          const headline = response.vibeCheck?.theirEnergy
            ? `${response.vibeCheck.theirEnergy.toUpperCase()} energy detected`
            : 'Quick analysis';
          const interestLevel = response.vibeCheck?.interestLevel;

          await createSession(firebaseUid, {
            type: 'quick',
            request,
            response,
            timestamp: new Date().toISOString(),
          }, {
            mode: 'quick',
            headline,
            ghost_risk: interestLevel ? (100 - interestLevel) : undefined,
            message_count: 1,
          });
        } catch (dbError) {
          console.error('Failed to save quick session to DB:', dbError);
        }
      }
    } catch (error) {
      console.error('Quick advice failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [theirMessage, yourDraft, context, userProfile, screenshots, firebaseUid]);

  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    showToast('Response copied to clipboard!', 'copied');
    setTimeout(() => setCopiedIndex(null), 1500);
  }, [showToast]);

  const handleFeedback = useCallback((suggestionType: 'smooth' | 'bold' | 'authentic', rating: 'helpful' | 'mid' | 'off') => {
    // Save feedback locally
    saveFeedback({
      source: 'quick',
      suggestionType,
      rating,
      context,
      theirEnergy: result?.vibeCheck.theirEnergy,
      recommendedAction: result?.recommendedAction,
    });

    // Save feedback to D1 if userId available
    if (userId) {
      try {
        submitFeedback({
          user_id: userId,
          source: 'quick',
          suggestion_type: suggestionType,
          rating: rating === 'helpful' ? 1 : rating === 'mid' ? 0 : -1,
          metadata: {
            context,
            theirEnergy: result?.vibeCheck.theirEnergy,
          }
        });
      } catch (dbError) {
        console.error('Failed to submit feedback to DB:', dbError);
      }
    }

    // Update UI state
    setFeedbackGiven(prev => ({ ...prev, [suggestionType]: rating }));

    // Show toast notification
    showToast('Thanks for the feedback!', 'success');
  }, [context, result, userId, showToast]);

  const resetForm = useCallback(() => {
    setResult(null);
    setTheirMessage('');
    setYourDraft('');
    setScreenshots([]);
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
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-hidden scrollbar-hide">
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
        <div className="flex-1 p-4 sm:p-6 md:p-10 flex flex-col relative z-10 overflow-y-auto">
          {/* Title Section */}
          <div className="mb-6 sm:mb-8">
            <div className="label-sm text-hard-gold mb-2">QUICK MODE</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-impact text-white uppercase tracking-tight">WHAT DO I SAY?</h2>
            <p className="text-zinc-500 text-sm mt-2 font-mono">Paste the texts. Get the texts.</p>
          </div>

          {/* Form Grid */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 flex-1">
            {/* Left Column - Inputs */}
            <div className="space-y-6">
              {/* Screenshot Upload (Primary) */}
              <div>
                <label className="label-sm text-hard-gold mb-2 block flex items-center gap-2">
                  <Image className="w-3 h-3" />
                  EVIDENCE (SCREENSHOTS)
                </label>

                {/* File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                {/* Upload Zone / Preview */}
                <div className="space-y-3">
                  {screenshots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {screenshots.map((src, index) => (
                        <div key={index} className="relative aspect-[9/16] group bg-black border border-zinc-800">
                          <img src={src} alt="Screenshot" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          <button
                            onClick={() => removeScreenshot(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {/* Add more button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[9/16] border border-zinc-800 border-dashed flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="text-[9px] font-mono uppercase">ADD MORE</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 border border-zinc-700 border-dashed bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-500 transition-all flex flex-col items-center justify-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                        <Upload className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-mono text-zinc-300 uppercase tracking-wider mb-1">UPLOAD SCREENSHOTS</div>
                        <div className="text-[10px] text-zinc-500 font-mono">Tap to browse or drop files</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Additional Context (Secondary) */}
              <div>
                <label className="label-sm text-zinc-500 mb-2 block">ADDITIONAL CONTEXT <span className="text-zinc-600">(OPTIONAL)</span></label>
                <textarea
                  value={theirMessage}
                  onChange={(e) => setTheirMessage(e.target.value)}
                  placeholder={screenshots.length > 0 ? "Any backstory? e.g., 'We haven't talked in 2 weeks' or 'They're my coworker'" : "No screenshot? Paste their message here. Or add context like 'met on hinge last week'"}
                  className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white placeholder:text-zinc-500/60 resize-none focus:outline-none focus:border-white transition-colors h-24 font-mono text-sm"
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
                      className={`py-2 md:py-3 px-1 md:px-4 border text-[8px] md:text-[10px] font-mono tracking-wider transition-all ${context === opt.value
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
                disabled={(!theirMessage.trim() && screenshots.length === 0) || isLoading}
                className={`w-full py-5 font-impact text-2xl uppercase tracking-wide border transition-all ${(!theirMessage.trim() && screenshots.length === 0) || isLoading
                  ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'bg-white text-black border-white hover:bg-zinc-200'
                  }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <Sparkles className="w-5 h-5 animate-spin" />
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
    <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide">
      {/* Background */}
      <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
      <div className="absolute inset-0 bg-scan-lines opacity-10 pointer-events-none"></div>

      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between relative z-30 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
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
      <div className="flex-1 p-4 sm:p-6 md:p-10 relative z-10">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

          {/* Page Title */}
          <div className="mb-2">
            <div className="label-sm text-hard-gold mb-1">ANALYSIS COMPLETE</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-impact text-white uppercase tracking-tight">YOUR VIBE CHECK</h2>
          </div>

          {/* Vibe Check Card */}
          <div className="bg-zinc-900 border border-zinc-800 relative">
            <CornerNodes className="opacity-50" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="label-sm text-zinc-500 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-hard-gold"></div>
                  THEIR MESSAGE
                </div>
                <div className={`text-3xl font-impact ${getEnergyStyle(result.vibeCheck.theirEnergy)}`}>
                  {result.vibeCheck.theirEnergy.toUpperCase()}
                </div>
              </div>

              {/* Show extracted target message from OCR or user input */}
              <div className="bg-black/50 border border-zinc-800 p-3 mb-4">
                {result.extractedTargetMessage ? (
                  <div>
                    <div className="text-[9px] font-mono text-hard-gold uppercase tracking-wider mb-1.5">
                      📱 EXTRACTED FROM SCREENSHOT
                    </div>
                    <p className="text-zinc-300 text-sm font-mono italic">"{result.extractedTargetMessage}"</p>
                  </div>
                ) : (
                  <p className="text-zinc-300 text-sm font-mono italic">"{theirMessage}"</p>
                )}
              </div>

              {/* Interest Level Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-2 uppercase tracking-wider">
                  <span>INTEREST LEVEL</span>
                  <span>{result.vibeCheck.interestLevel}%</span>
                </div>
                <div className="h-1 bg-zinc-800 relative">
                  <div
                    className={`h-full transition-all ${result.vibeCheck.interestLevel >= 70 ? 'bg-white' :
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
            <div className={`bg-zinc-900 border relative ${result.draftAnalysis.confidenceScore < 40 ? 'border-red-900/50' : 'border-zinc-800'
              }`}>
              <CornerNodes className="opacity-50" />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="label-sm text-zinc-500 flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 ${result.draftAnalysis.confidenceScore < 40 ? 'bg-red-500' : 'bg-hard-blue'}`}></div>
                    YOUR DRAFT {result.draftAnalysis.confidenceScore < 40 && <span className="text-red-500">// DON'T SEND THIS</span>}
                  </div>
                  <div className={`text-3xl font-impact ${result.draftAnalysis.confidenceScore >= 70 ? 'text-white' :
                    result.draftAnalysis.confidenceScore >= 40 ? 'text-hard-gold' : 'text-red-500'
                    }`}>
                    {result.draftAnalysis.confidenceScore}%
                  </div>
                </div>

                {/* Show user's actual draft */}
                <div className={`border p-3 mb-4 ${result.draftAnalysis.confidenceScore < 40
                  ? 'bg-red-950/30 border-red-900/50'
                  : 'bg-black/50 border-zinc-800'
                  }`}>
                  <p className="text-zinc-300 text-sm font-mono italic">"{yourDraft}"</p>
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
                <Sparkles className="w-3 h-3 text-hard-gold" />
                SAY THIS INSTEAD
              </span>
            </div>
            <div className="space-y-3">
              {/* Smooth Options */}
              <SuggestionCategory
                title="SMOOTH"
                titleColor="text-hard-gold"
                suggestions={result.suggestions.smooth}
                copiedIndex={copiedIndex}
                onCopy={copyToClipboard}
                categoryKey="smooth"
                feedbackGiven={feedbackGiven['smooth']}
                onFeedback={(rating) => handleFeedback('smooth', rating)}
              />

              {/* Bold Options */}
              <SuggestionCategory
                title="BOLD"
                titleColor="text-hard-blue"
                suggestions={result.suggestions.bold}
                copiedIndex={copiedIndex}
                onCopy={copyToClipboard}
                categoryKey="bold"
                feedbackGiven={feedbackGiven['bold']}
                onFeedback={(rating) => handleFeedback('bold', rating)}
              />

              {/* Authentic Options */}
              <SuggestionCategory
                title="AUTHENTIC"
                titleColor="text-white"
                suggestions={result.suggestions.authentic}
                copiedIndex={copiedIndex}
                onCopy={copyToClipboard}
                categoryKey="authentic"
                feedbackGiven={feedbackGiven['authentic']}
                onFeedback={(rating) => handleFeedback('authentic', rating)}
              />

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
                <Sparkles className="w-4 h-4 text-hard-gold" />
                <span className="text-[10px] font-mono tracking-widest text-hard-gold uppercase">PRO TIP</span>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">{result.proTip}</p>
            </div>
          </div>

          {/* Action Banner - Clarify this is for the AI suggestions */}
          <div className={`${getActionStyle(result.recommendedAction)} p-6 text-center`}>
            <div className="text-[9px] font-mono uppercase tracking-widest opacity-60 mb-2">
              USE ONE OF THE SUGGESTIONS ABOVE
            </div>
            <div className="font-impact text-3xl uppercase tracking-wide mb-1">
              {getActionLabel(result.recommendedAction)}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-70">
              {result.recommendedAction === 'SEND' && 'PICK A REPLY ABOVE. SEND THAT.'}
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