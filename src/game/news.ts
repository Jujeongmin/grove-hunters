import type { Lang } from "./langs";

// What each update brought, as the news panel shows it. Kept in code and shipped with the game: a
// new entry goes on the FRONT (newest first; what an account has read is kept as the id of the
// newest it saw, and everything in front of that is new) and is never taken out again.

export interface NewsText { title: string; lines: string[] }

export interface NewsEntry {
  // YYYY-MM-DD-topic.
  id: string;
  // The day it went out, Korean time.
  date: string;
  // Every language the game speaks, or it does not compile.
  text: Record<Lang, NewsText>;
}

export const NEWS: readonly NewsEntry[] = [
  {
    id: "2026-09-30-news",
    date: "2026-09-30",
    text: {
      ko: {
        title: "소식판이 생겼어요",
        lines: [
          "업데이트가 있으면 들어올 때 이 창이 한 번 떠요.",
          "메뉴의 '소식'에서 지난 소식을 언제든 볼 수 있어요.",
        ],
      },
      en: {
        title: "A news board",
        lines: [
          "When there is an update, this window opens once as you come in.",
          "Past news is always under 'News' in the menu.",
        ],
      },
      ja: {
        title: "お知らせ板ができました",
        lines: [
          "アップデートがあると、入ったときにこの画面が一度だけ開きます。",
          "メニューの「お知らせ」でいつでも過去のお知らせを見られます。",
        ],
      },
      "zh-Hant": {
        title: "新增公告板",
        lines: [
          "有更新時，進入遊戲會自動開啟一次這個視窗。",
          "隨時可以在選單的「公告」查看過去的公告。",
        ],
      },
      "zh-Hans": {
        title: "新增公告板",
        lines: [
          "有更新时，进入游戏会自动打开一次这个窗口。",
          "随时可以在菜单的“公告”查看过去的公告。",
        ],
      },
    },
  },
  {
    id: "2026-09-29-mounts",
    date: "2026-09-29",
    text: {
      ko: {
        title: "탈것과 마구간",
        lines: [
          "탈것 20종: 정식판의 사슴, 그리고 보석으로 뽑는 일반·레어·에픽·전설 탈것.",
          "고른 탈것은 타지 않아도 전투력과 체력을 올려 줘요.",
          "마구간에서 알을 깨고, 보석 상점에서 보석을 살 수 있어요.",
          "퀘스트 길 찾기 중에는 2초 뒤 자동으로 탈것에 올라요.",
          "휴대폰에서 프레임이 떨어지면 화면을 가볍게 그려 부드럽게 움직여요.",
        ],
      },
      en: {
        title: "Mounts and the stable",
        lines: [
          "20 mounts: the full game's deer, and common, rare, epic and legendary mounts drawn with gems.",
          "Your picked mount adds power and health even when you are on foot.",
          "Hatch eggs in the stable, and buy gems in the gem shop.",
          "Following a quest's way puts you on your mount after two seconds.",
          "Phones that fall behind draw the world lighter to keep moving smoothly.",
        ],
      },
      ja: {
        title: "乗り物と馬小屋",
        lines: [
          "乗り物20種：製品版のシカと、宝石で引くコモン・レア・エピック・レジェンドの乗り物。",
          "選んだ乗り物は、乗っていなくても戦闘力と体力を上げます。",
          "馬小屋で卵をかえし、宝石ショップで宝石を買えます。",
          "クエストの道案内中は2秒後に自動で乗り物に乗ります。",
          "スマホでフレームが落ちると、画面を軽く描いてなめらかに動きます。",
        ],
      },
      "zh-Hant": {
        title: "坐騎與馬廄",
        lines: [
          "20種坐騎：正式版的鹿，以及用寶石抽取的普通、稀有、史詩、傳說坐騎。",
          "選好的坐騎即使沒騎乘也會提升戰鬥力和體力。",
          "在馬廄孵蛋，在寶石商店購買寶石。",
          "任務自動尋路時，2秒後會自動騎上坐騎。",
          "手機掉幀時會降低畫面負擔，保持流暢。",
        ],
      },
      "zh-Hans": {
        title: "坐骑与马厩",
        lines: [
          "20种坐骑：正式版的鹿，以及用宝石抽取的普通、稀有、史诗、传说坐骑。",
          "选好的坐骑即使没骑乘也会提升战斗力和体力。",
          "在马厩孵蛋，在宝石商店购买宝石。",
          "任务自动寻路时，2秒后会自动骑上坐骑。",
          "手机掉帧时会降低画面负担，保持流畅。",
        ],
      },
    },
  },
  {
    id: "2026-09-28-grove",
    date: "2026-09-28",
    text: {
      ko: {
        title: "숲 정화와 마을 복구, 첫 튜토리얼",
        lines: [
          "서버마다 한 주 동안 모두의 사냥으로 숲을 정화해요. 30·60·100%마다 보상, 100%면 정화의 수호자가 나타나요.",
          "촌장에게 재료와 골드를 기부해 약초상·훈련소·여관·망루를 지어요. 서버 전체가 혜택을 받아요.",
          "새 캐릭터는 촌장에게 첫 기술과 물약을 받는 튜토리얼로 시작해요.",
          "마우스나 손가락만으로 모두 조작할 수 있어요.",
        ],
      },
      en: {
        title: "Cleansing the grove, rebuilding the village, the first tutorial",
        lines: [
          "Each server cleanses its grove together for a week. Rewards at 30, 60 and 100%, and at 100% the grove's guardian comes.",
          "Give materials and gold to the elder to build the herbalist, training ground, inn and watchtower. The whole server gains.",
          "New characters start with a tutorial: the elder teaches the first skill and gives potions.",
          "Everything can be played with a mouse or a finger alone.",
        ],
      },
      ja: {
        title: "森の浄化と村の復興、最初のチュートリアル",
        lines: [
          "サーバーごとに1週間、みんなの狩りで森を浄化します。30・60・100%で報酬、100%で浄化の守護者が現れます。",
          "村長に素材とゴールドを寄付して、薬草屋・訓練所・宿屋・見張り塔を建てます。サーバー全体が恩恵を受けます。",
          "新しいキャラクターは、村長から最初のスキルとポーションをもらうチュートリアルから始まります。",
          "マウスや指だけですべて操作できます。",
        ],
      },
      "zh-Hant": {
        title: "淨化森林與重建村莊、第一個教學",
        lines: [
          "每個伺服器一週內由大家一起狩獵淨化森林。30、60、100%各有獎勵，100%時淨化守護者現身。",
          "向村長捐贈材料和金幣，建造藥草鋪、訓練場、旅館和瞭望塔，整個伺服器都能受益。",
          "新角色從教學開始：村長會傳授第一個技能並給予藥水。",
          "只用滑鼠或手指就能完成所有操作。",
        ],
      },
      "zh-Hans": {
        title: "净化森林与重建村庄、第一个教程",
        lines: [
          "每个服务器一周内由大家一起狩猎净化森林。30、60、100%各有奖励，100%时净化守护者现身。",
          "向村长捐赠材料和金币，建造药草铺、训练场、旅馆和瞭望塔，整个服务器都能受益。",
          "新角色从教程开始：村长会传授第一个技能并给予药水。",
          "只用鼠标或手指就能完成所有操作。",
        ],
      },
    },
  },
];

export function readNewsId(raw: unknown): string | null {
  return typeof raw === "string" && NEWS.some((n) => n.id === raw) ? raw : null;
}

// How many entries are newer than the one last read: all of them before the first read, and when
// the kept id is not on the list.
export function unseenNews(seen: string | null): number {
  const at = seen === null ? -1 : NEWS.findIndex((n) => n.id === seen);
  return at < 0 ? NEWS.length : at;
}
