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
    id: "2026-09-30-guild",
    date: "2026-09-30",
    text: {
      ko: {
        title: "길드가 생겼어요",
        lines: [
          "메뉴의 '길드'에서 길드를 찾아 가입 신청하거나, 10,000골드로 직접 만들 수 있어요. 모든 서버가 같은 길드를 써요.",
          "캐릭터마다 길드 하나. 길드는 최대 30명, 길드장 1명과 부길드장 3명까지예요.",
          "길드원 목록에서 누가 어느 서버·채널·구역에 있는지 볼 수 있고, 머리 위 이름 옆에 <길드 이름>이 붙어요.",
          "채팅창에 '길드' 탭이 생겨요. 서버와 채널이 달라도 길드원끼리 이야기할 수 있어요.",
          "길드를 떠나거나 추방되면 24시간 뒤에 다른 길드에 들어갈 수 있어요. 함께 잡는 길드 보스도 준비 중이에요!",
        ],
      },
      en: {
        title: "Guilds are here",
        lines: [
          "Find a guild and apply under 'Guild' in the menu, or found your own for 10,000 gold. Every server shares the same guilds.",
          "One guild per character. A guild holds up to 30, with one master and up to three vices.",
          "The member list shows who is on which server, channel and zone, and your guild's <name> shows after your name.",
          "The chat gains a 'Guild' tab: talk with your guild whatever server or channel they are on.",
          "After leaving or being kicked, you can join another guild after 24 hours. Guild bosses to beat together are on the way!",
        ],
      },
      ja: {
        title: "ギルドができました",
        lines: [
          "メニューの「ギルド」でギルドを探して加入申請するか、10,000ゴールドで自分で作れます。すべてのサーバーで同じギルドです。",
          "キャラクターごとにギルド1つ。ギルドは最大30人、マスター1人とサブマスター3人までです。",
          "メンバー一覧で誰がどのサーバー・チャンネル・エリアにいるか見られ、頭上の名前の横に<ギルド名>が付きます。",
          "チャットに「ギルド」タブができます。サーバーやチャンネルが違ってもギルドメンバー同士で話せます。",
          "ギルドを離れたり追放されたりすると、24時間後に他のギルドに入れます。一緒に倒すギルドボスも準備中です！",
        ],
      },
      "zh-Hant": {
        title: "公會登場",
        lines: [
          "在選單的「公會」尋找公會申請加入，或花10,000金幣自己建立。所有伺服器共用相同的公會。",
          "每個角色一個公會。公會最多30人，會長1人、副會長最多3人。",
          "成員列表可以看到誰在哪個伺服器、頻道、區域，頭上名字旁會顯示<公會名稱>。",
          "聊天視窗新增「公會」分頁，不論伺服器或頻道都能和公會成員聊天。",
          "離開或被踢出公會後，24小時後才能加入其他公會。一起挑戰的公會首領也在準備中！",
        ],
      },
      "zh-Hans": {
        title: "公会登场",
        lines: [
          "在菜单的“公会”寻找公会申请加入，或花10,000金币自己创建。所有服务器共用相同的公会。",
          "每个角色一个公会。公会最多30人，会长1人、副会长最多3人。",
          "成员列表可以看到谁在哪个服务器、频道、区域，头上名字旁会显示<公会名称>。",
          "聊天窗口新增“公会”标签，不论服务器或频道都能和公会成员聊天。",
          "离开或被踢出公会后，24小时后才能加入其他公会。一起挑战的公会首领也在准备中！",
        ],
      },
    },
  },
  {
    id: "2026-09-30-market",
    date: "2026-09-30",
    text: {
      ko: {
        title: "거래소가 열렸어요",
        lines: [
          "메뉴의 '거래소'에서 거래 가능한 장비와 재료를 보석으로 사고팔 수 있어요. 모든 서버가 같은 거래소를 써요.",
          "장비는 강화 수치 그대로 한 점씩, 재료는 묶음으로 팔아요. 장비는 10보석, 재료 묶음은 1보석부터예요.",
          "팔리면 수수료 5%를 뺀 보석이, 산 물건은 그대로 우편으로 와요. 거래소에서 산 물건은 다시 팔 수 있어요.",
          "매물은 한 번에 10개까지, 48시간 동안 올라가요. 안 팔리거나 내리면 우편으로 돌아와요.",
          "모은 보석으로 마구간에서 탈것을 뽑아 보세요!",
        ],
      },
      en: {
        title: "The market is open",
        lines: [
          "Buy and sell tradable gear and materials for gems under 'Market' in the menu. Every server shares one market.",
          "Gear sells a piece at a time with its +, materials as a bundle. Gear starts at 10 gems, a bundle at 1.",
          "When something sells, the gems (less a 5% fee) come by mail, and what you buy comes by mail as it was. Bought things can be sold again.",
          "Up to 10 listings at once, each up for 48 hours. Anything unsold or taken down comes back by mail.",
          "Spend the gems you earn on mount draws in the stable!",
        ],
      },
      ja: {
        title: "取引所がオープンしました",
        lines: [
          "メニューの「取引所」で、取引可能な装備と素材を宝石で売買できます。すべてのサーバーが同じ取引所を使います。",
          "装備は強化値そのままで1つずつ、素材は束で売ります。装備は10宝石、素材の束は1宝石からです。",
          "売れると手数料5%を引いた宝石が、買ったものはそのまま郵便で届きます。取引所で買ったものはまた売れます。",
          "出品は一度に10個まで、48時間掲載されます。売れなかったり取り下げたものは郵便で戻ります。",
          "集めた宝石で馬小屋の乗り物を引いてみましょう！",
        ],
      },
      "zh-Hant": {
        title: "交易所開放了",
        lines: [
          "可在選單的「交易所」以寶石買賣可交易的裝備與材料，所有伺服器共用一個交易所。",
          "裝備保留強化值一件一件賣，材料整束賣。裝備10寶石起，材料每束1寶石起。",
          "售出後扣除5%手續費的寶石、購買的物品都會原樣以郵件送達。在交易所買的物品可以再賣。",
          "一次最多上架10件，每件上架48小時。未售出或下架的物品會以郵件退回。",
          "用賺到的寶石去馬廄抽坐騎吧！",
        ],
      },
      "zh-Hans": {
        title: "交易所开放了",
        lines: [
          "可在菜单的“交易所”以宝石买卖可交易的装备与材料，所有服务器共用一个交易所。",
          "装备保留强化值一件一件卖，材料整束卖。装备10宝石起，材料每束1宝石起。",
          "售出后扣除5%手续费的宝石、购买的物品都会原样以邮件送达。在交易所买的物品可以再卖。",
          "一次最多上架10件，每件上架48小时。未售出或下架的物品会以邮件退回。",
          "用赚到的宝石去马厩抽坐骑吧！",
        ],
      },
    },
  },
  {
    id: "2026-09-30-tradable",
    date: "2026-09-30",
    text: {
      ko: {
        title: "장비마다 강화 수치와 거래 가능 표시",
        lines: [
          "장비는 이제 한 점씩 따로 들고 다녀요. 강화 수치도 장비 한 점마다 붙어요.",
          "파란 다이아몬드 표시가 있으면 '거래 가능'이에요. 곧 열릴 거래소에서 보석을 받고 팔 수 있어요.",
          "몬스터가 떨어뜨린 장비는 30%, 대장간에서 만든 장비는 10% 확률로 거래 가능해요. 상점·퀘스트 장비는 거래할 수 없어요.",
          "몬스터가 떨어뜨린 재료는 거래 가능해요. 강화·제작·기부에는 거래 불가 재료부터 쓰여요.",
          "지금까지 가진 장비와 재료는 모두 거래 불가로 남고, 종류별 강화 수치는 입고 있던 한 점(없으면 가방의 첫 점)으로 옮겼어요.",
        ],
      },
      en: {
        title: "Each piece of gear has its own + and may be tradable",
        lines: [
          "Gear is now carried piece by piece, and each piece keeps its own +.",
          "A blue diamond means 'Tradable': such pieces can be sold for gems on the market, opening soon.",
          "Gear monsters drop is tradable 30% of the time, gear the forge makes 10%. Shop and quest gear never is.",
          "Materials monsters drop are tradable. Enhancing, crafting and gifts use materials that are not tradable first.",
          "Everything you had stays not tradable, and each kind's + moved to the piece you wore (or the first in the bag).",
        ],
      },
      ja: {
        title: "装備ごとの強化値と取引可能の表示",
        lines: [
          "装備は1つずつ別々に持つようになり、強化値も装備1つごとに付きます。",
          "青いダイヤの印は「取引可能」です。まもなく開く取引所で宝石と引き換えに売れます。",
          "モンスターが落とした装備は30%、鍛冶場で作った装備は10%の確率で取引可能です。ショップ・クエストの装備は取引できません。",
          "モンスターが落とした素材は取引可能です。強化・製作・寄付には取引不可の素材から使われます。",
          "これまでの装備と素材はすべて取引不可のままで、種類ごとの強化値は着ていた1つ（なければかばんの最初の1つ）に移しました。",
        ],
      },
      "zh-Hant": {
        title: "每件裝備各自的強化值與可交易標示",
        lines: [
          "裝備現在一件一件分開攜帶，強化值也跟著每一件裝備。",
          "有藍色菱形標示就是「可交易」，可在即將開放的交易所換取寶石。",
          "怪物掉落的裝備有30%、鍛造製作的裝備有10%機率可交易。商店與任務裝備不可交易。",
          "怪物掉落的材料可交易。強化、製作、捐贈會先使用不可交易的材料。",
          "原有的裝備與材料全部維持不可交易，各類強化值移到穿著的那一件（沒有則為背包中的第一件）。",
        ],
      },
      "zh-Hans": {
        title: "每件装备各自的强化值与可交易标示",
        lines: [
          "装备现在一件一件分开携带，强化值也跟着每一件装备。",
          "有蓝色菱形标示就是“可交易”，可在即将开放的交易所换取宝石。",
          "怪物掉落的装备有30%、锻造制作的装备有10%概率可交易。商店与任务装备不可交易。",
          "怪物掉落的材料可交易。强化、制作、捐赠会先使用不可交易的材料。",
          "原有的装备与材料全部保持不可交易，各类强化值移到穿着的那一件（没有则为背包中的第一件）。",
        ],
      },
    },
  },
  {
    id: "2026-09-30-mail",
    date: "2026-09-30",
    text: {
      ko: {
        title: "우편함이 열렸어요",
        lines: [
          "메뉴의 '우편'에서 게임이 보낸 선물을 받을 수 있어요. 받을 우편이 있으면 빨간 점이 떠요.",
          "우편함은 계정에 하나라서 어느 서버, 어느 캐릭터로 들어와도 같아요. 아이템은 받은 캐릭터의 가방으로 들어가요.",
          "우편은 30일 동안 보관돼요.",
          "오픈 기념으로 큰 물약 10개를 보냈어요 (10월 13일까지 접속하면 받아요).",
        ],
      },
      en: {
        title: "The mailbox is open",
        lines: [
          "Gifts from the game wait under 'Mail' in the menu; a red dot shows when there is something to take.",
          "There is one mailbox per account, the same on every server and character. Items go into the bag of the character that takes them.",
          "Letters are kept for 30 days.",
          "To mark the opening, 10 large potions are waiting for everyone who comes in by October 13.",
        ],
      },
      ja: {
        title: "郵便箱がオープンしました",
        lines: [
          "メニューの「郵便」でゲームからのプレゼントを受け取れます。受け取るものがあると赤い点が出ます。",
          "郵便箱はアカウントに一つで、どのサーバー・キャラクターでも同じです。アイテムは受け取ったキャラクターのかばんに入ります。",
          "郵便は30日間保管されます。",
          "オープン記念に大きなポーションを10個お送りします（10月13日までに入ると受け取れます）。",
        ],
      },
      "zh-Hant": {
        title: "郵箱開放了",
        lines: [
          "可以在選單的「郵件」領取遊戲送來的禮物，有可領取的郵件時會出現紅點。",
          "每個帳號只有一個郵箱，任何伺服器、任何角色進來都一樣。道具會放進領取角色的背包。",
          "郵件保存30天。",
          "為紀念開放，10月13日前登入即可領取大藥水10個。",
        ],
      },
      "zh-Hans": {
        title: "邮箱开放了",
        lines: [
          "可以在菜单的“邮件”领取游戏送来的礼物，有可领取的邮件时会出现红点。",
          "每个账号只有一个邮箱，任何服务器、任何角色进来都一样。道具会放进领取角色的背包。",
          "邮件保存30天。",
          "为纪念开放，10月13日前登录即可领取大药水10个。",
        ],
      },
    },
  },
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
