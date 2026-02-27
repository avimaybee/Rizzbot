import React from 'react';
import { Plus, MessageSquare, Clock, History, ChevronRight, X, LayoutDashboard } from 'lucide-react';
import { TherapistSession as AdvisorySession } from '../services/dbService';

interface AdvisorySidebarProps {
    sessions: AdvisorySession[];
    currentInteractionId?: string;
    onNewSession: () => void;
    onLoadSession: (session: AdvisorySession) => void;
    onBack: () => void;
    onClose?: () => void;
    isMobile?: boolean;
}

export const AdvisorySidebar: React.FC<AdvisorySidebarProps> = ({
    sessions,
    currentInteractionId,
    onNewSession,
    onLoadSession,
    onBack,
    onClose,
    isMobile = false
}) => {
    const handleAction = (action: () => void, vibration = 5) => {
        if ('vibrate' in navigator) navigator.vibrate(vibration);
        action();
    };

    return (
        <div className="flex flex-col h-full bg-black/20 font-sans select-none">
            {/* Header */}
            <div className="p-8 border-b border-white/5 shrink-0">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-zinc-500" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recent Sessions</span>
                    </div>
                    {isMobile && (
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                <button
                    onClick={() => handleAction(onNewSession, 15)}
                    className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all shadow-xl active:scale-[0.98]"
                >
                    <Plus size={18} />
                    <span>New Session</span>
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 scrollbar-hide">
                {sessions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                        <MessageSquare size={32} className="mb-4 text-zinc-600" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No previous sessions</p>
                    </div>
                ) : (
                    sessions.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => handleAction(() => onLoadSession(s), 10)}
                            className={`w-full text-left p-5 rounded-[20px] border transition-all active:scale-[0.98] group relative overflow-hidden ${
                                currentInteractionId === s.interaction_id
                                    ? 'bg-white/10 border-white/10 shadow-lg'
                                    : 'bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07]'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tabular-nums">
                                        {new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                {currentInteractionId === s.interaction_id && (
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                )}
                            </div>
                            <div className={`text-xs font-bold truncate transition-colors ${
                                currentInteractionId === s.interaction_id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                            }`}>
                                {s.messages?.[1]?.content.substring(0, 40) || 'New Perspective'}...
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 mt-auto">
                <button
                    onClick={() => handleAction(onBack, 5)}
                    className="w-full py-4 text-[10px] font-bold text-zinc-500 hover:text-white transition-all uppercase tracking-widest flex items-center justify-center gap-3"
                >
                    <LayoutDashboard size={14} />
                    <span>Back to Dashboard</span>
                </button>
            </div>
        </div>
    );
};
