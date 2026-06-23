# FlowCAD 데모 — Vercel 배포 가이드

수문 제조 설계 자동화 플랫폼 FlowCAD의 인터랙티브 데모입니다.
이 폴더를 그대로 Vercel에 올리면 발표용 데모 링크가 만들어집니다.

## 사전 준비 (한 번만)
- Node.js 설치 (https://nodejs.org, LTS 버전)
- 무료 Vercel 계정 (https://vercel.com — GitHub 계정으로 가입 추천)

## 로컬에서 먼저 확인하기 (선택)
터미널에서 이 폴더로 이동한 뒤:
    npm install
    npm run dev
브라우저에서 http://localhost:5173 으로 데모가 뜨면 정상입니다.

## 방법 1. Vercel CLI로 올리기 (가장 빠름, GitHub 불필요)
터미널에서 이 폴더 안에서:
    npm install -g vercel
    vercel
- 처음 실행하면 로그인하라고 안내가 나옵니다(이메일 또는 GitHub).
- 이후 질문은 전부 엔터(기본값)로 넘어가면 됩니다.
  · Set up and deploy? → Y
  · Which scope? → 본인 계정 선택
  · Link to existing project? → N
  · Project name? → 엔터 (flowcad-demo)
  · In which directory is your code located? → 엔터 ( ./ )
  · Framework / build 설정 → 자동으로 Vite 감지, 전부 엔터
- 끝나면 https://flowcad-demo-xxxx.vercel.app 형태의 링크가 출력됩니다. 그게 데모 링크입니다.
- 정식 주소로 한 번 더 배포하려면:  vercel --prod

## 방법 2. GitHub + Vercel 웹으로 올리기 (자동 재배포)
1. 이 폴더를 GitHub 저장소에 올립니다.
2. https://vercel.com 접속 → "Add New… → Project" → 그 저장소 선택.
3. Framework는 Vite로 자동 인식됩니다. 그대로 "Deploy" 클릭.
4. 1~2분 뒤 배포 링크가 생성됩니다. 이후 코드를 GitHub에 push할 때마다 자동 재배포됩니다.

## 발표 자료에 링크 연결
- 만들어진 vercel.app 링크를 랜딩페이지(FlowCAD_platform.html)의 "데모 실행" 버튼 href에 넣으면 됩니다.
- PPT 슬라이드 4(라이브 데모)에서 이 링크를 브라우저로 띄워 시연하세요.

## 폴더 구성
- index.html ............ 진입 HTML
- src/main.jsx .......... 앱 시작점
- src/FlowCADDemo.jsx ... 데모 본체 (수정 시 이 파일만 고치면 됩니다)
- package.json / vite.config.js ... 빌드 설정

## 단가 등 숫자 보정
src/FlowCADDemo.jsx 상단의 MAT 상수(STS304·SS400·FRP 단가 등)만 바꾸면
업체 실매입가로 즉시 반영됩니다.
