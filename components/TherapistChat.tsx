import React, { useState, useRef, useEffect } from 'react';
import { Plus, Send, ArrowLeft, HeartHandshake, ImagePlus, X, Edit3, Target, Heart, Users, Sparkles, Eye, BookOpen, ShieldAlert, History, Activity, Clipboard, AlertTriangle, Users2, Scale, Brain, Lightbulb, MessageCircle, ChevronRight, PanelRightOpen, PanelRightClose, Menu, BarChart3 } from 'lucide-react';
import { streamTherapistAdvice } from '../services/geminiService';
import { saveTherapistSession, getTherapistSession, getTherapistSessions, TherapistSession, getMemories, saveMemory, deleteMemory, updateMemory, TherapistMemory } from '../services/dbService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TherapistMessage, ClinicalNotes, TherapistExercise, ExerciseType } from '../types';

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

// Corner Nodes - Matching app design system
const CornerNodes = ({ className }: { className?: string }) => (
    <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
        <div className="absolute top-0 left-0">
            <div className="w-2 h-2 border-t border-l border-zinc-600"></div>
        </div>
        <div className="absolute top-0 right-0">
            <div className="w-2 h-2 border-t border-r border-zinc-600"></div>
        </div>
        <div className="absolute bottom-0 left-0">
            <div className="w-2 h-2 border-b border-l border-zinc-600"></div>
        </div>
        <div className="absolute bottom-0 right-0">
            <div className="w-2 h-2 border-b border-r border-zinc-600"></div>
        </div>
    </div>
);

// Insight Card Component - Polished inline insights
const InsightCard = ({
    title,
    content,
    icon: Icon,
    accentColor = 'rose'
}: {
    title: string;
    content: React.ReactNode;
    icon: any;
    accentColor?: 'rose' | 'emerald' | 'amber' | 'sky' | 'purple';
}) => {
    const colors = {
        rose: 'border-l-rose-500 bg-rose-950/20',
        emerald: 'border-l-emerald-500 bg-emerald-950/20',
        amber: 'border-l-amber-500 bg-amber-950/20',
        sky: 'border-l-sky-500 bg-sky-950/20',
        purple: 'border-l-purple-500 bg-purple-950/20',
    };

    const iconColors = {
        rose: 'text-rose-400',
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        sky: 'text-sky-400',
        purple: 'text-purple-400',
    };

    return (
        <div className={`border-l-2 ${colors[accentColor]} p-3 sm:p-4 my-2 sm:my-3 rounded-r-lg animate-fade-in`}>
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconColors[accentColor]}`} />
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">{title}</span>
            </div>
            <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
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
        onComplete(result);
    };

    return (
        <div className="w-full max-w-2xl mx-auto my-3 sm:my-4 border border-zinc-800 bg-zinc-900/80 rounded-xl overflow-hidden animate-fade-in">
            <CornerNodes className="opacity-30" />

            {/* Header */}
            <div className="bg-zinc-800/50 px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-semibold text-white">{config.title}</h3>
                        <p className="text-xs text-zinc-400">{config.description}</p>
                    </div>
                </div>
            </div>

            {/* Context */}
            <div className="px-4 sm:px-5 py-3 sm:py-4">
                <p className="text-xs sm:text-sm text-zinc-400 italic mb-3 sm:mb-4">"{exercise.context}"</p>

                {exercise.type === 'boundary_builder' && (
                    <div className="space-y-2.5 sm:space-y-3">
                        <label className="text-xs font-mono uppercase tracking-wider text-zinc-500">Your Non-Negotiables</label>
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
                                placeholder={`Boundary ${i + 1}...`}
                                className="w-full bg-zinc-800 border border-zinc-700 px-3 sm:px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 rounded-lg transition-colors"
                            />
                        ))}
                    </div>
                )}

                {exercise.type === 'needs_assessment' && (
                    <div className="space-y-4">
                        {Object.entries(needsValues).map(([need, value]) => (
                            <div key={need}>
                                <div className="flex justify-between text-xs sm:text-sm mb-2">
                                    <span className="text-zinc-300 capitalize">{need}</span>
                                    <span className="text-rose-400 font-mono">{value}%</span>
                                </div>
                                <input
                                    type="range"
                                    value={value}
                                    onChange={(e) => setNeedsValues({ ...needsValues, [need]: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-rose-500"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-zinc-800/30 border-t border-zinc-700/50 flex gap-3 justify-end">
                <button
                    onClick={onSkip}
                    className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors min-h-[44px]"
                >
                    Skip
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                >
                    Complete
                </button>
            </div>
        </div>
    );
};

// Analysis Dashboard Card
const AnalysisCard = ({
    icon: Icon,
    label,
    value,
    sublabel
}: {
    icon: any;
    label: string;
    value: string;
    sublabel?: string;
}) => (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500" />
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">{label}</span>
        </div>
        <div className="text-base sm:text-lg font-semibold text-white capitalize">{value || '—'}</div>
        {sublabel && <div className="text-xs text-zinc-500 mt-1">{sublabel}</div>}
    </div>
);

// Theme Badge
const ThemeBadge = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-full">
        {children}
    </span>
);

// Memory Item Component
const MemoryItem: React.FC<{
    memory: TherapistMemory;
    onUpdate: (id: number, content: string) => void;
    onDelete: (id: number) => void;
}> = ({ memory, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(memory.content);

    if (isEditing) {
        return (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 animate-fade-in">
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full bg-zinc-900 text-sm text-white p-2 border border-zinc-700 rounded focus:outline-none focus:border-rose-500/50 resize-none"
                    rows={3}
                />
                <div className="flex justify-end gap-3 mt-2">
                    <button onClick={() => setIsEditing(false)} className="text-xs text-zinc-500 hover:text-white py-2 min-h-[44px]">Cancel</button>
                    <button
                        onClick={() => { onUpdate(memory.id!, content); setIsEditing(false); }}
                        className="text-xs text-rose-400 hover:text-rose-300 py-2 min-h-[44px]"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 hover:border-zinc-600 transition-colors">
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pr-12">{memory.content}</p>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} className="p-1.5 hover:bg-zinc-700 rounded min-h-[30px] min-w-[30px] flex items-center justify-center">
                    <Edit3 className="w-3 h-3 text-zinc-500" />
                </button>
                <button onClick={() => memory.id && onDelete(memory.id)} className="p-1.5 hover:bg-zinc-700 rounded min-h-[30px] min-w-[30px] flex items-center justify-center">
                    <X className="w-3 h-3 text-zinc-500" />
                </button>
            </div>
            <div className="text-xs text-zinc-600 mt-2 font-mono">
                {memory.type === 'GLOBAL' ? '📌 Core Memory' : '💭 Session'}
            </div>
        </div>
    );
};

// Mobile Bottom Sheet for Analysis - Draggable
const MobileAnalysisSheet = ({
    isOpen,
    onClose,
    clinicalNotes,
    memories,
    onUpdateMemory,
    onDeleteMemory
}: {
    isOpen: boolean;
    onClose: () => void;
    clinicalNotes: ClinicalNotes;
    memories: TherapistMemory[];
    onUpdateMemory: (id: number, content: string) => void;
    onDeleteMemory: (id: number) => void;
}) => {
    const [activeTab, setActiveTab] = useState<'analysis' | 'memories'>('analysis');
    const [sheetHeight, setSheetHeight] = useState(50); // percentage
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(50);

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        startYRef.current = e.touches[0].clientY;
        startHeightRef.current = sheetHeight;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const deltaY = startYRef.current - e.touches[0].clientY;
        const deltaPercent = (deltaY / window.innerHeight) * 100;
        const newHeight = Math.min(90, Math.max(30, startHeightRef.current + deltaPercent));
        setSheetHeight(newHeight);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        // Snap to full or half
        if (sheetHeight > 70) {
            setSheetHeight(90);
        } else if (sheetHeight < 40) {
            setSheetHeight(40);
        } else {
            setSheetHeight(50);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 rounded-t-2xl z-50 flex flex-col animate-slide-up"
                style={{ height: `${sheetHeight}vh`, transition: isDragging ? 'none' : 'height 0.3s ease-out' }}
            >
                {/* Drag Handle */}
                <div
                    className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-zinc-600 rounded-full" />
                </div>

                {/* Header with Tabs */}
                <div className="px-4 pb-3 border-b border-zinc-800">
                    <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-colors min-h-[44px] ${activeTab === 'analysis'
                                ? 'bg-zinc-700 text-white'
                                : 'text-zinc-500'
                                }`}
                        >
                            Analysis
                        </button>
                        <button
                            onClick={() => setActiveTab('memories')}
                            className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-colors min-h-[44px] ${activeTab === 'memories'
                                ? 'bg-zinc-700 text-white'
                                : 'text-zinc-500'
                                }`}
                        >
                            Memories
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe">
                    {activeTab === 'analysis' ? (
                        <>
                            {/* Status Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <AnalysisCard
                                    icon={Brain}
                                    label="State"
                                    value={clinicalNotes.emotionalState || 'Listening'}
                                />
                                <AnalysisCard
                                    icon={HeartHandshake}
                                    label="Attachment"
                                    value={clinicalNotes.attachmentStyle}
                                />
                            </div>

                            {/* Key Themes */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-zinc-500" />
                                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Themes</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {clinicalNotes.keyThemes.length > 0 ? (
                                        clinicalNotes.keyThemes.map((t, i) => <ThemeBadge key={i}>{t}</ThemeBadge>)
                                    ) : (
                                        <span className="text-sm text-zinc-600 italic">Themes emerge as we talk...</span>
                                    )}
                                </div>
                            </div>

                            {/* Action Items */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-4 h-4 text-zinc-500" />
                                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Insights</span>
                                </div>
                                <div className="space-y-2">
                                    {clinicalNotes.actionItems.length > 0 ? (
                                        clinicalNotes.actionItems.map((item, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                                                <ChevronRight className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                <span>{item}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-sm text-zinc-600 italic">Insights will appear here...</span>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Core Memories */}
                            <div>
                                <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Core Memories</div>
                                <div className="space-y-2">
                                    {memories.filter(m => m.type === 'GLOBAL').length > 0 ? (
                                        memories.filter(m => m.type === 'GLOBAL').map(m => (
                                            <MemoryItem
                                                key={m.id}
                                                memory={m}
                                                onUpdate={onUpdateMemory}
                                                onDelete={onDeleteMemory}
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-zinc-600 italic">Important patterns will be saved here</p>
                                    )}
                                </div>
                            </div>

                            {/* Session Memories */}
                            <div>
                                <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Session Context</div>
                                <div className="space-y-2">
                                    {memories.filter(m => m.type === 'SESSION').length > 0 ? (
                                        memories.filter(m => m.type === 'SESSION').map(m => (
                                            <MemoryItem
                                                key={m.id}
                                                memory={m}
                                                onUpdate={onUpdateMemory}
                                                onDelete={onDeleteMemory}
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-zinc-600 italic">Context from this session...</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
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
    const [activeTab, setActiveTab] = useState<'analysis' | 'memories'>('analysis');
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [showSessionDrawer, setShowSessionDrawer] = useState(false);
    const [showMobileAnalysis, setShowMobileAnalysis] = useState(false);

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
        setMessages([]);
        setClinicalNotes(DEFAULT_NOTES);
        setInteractionId(undefined);
        localStorage.removeItem('therapist_messages');
        localStorage.removeItem('therapist_notes');
        localStorage.removeItem('therapist_interaction_id');
        if (firebaseUid) getMemories(firebaseUid, 'GLOBAL').then(setMemories);
        setTimeout(() => setMessages([{ role: 'therapist', content: WELCOME_MESSAGE.trim(), timestamp: Date.now() }]), 0);
        setShowSessionDrawer(false);
    };

    const handleLoadSession = (session: TherapistSession) => {
        setInteractionId(session.interaction_id);
        setMessages(session.messages || []);
        setClinicalNotes(session.clinical_notes || DEFAULT_NOTES);
        setShowSessionDrawer(false);
    };

    const handleSend = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isLoading) return;

        const userMsg: TherapistMessage = {
            role: 'user',
            content: trimmed,
            timestamp: Date.now(),
            images: pendingImages.length ? [...pendingImages] : undefined
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setPendingImages([]);
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

            setMessages(prev => [...prev, {
                role: 'therapist',
                content: fullResponse,
                timestamp: Date.now(),
                closureScript: insights['generate_closure_script'],
                safetyIntervention: insights['trigger_safety_intervention'],
                parentalPattern: insights['log_parental_pattern'],
                valuesMatrix: insights['assign_values_matrix'],
                ...insights
            }]);
            setInteractionId(newId || interactionId);
        } catch (e) {
            console.error(e);
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
                r.onload = () => setPendingImages(p => [...p, r.result as string]);
                r.readAsDataURL(f);
            });
        }
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
                    <div className="md:hidden fixed top-0 left-0 bottom-0 w-full bg-zinc-900 z-50 border-r border-zinc-800 flex flex-col animate-slide-up">
                        {/* Header */}
                        <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-zinc-500" />
                                <span className="text-sm font-medium text-zinc-300">Sessions</span>
                            </div>
                            <button
                                onClick={() => setShowSessionDrawer(false)}
                                className="p-2 -mr-2 text-zinc-500 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* New Session Button */}
                        <div className="p-3">
                            <button
                                onClick={handleNewSession}
                                className="w-full flex items-center justify-center gap-2 py-3.5 border border-dashed border-zinc-700 hover:border-rose-500/50 hover:bg-rose-500/5 text-zinc-400 hover:text-rose-400 transition-all rounded-xl group min-h-[48px]"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="text-sm font-medium">New Session</span>
                            </button>
                        </div>

                        {/* Session List */}
                        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-hide">
                            {sessions.length === 0 ? (
                                <div className="text-center py-8">
                                    <MessageCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                    <p className="text-sm text-zinc-600">No sessions yet</p>
                                </div>
                            ) : (
                                sessions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleLoadSession(s)}
                                        className={`w-full text-left p-3.5 rounded-xl transition-all min-h-[56px] ${s.interaction_id === interactionId
                                            ? 'bg-rose-500/10 border border-rose-500/30'
                                            : 'bg-zinc-800/30 border border-transparent hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-mono ${s.interaction_id === interactionId ? 'text-rose-400' : 'text-zinc-500'
                                                }`}>
                                                {new Date(s.created_at || Date.now()).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                            {s.interaction_id === interactionId && (
                                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-400 truncate">
                                            {s.clinical_notes?.keyThemes?.[0] || 'Session notes'}
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Back Button */}
                        <div className="p-3 border-t border-zinc-800 pb-safe">
                            <button
                                onClick={onBack}
                                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-zinc-500 hover:text-white transition-colors min-h-[48px]"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Home</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* DESKTOP LEFT SIDEBAR: SESSION HISTORY */}
            <div className="hidden md:flex flex-col w-72 border-r border-zinc-800 bg-zinc-950 z-30">
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-400">Sessions</span>
                    </div>
                </div>

                {/* New Session Button */}
                <div className="p-3">
                    <button
                        onClick={handleNewSession}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-700 hover:border-rose-500/50 hover:bg-rose-500/5 text-zinc-400 hover:text-rose-400 transition-all rounded-lg group"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">New Session</span>
                    </button>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-hide">
                    {sessions.length === 0 ? (
                        <div className="text-center py-8">
                            <MessageCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                            <p className="text-sm text-zinc-600">No sessions yet</p>
                            <p className="text-xs text-zinc-700 mt-1">Start a conversation above</p>
                        </div>
                    ) : (
                        sessions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => handleLoadSession(s)}
                                className={`w-full text-left p-3 rounded-lg transition-all group ${s.interaction_id === interactionId
                                    ? 'bg-rose-500/10 border border-rose-500/30'
                                    : 'hover:bg-zinc-800/50 border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-mono ${s.interaction_id === interactionId ? 'text-rose-400' : 'text-zinc-500'
                                        }`}>
                                        {new Date(s.created_at || Date.now()).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                    {s.interaction_id === interactionId && (
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                    )}
                                </div>
                                <p className="text-sm text-zinc-400 truncate group-hover:text-zinc-300">
                                    {s.clinical_notes?.keyThemes?.[0] || 'Session notes'}
                                </p>
                            </button>
                        ))
                    )}
                </div>

                {/* Back Button */}
                <div className="p-3 border-t border-zinc-800">
                    <button
                        onClick={onBack}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-zinc-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Home</span>
                    </button>
                </div>
            </div>

            {/* MAIN CHAT AREA */}
            <div className="flex-1 flex flex-col relative bg-matte-base">

                {/* HEADER */}
                <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-3 sm:px-4 bg-zinc-950/80 backdrop-blur-sm z-20 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setShowSessionDrawer(true)}
                            className="md:hidden p-2 -ml-1 text-zinc-500 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                            <h1 className="text-sm sm:text-base font-semibold text-white">Therapist</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Mobile Analysis Button */}
                        <button
                            onClick={() => setShowMobileAnalysis(true)}
                            className="md:hidden p-2 text-zinc-500 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <BarChart3 className="w-5 h-5" />
                        </button>

                        {/* Desktop Recording indicator */}
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/30 border border-rose-500/20 rounded-full">
                            <Activity className="w-3 h-3 text-rose-400" />
                            <span className="text-xs text-rose-400 font-mono">Active</span>
                        </div>

                        {/* Desktop Toggle Analysis Panel */}
                        <button
                            onClick={() => setShowRightPanel(!showRightPanel)}
                            className="hidden lg:flex p-2 text-zinc-500 hover:text-white transition-colors"
                        >
                            {showRightPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 scrollbar-hide">
                    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col gap-1.5 sm:gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* Timestamp */}
                                <div className="flex items-center gap-2 opacity-50">
                                    <span className="text-xs font-mono text-zinc-500">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {' · '}
                                        {msg.role === 'user' ? 'You' : 'Therapist'}
                                    </span>
                                </div>

                                {/* Message Content */}
                                <div className={`relative max-w-[95%] sm:max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>

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
                                    <div className={`inline-block px-4 sm:px-5 py-3 sm:py-4 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-rose-500/20 border border-rose-500/30 text-white'
                                        : 'bg-zinc-800/60 border border-zinc-700/50 text-zinc-200'
                                        }`}>
                                        <div className="prose prose-sm prose-invert prose-p:my-1.5 sm:prose-p:my-2 prose-headings:text-zinc-200 prose-headings:font-semibold prose-strong:text-rose-300 max-w-none text-sm sm:text-base">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>

                                {/* Inline Insights */}
                                {msg.role === 'therapist' && (
                                    <div className="w-full max-w-[95%] sm:max-w-[90%] md:max-w-[80%] space-y-1.5 sm:space-y-2">
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
                                                title="Important Notice"
                                                icon={AlertTriangle}
                                                accentColor="rose"
                                                content={<p>{msg.safetyIntervention.reason}</p>}
                                            />
                                        )}
                                        {msg.parentalPattern && (
                                            <InsightCard
                                                title="Pattern Detected"
                                                icon={Users2}
                                                accentColor="emerald"
                                                content={<p className="italic">"{msg.parentalPattern.insight}"</p>}
                                            />
                                        )}
                                        {msg.valuesMatrix && (
                                            <InsightCard
                                                title="Values Alignment"
                                                icon={Scale}
                                                accentColor="amber"
                                                content={<p>{msg.valuesMatrix.alignmentScore}% alignment</p>}
                                            />
                                        )}
                                        {(msg as any).perspective && (
                                            <InsightCard
                                                title="Their Perspective"
                                                icon={Eye}
                                                accentColor="sky"
                                                content={<p className="italic">{(msg as any).perspective.suggestedMotive}</p>}
                                            />
                                        )}
                                        {(msg as any).pattern && (
                                            <InsightCard
                                                title="Pattern Insight"
                                                icon={BookOpen}
                                                accentColor="amber"
                                                content={<p className="font-medium">{(msg as any).pattern.patternName}</p>}
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
                                    setInputValue(`[Completed: ${pendingExercise.type}] ${JSON.stringify(res)}`);
                                }}
                                onSkip={() => setPendingExercise(null)}
                            />
                        )}

                        {/* Streaming Response */}
                        {isLoading && (
                            <div className="flex flex-col gap-2 items-start animate-fade-in">
                                <div className="flex items-center gap-2 opacity-50">
                                    <span className="text-xs font-mono text-rose-400">Processing...</span>
                                </div>
                                <div className="inline-block px-4 sm:px-5 py-3 sm:py-4 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 max-w-[90%] sm:max-w-[80%]">
                                    <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                                        {streamingContent}
                                        <span className="inline-block w-2 h-4 bg-rose-500 ml-1 animate-pulse rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* INPUT AREA */}
                <div className="border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-3 sm:p-4 pb-24 sm:pb-4 md:pb-4">
                    <div className="max-w-3xl mx-auto">

                        {/* Pending Images */}
                        {pendingImages.length > 0 && (
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                {pendingImages.map((img, i) => (
                                    <div key={i} className="relative group shrink-0">
                                        <img src={img} className="h-14 sm:h-16 w-auto rounded-lg border border-zinc-700" alt="Upload" />
                                        <button
                                            onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm min-h-[30px] min-w-[30px]"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Row */}
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 focus-within:border-rose-500/50 transition-colors">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 min-h-[44px] flex items-center justify-center"
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
                                className="flex-1 bg-transparent text-white text-base sm:text-sm placeholder:text-zinc-600 focus:outline-none py-1"
                                autoComplete="off"
                            />

                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading}
                                className="p-1.5 text-zinc-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors shrink-0 min-h-[44px] flex items-center justify-center"
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

            {/* DESKTOP RIGHT SIDEBAR: ANALYSIS PANEL */}
            {showRightPanel && (
                <div className="hidden lg:flex flex-col w-80 border-l border-zinc-800 bg-zinc-950">

                    {/* Tab Switcher */}
                    <div className="h-14 flex items-center px-4 border-b border-zinc-800">
                        <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg w-full">
                            <button
                                onClick={() => setActiveTab('analysis')}
                                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'analysis'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('memories')}
                                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'memories'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                Memories
                            </button>
                        </div>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {activeTab === 'analysis' ? (
                            <>
                                {/* Status Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <AnalysisCard
                                        icon={Brain}
                                        label="State"
                                        value={clinicalNotes.emotionalState || 'Listening'}
                                    />
                                    <AnalysisCard
                                        icon={HeartHandshake}
                                        label="Attachment"
                                        value={clinicalNotes.attachmentStyle}
                                    />
                                </div>

                                {/* Key Themes */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles className="w-4 h-4 text-zinc-500" />
                                        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Themes</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {clinicalNotes.keyThemes.length > 0 ? (
                                            clinicalNotes.keyThemes.map((t, i) => <ThemeBadge key={i}>{t}</ThemeBadge>)
                                        ) : (
                                            <span className="text-sm text-zinc-600 italic">Themes emerge as we talk...</span>
                                        )}
                                    </div>
                                </div>

                                {/* Action Items */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Lightbulb className="w-4 h-4 text-zinc-500" />
                                        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Insights</span>
                                    </div>
                                    <div className="space-y-2">
                                        {clinicalNotes.actionItems.length > 0 ? (
                                            clinicalNotes.actionItems.map((item, i) => (
                                                <div key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                                                    <ChevronRight className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                    <span>{item}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-sm text-zinc-600 italic">Insights will appear here...</span>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Core Memories */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Core Memories</span>
                                    </div>
                                    <div className="space-y-2">
                                        {memories.filter(m => m.type === 'GLOBAL').length > 0 ? (
                                            memories.filter(m => m.type === 'GLOBAL').map(m => (
                                                <MemoryItem
                                                    key={m.id}
                                                    memory={m}
                                                    onUpdate={(id, c) => updateMemory(id, c, 'GLOBAL')}
                                                    onDelete={(id) => deleteMemory(id)}
                                                />
                                            ))
                                        ) : (
                                            <p className="text-sm text-zinc-600 italic">Important patterns will be saved here</p>
                                        )}
                                    </div>
                                </div>

                                {/* Session Memories */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Session Context</span>
                                    </div>
                                    <div className="space-y-2">
                                        {memories.filter(m => m.type === 'SESSION').length > 0 ? (
                                            memories.filter(m => m.type === 'SESSION').map(m => (
                                                <MemoryItem
                                                    key={m.id}
                                                    memory={m}
                                                    onUpdate={(id, c) => updateMemory(id, c, 'SESSION')}
                                                    onDelete={(id) => deleteMemory(id)}
                                                />
                                            ))
                                        ) : (
                                            <p className="text-sm text-zinc-600 italic">Context from this session...</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MOBILE ANALYSIS BOTTOM SHEET */}
            <MobileAnalysisSheet
                isOpen={showMobileAnalysis}
                onClose={() => setShowMobileAnalysis(false)}
                clinicalNotes={clinicalNotes}
                memories={memories}
                onUpdateMemory={(id, c) => updateMemory(id, c, 'GLOBAL')}
                onDeleteMemory={(id) => deleteMemory(id)}
            />
        </div>
    );
};
