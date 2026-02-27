import React from 'react';
import { Brain, HeartHandshake, Sparkles, Lightbulb, ChevronRight, Bookmark, ShieldAlert, Clock, Activity, FileText, X, Edit3, MessageCircle, BarChart3 } from 'lucide-react';
import { ClinicalNotes, TherapistMemory as AdvisoryMemory } from '../types';

interface AdvisorySummaryProps {
    clinicalNotes: ClinicalNotes;
    memories: AdvisoryMemory[];
    onUpdateMemory: (id: number, content: string, type: 'GLOBAL' | 'SESSION') => void;
    onDeleteMemory: (id: number) => void;
    onClose?: () => void;
    isMobile?: boolean;
}

const ReportSection = ({ title, icon: Icon, children, color = 'text-blue-400' }: { title: string, icon: any, children: React.ReactNode, color?: string }) => (
  <div className="mb-10 last:mb-0">
    <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</span>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const StatNode = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-1.5 shadow-sm">
    <div className="flex items-center gap-2 opacity-60">
      <Icon className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-xs font-bold text-white uppercase tracking-tight">{value || 'Pending'}</div>
  </div>
);

const MemoryNode = ({ 
    memory, 
    onUpdate, 
    onDelete,
    accent = 'zinc' 
}: { 
    memory: AdvisoryMemory, 
    onUpdate: (id: number, content: string) => void, 
    onDelete: (id: number) => void,
    accent?: 'zinc' | 'emerald'
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [content, setContent] = React.useState(memory.content);

    const colors = {
        zinc: 'bg-white/5 border-white/5 text-zinc-400',
        emerald: 'bg-emerald-500/5 border-emerald-500/10 text-zinc-300'
    };

    if (isEditing) {
        return (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 animate-fade-in">
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white p-3 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 resize-none font-sans"
                    rows={3}
                />
                <div className="flex justify-end gap-4 mt-3">
                    <button onClick={() => setIsEditing(false)} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancel</button>
                    <button
                        onClick={() => { onUpdate(memory.id!, content); setIsEditing(false); }}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`group relative p-4 border rounded-2xl transition-all hover:bg-white/10 shadow-sm ${colors[accent]}`}>
            <p className="text-xs leading-relaxed pr-10 font-medium">{memory.content}</p>
            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
                    <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => memory.id && onDelete(memory.id)} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-red-400 transition-all">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

export const AdvisorySummary: React.FC<AdvisorySummaryProps> = ({
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
        <div className={`flex flex-col h-full bg-matte-base ${!isMobile && 'border-l border-white/5'} overflow-hidden font-sans select-none`}>
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Session Summary</span>
                </div>
                {isMobile && (
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-2 scrollbar-hide">
                
                {/* 1. Status */}
                <ReportSection title="Status" icon={Activity} color="text-emerald-400">
                    <div className="grid grid-cols-2 gap-4">
                        <StatNode 
                            icon={Brain} 
                            label="Emotional State" 
                            value={clinicalNotes.emotionalState || ''} 
                        />
                        <StatNode 
                            icon={HeartHandshake} 
                            label="Communication Context" 
                            value={clinicalNotes.attachmentStyle || ''} 
                        />
                    </div>
                    {clinicalNotes.relationshipDynamic && (
                        <div className="mt-4 p-5 bg-white/5 border border-white/5 rounded-3xl shadow-sm">
                            <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2 px-1">Identified Dynamic</div>
                            <p className="text-sm text-zinc-300 leading-relaxed font-medium tracking-tight">{clinicalNotes.relationshipDynamic}</p>
                        </div>
                    )}
                </ReportSection>

                {/* 2. Insights */}
                <ReportSection title="Observations" icon={Lightbulb} color="text-amber-400">
                    <div className="space-y-8">
                        {/* Themes */}
                        <div>
                            <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4 px-1">Linguistic Themes</div>
                            <div className="flex flex-wrap gap-2.5">
                                {clinicalNotes.keyThemes.length > 0 ? (
                                    clinicalNotes.keyThemes.map((theme, i) => (
                                        <div key={i} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                            {theme}
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full py-6 border border-dashed border-white/5 rounded-3xl text-center">
                                        <span className="text-xs text-zinc-600 font-medium italic">Processing data points</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Observations */}
                        <div>
                            <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4 px-1">Key Findings</div>
                            <div className="space-y-3">
                                {clinicalNotes.actionItems.length > 0 ? (
                                    clinicalNotes.actionItems.map((item, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl transition-all hover:bg-white/10">
                                            <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                            <span className="text-xs text-zinc-400 leading-relaxed font-medium tracking-tight">{item}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 border border-dashed border-white/5 rounded-3xl px-6">
                                        <p className="text-xs text-zinc-600 font-medium italic leading-relaxed">Observations will appear as the session progresses.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ReportSection>

                {/* 3. Memory */}
                <ReportSection title="History" icon={Clock} color="text-purple-400">
                    <div className="space-y-8">
                        {/* Global */}
                        {globalMemories.length > 0 && (
                            <div className="space-y-4">
                                <div className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest px-1">
                                    Long-term Patterns
                                </div>
                                <div className="space-y-3">
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

                        {/* Session */}
                        <div className="space-y-4">
                            <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">Session Context</div>
                            <div className="space-y-3">
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
                                    <div className="text-center py-10 border border-dashed border-white/5 rounded-[32px] px-8">
                                        <FileText className="w-6 h-6 text-zinc-800 mx-auto mb-4 opacity-40" />
                                        <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Awaiting session context</p>
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
