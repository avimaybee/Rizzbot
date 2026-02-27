import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Send, ArrowLeft, HeartHandshake, ImagePlus, X, Edit3, Target, Heart, Users, Sparkles, Eye, BookOpen, ShieldAlert, History, Activity, Clipboard, AlertTriangle, Users2, Scale, Brain, Lightbulb, MessageCircle, ChevronRight, PanelRightOpen, PanelRightClose, Menu, BarChart3, Terminal, Shield } from 'lucide-react';
import { streamTherapistAdvice } from '../services/geminiService';
import { saveTherapistSession, getTherapistSession, getTherapistSessions, TherapistSession, getMemories, saveMemory, deleteMemory, updateMemory, TherapistMemory } from '../services/dbService';
import { logger } from '../services/logger';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TherapistMessage, ClinicalNotes, TherapistExercise, ExerciseType } from '../types';
import { TherapistSidebar } from './TherapistSidebar';
import { TherapistTacticalReport } from './TherapistTacticalReport';
import { CornerNodes } from './CornerNodes';
import { ModuleHeader } from './ModuleHeader';

interface TherapistChatProps {
    onBack: () => void;
    firebaseUid?: string;
}

const DEFAULT_NOTES: ClinicalNotes = {
    attachmentStyle: 'unknown',
    keyThemes: [],
    emotionalState: undefined,
    relationshipDynamic: undefined,
    userInsights: [],
    actionItems: [],
    customNotes: ''
};

const WELCOME_MESSAGE = `
### Welcome to Therapist Mode

I'm here to help you process your relationship experiences, recognize patterns, and gain clarity.

**How I can help:**
- **Vent freely** – Share without judgment
- **Spot patterns** – Identify recurring dynamics  
- **Get clarity** – Work through confusing situations
- **Build skills** – Practice healthier communication

What's on your mind today?
`;

// Insight Card Component - Polished inline insights
const InsightCard = ({
    title,
    content,
    icon: Icon,
    accentColor = 'gold'
}: {
    title: string;
    content: React.ReactNode;
    icon: any;
    accentColor?: 'gold' | 'red' | 'emerald' | 'blue' | 'purple';
}) => {
    const colors = {
        gold: 'border-hard-gold/20 bg-hard-gold/5',
        red: 'border-hard-red/20 bg-hard-red/5',
        emerald: 'border-emerald-500/20 bg-emerald-500/5',
        blue: 'border-hard-blue/20 bg-hard-blue/5',
        purple: 'border-purple-500/20 bg-purple-500/5',
    };

    const iconColors = {
        gold: 'text-hard-gold',
        red: 'text-hard-red',
        emerald: 'text-emerald-400',
        blue: 'text-hard-blue',
        purple: 'text-purple-400',
    };

    return (
        <div className={`glass-dark border ${colors[accentColor]} p-4 sm:p-5 my-3 soft-edge animate-fade-in relative overflow-hidden group hover:border-white/10 transition-all shadow-xl`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 glass flex items-center justify-center border-white/5 rounded-lg ${iconColors[accentColor]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${iconColors[accentColor]}`}>{title}</span>
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-bold uppercase tracking-wide pl-1">
                {content}
            </div>
            
            <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity`}>
              <span className={`text-[10px] font-bold ${iconColors[accentColor]}`}>+</span>
            </div>
        </div>
    );
};

// Exercise Card Component
const ExerciseCard: React.FC<{
    exercise: TherapistExercise;
    onComplete: (result: any) => void;
    onSkip: () => void;
}> = ({ exercise, onComplete, onSkip }) => {
    const [boundaryInputs, setBoundaryInputs] = useState<string[]>(['', '', '']);
    const [needsValues, setNeedsValues] = useState({ safety: 50, connection: 50, autonomy: 50 });

    const exerciseConfig: Record<string, any> = {
        boundary_builder: { icon: Target, title: 'Boundary Builder', description: 'Define your non-negotiables' },
        needs_assessment: { icon: Heart, title: 'Needs Assessment', description: 'Understand what you need' },
        attachment_quiz: { icon: Users, title: 'Attachment Style', description: 'Explore your patterns' }
    };

    const config = exerciseConfig[exercise.type] || exerciseConfig.boundary_builder;
    const Icon = config.icon;

    const handleSubmit = () => {
        let result;
        if (exercise.type === 'boundary_builder') result = { boundaries: boundaryInputs.filter(b => b.trim()) };
        else if (exercise.type === 'needs_assessment') result = needsValues;
        else result = {};
        logger.triggerHaptic('success');
        onComplete(result);
    };

    return (
        <div className="w-full max-w-2xl mx-auto my-6 glass-dark border-hard-red/20 soft-edge overflow-hidden animate-fade-in relative shadow-2xl">
            <CornerNodes className="opacity-20 scale-75" />

            {/* Header */}
            <div className="bg-black/40 px-6 py-6 border-b border-white/5">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 glass flex items-center justify-center border-hard-red/30 rounded-xl shadow-lg">
                        <Icon className="w-7 h-7 text-hard-red animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-lg font-impact text-white uppercase tracking-wider">{config.title}</h3>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">{config.description}</p>
                    </div>
                </div>
            </div>

            {/* Context */}
            <div className="px-6 py-8">
                <div className="bg-black/20 border-l-2 border-hard-red/30 p-5 mb-8 italic">
                   <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">"{exercise.context}"</p>
                </div>

                {exercise.type === 'boundary_builder' && (
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-4 block flex items-center gap-2">
                           <Terminal size={12} className="text-hard-red/50" /> USER_DEFINED_BOUNDARIES
                        </label>
                        {boundaryInputs.map((input, i) => (
                            <input
                                key={i}
                                type="text"
                                value={input}
                                onChange={(e) => {
                                    const newInputs = [...boundaryInputs];
                                    newInputs[i] = e.target.value;
                                    setBoundaryInputs(newInputs);
                                }}
                                placeholder={`ENTRY_0${i + 1}`}
                                className="w-full glass-zinc border-white/5 px-5 py-4 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-hard-red/30 soft-edge transition-all font-bold uppercase tracking-wide"
                            />
                        ))}
                    </div>
                )}

                {exercise.type === 'needs_assessment' && (
                    <div className="space-y-8">
                        {Object.entries(needsValues).map(([need, value]) => (
                            <div key={need}>
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
                                    <span className="text-zinc-500">{need}</span>
                                    <span className="text-hard-red">{value}%</span>
                                </div>
                                <input
                                    type="range"
                                    value={value}
                                    onChange={(e) => setNeedsValues({ ...needsValues, [need]: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-zinc-900 rounded-full appearance-none cursor-pointer accent-hard-red"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-6 py-6 bg-black/40 border-t border-white/5 flex gap-6 justify-end items-center">
                <button
                    onClick={() => {
                        if ('vibrate' in navigator) navigator.vibrate(5);
                        onSkip();
                    }}
                    className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors uppercase tracking-[0.3em]"
                >
                    SKIP_ENGAGEMENT
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-8 py-3 bg-white text-black font-impact text-xl uppercase tracking-widest soft-edge hover:bg-zinc-200 transition-all shadow-xl active:scale-95"
                >
                    SYNCHRONIZE
                </button>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const TherapistChat: React.FC<TherapistChatProps> = ({ onBack, firebaseUid }) => {
    // --- STATE ---
    const [messages, setMessages] = useState<TherapistMessage[]>(() => {
        const saved = localStorage.getItem('therapist_messages');
        if (saved) return JSON.parse(saved);
        return [{ role: 'therapist', content: WELCOME_MESSAGE.trim(), timestamp: Date.now() }];
    });
    const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotes>(() => {
        const saved = localStorage.getItem('therapist_notes');
        return saved ? JSON.parse(saved) : DEFAULT_NOTES;
    });

    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [interactionId, setInteractionId] = useState<string | undefined>(() => localStorage.getItem('therapist_interaction_id') || undefined);
    const [streamingContent, setStreamingContent] = useState('');
    const [pendingImages, setPendingImages] = useState<string[]>([]);
    const [pendingExercise, setPendingExercise] = useState<TherapistExercise | null>(null);
    const [memories, setMemories] = useState<TherapistMemory[]>([]);
    const [sessions, setSessions] = useState<TherapistSession[]>([]);
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [showSessionDrawer, setShowSessionDrawer] = useState(false);
    const [showTacticalOverlay, setShowTacticalOverlay] = useState(false);
    const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECTS ---
    useEffect(() => {
        localStorage.setItem('therapist_messages', JSON.stringify(messages));
        localStorage.setItem('therapist_notes', JSON.stringify(clinicalNotes));
        if (interactionId) localStorage.setItem('therapist_interaction_id', interactionId);
        if (firebaseUid && interactionId) {
            saveTherapistSession(firebaseUid, interactionId, messages, clinicalNotes).catch(console.error);
        }
    }, [messages, clinicalNotes, interactionId, firebaseUid]);

    useEffect(() => {
        if (!firebaseUid) return;
        getMemories(firebaseUid, undefined, interactionId).then(setMemories).catch(console.error);
        getTherapistSessions(firebaseUid).then(setSessions).catch(console.error);
    }, [firebaseUid, interactionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    const handleAction = (action: () => void, vibration: any = 'light') => {
        logger.triggerHaptic(vibration);
        action();
    };

    // --- HANDLERS ---
    const handleNewSession = () => {
        handleAction(() => {
            setMessages([]);
            setClinicalNotes(DEFAULT_NOTES);
            setInteractionId(undefined);
            setSuggestedPrompts([]);
            localStorage.removeItem('therapist_messages');
            localStorage.removeItem('therapist_notes');
            localStorage.removeItem('therapist_interaction_id');
            if (firebaseUid) getMemories(firebaseUid, 'GLOBAL').then(setMemories);
            setTimeout(() => setMessages([{ role: 'therapist', content: WELCOME_MESSAGE.trim(), timestamp: Date.now() }]), 0);
            setShowSessionDrawer(false);
        }, 15);
    };

    const handleLoadSession = (session: TherapistSession) => {
        handleAction(() => {
            setInteractionId(session.interaction_id);
            setMessages(session.messages || []);
            setClinicalNotes(session.clinical_notes || DEFAULT_NOTES);
            setSuggestedPrompts([]);
            setShowSessionDrawer(false);
        }, 10);
    };

    const extractSuggestedPrompts = (text: string): string[] => {
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
        const questions = sentences.filter(s => s.includes('?') || s.toLowerCase().startsWith('how') || s.toLowerCase().startsWith('what'));
        
        if (questions.length >= 2) return questions.slice(-3);
        
        return [
            "Supply further contextual data.",
            "Deconstruct emotional response.",
            "Define optimal interaction outcome."
        ];
    };

    const handleSend = async (overrideValue?: string) => {
        const textToSend = overrideValue || inputValue;
        const trimmed = textToSend.trim();
        if (!trimmed || isLoading) return;

        handleAction(() => {
            const userMsg: TherapistMessage = {
                role: 'user',
                content: trimmed,
                timestamp: Date.now(),
                images: pendingImages.length ? [...pendingImages] : undefined
            };
            setMessages(prev => [...prev, userMsg]);
            setInputValue('');
            setPendingImages([]);
            setSuggestedPrompts([]);
            setIsLoading(true);
            setStreamingContent('');
        }, 10);

        let insights: any = {};

        try {
            let fullResponse = '';
            const newId = await streamTherapistAdvice(
                trimmed,
                interactionId,
                userMsg.images,
                clinicalNotes,
                (chunk) => { fullResponse += chunk; setStreamingContent(fullResponse); },
                (newNotes) => setClinicalNotes(prev => ({
                    ...prev,
                    ...newNotes,
                    keyThemes: [...new Set([...(prev.keyThemes || []), ...(newNotes.keyThemes || [])])],
                    userInsights: [...new Set([...(prev.userInsights || []), ...(newNotes.userInsights || [])])],
                    actionItems: [...new Set([...(prev.actionItems || []), ...(newNotes.actionItems || [])])],
                })),
                (ex) => setPendingExercise({ type: ex.type as ExerciseType, context: ex.context, completed: false }),
                (name, args) => {
                    if (name === 'save_memory' && firebaseUid) {
                        saveMemory(firebaseUid, args.type, args.content, interactionId).then(() => {
                            setMemories(prev => [{ type: args.type, content: args.content, created_at: new Date().toISOString() }, ...prev]);
                        });
                    }
                    insights[name] = args;
                },
                memories
            );

            logger.triggerHaptic('medium');
            const extractedPrompts = extractSuggestedPrompts(fullResponse);
            setSuggestedPrompts(extractedPrompts);

            setMessages(prev => [...prev, {
                role: 'therapist',
                content: fullResponse,
                timestamp: Date.now(),
                closureScript: insights['generate_closure_script'],
                safetyIntervention: insights['trigger_safety_intervention'],
                parentalPattern: insights['log_parental_pattern'],
                valuesMatrix: insights['assign_values_matrix'],
                suggestedPrompts: extractedPrompts,
                ...insights
            }]);
            setInteractionId(newId || interactionId);
        } catch (e) {
            console.error(e);
            logger.triggerHaptic('error');
            setMessages(prev => [...prev, {
                role: 'therapist',
                content: "SIGNAL_INTERFERENCE: UNABLE_TO_PROCESS_INPUT. PLEASE_RETRY_TRANSMISSION.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
            setStreamingContent('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            Array.from(e.target.files).forEach(f => {
                const r = new FileReader();
                r.onload = () => {
                    setPendingImages(p => [...p, r.result as string]);
                    if ('vibrate' in navigator) navigator.vibrate(5);
                };
                r.readAsDataURL(f);
            });
        }
    };

    // --- RENDER ---
    return (
        <div className="flex h-[100dvh] w-full bg-matte-base text-zinc-300 overflow-hidden font-mono select-none">
            <div className="bg-matte-grain"></div>

            {/* MOBILE SESSION DRAWER */}
            {showSessionDrawer && (
                <>
                    <div
                        className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-40 animate-fade-in"
                        onClick={() => setShowSessionDrawer(false)}
                    />
                    <div className="md:hidden fixed top-0 left-0 bottom-0 w-full z-50 animate-slide-up">
                        <TherapistSidebar 
                            sessions={sessions}
                            currentInteractionId={interactionId}
                            onNewSession={handleNewSession}
                            onLoadSession={handleLoadSession}
                            onBack={onBack}
                            onClose={() => setShowSessionDrawer(false)}
                            isMobile={true}
                        />
                    </div>
                </>
            )}

            {/* DESKTOP LEFT SIDEBAR */}
            <div className="hidden md:block w-80 h-full border-r border-white/5 relative z-20">
                <TherapistSidebar 
                    sessions={sessions}
                    currentInteractionId={interactionId}
                    onNewSession={handleNewSession}
                    onLoadSession={handleLoadSession}
                    onBack={onBack}
                />
            </div>

            {/* MAIN CHAT AREA */}
            <div className="flex-1 flex flex-col relative bg-matte-base h-full overflow-hidden">
                <CornerNodes className="opacity-[0.02]" />

                {/* MODULE HEADER */}
                <div className="px-6 pt-8">
                  <ModuleHeader 
                    title="RELATIONSHIP_ANALYST" 
                    mode="THERAPY_MODE" 
                    id={interactionId?.slice(0, 8).toUpperCase()}
                    onBack={() => handleAction(onBack)}
                    accentColor="red"
                    statusLabel="UPLINK_STATUS"
                    statusValue="ENCRYPTED"
                    statusColor="red"
                    rightElement={
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleAction(() => setShowTacticalOverlay(true), 10)}
                                className="lg:hidden p-2.5 glass-zinc border border-white/5 text-zinc-400 hover:text-white soft-edge transition-all"
                            >
                                <BarChart3 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => handleAction(() => setShowSessionDrawer(true), 10)}
                                className="md:hidden p-2.5 glass-zinc border border-white/5 text-zinc-400 hover:text-white soft-edge transition-all"
                            >
                                <Menu className="w-4 h-4" />
                            </button>
                        </div>
                    }
                  />
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 scrollbar-hide relative z-10 custom-scrollbar pb-32">
                    <div className="max-w-4xl mx-auto space-y-10">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col gap-3 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* Header Meta */}
                                <div className="flex items-center gap-3 opacity-40 px-1">
                                    <div className={`w-1 h-1 rounded-full ${msg.role === 'user' ? 'bg-zinc-500' : 'bg-hard-red'}`}></div>
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        {' // '}
                                        {msg.role === 'user' ? 'SIGNAL_ORIGIN_USER' : 'ANALYST_RESPONSE'}
                                    </span>
                                </div>

                                {/* Message Content */}
                                <div className={`relative max-w-[95%] sm:max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>

                                    {/* Attached Images */}
                                    {msg.images && (
                                        <div className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.images.map((img, i) => (
                                                <img
                                                    key={i}
                                                    src={img}
                                                    className="h-20 w-auto border border-white/5 glass-zinc soft-edge opacity-80 hover:opacity-100 transition-opacity shadow-lg"
                                                    alt="Attached Log"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Message Bubble */}
                                    <div className={`inline-block px-6 py-5 soft-edge shadow-2xl relative overflow-hidden ${msg.role === 'user'
                                        ? 'bg-white text-black font-bold border-white/5'
                                        : 'glass-dark border-white/5 text-zinc-200'
                                        }`}>
                                        <div className={`prose prose-sm prose-invert prose-p:my-2 prose-headings:text-zinc-200 prose-headings:font-impact prose-headings:uppercase prose-headings:tracking-widest prose-strong:text-hard-red max-w-none text-sm leading-relaxed uppercase tracking-wide font-bold ${msg.role === 'user' ? 'text-black prose-p:text-black prose-headings:text-black' : ''}`}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                        {/* Corner Accent */}
                                        <div className={`absolute bottom-0 ${msg.role === 'user' ? 'right-0 border-r-4 border-b-4 border-zinc-200' : 'left-0 border-l-4 border-b-4 border-hard-red/30'} w-2 h-2`}></div>
                                    </div>
                                </div>

                                {/* Inline Insights */}
                                {msg.role === 'therapist' && (
                                    <div className="w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%] space-y-4 mt-2">
                                        {msg.closureScript && (
                                            <InsightCard
                                                title="Closure Script"
                                                icon={Clipboard}
                                                accentColor="purple"
                                                content={<p className="whitespace-pre-wrap">{msg.closureScript.script}</p>}
                                            />
                                        )}
                                        {msg.safetyIntervention && (
                                            <InsightCard
                                                title="Security Alert"
                                                icon={ShieldAlert}
                                                accentColor="red"
                                                content={<p>{msg.safetyIntervention.reason}</p>}
                                            />
                                        )}
                                        {msg.parentalPattern && (
                                            <InsightCard
                                                title="Behavioral Pattern"
                                                icon={Users2}
                                                accentColor="emerald"
                                                content={<p className="italic">"{msg.parentalPattern.insight}"</p>}
                                            />
                                        )}
                                        {msg.valuesMatrix && (
                                            <InsightCard
                                                title="Alignment Matrix"
                                                icon={Scale}
                                                accentColor="gold"
                                                content={<p>{msg.valuesMatrix.alignmentScore}% VALUE ALIGNMENT DETECTED</p>}
                                            />
                                        )}
                                        {(msg as any).perspective && (
                                            <InsightCard
                                                title="Target Perspective"
                                                icon={Eye}
                                                accentColor="blue"
                                                content={<p className="italic">{(msg as any).perspective.suggestedMotive}</p>}
                                            />
                                        )}
                                        {(msg as any).pattern && (
                                            <InsightCard
                                                title="Core Dynamic"
                                                icon={BookOpen}
                                                accentColor="gold"
                                                content={<p className="font-impact text-hard-red">{(msg as any).pattern.patternName}</p>}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Exercise Card */}
                        {pendingExercise && !pendingExercise.completed && (
                            <ExerciseCard
                                exercise={pendingExercise}
                                onComplete={(res) => {
                                    setPendingExercise({ ...pendingExercise, completed: true });
                                    handleSend(`[EXERCISE_SYNC_COMPLETE: ${pendingExercise.type}] ${JSON.stringify(res)}`);
                                }}
                                onSkip={() => {
                                    handleAction(() => setPendingExercise(null), 5);
                                }}
                            />
                        )}

                        {/* Streaming Response */}
                        {isLoading && (
                            <div className="flex flex-col gap-3 items-start animate-fade-in">
                                <div className="flex items-center gap-3 opacity-40 px-1">
                                    <div className="w-1.5 h-1.5 bg-hard-red rounded-full animate-ping"></div>
                                    <span className="text-[9px] font-bold text-hard-red uppercase tracking-[0.4em]">PROCESSING_INFERENCE...</span>
                                </div>
                                <div className="inline-block px-6 py-5 soft-edge glass-dark border-white/5 max-w-[90%] sm:max-w-[80%] shadow-xl">
                                    <div className="text-sm font-bold text-zinc-500 whitespace-pre-wrap leading-relaxed uppercase tracking-wide">
                                        {streamingContent}
                                        <span className="inline-block w-1.5 h-4 bg-hard-red ml-2 animate-pulse rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Suggested Prompts */}
                        {!isLoading && suggestedPrompts.length > 0 && (
                            <div className="flex flex-col gap-4 animate-fade-in py-6">
                                <div className="flex items-center gap-3 px-1">
                                    <div className="w-1.5 h-[1px] bg-hard-red/50"></div>
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.3em]">PROPOSED_TRANSMISSIONS</span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {suggestedPrompts.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleAction(() => handleSend(prompt), 10)}
                                            className="px-5 py-3 glass-zinc border-white/5 hover:border-hard-red/30 hover:bg-hard-red/[0.02] soft-edge text-xs font-bold text-zinc-500 hover:text-white transition-all text-left leading-relaxed active:scale-95 shadow-lg uppercase tracking-wide"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* INPUT AREA */}
                <div className="p-6 md:p-8 glass-dark border-t border-white/5 relative z-40 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                    <div className="max-w-4xl mx-auto">

                        {/* Pending Images */}
                        {pendingImages.length > 0 && (
                            <div className="flex gap-3 mb-6 overflow-x-auto pb-3 scrollbar-hide">
                                {pendingImages.map((img, i) => (
                                    <div key={i} className="relative group shrink-0">
                                        <img src={img} className="h-20 w-auto soft-edge border border-white/10 shadow-2xl grayscale group-hover:grayscale-0 transition-all" alt="Upload" />
                                        <button
                                            onClick={() => handleAction(() => setPendingImages(prev => prev.filter((_, idx) => idx !== i)), 10)}
                                            className="absolute -top-2 -right-2 w-7 h-7 bg-hard-red text-white rounded-full flex items-center justify-center text-sm shadow-2xl hover:bg-red-600 transition-colors border border-white/10"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Row */}
                        <div className="flex items-center gap-4 p-1 glass-zinc border-white/10 soft-edge focus-within:border-hard-red/30 transition-all shadow-2xl">
                            <button
                                onClick={() => handleAction(() => fileInputRef.current?.click(), 10)}
                                className="p-4 text-zinc-600 hover:text-white transition-colors shrink-0 group"
                                title="Attach screenshot"
                            >
                                <ImagePlus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            </button>

                            <input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="SUPPLY_OPERATIONAL_METADATA..."
                                className="flex-1 bg-transparent text-white text-sm font-bold uppercase tracking-wider placeholder:text-zinc-800 focus:outline-none py-4"
                                autoComplete="off"
                            />

                            <button
                                onClick={() => handleAction(() => handleSend(), 15)}
                                disabled={!inputValue.trim() || isLoading}
                                aria-label="Send message"
                                className={`px-6 py-4 rounded-xl transition-all shrink-0 font-impact text-xl uppercase tracking-widest ${
                                    !inputValue.trim() || isLoading 
                                    ? 'text-zinc-800' 
                                    : 'text-hard-red hover:bg-hard-red/5'
                                }`}
                            >
                                <Send className="w-6 h-6" />
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                className="hidden"
                                multiple
                                accept="image/*"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* DESKTOP RIGHT SIDEBAR */}
            {showRightPanel && (
                <div className="hidden lg:flex flex-col w-96 shrink-0 border-l border-white/5 relative z-20">
                    <TherapistTacticalReport 
                        clinicalNotes={clinicalNotes}
                        memories={memories}
                        onUpdateMemory={(id, c, t) => {
                            handleAction(() => updateMemory(id, c, t), 5);
                        }}
                        onDeleteMemory={(id) => {
                            handleAction(() => deleteMemory(id), 10);
                        }}
                    />
                </div>
            )}

            {/* MOBILE TACTICAL OVERLAY */}
            {showTacticalOverlay && (
                <div className="fixed inset-0 z-50 lg:hidden flex flex-col animate-fade-in bg-matte-base font-mono">
                    <TherapistTacticalReport 
                        clinicalNotes={clinicalNotes}
                        memories={memories}
                        onUpdateMemory={(id, c, t) => {
                            handleAction(() => updateMemory(id, c, t), 5);
                        }}
                        onDeleteMemory={(id) => {
                            handleAction(() => deleteMemory(id), 10);
                        }}
                        onClose={() => handleAction(() => setShowTacticalOverlay(false), 5)}
                        isMobile={true}
                    />
                </div>
            )}
        </div>
    );
};
