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

  const accentBorder = {
    gold: 'border-amber-400',
    blue: 'border-blue-400',
    red: 'border-red-400',
    emerald: 'border-emerald-400',
  };

  return (
    <div className="mb-8 border-l-2 border-white/10 pl-6 py-1 sticky top-0 z-40 bg-matte-base/80 backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors group p-1 -ml-1 w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Back</span>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest opacity-60">
              {mode}
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              {title}
            </h2>
          </div>
        </div>
        
        {statusLabel && statusValue && (
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl min-w-[140px]">
              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{statusLabel}</div>
              <div className={`text-xs font-bold ${statusClasses[statusColor]}`}>{statusValue}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
