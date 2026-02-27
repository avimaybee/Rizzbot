import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, Cpu } from 'lucide-react';
import { CornerNodes } from './CornerNodes';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-matte-base p-6 font-mono">
                    <div className="absolute inset-0 bg-scan-lines opacity-[0.05] pointer-events-none"></div>
                    
                    <div className="max-w-md w-full glass-dark border-red-500/20 relative shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden">
                        {/* Error Header Accent */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500/50"></div>
                        
                        <CornerNodes className="opacity-20 scale-75" />
                        
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 glass flex items-center justify-center border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)] mb-6 rounded-full relative">
                                <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                                <div className="absolute inset-0 rounded-full border border-red-500/30 animate-ping opacity-20"></div>
                            </div>
                            
                            <div className="flex items-center gap-3 mb-2">
                               <Cpu className="w-3 h-3 text-red-500/50" />
                               <h2 className="text-2xl font-impact text-white uppercase tracking-tighter">
                                   CORE_CRITICAL_FAILURE
                               </h2>
                            </div>
                            
                            <div className="text-[10px] uppercase tracking-[0.3em] text-red-500/60 font-bold mb-6">
                               System Integrity Compromised
                            </div>
                            
                            <div className="w-full bg-black/40 border border-white/5 p-4 mb-8 text-left">
                                <p className="text-[10px] text-zinc-500 leading-relaxed uppercase mb-2 border-b border-white/5 pb-2">
                                    Error Log Trace:
                                </p>
                                <p className="text-[11px] text-red-400/80 font-mono break-all line-clamp-3">
                                    {this.state.error?.message || "UNDEFINED_SYSTEM_EXCEPTION"}
                                </p>
                            </div>
                            
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-4 bg-white text-black font-impact text-xl uppercase tracking-wider hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] group"
                            >
                                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                                REBOOT_SESSION
                            </button>
                            
                            <div className="mt-6 text-[9px] text-zinc-600 uppercase tracking-widest opacity-50">
                                Error Code: ERR_MODULE_PANIC_0x001
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
