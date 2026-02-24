import React from 'react';

interface VibeCheckCardProps {
  theirEnergy?: string;
  interestLevel?: number;
  ghostRisk?: string;
  recommendedAction?: string;
}

export const VibeCheckCard: React.FC<VibeCheckCardProps> = ({
  theirEnergy,
  interestLevel,
  ghostRisk,
  recommendedAction
}) => {
  const energyColors: Record<string, string> = {
    hot: 'text-red-500 bg-red-500/10 border-red-500/30',
    warm: 'text-hard-gold bg-hard-gold/10 border-hard-gold/30',
    cold: 'text-hard-blue bg-hard-blue/10 border-hard-blue/30',
    mixed: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  };

  const actionColors: Record<string, string> = {
    SEND: 'bg-white text-black',
    WAIT: 'bg-hard-gold text-black',
    PULL_BACK: 'bg-zinc-700 text-white',
    ABORT: 'bg-red-600 text-white',
    MATCH: 'bg-hard-blue text-white',
    CALL: 'bg-purple-600 text-white',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
      <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">VIBE CHECK</div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Energy */}
        {theirEnergy && (
          <div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Their Energy</div>
            <div className={`
              inline-block px-3 py-1.5 rounded text-sm font-bold uppercase
              ${energyColors[theirEnergy] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}
            `}>
              {theirEnergy}
            </div>
          </div>
        )}

        {/* Interest Level */}
        {interestLevel !== undefined && (
          <div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Interest Level</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 via-hard-gold to-emerald-500"
                  style={{ width: `${interestLevel}%` }}
                />
              </div>
              <span className="text-sm font-bold text-white">{interestLevel}%</span>
            </div>
          </div>
        )}

        {/* Ghost Risk */}
        {ghostRisk && (
          <div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Ghost Risk</div>
            <div className="text-sm font-bold text-white">{ghostRisk}</div>
          </div>
        )}

        {/* Recommended Action */}
        {recommendedAction && (
          <div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Recommended</div>
            <div className={`
              inline-block px-3 py-1.5 rounded text-sm font-bold uppercase
              ${actionColors[recommendedAction] || 'bg-zinc-800 text-white'}
            `}>
              {recommendedAction.replace(/_/g, ' ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VibeCheckCard;
