import React from 'react';
import { Plus, ArrowLeft, History, MessageCircle, X } from 'lucide-react';
import { TherapistSession } from '../services/dbService';

interface TherapistSidebarProps {
    sessions: TherapistSession[];
    currentInteractionId?: string;
    onNewSession: () => void;
    onLoadSession: (session: TherapistSession) => void;
    onBack: () => void;
    onClose?: () => void;
    isMobile?: boolean;
}

export const TherapistSidebar: React.FC<TherapistSidebarProps> = ({
    sessions,
    currentInteractionId,
    onNewSession,
    onLoadSession,
    onBack,
    onClose,
    isMobile = false
}) => {
    return (
        <div className={`flex flex-col h-full ${isMobile ? 'bg-matte-base' : 'bg-matte-panel border-r border-matte-border/50'} z-30 overflow-hidden`}>
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-matte-border/30">
                <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-zinc-500" />
                    <span className="monospaced-accent">Archive</span>
                </div>
                {isMobile && (
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* New Session Button - Fluid & Organic */}
            <div className="p-4 sm:p-6">
                <button
                    onClick={onNewSession}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900/50 border border-dashed border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/5 text-zinc-500 hover:text-rose-400 transition-all rounded-organic group active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">New Analysis</span>
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-3 scrollbar-hide">
                <div className="tactical-label">Previous Logs</div>
                
                {sessions.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-zinc-900 rounded-organic">
                        <MessageCircle className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
                        <p className="text-xs monospaced-accent text-zinc-700">No logs found</p>
                    </div>
                ) : (
                    sessions.map((s, i) => {
                        const isActive = s.interaction_id === currentInteractionId;
                        return (
                            <button
                                key={i}
                                onClick={() => onLoadSession(s)}
                                className={`w-full text-left p-4 rounded-xl transition-all group relative overflow-hidden active:scale-[0.99] ${
                                    isActive
                                        ? 'bg-rose-500/10 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                                        : 'bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/40'
                                }`}
                            >
                                {isActive && (
                                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                                )}
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-[10px] font-mono tracking-widest uppercase ${
                                        isActive ? 'text-rose-400' : 'text-zinc-600'
                                    }`}>
                                        {new Date(s.created_at || Date.now()).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>
                                    {isActive && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                                    )}
                                </div>
                                <p className={`text-sm font-medium truncate ${
                                    isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'
                                }`}>
                                    {s.clinical_notes?.keyThemes?.[0] || 'Unlabeled Session'}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className={`h-1 flex-1 rounded-full ${isActive ? 'bg-rose-950' : 'bg-zinc-900'}`}>
                                        <div 
                                            className={`h-full rounded-full ${isActive ? 'bg-rose-500' : 'bg-zinc-700'}`} 
                                            style={{ width: `${Math.min(100, (s.messages?.length || 0) * 10)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-600">{s.messages?.length || 0}</span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-matte-border/30 bg-matte-panel/50 backdrop-blur-sm">
                <button
                    onClick={onBack}
                    className="w-full flex items-center justify-center gap-3 py-3 text-xs monospaced-accent text-zinc-500 hover:text-white transition-all hover:bg-zinc-900/50 rounded-xl"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Terminate Session</span>
                </button>
            </div>
        </div>
    );
};
