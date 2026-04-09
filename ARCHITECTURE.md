# 아키텍처 설계

## 전체 구조

```
[브라우저 - React 5173]
        |
        |── /api/openai     → Vite 프록시 → Google Gemini API (generativelanguage.googleapis.com)
        |── /api/yahoo      → Vite 프록시 → Yahoo Finance API
        |── /api/rag-chat   → FastAPI 8000 (Gemini RAG + ChromaDB + SQLite)
        |── /api/chat-history → FastAPI 8000 (대화 이력 저장/검색)
        |── /api/claude-chat → Node.js Express 3001 (Claude tool_use)
```

---

## 서버별 역할

### React 프론트엔드 (port 5173)
- UI 렌더링 전체
- Three.js 3D 캐릭터
- lightweight-charts 캔들차트
- 유사도 분석 알고리즘 (클라이언트 사이드, LLM 없음)
- 주요 파일: `src/components.jsx`, `src/screens/`, `src/data.js`

### FastAPI 백엔드 (port 8000) - `backend/main.py`
- **RAG 채팅**: `/api/rag-chat` → Gemini 호출 + ChromaDB 유사 문서 검색
- **대화 저장**: `/api/chat-history/save` → SQLite + ChromaDB 임베딩 저장
- **대화 검색**: `/api/chat-history/search` → SQLite 키워드 우선 + ChromaDB 보완
- **장기기억**: 최근 3일 이내 대화만 컨텍스트에 주입
- DB 위치: `backend/data/`

### Node.js Claude 서버 (port 3001) - `chat_logic/server.js`
- **캐릭터와 대화**: `/api/claude-chat`
- Claude tool_use로 매매이력/일지/투자성향 조회
- 페르소나(캐릭터 성격) 주입

---

## 데이터 흐름

### 캐릭터와 대화
```
유저 질문
  → Node.js (Claude tool_use)
  → DB 조회 (매매이력, 매매일지, 투자성향)
  → 장기기억 주입 (3일 이내 대화)
  → Claude 응답 생성
  → SQLite + ChromaDB 저장
```

### AI 챗봇에게 물어보기
```
유저 질문
  → FastAPI (Gemini RAG)
  → ChromaDB 유사 문서 검색
  → 현재가/유사도/수익률/매매포인트 컨텍스트 주입
  → Gemini 응답 생성
  → 저장 없음 (세션 내 유지만)
```

### 유사도 분석
```
과거 매매 사이클 선택
  → Yahoo Finance 10년치 일봉 데이터
  → 클라이언트 사이드 코사인 유사도 계산
  → 결과 캐시 (페이지 내)
  → LLM 없음
```

---

## 포트 정리

| 서비스 | 포트 | 비고 |
|---|---|---|
| Vite 개발 서버 | 5173 | React 앱 |
| FastAPI | 8000 | RAG + DB API |
| Claude 서버 | 3001 | tool_use 채팅 |
| ChromaDB | 내장 | FastAPI 내부 |
| SQLite | 파일 | backend/data/ |
