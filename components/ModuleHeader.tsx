import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ModuleHeaderProps {
  title: string;
  mode: string;
  id?: string | number;
  onBack: () => void;
  accentColor?: 'gold' | 'blue' | 'red' | 'emerald';
  statusLabel?: string;
  statusValue?: string;
  statusColor?: 'gold' | 'blue' | 'red' | 'emerald';
  lastAnalyzed?: string;
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  title,
  mode,
  id,
  onBack,
  accentColor = 'gold',
  statusLabel = 'STATUS',
  statusValue = 'ACTIVE',
  statusColor = 'emerald',
  lastAnalyzed
}) => {
  const accentClasses = {
    gold: 'border-hard-gold text-hard-gold',
    blue: 'border-hard-blue text-hard-blue',
    red: 'border-hard-red text-hard-red',
    emerald: 'border-emerald-400 text-emerald-400',
  };

  const statusClasses = {
    gold: 'text-hard-gold',
    blue: 'text-hard-blue',
    red: 'text-hard-red',
    emerald: 'text-emerald-400',
  };

  const accentBorder = {
    gold: 'border-hard-gold',
    blue: 'border-hard-blue',
    red: 'border-hard-red',
    emerald: 'border-emerald-400',
  };

  return (
    <div className={`mb-4 sm:mb-8 border-l-4 ${accentBorder[accentColor]} pl-4 py-2 bg-zinc-900/50 sticky top-0 z-40 backdrop-blur-sm`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-1 -ml-1 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-white transition-colors">BACK</span>
          </button>
          <div>
            <div className={`label-sm ${statusClasses[accentColor]} flex items-center gap-2`}>
              <span className={`w-1.5 h-1.5 ${accentColor === 'gold' ? 'bg-hard-gold' : accentColor === 'blue' ? 'bg-hard-blue' : accentColor === 'red' ? 'bg-hard-red' : 'bg-emerald-400'} animate-pulse`}></span>
              {mode} {id ? `// ID: ${id}` : ''}
            </div>
            <h2 className="text-xl sm:text-3xl font-impact text-white uppercase tracking-tight mt-1">
              {title}
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-right">
          {lastAnalyzed && (
            <div className="hidden md:block">
              <div className="label-sm text-zinc-500 text-right uppercase">LAST_ANALYZED</div>
              <div className="text-[10px] font-mono text-zinc-400">{lastAnalyzed}</div>
            </div>
          )}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-800 border border-zinc-700 text-left min-w-[120px]">
            <div className="label-sm text-zinc-500 uppercase">{statusLabel}</div>
            <div className={`text-[10px] font-mono ${statusClasses[statusColor]}`}>{statusValue}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
