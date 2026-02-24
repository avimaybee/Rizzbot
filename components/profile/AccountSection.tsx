import React from 'react';
import { User, LogOut, Clock, HeartHandshake } from 'lucide-react';
import { AuthUser } from '../../services/firebaseService';

interface AccountSectionProps {
  authUser?: AuthUser | null;
  onSignOut?: () => void;
  onHistory?: () => void;
  onTherapist?: () => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  authUser,
  onSignOut,
  onHistory,
  onTherapist
}) => {
  if (!authUser) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
      {/* Corner nodes decoration */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-600"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-600"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-600"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-600"></div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {authUser.photoURL ? (
            <img 
              src={authUser.photoURL} 
              alt={authUser.displayName || 'User'} 
              className="w-12 h-12 rounded-full border-2 border-zinc-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-hard-gold/80 via-amber-500 to-orange-500 flex items-center justify-center text-white text-lg font-bold border-2 border-zinc-700">
              {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-white font-semibold">
              {authUser.displayName || 'User'}
            </div>
            <div className="text-zinc-500 text-sm">
              {authUser.email}
            </div>
            <div className="text-zinc-600 text-xs font-mono mt-1">
              via {authUser.providerId === 'google.com' ? 'Google' : 'Email'}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2">
          {onHistory && (
            <button
              onClick={onHistory}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors text-sm min-h-[44px]"
            >
              <Clock className="w-4 h-4" />
              History
            </button>
          )}
          {onTherapist && (
            <button
              onClick={onTherapist}
              className="flex items-center gap-2 px-4 py-2 border border-rose-700/50 text-rose-400 hover:border-rose-500 hover:text-rose-300 transition-colors text-sm min-h-[44px]"
            >
              <HeartHandshake className="w-4 h-4" />
              Therapist
            </button>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-400 transition-colors text-sm min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSection;
