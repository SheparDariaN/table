import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = Readonly<{ children: ReactNode }>;
type State = Readonly<{ failed: boolean }>;

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="shell">
          <section className="card" role="alert">
            <h1>Something went wrong</h1>
            <p>Reload the page to retry.</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
