import React from 'react';
import { Brain, HeartHandshake, Sparkles, Lightbulb, ChevronRight, Bookmark, ShieldAlert, History, Activity, Target } from 'lucide-react';
import { ClinicalNotes, TherapistMemory } from '../types';

interface TherapistInsightsProps {
  clinicalNotes: ClinicalNotes;
  memories: TherapistMemory[];
  onUpdateMemory?: (id: number, content: string) => void;
  onDeleteMemory?: (id: number) => void;
  className?: string;
}

const ReportSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="mb-6 last:mb-0">
    <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
      <Icon className="w-3.5 h-3.5 text-rose-500" />
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</span>
    </div>
    <div className="space-y-3">
      {children}
    </div>
  </div>
);

const StatNode = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
  <div className="bg-zinc-900/40 border border-zinc-800/50 p-3 rounded-xl flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-zinc-600" />
      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-xs font-bold text-white uppercase truncate">{value || 'N/A'}</div>
  </div>
);

const InsightPill = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-[10px] text-zinc-400 uppercase tracking-tight">
    {children}
  </div>
);

export const TherapistInsights: React.FC<TherapistInsightsProps> = ({ 
  clinicalNotes, 
  memories, 
  onUpdateMemory, 
  onDeleteMemory,
  className 
}) => {
  const globalMemories = memories.filter(m => m.type === 'GLOBAL');
  const sessionMemories = memories.filter(m => m.type === 'SESSION');

  return (
    <div className={`flex flex-col h-full bg-matte-base p-4 sm:p-6 overflow-y-auto scrollbar-hide ${className}`}>
      {/* 1. SESSION STATUS */}
      <ReportSection title="Session Status" icon={Activity}>
        <div className="grid grid-cols-2 gap-3">
          <StatNode 
            icon={Brain} 
            label="Mental State" 
            value={clinicalNotes.emotionalState || 'Analyzing'} 
          />
          <StatNode 
            icon={HeartHandshake} 
            label="Attachment" 
            value={clinicalNotes.attachmentStyle || 'Unknown'} 
          />
        </div>
        {clinicalNotes.relationshipDynamic && (
          <div className="mt-2 p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
            <div className="text-[8px] font-bold text-rose-500/70 uppercase tracking-widest mb-1">Dynamic Detected</div>
            <div className="text-xs text-white font-medium">{clinicalNotes.relationshipDynamic}</div>
          </div>
        )}
      </ReportSection>

      {/* 2. ANALYSIS LOG */}
      <ReportSection title="Analysis Log" icon={Target}>
        <div className="space-y-4">
          {/* Themes */}
          <div>
            <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Recurring Themes</div>
            <div className="flex flex-wrap gap-2">
              {clinicalNotes.keyThemes.length > 0 ? (
                clinicalNotes.keyThemes.map((theme, i) => (
                  <InsightPill key={i}>{theme}</InsightPill>
                ))
              ) : (
                <span className="text-[10px] text-zinc-700 italic font-medium">Gathering data points...</span>
              )}
            </div>
          </div>

          {/* Action Items / Insights */}
          <div>
            <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Strategic Insights</div>
            <div className="space-y-2">
              {clinicalNotes.actionItems.length > 0 ? (
                clinicalNotes.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-xl group transition-all hover:border-zinc-700">
                    <ChevronRight className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-zinc-400 font-sans leading-relaxed group-hover:text-zinc-200">{item}</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-zinc-700 italic p-2 border border-dashed border-zinc-800 rounded-lg font-medium">
                  Insights will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      </ReportSection>

      {/* 3. USER CONTEXT (Memories) */}
      <ReportSection title="Contextual Data" icon={History}>
        <div className="space-y-4">
          {/* Global Memories */}
          {globalMemories.length > 0 && (
            <div>
              <div className="text-[8px] font-bold text-emerald-500/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                Core Patterns
              </div>
              <div className="space-y-2">
                {globalMemories.map((m, i) => (
                  <div key={i} className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-zinc-300 font-sans leading-relaxed">
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Memories */}
          <div>
            <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-2">
              <div className="w-1 h-1 bg-zinc-700"></div>
              Session Context
            </div>
            <div className="space-y-2">
              {sessionMemories.length > 0 ? (
                sessionMemories.map((m, i) => (
                  <div key={i} className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl text-xs text-zinc-400 font-sans leading-relaxed">
                    {m.content}
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-zinc-700 italic font-medium">No session context recorded</div>
              )}
            </div>
          </div>
        </div>
      </ReportSection>
    </div>
  );
};
