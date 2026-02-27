import React from 'react';
import { WellbeingState } from '../types';
import { CornerNodes } from './CornerNodes';

interface WellbeingCheckInProps {
  reason: WellbeingState['reason'];
  onDismiss: () => void;
  onDismissForDay: () => void;
}

export const WellbeingCheckIn: React.FC<WellbeingCheckInProps> = ({ reason, onDismiss, onDismissForDay }) => {
  const messages: Record<NonNullable<WellbeingState['reason']>, { emoji: string; title: string; message: string }> = {
    late_night: {
      emoji: '☾',
      title: "it's late bestie",
      message: "nothing good happens after 2am. maybe sleep on it? ur texts will still be there tomorrow and ull prob send something way better when ur not half asleep"
    },
    same_person: {
      emoji: '↺',
      title: "quick vibe check",
      message: "noticed ur spending a lot of energy on one person. thats valid but also... are they matching ur effort? sometimes stepping back is the power move"
    },
    high_frequency: {
      emoji: '◈',
      title: "taking a sec",
      message: "uve been grinding hard on this. maybe take a breather? go touch some grass, hydrate, or just vibe for a min. the app will be here when u get back"
    },
    high_risk: {
      emoji: '♡',
      title: "real talk",
      message: "seeing some consistent red flags in ur convos. not judging at all, but wanted to check in - u good? sometimes the move is to focus on u for a bit"
    }
  };

  const content = reason ? messages[reason] : messages.high_frequency;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 max-w-md w-full relative">
        <CornerNodes className="opacity-50" />

        {/* Header */}
        <div className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-3">
          <span className="text-3xl">{content.emoji}</span>
          <div>
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">WELLBEING CHECK</div>
            <h3 className="font-impact text-xl text-white uppercase">{content.title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-zinc-300 text-sm leading-relaxed mb-6">
            {content.message}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onDismiss}
              className="w-full py-3 bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-zinc-200 transition-colors min-h-[44px]"
            >
              im good, keep going
            </button>
            <button
              onClick={onDismissForDay}
              className="w-full py-3 border border-zinc-700 text-zinc-400 text-sm uppercase tracking-wider hover:border-zinc-500 hover:text-zinc-200 transition-colors min-h-[44px]"
            >
              dont remind me today
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-zinc-600 text-center mt-4 font-mono">
            we just want u to win →
          </p>
        </div>
      </div>
    </div>
  );
};
