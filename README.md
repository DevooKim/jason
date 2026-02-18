# Jason (JSON Viewer)

Next.js 기반으로 구성한 JSON 뷰어 앱입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하세요.

## 주요 구성

- `app/App.tsx`: 기존 JSON 뷰어 메인 로직
- `app/components/`: 입력/뷰어 컴포넌트
- `app/jsonTypes.ts`: 타입 정의
- `app/defaultSampleJson.ts`: 샘플 데이터
- `app/shareConfig.ts`: 공유 URL 설정
- `app/globals.css`: 앱 전체 스타일 + HeroUI 스킨
