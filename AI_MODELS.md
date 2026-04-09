# AI 모델 & API 키 구성

## 현재 사용 중인 AI 서비스

| 서비스 | 모델 | 용도 | API 키 위치 |
|---|---|---|---|
| Google Gemini | gemini-2.0-flash | AI 챗봇 (sendChat), RAG 백엔드 | `.env` GOOGLE_API_KEY |
| Google Gemini | gemini-1.5-flash-latest | FastAPI RAG 서버 내부 | `.env` GOOGLE_API_KEY |
| Anthropic Claude | claude (tool_use) | 캐릭터와 대화 서버 | `chat_logic/.env` ANTHROPIC_API_KEY |

---

## API 키 파일 위치

```
프로젝트 루트/.env
  └── GOOGLE_API_KEY       → Vite 프록시 (sendChat) + FastAPI RAG 서버

chat_logic/.env
  └── ANTHROPIC_API_KEY    → Claude tool_use 서버 (port 3001)
```

---

## 서비스별 API 흐름

### Google Gemini - Vite 프록시 경유 (프론트엔드 직접 호출)
```
src/data.js
  GPT_API_URL = "/api/openai"
  GPT_DEFAULT_MODEL = "gemini-2.0-flash"
  
  → vite.config.js 프록시
  → https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
  → Authorization: Bearer GOOGLE_API_KEY
```
용도: `components.jsx` sendChat (AI챗봇에게 물어보기)

### Google Gemini - FastAPI 직접 호출 (백엔드)
```
backend/main.py
  → google.generativeai 또는 OpenAI-compatible endpoint
  → 모델: gemini-1.5-flash-latest
```
용도: `/api/rag-chat` RAG 답변 생성

### Anthropic Claude - Node.js 서버
```
chat_logic/server.js
  → @anthropic-ai/sdk
  → tool_use 기능 (매매이력/일지/투자성향 조회)
```
용도: `/api/claude-chat` 캐릭터와 대화

---

## 할당량 및 주의사항

| 모델 | 알려진 한도 | 비고 |
|---|---|---|
| gemini-2.5-flash-lite | 일 20회 (무료) | 429 quota 에러 발생 이력 있음 |
| gemini-2.0-flash | 429 quota 초과 이력 | OpenAI-compatible endpoint |
| gemini-1.5-flash-latest | 현재 사용 중 (안정적) | RAG 서버 |

> 429 에러 발생 시: 다음날 할당량 초기화되거나 모델 교체 필요

---

## 모델 교체 시 수정 위치

- **프론트엔드 모델**: `src/data.js` → `GPT_DEFAULT_MODEL`
- **RAG 서버 모델**: `backend/main.py` → Gemini 모델명
- **Claude 서버 모델**: `chat_logic/server.js` → model 파라미터
