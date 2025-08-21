import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to external service or console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="p-6 m-4 border-red-700 bg-red-950/20">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400" />
            <div>
              <h2 className="text-xl font-semibold text-red-400 mb-2">
                Something went wrong
              </h2>
              <p className="text-neutral-300 mb-4">
                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <details className="text-left">
                  <summary className="cursor-pointer text-sm text-neutral-400 hover:text-neutral-300">
                    Error details (development only)
                  </summary>
                  <div className="mt-2 p-3 bg-neutral-900 rounded border text-xs text-red-300 font-mono">
                    <p className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </p>
                    <p className="mb-2">
                      <strong>Stack:</strong>
                    </p>
                    <pre className="whitespace-pre-wrap break-words">
                      {this.state.error.stack}
                    </pre>
                    {this.state.errorInfo && (
                      <>
                        <p className="mt-4 mb-2">
                          <strong>Component Stack:</strong>
                        </p>
                        <pre className="whitespace-pre-wrap break-words">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline">
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}