import { useEffect } from "react";
import { startShop } from "../net/shop";
import type { MatchTransport } from "../net/transport";

const VERSE = import.meta.env.VITE_AGENT8_VERSE as string | undefined;

// Opens the VX Shop for this account once the server is there, so the stable's gem packs know their
// prices.
export function useShop(transport: MatchTransport | null): void {
  useEffect(() => {
    if (transport && VERSE) startShop(VERSE, transport.account);
  }, [transport]);
}
