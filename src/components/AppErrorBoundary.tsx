import React from 'react';

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort boundary so a crash in one view shows a recovery screen
 * instead of unmounting the whole app to a blank page.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('LearnMate crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFBF9] px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-serif-editorial text-3xl font-bold text-[#121827]">
            Something went wrong
          </h1>
          <p className="text-sm text-[#606B7C]">
            This screen hit an unexpected error. Your saved study materials are not affected.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                window.location.hash = '#dashboard';
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg border border-black/10 text-xs font-semibold text-[#121827] cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
