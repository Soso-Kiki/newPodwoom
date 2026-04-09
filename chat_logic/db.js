// ═══════════════════════════════════════════════════════
//  db.js  —  JSON 파일 기반 저장소
//
//  파일:
//    data/chat_history.json   — 챗봇1 장기기억 (최대 500건)
//    data/trade_vectors.json  — 매매이력/일지/종목 벡터
//
//  내보내기:
//    getEmbedding, addVector, addVectorSync, searchVectors
//    saveChatHistory, searchChatHistory, getRecentHistory
//    getSessions, getSessionMessages
//    saveTradeJournal, getTradeJournal
// ═══════════════════════════════════════════════════════

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, 'data');
const CHAT_FILE  = path.join(DATA_DIR, 'chat_history.json');
const VEC_FILE   = path.join(DATA_DIR, 'trade_vectors.json');
const MAX_CHAT   = 500;

// ── 디렉터리·파일 초기화 ─────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CHAT_FILE))  fs.writeFileSync(CHAT_FILE,  '[]', 'utf-8');
if (!fs.existsSync(VEC_FILE))   fs.writeFileSync(VEC_FILE,   '[]', 'utf-8');

// ── JSON 읽기/쓰기 헬퍼 ──────────────────────────────────
function readChat()  { try { return JSON.parse(fs.readFileSync(CHAT_FILE,  'utf-8')); } catch { return []; } }
function readVecs()  { try { return JSON.parse(fs.readFileSync(VEC_FILE,   'utf-8')); } catch { return []; } }
function writeChat(d){ fs.writeFileSync(CHAT_FILE,  JSON.stringify(d, null, 2), 'utf-8'); }
function writeVecs(d){ fs.writeFileSync(VEC_FILE,   JSON.stringify(d, null, 2), 'utf-8'); }

// ══════════════════════════════════════════════════════════
//  Gemini 임베딩 (gemini-embedding-001, dim=3072)
// ══════════════════════════════════════════════════════════
const GEMINI_KEY = process.env.GOOGLE_API_KEY || '';
const EMBED_URL  = GEMINI_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`
  : '';

export async function getEmbedding(text) {
  if (!EMBED_URL) return null;
  try {
    const res  = await fetch(EMBED_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   'models/gemini-embedding-001',
        content: { parts: [{ text }] },
      }),
    });
    const data = await res.json();
    return data?.embedding?.values || null;
  } catch { return null; }
}

// ── 코사인 유사도 ─────────────────────────────────────────
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : Math.max(0, dot / denom);
}

// ══════════════════════════════════════════════════════════
//  trade_vectors.json — 벡터 CRUD
// ══════════════════════════════════════════════════════════

export async function addVector(id, text, metadata = {}, type = 'misc') {
  const embedding = await getEmbedding(text);
  const vecs = readVecs();
  const idx  = vecs.findIndex(v => v.id === id);
  const entry = { id, text, embedding, metadata, type, created_at: new Date().toISOString() };
  if (idx >= 0) vecs[idx] = entry;
  else          vecs.push(entry);
  writeVecs(vecs);
}

// 임베딩 없이 텍스트만 저장 (서버 시작 시 빠른 preload용)
export function addVectorSync(id, text, metadata = {}, type = 'misc') {
  const vecs = readVecs();
  if (vecs.find(v => v.id === id)) return;   // INSERT OR IGNORE
  vecs.push({ id, text, embedding: null, metadata, type, created_at: new Date().toISOString() });
  writeVecs(vecs);
}

// ── 키워드 + 코사인 하이브리드 검색 ──────────────────────
export async function searchVectors(query, topK = 3, type = null, createdAfter = null) {
  const FAILED = '응답을 생성하지 못했어요.';

  const josa = ['에서','이라고','이라','에게','이랑','이나','이고','이다','에','과','와','로','을','를','은','는','이','가'];
  const stop  = new Set(['내가','나는','나도','전에','이전','무슨','어떤','했지','했어','기억','뭐','것','거야','거지','있어','해줘','알려줘']);
  const words = [...new Set(
    (query.match(/[가-힣A-Za-z0-9]{2,}/g) || []).map(w => {
      for (const j of josa) if (w.endsWith(j) && w.length - j.length >= 2) return w.slice(0, -j.length);
      return w;
    }).filter(w => !stop.has(w) && w.length >= 2),
  )];

  const cutoff = createdAfter || new Date(Date.now() - 3 * 86400000).toISOString();

  const vecs = readVecs().filter(v =>
    !v.text.includes(FAILED) &&
    (!type || v.type === type) &&
    (!createdAfter || v.created_at >= cutoff),
  );

  const seen    = new Set();
  const results = [];

  // 1) 키워드 검색 (빠름)
  for (const w of words.slice(0, 4)) {
    for (const v of vecs) {
      if (!seen.has(v.id) && v.text.includes(w)) {
        seen.add(v.id);
        results.push({ text: v.text, metadata: v.metadata });
        if (results.length >= topK) break;
      }
    }
    if (results.length >= topK) break;
  }

  // 2) 코사인 유사도 보완
  if (results.length < topK) {
    const queryEmb = await getEmbedding(query);
    if (queryEmb) {
      const scored = vecs
        .filter(v => v.embedding && !seen.has(v.id))
        .map(v => ({ ...v, score: cosineSim(queryEmb, v.embedding) }))
        .sort((a, b) => b.score - a.score);

      for (const v of scored) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          results.push({ text: v.text, metadata: v.metadata });
          if (results.length >= topK) break;
        }
      }
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════
//  chat_history.json — 채팅 기록
// ══════════════════════════════════════════════════════════

export async function saveChatHistory({ session_id, user_msg, ai_msg, tools_used = [], persona_type = '' }) {
  const history = readChat();
  const id = history.length > 0 ? Math.max(...history.map(h => h.id || 0)) + 1 : 1;

  history.push({ id, session_id, user_msg, ai_msg, tools_used, persona_type, created_at: new Date().toISOString() });

  // 최대 500건 — 오래된 항목 제거
  if (history.length > MAX_CHAT) history.splice(0, history.length - MAX_CHAT);
  writeChat(history);

  // 비동기 벡터 저장 (검색용 — trade_vectors.json의 type='chat_history')
  addVector(
    `chat_${id}`,
    `Q: ${user_msg}\nA: ${ai_msg}`,
    { session_id, persona_type },
    'chat_history',
  ).catch(() => {});

  return id;
}

export async function searchChatHistory(query, topK = 3) {
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();
  const results = await searchVectors(query, topK, 'chat_history', cutoff);
  return results.map(r => ({ content: r.text, metadata: r.metadata }));
}

export function getRecentHistory(limit = 30) {
  return readChat().slice(-limit).reverse();
}

// ── 세션 API ──────────────────────────────────────────────
export function getSessions() {
  const history = readChat();
  const map = new Map();
  for (const h of history) {
    if (!map.has(h.session_id)) {
      map.set(h.session_id, { id: h.session_id, createdAt: h.created_at, msgCount: 0, preview: '' });
    }
    const s = map.get(h.session_id);
    s.msgCount++;
    s.preview = (h.user_msg || '').slice(0, 50);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
}

export function getSessionMessages(sessionId) {
  const msgs = [];
  for (const h of readChat().filter(h => h.session_id === sessionId)) {
    msgs.push({ role: 'user',      content: h.user_msg });
    msgs.push({ role: 'assistant', content: h.ai_msg   });
  }
  return msgs;
}

// ══════════════════════════════════════════════════════════
//  매매일지 — trade_vectors.json의 type='trade_journal'
// ══════════════════════════════════════════════════════════

export function saveTradeJournal(code, ai_data, raw) {
  const vecs = readVecs();
  const id   = `trade_journal_${code}`;
  const idx  = vecs.findIndex(v => v.id === id);
  const entry = {
    id, text: raw || ai_data, embedding: null,
    metadata: { code, ai_data, raw, updated_at: new Date().toISOString() },
    type: 'trade_journal',
    created_at: idx >= 0 ? vecs[idx].created_at : new Date().toISOString(),
  };
  if (idx >= 0) vecs[idx] = entry;
  else          vecs.push(entry);
  writeVecs(vecs);
}

export function getTradeJournal(code) {
  const v = readVecs().find(v => v.id === `trade_journal_${code}`);
  return v ? v.metadata : null;
}
