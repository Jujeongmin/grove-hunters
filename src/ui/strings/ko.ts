// The game's words, in the language they were written in. Every other language is checked against
// this one: a bundle that is missing a line, or carries one this does not, will not compile.
//
// A line may hold {name}-style holes, which t() fills in. Keep the holes' names the same in every
// language; their order may change freely.
export const ko = {
  "common.close": "닫기",
  "common.back": "뒤로",
  "common.on": "켜짐",
  "common.off": "꺼짐",
  "common.none": "끔",

  "settings.title": "설정",
  "settings.sound": "소리",
  "settings.music": "배경음악",
  "settings.effects": "효과음",
  "settings.controls": "조작",
  "settings.sensitivity": "마우스 감도",
  "settings.times": "{n}배",
  "settings.screen": "화면",
  "settings.brightness": "밝기",
  "settings.quality": "그래픽 품질",
  "settings.quality.low": "낮음",
  "settings.quality.mid": "보통",
  "settings.quality.high": "높음",
  "settings.quality.note": "낮을수록 가볍고 배터리를 덜 써요. 가까운 나무와 풀을 그리는 거리와 화면 해상도가 바뀌어요.",
  "settings.shown": "표시",
  "settings.showNames": "다른 플레이어 이름",
  "settings.damageNumbers": "데미지 숫자",
  "settings.language": "언어",
  "settings.keys.show": "단축키 보기",
  "settings.keys.hide": "단축키 닫기",
  "settings.defaults": "기본값",
  "settings.exit": "메뉴로 나가기",

  "keys.move": "이동",
  "keys.jump": "점프",
  "keys.click": "좌클릭 / 우클릭",
  "keys.attackGuard": "공격 / 막기",
  "keys.skills": "스킬",
  "keys.potion": "물약",
  "keys.talk": "대화",
  "keys.auto": "자동 전투",
  "keys.quest": "퀘스트 찾아가기·보고",
  "keys.chat": "채팅",
  "keys.menu": "메뉴 펼치기",
  "keys.closeWindow": "창 닫기",
  "keys.map": "지도",
  "keys.panels": "랭킹 / 퀘스트 / 스킬 / 대장간 / 가방",
  "keys.powerSave": "절전 모드",
  "keys.settings": "설정",
} as const;

export type Key = keyof typeof ko;
// Every other language must answer the same keys, no more and no fewer.
export type Bundle = Record<Key, string>;
