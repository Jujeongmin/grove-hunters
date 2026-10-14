// Words no character or guild may be named with: swearing (비속어), slurs, and names that pose as the
// game's staff. A name is matched lower-cased with its digits and _ taken out, so "시1발" and "f_u_c_k"
// are caught as well. Only Hangul syllables, latin letters, digits and _ reach here (see nickname.ts).
const BANNED: readonly string[] = [
  // Korean
  "시발", "씨발", "씨빨", "씨팔", "시팔", "쓰발", "씨바", "씨이발", "싀발", "십알", "씹", "썅", "쌍년", "쌍놈",
  "병신", "븅신", "빙신", "병쉰", "등신", "지랄", "좆", "좃", "존나", "졸라", "졸래",
  "개새", "개색", "개세", "새끼", "섹스", "보지", "자지", "후장", "자위", "딸딸이", "강간",
  "니미", "니애미", "니엄마", "느금", "애미뒤", "엠창", "엿먹", "미친놈", "미친년", "미친새", "창녀", "걸레년",
  "닥쳐", "꺼져", "호로새",
  // English
  "fuck", "fuk", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore", "slut", "asshole", "bastard",
  "dick", "pussy", "penis", "vagina", "porn", "sex", "rapist",
  // Posing as staff
  "운영자", "운영진", "관리자", "admin", "gamemaster",
];

export function isBannedName(name: string): boolean {
  const plain = name.normalize("NFC").toLowerCase().replace(/[0-9_]/g, "");
  return BANNED.some((word) => plain.includes(word));
}
