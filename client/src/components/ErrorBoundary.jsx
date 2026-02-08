import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * ErrorBoundary - Prevents crashes from malformed AI responses or render errors
 * Used to wrap individual message components so one bad message doesn't crash the whole chat
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log error for debugging
        console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            // Minimal fallback UI
            if (this.props.minimal) {
                return (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <AlertTriangle size={14} />
                        <span>Failed to display content</span>
                        <button
                            onClick={this.handleRetry}
                            className="ml-auto p-1 hover:bg-destructive/20 rounded"
                            title="Retry"
                        >
                            <RefreshCw size={12} />
                        </button>
                    </div>
                );
            }

            // Full fallback UI
            return (
                <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-destructive/5 border border-destructive/20">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="text-destructive" size={24} />
                    </div>
                    <div className="text-center">
                        <h3 className="text-sm font-medium text-destructive mb-1">
                            Something went wrong
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xs">
                            {this.props.fallbackMessage || "This content couldn't be displayed. Try refreshing or continue your conversation."}
                        </p>
                    </div>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                    >
                        <RefreshCw size={12} />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-friendly wrapper for functional components
 */
export function withErrorBoundary(Component, options = {}) {
    return function WrappedComponent(props) {
        return (
            <ErrorBoundary minimal={options.minimal} fallbackMessage={options.fallbackMessage}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
