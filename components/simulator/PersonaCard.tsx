import React from 'react';
import { Persona } from '../../types';
import { CornerNodes } from '../ui/CornerNodes';

interface PersonaCardProps {
  persona: Persona;
  onSelect?: () => void;
  onDelete?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  onSelect,
  onDelete,
  selected = false,
  compact = false
}) => {
  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`
          w-full p-3 border relative text-left transition-all
          ${selected 
            ? 'border-hard-blue bg-hard-blue/10' 
            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }
        `}
      >
        <CornerNodes className="opacity-30" />
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
            ${selected ? 'bg-hard-blue text-white' : 'bg-zinc-800 text-zinc-400'}
          `}>
            {persona.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{persona.name}</div>
            <div className="text-xs text-zinc-500 truncate">{persona.description}</div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={`
      border relative group overflow-hidden
      ${selected 
        ? 'border-hard-blue bg-hard-blue/5' 
        : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
      }
    `}>
      <CornerNodes className="opacity-30" />
      
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`
            w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0
            ${selected ? 'bg-hard-blue text-white' : 'bg-zinc-800 text-zinc-400'}
          `}>
            {persona.name[0]}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white mb-1">{persona.name}</h3>
            <p className="text-sm text-zinc-400 line-clamp-2">{persona.description}</p>
            
            {/* Tags */}
            {persona.relationshipContext && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-xs rounded">
                  {persona.relationshipContext.replace('_', ' ')}
                </span>
                {persona.harshnessLevel && (
                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-xs rounded">
                    Level {persona.harshnessLevel}/5
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {onSelect && (
            <button
              onClick={onSelect}
              className="flex-1 py-2 bg-hard-blue text-white text-sm font-bold uppercase tracking-wider hover:bg-blue-600 transition-colors"
            >
              {selected ? 'Selected' : 'Select'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonaCard;
