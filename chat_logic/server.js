// ═══════════════════════════════════════════════════════
//  server.js  —  포디움 통합 Express 서버 (포트 3001)
//
//  엔드포인트:
//    POST /api/chat              — 챗봇1 (캐릭터 대화)
//    POST /api/stock-chat        — 챗봇2 (AI 투자 분석)
//    GET  /api/yahoo/*           — Yahoo Finance CORS 프록시
//    GET  /health
//    POST /api/chat-history/save
//    GET  /api/chat-history/search
//    GET  /api/chat-history/recent
//    GET  /api/sessions
//    GET  /api/sessions/:id/messages
//    POST /api/trade-journal/save
//    GET  /api/trade-journal/:code
//
//  AI 폴백 순서 (챗봇1 & 챗봇2 공통):
//    1순위  OpenAI GPT + tool_use
//    2순위  Gemini RAG (ChromaDB → SQLite 벡터 스토어)
//    3순위  Gemini Flash mini 직접 호출
// ═══════════════════════════════════════════════════════

import dotenv       from 'dotenv';
import { fileURLToPath } from 'url';
import path         from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import OpenAI  from 'openai';

import { chat } from './cuming/chat.js';   // 챗봇1 OpenAI tool_use
import {
  saveChatHistory, searchChatHistory,
  getSessions, getSessionMessages,
  searchVectors, addVectorSync, addVector,
} from './db.js';
import { fetchStockPrice, fetchStockNews } from './agentHelpers.js';

// ── Express 초기화 ────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── API 키 ────────────────────────────────────────────────
const GEMINI_KEY  = process.env.GOOGLE_API_KEY || '';
const OPENAI_KEY  = process.env.OPENAI_API_KEY || '';
const FAILED_MSG  = '응답을 생성하지 못했어요.';

const GEMINI_GEN_URL = GEMINI_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`
  : '';

// ══════════════════════════════════════════════════════════
//  과거 매매 데이터 (과거 매매이력 DB 역할)
//  — 챗봇2 tool_use 및 벡터 preload 에 사용
// ══════════════════════════════════════════════════════════
const PAST_TRADES = [
  { id:1,  code:"005930", name:"삼성전자", type:"buy",  price:24800,  qty:50, date:"2015-09-01", note:"중국 쇼크 폭락 구간 분할 매수 진입" },
  { id:2,  code:"005930", name:"삼성전자", type:"sell", price:30200,  qty:50, date:"2016-08-18", note:"갤럭시 노트7 발표 전 목표가 달성 매도", profit:270000,  profitPct:21.8, holdDays:351 },
  { id:3,  code:"005930", name:"삼성전자", type:"buy",  price:38500,  qty:40, date:"2018-11-06", note:"반도체 업황 둔화로 주가 급락, 저점 분할 매수" },
  { id:4,  code:"005930", name:"삼성전자", type:"sell", price:46200,  qty:40, date:"2019-04-22", note:"1Q 실적 발표 전 목표가 도달, 전량 매도",  profit:308000,  profitPct:20.0, holdDays:167 },
  { id:5,  code:"005930", name:"삼성전자", type:"buy",  price:42000,  qty:20, date:"2021-03-15", note:"반도체 슈퍼사이클 기대 매수" },
  { id:6,  code:"005930", name:"삼성전자", type:"sell", price:53000,  qty:20, date:"2021-09-08", note:"목표가 달성 매도",                          profit:220000,  profitPct:26.2, holdDays:177 },
  { id:7,  code:"005930", name:"삼성전자", type:"buy",  price:58500,  qty:15, date:"2022-10-12", note:"주가 저점 판단, 분할 매수 진입" },
  { id:8,  code:"005930", name:"삼성전자", type:"sell", price:71200,  qty:15, date:"2023-06-20", note:"단기 고점 판단, 목표가 도달 매도",           profit:190500,  profitPct:21.7, holdDays:251 },
];

const CURRENT_HOLDINGS = [
  { code:"005930", name:"삼성전자",   avgPrice:67400,  qty:15, currentPrice:167000, profitPct:147.8 },
  { code:"000660", name:"SK하이닉스", avgPrice:132000, qty:5,  currentPrice:198500, profitPct:50.4  },
  { code:"TSLA",   name:"테슬라",     avgPrice:210.5,  qty:3,  currentPrice:248.9,  profitPct:18.2  },
];

const TRADE_JOURNAL = [
  { tradeId:2, date:"2016-08-18", stock:"삼성전자", action:"매도", reason:"목표가(30,200원) 달성 전량 매도.", emotion:"1년 보유 인내 끝 목표 달성.", lesson:"목표가를 사전에 정하면 감정에 흔들리지 않는다." },
  { tradeId:4, date:"2019-04-22", stock:"삼성전자", action:"매도", reason:"1Q 실적 전 목표가 도달, 전량 매도.", emotion:"실적 불확실성 리스크 관리.", lesson:"이벤트 전 수익실현이 심리적으로 안정적." },
  { tradeId:6, date:"2021-09-08", stock:"삼성전자", action:"매도", reason:"목표가(53,000원) 달성. 원칙대로 수익 실현.", emotion:"3개월 횡보 불안했지만 원칙 유지.", lesson:"목표가 사전 설정 → 감정 배제 성공." },
  { tradeId:7, date:"2022-10-12", stock:"삼성전자", action:"매수", reason:"52주 신저가 근처 저점 판단, 분할 매수.", emotion:"저점 확신 어려워 분할로 심리 안정.", lesson:"불확실 구간에서 분할 매수가 유리." },
  { tradeId:8, date:"2023-06-20", stock:"삼성전자", action:"매도", reason:"단기 고점 판단, 71,200원 목표가 도달 전량 매도.", emotion:"더 오를 것 같아 아쉬웠지만 원칙 지킴.", lesson:"익절선 계획 준수가 장기 수익에 유리." },
];


// ══════════════════════════════════════════════════════════
//  벡터 DB 사전 로드 (과거 매매 데이터 → 검색 가능 상태로)
// ══════════════════════════════════════════════════════════
function preloadTradeDocs() {
  const docs = [
    {
      id: 'trade_samsung_all',
      text: `삼성전자(005930) 총 4차례 매매. ` +
            `2015-09 24,800원 매수→2016-08 30,200원 매도 +21.8%. ` +
            `2018-11 38,500원 매수→2019-04 46,200원 매도 +20.0%. ` +
            `2021-03 42,000원 매수→2021-09 53,000원 매도 +26.2%. ` +
            `2022-10 58,500원 매수→2023-06 71,200원 매도 +21.7%. ` +
            `전승. 평균 보유 약 237일.`,
      meta: { type:'trade', code:'005930', name:'삼성전자' },
    },
    {
      id: 'holding_samsung',
      text: `현재 보유 삼성전자(005930): 15주, 평균매입가 67,400원, 현재가 167,000원, 수익률 +147.8%, 총평가액 2,505,000원.`,
      meta: { type:'holding', code:'005930', name:'삼성전자' },
    },
    {
      id: 'holding_skhynix',
      text: `현재 보유 SK하이닉스(000660): 5주, 평균매입가 132,000원, 현재가 198,500원, 수익률 +50.4%, 총평가액 992,500원.`,
      meta: { type:'holding', code:'000660', name:'SK하이닉스' },
    },
    {
      id: 'holding_tesla',
      text: `현재 보유 테슬라(TSLA): 3주, 평균매입가 $210.5, 현재가 $248.9, 수익률 +18.2%, 총평가액 $746.7.`,
      meta: { type:'holding', code:'TSLA', name:'테슬라' },
    },
    {
      id: 'portfolio_summary',
      text: `포트폴리오 요약. 삼성전자 +147.8%, SK하이닉스 +50.4%, 테슬라 +18.2%. ` +
            `과거 실현: 4전 4승, 평균 수익률 +22.4%. 반도체 섹터 집중.`,
      meta: { type:'summary' },
    },
    {
      id: 'journal_pattern',
      text: `매매 패턴: 목표가 사전 설정 → 감정 배제 → 원칙 매도 성공. ` +
            `저점 분할 매수, 익절선 준수가 강점. 손절 원칙 비활성이 개선점.`,
      meta: { type:'journal' },
    },
    {
      id: 'principle_all',
      text: `투자 원칙: [기술적] 매수 전 전고점 확인 필수. ` +
            `[자산관리] 단일 종목 비중 20% 이내. ` +
            `[익절] +15% 도달 시 절반 익절. ` +
            `[손절] -8% 손절 (현재 비활성).`,
      meta: { type:'principle' },
    },
  ];

  for (const d of docs) {
    addVectorSync(d.id, d.text, d.meta, 'trade');
  }

  // ── 매매일지 → type='journal' 으로 벡터 preload ──────────
  for (const j of TRADE_JOURNAL) {
    addVectorSync(
      `journal_${j.tradeId}`,
      `[매매일지 ${j.date}] ${j.stock} ${j.action}: ${j.reason} 교훈: ${j.lesson}`,
      { date: j.date, stock: j.stock },
      'journal',
    );
  }

  console.log(`[벡터DB] 매매 데이터 ${docs.length}건 + 매매일지 ${TRADE_JOURNAL.length}건 preload 완료`);
}

preloadTradeDocs();

// ══════════════════════════════════════════════════════════
//  Yahoo Finance 서버 사이드 실시간 조회 (agentHelpers에서 import)
//  fetchStockPrice, fetchStockNews, searchMemory → ./agentHelpers.js
// ══════════════════════════════════════════════════════════

// 보유 종목 전체 조회 → 텍스트 생성 → Vector 저장 (챗봇1용)
async function fetchAndStoreHoldingsYahoo() {
  const lines = [];
  for (const h of CURRENT_HOLDINGS) {
    const q = await fetchStockPrice(h.code);
    if (!q) continue;
    const isKR   = /^\d{6}$/.test(h.code);
    const priceStr = isKR
      ? `${Math.round(q.price).toLocaleString()}원`
      : `$${q.price}`;
    const sign   = q.pct >= 0 ? '+' : '';
    const liveText =
      `[실시간 Yahoo Finance] ${h.name}(${h.code}): ` +
      `현재가 ${priceStr} (${sign}${q.pct}%), ` +
      `평균매입가 ${isKR ? h.avgPrice.toLocaleString() + '원' : '$' + h.avgPrice}, ` +
      `보유수익률 ${h.profitPct >= 0 ? '+' : ''}${h.profitPct}%`;

    // Vector 저장 (type='yahoo' — 외부 데이터)
    const vecId = `yahoo_${h.code}`;
    addVector(vecId, liveText, { code: h.code, name: h.name }, 'yahoo').catch(() => {});
    lines.push(liveText);
  }
  return lines;
}

// 단일 종목 조회 → 텍스트 생성 → Vector 유사도 검색 (챗봇2용)
async function fetchStockAndSearchSimilar(stock_code) {
  const holding   = CURRENT_HOLDINGS.find(h => h.code === stock_code);
  const q         = await fetchStockPrice(stock_code);
  if (!q) return { liveText: '', similarTrades: [] };

  const isKR      = /^\d{6}$/.test(stock_code);
  const priceStr  = isKR ? `${Math.round(q.price).toLocaleString()}원` : `$${q.price}`;
  const sign      = q.pct >= 0 ? '+' : '';
  const liveText  =
    `[실시간 Yahoo Finance] ${holding?.name || stock_code}(${stock_code}): ` +
    `현재가 ${priceStr} (${sign}${q.pct}%)` +
    (holding
      ? `, 평균매입가 ${isKR ? holding.avgPrice.toLocaleString() + '원' : '$' + holding.avgPrice}` +
        `, 보유수익률 ${holding.profitPct >= 0 ? '+' : ''}${holding.profitPct}%`
      : '');

  // Vector 변환 후 유사도 검색 — 과거 비슷한 패턴 찾기
  const similarTrades = await searchVectors(liveText, 3, 'trade');

  // 조회 데이터 자체도 Vector 저장
  addVector(`yahoo_stock2_${stock_code}`, liveText, { code: stock_code }, 'yahoo').catch(() => {});

  return { liveText, similarTrades };
}

// ══════════════════════════════════════════════════════════
//  Gemini 생성 호출 (RAG용 / 직접 호출 공용)
// ══════════════════════════════════════════════════════════
async function callGemini(message, history, systemPrompt) {
  if (!GEMINI_GEN_URL) throw new Error('GOOGLE_API_KEY 없음');

  const contents = [
    ...history.slice(-10).map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const res  = await fetch(GEMINI_GEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1000 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || FAILED_MSG;
}

// ══════════════════════════════════════════════════════════
//  챗봇2 전용 OpenAI — Pre-fetch RAG (LLM 1번 호출)
// ══════════════════════════════════════════════════════════
const openai2 = new OpenAI({ apiKey: OPENAI_KEY });
const MODEL2  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// 챗봇2: OpenAI 1번만 호출 (tools 없음, 컨텍스트 이미 주입됨)
async function chatStock(messages, systemPrompt) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY 없음');
  const res = await openai2.chat.completions.create({
    model:      MODEL2,
    max_tokens: 1024,
    messages:   [{ role: 'system', content: systemPrompt }, ...messages],
  });
  return {
    text:       res.choices[0].message?.content ?? FAILED_MSG,
    tools_used: [],
  };
}

// ══════════════════════════════════════════════════════════
//  Yahoo Finance CORS 프록시
// ══════════════════════════════════════════════════════════
app.use('/api/yahoo', async (req, res) => {
  const yPath  = req.path;
  const query  = new URLSearchParams(req.query).toString();
  const url    = `https://query1.finance.yahoo.com${yPath}${query ? '?' + query : ''}`;
  try {
    const r    = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json; charset=utf-8').send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 헬스 체크 ─────────────────────────────────────────────
app.get('/health', (_, res) =>
  res.json({ status: 'ok', server: 'unified', ai: { openai: !!OPENAI_KEY, gemini: !!GEMINI_KEY } }),
);

// ══════════════════════════════════════════════════════════
//  챗봇1: 캐릭터 대화  POST /api/chat
//
//  주입 컨텍스트:
//    1순위  단기억  — history (last 10)
//    2순위  장기기억 — SQLite 키워드 + 벡터 유사도 (3일 이내)
//    3순위  외부 데이터 — 매매이력 벡터 검색
// ══════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  const {
    message,
    persona_md   = '',
    persona_type = '',
    session_id   = `s_${Date.now()}`,
    history      = [],
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  // ── 단기억 메시지 구성 (last 10) ─────────────────────────
  const messages = [
    ...history.slice(-10).map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // ── 1순위: OpenAI GPT Agent ──────────────────────────────
  //    Agent가 search_memory / get_stock_price / search_stock_news
  //    / get_trade_history / get_trade_journal / get_persona 를
  //    스스로 판단해 호출 (pre-fetch 없음)
  try {
    const result = await chat(messages, persona_md);
    saveChatHistory({ session_id, user_msg: message, ai_msg: result.text, tools_used: result.tools_used, persona_type }).catch(() => {});
    return res.json({
      response:   result.text,
      tools_used: result.tools_used,
      session_id,
    });
  } catch (e) {
    console.warn('[챗봇1] OpenAI 실패:', e.message);
  }

  // ── Gemini 폴백용 컨텍스트 pre-fetch (Gemini는 tool_use 불가) ──
  const pastChats = await searchChatHistory(message);
  const memoryContext = pastChats.length > 0
    ? `\n\n### 🧠 장기기억\n${pastChats.map((c, i) => `[과거 대화 ${i + 1}]\n${c.content}`).join('\n\n')}\n`
    : '';

  const isStockQuery = /주가|현재가|시세|가격|얼마|올랐|떨어|상승|하락|수익|손실|포트|보유|삼성|하이닉스|테슬라/.test(message);
  let yahooContext = '';
  if (isStockQuery) {
    const yahooLines = await fetchAndStoreHoldingsYahoo();
    if (yahooLines.length > 0) {
      yahooContext =
        `\n\n### 📡 Yahoo Finance 실시간\n${yahooLines.join('\n')}\n위 수치를 활용해 답하세요.`;
    }
  }

  // ── 2순위: Gemini RAG ─────────────────────────────────────
  if (GEMINI_KEY) {
    try {
      const tradeDocs  = await searchVectors(message, 3, 'trade');
      const tradeBlock = tradeDocs.length > 0
        ? `\n\n### 📊 과거 매매이력\n${tradeDocs.map(d => d.text).join('\n')}`
        : '';

      const systemPrompt =
        `당신은 투자 AI 파트너입니다.\n${persona_md}` +
        `${memoryContext}${tradeBlock}${yahooContext}\n\n한국어로 2~4문장, 이모지 1~2개로 답하세요.`;

      const text = await callGemini(message, history, systemPrompt);
      if (text && text !== FAILED_MSG) {
        saveChatHistory({ session_id, user_msg: message, ai_msg: text, tools_used: [], persona_type }).catch(() => {});
        return res.json({ response: text, tools_used: [], session_id });
      }
    } catch (e) {
      console.warn('[챗봇1] Gemini RAG 실패:', e.message);
    }
  }

  // ── 3순위: Gemini Flash 직접 호출 (최소 컨텍스트) ──────────
  if (GEMINI_KEY) {
    try {
      const text = await callGemini(message, history,
        `당신은 투자 도우미입니다. ${persona_md}${yahooContext}\n한국어로 2~4문장, 이모지 1~2개로 답하세요.`);
      saveChatHistory({ session_id, user_msg: message, ai_msg: text, tools_used: [], persona_type }).catch(() => {});
      return res.json({ response: text, tools_used: [], session_id });
    } catch (e) {
      console.error('[챗봇1] Gemini 직접 실패:', e.message);
    }
  }

  res.status(500).json({ error: FAILED_MSG });
});

// ══════════════════════════════════════════════════════════
//  챗봇2: AI 투자 분석  POST /api/stock-chat
//
//  Pre-fetch RAG — OpenAI 1번 호출
//  주입 컨텍스트 (LLM 호출 전 JS가 병렬 수집):
//    ① Yahoo Finance 실시간 주가 + 벡터 유사도 검색
//    ② 과거 매매이력 DB (전체 원본)
//    ③ 매매일지 DB (전체 원본)
//    ④ 관련 뉴스/공시 (Yahoo Finance)
//    ⑤ 프론트엔드 기술지표/매매포인트 컨텍스트
//  저장 없음 (세션 메모리만)
// ══════════════════════════════════════════════════════════
app.post('/api/stock-chat', async (req, res) => {
  const {
    message,
    context    = '',  // 프론트엔드 종목 컨텍스트 (기술지표, 매매포인트 등)
    history    = [],
    stock_code = '',  // 종목 코드 (Yahoo Finance 서버 조회용)
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  // ── ① 모든 데이터 병렬 Pre-fetch (LLM 호출 전) ─────────
  const [yahooResult, news] = await Promise.all([
    stock_code ? fetchStockAndSearchSimilar(stock_code) : Promise.resolve({ liveText: '', similarTrades: [] }),
    fetchStockNews(message, 3).catch(() => []),
  ]);

  // ── ② Yahoo Finance 실시간 블록 ─────────────────────────
  let yahooBlock = '';
  if (yahooResult.liveText) {
    yahooBlock = `\n### 📡 Yahoo Finance 실시간\n${yahooResult.liveText}`;
    if (yahooResult.similarTrades.length > 0) {
      yahooBlock += `\n\n[벡터 유사도 — 비슷한 과거 매매 패턴]\n${yahooResult.similarTrades.map(d => d.text).join('\n')}`;
    }
  }

  // ── ③ 과거 매매이력 DB 전체 원본 ────────────────────────
  const tradeHistoryBlock =
    `\n### 📈 과거 매매이력 DB (전체)\n` +
    PAST_TRADES.map(t => {
      const isKR   = t.code !== 'TSLA';
      const price  = isKR ? `${t.price.toLocaleString()}원` : `$${t.price}`;
      const profit = t.profitPct ? ` → +${t.profitPct}% (${t.holdDays}일)` : '';
      return `[${t.date}] ${t.name} ${t.type === 'buy' ? '매수' : '매도'} ${price} ${t.qty}주${profit} | ${t.note}`;
    }).join('\n');

  // ── ④ 매매일지 DB 전체 원본 ─────────────────────────────
  const journalBlock =
    `\n### 📓 매매일지 DB (전체)\n` +
    TRADE_JOURNAL.map(j =>
      `[${j.date}] ${j.stock} ${j.action}: ${j.reason} | 감정: ${j.emotion} | 교훈: ${j.lesson}`
    ).join('\n');

  // ── ⑤ 관련 뉴스 ─────────────────────────────────────────
  const newsBlock = news.length > 0
    ? `\n### 📰 관련 뉴스/공시\n${news.map(n => `- ${n.title} (${n.publishedAt || n.publisher || ''})`).join('\n')}`
    : '';

  // ── system prompt 조합 ───────────────────────────────────
  const systemBase =
    `당신은 주식 투자 AI 분석가입니다. 매매포인트·패턴분석 결과를 기반으로 맞춤 답변을 제공합니다.\n` +
    `\n### 🖥️ 프론트엔드 컨텍스트 (기술지표/매매포인트)\n${context}` +
    `${yahooBlock}` +
    `${tradeHistoryBlock}` +
    `${journalBlock}` +
    `${newsBlock}\n\n` +
    `위 데이터를 참고하여 한국어로 2~4문장, 이모지 1~2개로 답하세요.`;

  const messages = [
    ...history.slice(-10).map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.text ?? m.content ?? '',
    })),
    { role: 'user', content: message },
  ];

  // ── 1순위: OpenAI GPT (Pre-fetch RAG, 1번 호출) ─────────
  try {
    const result = await chatStock(messages, systemBase);
    return res.json({ response: result.text, tools_used: result.tools_used });
  } catch (e) {
    console.warn('[챗봇2] OpenAI 실패:', e.message);
  }

  // ── 2순위: Gemini RAG (과거 매매이력 + 매매일지 + Yahoo Finance 주입됨) ──
  if (GEMINI_KEY) {
    try {
      const text = await callGemini(message, history, systemBase);
      if (text && text !== FAILED_MSG) {
        return res.json({ response: text, tools_used: [] });
      }
    } catch (e) {
      console.warn('[챗봇2] Gemini RAG 실패:', e.message);
    }
  }

  // ── 3순위: Gemini Flash mini 직접 호출 (최소 컨텍스트) ──
  if (GEMINI_KEY) {
    try {
      const minimalPrompt =
        `당신은 주식 투자 AI 분석가입니다.\n[종목 컨텍스트]\n${context}\n한국어로 2~4문장, 이모지 1~2개로 답하세요.`;
      const text = await callGemini(message, history, minimalPrompt);
      return res.json({ response: text, tools_used: [] });
    } catch (e) {
      console.error('[챗봇2] Gemini 직접 실패:', e.message);
    }
  }

  res.status(500).json({ error: FAILED_MSG });
});

// ══════════════════════════════════════════════════════════
//  세션 API
// ══════════════════════════════════════════════════════════
app.get('/api/sessions', (_, res) => {
  res.json({ sessions: getSessions() });
});

app.get('/api/sessions/:id/messages', (req, res) => {
  res.json({ messages: getSessionMessages(req.params.id) });
});

// ══════════════════════════════════════════════════════════
//  POST /api/yahoo-vector/save — 종목 벡터 저장
//  Yahoo Finance 실시간 데이터를 trade_vectors.json에 저장
// ══════════════════════════════════════════════════════════
app.post('/api/yahoo-vector/save', async (req, res) => {
  const { code, text, metadata = {} } = req.body;
  if (!code || !text) return res.status(400).json({ error: 'code and text are required' });
  try {
    await addVector(`yahoo_${code}`, text, { code, ...metadata }, 'yahoo');
    res.json({ saved: true, id: `yahoo_${code}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 서버 시작 ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n포디움 통합 서버 → http://localhost:${PORT}`);
  console.log('  OpenAI :', OPENAI_KEY ? '✅' : '❌ (OPENAI_API_KEY 없음)');
  console.log('  Gemini :', GEMINI_KEY ? '✅' : '❌ (GOOGLE_API_KEY 없음)');
  console.log('  엔드포인트:');
  console.log('    POST /api/chat              → 챗봇1');
  console.log('    POST /api/stock-chat        → 챗봇2');
  console.log('    GET  /api/yahoo/:symbol     → Yahoo Finance 프록시');
  console.log('    POST /api/yahoo-vector/save → 종목 벡터 저장');
  console.log('    GET  /api/sessions          → 세션 목록');
  console.log('    GET  /health                → 서버 상태\n');
});
