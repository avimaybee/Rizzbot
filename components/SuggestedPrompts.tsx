import React from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';

interface SuggestedPromptsProps {
    prompts: string[];
    onSelect: (prompt: string) => void;
    isVisible: boolean;
}

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({
    prompts,
    onSelect,
    isVisible
}) => {
    if (!isVisible || prompts.length === 0) return null;

    return (
        <div className="w-full py-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles className="w-3 h-3 text-rose-500 animate-pulse" />
                <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">Suggested_Continuations</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {prompts.map((prompt, i) => (
                    <button
                        key={i}
                        onClick={() => onSelect(prompt)}
                        className="group flex items-center gap-2 px-4 py-2.5 bg-zinc-900/40 border border-zinc-800/50 hover:border-rose-500/30 hover:bg-rose-500/5 rounded-organic transition-all text-xs text-zinc-400 hover:text-rose-300 active:scale-[0.98]"
                    >
                        <span className="font-medium leading-tight">{prompt}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-y-0.5" />
                    </button>
                ))}
            </div>
        </div>
    );
};
