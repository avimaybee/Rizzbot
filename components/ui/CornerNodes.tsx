import React from 'react';

interface CornerNodesProps {
  className?: string;
  variant?: 'default' | 'gold' | 'blue' | 'rose' | 'purple' | 'subtle';
  showPlus?: boolean;
}

const variantColors = {
  default: 'border-zinc-500 text-zinc-600',
  gold: 'border-hard-gold/60 text-hard-gold/60',
  blue: 'border-hard-blue/60 text-hard-blue/60',
  rose: 'border-rose-500/60 text-rose-500/60',
  purple: 'border-hard-purple/60 text-hard-purple/60',
  subtle: 'border-zinc-700 text-zinc-700',
};

export const CornerNodes: React.FC<CornerNodesProps> = ({ 
  className = '', 
  variant = 'default',
  showPlus = true 
}) => {
  const colors = variantColors[variant];
  
  return (
    <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
      {/* Top Left */}
      <div className="absolute top-0 left-0">
        <div className={`w-2 h-2 border-t border-l ${colors}`}></div>
        {showPlus && (
          <div className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-[8px] ${colors}`}>
            +
          </div>
        )}
      </div>
      {/* Top Right */}
      <div className="absolute top-0 right-0">
        <div className={`w-2 h-2 border-t border-r ${colors}`}></div>
        {showPlus && (
          <div className={`absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-[8px] ${colors}`}>
            +
          </div>
        )}
      </div>
      {/* Bottom Left */}
      <div className="absolute bottom-0 left-0">
        <div className={`w-2 h-2 border-b border-l ${colors}`}></div>
        {showPlus && (
          <div className={`absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-[8px] ${colors}`}>
            +
          </div>
        )}
      </div>
      {/* Bottom Right */}
      <div className="absolute bottom-0 right-0">
        <div className={`w-2 h-2 border-b border-r ${colors}`}></div>
        {showPlus && (
          <div className={`absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-[8px] ${colors}`}>
            +
          </div>
        )}
      </div>
    </div>
  );
};

export default CornerNodes;
