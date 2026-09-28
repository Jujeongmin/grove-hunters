import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "./lang";
import { GAME_TITLE } from "./brand";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// When a render throws, React unmounts the whole tree and the page goes blank, which in the
// Verse8 editor preview looks the same as the bundle never loading. Say what happened instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[traitor-hunt] render failed", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <h1>{GAME_TITLE}</h1>
        <p>{t("error.startFailed")}</p>
        <pre>{error.message}</pre>
        <button type="button" onClick={() => location.reload()}>{t("error.reload")}</button>
      </div>
    );
  }
}
