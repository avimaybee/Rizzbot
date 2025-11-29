import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Upload, MessageSquare, Copy, Check, Sparkles } from 'lucide-react';
import { generatePersona, simulateDraft, analyzeSimulation } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createPersona, createSession } from '../services/dbService';
import { SimResult, Persona, SimAnalysisResult, UserStyleProfile } from '../types';
import { useGlobalToast } from './Toast';

interface SimulatorProps {
  // Optional callback - used when Investigator mode is enabled
  onPivotToInvestigator?: () => void;
  // User's style profile for personalized suggestions
  userProfile?: UserStyleProfile | null;
  // User's Firebase UID for storing sessions
  firebaseUid?: string | null;
  // User's numeric ID for storing personas
  userId?: number | null;
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

export const Simulator: React.FC<SimulatorProps> = ({ onPivotToInvestigator, userProfile, firebaseUid, userId }) => {
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
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Custom dropdown state
  const [showContextDropdown, setShowContextDropdown] = useState(false);

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
    const key = `${entryIndex}-${suggestionType}`;
    saveFeedback({
      source: 'practice',
      suggestionType,
      rating,
      context: relationshipContext.toLowerCase(),
    });
    setFeedbackGiven(prev => ({ ...prev, [key]: rating }));
  }, [relationshipContext]);

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
    if (!draft.trim() || !activePersona) return;
    const sentMessage = draft;
    setPendingMessage(sentMessage);
    setDraft('');
    setChatLoading(true);
    const result = await simulateDraft(sentMessage, activePersona, userProfile);
    setSimHistory(prev => [...prev, { draft: sentMessage, result }]);
    setPendingMessage(null);
    setChatLoading(false);
  };

  const handleEndSim = async () => {
    if (!activePersona || simHistory.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await analyzeSimulation(simHistory, activePersona, userProfile);
      setAnalysisResult(result);
      
      // Log session for wellbeing tracking
      logSession('practice', activePersona.name, result.ghostRisk);

      // Save session to D1
      if (firebaseUid) {
        try {
          await createSession(firebaseUid, {
            type: 'practice',
            persona: activePersona.name,
            analysis: result,
            messageCount: simHistory.length,
            timestamp: new Date().toISOString(),
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
      <div className="w-full h-full max-w-full mx-auto bg-matte-panel border border-zinc-800 flex flex-col shadow-2xl relative overflow-hidden pb-20 md:pb-0">
        <CornerNodes />

        {/* MOBILE: Show header first, then archive inline */}
        <div className="flex flex-col md:flex-row h-full">

          {/* LEFT: SAVED PROFILES - Full width on mobile, shown after heading */}
          <div className="order-2 md:order-1 w-full md:w-1/3 border-t md:border-t-0 md:border-r border-zinc-800 bg-zinc-900 p-4 md:p-8 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-2 md:mb-8 shrink-0">
              <h4 className="label-sm text-zinc-500">Archive</h4>
              <span className="font-mono text-xs text-zinc-400">{savedPersonas.length}</span>
            </div>

            <div className={`space-y-2 overflow-y-auto flex-1 scrollbar-hide ${savedPersonas.length === 0 ? 'hidden md:block' : ''}`}>
              {savedPersonas.length === 0 ? (
                <div className="text-center py-2 md:py-20 opacity-50">
                  <p className="label-sm text-zinc-500">NO SAVED PERSONAS YET</p>
                  <p className="text-[10px] text-zinc-600 mt-1 hidden md:block">create your first practice partner →</p>
                </div>
              ) : (
                savedPersonas.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadPersona(p)}
                    className="w-full text-left p-4 border border-zinc-800 hover:border-white hover:bg-zinc-800 transition-all group"
                  >
                    <div className="font-bold text-sm text-zinc-300 group-hover:text-white uppercase tracking-wider mb-1">{p.name}</div>
                    <div className="text-[10px] text-zinc-600 font-mono truncate">{p.tone}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: BUILDER - Shown first on mobile */}
          <div className="order-1 md:order-2 w-full md:w-2/3 p-4 sm:p-8 md:p-16 relative flex flex-col bg-matte-panel overflow-y-auto scrollbar-hide h-full">
            <div className="max-w-2xl mx-auto w-full">
              <div className="mb-6 sm:mb-10">
                <div className="label-sm text-hard-blue mb-2">PRACTICE MODE</div>
                <h3 className="font-impact text-3xl sm:text-5xl text-white tracking-wide mb-4">WHO'S GOT YOU IN YOUR HEAD?</h3>
                <p className="text-zinc-500 font-editorial text-sm">Spill the tea so we can help you cook the right response.</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-sm text-zinc-400">Their Name <span className="text-hard-gold">*</span></label>
                    <input
                      type="text"
                      className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-xs font-mono focus:border-white focus:outline-none uppercase placeholder:text-zinc-500/60"
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
                      className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-xs font-mono focus:border-white focus:outline-none uppercase cursor-pointer text-left flex justify-between items-center"
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
                            className={`w-full p-3 text-left text-xs font-mono uppercase transition-colors ${relationshipContext === option
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
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 p-4">
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
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">
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
                    className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white text-sm focus:border-white focus:outline-none h-32 resize-none leading-relaxed placeholder:text-zinc-500/60"
                    placeholder="Describe their vibe. Dry texter? Love bomber? Emoji abuser? The devil's in the details."
                    value={personaDescription}
                    onChange={(e) => setPersonaDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="label-sm text-zinc-400">Receipts (Optional)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-zinc-700 bg-zinc-900/50 p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 text-lg group-hover:text-white"><Upload className="w-4 h-4" /></span>
                      <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">Upload Screenshots</span>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    {previewUrls.length > 0 && <span className="text-[10px] font-bold text-hard-blue border border-hard-blue/30 px-2 py-0.5 rounded-sm">{previewUrls.length} FILES</span>}
                  </div>
                </div>

                <button
                  onClick={buildPersona}
                  disabled={!customName.trim() || (!personaDescription && screenshots.length === 0)}
                  className="w-full bg-white text-black font-impact text-xl py-4 hover:bg-zinc-200 transition-all disabled:opacity-50 mt-6 border border-white tracking-wide uppercase"
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
    return (
      <div className="w-full h-full max-w-5xl mx-auto bg-matte-panel border border-zinc-800 flex flex-col relative scrollbar-hide pb-20 md:pb-0">
        <CornerNodes />
        <div className="bg-zinc-900 p-4 sm:p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-impact text-xl sm:text-2xl text-white tracking-wide uppercase">Post-Mortem</h2>
            <p className="label-sm text-zinc-500 mt-1">SESSION_ID: {Date.now().toString().slice(-6)}</p>
          </div>
          <button onClick={() => setView('chat')} className="text-xs font-mono text-zinc-400 hover:text-white underline">CLOSE</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-matte-base">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-8 sm:mb-12">
              <h3 className="text-3xl sm:text-4xl md:text-6xl font-impact text-white mb-6 sm:mb-8 uppercase leading-tight">
                {analysisResult.headline}
              </h3>

              {/* RECOMMENDED NEXT MOVE BANNER */}
              {analysisResult.recommendedNextMove && (
                <div className={`inline-block border-2 px-6 py-3 mb-6 ${analysisResult.recommendedNextMove === 'HARD_STOP' ? 'border-red-500 bg-red-900/20' :
                  analysisResult.recommendedNextMove === 'PULL_BACK' ? 'border-yellow-500 bg-yellow-900/20' :
                    analysisResult.recommendedNextMove === 'WAIT' ? 'border-orange-500 bg-orange-900/20' :
                      analysisResult.recommendedNextMove === 'FULL_SEND' ? 'border-green-500 bg-green-900/20' :
                        'border-blue-500 bg-blue-900/20'
                  }`}>
                  <span className="label-sm text-zinc-400 block mb-1">RECOMMENDED ACTION</span>
                  <span className={`font-mono font-bold text-xl ${analysisResult.recommendedNextMove === 'HARD_STOP' ? 'text-red-400' :
                    analysisResult.recommendedNextMove === 'PULL_BACK' ? 'text-yellow-400' :
                      analysisResult.recommendedNextMove === 'WAIT' ? 'text-orange-400' :
                        analysisResult.recommendedNextMove === 'FULL_SEND' ? 'text-green-400' :
                          'text-blue-400'
                    }`}>{analysisResult.recommendedNextMove.replace('_', ' ')}</span>
                  {analysisResult.conversationFlow && (
                    <span className="block label-sm text-zinc-500 mt-1">Flow: {analysisResult.conversationFlow}</span>
                  )}
                </div>
              )}

              {/* MAIN GAUGE */}
              <div className="inline-block bg-zinc-900 border border-zinc-800 p-6 sm:p-8 min-w-[260px] sm:min-w-[300px]">
                <span className="label-sm text-zinc-500 block mb-3 sm:mb-4">GHOST RISK PROBABILITY</span>
                <span className={`font-mono font-bold text-5xl sm:text-6xl ${analysisResult.ghostRisk > 60 ? 'text-red-500' : 'text-white'}`}>{analysisResult.ghostRisk}%</span>
                <div className="w-full h-2 bg-black mt-4">
                  <div
                    className={`h-full ${analysisResult.ghostRisk > 60 ? 'bg-red-500' : 'bg-white'}`}
                    style={{ width: `${analysisResult.ghostRisk}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12 text-left">
              <div className="border-t border-zinc-800 pt-4 sm:pt-6">
                <h4 className="label-sm text-hard-blue mb-3 sm:mb-4">METRICS</h4>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400 font-bold uppercase tracking-wider">Vibe Match</span>
                    <span className="font-mono text-white">{analysisResult.vibeMatch}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400 font-bold uppercase tracking-wider">Effort</span>
                    <span className="font-mono text-white">{analysisResult.effortBalance}%</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 sm:pt-6">
                <h4 className="label-sm text-hard-gold mb-3 sm:mb-4">INSIGHTS</h4>
                <ul className="space-y-2 sm:space-y-3">
                  {analysisResult.insights.map((insight, i) => (
                    <li key={i} className="text-sm text-zinc-300 leading-relaxed list-disc list-inside marker:text-zinc-600">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white text-black p-6 sm:p-8 text-left">
              <h4 className="font-impact text-lg sm:text-xl mb-2 uppercase">Strategic Advice</h4>
              <p className="font-editorial text-base sm:text-lg leading-relaxed">"{analysisResult.advice}"</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-center shrink-0">
          <button onClick={resetSim} className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Start New Practice</button>
        </div>
      </div>
    );
  }

  // --- CHAT VIEW ---
  return (
    <div className="w-full h-full max-w-4xl mx-auto bg-matte-panel border border-zinc-800 flex flex-col relative shadow-2xl scrollbar-hide pb-20 md:pb-0">
      <CornerNodes />

      {/* CHAT HEADER */}
      <div className="bg-zinc-900 p-3 sm:p-4 border-b border-zinc-800 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-bold text-sm sm:text-lg font-mono">
            {activePersona?.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider mb-0.5">{activePersona?.name}</h2>
            <span className="label-sm text-zinc-500 hidden sm:inline">
              {activePersona?.tone}
            </span>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-4">
          {simHistory.length > 0 && (
            <button onClick={handleEndSim} className="label-sm text-red-500 hover:text-red-400 border border-red-900/30 px-3 py-1 bg-red-900/10">
              END SESSION
            </button>
          )}
          <button onClick={() => setView('setup')} className="label-sm text-zinc-500 hover:text-white">
            EXIT
          </button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-matte-base custom-scrollbar relative scrollbar-hide">
        <div className="absolute inset-0 bg-scan-lines opacity-5 pointer-events-none"></div>

        {simHistory.length === 0 && !chatLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 relative z-10">
            <div className="w-16 h-16 border-2 border-zinc-700 flex items-center justify-center mb-4">
              <span className="text-2xl text-zinc-600"><MessageSquare className="w-8 h-8" /></span>
            </div>
            <p className="label-sm text-hard-blue mb-2">PRACTICE CONVERSATION</p>
            <p className="text-zinc-500 text-sm max-w-xs mb-4">test how <span className="text-white font-semibold">{activePersona?.name || 'they'}</span> might respond to your messages</p>
            <p className="text-zinc-600 text-xs">↓ type below and hit send ↓</p>
          </div>
        )}

        {simHistory.map((entry, idx) => (
          <div key={idx} className="space-y-4 relative z-10">
            {/* USER MESSAGE */}
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-white text-black px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium leading-relaxed border border-zinc-200 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] relative group">
                {entry.draft}
                <button
                  onClick={() => copyToClipboard(entry.draft)}
                  className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 text-xs"
                  title="Copy to clipboard"
                >
                  {copiedText === entry.draft ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* ANALYSIS WIDGET (Block Style) */}
            <div className="mx-auto w-full max-w-lg bg-zinc-900 border border-zinc-800 p-3 sm:p-4 relative group">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800">
                <span className="label-sm text-zinc-500">ANALYSIS</span>
                <span className={`label-sm ${entry.result.regretLevel > 50 ? 'text-red-500' : 'text-green-500'}`}>
                  RISK: {entry.result.regretLevel}%
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-4 font-mono leading-relaxed">
                "{entry.result.verdict}"
              </p>

              {/* SUGGESTIONS - with copy to clipboard and feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(entry.result.rewrites).filter(([_, text]) => text).map(([key, text]) => {
                  const feedbackKey = `${idx}-${key}`;
                  return (
                    <div key={key} className="relative group flex flex-col">
                      <button
                        onClick={() => copyToDraft(text as string)}
                        className={`flex-1 p-2 sm:p-3 border text-[10px] text-left hover:bg-zinc-800 transition-colors flex flex-col justify-between min-h-[80px] sm:min-h-[70px] ${key === 'safe' ? 'border-zinc-800 text-zinc-400' :
                          key === 'bold' ? 'border-zinc-700 text-zinc-300' :
                            key === 'spicy' ? 'border-red-900/30 text-red-400' :
                              'border-hard-gold/50 text-hard-gold'
                          }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold uppercase flex items-center gap-1">{key === 'you' ? <><Sparkles className="w-3 h-3" /> YOU</> : key}</span>
                          <span className="text-[8px] text-zinc-600 hidden sm:inline">TAP</span>
                        </div>
                        <div className="text-[9px] sm:text-xs opacity-80 leading-relaxed line-clamp-3 sm:line-clamp-2">"{text as string}"</div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(text as string); }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center bg-zinc-700 text-[10px] hover:bg-zinc-600"
                        title="Copy to clipboard"
                      >
                        {copiedText === text ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                      {/* Feedback buttons */}
                      <div className="flex gap-1 mt-2 justify-center">
                        {(['helpful', 'mid', 'off'] as const).map((rating) => (
                          <button
                            key={rating}
                            onClick={(e) => { e.stopPropagation(); handleFeedback(key as any, rating, idx); }}
                            disabled={!!feedbackGiven[feedbackKey]}
                            className={`px-3 py-2 text-sm border transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${feedbackGiven[feedbackKey] === rating
                              ? rating === 'helpful' ? 'bg-emerald-900/50 border-emerald-600 text-emerald-400' :
                                rating === 'mid' ? 'bg-yellow-900/50 border-yellow-600 text-yellow-400' :
                                  'bg-red-900/50 border-red-600 text-red-400'
                              : feedbackGiven[feedbackKey]
                                ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                                : 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                              }`}
                          >
                            {rating === 'helpful' ? '+' : rating === 'mid' ? '○' : '-'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PREDICTED REPLY */}
            <div className="flex justify-start">
              <div className="flex items-end gap-2 sm:gap-3 max-w-[85%] group">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-zinc-800 flex-shrink-0 flex items-center justify-center text-xs text-zinc-500 font-mono border border-zinc-700">
                  {activePersona?.name.charAt(0)}
                </div>
                <div className="bg-zinc-800 text-zinc-200 px-4 sm:px-6 py-3 sm:py-4 text-sm leading-relaxed border border-zinc-700 relative">
                  {entry.result.predictedReply}
                  <button
                    onClick={() => copyToClipboard(entry.result.predictedReply || '')}
                    className="absolute -right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white text-xs"
                    title="Copy reply"
                  >
                    {copiedText === entry.result.predictedReply ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Show pending message immediately */}
        {pendingMessage && (
          <div className="space-y-4 relative z-10">
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-white text-black px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium leading-relaxed border border-zinc-200 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] opacity-70">
                {pendingMessage}
              </div>
            </div>
          </div>
        )}

        {chatLoading && (
          <div className="flex justify-start relative z-10">
            <div className="bg-zinc-900 px-4 py-3 border border-zinc-800">
              <span className="label-sm text-zinc-500 animate-pulse">TYPING...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-2 sm:p-4 bg-zinc-900 border-t border-zinc-800 relative z-20 shrink-0">
        <form onSubmit={runSimulation} className="flex gap-0 border border-zinc-700">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="TYPE YOUR MESSAGE..."
            disabled={chatLoading}
            className="flex-1 bg-black px-3 sm:px-6 py-3 sm:py-4 text-white focus:outline-none placeholder:text-zinc-500/60 text-xs font-mono"
          />
          <button
            type="submit"
            disabled={!draft.trim() || chatLoading}
            className="bg-white text-black font-bold px-4 sm:px-8 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-[10px]"
          >
            SEND
          </button>
        </form>
      </div>

    </div>
  );
};