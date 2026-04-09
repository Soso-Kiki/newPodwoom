## 개요
`cuming/`은 **챗봇(chat) 구조 예시** 폴더입니다. 실제 실행은 Node 프로젝트 기준으로 루트의 `package.json`(의존성/ESM 설정)을 사용하고, 실제 챗봇 코드는 `cuming/chat.js`에 있습니다.

## 전체 파일 구조 (루트 포함)
> 아래 트리는 '핵심 파일' 중심으로 정리하고, 자동 생성되는 폴더(`node_modules/`)는 설명만 붙였습니다.

```
chat_logic/
├── package.json                ← Node 프로젝트 설정(의존성, "type": "module" 등)
├── package-lock.json           ← 의존성 잠금 파일(npm이 자동 생성/관리)
├── .env                        ← ANTHROPIC_API_KEY 입력 위치 ← 여기!
├── server.js                   ← Express HTTP 서버 (POST /api/claude-chat)
├── node_modules/               ← 설치된 패키지(npm install 결과, 커밋/문서화 대상 아님)
└── cuming/
    ├── readme.md               ← (이 문서) 전체 구조/실행 방법
    ├── chat.js                 ← 메인 챗봇(Claude 호출 + tool_use 처리 + 루프)
    └── skills/
        ├── get_index.md        ← 챗봇 전체 성격 + 스킬 목록(시스템 프롬프트 베이스)
        ├── trade_history.md    ← 과거 매매데이터 스킬(응답 지침)
        ├── trade_journal.md    ← 자동매매일지 스킬(응답 지침)
        └── persona.md          ← 투자성향/페르소나 스킬(응답 지침)
```

## `cuming/chat.js`에서 하는 일(요약)
- **Skills 로드**: `cuming/skills/*.md` 내용을 합쳐서 system prompt로 사용
- **툴 정의**: `get_trade_history`, `get_trade_journal`, `get_persona`
- **툴 실행(현재는 실제 데이터)**: `executeTool()`에서 실제 매매 이력 반환 (향후 DB/키움 API로 교체)
- **대화 루프**: Claude가 tool_use 판단 → 툴 실행 → 재호출까지 자동 처리

## API 키 입력 방법
```
chat_logic/.env 파일 열기
→ ANTHROPIC_API_KEY=여기에_API_키_붙여넣기
→ sk-ant-api03-... 형태의 키를 = 뒤에 붙여넣기
```

발급: https://console.anthropic.com/

## 실행 방법
```bash
# 프로젝트 루트(chat_logic/)에서 실행
cd chat_logic
npm install          # 최초 1회
npm start            # server.js 실행 → http://localhost:3001
```
