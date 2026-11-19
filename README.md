# 복제인간 시 — 플레이 테스트 데이터 수집

게임 15장에 QA 계측, Netlify 서버 API, 비공개 데이터 저장소, 관리자 CSV 다운로드를 추가했습니다. **2026-11-14 Netlify 운영 배포와 서버 저장 검증을 완료했습니다.**

- 게임: https://hcp-ticketqa.netlify.app/
- 관리자: https://hcp-ticketqa.netlify.app/admin/
- GitHub main 브랜치와 자동 배포가 연결되어 있습니다. 관리자 인증번호는 서버 환경변수로 관리합니다.

## GitHub와 Netlify의 역할

- GitHub 저장소: 게임과 서버 코드를 보관합니다. 올리는 것만으로 데이터 수집 서버가 실행되지는 않습니다.
- GitHub Pages: 정적 게임은 게시할 수 있지만 이 프로젝트의 저장 API는 실행할 수 없습니다.
- Netlify: 게임 웹사이트, Functions 저장 API, Blobs 영구 저장소를 함께 제공합니다. 별도의 상시 실행 서버를 운영할 필요가 없습니다.
- 이 프로젝트는 **GitHub 저장소 → Netlify Git 연동 배포**를 권장합니다. HTML만 드래그해서 업로드하면 서버 기능이 배포되지 않습니다.

공식 문서: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Netlify Functions](https://docs.netlify.com/build/functions/overview/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## 배포하기

1. 이 프로젝트 폴더의 소스를 GitHub 저장소에 올립니다. `.gitignore`에 있는 `node_modules`, `.npm-cache`, `dist`, `.env`, `.netlify`는 올리지 않습니다. 인증번호를 코드나 GitHub에 쓰지 마세요.
2. Netlify에서 Git 저장소로 프로젝트를 만들고 해당 저장소를 연결합니다.
3. 저장소 루트를 기준으로 Build command `npm run build`, Publish directory `dist`, Functions directory `netlify/functions`가 설정되는지 확인합니다. `netlify.toml`에 이미 지정되어 있습니다.
4. 프로젝트 환경변수에 `QA_ADMIN_PIN`을 추가합니다. **사용할 관리자 인증번호(숫자 4~12자리)**을 넣고 Functions에서 사용 가능하도록 설정합니다. Production에 반드시 적용하세요. 앞자리가 0이면 0을 포함한 문자열 그대로 입력하세요.
5. 환경변수를 설정한 후 배포합니다. Node 22를 사용합니다.
6. 발급된 `https://프로젝트이름.netlify.app/` 주소가 게임입니다. `/admin/` 주소가 관리자 화면입니다.
7. 게임에서 수집에 동의하고 20초 이상 플레이한 뒤, 관리자 화면에 인증번호를 입력하여 오늘 날짜를 조회합니다. 저장이 확인된 후 플레이어에게 게임 주소를 공유하세요.

관리자 화면 HTML은 누구나 열 수 있지만 **데이터 조회 API는 인증번호 없이는 거부**됩니다. 인증번호는 로그인 직후 입력창에서 지우고, 접속 토큰만 브라우저 메모리에 두며 주소나 localStorage에 저장하지 않습니다. 사용 후 `로그아웃`을 누르세요. 인증번호 입력은 IP당 분당 5회로 제한되며, 성공하면 1시간짜리 무작위 접속 토큰을 발급합니다. 번호를 바꾸어도 이미 발급된 토큰은 만료까지 최대 1시간 유효합니다.

Netlify 비용/한도는 계정 요금제와 요청량·저장량에 따라 달라집니다. 무료 무제한을 전제로 한 구현은 아닙니다. 공개 테스트 전에 Netlify 사용량 대시보드와 지출 제한을 확인하세요.

## 로컬 실행

```powershell
npm ci --cache .npm-cache
Copy-Item .env.example .env
# .env에 개발용 QA_ADMIN_PIN을 입력하세요.
npm run build
npm run dev
```

Netlify Dev가 안내하는 주소로 게임과 `/admin/`에 접속합니다. 로컬 Blobs는 로컬 저장소이며 운영 데이터와 분리됩니다. HTML을 더블클릭한 `file://` 환경에서는 게임은 열 수 있지만 서버 저장은 되지 않습니다. 화면 하단의 저장 상태는 실제 API 응답에 따라 표시됩니다.

```powershell
npm test
npm run test:browser
```

브라우저 검증은 설치된 Chrome을 사용하며, 실제 API 핸들러에 테스트용 메모리 저장소를 연결합니다. 스크린샷과 다운로드 결과는 프로젝트의 `test-results/`에 저장됩니다. 운영 Netlify 저장소 연결 검증을 대체하지 않습니다.

## 폴더 구성

| 경로 | 역할 |
|---|---|
| `clone-poem-game.html` | 기존 게임 + 명시적인 장 시작/클리어/실패 연결 |
| `public/qa-core.js` | 독립적인 시간 계산과 시도 상태 관리 |
| `public/qa-client.js` | 수집 동의, 전송, 오프라인 임시 큐 |
| `public/qa-report.js` | 중복 제거, 시도/장별 집계, CSV |
| `public/admin/` | 관리자 조회 및 다운로드 화면 |
| `netlify/functions/` | 저장/관리자 조회 API |
| `netlify/lib/` | 입력 검증 |
| `scripts/build.mjs` | 공개할 파일만 dist로 복사 |
| `tests/` | 시간·집계·인증·저장·게임 연결 테스트 |
| `docs/data-dictionary.md` | 데이터 의미와 계측 한계 |
| `dist/` | 빌드 결과, 자동 생성 |

## 운영 시 알아둘 점

### 리허설

- `/rehearsal/`에서 15개 장과 8개 중간 체크포인트를 선택할 수 있습니다. `/admin/`에도 진입 링크가 있습니다.
- 리허설 링크는 인증 없이 사용합니다. 데이터 조회/다운로드에는 기존 관리자 인증이 필요합니다.
- `?rehearsal=1`로 실행한 게임은 QA 클라이언트를 비활성화해 이벤트를 전송하지 않고, 기존 동의 설정과 전송 대기 기록도 변경하지 않습니다.
- 게임 아래의 ‘장 목록’으로 다른 장을 선택하거나 ‘이 구간 다시 시작’으로 선택한 시작 지점을 다시 실행할 수 있습니다.
- 검증: `npm run build` 후 `node scripts/rehearsal-check.mjs`. 배포 확인은 같은 명령 뒤에 사이트 origin을 전달합니다.

- 동의한 플레이만 저장합니다. 이름, 이메일, 음성, 정확한 위치, 오류 메시지 원문을 애플리케이션 데이터에 저장하지 않습니다. 호스팅 사업자의 접속 로그는 별도입니다.
- 새로고침/새 페이지는 새 무작위 세션입니다. 같은 사람의 장기 방문 추적이나 고유 인원 수 집계 기능은 없습니다.
- 장 바로가기 해시로 연 테스트 세션에는 `debug: true`를 표시하고 관리자 화면에서 기본 제외합니다.
- 데이터는 Netlify 사이트 단위 `clone-poem-qa-v1` 저장소에 보관하여 재배포 후에도 유지됩니다. 사이트 삭제나 저장소 삭제는 별개입니다.
- 자동 보존 기간/삭제 작업은 구현하지 않았습니다. 필요한 자료를 다운로드하고, Netlify Blobs 관리 화면에서 운영자가 불필요한 데이터를 정리하세요. 실제 테스트 안내에는 운영자 연락처와 보존 정책을 정해 추가하세요.
- 브라우저 전송 데이터는 조작될 수 있습니다. 이 기능은 QA 분석용이며 순위/보상 판정용 신뢰 서버가 아닙니다. 동일 출처 확인·요청 제한·입력 검증은 적용했지만 봇을 완전히 차단하지는 않습니다.
- 한 번에 최대 7일 조회하며 시간별 20,000개 이벤트를 넘으면 조용히 잘라내지 않고 오류를 표시합니다. 대규모 상시 서비스는 SQL 데이터베이스와 백그라운드 내보내기로 확장하는 것이 적합합니다.

실제 운영 서버 연결 검증은 위 배포 7번 과정으로 완료해야 합니다.

관리자 접속 토큰의 해시는 별도 `clone-poem-qa-auth-v1` 저장소에 보관합니다. 만료된 토큰은 사용할 수 없고, 운영자는 이 저장소의 오래된 항목을 정리할 수 있습니다.
