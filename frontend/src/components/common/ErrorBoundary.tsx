import React from 'react';

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; errorId: string | null };

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorId: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (import.meta.env.DEV) console.error('Unhandled UI error', error);
    return { hasError: true, errorId };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.PROD) console.error('Unhandled UI error', { error, componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ hasError: false, errorId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAF8FB] px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="font-fraunces text-3xl font-bold text-[#A3078F]">Something went wrong</h1>
          <p className="mt-3 font-manrope text-[#374151]">
            Please try again. If the problem continues, share this reference with support: {this.state.errorId}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-6 rounded-lg bg-[#A3078F] px-6 py-3 font-manrope font-bold text-white"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }
}
