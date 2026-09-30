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
