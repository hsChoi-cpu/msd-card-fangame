# 심연 레이드 — TypeScript V5.3

## 핵심 변경 사항

- **속도순 슬롯 배치:** 같은 캐릭터의 아군 슬롯 및 보스 슬롯 모두 속도 내림차순으로 화면에 표시합니다. 같은 속도이면 원래 순서를 유지하며, 내부 슬롯 ID·합 연결 대상은 변경되지 않습니다.
- **특수 카드:** 슬롯 점유와 합 없이 손패 클릭 시 즉시 발동합니다. 사용 시 마력을 지불하고, `ON_USE` 및 패시브를 실행하며, 사용한 카드는 즉시 버림 더미로 갑니다. 다음 턴 드로우 수에 포함됩니다.
- **특수 카드 대상:** 카드별 `specialTarget: 'SELF' | 'ALLY' | 'ENEMY' | 'ANY'`. SELF는 즉시 사용, 나머지는 대상 선택창에서 선택한 순간 사용됩니다. 클릭 전에는 마력이 소비되지 않습니다.
- **마력 예약:** 이미 슬롯에 장착한 일반 카드의 예약 마력을 침범하는 특수 카드 사용은 허용하지 않습니다.
- **손패 상한:** 카드 드로우 자체는 즉시 제한하지 않습니다. 턴 종료 이벤트 처리 이후 7장을 초과하면 무작위로 초과분을 **버림 더미**로 옮깁니다.
- **Vite 도입:** 빌드 시 파일 내용 기반 해시가 포함된 JS/CSS 경로가 `dist/index.html`에 기록됩니다. GitHub Pages의 기존 하위 경로 주소에 맞춰 `base: './'`를 사용합니다.

## 설치와 실행

Node.js 22 이상(권장 24) 설치 후, **프로젝트 루트**에서:

```powershell
npm install
npm run dev
```

개발 서버 주소(일반적으로 `http://localhost:5173/`)를 브라우저에서 열어주세요. Vite 전환 뒤에는 `index.html`을 **파일 탐색기에서 직접 더블 클릭해 실행하는 방식은 지원하지 않습니다.**

테스트, 타입 검사 및 배포용 빌드:

```powershell
npm test
npm run build
npm run preview
```

`dist/`는 자동 생성되며 Git에 커밋하지 않습니다. `npm run preview`는 빌드 결과를 확인하는 용도입니다.

## GitHub Pages

1. 저장소 `Settings → Pages → Source`를 **GitHub Actions**로 유지합니다.
2. V5.3 파일을 기존 저장소 루트에 덮어쓰고, 이전 V5.2의 `assets/`, `scripts/`, 루트 `tests.js`는 제거합니다. 새 테스트 파일은 `tests.cjs`입니다.
3. `npm install`, `npm test`, `npm run build`를 확인합니다.
4. `git add -A; git commit -m "Implement V5.3 special cards and Vite"; git push origin main`을 실행합니다.
5. `.github/workflows/pages.yml`이 Node 24에서 테스트 및 **Vite 빌드**를 실행하고 `dist`를 배포합니다.

## 카드 데이터 예시

```ts
{
  id: 'special_001', name: '마력 공급', type: 'SPECIAL', power: 0,
  manaCost: 1, specialTarget: 'ALLY',
  description: '선택한 아군의 마력 3 회복',
  image: null,
  effects: [{ trigger: 'ON_USE', action: 'RESTORE_MANA', target: 'TARGET', value: 3 }]
}
```

이 프로젝트의 데모 캐릭터 중 **비전술사**는 아군 대상 특수 카드 `마력 공급`, **그림자 검객**은 보스 대상 특수 카드 `교란 봉인`을 사용합니다. 각 덱은 기존 규칙대로 6종·10장입니다.

일러스트는 아직 등록하지 않았으며, 추후 `public/assets/cards/파일명.png`에 넣고 카드 데이터의 `image: 'assets/cards/파일명.png'`를 지정하면 됩니다. `public` 이미지 파일은 Vite 해시 처리 대상이 아니므로 **이미지를 교체할 때는 파일 이름을 변경**하면 캐시 갱신이 확실합니다.

## 변경 전 확정 규칙 유지

- 키워드 위력·횟수 최대 99, 속도 최소 1, 카드 위력 최소 0
- 속도/합/회피/방어/반격, 위력 재계산, 보호·취약 1당 10%, 횟수 기반 키워드, 다음 턴 신속·속박
- 일반 카드의 손패 이월과 첫 턴 슬롯+2, 이후 이전 턴 사용 수만큼 드로우; 덱 소진 시 버림 더미 재셔플

## 테스트 범위 및 주의

기존 66개와 새 규칙 9개로 총 **75개 엔진 테스트**를 확인했습니다. 브라우저 조작은 환경에서 로컬 사이트 접속이 제한되어 자동 검증되지 못했으므로 실제 배포 후 수동 확인이 필요합니다.

Vite 빌드 명령 자체는 의존성 설치에 인터넷 접근이 필요하며, 현재 작성 환경에서는 온라인 패키지 설치가 불가해 실행 검증하지 못했습니다. TypeScript 컴파일과 엔진 테스트는 검증했습니다.
