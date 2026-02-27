import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Upload, MessageSquare, Copy, Check, Sparkles, ThumbsUp, Minus, ThumbsDown, ArrowLeft, Target, Shield, Activity, Cpu, Zap, Terminal, Clock, AlertTriangle } from 'lucide-react';
import { generatePersona, simulateDraft, analyzeSimulation } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createPersona, createSession } from '../services/dbService';
import { SimResult, Persona, SimAnalysisResult, UserStyleProfile } from '../types';
import { useGlobalToast } from './Toast';
import { ModuleHeader } from './ModuleHeader';

interface SimulatorProps {
  userProfile?: UserStyleProfile | null;
  firebaseUid?: string | null;
  userId?: number | null;
  onBack: () => void;
  initialView?: View;
  initialAnalysisResult?: SimAnalysisResult | null;
}

type View = 'setup' | 'chat' | 'analysis';

export const Simulator: React.FC<SimulatorProps> = ({ userProfile, firebaseUid, userId, onBack, initialView = 'setup', initialAnalysisResult = null }) => {
  const [view, setView] = useState<View>(initialView);
  const { showToast } = useGlobalToast();

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [personaDescription, setPersonaDescription] = useState('');
  const [customName, setCustomName] = useState('');
  const [relationshipContext, setRelationshipContext] = useState<'NEW_MATCH' | 'TALKING_STAGE' | 'DATING' | 'SITUATIONSHIP' | 'EX' | 'FRIEND'>('TALKING_STAGE');
  const [harshnessLevel, setHarshnessLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [draft, setDraft] = useState('');
  const [simHistory, setSimHistory] = useState<{ draft: string, result: SimResult }[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showPracticePartners, setShowPracticePartners] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<SimAnalysisResult | null>(initialAnalysisResult);

  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});

  const [savedPersonas, setSavedPersonas] = useState<Persona[]>(() => {
    const saved = localStorage.getItem('unsend_personas');
    return saved ? JSON.parse(saved) : [];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  const copyToClipboard = useCallback((text: string) => {
    handleAction(() => {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      showToast('Copied to clipboard', 'copied');
      setTimeout(() => setCopiedText(null), 1500);
    }, 10);
  }, [showToast]);

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
    handleAction(() => setSetupLoading(true), 15);
    try {
      const persona = await generatePersona(personaDescription, screenshots, relationshipContext, harshnessLevel);
      if (customName.trim()) persona.name = customName.trim();
      setActivePersona(persona);

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
        }
      }

      setSavedPersonas(prev => [...prev, persona]);
      localStorage.setItem('unsend_personas', JSON.stringify([...savedPersonas, persona]));
    } finally {
      setSetupLoading(false);
      setView('chat');
    }
  };

  const loadPersona = (p: Persona) => {
    handleAction(() => {
      setActivePersona(p);
      setView('chat');
    }, 10);
  };

  const runSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activePersona) return;
    const sentMessage = draft;
    handleAction(() => {
      setPendingMessage(sentMessage);
      setDraft('');
      setChatLoading(true);
    }, 15);
    const result = await simulateDraft(firebaseUid ?? undefined, sentMessage, activePersona, userProfile);
    setSimHistory(prev => [...prev, { draft: sentMessage, result }]);
    setPendingMessage(null);
    setChatLoading(false);
  };

  const handleEndSim = async () => {
    if (!activePersona || simHistory.length === 0) return;
    handleAction(() => setAnalyzing(true), 20);
    try {
      const result = await analyzeSimulation(simHistory, activePersona, userProfile);
      setAnalysisResult(result);

      if (firebaseUid) {
        logSession(firebaseUid, 'practice', activePersona.name, result.ghostRisk);
      }

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
        }
      }
    } finally {
      setAnalyzing(false);
      setView('analysis');
    }
  };

  const resetSim = () => {
    handleAction(() => {
      setSimHistory([]);
      setAnalysisResult(null);
      setFeedbackGiven({});
      setView('chat');
    }, 10);
  };

  // --- LOADING STATES ---
  if (setupLoading || analyzing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-matte-base p-12 relative overflow-hidden font-sans select-none">
        <div className="bg-matte-grain"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-hard-blue/5 rounded-full blur-[100px] animate-pulse-slow"></div>
        
        <div className="relative mb-12">
          <div className="w-24 h-24 glass flex items-center justify-center border-white/10 rounded-full relative shadow-[0_0_40px_rgba(59,130,246,0.1)]">
             <Cpu className="w-10 h-10 text-hard-blue animate-pulse" />
             <div className="absolute inset-0 rounded-full border border-hard-blue/30 animate-ping opacity-20"></div>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-white uppercase tracking-tight mb-4 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
          {analyzing ? "Analyzing Session" : "Preparing Profile"}
        </h2>
        <div className="flex flex-col items-center gap-3">
           <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-hard-blue rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-hard-blue rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-hard-blue rounded-full animate-bounce delay-150"></div>
           </div>
           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
             {analyzing ? "Calculating session insights..." : "Processing conversation patterns..."}
           </p>
        </div>
      </div>
    );
  }

  // --- SETUP VIEW ---
  if (view === 'setup') {
    return (
      <div className="w-full h-full flex flex-col bg-matte-base relative overflow-hidden font-sans select-none">
        <div className="bg-matte-grain"></div>
        
        {/* MODULE HEADER */}
        <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Session Setup" 
            mode="Practice Mode" 
            onBack={() => handleAction(onBack)}
            accentColor="blue"
            statusLabel="Status"
            statusValue="Ready"
            statusColor="emerald"
          />
        </div>

        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative z-10">
          {/* LEFT: SAVED PROFILES */}
          <div className={`order-2 md:order-1 w-full md:w-80 border-t md:border-t-0 md:border-r border-white/5 bg-black/40 flex flex-col md:h-full overflow-hidden ${savedPersonas.length === 0 ? 'hidden md:flex' : ''}`}>
            <button
              className="md:hidden w-full p-5 flex items-center justify-between glass-zinc border-b border-white/5"
              onClick={() => handleAction(() => setShowPracticePartners(!showPracticePartners))}
            >
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-hard-blue" />
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recent Profiles</h4>
                {savedPersonas.length > 0 && (
                  <span className="text-[9px] font-bold text-hard-blue bg-hard-blue/10 px-2 py-0.5 rounded-full border border-hard-blue/20">{savedPersonas.length}</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${showPracticePartners ? 'rotate-180' : ''}`} />
            </button>

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${showPracticePartners || window.innerWidth >= 768 ? 'opacity-100' : 'max-h-0 opacity-0 md:opacity-100 md:max-h-full'}`}>
              <div className="hidden md:flex items-center justify-between p-6 shrink-0 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4 text-hard-blue" />
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Practice Partners</h4>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 scrollbar-hide">
                {savedPersonas.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                    <MessageSquare size={32} className="mb-4 text-zinc-600" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Create a profile to begin</p>
                  </div>
                ) : (
                  savedPersonas.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadPersona(p)}
                      className="w-full text-left p-4 glass-zinc border-white/5 hover:border-hard-blue/30 hover:bg-hard-blue/[0.02] transition-all group rounded-xl relative overflow-hidden active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 shrink-0 glass flex items-center justify-center text-hard-blue border-white/5 shadow-xl group-hover:border-hard-blue/20 transition-all rounded-full font-bold text-lg">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-bold text-xs text-white truncate">{p.name}</div>
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                              p.harshnessLevel && p.harshnessLevel >= 5 ? 'bg-hard-red animate-pulse' :
                              p.harshnessLevel && p.harshnessLevel >= 3 ? 'bg-hard-gold' :
                              'bg-emerald-500'
                            }`}></div>
                          </div>
                          <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{p.relationshipContext?.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: BUILDER */}
          <div className="order-1 md:order-2 flex-1 p-6 md:p-12 overflow-y-auto scrollbar-hide relative">
            <div className="max-w-2xl mx-auto w-full space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <Zap className="w-4 h-4 text-hard-blue" />
                   <span className="text-[10px] font-bold text-hard-blue uppercase tracking-[0.2em]">Setup Parameters</span>
                </div>
                <h3 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tight leading-none">Define Target</h3>
                <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed">Model behavioral patterns for conversation testing.</p>
              </div>

              <div className="space-y-8 glass-dark border-white/5 p-8 soft-edge relative shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                       <Terminal size={12} className="text-zinc-700" /> Name
                    </label>
                    <input
                      type="text"
                      className="w-full glass-zinc border-white/5 p-4 text-white text-sm font-bold focus:border-hard-blue/30 focus:outline-none uppercase placeholder:text-zinc-800 soft-edge transition-all"
                      placeholder="Enter name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3 relative">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                       <Shield size={12} className="text-zinc-700" /> Context
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAction(() => setShowContextDropdown(!showContextDropdown))}
                      className="w-full glass-zinc border-white/5 p-4 text-white text-sm font-bold focus:border-hard-blue/30 focus:outline-none uppercase text-left flex justify-between items-center soft-edge transition-all group"
                    >
                      <span>{relationshipContext.replace('_', ' ')}</span>
                      <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${showContextDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showContextDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-2 glass-dark border-white/10 shadow-2xl soft-edge overflow-hidden animate-slide-up">
                        {(['NEW_MATCH', 'TALKING_STAGE', 'DATING', 'SITUATIONSHIP', 'EX', 'FRIEND'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              handleAction(() => {
                                setRelationshipContext(option);
                                setShowContextDropdown(false);
                              });
                            }}
                            className={`w-full p-4 text-left text-[10px] font-bold uppercase tracking-widest transition-all ${relationshipContext === option
                              ? 'bg-white text-black'
                              : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                              }`}
                          >
                            {option.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Feedback Harshness</label>
                    <span className={`text-[10px] font-bold px-3 py-1 glass-zinc soft-edge border-white/5 ${
                      harshnessLevel === 5 ? 'text-hard-red border-hard-red/20' : 
                      harshnessLevel >= 3 ? 'text-hard-gold border-hard-gold/20' : 
                      'text-emerald-400 border-emerald-400/20'
                    }`}>
                      {harshnessLevel === 1 && 'GENTLE'}
                      {harshnessLevel === 2 && 'SUPPORTIVE'}
                      {harshnessLevel === 3 && 'BALANCED'}
                      {harshnessLevel === 4 && 'CRITICAL'}
                      {harshnessLevel === 5 && 'BRUTAL'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 glass-zinc border-white/5 p-5 soft-edge">
                    <span className="text-[10px] font-bold text-zinc-700">LOW</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={harshnessLevel}
                      onChange={(e) => handleAction(() => setHarshnessLevel(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5), 2)}
                      className="flex-1 h-1.5 bg-zinc-900 appearance-none cursor-pointer rounded-full accent-white"
                    />
                    <span className="text-[10px] font-bold text-zinc-700">HIGH</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Persona Details</label>
                  <textarea
                    className="w-full glass-zinc border-white/5 p-5 text-white text-sm font-bold focus:border-hard-blue/30 focus:outline-none h-32 resize-none leading-relaxed placeholder:text-zinc-800 soft-edge uppercase"
                    placeholder="Describe their communication style, red flags, or specific traits."
                    value={personaDescription}
                    onChange={(e) => setPersonaDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Interaction Screenshots (Optional)</label>
                  <div
                    onClick={() => handleAction(() => fileInputRef.current?.click())}
                    className="border-dashed border-2 border-white/5 glass-zinc p-6 flex items-center justify-between cursor-pointer hover:border-hard-blue/20 hover:bg-hard-blue/[0.01] transition-all group soft-edge relative overflow-hidden"
                  >
                    <div className="flex items-center gap-5 relative z-10">
                      <Upload className="w-5 h-5 text-zinc-600 group-hover:text-hard-blue transition-colors" />
                      <span className="text-xs font-bold text-zinc-500 group-hover:text-white uppercase tracking-widest transition-colors">Upload reference images</span>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    {previewUrls.length > 0 && <span className="text-[9px] font-bold text-hard-blue bg-hard-blue/10 border border-hard-blue/20 px-3 py-1 rounded-full relative z-10">{previewUrls.length} Files Selected</span>}
                  </div>

                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group aspect-[9/16] glass-zinc border-white/5 overflow-hidden soft-edge shadow-lg">
                          <img src={url} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(() => {
                                setPreviewUrls(prev => prev.filter((_, i) => i !== index));
                                setScreenshots(prev => prev.filter((_, i) => i !== index));
                              }, 10);
                            }}
                            className="absolute inset-0 bg-hard-red/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                          >
                            <X className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={buildPersona}
                  disabled={!customName.trim() || (!personaDescription && screenshots.length === 0)}
                  className="w-full bg-white text-black font-bold text-2xl py-5 hover:bg-zinc-200 transition-all disabled:opacity-30 disabled:grayscale tracking-tight uppercase soft-edge shadow-[0_20px_50px_rgba(255,255,255,0.1)] group relative overflow-hidden"
                >
                  <span className="relative z-10">Start Simulation</span>
                  <div className="absolute inset-0 bg-hard-blue opacity-0 group-hover:opacity-5 transition-opacity"></div>
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
      if (risk > 70) return { text: 'text-hard-red', bg: 'bg-hard-red/5', border: 'border-hard-red/20', bar: 'bg-hard-red' };
      if (risk > 40) return { text: 'text-hard-gold', bg: 'bg-hard-gold/5', border: 'border-hard-gold/20', bar: 'bg-hard-gold' };
      return { text: 'text-emerald-400', bg: 'bg-emerald-400/5', border: 'border-emerald-400/20', bar: 'bg-emerald-400' };
    };
    const riskColors = getRiskColor(analysisResult.ghostRisk);

    const getActionStyle = (action: string) => {
      switch (action) {
        case 'HARD_STOP': return { icon: AlertTriangle, text: 'text-hard-red', bg: 'bg-hard-red/10', border: 'border-hard-red/30' };
        case 'PULL_BACK': return { icon: Minus, text: 'text-hard-gold', bg: 'bg-hard-gold/10', border: 'border-hard-gold/30' };
        case 'WAIT': return { icon: Clock, text: 'text-hard-blue', bg: 'bg-hard-blue/10', border: 'border-hard-blue/30' };
        case 'FULL_SEND': return { icon: Zap, text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        default: return { icon: MessageSquare, text: 'text-zinc-400', bg: 'bg-zinc-900/50', border: 'border-zinc-800' };
      }
    };

    return (
      <div className="mission-debrief-report w-full h-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide font-mono select-none">
        <div className="bg-matte-grain"></div>

        {/* MODULE HEADER */}
        <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Session Debrief" 
            mode="Analysis Report" 
            id={activePersona?.name.toUpperCase()}
            onBack={() => handleAction(() => setView('chat'))}
            accentColor="blue"
            statusLabel="Session Status"
            statusValue="Complete"
            statusColor="red"
          />
        </div>

        <div className="flex-1 p-6 md:p-12">
          <div className="max-w-5xl mx-auto space-y-12 pb-32">
            {/* Hero Section */}
            <div className="flex flex-col items-center text-center space-y-8">
              <h3 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter leading-[0.9] max-w-3xl filter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                {analysisResult.headline}
              </h3>
              
              {analysisResult.recommendedNextMove && (() => {
                const style = getActionStyle(analysisResult.recommendedNextMove);
                const ActionIcon = style.icon;
                return (
                  <div className={`glass-dark p-8 md:p-12 border-2 ${style.border} relative group soft-edge shadow-2xl`}>
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 glass-zinc border border-white/5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.4em]`}>Recommended Action</div>
                    <ActionIcon className={`w-12 h-12 ${style.text} mb-6 mx-auto animate-pulse`} />
                    <span className={`font-black text-4xl md:text-6xl ${style.text} tracking-tighter uppercase`}>
                      {analysisResult.recommendedNextMove.replace('_', ' ')}
                    </span>
                    {analysisResult.conversationFlow && (
                      <div className="mt-8 pt-6 border-t border-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Conversation Flow: <span className="text-white ml-2">{analysisResult.conversationFlow}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'GHOST RISK', value: analysisResult.ghostRisk, color: riskColors, info: 'Probability of disengagement' },
                { label: 'VIBE MATCH', value: analysisResult.vMatch || analysisResult.vibeMatch || 0, color: { text: 'text-hard-blue', bar: 'bg-hard-blue' }, info: 'Linguistic energy alignment' },
                { label: 'EFFORT BALANCE', value: analysisResult.effortBalance, color: { text: 'text-hard-gold', bar: 'bg-hard-gold' }, info: 'Message volume parity' }
              ].map((stat, i) => (
                <div key={i} className="glass-dark border-white/5 p-8 soft-edge relative overflow-hidden group shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] block mb-6">{stat.label}</span>
                  <div className="flex items-baseline gap-2 mb-6 justify-center">
                    <span className={`font-black text-6xl ${stat.color.text} tracking-tighter`}>{stat.value}</span>
                    <span className="text-xl text-zinc-700">%</span>
                  </div>
                  <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden mb-4">
                    <div className={`h-full ${stat.color.bar} transition-all duration-1000 delay-300 shadow-[0_0_10px_rgba(0,0,0,0.5)]`} style={{ width: `${stat.value}%` }}></div>
                  </div>
                  <p className="text-[9px] font-bold text-zinc-600 text-center uppercase tracking-widest opacity-60">{stat.info}</p>
                </div>
              ))}
            </div>

            {/* Deep Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="glass-dark border-white/5 p-8 md:p-10 soft-edge relative shadow-2xl">
                <div className="absolute top-0 left-0 w-1 h-full bg-hard-gold opacity-30"></div>
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                  <Activity className="w-5 h-5 text-hard-gold animate-pulse" />
                  <h4 className="font-black text-2xl uppercase tracking-tighter text-white leading-none">Key Observations</h4>
                </div>
                <ul className="space-y-6">
                  {analysisResult.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-4 group">
                      <div className="w-1.5 h-1.5 rounded-full bg-hard-gold mt-1.5 shrink-0 animate-pulse"></div>
                      <p className="text-[11px] font-bold text-zinc-400 leading-relaxed uppercase tracking-wide group-hover:text-zinc-200 transition-colors">{insight}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white text-black p-8 md:p-10 soft-edge relative shadow-[0_30px_60px_rgba(255,255,255,0.1)] overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-black/[0.03] rounded-full rotate-45"></div>
                <div className="flex items-center gap-4 mb-8 border-b border-black/10 pb-6">
                  <Target className="w-5 h-5 text-black" />
                  <h4 className="font-black text-2xl uppercase tracking-tighter leading-none">Strategic Advice</h4>
                </div>
                <p className="text-lg md:text-xl font-black leading-relaxed uppercase tracking-tight italic">
                  "{analysisResult.advice}"
                </p>
                <div className="mt-12 flex justify-between items-end">
                   <div className="text-[8px] font-bold uppercase tracking-[0.4em] opacity-40">Analysis Finalized</div>
                   <Shield className="w-8 h-8 opacity-10 group-hover:opacity-20 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-matte-base via-matte-base to-transparent z-50 flex justify-center gap-4 md:gap-6">
          <button
            onClick={() => handleAction(() => setView('chat'), 10)}
            className="px-8 py-4 glass-zinc border-white/5 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] hover:text-white hover:border-white/10 transition-all soft-edge active:scale-[0.98] min-w-[180px]"
          >
            ← Resume Simulation
          </button>
          <button
            onClick={() => handleAction(resetSim, 15)}
            className="px-8 py-4 bg-white text-black font-black text-xl uppercase tracking-widest hover:bg-zinc-200 transition-all soft-edge shadow-2xl active:scale-[0.98] min-w-[220px]"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // --- CHAT VIEW ---
  return (
    <div className="w-full h-full flex flex-col bg-matte-base relative overflow-hidden font-mono select-none">
      <div className="bg-matte-grain opacity-[0.03]"></div>

      {/* MODULE HEADER */}
      <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title={`Chatting with ${activePersona?.name}`} 
          mode="Simulation" 
          onBack={() => handleAction(() => setView('setup'))}
          accentColor="blue"
          statusLabel="Encryption"
          statusValue="Active"
          statusColor="emerald"
        />
      </div>

      {/* GHOST RISK HUD */}
      {(simHistory.length > 0 || chatLoading) && (
        <div className="px-6 py-4 glass-dark border-b border-white/5 backdrop-blur-md animate-slide-up relative z-30 flex items-center gap-8">
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Ghost Risk</span>
              <span className={`text-xs font-bold ${
                (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 70 ? 'text-hard-red' : 
                (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 40 ? 'text-hard-gold' : 
                'text-emerald-400'
              }`}>
                {chatLoading ? 'Calculating...' : `${simHistory[simHistory.length - 1]?.result.regretLevel || 0}%`}
              </span>
            </div>
            <div className="h-1 bg-black/60 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-out ${
                  (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 70 ? 'bg-hard-red' : 
                  (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 40 ? 'bg-hard-gold' : 
                  'bg-emerald-500'
                }`}
                style={{ width: `${chatLoading ? 100 : (simHistory[simHistory.length - 1]?.result.regretLevel || 0)}%` }}
              ></div>
            </div>
          </div>

          <div className="flex-1 space-y-2 border-l border-white/5 pl-8">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Vibe Coefficient</span>
              <span className="text-xs font-bold text-hard-blue">
                {chatLoading ? 'Analyzing...' : '84%'}
              </span>
            </div>
            <div className="h-1 bg-black/60 rounded-full overflow-hidden">
              <div 
                className="h-full bg-hard-blue transition-all duration-1000 ease-out"
                style={{ width: `${chatLoading ? 100 : 84}%` }}
              ></div>
            </div>
          </div>
          
          <button 
            onClick={() => handleAction(handleEndSim, 20)}
            className="px-6 py-2 bg-hard-red text-white font-bold text-xs uppercase tracking-widest soft-edge hover:bg-red-600 transition-all active:scale-[0.98] shadow-lg"
          >
            End Chat
          </button>
        </div>
      )}

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide relative z-10 custom-scrollbar pb-32">
        {simHistory.length === 0 && !chatLoading && (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-20 h-20 glass border-white/5 flex items-center justify-center mb-8 soft-edge">
              <MessageSquare className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-[10px] font-bold text-hard-blue uppercase tracking-[0.4em] mb-4">Awaiting Input</p>
            <p className="text-zinc-500 text-xs max-w-xs leading-relaxed uppercase font-bold tracking-widest">
              Send a draft message to see how <span className="text-white">{activePersona?.name}</span> might respond.
            </p>
          </div>
        )}

        {simHistory.map((entry, idx) => (
          <div key={idx} className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Messages */}
              <div className="space-y-6">
                <div className="flex flex-col items-end group">
                  <div className="max-w-[95%] bg-white text-black p-6 relative soft-edge shadow-2xl transition-all hover:translate-x-[-4px]">
                    <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-3 border-b border-black/5 pb-2">Your Message</div>
                    <p className="text-sm font-bold leading-relaxed uppercase tracking-tight">{entry.draft}</p>
                    <button
                      onClick={() => copyToClipboard(entry.draft)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 text-zinc-500 hover:text-black rounded-full"
                    >
                      {copiedText === entry.draft ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-start group">
                  <div className="flex items-start gap-4 max-w-[95%]">
                    <div className="w-10 h-10 glass shrink-0 flex items-center justify-center text-xs font-bold border-white/10 rounded-full text-zinc-400 shadow-xl">
                      {activePersona?.name.charAt(0)}
                    </div>
                    <div className="flex-1 glass-dark border-white/5 p-6 relative soft-edge shadow-xl transition-all hover:translate-x-[4px]">
                      <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-3 border-b border-white/5 pb-2">Predicted Response</div>
                      <p className="text-sm font-bold italic text-zinc-200 leading-relaxed uppercase tracking-tight">"{entry.result.predictedReply}"</p>
                      <button
                        onClick={() => copyToClipboard(entry.result.predictedReply || '')}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-600 hover:text-white rounded-full"
                      >
                        {copiedText === entry.result.predictedReply ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Analysis */}
              <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hard-blue/20 to-transparent"></div>
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                     <Cpu className="w-4 h-4 text-hard-blue" />
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Linguistic Analysis</span>
                  </div>
                  <div className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] soft-edge ${
                    entry.result.regretLevel > 70 ? 'bg-hard-red/10 text-hard-red border border-hard-red/20' :
                    entry.result.regretLevel > 40 ? 'bg-hard-gold/10 text-hard-gold border border-hard-gold/20' :
                    'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                  }`}>
                    {entry.result.regretLevel > 70 ? 'High Risk' : entry.result.regretLevel > 40 ? 'Moderate Risk' : 'Optimal'}
                  </div>
                </div>

                <p className="text-xs font-bold text-zinc-400 mb-8 leading-relaxed uppercase tracking-wide border-l-2 border-hard-blue/30 pl-4 italic">
                  → {entry.result.verdict}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(entry.result.rewrites).filter(([_, text]) => text).map(([key, text]) => (
                    <button
                      key={key}
                      onClick={() => handleAction(() => setDraft(text as string), 10)}
                      className={`p-4 border text-left transition-all hover:scale-[1.02] soft-edge group/btn relative overflow-hidden ${
                        key === 'safe' ? 'glass-zinc border-white/5 hover:border-white/20' :
                        key === 'bold' ? 'glass-blue border-hard-blue/10 hover:border-hard-blue/30' :
                        key === 'spicy' ? 'glass-red border-hard-red/10 hover:border-hard-red/30' :
                        'glass-gold border-hard-gold/10 hover:border-hard-gold/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${
                          key === 'safe' ? 'text-zinc-500' :
                          key === 'bold' ? 'text-hard-blue' :
                          key === 'spicy' ? 'text-hard-red' :
                          'text-hard-gold'
                        }`}>
                          {key === 'you' ? <Sparkles className="w-3 h-3" /> : null} {key === 'you' ? 'Auto-Style' : key}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-300 leading-relaxed uppercase tracking-tight line-clamp-2 relative z-10">"{text as string}"</p>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-[0.02] transition-opacity"></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {idx < simHistory.length - 1 && (
              <div className="flex items-center gap-6 py-4 opacity-20">
                <div className="flex-1 h-px bg-zinc-800"></div>
                <div className="text-[8px] font-bold uppercase tracking-[0.5em]">Exchange {idx + 1}</div>
                <div className="flex-1 h-px bg-zinc-800"></div>
              </div>
            )}
          </div>
        ))}

        {pendingMessage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse grayscale opacity-50">
            <div className="flex flex-col items-end">
              <div className="max-w-[95%] bg-white text-black p-6 soft-edge">
                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-3">Sending...</div>
                <p className="text-sm font-bold uppercase tracking-tight">{pendingMessage}</p>
              </div>
            </div>
            <div className="glass-dark border-white/5 soft-edge p-8 flex items-center justify-center">
              <div className="flex items-center gap-3">
                 <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-ping"></div>
                 <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Analyzing Response</span>
              </div>
            </div>
          </div>
        )}

        {chatLoading && !pendingMessage && (
          <div className="flex justify-start animate-fade-in">
            <div className="glass-dark px-6 py-4 border border-hard-blue/20 soft-edge flex items-center gap-4">
              <div className="w-1.5 h-1.5 bg-hard-blue rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              <span className="text-[10px] font-bold text-hard-blue uppercase tracking-[0.4em]">AI is thinking</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-6 md:p-8 glass-dark border-t border-white/5 relative z-40 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <form onSubmit={runSimulation} className="max-w-4xl mx-auto flex gap-4 p-1 glass-zinc border-white/10 soft-edge focus-within:border-hard-blue/30 transition-all shadow-2xl">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your message..."
            disabled={chatLoading}
            className="flex-1 bg-transparent px-6 py-4 text-white focus:outline-none placeholder:text-zinc-800 text-sm font-bold uppercase tracking-wider"
          />
          <button
            type="submit"
            disabled={!draft.trim() || chatLoading}
            className="bg-white text-black font-bold px-10 hover:bg-zinc-200 transition-all disabled:opacity-30 disabled:grayscale uppercase tracking-tight text-lg min-h-[56px] soft-edge shadow-xl active:scale-[0.98]"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
