import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? "Unknown";
    console.error(`[ErrorBoundary:${label}]`, error.message, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in duration-300">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-9 h-9 text-destructive" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-serif font-bold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {this.state.error?.message
                ? `Error: ${this.state.error.message}`
                : "An unexpected error occurred on this page. Your family data is safe in localStorage."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { window.location.href = "/"; }}
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </div>
          {import.meta.env.DEV && this.state.componentStack && (
            <details className="text-left max-w-2xl w-full">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Stack trace (dev only)
              </summary>
              <pre className="mt-2 text-[10px] bg-muted rounded p-3 overflow-auto max-h-48 text-muted-foreground">
                {this.state.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
