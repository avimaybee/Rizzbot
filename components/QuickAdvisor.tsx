import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile, FeedbackEntry } from '../types';
import { getQuickAdvice } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createSession, submitFeedback } from '../services/dbService';
import { Sparkles, Upload, X, Image, ThumbsUp, Minus, ThumbsDown, ArrowLeft, Info, CornerDownRight, Link2, Copy, Check } from 'lucide-react';
import { useGlobalToast } from './Toast';
import { Logo } from './Logo';

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

// Suggestion Category Component - handles new multi-bubble SuggestionOption[] structure
interface SuggestionCategoryProps {
  title: string;
  titleColor: string;
  options: import('../types').SuggestionOption[];
  copiedIndex: string | null;
  onCopy: (text: string, key: string) => void;
  categoryKey: string;
  feedbackGiven?: 'helpful' | 'mid' | 'off';
  onFeedback: (rating: 'helpful' | 'mid' | 'off') => void;
}

const SuggestionCategory: React.FC<SuggestionCategoryProps> = ({
  title,
  titleColor,
  options,
  copiedIndex,
  onCopy,
  categoryKey,
  feedbackGiven,
  onFeedback,
}) => {
  return (
    <div className="border-b border-zinc-800 pb-8 mb-8 last:border-0 last:mb-0 last:pb-0">
      {/* Category Header */}
      <div className="flex items-center gap-3 mb-6 px-4 sm:px-0">
        <div className={`w-2 h-2 ${titleColor.replace('text-', 'bg-')}`}></div>
        <span className="text-xs font-mono tracking-widest text-zinc-400 uppercase">{title} MODE</span>
        <span className="text-xs font-mono text-zinc-600">//{options.length}</span>
      </div>

      {/* Options */}
      <div className="space-y-6 px-4 sm:px-0">
        {options.map((option, optIndex) => (
          <div key={optIndex} className="relative group/option">
            {/* Option Label */}
            <div className="text-[10px] font-mono text-zinc-600 mb-2 uppercase tracking-widest pl-1">
              OPTION_0{optIndex + 1}
            </div>

            {/* Individual Replies */}
            <div className="space-y-3 mb-4">
              {option.replies.map((replyItem, replyIndex) => {
                const replyKey = `${categoryKey}-${optIndex}-reply-${replyIndex}`;
                const isCopied = copiedIndex === replyKey;
                return (
                  <button
                    key={replyIndex}
                    onClick={() => onCopy(replyItem.reply, replyKey)}
                    className="w-full text-left bg-zinc-900/30 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 transition-all p-4 active:bg-zinc-800 relative group overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-4 mb-2 opacity-50">
                      <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 truncate max-w-[80%] uppercase tracking-wider">
                        <CornerDownRight className="w-3 h-3" />
                        <span className="truncate">RE: "{replyItem.originalMessage}"</span>
                      </span>
                      <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${isCopied ? 'text-emerald-500' : 'text-zinc-700 group-hover:text-zinc-400'
                        }`}>
                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="hidden sm:inline">{isCopied ? 'COPIED' : 'COPY'}</span>
                      </div>
                    </div>
                    <p className="text-zinc-100 text-sm leading-relaxed font-sans pl-1 border-l border-zinc-700/50 group-hover:border-zinc-500 transition-colors">
                      {replyItem.reply}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Conversation Hook */}
            {option.conversationHook && (
              <button
                onClick={() => onCopy(option.conversationHook, `${categoryKey}-${optIndex}-hook`)}
                className="w-full text-left pl-4 pr-4 py-3 border-l border-zinc-800 hover:border-hard-gold/50 transition-all group"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-hard-gold/60 flex items-center gap-1.5 uppercase tracking-wider">
                    <Link2 className="w-3 h-3" />
                    Conversation Hook
                  </span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed font-mono">{option.conversationHook}</p>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Feedback buttons */}
      <div className="flex gap-0 mt-6 border-t border-zinc-800 mx-4 sm:mx-0">
        {(['helpful', 'mid', 'off'] as const).map((rating) => (
          <button
            key={rating}
            onClick={() => onFeedback(rating)}
            disabled={!!feedbackGiven}
            className={`flex-1 py-3 border-r border-zinc-800 last:border-0 flex items-center justify-center gap-2 transition-colors ${feedbackGiven === rating
              ? rating === 'helpful' ? 'bg-emerald-900/20 text-emerald-400' :
                rating === 'mid' ? 'bg-yellow-900/20 text-yellow-400' :
                  'bg-red-900/20 text-red-400'
              : feedbackGiven
                ? 'text-zinc-700 cursor-not-allowed opacity-50'
                : 'text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300'
              }`}
            title={rating === 'helpful' ? 'Helpful' : rating === 'mid' ? 'Neutral' : 'Not helpful'}
          >
            {rating === 'helpful' ? <ThumbsUp className="w-3 h-3" /> : rating === 'mid' ? <Minus className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">{rating}</span>
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
    showToast('Copied to clipboard', 'copied');
    setTimeout(() => setCopiedIndex(null), 1500);
  }, [showToast]);

  const handleFeedback = useCallback((suggestionType: 'smooth' | 'bold' | 'witty' | 'authentic', rating: 'helpful' | 'mid' | 'off') => {
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
      case 'SEND': return 'bg-white text-black border-white';
      case 'WAIT': return 'bg-hard-gold text-black border-hard-gold';
      case 'PULL_BACK': return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      case 'ABORT': return 'bg-red-900/20 text-red-500 border-red-900';
      case 'MATCH': return 'bg-hard-blue/20 text-hard-blue border-hard-blue';
      case 'CALL': return 'bg-purple-900/20 text-purple-400 border-purple-900';
      default: return 'bg-zinc-800 text-white border-zinc-700';
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
      <div className="h-full w-full flex flex-col bg-matte-base relative">
        {/* Header - Fixed */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between bg-matte-base/95 backdrop-blur-sm z-30 shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-2 -ml-2 min-w-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">BACK</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-hard-gold animate-pulse"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">QUICK_MODE</span>
          </div>
        </div>

        {/* Main Scroll Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
          {/* Hero Section */}
          <div className="p-6 sm:p-8 md:p-10 border-b border-zinc-800">
            <div className="text-[10px] font-mono text-hard-gold uppercase tracking-widest mb-2">DIAGNOSTIC_V3</div>
            <h2 className="text-3xl font-impact text-white uppercase tracking-tight mb-2">WHAT DO I SAY?</h2>
            <p className="text-zinc-500 text-sm font-mono max-w-md">Input required. Provide screenshot or text context to initiate analysis.</p>
          </div>

          {/* Form Grid */}
          <div className="grid md:grid-cols-2">

            {/* Context Section */}
            <div className="border-b border-zinc-800 p-6 sm:p-8">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4 block">01 // SITUATION</label>
              <div className="grid grid-cols-5 gap-0 border border-zinc-800">
                {contextOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setContext(opt.value)}
                    className={`py-3 px-1 text-[10px] font-mono tracking-wider transition-all border-r border-zinc-800 last:border-0 min-h-[44px] hover:bg-zinc-900 ${context === opt.value
                      ? 'bg-white text-black font-bold'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Evidence Section */}
            <div className="border-b border-zinc-800 p-6 sm:p-8">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4 block flex items-center gap-2">
                02 // EVIDENCE (SCREENSHOTS)
                <span className="text-zinc-700">OPTIONAL</span>
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

              {screenshots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {screenshots.map((src, index) => (
                    <div key={index} className="relative aspect-[9/16] group bg-black border border-zinc-800">
                      <img src={src} alt="Screenshot" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 flex items-center justify-center hover:bg-red-500 transition-colors z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[9/16] border border-dashed border-zinc-800 hover:border-zinc-500 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Upload className="w-4 h-4 text-zinc-600" />
                    <span className="text-[10px] font-mono text-zinc-600 uppercase">ADD</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border border-dashed border-zinc-800 hover:border-zinc-500 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <Upload className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  <div className="text-center">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1">UPLOAD IMAGE</div>
                    <div className="text-[10px] text-zinc-600 font-mono">Tap to browse files</div>
                  </div>
                </button>
              )}
            </div>

            {/* Additional Context */}
            <div className="border-b border-zinc-800 p-6 sm:p-8">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4 block">
                03 // CONTEXT <span className="text-zinc-700">OPTIONAL</span>
              </label>
              <textarea
                value={theirMessage}
                onChange={(e) => setTheirMessage(e.target.value)}
                placeholder={screenshots.length > 0 ? "Any backstory? e.g., 'We haven't talked in 2 weeks'" : "No screenshot? Paste their message here."}
                className="w-full bg-transparent border-b border-zinc-800 pb-2 text-sm text-white placeholder:text-zinc-700 resize-none focus:outline-none focus:border-white transition-colors h-24 font-sans leading-relaxed"
              />
            </div>

            {/* Your Draft */}
            <div className="border-b border-zinc-800 p-6 sm:p-8">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4 block">
                04 // YOUR DRAFT <span className="text-zinc-700">OPTIONAL</span>
              </label>
              <textarea
                value={yourDraft}
                onChange={(e) => setYourDraft(e.target.value)}
                placeholder="What are you thinking of saying?"
                className="w-full bg-transparent border-b border-zinc-800 pb-2 text-sm text-white placeholder:text-zinc-700 resize-none focus:outline-none focus:border-white transition-colors h-24 font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* Action Area */}
          <div className="p-6 sm:p-8">
            <button
              onClick={handleAnalyze}
              disabled={(!theirMessage.trim() && screenshots.length === 0) || isLoading}
              className={`w-full py-5 font-mono text-sm uppercase tracking-widest border transition-all min-h-[50px] flex items-center justify-center gap-3 group ${(!theirMessage.trim() && screenshots.length === 0) || isLoading
                ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                : 'bg-white text-black border-white hover:bg-zinc-200 active:bg-zinc-300'
                }`}
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>ANALYZING DATA...</span>
                </>
              ) : (
                <>
                  <span>RUN DIAGNOSTIC</span>
                  <span className="text-xs opacity-50 group-hover:translate-x-1 transition-transform">→</span>
                </>
              )}
            </button>
            <div className="text-center mt-4">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                AI_MODEL: GEMINI_FLASH_2.0 // LATENCY: LOW
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="h-full w-full flex flex-col bg-matte-base relative">
      {/* Header - Fixed */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between bg-matte-base/95 backdrop-blur-sm z-30 shrink-0 sticky top-0">
        <button
          onClick={resetForm}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-2 -ml-2 min-w-[44px]"
        >
          <span className="text-lg">←</span>
          <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">NEW SCAN</span>
        </button>
        <div className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase border ${getActionStyle(result.recommendedAction)}`}>
          {getActionLabel(result.recommendedAction)}
        </div>
      </div>

      {/* Main Scroll Container */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
        {/* Vibe Check Header */}
        <div className="p-6 sm:p-8 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">VIBE_CHECK // RESULT</div>
              <div className={`text-4xl sm:text-5xl font-impact uppercase tracking-tight ${getEnergyStyle(result.vibeCheck.theirEnergy)}`}>
                {result.vibeCheck.theirEnergy}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">INTEREST LEVEL</div>
              <div className="text-2xl font-mono text-white">{result.vibeCheck.interestLevel}%</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-zinc-800 mt-4 relative">
            <div
              className={`absolute top-0 left-0 h-full ${result.vibeCheck.interestLevel >= 70 ? 'bg-white' : result.vibeCheck.interestLevel >= 40 ? 'bg-hard-gold' : 'bg-hard-blue'}`}
              style={{ width: `${result.vibeCheck.interestLevel}%` }}
            ></div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-2 mt-4">
             {result.vibeCheck.greenFlags.map((flag, i) => (
               <span key={`green-${i}`} className="text-[10px] font-mono uppercase tracking-wider border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-zinc-400">
                 + {flag}
               </span>
             ))}
             {result.vibeCheck.redFlags.map((flag, i) => (
               <span key={`red-${i}`} className="text-[10px] font-mono uppercase tracking-wider border border-red-900/30 bg-red-900/10 px-2 py-1 text-red-400">
                 ! {flag}
               </span>
             ))}
          </div>
        </div>

        {/* Extracted Message Display */}
        <div className="p-6 sm:p-8 border-b border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">ANALYZED CONTENT</div>
          <div className="pl-4 border-l-2 border-zinc-800">
            <p className="text-zinc-300 text-sm font-sans italic leading-relaxed">
              "{result.extractedTargetMessage || theirMessage}"
            </p>
          </div>
        </div>

        {/* Draft Analysis (if provided) */}
        {result.draftAnalysis && (
          <div className="p-6 sm:p-8 border-b border-zinc-800 bg-zinc-900/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">YOUR DRAFT ANALYSIS</div>
              <div className={`text-xl font-impact ${result.draftAnalysis.confidenceScore >= 70 ? 'text-white' : result.draftAnalysis.confidenceScore >= 40 ? 'text-hard-gold' : 'text-red-500'}`}>
                {result.draftAnalysis.confidenceScore}/100
              </div>
            </div>
            <p className="text-zinc-400 text-sm font-mono uppercase mb-4">{result.draftAnalysis.verdict}</p>
            <div className="bg-black border border-zinc-800 p-4 mb-4">
               <p className="text-zinc-500 text-xs font-mono">"{yourDraft}"</p>
            </div>
          </div>
        )}

        {/* Suggestions List */}
        <div>
          <div className="p-6 sm:p-8 pb-4">
            <div className="text-[10px] font-mono text-hard-gold uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              RECOMMENDED RESPONSES
            </div>
          </div>

          {/* Smooth Options */}
          <SuggestionCategory
            title="SMOOTH"
            titleColor="text-hard-gold"
            options={result.suggestions.smooth}
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
            options={result.suggestions.bold}
            copiedIndex={copiedIndex}
            onCopy={copyToClipboard}
            categoryKey="bold"
            feedbackGiven={feedbackGiven['bold']}
            onFeedback={(rating) => handleFeedback('bold', rating)}
          />

          {/* Witty Options */}
          <SuggestionCategory
            title="WITTY"
            titleColor="text-purple-400"
            options={result.suggestions.witty}
            copiedIndex={copiedIndex}
            onCopy={copyToClipboard}
            categoryKey="witty"
            feedbackGiven={feedbackGiven['witty']}
            onFeedback={(rating) => handleFeedback('witty', rating)}
          />

          {/* Authentic Options */}
          <SuggestionCategory
            title="AUTHENTIC"
            titleColor="text-white"
            options={result.suggestions.authentic}
            copiedIndex={copiedIndex}
            onCopy={copyToClipboard}
            categoryKey="authentic"
            feedbackGiven={feedbackGiven['authentic']}
            onFeedback={(rating) => handleFeedback('authentic', rating)}
          />

          {/* Wait Option */}
          {result.suggestions.wait && (
            <div className="p-6 sm:p-8 border-b border-zinc-800 bg-zinc-900/30">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">ALTERNATIVE STRATEGY</div>
              <p className="text-zinc-400 text-sm">{result.suggestions.wait}</p>
            </div>
          )}
        </div>

        {/* Pro Tip */}
        <div className="p-6 sm:p-8 border-b border-zinc-800 bg-gradient-to-r from-hard-gold/5 to-transparent">
          <div className="text-[10px] font-mono text-hard-gold uppercase tracking-widest mb-2">PRO TIP</div>
          <p className="text-zinc-300 text-sm leading-relaxed">{result.proTip}</p>
        </div>

        {/* Final Action Call */}
        <div className="p-8 text-center bg-zinc-900/50">
          <div className="text-[10px] font-mono uppercase tracking-widest opacity-60 mb-2">
            FINAL VERDICT
          </div>
          <div className="font-impact text-3xl uppercase tracking-wide mb-4 text-white">
            {getActionLabel(result.recommendedAction)}
          </div>
          <button
            onClick={() => setResult(null)}
            className="px-8 py-3 border border-zinc-700 text-zinc-400 hover:text-white hover:border-white transition-all font-mono text-xs uppercase tracking-widest"
          >
            START NEW SCAN
          </button>
        </div>

      </div>
    </div>
  );
};
