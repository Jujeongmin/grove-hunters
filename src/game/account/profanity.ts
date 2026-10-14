// Words no character or guild may be named with, and that chat hides: swearing (비속어) and slurs.
// Names also may not pose as the game's staff or carry a few words that are harmless in a sentence
// ("보지 마"); chat also hides the jamo shorthands (a name cannot hold jamo anyway). Text is matched
// lower-cased with its digits and _ taken out, so "시1발" and "f_u_c_k" are caught as well.
const SWEARING: readonly string[] = [
  // Korean
  "시발", "씨발", "씨빨", "씨팔", "시팔", "쓰발", "씨바", "씨이발", "싀발", "십알", "씹", "썅", "쌍년", "쌍놈",
  "병신", "븅신", "빙신", "병쉰", "등신", "지랄", "좆", "좃", "존나", "졸라", "졸래",
  "개새", "개색", "개세", "새끼", "섹스", "후장", "자위", "딸딸이", "강간",
  "니미", "니애미", "니엄마", "느금", "애미뒤", "엠창", "엿먹", "미친놈", "미친년", "미친새", "창녀", "걸레년",
  "닥쳐", "꺼져", "호로새",
  // English
  "fuck", "fuk", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore", "slut", "asshole", "bastard",
  "dick", "pussy", "penis", "vagina", "porn", "sex", "rapist",
];
const NAME_ONLY: readonly string[] = [
  "보지", "자지",
  // Posing as staff
  "운영자", "운영진", "관리자", "admin", "gamemaster",
];
const CHAT_ONLY: readonly string[] = ["ㅅㅂ", "ㅆㅂ", "ㅂㅅ", "ㅄ", "ㅈㄹ", "ㅈㄴ", "ㅈ같", "ㅗㅗ"];

const NAME_WORDS = [...SWEARING, ...NAME_ONLY];
const CHAT_WORDS = [...SWEARING, ...CHAT_ONLY].map((w) => [...w]);

const skipped = (ch: string) => /^[0-9_]$/.test(ch);
const lower = (ch: string) => {
  const low = ch.toLowerCase();
  return [...low].length === 1 ? low : ch;
};

export function isBannedName(name: string): boolean {
  const plain = [...name.normalize("NFC")].filter((ch) => !skipped(ch)).map(lower).join("");
  return NAME_WORDS.some((word) => plain.includes(word));
}

// A chat line with every swear word in it turned to *, one for each character it spans (digits and _
// inside it too).
export function maskSwearing(text: string): string {
  const chars = [...text.normalize("NFC")];
  const at: number[] = [];
  const plain: string[] = [];
  chars.forEach((ch, i) => {
    if (skipped(ch)) return;
    at.push(i);
    plain.push(lower(ch));
  });
  const hide = new Array<boolean>(chars.length).fill(false);
  for (const word of CHAT_WORDS) {
    for (let i = 0; i + word.length <= plain.length; i++) {
      if (word.every((ch, k) => plain[i + k] === ch)) {
        for (let j = at[i]; j <= at[i + word.length - 1]; j++) hide[j] = true;
      }
    }
  }
  return hide.some(Boolean) ? chars.map((ch, i) => (hide[i] ? "*" : ch)).join("") : text;
}
