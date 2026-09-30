# 길드 — 설계

모든 서버가 함께 쓰는 길드. **캐릭터**가 가입한다(캐릭터마다 다른 길드 가능). 첫 버전은 기본 기능과 길드 채팅. 길드
보스는 다음 단계에서 이 위에 붙인다.

## 1. 규칙 (`src/game/account/guild.ts`)

- 창설 `GUILD_COST = 10000` 골드. 이름 2~12자(닉네임과 같은 글자 규칙), 전체에서 겹치지 않음(대소문자·공백 무시 키).
- 인원 `GUILD_MAX = 30`. 권한 `master`(1) / `vice`(최대 3) / `member`.
- 가입: 캐릭터가 신청 → master·vice가 수락/거절. 길드당 대기 신청 최대 20, 캐릭터당 동시 신청 최대 3.
- 탈퇴·추방 뒤 `REJOIN_MS = 24시간` 동안 가입 불가(신청도 불가).
- 추방: master는 누구나, vice는 member만. 권한 변경(vice 임명·해임)과 위임(master 넘기기)은 master만.
- 해산: master만, 혼자 남았을 때만. master가 탈퇴하려면 먼저 위임해야 한다.
- 공지 한 줄 60자(master·vice).
- 권한 판정은 순수 함수로: `canKick(actor, target)`, `canPromote(actor)`, `canAccept(actor)` 등.

## 2. 저장

- 컬렉션 `guilds`: 한 행이 길드 하나
  `{ id, name, key, members: { characterId, account, name, role, joined }[], applicants: { characterId, account, name, at }[], notice, made }`.
  길드를 바꾸는 요청은 모두 `guild:<id>` 잠금 안에서. 창설은 이름 키로 `guildname:<key>` 잠금.
- 캐릭터: `guild: { id, name } | null`, `guildLeftAt: number`(재가입 대기). 길드 행이 진실이고 캐릭터 쪽은 사본이라,
  읽을 때 행에 없으면 `null`로 본다(추방당한 캐릭터가 오프라인이어도 맞게).
- 다른 계정의 캐릭터를 바꿀 때(추방·수락)는 그 계정의 프로필 잠금 안에서.
- 신청 중인 캐릭터의 목록: 캐릭터에 `applied: guildId[]`.

## 3. 서버 원격 함수

`createGuild(name)`, `findGuilds(query)`(이름 검색 또는 인원 적은 순 20개), `getGuild()`(내 길드: 길드원과 접속 여부·서버·채널·구역,
신청 목록은 master·vice에게만), `applyGuild(id)`, `cancelApplication(id)`, `answerApplication(characterId, accept)`,
`leaveGuild()`, `kickMember(characterId)`, `setRole(characterId, role)`, `passMaster(characterId)`, `setNotice(text)`,
`disbandGuild()`, `guildSay(text)`, `guildChat(since)`.

- 접속 여부: 친구 목록과 같은 방식(계정의 `lastSeenAt`·`where`), 그리고 그 계정이 지금 이 캐릭터를 플레이 중인지.
- 머리 위 이름: `zoneLook`에 `guild` 이름을 더해 방의 모두가 본다. 가입·탈퇴·추방 시 방에 있으면 모습을 갱신한다.

## 4. 길드 채팅

- Verse8의 즉시 전송은 같은 방 안에서만 되므로, 길드 채팅은 컬렉션 `guildChat`(`{ guild, name, text, at }`)에 쓰고
  화면이 가져간다. 길드 탭이 열려 있으면 5초, 닫혀 있으면 30초마다 `guildChat(since)`.
- 길드마다 최근 50줄만 남긴다(쓸 때 오래된 것을 지움). 글자 수·속도 제한은 채널 채팅과 같다(`readChat`·`chatAllowed`,
  기록은 계정 state `guildChatAt`).
- 길드원이 아니면 읽기·쓰기 거부.

## 5. 화면

- `src/ui/GuildPanel.tsx`
  - 길드 없음: 길드 찾기(검색·목록·신청), 내 신청 취소, 창설(이름, 10,000골드).
  - 길드 있음: 공지, 길드원 목록(이름·직업·레벨·권한·접속 위치), 신청 관리(master·vice), 길드원 메뉴(추방·권한·위임),
    탈퇴·해산.
- 채팅창에 `채널` / `길드` 탭. 새 길드 글이 있으면 탭에 점.
- 머리 위 이름 아래 `<길드명>`(작게).
- 메뉴 그리드에 `길드` 버튼. 신청이 와 있으면(master·vice) 빨간 점.
- 문구 5개 언어.

## 6. 테스트

- `guild.ts`: 권한 판정 표 전부, 이름 규칙, 재가입 대기 경계.
- 서버: 이름 중복, 골드 부족, 인원 상한, 이미 길드가 있으면 신청 불가, 두 길드에서 동시에 수락돼도 한 길드만, vice 3명 한도,
  해산 조건, 추방 뒤 24시간 재가입 불가, 길드원 아닌 채팅 거부, 채팅 50줄 유지.
