import React from 'react';
import { Brain, HeartHandshake, Sparkles, Lightbulb, ChevronRight, Bookmark, ShieldAlert, History, Activity, Target, X, Edit3, MessageCircle } from 'lucide-react';
import { ClinicalNotes, TherapistMemory } from '../types';

interface TherapistTacticalReportProps {
    clinicalNotes: ClinicalNotes;
    memories: TherapistMemory[];
    onUpdateMemory: (id: number, content: string, type: 'GLOBAL' | 'SESSION') => void;
    onDeleteMemory: (id: number) => void;
    onClose?: () => void;
    isMobile?: boolean;
}

const ReportSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="mb-8 last:mb-0">
    <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
      <Icon className="w-3.5 h-3.5 text-rose-500" />
      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em]">{title}</span>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const StatNode = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
  <div className="bg-zinc-900/40 border border-zinc-800/50 p-3 rounded-xl flex flex-col gap-1 transition-all hover:border-zinc-700 group">
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-zinc-600 group-hover:text-rose-400/50 transition-colors" />
      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-xs font-bold text-white uppercase font-mono truncate">{value || 'ANALYZING'}</div>
  </div>
);

const InsightPill = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center px-2.5 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-[10px] font-mono text-zinc-400 uppercase tracking-tighter hover:border-zinc-600 transition-colors">
    {children}
  </div>
);

const MemoryNode = ({ 
    memory, 
    onUpdate, 
    onDelete,
    accent = 'zinc' 
}: { 
    memory: TherapistMemory, 
    onUpdate: (id: number, content: string) => void, 
    onDelete: (id: number) => void,
    accent?: 'zinc' | 'emerald'
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [content, setContent] = React.useState(memory.content);

    const colors = {
        zinc: 'bg-zinc-900/40 border-zinc-800/50 text-zinc-400',
        emerald: 'bg-emerald-500/5 border-emerald-500/10 text-zinc-300'
    };

    if (isEditing) {
        return (
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-3 animate-fade-in">
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white p-2 border border-zinc-800 rounded focus:outline-none focus:border-rose-500/50 resize-none"
                    rows={3}
                />
                <div className="flex justify-end gap-3 mt-2">
                    <button onClick={() => setIsEditing(false)} className="text-[10px] font-mono text-zinc-500 hover:text-white uppercase tracking-wider">CANCEL</button>
                    <button
                        onClick={() => { onUpdate(memory.id!, content); setIsEditing(false); }}
                        className="text-[10px] font-mono text-rose-400 hover:text-rose-300 uppercase tracking-wider"
                    >
                        SAVE_CHANGES
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`group relative p-3 border rounded-xl transition-all hover:border-zinc-700 ${colors[accent]}`}>
            <p className="text-xs leading-relaxed pr-8 font-sans">{memory.content}</p>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} className="p-1.5 hover:bg-zinc-800 rounded-lg">
                    <Edit3 className="w-3 h-3 text-zinc-500" />
                </button>
                <button onClick={() => memory.id && onDelete(memory.id)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-rose-400">
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

export const TherapistTacticalReport: React.FC<TherapistTacticalReportProps> = ({
    clinicalNotes,
    memories,
    onUpdateMemory,
    onDeleteMemory,
    onClose,
    isMobile = false
}) => {
    const globalMemories = memories.filter(m => m.type === 'GLOBAL');
    const sessionMemories = memories.filter(m => m.type === 'SESSION');

    return (
        <div className={`flex flex-col h-full ${isMobile ? 'bg-matte-base' : 'bg-matte-panel border-l border-matte-border/50'} z-30 overflow-hidden`}>
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-matte-border/30 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-mono font-bold text-white uppercase tracking-[0.3em]">TACTICAL_REPORT</span>
                </div>
                {isMobile && (
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-hide">
                
                {/* 1. SYSTEM STATUS */}
                <ReportSection title="SYSTEM_STATUS" icon={Activity}>
                    <div className="grid grid-cols-2 gap-3">
                        <StatNode 
                            icon={Brain} 
                            label="EMOTIONAL_STATE" 
                            value={clinicalNotes.emotionalState} 
                        />
                        <StatNode 
                            icon={HeartHandshake} 
                            label="ATTACHMENT_STYLE" 
                            value={clinicalNotes.attachmentStyle} 
                        />
                    </div>
                    {clinicalNotes.relationshipDynamic && (
                        <div className="mt-2 p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl group hover:border-rose-500/40 transition-all">
                            <div className="text-[8px] font-mono text-rose-500/70 uppercase tracking-widest mb-1 font-bold">// DYNAMIC_DETECTED</div>
                            <div className="text-xs text-zinc-200 font-medium font-sans leading-relaxed">{clinicalNotes.relationshipDynamic}</div>
                        </div>
                    )}
                </ReportSection>

                {/* 2. DETECTION LOG */}
                <ReportSection title="DETECTION_LOG" icon={Target}>
                    <div className="space-y-6">
                        {/* Themes */}
                        <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mb-3 font-bold">RECURRING_THEMES</div>
                            <div className="flex flex-wrap gap-2">
                                {clinicalNotes.keyThemes.length > 0 ? (
                                    clinicalNotes.keyThemes.map((theme, i) => (
                                        <InsightPill key={i}>{theme}</InsightPill>
                                    ))
                                ) : (
                                    <div className="w-full py-4 border border-dashed border-zinc-900 rounded-xl text-center">
                                        <span className="text-[10px] font-mono text-zinc-800 italic">WAITING_FOR_DATA_POINTS...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Insights */}
                        <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mb-3 font-bold">STRATEGIC_INSIGHTS</div>
                            <div className="space-y-2.5">
                                {clinicalNotes.actionItems.length > 0 ? (
                                    clinicalNotes.actionItems.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl group transition-all hover:border-zinc-700">
                                            <div className="mt-0.5 w-5 h-5 rounded bg-zinc-900 flex items-center justify-center shrink-0 group-hover:bg-rose-950/50 transition-colors border border-zinc-800">
                                                <ChevronRight className="w-3 h-3 text-rose-500" />
                                            </div>
                                            <span className="text-xs text-zinc-400 font-sans leading-relaxed group-hover:text-zinc-200 transition-colors">{item}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 border border-dashed border-zinc-900 rounded-xl">
                                        <p className="text-[10px] font-mono text-zinc-800 italic">Insights emerge as patterns consolidate</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ReportSection>

                {/* 3. USER_CONTEXT */}
                <ReportSection title="USER_CONTEXT" icon={History}>
                    <div className="space-y-6">
                        {/* Global Memories */}
                        {globalMemories.length > 0 && (
                            <div>
                                <div className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-3 font-bold flex items-center gap-2">
                                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                                    CORE_DOSSIER
                                </div>
                                <div className="space-y-2.5">
                                    {globalMemories.map((m) => (
                                        <MemoryNode 
                                            key={m.id} 
                                            memory={m} 
                                            accent="emerald"
                                            onUpdate={(id, c) => onUpdateMemory(id, c, 'GLOBAL')}
                                            onDelete={onDeleteMemory}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Session Memories */}
                        <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mb-3 font-bold flex items-center gap-2">
                                <div className="w-1 h-1 bg-zinc-700"></div>
                                SESSION_THREAD
                            </div>
                            <div className="space-y-2.5">
                                {sessionMemories.length > 0 ? (
                                    sessionMemories.map((m) => (
                                        <MemoryNode 
                                            key={m.id} 
                                            memory={m} 
                                            onUpdate={(id, c) => onUpdateMemory(id, c, 'SESSION')}
                                            onDelete={onDeleteMemory}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-8 border border-dashed border-zinc-900 rounded-xl">
                                        <MessageCircle className="w-5 h-5 text-zinc-800 mx-auto mb-2 opacity-50" />
                                        <p className="text-[10px] font-mono text-zinc-800 italic uppercase tracking-wider">Collecting session context...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ReportSection>
            </div>
        </div>
    );
};
