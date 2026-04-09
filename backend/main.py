# ═══════════════════════════════════════════════════════════
#  backend/main.py  —  FastAPI RAG 서버 (ChromaDB + Gemini)
#
#  실행: python main.py
#  엔드포인트:
#    POST /api/rag-chat              — 메인 RAG 채팅
#    POST /api/chat-history/save     — 채팅 기록 저장 (SQLite + ChromaDB)
#    GET  /api/chat-history/recent   — 최근 채팅 기록 조회
#    GET  /api/chat-history/search   — 과거 대화 의미 검색
#    GET  /health                    — 상태 확인
#    GET  /skills                    — 로드된 스킬 목록
# ═══════════════════════════════════════════════════════════

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from pathlib import Path
import chromadb
from chromadb import EmbeddingFunction, Embeddings
import httpx
import sqlite3
import os
import sys
from datetime import datetime

# ── 경로 설정 ─────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
SKILLS_DIR = BASE_DIR / "skills"

# ── API 키 ───────────────────────────────────────────────
GEMINI_API_KEY = os.getenv(
    "VITE_GEMINI_API_KEY",
    "AIzaSyBNS1fdxxJPOP7Jallyx6ppaDLLpCWXtIg"
)
GEMINI_EMBED_URL = (
    f"https://generativelanguage.googleapis.com/v1beta"
    f"/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
)
GEMINI_GEN_URL = (
    f"https://generativelanguage.googleapis.com/v1beta"
    f"/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
)

# ══════════════════════════════════════════════════════════
#  Skills 시스템
#  skills/*.md 파일을 읽어 쿼리에 따라 선택적으로 조합
# ══════════════════════════════════════════════════════════

# ── 스킬 트리거 키워드 ────────────────────────────────────
# 키워드 매칭으로 어떤 skill md를 로드할지 결정
SKILL_TRIGGERS: Dict[str, List[str]] = {
    "get_trade_history": [
        "수익률", "매매", "이력", "보유", "수익", "손실", "매수", "매도",
        "포트폴리오", "삼성전자", "SK하이닉스", "하이닉스", "테슬라", "종목",
        "현재가", "평균", "얼마", "몇 주", "총", "평가", "실현", "return",
    ],
    "get_trade_journal": [
        "왜", "이유", "근거", "판단", "일지", "배운", "교훈", "실수",
        "전략", "계획", "어떻게 결정", "그때", "어떤 이유", "매매 이유",
        "느낌", "반성", "당시", "생각", "왜 팔", "왜 샀",
    ],
    "get_persona": [],  # 항상 로드 (기본 컨텍스트)
}

def load_skills() -> Dict[str, str]:
    """skills/ 디렉토리의 모든 .md 파일을 읽어 딕셔너리로 반환"""
    skills: Dict[str, str] = {}
    for path in sorted(SKILLS_DIR.glob("*.md")):
        name = path.stem          # 파일명 without .md
        content = path.read_text(encoding="utf-8")
        skills[name] = content
        print(f"  [skill loaded] {name}", file=sys.stderr)
    return skills

def select_skills(query: str, all_skills: Dict[str, str]) -> List[str]:
    """
    쿼리 키워드 매칭으로 관련 skill md를 선택한다.
    get_persona는 항상 포함, 나머지는 키워드 기반 선택.
    아무것도 매칭되지 않으면 get_trade_history를 기본으로 포함.
    """
    selected = []

    # get_persona 항상 포함
    if "get_persona" in all_skills:
        selected.append("get_persona")

    # 키워드 기반 선택
    triggered = []
    for skill_name, keywords in SKILL_TRIGGERS.items():
        if skill_name == "get_persona":
            continue
        if any(kw in query for kw in keywords) and skill_name in all_skills:
            triggered.append(skill_name)

    if triggered:
        selected.extend(triggered)
    else:
        # 기본 폴백: 매매 이력 조회
        if "get_trade_history" in all_skills:
            selected.append("get_trade_history")

    # 중복 제거, 순서 유지
    seen = set()
    return [s for s in selected if not (s in seen or seen.add(s))]

def build_skill_block(selected: List[str], all_skills: Dict[str, str], persona_md: str) -> str:
    """
    선택된 skill md들을 합쳐 시스템 프롬프트 블록을 구성한다.
    get_persona.md의 [PERSONA_DYNAMIC] 태그를 실제 persona_md로 치환한다.
    """
    blocks = []
    for skill_name in selected:
        content = all_skills.get(skill_name, "")
        if not content:
            continue
        if skill_name == "get_persona":
            # [PERSONA_DYNAMIC] 플레이스홀더를 온보딩 페르소나로 치환
            dynamic = persona_md.strip() if persona_md else "투자 성향 미설정"
            content = content.replace("[PERSONA_DYNAMIC]", dynamic)
        blocks.append(content)

    return "\n\n---\n\n".join(blocks)

# ── 스킬 초기 로드 ────────────────────────────────────────
print("Skills 로드 중...", file=sys.stderr)
ALL_SKILLS = load_skills()
print(f"  → {len(ALL_SKILLS)}개 스킬 로드됨: {list(ALL_SKILLS.keys())}", file=sys.stderr)

# ══════════════════════════════════════════════════════════
#  ChromaDB (벡터 DB)
# ══════════════════════════════════════════════════════════

class GeminiEmbeddingFn(EmbeddingFunction):
    """Gemini gemini-embedding-001 을 ChromaDB 임베딩으로 사용"""

    def name(self) -> str:
        return "gemini-embedding-001"

    def __call__(self, input: List[str]) -> Embeddings:
        results = []
        for text in input:
            try:
                resp = httpx.post(
                    GEMINI_EMBED_URL,
                    json={
                        "model": "models/gemini-embedding-001",
                        "content": {"parts": [{"text": text}]},
                    },
                    timeout=30,
                )
                data = resp.json()
                values = data.get("embedding", {}).get("values", [])
                if not values:
                    raise ValueError(f"empty embedding: {data}")
                results.append(values)
            except Exception as e:
                print(f"[embed error] {e}", file=sys.stderr)
                results.append([0.0] * 3072)   # gemini-embedding-001 차원: 3072
        return results

# 과거 매매 / 보유 / 원칙 데이터 — ChromaDB 문서
TRADE_DOCS = [
    {
        "id": "trade_samsung_1",
        "text": (
            "삼성전자(005930) 1차 매매. "
            "2021-03-15 매수 42,000원×20주(840만원). "
            "2021-09-08 매도 53,000원×20주. "
            "실현 수익: +220,000원 (+26.2%). 보유 177일. "
            "메모: 반도체 슈퍼사이클 기대 매수 → 목표가 달성 매도."
        ),
        "metadata": {"type": "trade_pair", "code": "005930", "name": "삼성전자", "profit_pct": 26.2},
    },
    {
        "id": "trade_samsung_2",
        "text": (
            "삼성전자(005930) 2차 매매. "
            "2022-10-12 매수 58,500원×15주(877.5만원). "
            "2023-06-20 매도 71,200원×15주. "
            "실현 수익: +190,500원 (+21.7%). 보유 251일. "
            "메모: 저점 판단 분할 매수 진입 → 단기 고점 판단 전량 매도."
        ),
        "metadata": {"type": "trade_pair", "code": "005930", "name": "삼성전자", "profit_pct": 21.7},
    },
    {
        "id": "holding_samsung",
        "text": (
            "현재 보유 삼성전자(005930): 15주, 평균매입가 67,400원, "
            "현재가 167,000원, 수익률 +147.8%, 총평가액 2,505,000원."
        ),
        "metadata": {"type": "holding", "code": "005930", "name": "삼성전자", "profit_pct": 147.8},
    },
    {
        "id": "holding_skhynix",
        "text": (
            "현재 보유 SK하이닉스(000660): 5주, 평균매입가 132,000원, "
            "현재가 198,500원, 수익률 +50.4%, 총평가액 992,500원."
        ),
        "metadata": {"type": "holding", "code": "000660", "name": "SK하이닉스", "profit_pct": 50.4},
    },
    {
        "id": "holding_tesla",
        "text": (
            "현재 보유 테슬라(TSLA): 3주, 평균매입가 $210.5, "
            "현재가 $248.9, 수익률 +18.2%, 총평가액 $746.7."
        ),
        "metadata": {"type": "holding", "code": "TSLA", "name": "테슬라", "profit_pct": 18.2},
    },
    {
        "id": "principle_tech",
        "text": "투자 원칙 [기술적]: 매수 전 전고점 확인 필수. 52주 신고가 대비 위치 확인 후 진입 타이밍 결정.",
        "metadata": {"type": "principle", "category": "기술적"},
    },
    {
        "id": "principle_weight",
        "text": "투자 원칙 [자산관리]: 단일 종목 비중 20% 이내. 분산 투자로 리스크 관리.",
        "metadata": {"type": "principle", "category": "자산관리"},
    },
    {
        "id": "principle_profit",
        "text": "투자 원칙 [익절]: 수익률 +15% 도달 시 보유량 절반 매도. 탐욕 방지.",
        "metadata": {"type": "principle", "category": "익절"},
    },
    {
        "id": "principle_loss",
        "text": "투자 원칙 [손절]: 매입가 대비 -8% 손절 (현재 비활성). 손실 확대 방지 원칙.",
        "metadata": {"type": "principle", "category": "손절"},
    },
    {
        "id": "portfolio_summary",
        "text": (
            "포트폴리오 요약. "
            "삼성전자 +147.8%, SK하이닉스 +50.4%, 테슬라 +18.2%. "
            "과거 실현: 삼성전자 1차 +26.2%, 2차 +21.7%. "
            "반도체 섹터 집중도 높음. 평균 보유기간 약 214일."
        ),
        "metadata": {"type": "summary"},
    },
]

# ChromaDB 초기화 (영구 저장 — 서버 재시작해도 데이터 유지)
CHROMA_DIR = BASE_DIR / "data" / "chroma"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

print("ChromaDB 초기화 중...", file=sys.stderr)
chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
embed_fn = GeminiEmbeddingFn()

collection = chroma_client.get_or_create_collection(
    name="trades",
    embedding_function=embed_fn,
    metadata={"hnsw:space": "cosine"},
)

if collection.count() == 0:
    print(f"ChromaDB에 {len(TRADE_DOCS)}개 문서 삽입 중...", file=sys.stderr)
    collection.add(
        ids=[d["id"] for d in TRADE_DOCS],
        documents=[d["text"] for d in TRADE_DOCS],
        metadatas=[d["metadata"] for d in TRADE_DOCS],
    )
    print(f"  → 삽입 완료 ({collection.count()}개)", file=sys.stderr)

print("ChromaDB 준비 완료!", file=sys.stderr)

# ══════════════════════════════════════════════════════════
#  채팅 기록 저장소
#  SQLite  → 구조적 전체 기록 (영구 보존)
#  ChromaDB chat_history → 의미 검색 (과거 대화 컨텍스트 재활용)
# ══════════════════════════════════════════════════════════

# ── SQLite 초기화 ──────────────────────────────────────────
DB_PATH = BASE_DIR / "data" / "chat_history.db"
DB_PATH.parent.mkdir(exist_ok=True)

_sqlite = sqlite3.connect(str(DB_PATH), check_same_thread=False)
_sqlite.row_factory = sqlite3.Row
_sqlite.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT    NOT NULL,
        user_msg    TEXT    NOT NULL,
        ai_msg      TEXT    NOT NULL,
        tools_used  TEXT    DEFAULT '[]',
        persona_type TEXT   DEFAULT '',
        created_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    )
""")
_sqlite.execute("CREATE INDEX IF NOT EXISTS idx_session  ON chat_history(session_id)")
_sqlite.execute("CREATE INDEX IF NOT EXISTS idx_created  ON chat_history(created_at)")
_sqlite.commit()
print(f"SQLite 준비 완료: {DB_PATH}", file=sys.stderr)

# ── ChromaDB chat_history 컬렉션 (영구 저장) ───────────────
chat_history_col = chroma_client.get_or_create_collection(
    name="chat_history",
    embedding_function=embed_fn,
    metadata={"hnsw:space": "cosine"},
)

# ── 서버 재시작 후 SQLite → ChromaDB 동기화 ──────────────────
# SQLite에 있는 기록 중 ChromaDB에 없는 것을 복구
def _sync_sqlite_to_chroma():
    import json
    try:
        existing_ids = set(chat_history_col.get()["ids"])
        rows = _sqlite.execute("SELECT id, user_msg, ai_msg, session_id, tools_used, persona_type, created_at FROM chat_history").fetchall()
        to_sync = [r for r in rows if f"chat_{r['id']}" not in existing_ids]
        if to_sync:
            chat_history_col.add(
                ids=[f"chat_{r['id']}" for r in to_sync],
                documents=[f"Q: {r['user_msg']}\nA: {r['ai_msg']}" for r in to_sync],
                metadatas=[{
                    "session_id":   r["session_id"],
                    "tools_used":   r["tools_used"] or "[]",
                    "persona_type": r["persona_type"] or "",
                    "created_at":   r["created_at"] or "",
                } for r in to_sync],
            )
            print(f"  → SQLite→ChromaDB 동기화: {len(to_sync)}건 복구", file=sys.stderr)
    except Exception as e:
        print(f"[sync warning] {e}", file=sys.stderr)

_sync_sqlite_to_chroma()
print(f"ChromaDB chat_history 준비 완료 (현재 {chat_history_col.count()}개)", file=sys.stderr)

# ══════════════════════════════════════════════════════════
#  FastAPI 앱
# ══════════════════════════════════════════════════════════
app = FastAPI(title="포디움 RAG 서버")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    persona_md: Optional[str] = ""
    history: Optional[List[HistoryMessage]] = []
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    retrieved_context: List[str]
    long_term_context: List[str]   # 장기기억에서 불러온 과거 대화
    skills_used: List[str]
    persona_active: bool


# ── 메인 RAG 채팅 엔드포인트 ─────────────────────────────
@app.post("/api/rag-chat", response_model=ChatResponse)
async def rag_chat(req: ChatRequest):
    """
    3단계 기억 구조:
      1순위 단기억  — 현재 창 대화 히스토리 (req.history)
      2순위 장기기억 — ChromaDB chat_history 과거 대화 의미 검색
      3순위 외부 데이터 — ChromaDB trades 거래 데이터 + skills/*.md
    """

    # ── Step 1: 스킬 선택 ────────────────────────────────
    selected_skills = select_skills(req.message, ALL_SKILLS)
    skill_block = build_skill_block(selected_skills, ALL_SKILLS, req.persona_md or "")
    print(f"[skills] {selected_skills}", file=sys.stderr)

    # ── Step 2: 장기기억 — 시맨틱 + SQL 키워드 병행 검색 ──
    FAILED_RESPONSE = "응답을 생성하지 못했어요."
    long_term_docs: List[str] = []

    # 2-a) ChromaDB 시맨틱 검색
    semantic_docs: List[str] = []
    if chat_history_col.count() > 0:
        try:
            n = min(5, chat_history_col.count())
            mem_res = chat_history_col.query(query_texts=[req.message], n_results=n)
            raw = mem_res["documents"][0] if mem_res["documents"] else []
            semantic_docs = [d for d in raw if FAILED_RESPONSE not in d]
        except Exception as e:
            print(f"[memory semantic error] {e}", file=sys.stderr)

    # 2-b) SQLite 키워드 검색 — 조사 제거 후 명사 추출, user_msg LIKE 검색
    keyword_docs: List[str] = []
    try:
        import re as _re
        # 조사 제거 함수 (이/가/은/는/을/를/에/의/로/과/와 등)
        def _strip_josa(w: str) -> str:
            for j in ["에서","이라고","이라","에게","이랑","이나","이고","이다","이에","이를","이가","이은","이는","이야","과","와","로","을","를","은","는","이","가"]:
                if w.endswith(j) and len(w) - len(j) >= 2:
                    return w[:-len(j)]
            return w
        # 의문사·대명사·조동사만 stop
        stop_q = {"내가","나는","나도","전에","이전","무슨","어떤","했지","했니","했어","말했","기억","뭐라고","뭐","것","거야","거지","대해","대해서","있어","있다","있는","있던","하고","하는","하면","해줘","알려줘"}
        raw_words = _re.findall(r'[가-힣A-Za-z0-9]{2,}', req.message)
        words = list(dict.fromkeys([
            _strip_josa(w) for w in raw_words
            if w not in stop_q and len(_strip_josa(w)) >= 2
        ]))
        if words:
            rows = []
            for w in words[:4]:
                found = _sqlite.execute(
                    "SELECT user_msg, ai_msg FROM chat_history WHERE user_msg LIKE ? AND ai_msg NOT LIKE ? ORDER BY created_at DESC LIMIT 3",
                    (f"%{w}%", f"%{FAILED_RESPONSE}%")
                ).fetchall()
                rows.extend(found)
            seen_kw: set = set()
            for r in rows:
                doc = f"Q: {r['user_msg']}\nA: {r['ai_msg']}"
                if doc not in seen_kw:
                    seen_kw.add(doc)
                    keyword_docs.append(doc)
    except Exception as e:
        print(f"[memory keyword error] {e}", file=sys.stderr)

    # 2-c) 병합 — 키워드 검색 우선, 시맨틱으로 보완 (중복 제거, 최대 3건)
    seen_lt: set = set()
    for doc in keyword_docs + semantic_docs:
        if doc not in seen_lt and FAILED_RESPONSE not in doc:
            seen_lt.add(doc)
            long_term_docs.append(doc)
        if len(long_term_docs) >= 3:
            break
    print(f"[장기기억] 시맨틱:{len(semantic_docs)} 키워드:{len(keyword_docs)} 최종:{len(long_term_docs)}건", file=sys.stderr)

    # ── Step 3: 외부 데이터 — 거래 ChromaDB 검색 ──────────
    try:
        results = collection.query(
            query_texts=[req.message],
            n_results=min(3, collection.count()),
        )
        retrieved_docs: List[str] = results["documents"][0] if results["documents"] else []
    except Exception as e:
        print(f"[chroma error] {e}", file=sys.stderr)
        retrieved_docs = []

    # ── Step 4: 시스템 프롬프트 3단계 조합 ──────────────
    # 2순위: 장기기억 블록 (사용자 배경 이해용)
    memory_block = ""
    if long_term_docs:
        lines = [f"[과거 대화 {i+1}] {doc}" for i, doc in enumerate(long_term_docs)]
        memory_block = (
            "\n\n---\n## 🧠 2순위 - 장기기억 (사용자 배경 정보)\n"
            + "\n".join(lines)
            + "\n※ 위 정보는 사용자를 이해하기 위한 배경 맥락입니다."
            + " 사용자가 과거 대화를 직접 물어볼 때만 꺼내고, 그 외엔 현재 질문에만 집중하여 답변하세요."
        )

    # 3순위: 외부 데이터 블록
    chroma_block = ""
    if retrieved_docs:
        lines = [f"[벡터DB 참조 {i+1}] {doc}" for i, doc in enumerate(retrieved_docs)]
        chroma_block = (
            "\n\n---\n## 📊 3순위 - 외부 데이터 (실제 거래 데이터)\n"
            + "\n".join(lines)
        )

    system_prompt = (
        "## 💬 1순위 - 단기억: 현재 대화창의 흐름을 최우선으로 답변\n\n"
        f"{skill_block}"
        f"{memory_block}"
        f"{chroma_block}\n\n"
        "---\n"
        "## 최종 응답 지침\n"
        "- 현재 질문에 집중하여 답변, 과거 대화는 사용자가 직접 물어볼 때만 언급\n"
        "- 수익률(%) 숫자를 반드시 구체적으로 언급\n"
        "- 과거 매매 패턴에서 인사이트 도출\n"
        "- 한국어, 이모지 1~2개, 2~4문장으로 간결하게 답변"
    )

    # ── Step 5: 단기억 — 현재 대화 이력 구성 ─────────────
    contents = []
    for msg in (req.history or [])[-10:]:
        role = "model" if msg.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg.content}]})
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    # ── Step 6: Gemini LLM 호출 ──────────────────────────
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GEMINI_GEN_URL,
                json={
                    "system_instruction": {"parts": [{"text": system_prompt}]},
                    "contents": contents,
                    "generationConfig": {"maxOutputTokens": 1000},
                },
                timeout=60,
            )
        data = resp.json()
        text: str = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        ) or "응답을 생성하지 못했어요."
    except Exception as e:
        print(f"[gemini error] {e}", file=sys.stderr)
        text = "AI 응답 오류가 발생했어요. 잠시 후 다시 시도해주세요."

    # ── Step 7: 자동 저장 — 장기기억 축적 (성공 응답만 저장) ──
    try:
        import json as _json
        # 실패 응답은 저장하지 않음 (노이즈 방지)
        if text in ("응답을 생성하지 못했어요.", "AI 응답 오류가 발생했어요. 잠시 후 다시 시도해주세요."):
            print("[자동저장 스킵] 실패 응답 저장 안 함", file=sys.stderr)
            raise Exception("skip")
        session = req.session_id or f"auto_{datetime.now().strftime('%Y%m%d')}"
        cur = _sqlite.execute(
            "INSERT INTO chat_history (session_id, user_msg, ai_msg, tools_used, persona_type) VALUES (?, ?, ?, ?, ?)",
            (session, req.message, text,
             _json.dumps(selected_skills, ensure_ascii=False), ""),
        )
        _sqlite.commit()
        record_id = cur.lastrowid
        chat_history_col.add(
            ids=[f"chat_{record_id}"],
            documents=[f"Q: {req.message}\nA: {text}"],
            metadatas=[{
                "session_id":   session,
                "tools_used":   _json.dumps(selected_skills),
                "persona_type": "",
                "created_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }],
        )
        print(f"[자동저장] chat_{record_id} 저장 완료", file=sys.stderr)
    except Exception as e:
        print(f"[auto-save error] {e}", file=sys.stderr)

    return ChatResponse(
        response=text,
        retrieved_context=retrieved_docs,
        long_term_context=long_term_docs,
        skills_used=selected_skills,
        persona_active=bool(req.persona_md),
    )


# ══════════════════════════════════════════════════════════
#  채팅 기록 API
# ══════════════════════════════════════════════════════════

class SaveChatRequest(BaseModel):
    session_id: str
    user_msg:   str
    ai_msg:     str
    tools_used: Optional[List[str]] = []
    persona_type: Optional[str] = ""


class ChatRecord(BaseModel):
    id:           int
    session_id:   str
    user_msg:     str
    ai_msg:       str
    tools_used:   List[str]
    persona_type: str
    created_at:   str


@app.post("/api/chat-history/save")
async def save_chat(req: SaveChatRequest):
    """
    Q&A 쌍을 SQLite + ChromaDB에 동시 저장.
    Node.js 서버가 Claude 응답 후 자동 호출.
    """
    import json, uuid

    # ── SQLite 저장 ───────────────────────────────────────
    cur = _sqlite.execute(
        "INSERT INTO chat_history (session_id, user_msg, ai_msg, tools_used, persona_type) "
        "VALUES (?, ?, ?, ?, ?)",
        (req.session_id, req.user_msg, req.ai_msg,
         json.dumps(req.tools_used, ensure_ascii=False),
         req.persona_type),
    )
    _sqlite.commit()
    record_id = cur.lastrowid

    # ── ChromaDB 저장 (임베딩 + 의미 검색용) ──────────────
    doc_text = f"Q: {req.user_msg}\nA: {req.ai_msg}"
    try:
        chat_history_col.add(
            ids=[f"chat_{record_id}"],
            documents=[doc_text],
            metadatas=[{
                "session_id":   req.session_id,
                "tools_used":   json.dumps(req.tools_used),
                "persona_type": req.persona_type,
                "created_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }],
        )
    except Exception as e:
        print(f"[chroma save error] {e}", file=sys.stderr)

    return {"saved": True, "id": record_id, "chroma_total": chat_history_col.count()}


@app.get("/api/chat-history/recent")
def get_recent_history(limit: int = Query(default=30, le=100)):
    """최근 채팅 기록 반환 (SQLite)"""
    import json
    rows = _sqlite.execute(
        "SELECT * FROM chat_history ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    return {
        "total": len(rows),
        "records": [
            {
                "id":           r["id"],
                "session_id":   r["session_id"],
                "user_msg":     r["user_msg"],
                "ai_msg":       r["ai_msg"],
                "tools_used":   json.loads(r["tools_used"] or "[]"),
                "persona_type": r["persona_type"],
                "created_at":   r["created_at"],
            }
            for r in rows
        ],
    }


@app.get("/api/chat-history/search")
async def search_chat_history(q: str = Query(...), top_k: int = Query(default=3, le=10)):
    """
    과거 대화에서 현재 질문과 의미적으로 유사한 Q&A 검색 (ChromaDB).
    Claude 응답 전에 호출해 관련 과거 대화를 컨텍스트로 주입.
    """
    import json
    if chat_history_col.count() == 0:
        return {"results": []}
    try:
        n = min(top_k, chat_history_col.count())
        results = chat_history_col.query(query_texts=[q], n_results=n)
        docs      = results["documents"][0] if results["documents"] else []
        metadatas = results["metadatas"][0]  if results["metadatas"] else []
        return {
            "results": [
                {"content": doc, "metadata": meta}
                for doc, meta in zip(docs, metadatas)
            ]
        }
    except Exception as e:
        print(f"[chroma search error] {e}", file=sys.stderr)
        return {"results": []}


@app.get("/api/sessions")
def get_sessions():
    """세션 목록 반환 (session_id 기준 그룹화, 최신 50개)"""
    rows = _sqlite.execute("""
        SELECT
            session_id,
            COUNT(*) as msg_count,
            MIN(created_at) as first_at,
            MAX(created_at) as last_at,
            MIN(user_msg) as preview
        FROM chat_history
        WHERE session_id NOT LIKE 'auto_%'
        GROUP BY session_id
        ORDER BY MAX(created_at) DESC
        LIMIT 50
    """).fetchall()
    return {
        "sessions": [
            {
                "id":        r["session_id"],
                "msgCount":  r["msg_count"],
                "createdAt": r["first_at"],
                "updatedAt": r["last_at"],
                "preview":   (r["preview"] or "")[:50],
            }
            for r in rows
        ]
    }


@app.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    """특정 세션의 전체 대화 반환 (user+assistant 쌍)"""
    import json as _j
    rows = _sqlite.execute(
        "SELECT user_msg, ai_msg, tools_used FROM chat_history WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    ).fetchall()
    messages = []
    for r in rows:
        messages.append({"role": "user", "content": r["user_msg"]})
        messages.append({
            "role":          "assistant",
            "content":       r["ai_msg"],
            "skillsUsed":    _j.loads(r["tools_used"] or "[]"),
            "ragContext":    [],
            "longTermContext": [],
        })
    return {"sessionId": session_id, "messages": messages}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "chroma_docs": collection.count(),
        "skills": list(ALL_SKILLS.keys()),
    }


@app.get("/skills")
def list_skills():
    """로드된 스킬 목록과 트리거 키워드 반환"""
    return {
        name: {
            "triggers": SKILL_TRIGGERS.get(name, []),
            "preview": content[:120] + "…",
        }
        for name, content in ALL_SKILLS.items()
    }


@app.get("/db-inspect")
def list_docs():
    """ChromaDB에 저장된 모든 문서 반환 (확인용)"""
    result = collection.get(include=["documents", "metadatas"])
    return {
        "total": len(result["ids"]),
        "documents": [
            {
                "id":       result["ids"][i],
                "type":     result["metadatas"][i].get("type", ""),
                "name":     result["metadatas"][i].get("name", ""),
                "content":  result["documents"][i],
                "metadata": result["metadatas"][i],
            }
            for i in range(len(result["ids"]))
        ],
    }


# ── 서버 실행 ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("포디움 RAG 서버 시작 → http://localhost:8000", file=sys.stderr)
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
