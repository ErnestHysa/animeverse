/**
 * Client Error Boundary Wrapper
 * Wraps components to catch client-side errors
 */

"use client";

import { Component, ReactNode, Suspense } from "react";
import { ErrorFallback } from "./error-fallback";

interface ClientErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface ClientErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ClientErrorBoundary extends Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  constructor(props: ClientErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ClientErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Client Error Boundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          title="Something went wrong"
          message={this.state.error?.message || "An unexpected error occurred"}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with error boundary and suspense
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ClientErrorBoundary fallback={fallback}>
        <Suspense fallback={<LoadingFallback />}>
          <Component {...props} />
        </Suspense>
      </ClientErrorBoundary>
    );
  };
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Simple wrapper for async components that may fail
 */
export function SafeAsync({
  children,
  fallback,
  errorFallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}) {
  return (
    <ClientErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback || <LoadingFallback />}>
        {children}
      </Suspense>
    </ClientErrorBoundary>
  );
}
