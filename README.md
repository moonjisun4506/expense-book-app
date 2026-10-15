# 차곡 — 개인 가계부

HTML/CSS/JavaScript + Node.js/Express + Neon PostgreSQL로 만든 단일 사용자 가계부입니다. SQLite와 localStorage를 사용하지 않습니다.

## 로컬 실행

Node.js 22 이상이 필요합니다. PowerShell에서 npm 실행 정책 오류가 나면 `npm.cmd`를 사용하세요.

```powershell
npm.cmd install
Copy-Item .env.example .env
```

`.env`를 열고 다음 두 값을 직접 설정하세요. 비밀 값은 GitHub, 브라우저 코드, 채팅에 붙여 넣지 마세요.

- `DATABASE_URL`: Neon 프로젝트의 Connect 메뉴에서 복사한 PostgreSQL 연결 문자열입니다. 풀링된 연결과 `sslmode=require` 사용을 권장합니다.
- `APP_PASSWORD`: 이 가계부에서 사용할 길고 고유한 비밀번호입니다.

```powershell
npm.cmd start
```

http://localhost:3000 에서 로그인합니다. 개발 중 자동 재시작은 `npm.cmd run dev`입니다. 서버는 환경변수 없이도 시작하지만, 로그인에는 APP_PASSWORD가 필요하고 데이터 기능에는 실제 DATABASE_URL이 필요합니다. 최초 데이터 요청 시 personal_expenses 테이블을 자동 생성하므로 Neon 역할에 테이블 생성 권한이 있어야 합니다.

## 기능

- 날짜, 항목, 카테고리, 원 단위 양의 정수 금액으로 지출 추가·조회·수정·삭제
- 월 선택 및 특정 날짜 검색: 검색일을 변경하면 해당 월로 자동 이동
- 월별 총액, 가장 많이 사용한 카테고리, 카테고리별 합계 및 막대그래프
- 날짜 검색 중에도 요약과 그래프는 선택한 월 전체 기준
- 모바일 대응, 빈 내역 안내, 오류 메시지, 삭제 확인

## GitHub + Vercel 배포

1. GitHub에 새 비공개 저장소를 만들고 이 프로젝트를 올리세요. `.env`와 `node_modules`는 `.gitignore`에 의해 제외됩니다. 업로드 전 비밀 파일이 포함되지 않았는지 확인하세요.
2. Vercel에서 Add New → Project로 GitHub 저장소를 가져옵니다.
3. Framework Preset은 Other, 프로젝트 루트는 이 폴더로 선택합니다. 별도 프런트엔드 빌드나 Output Directory 지정은 필요하지 않습니다.
4. Vercel 프로젝트의 Environment Variables에 `DATABASE_URL`, `APP_PASSWORD`를 등록합니다. 필요한 Production/Preview 환경에 각각 설정하세요. `NEXT_PUBLIC_` 또는 `VITE_` 접두사를 붙이지 마세요.
5. Deploy를 실행합니다. `vercel.json`이 요청을 `api/index.js`의 Express 앱으로 전달합니다. 이후 GitHub 기본 브랜치 push 시 자동 재배포됩니다. 환경변수 변경 후에는 재배포하세요.
6. 배포 URL에서 로그인 → 지출 추가 → 새로고침 → 수정·삭제와 합계 반영을 확인하세요.

GitHub/Vercel 계정 연결은 포함되어 있지 않으므로 저장소 생성과 실제 배포는 위 설정 후 진행해야 합니다. 기존 expenses 테이블과 충돌하지 않도록 이 앱은 별도 personal_expenses 테이블을 사용합니다.

## 인증과 보안

서버만 DATABASE_URL과 APP_PASSWORD를 읽습니다. SQL은 매개변수 방식으로 실행하며, 클라이언트는 텍스트를 HTML로 삽입하지 않습니다. 모든 지출 API는 인증이 필요합니다. 로그인 성공 시 비밀번호로 서명한 12시간 유효 HttpOnly/SameSite=Strict 쿠키를 발급하며, Vercel에서는 Secure 속성을 사용합니다. 비밀번호를 변경하면 기존 쿠키도 무효화됩니다. 로그아웃은 현재 브라우저의 쿠키를 삭제합니다.

Origin 검사, Helmet 보안 헤더, 로그인 시도 제한이 적용되어 있습니다. 기본 로그인 제한은 프로세스 메모리 기준이므로 Vercel 인스턴스 전체에 걸친 강한 제한이 필요하면 Vercel Firewall 또는 공유 저장소 기반 제한을 추가하세요. 개인 단일 사용자 용도이며 사용자별 계정 구분은 없습니다.

## 검증

```powershell
npm.cmd test
```

인증 없는 접근 차단, 잘못된 비밀번호·변조된 쿠키·입력값 거부, 교차 출처 요청 차단, 비밀 파일 접근 차단 및 DB 미설정 오류를 테스트합니다. `node scripts/check-neon.js`는 .env의 실제 Neon에서 임시 내역을 추가·조회·수정·삭제하고 합계를 검증합니다. 배포 후에도 별도로 동작을 확인하세요.

초기 로컬 설정에서 생성한 로그인 비밀번호는 .env의 APP_PASSWORD에서 확인하거나 원하는 값으로 변경하세요. 변경 후 서버를 재시작하세요. 기존 접속 정보 파일 expense-book-app.txt도 Git 제외 대상입니다. 접속 정보가 외부에 표시된 적이 있다면 Neon에서 비밀번호를 재발급한 뒤 .env와 Vercel 환경변수를 갱신하세요.
