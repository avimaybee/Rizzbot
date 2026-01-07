import React, { useState, useRef, useEffect } from 'react';
import { Plus, Send, ArrowLeft, HeartHandshake, Loader2, ImagePlus, X, Edit3, ChevronRight, ChevronLeft, Target, Heart, Users, Sparkles, Eye, BookOpen, ShieldAlert, History, PanelRight, PanelRightClose, Activity, Terminal } from 'lucide-react';
import { streamTherapistAdvice } from '../services/geminiService';
import { saveTherapistSession, getTherapistSession, getTherapistSessions, TherapistSession, getMemories, saveMemory, deleteMemory, updateMemory, TherapistMemory } from '../services/dbService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Logo } from './Logo';
import { TherapistMessage, ClinicalNotes, TherapistExercise, ExerciseType, Epiphany, PerspectiveInsight, PatternInsight, ProjectionInsight, ClosureScript, SafetyIntervention, ParentalPatternV2, ValuesMatrix } from '../types';
import { Clipboard, Shield, AlertTriangle, Users2, Scale } from 'lucide-react';

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
### SYSTEM READY. SESSION INITIALIZED.

I am your relationship therapist agent. My directive is to analyze your connections, detect patterns, and optimize your relational clarity.

**OPERATIONAL CAPABILITIES:**
- **VENTING & PROCESSING**: Unfiltered input stream accepted.
- **PATTERN RECOGNITION**: Detection of recurring behavioral loops.
- **TACTICAL TOOLS**: Assignment of communication scripts and exercises.

**SYSTEM FEATURES:**
- **MEMORY**: Seasonal and global context retention.
- **INSIGHTS**: Real-time analysis of attachment style and themes.
- **EXERCISES**: Targeted behavioral modifications.

Input your status report or query to begin.
`;

// --- MOLECULES & ATOMS (RE-STYLED COMPACT) ---

const SectionHeader = ({ icon: Icon, title, right }: { icon?: any, title: string, right?: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2 border-b border-zinc-900 mb-2 select-none">
        <div className="flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3 text-zinc-600" />}
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] font-display">{title}</span>
        </div>
        {right}
    </div>
);

const Badge = ({ children, color = 'zinc' }: { children: React.ReactNode, color?: 'zinc' | 'emerald' | 'rose' | 'amber' }) => {
    const colors = {
        zinc: 'bg-zinc-900 text-zinc-400 border-zinc-800',
        emerald: 'bg-emerald-950/30 text-emerald-500 border-emerald-900/50',
        rose: 'bg-rose-950/30 text-rose-500 border-rose-900/50',
        amber: 'bg-amber-950/30 text-amber-500 border-amber-900/50',
    };
    return (
        <span className={`px-1.5 py-0.5 text-[9px] uppercase font-mono border rounded-sm ${colors[color]}`}>
            {children}
        </span>
    );
};

// Exercise Card Component (Compact)
const ExerciseCard: React.FC<{ exercise: TherapistExercise; onComplete: (result: any) => void; onSkip: () => void; }> = ({ exercise, onComplete, onSkip }) => {
    const [boundaryInputs, setBoundaryInputs] = useState<string[]>(['', '', '']);
    const [needsValues, setNeedsValues] = useState({ safety: 50, connection: 50, autonomy: 50 });
    const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

    const exerciseConfig: Record<string, any> = {
        boundary_builder: { icon: Target, title: 'Protocol: Boundaries', color: 'rose' },
        needs_assessment: { icon: Heart, title: 'Protocol: Needs', color: 'zinc' },
        attachment_quiz: { icon: Users, title: 'Protocol: Attachment', color: 'emerald' }
    };

    const config = exerciseConfig[exercise.type] || exerciseConfig.boundary_builder;
    const Icon = config.icon;

    const handleSubmit = () => {
        let result;
        if (exercise.type === 'boundary_builder') result = { boundaries: boundaryInputs.filter(b => b.trim()) };
        else if (exercise.type === 'needs_assessment') result = needsValues;
        else if (exercise.type === 'attachment_quiz') result = { answers: quizAnswers };
        onComplete(result);
    };

    return (
        <div className="w-full max-w-xl my-2 border border-zinc-800 bg-zinc-950/50 p-3 font-mono animate-fade-in rounded-sm">
            <div className="flex items-center gap-2 mb-2 border-b border-zinc-900 pb-2">
                <div className={`p-1 bg-zinc-900 border border-zinc-800`}>
                    <Icon className="w-3 h-3 text-zinc-400" />
                </div>
                <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">{config.title}</h3>
            </div>

            <p className="text-[10px] text-zinc-500 mb-4 font-italic">"{exercise.context}"</p>

            {exercise.type === 'boundary_builder' && (
                <div className="space-y-1.5 mb-3">
                    <p className="text-[9px] text-zinc-600 uppercase">Input Non-Negotiables:</p>
                    {boundaryInputs.map((input, i) => (
                        <input key={i} type="text" value={input} onChange={(e) => {
                            const newInputs = [...boundaryInputs]; newInputs[i] = e.target.value; setBoundaryInputs(newInputs);
                        }} placeholder={`NON-NEGOTIABLE ${i + 1}...`} className="w-full bg-black border border-zinc-800 px-2 py-1.5 text-[10px] text-emerald-500 placeholder:text-zinc-800 focus:outline-none focus:border-emerald-900" />
                    ))}
                </div>
            )}

            {exercise.type === 'needs_assessment' && (
                <div className="space-y-3 mb-3">
                    {Object.entries(needsValues).map(([need, value]) => (
                        <div key={need} className="space-y-0.5">
                            <div className="flex justify-between text-[9px] uppercase text-zinc-500">
                                <span>{need}</span>
                                <span className="text-emerald-500 font-bold">{value}%</span>
                            </div>
                            <input type="range" value={value} onChange={(e) => setNeedsValues({ ...needsValues, [need]: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-900 appearance-none cursor-crosshair accent-emerald-500" />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button onClick={onSkip} className="px-3 py-1.5 border border-zinc-800 text-[9px] text-zinc-500 uppercase hover:bg-zinc-900 transition-colors">Skip</button>
                <button onClick={handleSubmit} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-[9px] text-emerald-500 font-bold uppercase hover:bg-zinc-800 hover:border-emerald-900 transition-colors">Submit</button>
            </div>
        </div>
    );
};

// Generic Insight Card (Compact)
const InsightBlock = ({ title, icon: Icon, children, accent = 'zinc' }: { title: string, icon: any, children: React.ReactNode, accent?: 'zinc' | 'rose' | 'emerald' | 'amber' }) => {
    const accents = {
        zinc: 'border-l-zinc-700',
        rose: 'border-l-rose-900',
        emerald: 'border-l-emerald-900',
        amber: 'border-l-amber-900',
    };
    return (
        <div className={`pl-3 border-l ${accents[accent]} my-2 py-0.5 animate-fade-in`}>
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-zinc-600" />
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{title}</span>
            </div>
            {children}
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
    const [activeTab, setActiveTab] = useState<'notes' | 'memories'>('notes');

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
    };

    const handleLoadSession = (session: TherapistSession) => {
        setInteractionId(session.interaction_id);
        setMessages(session.messages || []);
        setClinicalNotes(session.clinical_notes || DEFAULT_NOTES);
    };

    const handleSend = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isLoading) return;

        const userMsg: TherapistMessage = { role: 'user', content: trimmed, timestamp: Date.now(), images: pendingImages.length ? [...pendingImages] : undefined };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setPendingImages([]);
        setIsLoading(true);
        setStreamingContent('');

        // Mock Insights Holder
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
                        saveMemory(firebaseUid, args.type, args.content, interactionId).then(m => {
                            setMemories(prev => [{ type: args.type, content: args.content, created_at: new Date().toISOString() }, ...prev]);
                        });
                    }
                    insights[name] = args;
                },
                memories
            );

            // Finalize message
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
            setMessages(prev => [...prev, { role: 'therapist', content: "SYSTEM ERROR. RE-SYNCING...", timestamp: Date.now() }]);
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

    // --- RENDER ---
    return (
        <div className="flex h-[100dvh] w-full bg-[#050505] text-zinc-300 font-mono overflow-hidden selection:bg-emerald-900 selection:text-emerald-50">

            {/* LEFT SIDEBAR: SESSION LOG (COMPACT: w-64) */}
            <div className="hidden md:flex flex-col w-64 border-r border-zinc-900 bg-[#050505] relative z-20">
                <div className="h-10 flex items-center px-3 border-b border-zinc-900 bg-zinc-950/30">
                    <History className="w-3 h-3 text-zinc-600 mr-2" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-display">Session Log</span>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 scrollbar-hide space-y-0.5">
                    <button onClick={handleNewSession} className="w-full py-2 mb-2 border border-dashed border-zinc-800 text-[9px] text-zinc-500 hover:text-emerald-500 hover:border-emerald-900 hover:bg-emerald-950/10 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <Plus className="w-2.5 h-2.5" /> Initialize New
                    </button>

                    {sessions.map((s, i) => (
                        <button key={i} onClick={() => handleLoadSession(s)} className={`w-full text-left p-2 border-l-2 transition-all group ${s.interaction_id === interactionId ? 'border-emerald-500 bg-zinc-900' : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900/50'}`}>
                            <div className="flex justify-between items-center mb-0.5">
                                <span className={`text-[9px] uppercase font-bold ${s.interaction_id === interactionId ? 'text-emerald-500' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
                                    {new Date(s.created_at || Date.now()).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                                </span>
                                {s.interaction_id === interactionId && <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />}
                            </div>
                            <p className="text-[9px] text-zinc-600 truncate font-mono">
                                {s.clinical_notes?.keyThemes?.[0] || 'Unlogged Session'}
                            </p>
                        </button>
                    ))}
                </div>

                <div className="p-2 border-t border-zinc-900">
                    <button onClick={onBack} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[9px] uppercase text-zinc-600 hover:text-zinc-200 transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Return to Base
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT: CHAT */}
            <div className="flex-1 flex flex-col relative w-full bg-[#050505]">
                {/* HEADER (COMPACT: h-10) */}
                <div className="h-10 border-b border-zinc-900 flex items-center justify-between px-4 bg-[#050505] z-10 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-sm animate-pulse" />
                        <div>
                            <h1 className="text-sm font-display font-bold text-zinc-100 uppercase tracking-tighter leading-none">Therapist // Mode</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-1.5 px-1.5 py-0.5 bg-rose-950/20 border border-rose-900/30 rounded-sm">
                            <Activity className="w-2.5 h-2.5 text-rose-500" />
                            <span className="text-[9px] text-rose-400 font-mono uppercase">Recording</span>
                        </div>
                    </div>
                </div>

                {/* MESSAGES (COMPACT PADDING) */}
                <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 scrollbar-hide">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col gap-1 max-w-3xl mx-auto animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 opacity-40">
                                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                                    [{new Date(msg.timestamp).toLocaleTimeString([], { hour12: false })}] // {msg.role}
                                </span>
                            </div>

                            <div className={`relative max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                {msg.images && (
                                    <div className="flex gap-2 mb-2 justify-end">
                                        {msg.images.map((img, i) => <img key={i} src={img} className="h-16 w-auto border border-zinc-800 grayscale hover:grayscale-0 transition-all rounded-sm" />)}
                                    </div>
                                )}

                                <div className={`prose prose-invert prose-p:text-xs prose-p:font-mono prose-p:leading-relaxed prose-headings:font-display prose-headings:uppercase prose-headings:text-zinc-500 prose-strong:text-emerald-500 ${msg.role === 'user' ? 'text-zinc-100' : 'text-zinc-400'}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                            </div>

                            {/* RENDER INSIGHTS IN-STREAM (Compact Blocks) */}
                            <div className="w-full max-w-xl mt-1 space-y-1">
                                {msg.closureScript && <InsightBlock title="Script Gen" icon={Clipboard} accent="zinc"><div className="text-[10px] text-zinc-300 whitespace-pre-wrap">{msg.closureScript.script}</div></InsightBlock>}
                                {msg.safetyIntervention && <InsightBlock title="Safety Alert" icon={AlertTriangle} accent="rose"><div className="text-[10px] text-rose-300">{msg.safetyIntervention.reason}</div></InsightBlock>}
                                {msg.parentalPattern && <InsightBlock title="Pattern Detect" icon={Users2} accent="emerald"><div className="text-[10px] text-emerald-400 italic">"{msg.parentalPattern.insight}"</div></InsightBlock>}
                                {msg.valuesMatrix && <InsightBlock title="Align Matrix" icon={Scale} accent="amber"><div className="text-[10px] text-amber-400">{msg.valuesMatrix.alignmentScore}% Synergies</div></InsightBlock>}

                                {/* Generic Insights */}
                                {(msg as any).perspective && <InsightBlock title="Bridge" icon={Eye} accent="zinc"><div className="text-[10px] text-zinc-400 italic">{(msg as any).perspective.suggestedMotive}</div></InsightBlock>}
                                {(msg as any).pattern && <InsightBlock title="Masterclass" icon={BookOpen} accent="amber"><div className="text-[10px] text-amber-400 font-bold">{(msg as any).pattern.patternName}</div></InsightBlock>}
                                {(msg as any).projection && <InsightBlock title="Shadow" icon={ShieldAlert} accent="rose"><div className="text-[10px] text-rose-400 italic">Potential Projection of {(msg as any).projection.potentialRoot}</div></InsightBlock>}
                            </div>
                        </div>
                    ))}

                    {pendingExercise && !pendingExercise.completed && (
                        <div className="flex justify-center">
                            <ExerciseCard exercise={pendingExercise} onComplete={(res) => {
                                setPendingExercise({ ...pendingExercise, completed: true });
                                setInputValue(`[PROTOCOL COMPLETE: ${pendingExercise.type}] RESULTS: ${JSON.stringify(res)}`);
                            }} onSkip={() => setPendingExercise(null)} />
                        </div>
                    )}

                    {isLoading && (
                        <div className="max-w-3xl mx-auto w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-mono text-emerald-500 animate-pulse uppercase tracking-widest">/// ANALYSIS IN PROGRESS ///</span>
                            </div>
                            <div className="text-xs font-mono text-zinc-500 whitespace-pre-wrap leading-relaxed blur-[0.5px]">
                                {streamingContent}<span className="inline-block w-1.5 h-3 bg-emerald-500 ml-1 animate-pulse" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT AREA: TERMINAL (COMPACT) */}
                <div className="w-full bg-[#050505] p-3 md:p-4 border-t border-zinc-900 z-20 mb-[4.5rem] md:mb-0 shrink-0">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col gap-1.5">
                            {pendingImages.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1.5">
                                    {pendingImages.map((img, i) => (
                                        <div key={i} className="relative group">
                                            <img src={img} className="h-10 w-auto border border-zinc-700 opacity-60 group-hover:opacity-100 rounded-sm" />
                                            <button onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-3 h-3 flex items-center justify-center text-[8px] rounded-sm">X</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2 items-end">
                                <span className="text-emerald-500 font-bold font-mono text-sm pb-0.5">{'>'}</span>
                                <div className="flex-1 relative">
                                    <input
                                        ref={inputRef}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={isLoading}
                                        placeholder="ENTER COMMAND OR MESSAGE..."
                                        className="term-input animate-cursor w-full bg-transparent border-none text-zinc-100 text-xs font-mono focus:ring-0 placeholder:text-zinc-800"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors"><ImagePlus className="w-3.5 h-3.5" /></button>
                                    <button onClick={handleSend} disabled={!inputValue.trim()} className="p-1.5 text-zinc-600 hover:text-emerald-500 transition-colors disabled:opacity-30"><Send className="w-3.5 h-3.5" /></button>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={(e) => {
                                    if (e.target.files?.length) {
                                        Array.from(e.target.files).forEach(f => {
                                            const r = new FileReader();
                                            r.onload = () => setPendingImages(p => [...p, r.result as string]);
                                            r.readAsDataURL(f);
                                        });
                                    }
                                }} className="hidden" multiple accept="image/*" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR: CLINICAL OBSERVER (COMPACT: w-72, lg:flex) */}
            <div className="hidden lg:flex flex-col w-72 border-l border-zinc-900 bg-[#050505] relative z-20">
                <div className="flex items-center px-3 h-10 border-b border-zinc-900 bg-zinc-950/30">
                    <div className="flex gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-sm w-full">
                        <button onClick={() => setActiveTab('notes')} className={`flex-1 text-[9px] uppercase font-bold py-0.5 ${activeTab === 'notes' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>Analysis</button>
                        <button onClick={() => setActiveTab('memories')} className={`flex-1 text-[9px] uppercase font-bold py-0.5 ${activeTab === 'memories' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>Memory</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 scrollbar-hide space-y-4">
                    {activeTab === 'notes' ? (
                        <>
                            {/* HUD STATS (COMPACT) */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-sm">
                                    <div className="text-[9px] text-zinc-500 uppercase flex items-center gap-1 mb-0.5"><Target className="w-2.5 h-2.5" /> State</div>
                                    <div className="text-[10px] text-zinc-200 font-mono capitalize truncate">{clinicalNotes.emotionalState || '---'}</div>
                                </div>
                                <div className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-sm">
                                    <div className="text-[9px] text-zinc-500 uppercase flex items-center gap-1 mb-0.5"><HeartHandshake className="w-2.5 h-2.5" /> Attach</div>
                                    <div className="text-[10px] text-zinc-200 font-mono capitalize truncate">{clinicalNotes.attachmentStyle}</div>
                                </div>
                            </div>

                            {/* THEMES */}
                            <div>
                                <SectionHeader title="Themes" icon={Sparkles} />
                                <div className="flex flex-wrap gap-1">
                                    {clinicalNotes.keyThemes.length ? clinicalNotes.keyThemes.map((t, i) => <Badge key={i}>{t}</Badge>) : <span className="text-[9px] text-zinc-700 italic">No patterns...</span>}
                                </div>
                            </div>

                            {/* DIRECTIVES */}
                            <div>
                                <SectionHeader title="Directives" icon={Shield} />
                                <ul className="space-y-1.5">
                                    {clinicalNotes.actionItems.length ? clinicalNotes.actionItems.map((item, i) => (
                                        <li key={i} className="text-[10px] text-zinc-400 font-mono pl-2 border-l border-emerald-900/50 flex gap-1.5">
                                            <span className="text-emerald-900 font-bold">::</span> {item}
                                        </li>
                                    )) : <span className="text-[9px] text-zinc-700 italic">Awaiting protocol...</span>}
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <SectionHeader title="Core Memories" icon={Terminal} />
                                <div className="space-y-1.5">
                                    {memories.filter(m => m.type === 'GLOBAL').map(m => (
                                        <MemoryItem key={m.id} memory={m} onUpdate={(id, c) => updateMemory(id, c, 'GLOBAL')} onDelete={(id) => deleteMemory(id)} className="text-[10px] bg-zinc-900/30 p-2 border border-zinc-900" />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <SectionHeader title="Session Context" icon={History} />
                                <div className="space-y-1.5">
                                    {memories.filter(m => m.type === 'SESSION').map(m => (
                                        <MemoryItem key={m.id} memory={m} onUpdate={(id, c) => updateMemory(id, c, 'SESSION')} onDelete={(id) => deleteMemory(id)} className="text-[10px] bg-zinc-900/30 p-2 border border-zinc-900" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Memory Item Helper for Compact Mode
const MemoryItem: React.FC<{ memory: TherapistMemory; onUpdate: (id: number, c: string) => void; onDelete: (id: number) => void; className?: string }> = ({ memory, onUpdate, onDelete, className }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(memory.content);

    if (isEditing) return (
        <div className="space-y-1 p-2 bg-zinc-950 border border-zinc-800 animate-fade-in">
            <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full bg-black text-[10px] text-white p-1 border border-zinc-800 focus:outline-none scrollbar-hide" rows={2} />
            <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="text-[9px] text-zinc-600">CANCEL</button>
                <button onClick={() => { onUpdate(memory.id!, content); setIsEditing(false); }} className="text-[9px] text-emerald-500">SAVE</button>
            </div>
        </div>
    );

    return (
        <div className={`group relative ${className || 'p-2'}`}>
            <p className="text-[10px] text-zinc-400 leading-snug">{memory.content}</p>
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                <button onClick={() => setIsEditing(true)}><Edit3 className="w-2.5 h-2.5 text-zinc-500 hover:text-white" /></button>
                <button onClick={() => memory.id && onDelete(memory.id)}><X className="w-2.5 h-2.5 text-zinc-500 hover:text-white" /></button>
            </div>
        </div>
    );
};
