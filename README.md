# Podium - 투자 포트폴리오 & AI 어시스턴트

개인 주식 투자 기록, 분석, AI 챗봇을 통합한 웹 애플리케이션.

---

## 서버 구성 (3개 동시 실행 필요)

| 서버 | 포트 | 실행 명령 |
|---|---|---|
| React 프론트엔드 (Vite) | 5173 | `npm run dev` |
| FastAPI 백엔드 (RAG + DB) | 8000 | `uvicorn main:app --reload` |
| Node.js Claude 서버 | 3001 | `node server.js` |

### 실행 순서

```bash
# 1. FastAPI 백엔드 (backend/ 폴더에서)
cd backend
uvicorn main:app --reload

# 2. Claude 채팅 서버 (chat_logic/ 폴더에서)
cd chat_logic
node server.js

# 3. React 프론트엔드 (루트 폴더에서)
npm run dev
```

---

## 환경 변수 설정

루트 폴더에 `.env` 파일 생성:

```env
GOOGLE_API_KEY=your_google_api_key_here
```

`chat_logic/` 폴더에 `.env` 파일 생성:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 의존성 설치

```bash
# 프론트엔드
npm install

# FastAPI 백엔드
cd backend
pip install -r requirements.txt

# Claude 서버
cd chat_logic
npm install
```

---

## 주요 기능

- 주식 포트폴리오 관리 (보유 종목, 매매이력)
- 매매일지 자동 AI 분석 (buy/sell/hold 패턴)
- 차트 유사도 분석 (과거 패턴 vs 현재 비교)
- 투자 캐릭터와 대화 (장기기억 3일, tool_use)
- AI 챗봇 종목 분석 (RAG 기반 Gemini)
- lightweight-charts 캔들차트

---

## 기술 스택

- **프론트엔드**: React 18 + Vite + Three.js (@react-three/fiber)
- **차트**: lightweight-charts v5
- **백엔드**: Python FastAPI + ChromaDB + SQLite
- **채팅 서버**: Node.js Express + Anthropic SDK
- **AI**: Google Gemini (OpenAI-compatible endpoint) + Anthropic Claude
- **주식 데이터**: Yahoo Finance (CORS 프록시)
