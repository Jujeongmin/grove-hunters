// 을 after a final consonant, 를 after a vowel (a word that does not end in Hangul takes 를).
export function objectParticle(word: string): string {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "를";
  return code % 28 === 0 ? "를" : "을";
}

// 로 after a vowel or a final ㄹ, 으로 after any other final consonant (a word that does not end in
// Hangul takes 로).
export function directionParticle(word: string): string {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "로";
  const final = code % 28;
  return final === 0 || final === 8 ? "로" : "으로";
}
