import React from 'react';
import { ArrowUpRight } from 'lucide-react';

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
        <div className="w-full py-6 animate-fade-in">
            <div className="flex flex-wrap gap-3">
                {prompts.map((prompt, i) => (
                    <button
                        key={i}
                        onClick={() => onSelect(prompt)}
                        className="group flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-rose-500/30 hover:bg-rose-500/5 rounded-xl transition-all text-sm text-zinc-400 hover:text-zinc-200 active:scale-[0.98] shadow-sm"
                    >
                        <span className="font-medium">{prompt}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all text-rose-400" />
                    </button>
                ))}
            </div>
        </div>
    );
};
