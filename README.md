# 심연 레이드 — TypeScript 전투 엔진 V4

이 프로젝트는 기존 V3의 전투 행동 및 카드 효과 규칙을 TypeScript로 이전한 버전입니다. **원본 소스는 `src/engine.ts`, `src/ui.ts`, `src/types.ts`이고 브라우저는 TypeScript가 아닌 컴파일된 JavaScript를 실행합니다.**

## 설치와 로컬 실행 (Windows / VS Code)

프로젝트 폴더에서:

```powershell
npm install
npm test
```

- `npm run build`: TypeScript를 `dist/engine.js`, `dist/ui.js`로 컴파일하고 HTML/CSS 복사
- `npm run typecheck`: TypeScript 타입 검사만 수행
- `npm test`: 빌드하고 자동 테스트 실행
- `dist/index.html`: 완성된 로컬 브라우저 진입점. `index.html` 원본을 열지 말고 `dist/index.html`을 여세요.
- 수정 후 항상 `npm run build`를 실행해 `dist`에 반영하세요.
- Node.js 24 권장. 프로젝트에는 `typescript` 패키지가 개발 의존성으로 포함되어 있습니다.

## GitHub Pages 설정 (중요)

1. 기존 저장소(`hsChoi-cpu/msd-card-fangame`)의 루트에 **ZIP 안의 파일과 숨김 폴더 `.github`까지** 복사합니다.
2. 기존 `engine.js`, `ui.js`는 원본 소스로 더 이상 사용하지 않습니다. 루트에 남아 있다면 삭제하거나 Git에서 제거합니다. `src/*.ts`가 새 원본입니다.
3. 저장소에서 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택합니다. 이전 `Deploy from a branch` 설정을 반드시 변경하세요. 커스텀 workflow를 사용하지 않으면 원본 `.ts`를 자동으로 빌드하지 않습니다.
4. `git add -A && git commit -m "Migrate engine to TypeScript v4" && git push origin main`
5. **Actions → Build and deploy TypeScript game** 에서 빌드/테스트/배포 2개 작업이 모두 성공했는지 확인합니다.
6. 배포된 사이트: `https://hschoi-cpu.github.io/msd-card-fangame/`

이 Workflow는 `actions/checkout@v6`, `actions/setup-node@v6`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` 를 사용합니다. GitHub Pages의 기본 `pages build and deployment`에서 보여준 `actions/upload-artifact@v4` 경고는 GitHub에서 자동 생성한 기존 배포 작업의 경고일 수 있습니다. 새 Workflow로 이전해도 과거 실행 기록은 남습니다. 과거 실행의 실제 실패 원인은 별도의 실패 단계 로그에서 확인해야 합니다.

## 확정 전투 규칙

- 캐릭터별 고정 덱, 싱글플레이, 보스 행동 예고 후 카드 배치
- 행동 슬롯별 매 턴 무작위 속도, **최종 속도 최소 1**
- 다른 아군의 공격을 가로채려면 아군 행동 속도가 보스 슬롯 속도보다 엄격하게 높아야 함
- 공격 합: 높은 위력 승리, 낮은 위력 취소, 동률 시 쌍방 취소
- 공격/방어/회피/반격/특수 타입; 특수 타입의 개별 효과는 추후 정의
- **카드 최종 위력 최소 0**, 사용 시 효과 적용 후 합 위력 계산, 피해 직전 위력 다시 계산
- 공격 위력은 기본 피해량. 보호·취약 각각 1당 받는 피해 ±10%, 합산 적용
- 방어는 방어막 획득, 잔여 방어막은 턴 종료까지 유지
- 회피 카드가 빠른 적 공격과 연결되면 **그 적의 실행 시점**에 회피 활성화. 이후 자신에게 향한 공격에 자동 회피, 한 번 실패하면 회피 상태 즉시 소멸. 회피 재부여 시 높은 수치 유지.
- 반격은 피격 후 공격자에게 턴당 1회 발동. 방어막으로 전부 막아도 피격으로 처리하고 반격 가능.
- **모든 키워드 위력과 횟수는 각각 최대 99** (0~99 제한; 0 제거 규칙은 키워드 유형에 따름)
- 일반 키워드는 위력/횟수 합산. **최초 획득 시** 생략된 수치만 1로 보충, 기존 키워드에 재부여할 때 생략 필드는 변화 없음.
- 횟수가 있는 키워드는 턴 종료마다 횟수 -1, 횟수 없는 키워드는 턴 종료 시 소멸.
- 신속·속박은 다음 턴 시작에 부여하고 그 턴의 슬롯 속도 계산에 반영
- 적중 시 취약 부여는 **해당 공격의 피해 처리 이후**이므로 다음 공격부터 적용

## 현재 카드 효과 시스템

6개 액션 명령: `APPLY_KEYWORD`, `MODIFY_KEYWORD`, `REMOVE_KEYWORD`, `HEAL`, `DRAW_CARDS`, `DEAL_DAMAGE`.

18개 트리거: `ON_BATTLE_START`, `ON_TURN_START`, `ON_TURN_END`, `ON_USE`, `ON_CLASH_START`, `ON_CLASH_WIN`, `ON_CLASH_LOSE`, `ON_CLASH_DRAW`, `BEFORE_ATTACK`, `BEFORE_DAMAGE`, `ON_HIT`, `AFTER_DAMAGE`, `ON_ATTACKED`, `ON_HIT_TAKEN`, `ON_DAMAGED`, `ON_EVADE_SUCCESS`, `ON_EVADE_FAIL`, `ON_KILL`.

10개 조건과 5개 대상 범위가 지원됩니다. 복합 액션, 우선순위, 명시적 `scope:'OWNED'` 지속 효과가 기존과 동일하게 동작합니다.

## 주요 파일

```text
src/engine.ts             전투 엔진 TypeScript (V3 코드 이식 및 경계값 보정)
src/ui.ts                 브라우저 화면 TypeScript
src/types.ts              카드·키워드·이벤트 공통 모델
index.html                웹 페이지 원본
styles.css                화면 CSS
scripts/copy-static.mjs   HTML/CSS를 dist에 복사
.github/workflows/pages.yml  TypeScript 컴파일 + 테스트 + Pages 배포
tests.js                  51개 회귀 및 경계값 자동 테스트
package.json, tsconfig.json
```

**주의:** 이 버전은 전체 코드를 TypeScript로 컴파일 가능하게 이식한 1차 전환본입니다. 일부 복합 런타임 효과 처리에는 점진적으로 좁힐 수 있는 유연한 타입이 남아 있습니다. 실 브라우저 수동 플레이와 GitHub 서버에서의 실제 배포는 로컬 테스트와 별개로 확인하세요.
