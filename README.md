# Grove Hunters (초록숲 사냥꾼)

숲을 무대로 한 웹 MMORPG. 마을에서 시작해 숲 필드 1(무료), 숲 필드 2, 버섯왕의 공터(정식판)로 나아가며 몬스터를
사냥해 레벨을 올린다. 직업 6개, 서버마다 캐릭터 여러 개, 채널당 10명. Verse8 배포 대상,
Vite + React + TypeScript + Three.js. (Verse8 GitLab 저장소 이름 `traitor-hunt`는 예전 작업명으로, 배포 연결 때문에 그대로 둔다.)

- 기획: [docs/superpowers/specs/2026-09-17-traitor-hunt-design.md](docs/superpowers/specs/2026-09-17-traitor-hunt-design.md)
- 구현 계획: [docs/superpowers/plans/](docs/superpowers/plans/)
- 에셋 출처와 라이선스: [docs/licenses/asset-provenance.md](docs/licenses/asset-provenance.md)

## 현재 상태

오픈월드 RPG로의 전환(P6)이 끝났다. 처음의 배신자·빙의·투표 매치는 모두 지웠다.

- **들어가기**: 서버 고르기 → 캐릭터 고르기(서버마다 최대 4개, 만들 때 직업 6종과 외형을 정하면 바꿀 수 없다) →
  마지막으로 있던 구역으로 입장.
- **세계**: 초록숲 마을 · 숲 필드 1 · 숲 필드 2 · 깊은 숲 · 버섯왕의 공터. 구역 가장자리의 포털로 오간다.
  한 구역은 채널(Verse8 방)로 나뉘고 채널당 10명. 마을에는 집과 상인·촌장이 있고, 먼 언덕에는 성이 서 있다.
- **성장**: 사냥·퀘스트로 경험치, 레벨 30에 전직(직업마다 두 갈래). 직업별 스킬 3개(1·2·3)와 재사용 대기시간.
- **물건**: 몬스터 드롭과 골드, 가방, 장비가 능력치를 바꾼다. 마을 상점, 대장간에서 +1~+10 강화와 재료 제작.
- **할 일**: 촌장이 주는 퀘스트 줄기와 필드마다의 일일 퀘스트, 퀘스트 추적기와 완료 패널.
- **함께**: 채널 채팅(머리 위 말풍선), 친구, 파티, 전투력과 레벨 기준 랭킹, 캐릭터 시트.
- **지도**: 화면 구석의 미니맵과 N으로 여는 구역 전체 지도. 땅과 숲은 게임이 밟고 다니는 사진 그대로, 출입구는
  포털의 마법진, 마을 사람은 각자의 아이콘. 큰 지도에서 한 곳을 누르면 그리로 걸어간다.
- **편의**: 자동 전투와 자동 물약, 절전 화면과 화면 켜짐 유지, 접히는 메뉴 버튼, 모바일 터치 조작, 설정 패널.
- **결제(500 VX)**: 무료로 마을·숲 필드 1·레벨 10까지. 구매하면 숲 필드 2, 깊은 숲, 보스 구역과 레벨 제한이 열린다.

조작: WASD 이동, Space 점프, 마우스 시점·공격, 1·2·3 스킬, Q 물약, E 대화, J 퀘스트 수행, Enter 채팅,
M 메뉴 접기·펴기, N 지도, I 가방, K 스킬, L 퀘스트, O 랭킹, U 대장간, B 절전, P 설정, Escape 열린 것 닫기.

플레이어와 NPC는 모듈형 영웅 모델의 파츠 조합이고, 숲·마을·소품은 Unity 무료 에셋을 변환한 모델이다.

## 3D 모델은 이 저장소에 없다

게임이 쓰는 모델은 Unity Asset Store 무료 에셋을 변환한 것이고, 에셋 약관이 에셋 파일을 따로 배포하는 것을 금지한다.
그래서 `public/assets/models/*.glb`는 저장소에서 제외되어 있고 목록(`manifest.json`)만 있다. 모델을 만들려면:

1. Unity Asset Store에서 [에셋 목록](docs/licenses/asset-provenance.md)의 에셋을 직접 받아 Unity 프로젝트(`../My project`)에 가져온다.
2. Unity 에디터에서 그 프로젝트를 닫고 `npm run export-glb` (Unity 6000.5.2f1 필요, 결과는 `art-src/_glb`).
3. `npm run models` (결과는 `public/assets/models`).
4. `node scripts/extract-ui.mjs` (UI 조각과 아이콘, 결과는 `public/assets/ui`, 저장소에서 제외).

## 실행

```bash
npm install
npm run dev
```

```bash
npm test
```

서버(Verse8 GameServer, `server/`):

```bash
npm run server:install
npm run server:test
```
