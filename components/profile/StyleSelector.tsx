import React from 'react';

interface StyleSelectorProps {
  label: string;
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
  variant?: 'default' | 'tone';
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  label,
  options,
  selected,
  onChange,
  variant = 'default'
}) => {
  return (
    <div>
      <label className="label-sm text-zinc-400 mb-3 block">{label}</label>
      <div className={`grid gap-2 ${variant === 'tone' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`
              py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all border min-h-[44px]
              ${selected === option
                ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StyleSelector;
