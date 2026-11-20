import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  private handleReset = () => {
    try {
      // Drop potentially corrupt in-memory draft state so the crash doesn't loop
      const doomed: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("quick_")) doomed.push(k);
      }
      doomed.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
    this.setState({ error: null });
    window.location.hash = "#/home";
    if (window.location.pathname !== "/home") window.location.pathname = "/home";
    else window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-5"
        style={{ backgroundColor: "#F5EFE6" }}
      >
        <div className="text-center" style={{ maxWidth: 340 }}>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 30,
              fontStyle: "italic",
              color: "#1A1208",
            }}
          >
            That screen crashed.
          </p>
          <p
            style={{
              marginTop: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: "rgba(26,18,8,0.6)",
              lineHeight: 1.6,
            }}
          >
            Your saved history is safe. Head home and start fresh.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 18,
              height: 48,
              borderRadius: 999,
              border: "none",
              backgroundColor: "#C8522A",
              color: "#FFFFFF",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              padding: "0 28px",
            }}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }
}
