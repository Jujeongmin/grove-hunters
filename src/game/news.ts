import type { Lang } from "./langs";
import { PASS_GEMS_DAILY, PASS_XP, VIP_BONUS } from "./account/premium";
import { FIRST_GEMS } from "./world/dungeon";

// What each update brought, as the news panel shows it. Kept in code and shipped with the game: a
// new entry goes on the FRONT (newest first; what an account has read is kept as the id of the
// newest it saw, and everything in front of that is new) and is never taken out again.

// Where an entry gives a number that has changed since (the pass's daily gems and XP, a VIP rank's share),
// it is read from premium.ts, so the news never says other than the game does.
const VIP_PCT = Math.round(VIP_BONUS * 100);
const PASS_XP_PCT = Math.round(PASS_XP * 100);

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
    id: "2026-10-08-take-quests",
    date: "2026-10-08",
    text: {
      ko: { title: "퀘스트는 촌장에게 받아요", lines: [
        "퀘스트를 완료하면 다음 퀘스트는 촌장(설원에서는 대장)에게 말을 걸어 '퀘스트 받기'를 눌러야 시작돼요. 받기 전에는 처치 수가 올라가지 않아요.",
        "퀘스트 창을 누르면 촌장에게 자동으로 걸어가요. 촌장 머리 위 !는 받을 퀘스트, ?는 완료할 퀘스트예요.",
        "숲 필드 2 퀘스트에서 레벨이 모자라 막혀 있던 분은 새로 생긴 숲 필드 1 퀘스트로 옮겨졌어요.",
      ] },
      en: { title: "Quests are taken from the elder", lines: [
        "After a quest is done, the next one starts once you talk to the elder (the captain in the snow) and press 'Take the quest'. Kills do not count before that.",
        "Tap the quest tracker to walk to the elder. Over the elder, ! is a quest to take and ? one to hand in.",
        "If you were stuck on a Forest Field 2 quest below its level, you have been moved to the new Forest Field 1 quests.",
      ] },
      ja: { title: "クエストは村長から受けます", lines: [
        "クエストを完了したら、次のクエストは村長（雪原では隊長）に話しかけて「クエストを受ける」を押すと始まります。受ける前は討伐数が増えません。",
        "クエスト欄をタップすると村長のもとへ自動で歩きます。村長の頭上の！は受けられるクエスト、？は完了できるクエストです。",
        "レベル不足で森フィールド2のクエストに止まっていた方は、新しい森フィールド1のクエストに移りました。",
      ] },
      "zh-Hans": { title: "任务需向村长领取", lines: [
        "完成任务后，下一个任务需要和村长（雪原为队长）对话并点击“接受任务”才会开始，接受前击杀数不会增加。",
        "点击任务栏会自动走向村长。村长头上的！表示可接任务，？表示可交任务。",
        "因等级不足卡在森林原野 2 任务的玩家，已移到新增的森林原野 1 任务。",
      ] },
      "zh-Hant": { title: "任務需向村長領取", lines: [
        "完成任務後，下一個任務需要和村長（雪原為隊長）對話並點擊「接受任務」才會開始，接受前擊殺數不會增加。",
        "點擊任務欄會自動走向村長。村長頭上的！表示可接任務，？表示可交任務。",
        "因等級不足卡在森林原野 2 任務的玩家，已移到新增的森林原野 1 任務。",
      ] },
    },
  },
  {
    id: "2026-10-08-quest-chain",
    date: "2026-10-08",
    text: {
      ko: { title: "퀘스트가 끝까지 이어져요", lines: [
        "숲 필드 2에 2개, 설산 기슭에 1개, 얼음 협곡에 2개 퀘스트가 더 생겼어요. 이제 퀘스트만 따라가도 다음 사냥터의 입장 레벨에 닿아요.",
        "이미 그 뒤 퀘스트를 하던 분은 진행이 그대로 이어져요.",
      ] },
      en: { title: "The quests now run all the way", lines: [
        "Two more in Forest Field 2, one in the Snowy Foothills and two in the Ice Canyon: the quests alone now reach each next field's level.",
        "If you were already past them, your progress carries on as it was.",
      ] },
      ja: { title: "クエストが最後までつながります", lines: [
        "森フィールド2に2つ、雪山のふもとに1つ、氷の峡谷に2つクエストが増えました。クエストだけで次の狩場の入場レベルに届きます。",
        "すでに先のクエストを進めていた方は、そのまま続きます。",
      ] },
      "zh-Hans": { title: "任务一路衔接到底", lines: [
        "森林原野 2 新增 2 个、雪山山麓 1 个、冰之峡谷 2 个任务，只做任务也能达到下一个猎场的进入等级。",
        "已经在做后续任务的玩家，进度照常延续。",
      ] },
      "zh-Hant": { title: "任務一路銜接到底", lines: [
        "森林原野 2 新增 2 個、雪山山麓 1 個、冰之峽谷 2 個任務，只做任務也能達到下一個獵場的進入等級。",
        "已經在做後續任務的玩家，進度照常延續。",
      ] },
    },
  },
  {
    id: "2026-10-08-first-field-quests",
    date: "2026-10-08",
    text: {
      ko: { title: "숲 필드 1 퀘스트 추가 · 채팅 위치", lines: [
        "들쥐·개구리 퀘스트 다음에 '개구리 늪의 소란'과 '초록숲 정화'가 생겼어요. 이제 퀘스트만 따라가도 숲 필드 2가 열리는 10레벨까지 갈 수 있어요.",
        "이미 그 뒤 퀘스트를 하던 분은 진행이 그대로 이어져요.",
        "채팅 미리보기가 미니맵 오른쪽으로 옮겨졌고, 최근 4줄까지 보여요.",
      ] },
      en: { title: "New Forest Field 1 quests · chat moved", lines: [
        "After the rats and frogs come 'Trouble at the Frog Pond' and 'Cleansing the Green Wood': the quests alone now carry you to level 10, where Forest Field 2 opens.",
        "If you were already past them, your progress carries on as it was.",
        "The chat preview sits right of the minimap now, with the last four lines.",
      ] },
      ja: { title: "森フィールド1のクエスト追加 · チャットの位置", lines: [
        "野ネズミ・カエルの次に「カエル沼の騒ぎ」と「緑の森の浄化」が加わりました。クエストを進めるだけで森フィールド2が開くレベル10まで届きます。",
        "すでに先のクエストを進めていた方は、そのまま続きます。",
        "チャットのプレビューがミニマップの右に移り、最新4行まで表示します。",
      ] },
      "zh-Hans": { title: "新增森林区域1任务 · 聊天位置", lines: [
        "田鼠·青蛙任务之后新增“青蛙沼的骚动”和“净化绿森林”，只做任务也能升到开放森林区域2的 10 级。",
        "已经在做后续任务的玩家，进度照常延续。",
        "聊天预览移到小地图右侧，显示最近 4 行。",
      ] },
      "zh-Hant": { title: "新增森林區域1任務 · 聊天位置", lines: [
        "田鼠·青蛙任務之後新增「青蛙沼的騷動」和「淨化綠森林」，只做任務也能升到開放森林區域2的 10 級。",
        "已經在做後續任務的玩家，進度照常延續。",
        "聊天預覽移到小地圖右側，顯示最近 4 行。",
      ] },
    },
  },
  {
    id: "2026-10-06-mount-herd",
    date: "2026-10-06",
    text: {
      ko: {
        title: "탈것 보유 효과 · 새 대장간",
        lines: [
          "이제 가진 탈것마다 보유 효과가 붙어요. 일반 공격 +5%·체력 +15부터 희귀 +8%, 영웅 +14%, 전설 +28%, 신화 +47%까지, 돌파(★)하면 더 올라요.",
          "장착한 탈것의 효과는 그대로이고, 보유 효과는 어떤 탈것을 골라도 모두 더해져요. 탈것 창 위쪽에서 합계를 볼 수 있어요.",
          "대장간이 바뀌었어요. 오른쪽에서 장비를 고르면 왼쪽 모루에 올라가 확률·비용·결과를 한눈에 보여 줘요.",
        ],
      },
      en: {
        title: "Owned mount bonus · a new forge",
        lines: [
          "Every mount you own now adds an owned bonus: attack +5% and health +15 for a common, up to +8% rare, +14% epic, +28% legendary and +47% mythic, more with stars (★).",
          "The picked mount's bonus stays as it was; owned bonuses all add up whichever mount you pick. The stable shows the total at the top.",
          "The forge is new: pick gear on the right and it goes on the anvil on the left, with its odds, its price and how it went.",
        ],
      },
      ja: {
        title: "乗り物の保有効果 · 新しい鍛冶場",
        lines: [
          "持っている乗り物ごとに保有効果が付きます。コモン攻撃+5%・体力+15から、レア+8%、エピック+14%、レジェンド+28%、神話+47%まで。突破(★)でさらに上がります。",
          "装着した乗り物の効果はそのままで、保有効果はどれを選んでもすべて加算されます。乗り物画面の上で合計を確認できます。",
          "鍛冶場が新しくなりました。右で装備を選ぶと左の金床に載り、確率・費用・結果がひと目で分かります。",
        ],
      },
      "zh-Hans": {
        title: "坐骑持有效果 · 全新铁匠铺",
        lines: [
          "现在拥有的每只坐骑都有持有效果：普通攻击 +5%、生命 +15，稀有 +8%，史诗 +14%，传说 +28%，神话 +47%，突破(★)后更高。",
          "装备坐骑的效果不变，无论选择哪只，持有效果都会全部叠加。可在坐骑界面顶部查看合计。",
          "铁匠铺焕然一新：在右侧选择装备，它会放上左侧的铁砧，概率、费用与结果一目了然。",
        ],
      },
      "zh-Hant": {
        title: "坐騎持有效果 · 全新鐵匠鋪",
        lines: [
          "現在擁有的每隻坐騎都有持有效果：普通攻擊 +5%、生命 +15，稀有 +8%，史詩 +14%，傳說 +28%，神話 +47%，突破(★)後更高。",
          "裝備坐騎的效果不變，無論選擇哪隻，持有效果都會全部疊加。可在坐騎介面頂部查看合計。",
          "鐵匠鋪煥然一新：在右側選擇裝備，它會放上左側的鐵砧，機率、費用與結果一目了然。",
        ],
      },
    },
  },
  {
    id: "2026-10-06-market-fee",
    date: "2026-10-06",
    text: {
      ko: { title: "거래소 수수료 10%", lines: ["거래소 판매 수수료가 5%에서 10%로 올랐어요. VIP 8부터는 여전히 수수료가 없어요."] },
      en: { title: "Market fee 10%", lines: ["The market's sale fee goes from 5% to 10%. From VIP 8 there is still no fee."] },
      ja: { title: "取引所手数料10%", lines: ["取引所の販売手数料が5%から10%になりました。VIP 8以上は引き続き手数料無料です。"] },
      "zh-Hans": { title: "交易所手续费 10%", lines: ["交易所出售手续费由 5% 调整为 10%。VIP 8 起仍免手续费。"] },
      "zh-Hant": { title: "交易所手續費 10%", lines: ["交易所出售手續費由 5% 調整為 10%。VIP 8 起仍免手續費。"] },
    },
  },
  {
    id: "2026-10-06-gem-packs",
    date: "2026-10-06",
    text: {
      ko: {
        title: "큰 보석 상품 · 보상 조정",
        lines: [
          "보석 6,500개(+30%)와 14,000개(+40%) 상품이 생겼어요. 큰 상품일수록 보석을 더 얹어 드려요.",
          "상품별 첫 구매 2배는 끝났어요. 모든 상품이 언제 사도 같은 양이에요.",
          `출석부 보석과 탈것 소환권(주 1회), 시련의 던전 하루 첫 클리어 보석(${FIRST_GEMS}개)이 조정됐어요.`,
        ],
      },
      en: {
        title: "Bigger gem packs · reward changes",
        lines: [
          "New packs of 6,500 (+30%) and 14,000 gems (+40%): the bigger the pack, the more gems on top.",
          "The first-purchase double has ended: every pack gives the same gems whenever you buy it.",
          `The attendance sheet's gems and mount tickets (once a week) and the Trial Dungeon's first clear of the day (${FIRST_GEMS} gems) have changed.`,
        ],
      },
      ja: {
        title: "大きな宝石パック · 報酬の調整",
        lines: [
          "宝石6,500個（+30%）と14,000個（+40%）のパックが登場。大きいパックほど宝石が多く付きます。",
          "パックごとの初回購入2倍は終了しました。どのパックもいつ買っても同じ量です。",
          `出席簿の宝石と乗り物召喚券（週1回）、試練のダンジョンの1日初回クリア宝石（${FIRST_GEMS}個）を調整しました。`,
        ],
      },
      "zh-Hans": {
        title: "大额宝石礼包 · 奖励调整",
        lines: [
          "新增 6,500 宝石（+30%）和 14,000 宝石（+40%）礼包，礼包越大赠送越多。",
          "各礼包首充双倍已结束，任何时候购买数量都相同。",
          `签到簿的宝石与坐骑召唤券（每周 1 次）、试炼地下城每日首通宝石（${FIRST_GEMS} 个）已调整。`,
        ],
      },
      "zh-Hant": {
        title: "大額寶石禮包 · 獎勵調整",
        lines: [
          "新增 6,500 寶石（+30%）和 14,000 寶石（+40%）禮包，禮包越大贈送越多。",
          "各禮包首儲雙倍已結束，任何時候購買數量都相同。",
          `簽到簿的寶石與坐騎召喚券（每週 1 次）、試煉地城每日首通寶石（${FIRST_GEMS} 個）已調整。`,
        ],
      },
    },
  },
  {
    id: "2026-10-02-mercs",
    date: "2026-10-02",
    text: {
      ko: {
        title: "던전 용병",
        lines: [
          "시련의 던전 매칭이 30초 안에 4명을 못 채우면, 모인 사람끼리 출발하고 빈자리는 [용병] AI가 채워요. '혼자 입장'도 용병 3명과 함께예요.",
          "용병은 내 파티 수준에 맞춘 능력치로 싸우고, 바닥 공격 표시를 피하고, 성직자 용병은 체력이 낮은 사람을 회복해 줘요. 보상은 가져가지 않아요.",
        ],
      },
      en: {
        title: "Dungeon mercenaries",
        lines: [
          "If a Trial Dungeon match can't find four within 30 seconds, it starts with whoever is there and [Merc] AI companions fill the empty seats. Entering alone brings three mercenaries too.",
          "Mercenaries fight at about your party's strength, step out of marked attacks, and a cleric mercenary heals whoever is hurt. They take no reward.",
        ],
      },
      ja: {
        title: "ダンジョンの傭兵",
        lines: [
          "試練のダンジョンのマッチングで30秒以内に4人そろわなければ、集まった人で出発し、空いた席は[傭兵]AIが埋めます。「ひとりで入場」も傭兵3人と一緒です。",
          "傭兵はパーティーに合わせた強さで戦い、床の攻撃表示を避け、聖職者の傭兵は体力の低い人を回復します。報酬は受け取りません。",
        ],
      },
      "zh-Hant": {
        title: "地下城傭兵",
        lines: [
          "試煉地下城配對在30秒內湊不齊4人時，就由已到的人出發，空位由[傭兵]AI補上。「單人進入」也會帶著3名傭兵。",
          "傭兵會以符合隊伍的能力作戰、躲避地面攻擊標示，聖職者傭兵會治療體力低的人。傭兵不拿獎勵。",
        ],
      },
      "zh-Hans": {
        title: "地下城佣兵",
        lines: [
          "试炼地下城匹配在30秒内凑不齐4人时，就由已到的人出发，空位由[佣兵]AI补上。“单人进入”也会带着3名佣兵。",
          "佣兵会以符合队伍的能力作战、躲避地面攻击标示，圣职者佣兵会治疗体力低的人。佣兵不拿奖励。",
        ],
      },
    },
  },
  {
    id: "2026-10-02-dungeon",
    date: "2026-10-02",
    text: {
      ko: {
        title: "시련의 던전이 열렸어요",
        lines: [
          "메뉴의 '던전'(6)에서 매칭을 시작하면 모든 서버에서 비슷한 레벨끼리 최대 4명이 모여요. 매칭되면 15초 안에 '입장'을 눌러요.",
          "웨이브 2번과 보스(초급 장로 글럽·중급 설산 예티·상급 고대 드래곤)를 5분 안에 깨면 골드·강화석·장비(40%)를 우편으로 받아요. 2분 30초 안이면 골드 +50%, 그날 첫 클리어는 보석 30개.",
          "30초 안에 4명이 모이지 않으면 모인 사람끼리 출발하고 빈자리는 [용병] AI가 채워요. '혼자 입장'이나 파티장의 '파티와 바로 입장'도 있어요. 하루 3번.",
        ],
      },
      en: {
        title: "The Trial Dungeon is open",
        lines: [
          "Find a match from 'Dungeon' (6) in the menu: up to four players of like level from every server come together. Press 'Enter' within 15 seconds once matched.",
          "Clear two waves and a boss (Novice: Elder Glub, Adept: Snowpeak Yeti, Master: Ancient Dragon) within 5 minutes for gold, whetstones and a 40% chance of gear by mail. Under 2:30 adds 50% gold; the day's first clear brings 30 gems.",
          "If four aren't found within 30 seconds, it starts with whoever is there and [Merc] AI companions fill the empty seats; you can also enter alone, or as a leader with your party. Three runs a day.",
        ],
      },
      ja: {
        title: "試練のダンジョンが開きました",
        lines: [
          "メニューの「ダンジョン」（6）でマッチングを始めると、全サーバーから近いレベルの最大4人が集まります。マッチングしたら15秒以内に「入場」を押しましょう。",
          "ウェーブ2回とボス（初級 長老グラブ・中級 雪山イエティ・上級 古代ドラゴン）を5分以内に倒すと、ゴールド・強化石・装備（40%）が郵便で届きます。2分30秒以内ならゴールド+50%、その日最初のクリアは宝石30個。",
          "30秒以内に4人そろわなければ集まった人で出発し、空いた席は[傭兵]AIが埋めます。「ひとりで入場」やリーダーの「パーティーで入場」もあります。1日3回。",
        ],
      },
      "zh-Hant": {
        title: "試煉地下城開放了",
        lines: [
          "在選單的「地下城」（6）開始配對，就會從所有伺服器集合等級相近的最多4人。配對成功後請在15秒內按下「進入」。",
          "在5分鐘內擊敗2波怪物和首領（初級 長老咕嚕・中級 雪山雪怪・高級 遠古巨龍），可透過郵件獲得金幣、強化石與裝備（40%）。2分30秒內通關金幣+50%，當天首次通關獲得寶石30個。",
          "30秒內湊不齊4人時，就由已到的人出發，空位由[傭兵]AI補上。也可以「單人進入」或由隊長「與隊伍進入」。每天3次。",
        ],
      },
      "zh-Hans": {
        title: "试炼地下城开放了",
        lines: [
          "在菜单的“地下城”（6）开始匹配，就会从所有服务器集合等级相近的最多4人。匹配成功后请在15秒内按下“进入”。",
          "在5分钟内击败2波怪物和首领（初级 长老咕噜・中级 雪山雪怪・高级 远古巨龙），可通过邮件获得金币、强化石与装备（40%）。2分30秒内通关金币+50%，当天首次通关获得宝石30个。",
          "30秒内凑不齐4人时，就由已到的人出发，空位由[佣兵]AI补上。也可以“单人进入”或由队长“与队伍进入”。每天3次。",
        ],
      },
    },
  },
  {
    id: "2026-10-02-party",
    date: "2026-10-02",
    text: {
      ko: {
        title: "파티가 생겼어요",
        lines: [
          "같은 서버의 최대 4명이 파티를 맺어요. 메뉴의 '파티'(5)에서 같은 채널 사람을 초대하고, 초대를 받으면 화면 위에서 수락해요.",
          "같은 구역에 있는 파티원끼리 경험치·골드를 나눠 가져요. 인원이 많을수록 보너스가 붙고, 퀘스트 처치 수도 함께 올라요.",
          "왼쪽 위에 파티원이 보여요. 같은 구역이면 체력, 아니면 있는 곳이 나와요. 다른 채널에서 초대를 받으면 파티장 채널로 옮겨요.",
        ],
      },
      en: {
        title: "Parties are here",
        lines: [
          "Up to four players of one server can form a party. Invite people on your channel from 'Party' (5) in the menu, and accept invitations at the top of the screen.",
          "Members in the same zone share XP and gold, with a bonus that grows with the party, and count kills toward their quests together.",
          "Your party shows at the top left: health for those in your zone, where the others are. Accepting from another channel moves you to the leader's.",
        ],
      },
      ja: {
        title: "パーティーが登場",
        lines: [
          "同じサーバーの最大4人でパーティーを組めます。メニューの「パーティー」（5）から同じチャンネルの人を招待し、招待は画面上部で受けられます。",
          "同じエリアにいるメンバー同士で経験値・ゴールドを分け合います。人数が多いほどボーナスがつき、クエストの討伐数も一緒に増えます。",
          "左上にメンバーが表示されます。同じエリアなら体力、それ以外は居場所。別チャンネルで招待を受けるとリーダーのチャンネルへ移動します。",
        ],
      },
      "zh-Hant": {
        title: "新增隊伍",
        lines: [
          "同一伺服器最多4人可以組隊。在選單的「隊伍」（5）邀請同頻道的玩家，收到邀請時在畫面上方接受。",
          "同一區域的隊員共享經驗與金幣，人數越多加成越高，任務擊殺數也一起增加。",
          "左上角會顯示隊員：同一區域顯示體力，其他顯示所在位置。在其他頻道接受邀請會移動到隊長的頻道。",
        ],
      },
      "zh-Hans": {
        title: "新增队伍",
        lines: [
          "同一服务器最多4人可以组队。在菜单的“队伍”（5）邀请同频道的玩家，收到邀请时在画面上方接受。",
          "同一区域的队员共享经验与金币，人数越多加成越高，任务击杀数也一起增加。",
          "左上角会显示队员：同一区域显示体力，其他显示所在位置。在其他频道接受邀请会移动到队长的频道。",
        ],
      },
    },
  },
  {
    id: "2026-10-02-attendance",
    date: "2026-10-02",
    text: {
      ko: {
        title: "출석부와 업적",
        lines: [
          "매일 처음 들어오면 출석부에 도장이 찍히고 골드·보석·강화석이 우편으로 와요. 매주 4·7일째에는 탈것 소환권도 와요. 빠진 날이 있어도 이어서 찍히고, 7·14·21·28일째는 보석 50·80·80·200개예요.",
          "업적이 생겼어요: 레벨, 퀘스트, 사냥, 보스, 일일 퀘스트, 강화, 전직, 길드, 탈것, 출석. 목표를 채우면 보석을 받아요.",
          "메뉴의 '보상'(V)에서 보고 '모두 받기'로 한 번에 받아요. 이미 해 둔 퀘스트·보스·강화도 반영돼요. 마구간에서 소환권으로 부화하고, 화면을 누르거나 '연출 스킵'을 켜면 결과가 바로 보여요.",
        ],
      },
      en: {
        title: "Attendance and achievements",
        lines: [
          "Your first visit each day stamps the attendance sheet and mails you gold, gems or whetstones, with a mount ticket on days 4 and 7 of each week. Missed days don't break it, and days 7, 14, 21 and 28 bring 50, 80, 80 and 200 gems.",
          "Achievements are here: levels, quests, hunting, bosses, dailies, enhancing, advancing, guilds, mounts and attendance. Meet a goal to earn gems.",
          "Find them under 'Rewards' (V) in the menu, with 'Claim all'. Quests, bosses and enhancements you've already done count. At the stable, hatch with a ticket, and tap the screen (or turn on Skip) to see the result at once.",
        ],
      },
      ja: {
        title: "出席簿と実績",
        lines: [
          "毎日最初に入ると出席簿にスタンプが押され、ゴールド・宝石・強化石が郵便で届きます。毎週4・7日目には乗り物召喚券も届きます。休んだ日があっても続きから押され、7・14・21・28日目は宝石50・80・80・200個です。",
          "実績が登場：レベル、クエスト、狩り、ボス、デイリー、強化、転職、ギルド、乗り物、出席。目標を達成すると宝石がもらえます。",
          "メニューの「報酬」（V）から見られ、「すべて受け取る」で一度に受け取れます。厩舎では召喚券でふ化でき、画面をタップするか「演出スキップ」をオンにするとすぐ結果が見られます。",
        ],
      },
      "zh-Hant": {
        title: "簽到簿與成就",
        lines: [
          "每天第一次進入時會在簽到簿蓋章，並以郵件寄出金幣・寶石・強化石，每週第4・7天還有坐騎召喚券。中間缺席也會接著蓋，第7・14・21・28天是寶石50・80・80・200個。",
          "新增成就：等級、任務、狩獵、首領、每日任務、強化、轉職、公會、坐騎、簽到。達成目標即可獲得寶石。",
          "在選單的「獎勵」（V）中查看，可用「全部領取」一次領完。在馬廄可用召喚券孵化，點擊畫面或開啟「跳過動畫」即可立即看到結果。",
        ],
      },
      "zh-Hans": {
        title: "签到簿与成就",
        lines: [
          "每天第一次进入时会在签到簿盖章，并通过邮件发送金币・宝石・强化石，每周第4・7天还有坐骑召唤券。中间缺席也会接着盖，第7・14・21・28天是宝石50・80・80・200个。",
          "新增成就：等级、任务、狩猎、首领、每日任务、强化、转职、公会、坐骑、签到。达成目标即可获得宝石。",
          "在菜单的“奖励”（V）中查看，可用“全部领取”一次领完。在马厩可用召唤券孵化，点击画面或开启“跳过动画”即可立即看到结果。",
        ],
      },
    },
  },
  {
    id: "2026-10-01-plus15-league",
    date: "2026-10-01",
    text: {
      ko: {
        title: "강화 +15 · 길드 보스 주간 순위",
        lines: [
          "장비 강화가 +15까지 열렸어요. +11부터는 한 단계가 두 배의 힘을 주지만, 성공은 드물고 파괴는 잦아요(보석으로 파괴 방지 가능).",
          "길드 보스 탭에 모든 길드의 주간 순위가 생겼어요. 보스를 처치한 길드가 먼저(빠를수록 위), 나머지는 깎은 체력 비율 순이에요.",
          "주가 끝나면 1·2·3위 길드원 전원에게 보석 300·150·80, 피해량 1·2·3위에게 보석 200·100·50을 우편으로 보내요.",
        ],
      },
      en: {
        title: "Enhancing to +15 · the guild boss league",
        lines: [
          "Gear now enhances up to +15. From +11 each step is worth twice as much, but successes are rare and breaks common (gems can protect).",
          "The guild boss tab now ranks every guild by the week: guilds that felled their boss first (the sooner the higher), the rest by the share of its health taken.",
          "When the week ends, every member of the first three guilds gets 300, 150 or 80 gems, and the three who did the most damage 200, 100 or 50, by mail.",
        ],
      },
      ja: {
        title: "強化+15・ギルドボス週間ランキング",
        lines: [
          "装備強化が+15まで開放。+11からは1段階が2倍の力になりますが、成功は稀で破壊が多くなります（宝石で破壊防止可能）。",
          "ギルドボスタブに全ギルドの週間ランキングが登場。ボスを倒したギルドが先（早いほど上）、残りは削った体力の割合順です。",
          "週が終わると1・2・3位ギルドの全員に宝石300・150・80、ダメージ1・2・3位に宝石200・100・50をメールで送ります。",
        ],
      },
      "zh-Hant": {
        title: "強化+15・公會首領週排行",
        lines: [
          "裝備強化開放至+15。從+11起每一階的效果加倍，但成功稀少、損壞頻繁（可用寶石防止損壞）。",
          "公會首領分頁新增所有公會的週排行。擊敗首領的公會在前（越快越前），其餘依削減的體力比例排序。",
          "每週結束時，前三名公會的全體成員獲得寶石300・150・80，傷害前三名獲得寶石200・100・50，以郵件發送。",
        ],
      },
      "zh-Hans": {
        title: "强化+15・公会首领周排行",
        lines: [
          "装备强化开放至+15。从+11起每一阶的效果加倍，但成功稀少、损坏频繁（可用宝石防止损坏）。",
          "公会首领分页新增所有公会的周排行。击败首领的公会在前（越快越前），其余按削减的体力比例排序。",
          "每周结束时，前三名公会的全体成员获得宝石300・150・80，伤害前三名获得宝石200・100・50，以邮件发送。",
        ],
      },
    },
  },
  {
    id: "2026-10-01-vip-perks",
    date: "2026-10-01",
    text: {
      ko: {
        title: "VIP 혜택 대폭 강화",
        lines: [
          "VIP 등급마다 사냥 경험치·골드 +20% (VIP 10은 +200%).",
          "등급별 고유 혜택: 2 가방 장비 칸 +10 · 3 매일 보석 10 · 4 제자리 부활 무료 · 5 공격력·최대 체력 +10%와 금색 이름 · 6 매일 보석 30 · 7 강화 성공률 +5%p · 8 거래소 수수료 면제 · 9 강화 +10%p와 매일 보석 50 · 10 전용 신화 탈것 천상의 용.",
          "높은 등급은 아래 등급의 혜택을 모두 가져요. 보석 상점의 VIP 막대를 눌러 확인하세요.",
        ],
      },
      en: {
        title: "Much stronger VIP perks",
        lines: [
          "Each VIP rank adds 20% to hunting XP and gold (VIP 10: +200%).",
          "Each rank's own perk: 2 +10 gear slots · 3 10 gems a day · 4 free rising where you fell · 5 +10% damage and max health and a golden name · 6 30 gems a day · 7 enhancing +5 points · 8 no market fee · 9 enhancing +10 points and 50 gems a day · 10 the Celestial Dragon, a mythic of its own.",
          "A rank keeps every perk below it. Tap the VIP bar in the gem shop to see them.",
        ],
      },
      ja: {
        title: "VIP特典を大幅強化",
        lines: [
          "VIPランクごとに狩りの経験値・ゴールド+20%（VIP 10は+200%）。",
          "ランク別特典：2 装備枠+10 · 3 毎日宝石10 · 4 その場復活無料 · 5 攻撃力・最大体力+10%と金色の名前 · 6 毎日宝石30 · 7 強化成功率+5%p · 8 取引所手数料免除 · 9 強化+10%pと毎日宝石50 · 10 専用神話の乗り物「天上の竜」。",
          "上のランクは下のランクの特典をすべて持ちます。宝石ショップのVIPバーで確認できます。",
        ],
      },
      "zh-Hant": {
        title: "VIP福利大幅強化",
        lines: [
          "每個VIP等級狩獵經驗與金幣+20%（VIP 10為+200%）。",
          "各級專屬福利：2 裝備格+10 · 3 每天寶石10 · 4 原地復活免費 · 5 攻擊力與最大體力+10%、金色名字 · 6 每天寶石30 · 7 強化成功率+5%p · 8 交易所免手續費 · 9 強化+10%p、每天寶石50 · 10 專屬神話坐騎天上之龍。",
          "高等級擁有所有較低等級的福利。點擊寶石商店的VIP條即可查看。",
        ],
      },
      "zh-Hans": {
        title: "VIP福利大幅强化",
        lines: [
          "每个VIP等级狩猎经验与金币+20%（VIP 10为+200%）。",
          "各级专属福利：2 装备格+10 · 3 每天宝石10 · 4 原地复活免费 · 5 攻击力与最大体力+10%、金色名字 · 6 每天宝石30 · 7 强化成功率+5%p · 8 交易所免手续费 · 9 强化+10%p、每天宝石50 · 10 专属神话坐骑天上之龙。",
          "高等级拥有所有较低等级的福利。点击宝石商店的VIP条即可查看。",
        ],
      },
    },
  },
  {
    id: "2026-10-01-mythic",
    date: "2026-10-01",
    text: {
      ko: {
        title: "신화 탈것 · 10연속 부화 · 천장 · 전투력 랭킹",
        lines: [
          "전설 위 신화 등급이 생겼어요: 황금 용, 심연의 황제 (확률 0.1%).",
          "10연속 부화는 보석 900개(10% 할인)이고 희귀 이상 1개를 보장해요.",
          "천장: 100회 안에 전설 이상이 없으면 다음은 전설 확정, 500회 안에 신화가 없으면 다음은 신화 확정이에요.",
          "랭킹에 전투력 탭이 생겼어요. 전투력 1위를 차지하면 모든 서버에 알려져요.",
          "보석 상점의 VIP 막대를 누르면 등급별 혜택을 볼 수 있어요.",
        ],
      },
      en: {
        title: "Mythic mounts, hatch ten, pity, a power board",
        lines: [
          "A mythic tier above legendary: the Golden Dragon and the Void Emperor (0.1%).",
          "Hatch ten for 900 gems (10% off), with a rare or better promised.",
          "Pity: no legendary or better in 100 draws makes the next one legendary; no mythic in 500 makes the next one mythic.",
          "The ranking has a power board; taking its first place is told to every server.",
          "Tap the VIP bar in the gem shop to see every rank's perks.",
        ],
      },
      ja: {
        title: "神話の乗り物・10連ふ化・天井・戦闘力ランキング",
        lines: [
          "伝説の上に神話ランクが登場：黄金の竜、深淵の皇帝（確率0.1%）。",
          "10連ふ化は宝石900個（10%オフ）、レア以上1つ確定。",
          "天井：100回以内に伝説以上が出なければ次は伝説確定、500回以内に神話が出なければ次は神話確定。",
          "ランキングに戦闘力タブが追加。戦闘力1位になると全サーバーに告知されます。",
          "宝石ショップのVIPバーを押すとランク別特典が見られます。",
        ],
      },
      "zh-Hant": {
        title: "神話坐騎、10連孵化、保底、戰鬥力排行",
        lines: [
          "傳說之上新增神話等級：黃金龍、深淵皇帝（機率0.1%）。",
          "10連孵化需寶石900個（9折），保底稀有以上1個。",
          "保底：100次內沒有傳說以上，下一次必為傳說；500次內沒有神話，下一次必為神話。",
          "排行新增戰鬥力分頁，登上戰鬥力第一會全服公告。",
          "點擊寶石商店的VIP條可查看各等級福利。",
        ],
      },
      "zh-Hans": {
        title: "神话坐骑、10连孵化、保底、战斗力排行",
        lines: [
          "传说之上新增神话等级：黄金龙、深渊皇帝（概率0.1%）。",
          "10连孵化需宝石900个（9折），保底稀有以上1个。",
          "保底：100次内没有传说以上，下一次必为传说；500次内没有神话，下一次必为神话。",
          "排行新增战斗力分页，登上战斗力第一会全服公告。",
          "点击宝石商店的VIP条可查看各等级福利。",
        ],
      },
    },
  },
  {
    id: "2026-10-01-premium",
    date: "2026-10-01",
    text: {
      ko: {
        title: "VIP · 월정액 · 첫 구매 2배 · 파괴 방지",
        lines: [
          "보석 상품마다 첫 구매는 보석이 2배예요. (2026-10-06에 끝났어요)",
          `보석을 살수록 VIP 등급(1~10)이 올라요. 등급마다 사냥 경험치·골드 +${VIP_PCT}%, 이름 옆에 VIP 표시가 붙어요.`,
          `월정액: 즉시 보석 300개, 30일 동안 매일 첫 접속 때 보석 ${PASS_GEMS_DAILY}개(우편), 기간 중 경험치 +${PASS_XP_PCT}%.`,
          "대장간에서 +6 이상 강화할 때 보석으로 파괴를 막을 수 있어요.",
        ],
      },
      en: {
        title: "VIP, the monthly pass, first purchase ×2, protection",
        lines: [
          "Each gem pack's first purchase gives double gems. (Ended on 2026-10-06.)",
          `The more gems you buy, the higher your VIP rank (1-10): +${VIP_PCT}% hunting XP and gold a rank, and a VIP mark by your name.`,
          `Monthly pass: 300 gems now, ${PASS_GEMS_DAILY} more on your first visit each day for 30 days (by mail), and +${PASS_XP_PCT}% XP while it lasts.`,
          "At the smith, gems can keep enhancements at +6 and up from breaking your gear.",
        ],
      },
      ja: {
        title: "VIP・月額パス・初回2倍・破壊防止",
        lines: [
          "宝石商品ごとに初回購入は宝石2倍です。（2026-10-06に終了）",
          `宝石を買うほどVIPランク（1〜10）が上がります。ランクごとに狩りの経験値・ゴールド+${VIP_PCT}%、名前の横にVIPマークが付きます。`,
          `月額パス：すぐに宝石300個、30日間毎日最初のログインで宝石${PASS_GEMS_DAILY}個（郵便）、期間中は経験値+${PASS_XP_PCT}%。`,
          "鍛冶屋で+6以上の強化時、宝石で破壊を防げます。",
        ],
      },
      "zh-Hant": {
        title: "VIP、月卡、首購2倍、防破壞",
        lines: [
          "每種寶石商品首次購買可得2倍寶石。（已於 2026-10-06 結束）",
          `買越多寶石，VIP等級（1~10）越高。每級狩獵經驗與金幣+${VIP_PCT}%，名字旁會顯示VIP標記。`,
          `月卡：立得寶石300個，30天內每天首次登入得寶石${PASS_GEMS_DAILY}個（郵件），期間經驗+${PASS_XP_PCT}%。`,
          "在鐵匠處強化+6以上時，可用寶石防止裝備被破壞。",
        ],
      },
      "zh-Hans": {
        title: "VIP、月卡、首购2倍、防破坏",
        lines: [
          "每种宝石商品首次购买可得2倍宝石。（已于 2026-10-06 结束）",
          `买越多宝石，VIP等级（1~10）越高。每级狩猎经验与金币+${VIP_PCT}%，名字旁会显示VIP标记。`,
          `月卡：立得宝石300个，30天内每天首次登录得宝石${PASS_GEMS_DAILY}个（邮件），期间经验+${PASS_XP_PCT}%。`,
          "在铁匠处强化+6以上时，可用宝石防止装备被破坏。",
        ],
      },
    },
  },
  {
    id: "2026-10-01-free",
    date: "2026-10-01",
    text: {
      ko: {
        title: "이제 게임 전체가 무료예요",
        lines: [
          "모든 지역(숲·버섯왕의 공터·설산)과 6개 직업을 누구나 즐길 수 있어요. 지역마다 필요한 레벨만 있어요.",
          "모든 계정에 사슴 탈것이 기본으로 생겼어요.",
          "보석으로 탈것을 뽑고, 거래소에서 다른 사람과 장비·재료를 사고팔 수 있어요.",
        ],
      },
      en: {
        title: "The whole game is free now",
        lines: [
          "Every region (the forest, the Mushroom King's Clearing, the snow) and all six classes are open to everyone; each region only asks for a level.",
          "Every account has a deer to ride.",
          "Draw mounts with gems, and trade gear and materials with others at the market.",
        ],
      },
      ja: {
        title: "ゲーム全体が無料になりました",
        lines: [
          "すべての地域（森・キノコ王の広場・雪山）と6つの職業を誰でも遊べます。地域ごとに必要なレベルだけがあります。",
          "すべてのアカウントにシカの乗り物が付きました。",
          "宝石で乗り物を引き、取引所で他のプレイヤーと装備・素材を売買できます。",
        ],
      },
      "zh-Hant": {
        title: "整個遊戲現在完全免費",
        lines: [
          "所有地區（森林、蘑菇王空地、雪山）與6個職業人人都能玩，各地區只有等級要求。",
          "所有帳號都有鹿坐騎。",
          "用寶石抽坐騎，也能在交易所與其他玩家買賣裝備與材料。",
        ],
      },
      "zh-Hans": {
        title: "整个游戏现在完全免费",
        lines: [
          "所有地区（森林、蘑菇王空地、雪山）与6个职业人人都能玩，各地区只有等级要求。",
          "所有账号都有鹿坐骑。",
          "用宝石抽坐骑，也能在交易所与其他玩家买卖装备与材料。",
        ],
      },
    },
  },
  {
    id: "2026-09-30-market-each",
    date: "2026-09-30",
    text: {
      ko: {
        title: "거래소 개당 가격과 모바일 화면 개선",
        lines: [
          "재료는 이제 개당 보석으로 팔고, 사는 사람은 원하는 개수만큼 살 수 있어요. 남은 개수는 그대로 매물로 남아요.",
          "개수와 가격은 « ‹ › » 화살표로 조절해요. 누르고 있으면 빠르게 바뀌어요.",
          "골드와 보석이 화면 오른쪽 위에 항상 보여요.",
          "모바일에서 채팅 입력 중에도 화면이 작아지지 않고, 화면이 더 선명해졌어요.",
        ],
      },
      en: {
        title: "Market prices by the one, and a better phone screen",
        lines: [
          "Materials are now priced per item in gems, and buyers take as many as they like; the rest stays listed.",
          "Set counts and prices with the « ‹ › » arrows; hold one down to change it quickly.",
          "Your gold and gems always show at the top right.",
          "On phones, typing in chat no longer shrinks the game, and the picture is sharper.",
        ],
      },
      ja: {
        title: "取引所の1個単位価格とモバイル画面の改善",
        lines: [
          "素材は1個あたりの宝石価格で売れるようになり、買う人は好きな数だけ買えます。残りは出品されたままです。",
          "数と価格は « ‹ › » の矢印で調整します。押し続けると速く変わります。",
          "ゴールドと宝石が画面右上に常に表示されます。",
          "モバイルでチャット入力中も画面が小さくならず、画面がより鮮明になりました。",
        ],
      },
      "zh-Hant": {
        title: "交易所單價販售與手機畫面改善",
        lines: [
          "材料現在以每個的寶石價格販售，買家可以買任意數量，剩下的會繼續上架。",
          "數量與價格用 « ‹ › » 箭頭調整，按住可快速變動。",
          "金幣與寶石會一直顯示在畫面右上角。",
          "手機上輸入聊天時畫面不再縮小，畫面也更清晰了。",
        ],
      },
      "zh-Hans": {
        title: "交易所单价出售与手机画面改善",
        lines: [
          "材料现在以每个的宝石价格出售，买家可以买任意数量，剩下的会继续上架。",
          "数量与价格用 « ‹ › » 箭头调整，按住可快速变动。",
          "金币与宝石会一直显示在画面右上角。",
          "手机上输入聊天时画面不再缩小，画面也更清晰了。",
        ],
      },
    },
  },
  {
    id: "2026-09-30-fourth-skill",
    date: "2026-09-30",
    text: {
      ko: {
        title: "Lv40 네 번째 스킬과 WASD 이동",
        lines: [
          "전직한 캐릭터는 Lv40에 전직 갈래마다 다른 네 번째 스킬을 배워요 (12종, 금테 아이콘).",
          "스킬 칸이 4개가 됐어요. 스킬 창(K)에서 4번 칸으로 끌어다 놓고 4번 키로 써요.",
          "네 번째 스킬은 재사용이 40~60초로 길지만 갈래의 가장 강한 한 방이에요.",
          "키보드로 WASD(또는 방향키) 이동이 돼요. 시점은 전처럼 마우스를 끌어서 돌려요.",
        ],
      },
      en: {
        title: "A fourth skill at Lv40, and WASD walking",
        lines: [
          "Advanced characters learn a fourth skill at Lv40, different for every path (12 in all, gold-rimmed icons).",
          "The bar has four slots now: drag it into slot 4 from the skill window (K) and use it with key 4.",
          "Its cooldown is long (40-60s), but it is the path's strongest move.",
          "You can walk with WASD (or the arrow keys). The view still turns by dragging the mouse.",
        ],
      },
      ja: {
        title: "Lv40の4つ目のスキルとWASD移動",
        lines: [
          "転職したキャラクターはLv40で、転職先ごとに異なる4つ目のスキルを覚えます（全12種、金枠アイコン）。",
          "スキル枠が4つになりました。スキル画面（K）から4番枠にドラッグし、4キーで使います。",
          "4つ目のスキルは再使用40〜60秒と長いですが、転職先で最も強力な一撃です。",
          "キーボードのWASD（または矢印キー）で移動できます。視点は今まで通りマウスのドラッグで回します。",
        ],
      },
      "zh-Hant": {
        title: "Lv40第四個技能與WASD移動",
        lines: [
          "轉職後的角色在Lv40會學會各轉職路線不同的第四個技能（共12種，金框圖示）。",
          "技能欄增加為4格。在技能視窗（K）拖到第4格，按4鍵使用。",
          "第四個技能冷卻較長（40~60秒），但是該路線最強的一擊。",
          "可以用WASD（或方向鍵）移動。視角仍與以往相同，以滑鼠拖曳轉動。",
        ],
      },
      "zh-Hans": {
        title: "Lv40第四个技能与WASD移动",
        lines: [
          "转职后的角色在Lv40会学会各转职路线不同的第四个技能（共12种，金框图标）。",
          "技能栏增加为4格。在技能窗口（K）拖到第4格，按4键使用。",
          "第四个技能冷却较长（40~60秒），但是该路线最强的一击。",
          "可以用WASD（或方向键）移动。视角仍与以往相同，以鼠标拖拽转动。",
        ],
      },
    },
  },
  {
    id: "2026-09-30-snow-quests",
    date: "2026-09-30",
    text: {
      ko: {
        title: "설산 퀘스트와 보스 '빙하의 황제'",
        lines: [
          "대장 브란의 메인 퀘스트 8개가 이어져요. 보상으로 6등급 장비와 설산 재료를 받아요.",
          "설산 기슭 · 얼음 협곡 · 만년설 봉우리 일일 퀘스트가 생겼어요 (퀘스트 창에서 페이지를 넘겨요).",
          "빙하의 제단(Lv55)에 보스 '빙하의 황제'가 나타나요. 바닥 표시를 보고 얼음 창·눈보라·얼음 웅덩이를 피하세요.",
          "빙하의 황제는 쓰러지고 5분 뒤 다시 나타나고, 7등급 빙하왕 장비를 떨어뜨려요.",
        ],
      },
      en: {
        title: "Snow quests and the Glacier Emperor",
        lines: [
          "Captain Bran's eight main quests carry the story on, paying tier 6 gear and the snow's materials.",
          "New dailies for the Snowy Foothills, the Ice Canyon and the Everfrost Peaks (turn the page in the quest log).",
          "The Glacier Emperor waits at the Glacier Altar (Lv55). Watch the ground and dodge its ice spears, blizzard and ice pools.",
          "It comes back five minutes after it falls, and drops tier 7 Glacierking gear.",
        ],
      },
      ja: {
        title: "雪山クエストとボス「氷河の皇帝」",
        lines: [
          "隊長ブランのメインクエスト8つが続きます。報酬は6等級装備と雪山の素材です。",
          "雪山のふもと・氷の峡谷・万年雪の峰のデイリークエストが登場（クエスト画面でページをめくります）。",
          "氷河の祭壇（Lv55）にボス「氷河の皇帝」が現れます。地面の表示を見て氷の槍・吹雪・氷の水たまりを避けましょう。",
          "倒れて5分後に再び現れ、7等級の氷河王装備を落とします。",
        ],
      },
      "zh-Hant": {
        title: "雪山任務與首領「冰河皇帝」",
        lines: [
          "隊長布蘭的8個主線任務接續登場，獎勵6級裝備與雪山材料。",
          "新增雪山山麓、冰之峽谷、萬年雪峰的每日任務（在任務視窗翻頁）。",
          "冰河祭壇（Lv55）出現首領「冰河皇帝」。注意地面標記，躲開冰槍、暴風雪與冰池。",
          "倒下5分鐘後會再次出現，並掉落7級冰河王裝備。",
        ],
      },
      "zh-Hans": {
        title: "雪山任务与首领“冰河皇帝”",
        lines: [
          "队长布兰的8个主线任务接续登场，奖励6级装备与雪山材料。",
          "新增雪山山麓、冰之峡谷、万年雪峰的每日任务（在任务窗口翻页）。",
          "冰河祭坛（Lv55）出现首领“冰河皇帝”。注意地面标记，躲开冰枪、暴风雪与冰池。",
          "倒下5分钟后会再次出现，并掉落7级冰河王装备。",
        ],
      },
    },
  },
  {
    id: "2026-09-30-snow-region",
    date: "2026-09-30",
    text: {
      ko: {
        title: "새 지역: 설산 (Lv40~60)",
        lines: [
          "깊은 숲 동쪽 포털 너머에 설산 전초기지가 열렸어요 (Lv38부터, 정식판).",
          "설산 기슭(Lv40) · 얼음 협곡(Lv47) · 만년설 봉우리(Lv54)에 새 몬스터 11종이 살아요.",
          "전초기지에는 상인, 대장장이, 퀘스트를 맡는 대장 브란이 있어요. 설산에서 쓰러지면 전초기지로 돌아와요.",
          "새 장비 6등급(서리송곳)·7등급(빙하왕)과 새 재료 서리 결정·설원 가죽·만년빙이 생겼어요.",
          "설산의 보스와 퀘스트, Lv40 네 번째 스킬도 곧 이어서 열려요!",
        ],
      },
      en: {
        title: "New region: the Snow (Lv40-60)",
        lines: [
          "Past the deep forest's east portal, the Snow Outpost is open (from Lv38, full game).",
          "Eleven new monsters live in the Snowy Foothills (Lv40), the Ice Canyon (Lv47) and the Everfrost Peaks (Lv54).",
          "The outpost has a merchant, a smith and Captain Bran for quests. Fall in the snow and you come back to the outpost.",
          "New tier 6 (Frostfang) and tier 7 (Glacierking) gear, and new materials: frost shards, snowfield fur and everice.",
          "The snow's boss, its quests and the fourth skill at Lv40 are coming next!",
        ],
      },
      ja: {
        title: "新地域：雪山（Lv40〜60）",
        lines: [
          "深い森の東の転送門の先に雪山前哨基地が開きました（Lv38から、製品版）。",
          "雪山のふもと（Lv40）・氷の峡谷（Lv47）・万年雪の峰（Lv54）に新しいモンスター11種が住んでいます。",
          "前哨基地には商人、鍛冶屋、クエスト担当の隊長ブランがいます。雪山で倒れると前哨基地に戻ります。",
          "新装備6等級（霜牙）・7等級（氷河王）と、新素材の霜の結晶・雪原の毛皮・万年氷が登場しました。",
          "雪山のボスとクエスト、Lv40の4つ目のスキルもまもなく！",
        ],
      },
      "zh-Hant": {
        title: "新地區：雪山（Lv40~60）",
        lines: [
          "深林東側傳送門的另一端，雪山前哨站開放了（Lv38起，正式版）。",
          "雪山山麓（Lv40）、冰之峽谷（Lv47）、萬年雪峰（Lv54）住著11種新怪物。",
          "前哨站有商人、鐵匠，以及負責任務的隊長布蘭。在雪山倒下會回到前哨站。",
          "新增6級（霜牙）、7級（冰河王）裝備，以及新材料霜之結晶、雪原毛皮、萬年冰。",
          "雪山首領、任務與Lv40第四個技能即將推出！",
        ],
      },
      "zh-Hans": {
        title: "新地区：雪山（Lv40~60）",
        lines: [
          "深林东侧传送门的另一端，雪山前哨站开放了（Lv38起，正式版）。",
          "雪山山麓（Lv40）、冰之峡谷（Lv47）、万年雪峰（Lv54）住着11种新怪物。",
          "前哨站有商人、铁匠，以及负责任务的队长布兰。在雪山倒下会回到前哨站。",
          "新增6级（霜牙）、7级（冰河王）装备，以及新材料霜之结晶、雪原毛皮、万年冰。",
          "雪山首领、任务与Lv40第四个技能即将推出！",
        ],
      },
    },
  },
  {
    id: "2026-09-30-mount-stars",
    date: "2026-09-30",
    text: {
      ko: {
        title: "탈것 돌파와 전체 공지",
        lines: [
          "이미 가진 탈것이 알에서 또 나오면 이제 돌파해서 별(★)이 올라요. 별 하나마다 보너스 +20%, ★5면 2배(전설 공격 +60%, 체력 +200).",
          "★5가 된 탈것이 또 나오면 전처럼 보석 30개를 돌려받아요.",
          "전설 탈것 획득, ★5 돌파, +8 이상 강화 성공, 길드 보스 처치는 모든 서버에 공지돼요. 설정에서 끌 수 있어요.",
        ],
      },
      en: {
        title: "Mount breakthroughs and announcements",
        lines: [
          "A mount you already own, hatched again, now breaks through: a star (★) more. Each star adds 20% to its bonus; ★5 doubles it (a legendary gives +60% power, +200 health).",
          "Past ★5 a repeat comes back as 30 gems, as before.",
          "Legendary mounts, ★5 breakthroughs, enhancements to +8 and past, and guild bosses slain are announced to every server. You can turn this off in Settings.",
        ],
      },
      ja: {
        title: "乗り物の突破と全体告知",
        lines: [
          "持っている乗り物が卵からまた出ると、突破して星(★)が上がります。星1つごとにボーナス+20%、★5で2倍（レジェンドは攻撃+60%、体力+200）。",
          "★5の乗り物がまた出ると、これまで通り宝石30個が戻ります。",
          "レジェンド乗り物の獲得、★5突破、+8以上の強化成功、ギルドボス撃破は全サーバーに告知されます。設定でオフにできます。",
        ],
      },
      "zh-Hant": {
        title: "坐騎突破與全服公告",
        lines: [
          "蛋裡再次孵出已擁有的坐騎時會突破，星級(★)提升。每顆星加成+20%，★5為2倍（傳說坐騎攻擊+60%、體力+200）。",
          "★5的坐騎再次出現時，與以前一樣退還30顆寶石。",
          "獲得傳說坐騎、★5突破、強化+8以上成功、擊敗公會首領會向全服公告，可在設定中關閉。",
        ],
      },
      "zh-Hans": {
        title: "坐骑突破与全服公告",
        lines: [
          "蛋里再次孵出已拥有的坐骑时会突破，星级(★)提升。每颗星加成+20%，★5为2倍（传说坐骑攻击+60%、体力+200）。",
          "★5的坐骑再次出现时，与以前一样退还30颗宝石。",
          "获得传说坐骑、★5突破、强化+8以上成功、击败公会首领会向全服公告，可在设置中关闭。",
        ],
      },
    },
  },
  {
    id: "2026-09-30-guild-boss",
    date: "2026-09-30",
    text: {
      ko: {
        title: "길드 보스가 나타났어요",
        lines: [
          "길드 패널의 '보스' 탭에서 길드 전용 보스방(방마다 최대 6명)에 들어가요. 서버와 채널이 달라도 같은 방에서 함께 싸울 수 있어요.",
          "보스 체력은 길드 전체가 한 주 동안 함께 깎아요. 한 사람은 하루 한 번, 3분씩 (Lv10 이상).",
          "매주 고대 드래곤 → 설산 예티 → 장로 글럽이 번갈아 나와요.",
          "바닥에 빨간 표시가 뜨면 곧 공격이 떨어져요. 막기로는 못 막으니 표시 밖으로 피하세요! 보라색 장판은 서 있으면 계속 아파요.",
          "25·50·75%와 처치 때 그 주에 참여한 길드원 모두에게 우편 보상. 처치하면 거래 가능 장비를 받아요 (기여 1~3위는 최상급).",
          "버섯왕의 내리찍기도 같은 바닥 표시로 바뀌었어요.",
        ],
      },
      en: {
        title: "Guild bosses are here",
        lines: [
          "From the 'Boss' tab of the guild panel, go into your guild's own boss rooms (up to 6 each). Guildmates on other servers and channels fight in the same room.",
          "The whole guild wears the boss down over the week. Each character goes in once a day for 3 minutes (Lv10+).",
          "Ancient Dragon, Snowpeak Yeti and Elder Glub take turns week by week.",
          "Red marks on the ground mean a blow is about to land. Blocking does not help: step out! Purple pools keep hurting while you stand in them.",
          "At 25, 50 and 75% and when it falls, everyone who fought that week gets mail. Slaying it brings tradable gear (the best for the top 3).",
          "The Mushroom King's slam now shows the same ground mark.",
        ],
      },
      ja: {
        title: "ギルドボスが現れました",
        lines: [
          "ギルドパネルの「ボス」タブから、ギルド専用のボス部屋（1部屋最大6人）に入れます。サーバーやチャンネルが違っても同じ部屋で一緒に戦えます。",
          "ボスの体力はギルド全体で1週間かけて削ります。1人1日1回、3分ずつ（Lv10以上）。",
          "毎週、古代ドラゴン → 雪山イエティ → 長老グラブが交代で現れます。",
          "地面に赤い印が出たらまもなく攻撃が来ます。防御では防げないので印の外へ避けましょう！紫の沼は立っている間ずっとダメージを受けます。",
          "25・50・75%と撃破時に、その週の参加者全員へ郵便で報酬。撃破すると取引可能な装備がもらえます（貢献1〜3位は最上級）。",
          "キノコ王の叩きつけも同じ地面の印になりました。",
        ],
      },
      "zh-Hant": {
        title: "公會首領登場",
        lines: [
          "從公會面板的「首領」分頁進入公會專屬首領房（每房最多6人）。不同伺服器、頻道的成員也能在同一房間並肩作戰。",
          "首領體力由整個公會一週內共同削減。每個角色每天一次，每次3分鐘（Lv10以上）。",
          "每週輪流出現遠古巨龍 → 雪山雪怪 → 長老咕嚕。",
          "地面出現紅色標示代表攻擊即將落下，防禦擋不住，請移出標示範圍！紫色地面站在上面會持續受傷。",
          "達到25、50、75%與擊敗時，當週參與的成員全員以郵件獲得獎勵。擊敗可獲得可交易裝備（貢獻前3名為最高級）。",
          "蘑菇王的重擊也改為相同的地面標示。",
        ],
      },
      "zh-Hans": {
        title: "公会首领登场",
        lines: [
          "从公会面板的“首领”标签进入公会专属首领房（每房最多6人）。不同服务器、频道的成员也能在同一房间并肩作战。",
          "首领体力由整个公会一周内共同削减。每个角色每天一次，每次3分钟（Lv10以上）。",
          "每周轮流出现远古巨龙 → 雪山雪怪 → 长老咕噜。",
          "地面出现红色标示代表攻击即将落下，防御挡不住，请移出标示范围！紫色地面站在上面会持续受伤。",
          "达到25、50、75%与击败时，当周参与的成员全员以邮件获得奖励。击败可获得可交易装备（贡献前3名为最高级）。",
          "蘑菇王的重击也改为相同的地面标示。",
        ],
      },
    },
  },
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
          "팔리면 수수료 5%를 뺀 보석이, 산 물건은 그대로 우편으로 와요. 거래소에서 산 물건은 다시 팔 수 있어요. (2026-10-06부터 수수료 10%)",
          "매물은 한 번에 10개까지, 48시간 동안 올라가요. 안 팔리거나 내리면 우편으로 돌아와요.",
          "모은 보석으로 마구간에서 탈것을 뽑아 보세요!",
        ],
      },
      en: {
        title: "The market is open",
        lines: [
          "Buy and sell tradable gear and materials for gems under 'Market' in the menu. Every server shares one market.",
          "Gear sells a piece at a time with its +, materials as a bundle. Gear starts at 10 gems, a bundle at 1.",
          "When something sells, the gems (less a 5% fee) come by mail, and what you buy comes by mail as it was. Bought things can be sold again. (The fee is 10% from 2026-10-06.)",
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
