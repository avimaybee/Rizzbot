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
import { SuggestedPrompts } from './SuggestedPrompts';
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
### Relationship Therapy

Welcome. I'm here to help you process your experiences and gain clarity on your relationship dynamics.

**You can use this space to:**
- Share your thoughts and feelings freely
- Identify recurring patterns in your interactions
- Work through confusing situations
- Practice healthier communication skills

Where would you like to start today?
`;

// Insight Card Component - Professional & Clean
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
        gold: 'border-amber-500/20 bg-amber-500/5',
        red: 'border-rose-500/20 bg-rose-500/5',
        emerald: 'border-emerald-500/20 bg-emerald-500/5',
        blue: 'border-blue-500/20 bg-blue-500/5',
        purple: 'border-purple-500/20 bg-purple-500/5',
    };

    const iconColors = {
        gold: 'text-amber-400',
        red: 'text-rose-400',
        emerald: 'text-emerald-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
    };

    return (
        <div className={`border ${colors[accentColor]} p-4 sm:p-5 my-4 rounded-xl animate-fade-in transition-all shadow-sm`}>
            <div className="flex items-center gap-3 mb-3">
              <Icon className={`w-4 h-4 ${iconColors[accentColor]}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">{title}</span>
            </div>
            <div className="text-sm text-zinc-400 leading-relaxed pl-1">
                {content}
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
        needs_assessment: { icon: Heart, title: 'Needs Assessment', description: 'Identify your core needs' },
        attachment_quiz: { icon: Users, title: 'Attachment Style', description: 'Explore your relationship patterns' }
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
        <div className="w-full max-w-2xl mx-auto my-8 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-fade-in shadow-xl">
            {/* Header */}
            <div className="px-6 py-6 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <Icon className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white tracking-tight">{config.title}</h3>
                        <p className="text-xs text-zinc-500">{config.description}</p>
                    </div>
                </div>
            </div>

            {/* Context */}
            <div className="px-6 py-8">
                <p className="text-sm text-zinc-400 leading-relaxed mb-8 italic">"{exercise.context}"</p>

                {exercise.type === 'boundary_builder' && (
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-500 mb-2 block uppercase tracking-wide">Your Boundaries</label>
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
                                placeholder={`Requirement ${i + 1}`}
                                className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-rose-500/30 rounded-xl transition-all"
                            />
                        ))}
                    </div>
                )}

                {exercise.type === 'needs_assessment' && (
                    <div className="space-y-8">
                        {Object.entries(needsValues).map(([need, value]) => (
                            <div key={need}>
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wide mb-4">
                                    <span className="text-zinc-500">{need}</span>
                                    <span className="text-rose-400">{value}%</span>
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
            <div className="px-6 py-6 bg-zinc-950 border-t border-zinc-800 flex gap-4 justify-end items-center">
                <button
                    onClick={() => {
                        logger.triggerHaptic('light');
                        onSkip();
                    }}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wide"
                >
                    Skip
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2.5 bg-rose-500 text-white font-bold text-sm rounded-xl hover:bg-rose-400 transition-all active:scale-95 shadow-lg shadow-rose-500/10"
                >
                    Complete Exercise
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
        }, 'medium');
    };

    const handleLoadSession = (session: TherapistSession) => {
        handleAction(() => {
            setInteractionId(session.interaction_id);
            setMessages(session.messages || []);
            setClinicalNotes(session.clinical_notes || DEFAULT_NOTES);
            setSuggestedPrompts([]);
            setShowSessionDrawer(false);
        }, 'light');
    };

    const extractSuggestedPrompts = (text: string): string[] => {
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
        const questions = sentences.filter(s => s.includes('?') || s.toLowerCase().startsWith('how') || s.toLowerCase().startsWith('what'));
        
        if (questions.length >= 2) return questions.slice(-3);
        
        return [
            "Tell me more about this.",
            "How does this make you feel?",
            "What is your goal for this situation?"
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
        }, 'light');

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
                content: "I encountered an error processing your message. Please try again.",
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

    // --- RENDER ---
    return (
        <div className="flex h-[100dvh] w-full bg-matte-base text-zinc-300 overflow-hidden font-sans">
            {/* Background grain / texture - Functional for depth */}
            <div className="absolute inset-0 bg-dot-pattern opacity-[0.03] pointer-events-none"></div>

            {/* MOBILE SESSION DRAWER */}
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

            {/* DESKTOP LEFT SIDEBAR */}
            <div className="hidden md:block w-72 h-full border-r border-zinc-800 relative z-20">
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
                <div className="px-4 pt-4">
                  <ModuleHeader 
                    title="Relationship Therapy" 
                    mode="Personal Growth" 
                    onBack={() => handleAction(onBack)}
                    accentColor="red"
                    statusLabel="Status"
                    statusValue="Active"
                    statusColor="red"
                    rightElement={
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleAction(() => setShowTacticalOverlay(true), 'light')}
                                className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
                                title="View Report"
                            >
                                <BarChart3 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => handleAction(() => setShowSessionDrawer(true), 'light')}
                                className="md:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
                                title="Sessions"
                            >
                                <Menu className="w-4 h-4" />
                            </button>
                        </div>
                    }
                  />
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-hide relative z-10 custom-scrollbar pb-32">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* Header Meta */}
                                <div className="flex items-center gap-2 opacity-40 px-1">
                                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {' — '}
                                        {msg.role === 'user' ? 'You' : 'Therapist'}
                                    </span>
                                </div>

                                {/* Message Content */}
                                <div className={`relative max-w-[90%] sm:max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>

                                    {/* Attached Images */}
                                    {msg.images && (
                                        <div className={`flex gap-3 mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.images.map((img, i) => (
                                                <img
                                                    key={i}
                                                    src={img}
                                                    className="h-20 w-auto border border-zinc-800 rounded-xl opacity-90 hover:opacity-100 transition-opacity shadow-sm"
                                                    alt="Attached context"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Message Bubble */}
                                    <div className={`inline-block px-5 py-4 rounded-2xl shadow-sm ${msg.role === 'user'
                                        ? 'bg-rose-500/10 border border-rose-500/20 text-white'
                                        : 'bg-zinc-900/60 border border-zinc-800/50 text-zinc-200'
                                        }`}>
                                        <div className="prose prose-sm prose-invert prose-p:my-1.5 max-w-none text-sm leading-relaxed">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>

                                {/* Inline Insights */}
                                {msg.role === 'therapist' && (
                                    <div className="w-full max-w-[90%] sm:max-w-[85%] space-y-3 mt-1">
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
                                                title="Safety Alert"
                                                icon={ShieldAlert}
                                                accentColor="red"
                                                content={<p>{msg.safetyIntervention.reason}</p>}
                                            />
                                        )}
                                        {msg.parentalPattern && (
                                            <InsightCard
                                                title="Relationship Pattern"
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
                                                title="Perspective"
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
                                    handleSend(`[Completed Exercise: ${pendingExercise.type}] ${JSON.stringify(res)}`);
                                }}
                                onSkip={() => {
                                    handleAction(() => setPendingExercise(null), 'light');
                                }}
                            />
                        )}

                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex flex-col gap-2 items-start animate-fade-in">
                                <div className="flex items-center gap-2 opacity-40 px-1">
                                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest animate-pulse">Processing...</span>
                                </div>
                                <div className="inline-block px-5 py-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 max-w-[80%]">
                                    <div className="text-sm text-zinc-500 whitespace-pre-wrap leading-relaxed">
                                        {streamingContent}
                                        <span className="inline-block w-1 h-4 bg-rose-500 ml-1 animate-pulse rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Suggested Prompts */}
                        <SuggestedPrompts
                            prompts={suggestedPrompts}
                            onSelect={(p) => handleAction(() => handleSend(p), 'light')}
                            isVisible={!isLoading && suggestedPrompts.length > 0}
                        />

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* INPUT AREA */}
                <div className="p-4 md:p-6 bg-matte-base/80 backdrop-blur-md border-t border-zinc-800 relative z-40 shrink-0">
                    <div className="max-w-3xl mx-auto">

                        {/* Pending Images */}
                        {pendingImages.length > 0 && (
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                {pendingImages.map((img, i) => (
                                    <div key={i} className="relative group shrink-0">
                                        <img src={img} className="h-16 w-auto rounded-lg border border-zinc-800 shadow-sm" alt="Context screenshot" />
                                        <button
                                            onClick={() => handleAction(() => setPendingImages(prev => prev.filter((_, idx) => idx !== i)), 'light')}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm shadow-md hover:bg-rose-400 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Row */}
                        <div className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl focus-within:border-rose-500/30 transition-all shadow-sm">
                            <button
                                onClick={() => handleAction(() => fileInputRef.current?.click(), 'light')}
                                className="p-2.5 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                                title="Attach context"
                            >
                                <ImagePlus className="w-5 h-5" />
                            </button>

                            <input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="Share what's on your mind..."
                                className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-700 focus:outline-none py-2 px-1"
                                autoComplete="off"
                            />

                            <button
                                onClick={() => handleAction(() => handleSend(), 'light')}
                                disabled={!inputValue.trim() || isLoading}
                                aria-label="Send message"
                                className={`p-2.5 rounded-xl transition-all shrink-0 ${
                                    !inputValue.trim() || isLoading 
                                    ? 'text-zinc-800' 
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

            {/* DESKTOP RIGHT SIDEBAR */}
            {showRightPanel && (
                <div className="hidden lg:flex flex-col w-80 shrink-0 border-l border-zinc-800 relative z-20">
                    <TherapistTacticalReport 
                        clinicalNotes={clinicalNotes}
                        memories={memories}
                        onUpdateMemory={(id, c, t) => {
                            handleAction(() => updateMemory(id, c, t), 'light');
                        }}
                        onDeleteMemory={(id) => {
                            handleAction(() => deleteMemory(id), 'medium');
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
                            handleAction(() => updateMemory(id, c, t), 'light');
                        }}
                        onDeleteMemory={(id) => {
                            handleAction(() => deleteMemory(id), 'medium');
                        }}
                        onClose={() => handleAction(() => setShowTacticalOverlay(false), 'light')}
                        isMobile={true}
                    />
                </div>
            )}
        </div>
    );
};
