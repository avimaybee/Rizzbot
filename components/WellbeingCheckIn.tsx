import React from 'react';
import { WellbeingState } from '../types';
import { CornerNodes } from './CornerNodes';
import { AlertTriangle, Clock, Target, Activity, HeartPulse, ShieldAlert } from 'lucide-react';

interface WellbeingCheckInProps {
  reason: WellbeingState['reason'];
  onDismiss: () => void;
  onDismissForDay: () => void;
}

export const WellbeingCheckIn: React.FC<WellbeingCheckInProps> = ({ reason, onDismiss, onDismissForDay }) => {
  const messages: Record<NonNullable<WellbeingState['reason']>, { icon: React.ElementType; color: string; title: string; subtitle: string; message: string }> = {
    late_night: {
      icon: Clock,
      color: 'text-hard-gold',
      title: "CIRCADIAN_DRIFT_DETECTED",
      subtitle: "Low Cognitive Precision Threshold",
      message: "Analytical accuracy decreases significantly after 0200 hours. Strategic communication is optimized following a complete sleep cycle. Defer high-stakes transmission?"
    },
    same_person: {
      icon: Target,
      color: 'text-hard-red',
      title: "TARGET_HYPER_FOCUS",
      subtitle: "Unbalanced Resource Allocation",
      message: "Engagement metrics indicate excessive cognitive load directed at a single entity. Data suggests diminishing returns on persistent output. Recalibrate social bandwidth?"
    },
    high_frequency: {
      icon: Activity,
      color: 'text-hard-blue',
      title: "OPERATIONAL_FATIGUE",
      subtitle: "Cognitive Processing Overload",
      message: "System has logged sustained high-intensity analysis. Continued processing without cooling period may lead to tactical errors. Initiate manual stand-down?"
    },
    high_risk: {
      icon: ShieldAlert,
      color: 'text-hard-red',
      title: "PROTOCOL_THREAT_WARNING",
      subtitle: "Critical Relationship Instability",
      message: "Pattern recognition identifies high-risk interaction sequences. Detected red flags correlate with sub-optimal outcomes. Focus internal resources on self-maintenance?"
    }
  };

  const content = reason ? messages[reason] : messages.high_frequency;
  const Icon = content.icon;

  const handleAction = (action: () => void) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    action();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1000] flex items-center justify-center p-6 animate-fade-in font-mono select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-scan-lines opacity-[0.05] pointer-events-none"></div>
      
      <div className="glass-dark border-white/5 max-w-lg w-full relative soft-edge shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden">
        <CornerNodes className="opacity-20 scale-75" />

        {/* Header Section */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-5 mb-8">
            <div className={`w-16 h-16 glass flex items-center justify-center border-white/5 rounded-full relative shadow-[0_0_30px_rgba(0,0,0,0.3)]`}>
              <Icon className={`w-8 h-8 ${content.color} animate-pulse`} />
              <div className={`absolute inset-0 rounded-full border ${content.color.replace('text-', 'border-')}/20 animate-ping opacity-20`}></div>
            </div>
            <div>
              <div className={`text-[10px] font-bold ${content.color} uppercase tracking-[0.4em] mb-2`}>BIOMETRIC_FEEDBACK_LOOP</div>
              <h3 className="font-impact text-3xl text-white uppercase tracking-tighter leading-none">{content.title}</h3>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-black/40 border border-white/5 p-5 relative">
               <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 opacity-50"></div>
               <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
                  System Diagnostics: {content.subtitle}
               </div>
               <p className="text-zinc-300 text-xs leading-relaxed uppercase tracking-wide">
                  {content.message}
               </p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handleAction(onDismiss)}
                className="py-4 bg-white text-black font-impact text-xl uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-xl"
              >
                PROCEED
              </button>
              <button
                onClick={() => handleAction(onDismissForDay)}
                className="py-4 glass-zinc border-white/5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-white hover:border-white/10 transition-all active:scale-[0.98]"
              >
                DEACTIVATE_24H
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <HeartPulse className="w-3 h-3 text-zinc-700" />
             <div className="text-[8px] font-bold text-zinc-700 uppercase tracking-[0.3em]">RIZZBOT_BIOMETRICS_V2</div>
          </div>
          <div className="text-[8px] font-bold text-hard-gold uppercase tracking-[0.3em] animate-pulse">OPTIMIZING_OPERATOR_INTEGRITY</div>
        </div>
      </div>
    </div>
  );
};
