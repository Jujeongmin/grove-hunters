// First, before anything reaches for storage: @agent8/gameserver touches localStorage while its
// module is being evaluated. See storageFallback.ts.
import "./storageFallback";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameServerProvider } from "@agent8/gameserver";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { installUiTheme } from "./ui/theme";
import { loadLang } from "./ui/lang";

installUiTheme();

// The language in play first (Korean is already here; the others are fetched), then the game. Should
// the fetch fail, the game starts in Korean all the same.
void loadLang().catch(() => undefined).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <GameServerProvider>
          <App />
        </GameServerProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
