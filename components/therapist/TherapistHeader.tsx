import React from 'react';
import { ArrowLeft, HeartHandshake } from 'lucide-react';

interface TherapistHeaderProps {
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

export const TherapistHeader: React.FC<TherapistHeaderProps> = ({
  onBack,
  title = 'THERAPIST',
  subtitle = 'DEEP DIVE'
}) => {
  return (
    <header className="sticky top-0 z-40 bg-matte-base/95 backdrop-blur-sm border-b border-zinc-800/80">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] -ml-2 px-2 rounded-md hover:bg-zinc-800/50 active:bg-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wide hidden sm:block">BACK</span>
        </button>
        
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
          <div className="text-center">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h1>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:block">{subtitle}</p>
          </div>
        </div>

        <div className="w-12" /> {/* Spacer for centering */}
      </div>
    </header>
  );
};

export default TherapistHeader;
