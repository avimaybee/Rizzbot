import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Upload, MessageSquare, Copy, Check, Sparkles, ThumbsUp, Minus, ThumbsDown, ArrowLeft } from 'lucide-react';
import { generatePersona, simulateDraft, analyzeSimulation } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createPersona, createSession } from '../services/dbService';
import { SimResult, Persona, SimAnalysisResult, UserStyleProfile } from '../types';
import { useGlobalToast } from './Toast';

interface SimulatorProps {  // User's style profile for personalized suggestions
  userProfile?: UserStyleProfile | null;
  // User's Firebase UID for storing sessions
  firebaseUid?: string | null;
  // User's numeric ID for storing personas
  userId?: number | null;
  onBack: () => void;
}

type View = 'setup' | 'chat' | 'analysis';

const CornerNodes = ({ className }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
    <div className="absolute top-0 left-0">
      <div className="w-2 h-2 border-t border-l border-zinc-500"></div>
    </div>
    <div className="absolute top-0 right-0">
      <div className="w-2 h-2 border-t border-r border-zinc-500"></div>
    </div>
    <div className="absolute bottom-0 left-0">
      <div className="w-2 h-2 border-b border-l border-zinc-500"></div>
    </div>
    <div className="absolute bottom-0 right-0">
      <div className="w-2 h-2 border-b border-r border-zinc-500"></div>
    </div>
  </div>
);

export const Simulator: React.FC<SimulatorProps> = ({ userProfile, firebaseUid, userId, onBack }) => {
  const [view, setView] = useState<View>('setup');
  const { showToast } = useGlobalToast();

  // Copy to clipboard state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Loading States
  const [setupLoading, setSetupLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Setup State
  const [personaDescription, setPersonaDescription] = useState('');
  const [customName, setCustomName] = useState('');
  const [relationshipContext, setRelationshipContext] = useState<'NEW_MATCH' | 'TALKING_STAGE' | 'DATING' | 'SITUATIONSHIP' | 'EX' | 'FRIEND'>('TALKING_STAGE');
  const [harshnessLevel, setHarshnessLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [draft, setDraft] = useState('');
  const [simHistory, setSimHistory] = useState<{ draft: string, result: SimResult }[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);  // Custom dropdown state
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showPracticePartners, setShowPracticePartners] = useState(false); // Mobile collapsible

  // Analysis State
  const [analysisResult, setAnalysisResult] = useState<SimAnalysisResult | null>(null);

  // Feedback State
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});

  // Saved Personas (Local Storage Mock)
  const [savedPersonas, setSavedPersonas] = useState<Persona[]>(() => {
    const saved = localStorage.getItem('unsend_personas');
    return saved ? JSON.parse(saved) : [];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage when persona changes
  useEffect(() => {
    if (activePersona?.name) {
      const storageKey = `unsend_sim_history_${activePersona.name.replace(/\s+/g, '_')}`;
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try {
          setSimHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error('Failed to load chat history:', e);
          setSimHistory([]);
        }
      } else {
        setSimHistory([]);
      }
    }
  }, [activePersona?.name]);

  // Save chat history to localStorage when it changes
  useEffect(() => {
    if (activePersona?.name && simHistory.length > 0) {
      const storageKey = `unsend_sim_history_${activePersona.name.replace(/\s+/g, '_')}`;
      localStorage.setItem(storageKey, JSON.stringify(simHistory));
    }
  }, [simHistory, activePersona?.name]);

  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simHistory, view, chatLoading]);

  // Copy to clipboard with visual feedback
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast('Copied to clipboard!', 'copied');
    setTimeout(() => setCopiedText(null), 1500);
  }, [showToast]);

  // Handle feedback on rewrite suggestions
  const handleFeedback = useCallback((suggestionType: 'safe' | 'bold' | 'spicy' | 'you', rating: 'helpful' | 'mid' | 'off', entryIndex: number) => {
    if (!firebaseUid) return;
    const key = `${entryIndex}-${suggestionType}`;
    saveFeedback(firebaseUid, {
      source: 'practice',
      suggestionType,
      rating,
      context: relationshipContext.toLowerCase(),
    });
    setFeedbackGiven(prev => ({ ...prev, [key]: rating }));
  }, [relationshipContext, firebaseUid]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setPreviewUrls(prev => [...prev, base64]);
          setScreenshots(prev => [...prev, base64.split(',')[1]]);
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const buildPersona = async () => {
    if (!personaDescription && screenshots.length === 0) return;
    setSetupLoading(true);
    try {
      const persona = await generatePersona(personaDescription, screenshots, relationshipContext, harshnessLevel);
      if (customName.trim()) persona.name = customName.trim();
      setActivePersona(persona);

      // Save persona to D1 if userId is available
      if (userId) {
        try {
          await createPersona({
            user_id: userId,
            name: persona.name,
            relationship_context: relationshipContext,
            harshness_level: harshnessLevel,
            communication_tips: persona.communicationTips || [],
            conversation_starters: persona.conversationStarters || [],
            things_to_avoid: persona.thingsToAvoid || [],
          });
        } catch (dbError) {
          console.error('Failed to save persona to DB:', dbError);
          // Continue anyway, feature still works locally
        }
      }

      // Also save locally
      setSavedPersonas(prev => [...prev, persona]);
      localStorage.setItem('unsend_personas', JSON.stringify([...savedPersonas, persona]));
    } finally {
      setSetupLoading(false);
      setView('chat');
    }
  };

  const loadPersona = (p: Persona) => {
    setActivePersona(p);
    setView('chat');
  };

  const runSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activePersona || !firebaseUid) return;
    const sentMessage = draft;
    setPendingMessage(sentMessage);
    setDraft('');
    setChatLoading(true);
    const result = await simulateDraft(firebaseUid, sentMessage, activePersona, userProfile);
    setSimHistory(prev => [...prev, { draft: sentMessage, result }]);
    setPendingMessage(null);
    setChatLoading(false);
  };

  const handleEndSim = async () => {
    if (!activePersona || simHistory.length === 0 || !firebaseUid) return;
    setAnalyzing(true);
    try {
      const result = await analyzeSimulation(simHistory, activePersona, userProfile);
      setAnalysisResult(result);

      // Log session for wellbeing tracking
      logSession(firebaseUid, 'practice', activePersona.name, result.ghostRisk);

      // Save session to D1 with enhanced metadata
      if (firebaseUid) {
        try {
          await createSession(firebaseUid, {
            type: 'practice',
            persona: activePersona.name,
            analysis: result,
            history: simHistory,
            timestamp: new Date().toISOString(),
          }, {
            mode: 'simulator',
            persona_name: activePersona.name,
            headline: result.headline,
            ghost_risk: result.ghostRisk,
            message_count: simHistory.length,
          });
        } catch (dbError) {
          console.error('Failed to save session to DB:', dbError);
          // Continue anyway
        }
      }
    } finally {
      setAnalyzing(false);
      setView('analysis');
    }
  };

  const copyToDraft = (text: string) => {
    setDraft(text);
  };

  const resetSim = () => {
    setSimHistory([]);
    setAnalysisResult(null);
    setFeedbackGiven({});
    setView('chat');
  };

  // --- LOADING STATES ---
  if (setupLoading || analyzing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-matte-panel border border-zinc-800 max-w-2xl mx-auto p-12 relative">
        <CornerNodes />
        <div className="relative mb-8">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-hard-blue animate-spin rounded-full"></div>
        </div>
        <h2 className="text-4xl font-impact text-white mb-2 uppercase tracking-wide">
          {analyzing ? "Running Diagnostics" : "Building Profile"}
        </h2>
        <p className="label-sm text-zinc-500 animate-pulse">
          {analyzing ? "CALCULATING SIMP COEFFICIENT..." : "DECODING BEHAVIORAL PATTERNS..."}
        </p>
      </div>
    );
  }

  // --- SETUP VIEW ---
  if (view === 'setup') {
    return (
      <div className="w-full h-full max-w-full mx-auto bg-matte-panel border border-zinc-800 flex flex-col shadow-2xl relative overflow-hidden pb-32 md:pb-0">
        <CornerNodes />

        {/* TACTICAL HUD HEADER */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between relative z-30 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-2 -ml-2 min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-widest group-hover:text-hard-blue transition-colors">BACK</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-hard-blue animate-pulse"></div>
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">PRACTICE_MODE</span>
          </div>
        </div>

        {/* MOBILE: Show header first, then archive inline */}
        <div className="flex flex-col md:flex-row h-full overflow-hidden">

          {/* LEFT: SAVED PROFILES - Collapsible on mobile, sidebar on desktop */}
          <div className={`order-2 md:order-1 w-full md:w-1/3 border-t md:border-t-0 md:border-r border-zinc-800 bg-zinc-900/50 flex flex-col md:h-full ${savedPersonas.length === 0 ? 'hidden md:flex' : ''}`}>
            {/* Mobile: Collapsible dropdown header - More compact */}
            <button
              className="md:hidden w-full p-3 flex items-center justify-between min-h-[44px]"
              onClick={() => setShowPracticePartners(!showPracticePartners)}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-hard-blue rounded-sm"></div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Practice Partners</h4>
                {savedPersonas.length > 0 && (
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{savedPersonas.length}</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showPracticePartners ? 'rotate-180' : ''}`} />
            </button>

            {/* Mobile: Collapsible content */}
            <div className={`md:hidden overflow-hidden transition-all duration-200 ${showPracticePartners ? 'max-h-64' : 'max-h-0'}`}>
              <div className="px-4 pb-4 space-y-2 overflow-y-auto max-h-56 scrollbar-hide">
                {savedPersonas.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadPersona(p)}
                    className="w-full text-left p-4 bg-zinc-900/80 border border-zinc-800 hover:border-hard-blue hover:bg-zinc-800/80 transition-all group rounded-sm min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-hard-blue/20 to-hard-blue/5 border border-hard-blue/30 rounded-sm flex items-center justify-center text-hard-blue text-sm font-bold">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-zinc-200 truncate">{p.name}</div>
                        <div className="text-xs text-zinc-500 truncate">{p.relationshipContext?.replace('_', ' ')}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: Full sidebar */}
            <div className="hidden md:flex md:flex-col md:h-full md:p-6">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-hard-blue rounded-sm"></div>
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Practice Partners</h4>
                </div>
                {savedPersonas.length > 0 && (
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{savedPersonas.length}</span>
                )}
              </div>

              <div className={`space-y-2 overflow-y-auto flex-1 scrollbar-hide ${savedPersonas.length === 0 ? 'flex items-center justify-center' : ''}`}>
                {savedPersonas.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-zinc-600" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mb-1">No saved personas yet</p>
                    <p className="text-xs text-zinc-600">create your first practice partner →</p>
                  </div>
                ) : (
                  savedPersonas.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadPersona(p)}
                      className="w-full text-left p-4 bg-zinc-900/80 border border-zinc-800 hover:border-hard-blue hover:bg-zinc-800/80 transition-all group rounded-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-hard-blue/20 to-hard-blue/5 border border-hard-blue/30 rounded-sm flex items-center justify-center text-hard-blue text-sm font-bold group-hover:from-hard-blue/30 group-hover:to-hard-blue/10 transition-all">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="font-bold text-sm text-zinc-200 group-hover:text-white truncate">{p.name}</div>
                            {p.relationshipContext && (
                              <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 uppercase shrink-0">
                                {p.relationshipContext.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{p.tone}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: BUILDER - Shown first on mobile */}
          <div className="order-1 md:order-2 w-full md:w-2/3 p-3 sm:p-6 md:p-10 relative flex flex-col bg-matte-panel overflow-y-auto scrollbar-hide h-full">
            <div className="max-w-2xl mx-auto w-full">
              <div className="mb-4 sm:mb-6">
                <div className="label-sm text-hard-blue mb-1">PRACTICE MODE</div>
                <h3 className="font-impact text-2xl sm:text-4xl text-white tracking-wide mb-2">WHO'S GOT YOU IN YOUR HEAD?</h3>
                <p className="text-zinc-500 font-editorial text-xs sm:text-sm">Spill the tea so we can help you cook the right response.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="label-sm text-zinc-400">Their Name <span className="text-hard-gold">*</span></label>
                    <input
                      type="text"
                      className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-base sm:text-sm font-mono focus:border-white focus:outline-none uppercase placeholder:text-zinc-500/60"
                      placeholder="ALEX"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <label className="label-sm text-zinc-400">The Situationship</label>
                    <button
                      type="button"
                      onClick={() => setShowContextDropdown(!showContextDropdown)}
                      className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-base sm:text-sm font-mono focus:border-white focus:outline-none uppercase cursor-pointer text-left flex justify-between items-center min-h-[44px]"
                    >
                      <span>{relationshipContext.replace('_', ' ')}</span>
                      <span className="text-zinc-500">{showContextDropdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</span>
                    </button>
                    {showContextDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900 border border-zinc-700 shadow-xl">
                        {(['NEW_MATCH', 'TALKING_STAGE', 'DATING', 'SITUATIONSHIP', 'EX', 'FRIEND'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setRelationshipContext(option);
                              setShowContextDropdown(false);
                            }}
                            className={`w-full p-3 text-left text-xs font-mono uppercase transition-colors min-h-[44px] ${relationshipContext === option
                              ? 'bg-white text-black'
                              : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                              }`}
                          >
                            {option.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-sm text-zinc-400 flex items-center justify-between">
                    <span>Feedback Style</span>
                    <span className="text-xs font-mono text-zinc-500">
                      {harshnessLevel === 1 && 'GENTLE'}
                      {harshnessLevel === 2 && 'SUPPORTIVE'}
                      {harshnessLevel === 3 && 'HONEST'}
                      {harshnessLevel === 4 && 'DIRECT'}
                      {harshnessLevel === 5 && 'BRUTAL'}
                    </span>
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 p-4 min-h-[44px]">
                    <span className="text-xs text-zinc-500 font-mono">1</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={harshnessLevel}
                      onChange={(e) => setHarshnessLevel(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                      className="flex-1 h-1 bg-zinc-700 appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((harshnessLevel - 1) / 4) * 100}%, #3f3f46 ${((harshnessLevel - 1) / 4) * 100}%, #3f3f46 100%)`
                      }}
                    />
                    <span className="text-xs text-zinc-500 font-mono">5</span>
                  </div>
                  <p className="text-xs text-zinc-600 font-mono mt-1">
                    {harshnessLevel === 1 && '→ Gentle encouragement, positive framing'}
                    {harshnessLevel === 2 && '→ Supportive feedback with soft corrections'}
                    {harshnessLevel === 3 && '→ Honest reality checks, balanced approach'}
                    {harshnessLevel === 4 && '→ Direct truth, no sugar coating'}
                    {harshnessLevel === 5 && '→ Brutal honesty, maximum roast mode'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="label-sm text-zinc-400">Their Red Flags</label>
                  <textarea
                    className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white text-base sm:text-sm focus:border-white focus:outline-none h-32 resize-none leading-relaxed placeholder:text-zinc-500/60"
                    placeholder="Describe their vibe. Dry texter? Love bomber? Emoji abuser? The devil's in the details."
                    value={personaDescription}
                    onChange={(e) => setPersonaDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="label-sm text-zinc-400">Receipts (Optional)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-zinc-700 bg-zinc-900/50 p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-all group min-h-[44px]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 text-lg group-hover:text-white"><Upload className="w-4 h-4" /></span>
                      <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">Upload Screenshots</span>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    {previewUrls.length > 0 && <span className="text-xs font-bold text-hard-blue border border-hard-blue/30 px-2 py-0.5 rounded-sm">{previewUrls.length} FILES</span>}
                  </div>

                  {/* Screenshot Previews with Remove */}
                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group aspect-[9/16] bg-zinc-800 border border-zinc-700 overflow-hidden">
                          <img
                            src={url}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewUrls(prev => prev.filter((_, i) => i !== index));
                              setScreenshots(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-sm min-w-[24px] min-h-[24px]"
                          >
                            <span className="text-xs font-bold">×</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={buildPersona}
                  disabled={!customName.trim() || (!personaDescription && screenshots.length === 0)}
                  className="w-full bg-white text-black font-impact text-xl py-4 hover:bg-zinc-200 transition-all disabled:opacity-50 mt-6 border border-white tracking-wide uppercase min-h-[50px]"
                >
                  Lock & Load
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ANALYSIS VIEW ---
  if (view === 'analysis' && analysisResult) {
    const getRiskColor = (risk: number) => {
      if (risk > 70) return { text: 'text-red-400', bg: 'bg-red-950/40', border: 'border-red-800/60', bar: 'bg-red-500' };
      if (risk > 40) return { text: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-800/60', bar: 'bg-yellow-500' };
      return { text: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/60', bar: 'bg-emerald-500' };
    };
    const riskColors = getRiskColor(analysisResult.ghostRisk);

    const getActionStyle = (action: string) => {
      switch (action) {
        case 'HARD_STOP': return { icon: '🛑', text: 'text-red-400', bg: 'bg-red-950/50', border: 'border-red-700' };
        case 'PULL_BACK': return { icon: '⚠️', text: 'text-yellow-400', bg: 'bg-yellow-950/50', border: 'border-yellow-700' };
        case 'WAIT': return { icon: '⏸️', text: 'text-orange-400', bg: 'bg-orange-950/50', border: 'border-orange-700' };
        case 'FULL_SEND': return { icon: '🚀', text: 'text-emerald-400', bg: 'bg-emerald-950/50', border: 'border-emerald-700' };
        default: return { icon: '💬', text: 'text-blue-400', bg: 'bg-blue-950/50', border: 'border-blue-700' };
      }
    };

    return (
      <div className="w-full h-full max-w-6xl mx-auto bg-matte-panel border border-zinc-800 flex flex-col relative scrollbar-hide pb-24 md:pb-0">
        <CornerNodes />

        {/* Header - More compact */}
        <div className="bg-zinc-900 px-3 sm:px-5 py-3 sm:py-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 border border-zinc-600 bg-zinc-800 flex items-center justify-center">
              <span className="text-lg sm:text-xl">📊</span>
            </div>
            <div>
              <h2 className="font-impact text-base sm:text-lg text-white tracking-wide uppercase">Analysis</h2>
              <p className="text-xs text-zinc-500 font-mono">
                {simHistory.length} exchange{simHistory.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={() => setView('chat')} className="label-sm text-zinc-400 hover:text-white border border-zinc-700 px-4 py-2 hover:bg-zinc-800 transition-colors min-h-[44px]">
            ← BACK
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-matte-base">
          <div className="p-3 sm:p-5 lg:p-8">
            <div className="max-w-5xl mx-auto">
              {/* Hero Section - Headline + Action */}
              <div className="text-center mb-6 sm:mb-10">
                <h3 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-impact text-white mb-5 sm:mb-6 uppercase leading-tight tracking-wide">
                  {analysisResult.headline}
                </h3>
                {/* Recommended Action - Prominent Card */}
                {analysisResult.recommendedNextMove && (() => {
                  const actionStyle = getActionStyle(analysisResult.recommendedNextMove);
                  return (
                    <div className={`inline-flex flex-col items-center ${actionStyle.bg} border-2 ${actionStyle.border} px-8 py-6 sm:px-12 sm:py-8`}>
                      <span className="text-4xl mb-3">{actionStyle.icon}</span>
                      <span className="label-sm text-zinc-400 mb-2">RECOMMENDED ACTION</span>
                      <span className={`font-impact text-2xl sm:text-3xl ${actionStyle.text} tracking-wider`}>
                        {analysisResult.recommendedNextMove.replace('_', ' ')}
                      </span>
                      {analysisResult.conversationFlow && (
                        <span className="text-xs text-zinc-500 font-mono mt-3 border-t border-zinc-700 pt-3">
                          Conversation Flow: <span className="text-zinc-300">{analysisResult.conversationFlow}</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Stats Grid - 3 Column */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-14">
                {/* Ghost Risk - Main Stat */}
                <div className={`${riskColors.bg} border ${riskColors.border} p-6 sm:p-8 text-center`}>
                  <span className="label-sm text-zinc-400 block mb-4">GHOST RISK</span>
                  <div className="relative inline-block">
                    <span className={`font-mono font-bold text-5xl sm:text-6xl ${riskColors.text}`}>
                      {analysisResult.ghostRisk}
                    </span>
                    <span className={`text-2xl ${riskColors.text} ml-1`}>%</span>
                  </div>
                  <div className="w-full h-2 bg-black/50 mt-6 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${riskColors.bar} transition-all duration-500`}
                      style={{ width: `${analysisResult.ghostRisk}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 font-mono">
                    {analysisResult.ghostRisk > 70 ? '⚠ HIGH - Proceed with caution' :
                      analysisResult.ghostRisk > 40 ? '◐ MODERATE - Could go either way' :
                        '✓ LOW - Looking good'}
                  </p>
                </div>

                {/* Vibe Match */}
                <div className="bg-zinc-900/60 border border-zinc-800 p-6 sm:p-8 text-center">
                  <span className="label-sm text-hard-blue block mb-4">VIBE MATCH</span>
                  <div className="relative inline-block">
                    <span className="font-mono font-bold text-5xl sm:text-6xl text-white">
                      {analysisResult.vibeMatch}
                    </span>
                    <span className="text-2xl text-zinc-500 ml-1">%</span>
                  </div>
                  <div className="w-full h-2 bg-black/50 mt-6 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hard-blue transition-all duration-500"
                      style={{ width: `${analysisResult.vibeMatch}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 font-mono">
                    How well your energy matches theirs
                  </p>
                </div>

                {/* Effort Balance */}
                <div className="bg-zinc-900/60 border border-zinc-800 p-6 sm:p-8 text-center">
                  <span className="label-sm text-hard-gold block mb-4">EFFORT BALANCE</span>
                  <div className="relative inline-block">
                    <span className="font-mono font-bold text-5xl sm:text-6xl text-white">
                      {analysisResult.effortBalance}
                    </span>
                    <span className="text-2xl text-zinc-500 ml-1">%</span>
                  </div>
                  <div className="w-full h-2 bg-black/50 mt-6 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hard-gold transition-all duration-500"
                      style={{ width: `${analysisResult.effortBalance}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 font-mono">
                    Who's putting in more work
                  </p>
                </div>
              </div>

              {/* Insights + Advice - 2 Column */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Insights */}
                <div className="bg-zinc-900/40 border border-zinc-800 p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                    <span className="text-xl">💡</span>
                    <h4 className="font-impact text-lg uppercase tracking-wide text-white">Key Insights</h4>
                  </div>
                  <ul className="space-y-4">
                    {analysisResult.insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-hard-gold mt-1">→</span>
                        <p className="text-sm text-zinc-300 leading-relaxed">{insight}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Strategic Advice */}
                <div className="bg-white text-black p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-200">
                    <span className="text-xl">🎯</span>
                    <h4 className="font-impact text-lg uppercase tracking-wide">Strategic Advice</h4>
                  </div>
                  <p className="text-base sm:text-lg leading-relaxed">
                    "{analysisResult.advice}"
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-zinc-800 bg-zinc-900 flex justify-center gap-4 shrink-0">
          <button
            onClick={() => setView('chat')}
            className="label-sm text-zinc-400 hover:text-white border border-zinc-700 px-6 py-3 hover:bg-zinc-800 transition-colors min-h-[44px]"
          >
            ← Continue Chat
          </button>
          <button
            onClick={resetSim}
            className="label-sm text-white bg-zinc-800 border border-zinc-600 px-6 py-3 hover:bg-zinc-700 transition-colors min-h-[44px]"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // --- CHAT VIEW ---
  return (
    <div className="w-full h-full max-w-6xl mx-auto bg-matte-panel border border-zinc-800 flex flex-col relative shadow-2xl scrollbar-hide pb-24 md:pb-0">
      <CornerNodes />

      {/* CHAT HEADER - More compact */}
      <div className="bg-zinc-900 px-3 py-2.5 sm:p-3 border-b border-zinc-800 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600 flex items-center justify-center text-white font-bold text-sm sm:text-base font-impact">
            {activePersona?.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-impact text-white text-xs sm:text-sm uppercase tracking-wider">{activePersona?.name}</h2>
            <span className="text-xs text-zinc-500 font-mono">
              {simHistory.length} msg{simHistory.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          {simHistory.length > 0 && (
            <button onClick={handleEndSim} className="label-sm text-red-400 hover:text-red-300 border border-red-800/50 px-2 sm:px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 transition-colors min-h-[44px]">
              END
            </button>
          )}
          <button onClick={() => setView('setup')} className="label-sm text-zinc-500 hover:text-white transition-colors px-2 py-1.5 min-h-[44px]">
            EXIT
          </button>
        </div>
      </div>

      {/* CHAT AREA - 2 Column on Desktop */}
      <div className="flex-1 overflow-y-auto bg-matte-base custom-scrollbar relative scrollbar-hide">
        <div className="absolute inset-0 bg-scan-lines opacity-5 pointer-events-none"></div>

        <div className="p-3 sm:p-5 lg:p-6 space-y-4 lg:space-y-6 relative z-10">
          {simHistory.length === 0 && !chatLoading && (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-zinc-700 flex items-center justify-center mb-4 bg-zinc-900/50">
                <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-600" />
              </div>
              <p className="label-sm text-hard-blue mb-2">PRACTICE CONVERSATION</p>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-xs mb-1.5">
                Test how <span className="text-white font-semibold">{activePersona?.name || 'they'}</span> might respond to your messages
              </p>
              <p className="text-zinc-600 text-xs font-mono">↓ type below and hit send ↓</p>
            </div>
          )}

          {simHistory.map((entry, idx) => (
            <div key={idx} className="space-y-4">
              {/* Conversation Exchange - 2 Column Layout on Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* LEFT: Messages */}
                <div className="space-y-4">
                  {/* USER MESSAGE */}
                  <div className="flex justify-end lg:justify-start">
                    <div className="max-w-[90%] lg:max-w-full bg-white text-black px-5 py-4 text-sm font-medium leading-relaxed border border-zinc-200 shadow-[4px_4px_0px_rgba(0,0,0,0.4)] relative group">
                      <div className="label-sm text-zinc-500 mb-2">YOU SENT</div>
                      <p className="text-black">{entry.draft}</p>
                      <button
                        onClick={() => copyToClipboard(entry.draft)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 border border-zinc-300 min-w-[28px] min-h-[28px]"
                        title="Copy to clipboard"
                      >
                        {copiedText === entry.draft ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* PREDICTED REPLY */}
                  <div className="flex justify-start">
                    <div className="flex items-start gap-3 max-w-[90%] lg:max-w-full group">
                      <div className="w-9 h-9 bg-gradient-to-br from-zinc-700 to-zinc-800 flex-shrink-0 flex items-center justify-center text-sm text-white font-impact border border-zinc-600">
                        {activePersona?.name.charAt(0)}
                      </div>
                      <div className="flex-1 bg-zinc-800/80 text-zinc-200 px-5 py-4 text-sm leading-relaxed border border-zinc-700 relative">
                        <div className="label-sm text-zinc-500 mb-2">PREDICTED REPLY</div>
                        <p>{entry.result.predictedReply}</p>
                        <button
                          onClick={() => copyToClipboard(entry.result.predictedReply || '')}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-zinc-400 hover:text-white min-w-[28px] min-h-[28px]"
                          title="Copy reply"
                        >
                          {copiedText === entry.result.predictedReply ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Analysis Panel */}
                <div className="bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5">
                  {/* Analysis Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                    <span className="label-sm text-zinc-400">MESSAGE ANALYSIS</span>
                    <div className={`px-3 py-1 border text-xs font-bold uppercase tracking-wider ${entry.result.regretLevel > 70 ? 'bg-red-950/50 border-red-800/50 text-red-400' :
                      entry.result.regretLevel > 40 ? 'bg-yellow-950/50 border-yellow-800/50 text-yellow-400' :
                        'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
                      }`}>
                      {entry.result.regretLevel > 70 ? '⚠ HIGH RISK' : entry.result.regretLevel > 40 ? '◐ MODERATE' : '✓ LOW RISK'} • {entry.result.regretLevel}%
                    </div>
                  </div>

                  {/* Verdict */}
                  <p className="text-sm text-zinc-300 mb-5 leading-relaxed">
                    {entry.result.verdict}
                  </p>

                  {/* Suggestions Grid - Clean 2x2 */}
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(entry.result.rewrites).filter(([_, text]) => text).map(([key, text]) => (
                      <button
                        key={key}
                        onClick={() => copyToDraft(text as string)}
                        className={`group relative p-3 border text-left transition-all hover:scale-[1.02] min-h-[60px] ${key === 'safe' ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/30' :
                          key === 'bold' ? 'border-blue-900/50 hover:border-blue-700/70 bg-blue-950/20' :
                            key === 'spicy' ? 'border-red-900/50 hover:border-red-700/70 bg-red-950/20' :
                              'border-hard-gold/40 hover:border-hard-gold/70 bg-amber-950/20'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${key === 'safe' ? 'text-zinc-400' :
                            key === 'bold' ? 'text-blue-400' :
                              key === 'spicy' ? 'text-red-400' :
                                'text-hard-gold'
                            }`}>
                            {key === 'you' ? <><Sparkles className="w-3 h-3" /> YOUR STYLE</> : key}
                          </span>
                          <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">TAP TO USE</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">"{text as string}"</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(text as string); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-[10px] min-w-[24px] min-h-[24px]"
                          title="Copy"
                        >
                          {copiedText === text ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Divider between exchanges */}
              {
                idx < simHistory.length - 1 && (
                  <div className="flex items-center gap-4 py-4">
                    <div className="flex-1 h-px bg-zinc-800"></div>
                    <span className="text-xs text-zinc-600 font-mono">EXCHANGE {idx + 2}</span>
                    <div className="flex-1 h-px bg-zinc-800"></div>
                  </div>
                )
              }
            </div>
          ))}

          {/* Show pending message immediately */}
          {
            pendingMessage && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div className="flex justify-end lg:justify-start">
                  <div className="max-w-[90%] lg:max-w-full bg-white text-black px-5 py-4 text-sm font-medium leading-relaxed border border-zinc-200 shadow-[4px_4px_0px_rgba(0,0,0,0.4)] opacity-70">
                    <div className="label-sm text-zinc-500 mb-2">SENDING...</div>
                    <p>{pendingMessage}</p>
                  </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 flex items-center justify-center">
                  <span className="label-sm text-zinc-600 animate-pulse">ANALYZING...</span>
                </div>
              </div>
            )
          }

          {
            chatLoading && !pendingMessage && (
              <div className="flex justify-start">
                <div className="bg-zinc-900 px-5 py-4 border border-zinc-800">
                  <span className="label-sm text-hard-blue animate-pulse">AI IS THINKING...</span>
                </div>
              </div>
            )
          }
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* INPUT AREA - More prominent */}
      <div className="p-3 sm:p-4 bg-zinc-900 border-t border-zinc-700 relative z-20 shrink-0">
        <form onSubmit={runSimulation} className="flex gap-0 border-2 border-zinc-600 focus-within:border-hard-blue transition-colors bg-black">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your message..."
            disabled={chatLoading}
            className="flex-1 bg-transparent px-4 sm:px-6 py-4 sm:py-5 text-white focus:outline-none placeholder:text-zinc-600 text-base sm:text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim() || chatLoading}
            className="bg-white text-black font-impact px-6 sm:px-10 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm min-h-[50px]"
          >
            SEND
          </button>
        </form>
      </div>

    </div>
  );
};
