import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by SilvaPass ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: "2rem", border: "1px solid #ef4444", borderRadius: "8px", margin: "2rem", background: "#fef2f2" }}>
          <h2 style={{ color: "#b91c1c" }}>An unexpected error occurred in the SilvaPass interface</h2>
          <p style={{ color: "#7f1d1d" }}>{this.state.error?.message || "Unknown error"}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#b91c1c", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
