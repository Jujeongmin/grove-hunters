// What the quest tracker says under the quest, and whether it shows as under way (and how far is left).
// Done, it asks to be tapped (and shines) even while auto-battle is still out hunting; only the walk
// to the elder counts as under way then. On a hunt, at grips with its monster it says so rather than
// "on the way".
export type QuestHintKey = "quest.reporting" | "quest.goReport" | "quest.fighting" | "quest.seeking" | "quest.goFind";

export function questHint(done: boolean, s: { seeking: boolean; toElder: boolean; fighting: boolean }): {
  key: QuestHintKey; going: boolean; showWay: boolean;
} {
  if (done) return { key: s.toElder ? "quest.reporting" : "quest.goReport", going: s.toElder, showWay: s.toElder };
  if (s.fighting) return { key: "quest.fighting", going: true, showWay: false };
  if (s.seeking) return { key: "quest.seeking", going: true, showWay: true };
  return { key: "quest.goFind", going: false, showWay: false };
}
