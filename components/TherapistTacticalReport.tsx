import React from 'react';
import { Brain, HeartHandshake, Sparkles, Lightbulb, ChevronRight, Bookmark, ShieldAlert, History, Activity, Target, X, Edit3, MessageCircle, BarChart3 } from 'lucide-react';
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
      <Icon className="w-4 h-4 text-rose-500" />
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{title}</span>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const StatNode = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col gap-1 shadow-sm">
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-zinc-600" />
      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-sm font-bold text-zinc-200">{value || 'Analysing...'}</div>
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
        zinc: 'bg-zinc-900 border-zinc-800 text-zinc-400',
        emerald: 'bg-emerald-500/5 border-emerald-500/10 text-zinc-300'
    };

    if (isEditing) {
        return (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 animate-fade-in">
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full bg-black text-xs text-white p-2 border border-zinc-800 rounded focus:outline-none focus:border-rose-500/50 resize-none"
                    rows={3}
                />
                <div className="flex justify-end gap-3 mt-2">
                    <button onClick={() => setIsEditing(false)} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase">Cancel</button>
                    <button
                        onClick={() => { onUpdate(memory.id!, content); setIsEditing(false); }}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`group relative p-3 border rounded-xl transition-all hover:border-zinc-700 shadow-sm ${colors[accent]}`}>
            <p className="text-xs leading-relaxed pr-8">{memory.content}</p>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500">
                    <Edit3 className="w-3 h-3" />
                </button>
                <button onClick={() => memory.id && onDelete(memory.id)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-rose-400">
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
        <div className={`flex flex-col h-full bg-matte-base ${!isMobile && 'border-l border-zinc-800'} overflow-hidden`}>
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Session Summary</span>
                </div>
                {isMobile && (
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-hide">
                
                {/* 1. Status */}
                <ReportSection title="Status" icon={Activity}>
                    <div className="grid grid-cols-2 gap-3">
                        <StatNode 
                            icon={Brain} 
                            label="Emotional State" 
                            value={clinicalNotes.emotionalState || ''} 
                        />
                        <StatNode 
                            icon={HeartHandshake} 
                            label="Attachment" 
                            value={clinicalNotes.attachmentStyle || ''} 
                        />
                    </div>
                    {clinicalNotes.relationshipDynamic && (
                        <div className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Observed Dynamic</div>
                            <div className="text-xs text-zinc-300 leading-relaxed">{clinicalNotes.relationshipDynamic}</div>
                        </div>
                    )}
                </ReportSection>

                {/* 2. Insights */}
                <ReportSection title="Insights" icon={Target}>
                    <div className="space-y-6">
                        {/* Themes */}
                        <div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Recurring Themes</div>
                            <div className="flex flex-wrap gap-2">
                                {clinicalNotes.keyThemes.length > 0 ? (
                                    clinicalNotes.keyThemes.map((theme, i) => (
                                        <div key={i} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] text-zinc-400 uppercase font-medium tracking-wide">
                                            {theme}
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full py-4 border border-dashed border-zinc-800 rounded-xl text-center">
                                        <span className="text-xs text-zinc-600 italic">Waiting for more data points...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Analysis */}
                        <div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Strategic Observations</div>
                            <div className="space-y-2.5">
                                {clinicalNotes.actionItems.length > 0 ? (
                                    clinicalNotes.actionItems.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl transition-all hover:border-zinc-700">
                                            <ChevronRight className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                            <span className="text-xs text-zinc-400 leading-relaxed">{item}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                                        <p className="text-xs text-zinc-600 italic px-4">Insights will emerge as we continue our session.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ReportSection>

                {/* 3. Context */}
                <ReportSection title="Context" icon={History}>
                    <div className="space-y-6">
                        {/* Global */}
                        {globalMemories.length > 0 && (
                            <div>
                                <div className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    Core Context
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

                        {/* Session */}
                        <div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Session Details</div>
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
                                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
                                        <MessageCircle className="w-5 h-5 text-zinc-800 mx-auto mb-2 opacity-50" />
                                        <p className="text-xs text-zinc-700 italic px-4 uppercase tracking-widest font-bold">Capturing session data...</p>
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
