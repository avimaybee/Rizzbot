import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, Cpu } from 'lucide-react';

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
                <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-matte-base p-8 font-sans select-none relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-red-500/5 rounded-full blur-[120px]"></div>
                    
                    <div className="max-w-md w-full bg-white/5 border border-red-500/20 rounded-[40px] shadow-2xl relative overflow-hidden p-1">
                        <div className="bg-black/20 rounded-[36px] p-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-10 shadow-xl">
                                <AlertTriangle className="w-10 h-10 text-red-500" />
                            </div>
                            
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                                Unexpected Error
                            </h2>
                            
                            <p className="text-[10px] font-bold text-red-400/60 uppercase tracking-widest mb-10">
                               An interruption occurred
                            </p>
                            
                            <div className="w-full bg-black/40 border border-white/5 p-6 rounded-2xl mb-10 text-left">
                                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
                                    Error Details
                                </p>
                                <p className="text-xs text-zinc-400 font-mono break-all leading-relaxed line-clamp-4">
                                    {this.state.error?.message || "An unknown system error occurred."}
                                </p>
                            </div>
                            
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-4 bg-white text-black font-bold text-sm rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98]"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
