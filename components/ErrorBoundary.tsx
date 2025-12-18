import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
                <div className="w-full h-full flex items-center justify-center bg-matte-base p-6">
                    <div className="max-w-md w-full bg-zinc-900 border border-red-900/50 p-6 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-red-950/30 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h2 className="text-xl font-impact text-white uppercase tracking-wide mb-2">
                            SYSTEM FAILURE
                        </h2>
                        <p className="text-sm text-zinc-400 mb-6 font-mono">
                            An unexpected error occurred in this module.
                            {this.state.error && (
                                <span className="block mt-2 text-xs text-red-400 bg-red-950/20 p-2 rounded">
                                    {this.state.error.message}
                                </span>
                            )}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-white text-black font-impact uppercase tracking-wider hover:bg-zinc-200 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            REBOOT SYSTEM
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
