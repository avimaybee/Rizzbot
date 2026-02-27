import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ModuleHeaderProps {
  title: string;
  mode: string;
  onBack: () => void;
  accentColor?: 'gold' | 'blue' | 'red' | 'emerald';
  statusLabel?: string;
  statusValue?: string;
  statusColor?: 'gold' | 'blue' | 'red' | 'emerald';
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  title,
  mode,
  onBack,
  accentColor = 'blue',
  statusLabel,
  statusValue,
  statusColor = 'emerald'
}) => {
  const statusClasses = {
    gold: 'text-amber-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className="mb-8 border-b border-white/5 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {title}
            </h2>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {mode}
            </span>
          </div>
        </div>
        
        {statusLabel && statusValue && (
          <div className="hidden md:flex flex-col items-end">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{statusLabel}</div>
            <div className={`text-xs font-bold ${statusClasses[statusColor]}`}>{statusValue}</div>
          </div>
        )}
      </div>
    </div>
  );
};
