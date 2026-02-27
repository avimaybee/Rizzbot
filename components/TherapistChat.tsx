import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Send, ArrowLeft, HeartHandshake, ImagePlus, X, Edit3, Target, Heart, Users, Sparkles, Eye, BookOpen, ShieldAlert, History, Activity, Clipboard, AlertTriangle, Users2, Scale, Brain, Lightbulb, MessageCircle, ChevronRight, PanelRightOpen, PanelRightClose, Menu, BarChart3 } from 'lucide-react';
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
        gold: 'border-hard-gold/30 bg-hard-gold/5',
        red: 'border-hard-red/30 bg-hard-red/5',
        emerald: 'border-emerald-500/30 bg-emerald-500/5',
        blue: 'border-hard-blue/30 bg-hard-blue/5',
        purple: 'border-purple-500/30 bg-purple-500/5',
    };

    const iconColors = {
        gold: 'text-hard-gold',
        red: 'text-hard-red',
        emerald: 'text-emerald-400',
        blue: 'text-hard-blue',
        purple: 'text-purple-400',
    };

    return (
        <div className={`border ${colors[accentColor]} p-3 sm:p-4 my-2 sm:my-3 rounded-2xl animate-fade-in relative overflow-hidden group hover:border-zinc-600 transition-all`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg bg-zinc-900/50 ${iconColors[accentColor]}`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.2em] ${iconColors[accentColor]}`}>{title}</span>
            </div>
            <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans pl-1">
                {content}
            </div>
            
            {/* Subtle corner indicator */}
            <div className={`absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity`}>
              <span className={`text-[8px] font-mono ${iconColors[accentColor]}`}>+</span>
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
        <div className="w-full max-w-2xl mx-auto my-3 sm:my-4 border border-zinc-800 bg-zinc-900/80 rounded-2xl overflow-hidden animate-fade-in relative">
            <CornerNodes className="opacity-30" />

            {/* Header */}
            <div className="bg-zinc-800/50 px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-700/50">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-tight">{config.title}</h3>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{config.description}</p>
                    </div>
                </div>
            </div>

            {/* Context */}
            <div className="px-4 sm:px-6 py-4 sm:py-6">
                <p className="text-xs sm:text-sm text-zinc-400 italic mb-4 sm:mb-6 leading-relaxed">"{exercise.context}"</p>

                {exercise.type === 'boundary_builder' && (
                    <div className="space-y-3 sm:space-y-4">
                        <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 font-bold block mb-2">YOUR_NON_NEGOTIABLES</label>
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
                                placeholder={`ENTRY_${i + 1}`}
                                className="w-full bg-black/40 border border-zinc-800 px-4 py-3.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-rose-500/50 rounded-xl transition-all font-mono"
                            />
                        ))}
                    </div>
                )}

                {exercise.type === 'needs_assessment' && (
                    <div className="space-y-6">
                        {Object.entries(needsValues).map(([need, value]) => (
                            <div key={need}>
                                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-3">
                                    <span className="text-zinc-500">{need}</span>
                                    <span className="text-rose-400 font-bold">{value}%</span>
                                </div>
                                <input
                                    type="range"
                                    value={value}
                                    onChange={(e) => setNeedsValues({ ...needsValues, [need]: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-rose-500"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-zinc-800/30 border-t border-zinc-700/50 flex gap-4 justify-end items-center">
                <button
                    onClick={onSkip}
                    className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
                >
                    SKIP_PROTOCOL
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2.5 bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg active:scale-95"
                >
                    COMPLETE_SESSION
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

    // --- HANDLERS ---
    const handleNewSession = () => {
        logger.triggerHaptic('medium');
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
    };

    const handleLoadSession = (session: TherapistSession) => {
        logger.triggerHaptic('light');
        setInteractionId(session.interaction_id);
        setMessages(session.messages || []);
        setClinicalNotes(session.clinical_notes || DEFAULT_NOTES);
        setSuggestedPrompts([]);
        setShowSessionDrawer(false);
    };

    const extractSuggestedPrompts = (text: string): string[] => {
        // Look for common therapist follow-up patterns or explicit questions
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
        const questions = sentences.filter(s => s.includes('?') || s.toLowerCase().startsWith('how') || s.toLowerCase().startsWith('what'));
        
        // Return 2-3 most relevant ones or defaults
        if (questions.length >= 2) return questions.slice(-3);
        
        return [
            "Tell me more about that.",
            "How did that make you feel?",
            "What's your ideal outcome here?"
        ];
    };

    const handleSend = async (overrideValue?: string) => {
        const textToSend = overrideValue || inputValue;
        const trimmed = textToSend.trim();
        if (!trimmed || isLoading) return;

        logger.triggerHaptic('light');
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
                content: "I'm having trouble processing that right now. Could you try rephrasing, or let me know if you'd like to start fresh?",
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
                    logger.triggerHaptic('light');
                };
                r.readAsDataURL(f);
            });
        }
    };

    const handlePromptClick = (prompt: string) => {
        handleSend(prompt);
    };

    // --- RENDER ---
    return (
        <div className="flex h-[100dvh] w-full bg-matte-base text-zinc-300 overflow-hidden">

            {/* MOBILE SESSION DRAWER (Slide-out) */}
            {showSessionDrawer && (
                <>
                    <div
                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
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

            {/* DESKTOP LEFT SIDEBAR: SESSION HISTORY */}
            <div className="hidden md:block w-72 h-full">
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

                {/* MODULE HEADER */}
                <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                  <ModuleHeader 
                    title="RELATIONSHIP THERAPIST" 
                    mode="THERAPIST_MODE" 
                    id={interactionId?.slice(0, 8)}
                    onBack={onBack}
                    accentColor="red"
                    statusLabel="SESSION_STATUS"
                    statusValue="ACTIVE"
                    statusColor="red"
                    rightElement={
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    logger.triggerHaptic('light');
                                    setShowTacticalOverlay(true);
                                }}
                                className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                            >
                                <BarChart3 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => {
                                    logger.triggerHaptic('light');
                                    setShowSessionDrawer(true);
                                }}
                                className="md:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                            >
                                <Menu className="w-4 h-4" />
                            </button>
                        </div>
                    }
                  />
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 scrollbar-hide">
                    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-12">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col gap-1.5 sm:gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* Timestamp */}
                                <div className="flex items-center gap-2 opacity-50">
                                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {' // '}
                                        {msg.role === 'user' ? 'USER_PROMPT' : 'THERAPIST_RESPONSE'}
                                    </span>
                                </div>

                                {/* Message Content */}
                                <div className={`relative max-w-[95%] sm:max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>

                                    {/* Attached Images */}
                                    {msg.images && (
                                        <div className={`flex gap-2 mb-2 sm:mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.images.map((img, i) => (
                                                <img
                                                    key={i}
                                                    src={img}
                                                    className="h-16 sm:h-20 w-auto border border-zinc-700 rounded-lg opacity-90 hover:opacity-100 transition-opacity"
                                                    alt="Attached"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Message Bubble */}
                                    <div className={`inline-block px-4 sm:px-6 py-3.5 sm:py-5 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-rose-500/10 border border-rose-500/20 text-white'
                                        : 'bg-zinc-900/60 border border-zinc-800/50 text-zinc-200'
                                        }`}>
                                        <div className="prose prose-sm prose-invert prose-p:my-1.5 sm:prose-p:my-2 prose-headings:text-zinc-200 prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-strong:text-rose-300 max-w-none text-sm sm:text-base leading-relaxed">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>

                                {/* Inline Insights */}
                                {msg.role === 'therapist' && (
                                    <div className="w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%] space-y-2 mt-1">
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
                                                content={<p>{msg.valuesMatrix.alignmentScore}% value alignment detected</p>}
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
                                                content={<p className="font-bold text-rose-300">{(msg as any).pattern.patternName}</p>}
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
                                    handleSend(`[Completed: ${pendingExercise.type}] ${JSON.stringify(res)}`);
                                }}
                                onSkip={() => {
                                    logger.triggerHaptic('light');
                                    setPendingExercise(null);
                                }}
                            />
                        )}

                        {/* Streaming Response */}
                        {isLoading && (
                            <div className="flex flex-col gap-2 items-start animate-fade-in">
                                <div className="flex items-center gap-2 opacity-50">
                                    <span className="text-[9px] font-mono text-rose-400 uppercase tracking-widest animate-pulse">PROCESSING_INFERENCE...</span>
                                </div>
                                <div className="inline-block px-4 sm:px-6 py-3.5 sm:py-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 max-w-[90%] sm:max-w-[80%]">
                                    <div className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                        {streamingContent}
                                        <span className="inline-block w-1.5 h-4 bg-rose-500 ml-1 animate-pulse rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Suggested Prompts - Tactical Reveal */}
                        {!isLoading && suggestedPrompts.length > 0 && (
                            <div className="flex flex-col gap-3 animate-fade-in py-4">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-1 h-1 bg-rose-500/50 rounded-full"></div>
                                    <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em]">SUGGESTED_FOLLOW_UPS</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedPrompts.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handlePromptClick(prompt)}
                                            className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 hover:border-rose-500/30 hover:bg-rose-500/5 rounded-xl text-xs text-zinc-400 hover:text-rose-200 transition-all text-left font-sans leading-relaxed active:scale-95"
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
                <div className="border-t border-zinc-800 bg-matte-base/80 backdrop-blur-md p-3 sm:p-6 pb-24 sm:pb-6">
                    <div className="max-w-3xl mx-auto">

                        {/* Pending Images */}
                        {pendingImages.length > 0 && (
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                {pendingImages.map((img, i) => (
                                    <div key={i} className="relative group shrink-0">
                                        <img src={img} className="h-16 sm:h-20 w-auto rounded-xl border border-zinc-800 shadow-lg" alt="Upload" />
                                        <button
                                            onClick={() => {
                                                logger.triggerHaptic('light');
                                                setPendingImages(prev => prev.filter((_, idx) => idx !== i));
                                            }}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm shadow-xl hover:bg-rose-400 transition-colors"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Row */}
                        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 focus-within:border-rose-500/30 focus-within:bg-zinc-900 transition-all">
                            <button
                                onClick={() => {
                                    logger.triggerHaptic('light');
                                    fileInputRef.current?.click();
                                }}
                                className="p-2 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                                title="Attach screenshot"
                            >
                                <ImagePlus className="w-5 h-5" />
                            </button>

                            <input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="DECODE_YOUR_THOUGHTS..."
                                className="flex-1 bg-transparent text-white text-base sm:text-sm placeholder:text-zinc-700 focus:outline-none py-1.5 font-mono"
                                autoComplete="off"
                            />

                            <button
                                onClick={() => handleSend()}
                                disabled={!inputValue.trim() || isLoading}
                                aria-label="Send message"
                                className={`p-2 rounded-xl transition-all shrink-0 ${
                                    !inputValue.trim() || isLoading 
                                    ? 'text-zinc-700' 
                                    : 'text-rose-500 hover:bg-rose-500/10'
                                }`}
                            >
                                <Send className="w-5 h-5" />
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

            {/* DESKTOP RIGHT SIDEBAR: TACTICAL REPORT */}
            {showRightPanel && (
                <div className="hidden lg:flex flex-col w-80 shrink-0">
                    <TherapistTacticalReport 
                        clinicalNotes={clinicalNotes}
                        memories={memories}
                        onUpdateMemory={(id, c, t) => {
                            logger.triggerHaptic('light');
                            updateMemory(id, c, t);
                        }}
                        onDeleteMemory={(id) => {
                            logger.triggerHaptic('medium');
                            deleteMemory(id);
                        }}
                    />
                </div>
            )}

            {/* MOBILE TACTICAL OVERLAY */}
            {showTacticalOverlay && (
                <div className="fixed inset-0 z-50 lg:hidden flex flex-col animate-fade-in bg-matte-base">
                    <TherapistTacticalReport 
                        clinicalNotes={clinicalNotes}
                        memories={memories}
                        onUpdateMemory={(id, c, t) => {
                            logger.triggerHaptic('light');
                            updateMemory(id, c, t);
                        }}
                        onDeleteMemory={(id) => {
                            logger.triggerHaptic('medium');
                            deleteMemory(id);
                        }}
                        onClose={() => {
                            logger.triggerHaptic('light');
                            setShowTacticalOverlay(false);
                        }}
                        isMobile={true}
                    />
                </div>
            )}
        </div>
    );
};
