import React, { useState } from 'react';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  resetPassword,
} from '../services/firebaseService';
import { Sparkles, ArrowRight, Lock, Mail, User } from 'lucide-react';

interface AuthModalProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'signin' | 'signup' | 'reset';

// Corner Nodes Component - matching App.tsx style
const CornerNodes = ({ className }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
    <div className="absolute top-0 left-0">
      <div className="w-2 h-2 border-t border-l border-zinc-500"></div>
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute top-0 right-0">
      <div className="w-2 h-2 border-t border-r border-zinc-500"></div>
      <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute bottom-0 left-0">
      <div className="w-2 h-2 border-b border-l border-zinc-500"></div>
      <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute bottom-0 right-0">
      <div className="w-2 h-2 border-b border-r border-zinc-500"></div>
      <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
  </div>
);

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName || undefined);
      } else if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
        setLoading(false);
        return;
      }
      onAuthSuccess();
    } catch (err: any) {
      // Parse Firebase error codes into friendly messages
      const errorCode = err.code || '';
      if (errorCode === 'auth/user-not-found') {
        setError("No account with that email. Try signing up!");
      } else if (errorCode === 'auth/wrong-password') {
        setError("Wrong password. Try again or reset it.");
      } else if (errorCode === 'auth/email-already-in-use') {
        setError("That email's taken. Try signing in instead.");
      } else if (errorCode === 'auth/weak-password') {
        setError("Password needs to be at least 6 characters.");
      } else if (errorCode === 'auth/invalid-email') {
        setError("That doesn't look like a valid email.");
      } else if (errorCode === 'auth/too-many-requests') {
        setError("Too many attempts. Chill for a bit.");
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setError("Google sign-in was cancelled.");
      } else {
        setError(err.message || "Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
      onAuthSuccess();
    } catch (err: any) {
      const errorCode = err.code || '';
      if (errorCode === 'auth/popup-closed-by-user') {
        setError("Google sign-in was cancelled.");
      } else if (errorCode === 'auth/popup-blocked') {
        setError("Popup blocked. Allow popups and try again.");
      } else {
        setError(err.message || "Google sign-in failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setResetSent(false);
  };

  return (
    <div className="min-h-screen bg-matte-base flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
      <div className="absolute inset-0 bg-scan-lines opacity-10 pointer-events-none"></div>

      <div className="w-full max-w-5xl relative z-10 grid md:grid-cols-2 gap-0 md:gap-8 items-center">

        {/* Left Column: Branding & Visuals (Hidden on small mobile, visible on desktop) */}
        <div className="hidden md:flex flex-col justify-center h-full p-8 relative">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-hard-gold animate-pulse"></div>
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">SYSTEM ONLINE</span>
            </div>
            <h1 className="text-7xl font-impact text-white uppercase tracking-tight mb-4 leading-none">
              THE<br />RIZZBOT
            </h1>
            <p className="text-zinc-400 font-mono text-sm max-w-md leading-relaxed">
              Advanced communication intelligence. <br />
              <span className="text-hard-gold">///</span> REAL-TIME ANALYSIS<br />
              <span className="text-hard-blue">///</span> TACTICAL REWRITES<br />
              <span className="text-zinc-500">///</span> GHOST RISK ASSESSMENT
            </p>
          </div>

          {/* Decorative Terminal Output */}
          <div className="font-mono text-[10px] text-zinc-600 space-y-1 opacity-70">
            <p>{'>'} INITIALIZING CORE SYSTEMS...</p>
            <p>{'>'} LOADING LINGUISTIC MODELS... [OK]</p>
            <p>{'>'} ESTABLISHING SECURE CONNECTION... [OK]</p>
            <p>{'>'} WAITING FOR USER AUTHENTICATION_</p>
          </div>
        </div>

        {/* Right Column: Auth Form */}
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header (Visible only on mobile) - More compact */}
          <div className="md:hidden text-center mb-5">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 bg-hard-gold animate-pulse"></div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">SYSTEM ACCESS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-impact text-white uppercase tracking-tight">
              THE RIZZBOT
            </h1>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 relative shadow-2xl">
            <CornerNodes className="opacity-50" />

            <div className="p-5 sm:p-6 md:p-8">
              {/* Mode Tabs - More compact */}
              {mode !== 'reset' && (
                <div className="flex mb-5 sm:mb-6 border-b border-zinc-800">
                  <button
                    onClick={() => switchMode('signin')}
                    className={`flex-1 pb-2.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all relative ${mode === 'signin'
                      ? 'text-white'
                      : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                  >
                    Sign In
                    {mode === 'signin' && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-hard-gold"></div>
                    )}
                  </button>
                  <button
                    onClick={() => switchMode('signup')}
                    className={`flex-1 pb-2.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all relative ${mode === 'signup'
                      ? 'text-white'
                      : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                  >
                    Initialize
                    {mode === 'signup' && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-hard-blue"></div>
                    )}
                  </button>
                </div>
              )}

              {/* Reset Password Header */}
              {mode === 'reset' && (
                <div className="mb-6">
                  <button
                    onClick={() => switchMode('signin')}
                    className="text-zinc-500 hover:text-white text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 mb-4 transition-colors"
                  >
                    ← Back to Login
                  </button>
                  <h2 className="text-white font-impact text-2xl uppercase tracking-wide">Reset Credentials</h2>
                  <p className="text-zinc-500 text-xs font-mono mt-1">
                    Enter your email to receive recovery protocols.
                  </p>
                </div>
              )}

              {/* Google Sign In Button - More compact */}
              {mode !== 'reset' && (
                <>
                  <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs py-2.5 px-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <svg className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="uppercase tracking-wider text-[10px]">Continue with Google</span>
                  </button>

                  {/* Divider - More compact */}
                  <div className="relative my-4 sm:my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-mono uppercase">
                      <span className="px-2 bg-zinc-900 text-zinc-600">or use email</span>
                    </div>
                  </div>
                </>
              )}

              {/* Email Form - More compact */}
              <form onSubmit={handleEmailAuth} className="space-y-3 sm:space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="displayName" className="label-sm text-zinc-500 mb-1.5 block flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      CODENAME
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                      placeholder="ENTER DISPLAY NAME"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-hard-blue px-3 py-2.5 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="label-sm text-zinc-500 mb-1.5 block flex items-center gap-1.5">
                    <Mail className="w-3 h-3" />
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="USER@EXAMPLE.COM"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-hard-gold px-3 py-2.5 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                  />
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label htmlFor="password" className="label-sm text-zinc-500 mb-1.5 block flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-hard-gold px-3 py-2.5 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                    />
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-950/30 border border-red-900/50 px-4 py-3 text-red-400 text-xs font-mono flex items-start gap-2">
                    <span className="text-red-500 font-bold">!</span> {error}
                  </div>
                )}

                {/* Reset Sent Message */}
                {resetSent && (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 px-4 py-3 text-emerald-400 text-xs font-mono flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> Reset link sent! Check your email.
                  </div>
                )}

                {/* Submit Button - More compact */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 sm:py-3.5 font-impact text-lg sm:text-xl uppercase tracking-wide border transition-all flex items-center justify-center gap-2 ${loading
                    ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                    : mode === 'signup'
                      ? 'bg-white text-black border-white hover:bg-zinc-200'
                      : 'bg-hard-gold text-black border-hard-gold hover:bg-yellow-400'
                    }`}
                >
                  {loading ? (
                    <span className="animate-pulse">PROCESSING...</span>
                  ) : (
                    <>
                      {mode === 'signup' ? 'INITIALIZE' : mode === 'signin' ? 'ACCESS SYSTEM' : 'SEND LINK'}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </>
                  )}
                </button>
              </form>

              {/* Forgot Password Link */}
              {mode === 'signin' && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => switchMode('reset')}
                    className="text-zinc-600 hover:text-hard-gold text-[10px] font-mono uppercase tracking-widest transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer - More compact */}
          <div className="mt-5 sm:mt-6 text-center">
            <p className="text-zinc-600 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest">
              By accessing, you agree to protocols & privacy standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
