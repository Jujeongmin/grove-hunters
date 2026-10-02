// How the link to the Verse8 server stands, for the menu to say: ready; trying (the SDK connects, or
// reconnects after a drop, with its own back-off and time limit); failed (the SDK has given up, so
// only running the game again helps); or none (a build with no Verse8 project, which never connects).
export type Connection = "ready" | "trying" | "failed" | "none";

export function connectionOf(opts: { available: boolean; connected: boolean; phase: string | undefined }): Connection {
  if (!opts.available) return "none";
  if (opts.connected) return "ready";
  return opts.phase === "unavailable" ? "failed" : "trying";
}
